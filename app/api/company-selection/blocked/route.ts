import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * Pobiera listę zablokowanych firm
 * GET /api/company-selection/blocked
 */
export async function GET(req: NextRequest) {
  try {
    // Używamy surowego zapytania SQL, bo Prisma Client może jeszcze nie widzieć nowych pól
    const blockedCompanies = await db.$queryRaw<Array<{
      id: number;
      companyName: string | null;
      website: string | null;
      reason: string | null;
      blockType: string;
      companyId: number | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy: string | null;
    }>>`
      SELECT 
        id,
        companyName,
        website,
        reason,
        COALESCE(blockType, 'MANUAL') as blockType,
        companyId,
        createdAt,
        updatedAt,
        createdBy
      FROM BlockedCompany
      ORDER BY COALESCE(blockType, 'MANUAL') ASC, createdAt DESC
    `;

    return NextResponse.json({
      success: true,
      blockedCompanies: blockedCompanies.map((bc) => ({
        id: bc.id,
        companyName: bc.companyName,
        website: bc.website || null,
        reason: bc.reason,
        blockType: bc.blockType || "MANUAL",
        companyId: bc.companyId || null,
        createdAt: bc.createdAt.toISOString(),
        updatedAt: bc.updatedAt.toISOString(),
        createdBy: bc.createdBy,
      })),
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-blocked", "Błąd pobierania listy zablokowanych firm", null, errorObj);
    return NextResponse.json(
      { error: "Błąd pobierania listy zablokowanych firm", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Dodaje firmę do listy zablokowanych
 * POST /api/company-selection/blocked
 */
export async function POST(req: NextRequest) {
  try {
    const { companyName, website, reason } = await req.json();

    // Website jest wymagane - blokujemy tylko po adresie www
    if (!website || typeof website !== "string" || !website.trim()) {
      return NextResponse.json(
        { error: "Adres www jest wymagany do blokowania firmy" },
        { status: 400 }
      );
    }

    // Normalizuj adres www (usuń spacje, znormalizuj do lowercase)
    const normalizedWebsite = website.trim().toLowerCase();

    // Sprawdź czy już istnieje (używamy findFirst, bo findUnique może nie działać z nowym polem przed regeneracją Prisma Client)
    const existing = await db.blockedCompany.findFirst({
      where: { website: normalizedWebsite } as any,
    });

    if (existing) {
      return NextResponse.json(
        { error: "Firma z tym adresem www już jest na liście zablokowanych" },
        { status: 400 }
      );
    }

    // Dodaj do listy zablokowanych
    const blockedCompany = await db.blockedCompany.create({
      data: {
        companyName: companyName ? companyName.trim() : null,
        website: normalizedWebsite,
        reason: reason || null,
        blockType: "MANUAL",
        createdBy: "USER",
      } as any,
    });

    // Znajdź wszystkie firmy z tym adresem www (dokładne dopasowanie, case-insensitive)
    // SQLite nie obsługuje mode: "insensitive", więc normalizujemy ręcznie
    const allCompanies = await db.company.findMany({
      where: {
        website: { not: null },
        verificationStatus: { not: "BLOCKED" },
      },
      select: { id: true, name: true, website: true },
    });

    const matchingCompanies = allCompanies.filter((company) => {
      if (!company.website) return false;
      return company.website.toLowerCase().trim() === normalizedWebsite;
    });

    if (matchingCompanies.length > 0) {
      const companyIds = matchingCompanies.map((c) => c.id);
      
      // Oznacz firmy jako BLOCKED w tabeli Company
      await db.company.updateMany({
        where: { id: { in: companyIds } },
        data: {
          verificationStatus: "BLOCKED",
          verificationReason: `Firma zablokowana (adres www: ${normalizedWebsite})`,
          verifiedAt: new Date(),
          verifiedBy: "SYSTEM",
          verificationSource: "BLOCKED_LIST",
        },
      });

      // Zaktualizuj status w istniejących selekcjach (oznacz jako BLOCKED, nie usuwaj)
      const updatedSelections = await db.companySelectionCompany.updateMany({
        where: { companyId: { in: companyIds } },
        data: {
          status: "BLOCKED",
          reason: `Firma zablokowana (adres www: ${normalizedWebsite})`,
          updatedAt: new Date(),
        },
      });

      // Zaktualizuj liczniki aktywnych firm w selekcjach
      const affectedSelections = await db.companySelectionCompany.findMany({
        where: { companyId: { in: companyIds }, status: "BLOCKED" },
        select: { selectionId: true },
        distinct: ["selectionId"],
      });

      for (const { selectionId } of affectedSelections) {
        const activeCount = await db.companySelectionCompany.count({
          where: {
            selectionId,
            status: { not: "BLOCKED" },
          },
        });

        await db.companySelection.update({
          where: { id: selectionId },
          data: { activeCompanies: activeCount },
        });
      }

      logger.info("company-blocked", `Dodano firmę do listy zablokowanych: ${normalizedWebsite}`, {
        id: blockedCompany.id,
        reason,
        matchedCompanies: matchingCompanies.length,
        updatedSelections: updatedSelections.count,
      });
    } else {
      logger.info("company-blocked", `Dodano firmę do listy zablokowanych: ${normalizedWebsite} (brak pasujących firm w bazie)`, {
        id: blockedCompany.id,
        reason,
      });
    }

    return NextResponse.json({
      success: true,
      blockedCompany,
      matchedCompanies: matchingCompanies.length,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-blocked", "Błąd dodawania firmy do listy zablokowanych", null, errorObj);
    return NextResponse.json(
      { error: "Błąd dodawania firmy do listy zablokowanych", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Usuwa firmę z listy zablokowanych
 * DELETE /api/company-selection/blocked?id=123
 */
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: "ID jest wymagane" },
        { status: 400 }
      );
    }

    // Używamy surowego zapytania SQL, bo Prisma Client może jeszcze nie widzieć pola website
    const blockedCompanyResult = await db.$queryRaw<Array<{
      id: number;
      companyName: string | null;
      website: string | null;
      reason: string | null;
    }>>`
      SELECT id, companyName, website, reason
      FROM BlockedCompany
      WHERE id = ${parseInt(id)}
    `;

    if (!blockedCompanyResult || blockedCompanyResult.length === 0) {
      return NextResponse.json(
        { error: "Firma nie została znaleziona na liście zablokowanych" },
        { status: 404 }
      );
    }

    const blockedCompany = blockedCompanyResult[0];
    const blockedWebsite = blockedCompany.website?.toLowerCase().trim();
    if (!blockedWebsite) {
      return NextResponse.json(
        { error: "Brak adresu www w zablokowanej firmie" },
        { status: 400 }
      );
    }

    // Znajdź wszystkie firmy z tym adresem www (dokładne dopasowanie)
    // SQLite nie obsługuje mode: "insensitive", więc normalizujemy ręcznie
    const allCompanies = await db.company.findMany({
      where: {
        website: { not: null },
        verificationStatus: "BLOCKED",
      },
      select: { id: true, name: true, website: true },
    });

    const matchingCompanies = allCompanies.filter((company) => {
      if (!company.website) return false;
      return company.website.toLowerCase().trim() === blockedWebsite;
    });

    if (matchingCompanies.length > 0) {
      const companyIds = matchingCompanies.map((c) => c.id);

      // Sprawdź, czy są inne blokady dla tych firm (po www)
      const otherBlockedWebsites = await db.$queryRaw<Array<{ website: string }>>`
        SELECT website FROM BlockedCompany 
        WHERE id != ${parseInt(id)} AND website IS NOT NULL AND TRIM(website) != ''
      `;

      const otherBlockedWebsitesLower = otherBlockedWebsites.map((b) =>
        b.website.toLowerCase().trim()
      );

      // Dla każdej firmy sprawdź, czy jest zablokowana przez inny adres www
      const companiesToUnblock: number[] = [];
      for (const company of matchingCompanies) {
        const companyWebsite = company.website?.toLowerCase().trim();
        if (!companyWebsite) continue;
        
        const isBlockedByOther = otherBlockedWebsitesLower.some((blockedWebsite) =>
          companyWebsite === blockedWebsite
        );

        if (!isBlockedByOther) {
          companiesToUnblock.push(company.id);
        }
      }

      if (companiesToUnblock.length > 0) {
        // Cofnij status BLOCKED w Company (ustaw na PENDING)
        await db.company.updateMany({
          where: { id: { in: companiesToUnblock } },
          data: {
            verificationStatus: "PENDING",
            verificationReason: null,
            verifiedAt: null,
            verifiedBy: null,
            verificationSource: null,
          },
        });

        // Cofnij status BLOCKED w CompanySelectionCompany (ustaw na PENDING)
        await db.companySelectionCompany.updateMany({
          where: { companyId: { in: companiesToUnblock } },
          data: {
            status: "PENDING",
            reason: null,
            verifiedAt: null,
            verificationResult: null,
            updatedAt: new Date(),
          },
        });

        // Zaktualizuj liczniki aktywnych firm w selekcjach
        const affectedSelections = await db.companySelectionCompany.findMany({
          where: { companyId: { in: companiesToUnblock } },
          select: { selectionId: true },
          distinct: ["selectionId"],
        });

        for (const { selectionId } of affectedSelections) {
          const activeCount = await db.companySelectionCompany.count({
            where: {
              selectionId,
              status: { not: "BLOCKED" },
            },
          });

          await db.companySelection.update({
            where: { id: selectionId },
            data: { activeCompanies: activeCount },
          });
        }

        logger.info("company-blocked", `Usunięto firmę z listy zablokowanych i odblokowano: ${blockedWebsite}`, {
          id: parseInt(id),
          unblockedCompanies: companiesToUnblock.length,
        });
      } else {
        logger.info("company-blocked", `Usunięto firmę z listy zablokowanych (firmy nadal zablokowane przez inne wpisy): ${blockedWebsite}`, {
          id: parseInt(id),
        });
      }
    }

    // Usuń z listy zablokowanych
    await db.blockedCompany.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({
      success: true,
      unblockedCompanies: matchingCompanies.length,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-blocked", "Błąd usuwania firmy z listy zablokowanych", null, errorObj);
    return NextResponse.json(
      { error: "Błąd usuwania firmy z listy zablokowanych", details: errorObj.message },
      { status: 500 }
    );
  }
}

