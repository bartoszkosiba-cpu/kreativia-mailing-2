import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * Pobiera listę zablokowanych firm
 * GET /api/company-selection/blocked
 */
export async function GET(req: NextRequest) {
  try {
    const blockedCompanies = await db.blockedCompany.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      blockedCompanies,
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
    const { companyName, reason } = await req.json();

    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      return NextResponse.json(
        { error: "Nazwa firmy jest wymagana" },
        { status: 400 }
      );
    }

    // Sprawdź czy już istnieje
    const existing = await db.blockedCompany.findUnique({
      where: { companyName: companyName.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Firma już jest na liście zablokowanych" },
        { status: 400 }
      );
    }

    // Dodaj do listy zablokowanych
    const blockedCompany = await db.blockedCompany.create({
      data: {
        companyName: companyName.trim(),
        reason: reason || null,
        createdBy: "USER",
      },
    });

    // SCENARIUSZ B: Automatycznie oznacz pasujące firmy jako BLOCKED i zaktualizuj istniejące selekcje
    const blockedNameTrimmed = companyName.trim();
    const blockedNameLower = blockedNameTrimmed.toLowerCase();
    
    // Pobierz wszystkie firmy (musimy sprawdzić każdą, bo SQLite nie obsługuje case-insensitive contains dobrze)
    // W praktyce możemy ograniczyć się do firm które zawierają fragment, ale dla pewności sprawdzamy wszystkie
    // Dla wydajności - pobieramy tylko ID i nazwę
    const allCompanies = await db.company.findMany({
      select: { id: true, name: true },
      // Opcjonalnie: można ograniczyć do firm które już nie są BLOCKED
      where: { verificationStatus: { not: "BLOCKED" } },
    });

    // Filtruj dokładnie (case-insensitive, częściowe dopasowanie w obie strony)
    // Używamy tej samej logiki co checkIfBlocked
    const exactMatches = allCompanies.filter((company) => {
      const companyNameLower = company.name.toLowerCase().trim();
      return (
        companyNameLower.includes(blockedNameLower) ||
        blockedNameLower.includes(companyNameLower)
      );
    });

    if (exactMatches.length > 0) {
      const companyIds = exactMatches.map((c) => c.id);
      
      // Oznacz firmy jako BLOCKED w tabeli Company
      await db.company.updateMany({
        where: { id: { in: companyIds } },
        data: {
          verificationStatus: "BLOCKED",
          verificationReason: `Firma zablokowana (dopasowanie: ${companyName.trim()})`,
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
          reason: `Firma zablokowana: ${companyName.trim()}`,
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

      logger.info("company-blocked", `Dodano firmę do listy zablokowanych: ${companyName}`, {
        id: blockedCompany.id,
        reason,
        matchedCompanies: exactMatches.length,
        updatedSelections: updatedSelections.count,
      });
    } else {
      logger.info("company-blocked", `Dodano firmę do listy zablokowanych: ${companyName} (brak pasujących firm w bazie)`, {
        id: blockedCompany.id,
        reason,
      });
    }

    return NextResponse.json({
      success: true,
      blockedCompany,
      matchedCompanies: exactMatches.length,
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

    const blockedCompany = await db.blockedCompany.findUnique({
      where: { id: parseInt(id) },
    });

    if (!blockedCompany) {
      return NextResponse.json(
        { error: "Firma nie została znaleziona na liście zablokowanych" },
        { status: 404 }
      );
    }

    await db.blockedCompany.delete({
      where: { id: parseInt(id) },
    });

    logger.info("company-blocked", `Usunięto firmę z listy zablokowanych: ${blockedCompany.companyName}`, {
      id: parseInt(id),
    });

    return NextResponse.json({
      success: true,
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

