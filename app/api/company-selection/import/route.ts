import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import { ensureCompanyClassification } from "@/services/companySegmentation";

const ALLOWED_MARKETS = ["PL", "DE", "FR", "EN"] as const;
type MarketCode = (typeof ALLOWED_MARKETS)[number];

function normalizeMarket(value: unknown): MarketCode | null {
  if (!value) {
    return null;
  }
  const normalized = String(value).toUpperCase().trim();
  return (ALLOWED_MARKETS as readonly string[]).includes(normalized) ? (normalized as MarketCode) : null;
}

/**
 * Import firm z CSV
 * POST /api/company-selection/import
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companies,
      batchId: incomingBatchId,
      batchName,
      batchLanguage,
      totalRows,
      batchMarket: incomingBatchMarket,
    }: {
      companies: any[];
      batchId?: number;
      batchName?: string;
      batchLanguage?: "PL" | "EN" | "DE" | "FR";
      totalRows?: number;
      batchMarket?: "PL" | "DE" | "FR" | "EN";
    } = body;

    let batchMarket = incomingBatchMarket ?? null;

    console.log(`[Company Import] Otrzymano request, typ danych:`, typeof companies);
    console.log(`[Company Import] Liczba firm:`, Array.isArray(companies) ? companies.length : 'NIE JEST TABLICĄ');

    if (!Array.isArray(companies) || companies.length === 0) {
      return NextResponse.json(
        { error: "Lista firm jest wymagana", receivedType: typeof companies, receivedLength: Array.isArray(companies) ? companies.length : 'not array' },
        { status: 400 }
      );
    }

    let batchId = incomingBatchId ?? null;

    if (batchId === null) {
      if (!batchName || !batchLanguage || typeof totalRows !== "number" || !batchMarket) {
        return NextResponse.json(
          { error: "Brakuje danych partii importu (batchName, batchLanguage, batchMarket, totalRows)" },
          { status: 400 }
        );
      }

      const createdBatch = await db.companyImportBatch.create({
        data: {
          name: batchName,
          language: batchLanguage,
          market: batchMarket,
          totalRows,
        },
      });
      batchId = createdBatch.id;
      logger.info(
        "company-import",
        `Utworzono nową partię importu "${createdBatch.name}" (ID: ${createdBatch.id}, język: ${createdBatch.language}, rynek: ${createdBatch.market}, rekordy: ${createdBatch.totalRows})`
      );
    } else {
      const existingBatch = await db.companyImportBatch.findUnique({ where: { id: batchId } });
      if (!existingBatch) {
        return NextResponse.json(
          { error: `Partia importu o ID ${batchId} nie istnieje` },
          { status: 404 }
        );
      }
      if (!batchMarket) {
        batchMarket = normalizeMarket(existingBatch.market) ?? null;
      }
      if (!batchMarket) {
        return NextResponse.json(
          { error: "Nie udało się określić rynku dla istniejącej partii importu" },
          { status: 400 }
        );
      }
    }

    logger.info("company-import", `Rozpoczynam import ${companies.length} firm (batchId: ${batchId})`);

    // Sprawdź czy db.company jest dostępne
    if (!db.company) {
      logger.error("company-import", "db.company jest undefined!", null, new Error("Model Company nie jest dostępny"));
      return NextResponse.json(
        { error: "Błąd bazy danych: model Company nie jest dostępny. Zrestartuj serwer." },
        { status: 500 }
      );
    }

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const errors: Array<{ row: number; error: string; data: any }> = [];

    for (let i = 0; i < companies.length; i++) {
      const companyData = companies[i];
      try {
        // Debug: loguj pierwszy wiersz, żeby zobaczyć strukturę danych
        if (i === 0) {
          logger.debug("company-import", "Analiza pierwszego wiersza CSV", {
            availableKeys: Object.keys(companyData),
            sampleData: companyData,
            nameMapping: {
              "Nazwa": companyData["Nazwa"],
              "Company Name": companyData["Company Name"],
              "Company Name for Emails": companyData["Company Name for Emails"],
              "name": companyData.name,
              "final": companyData["Nazwa"] || companyData["Company Name"] || companyData["Company Name for Emails"] || companyData.name || "",
            },
          });
        }

        // Funkcja pomocnicza do parsowania dat
        const parseDate = (dateStr: string | null | undefined): Date | null => {
          if (!dateStr) return null;
          try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
          } catch {
            return null;
          }
        };

        // Funkcja pomocnicza do parsowania liczb
        const parseIntSafe = (value: string | number | null | undefined): number | null => {
          if (value === null || value === undefined) return null;
          const parsed = typeof value === 'string' ? parseInt(value, 10) : value;
          return isNaN(parsed) ? null : parsed;
        };

        // Mapowanie kolumn CSV do pól bazy danych
        // Obsługujemy zarówno polskie jak i angielskie nazwy kolumn
        const inferredMarket =
          companyData["Rynek"] ||
          companyData["Market"] ||
          companyData["market"] ||
          batchMarket;

        const company = {
          name: companyData["Nazwa"] || companyData["Company Name"] || companyData["Company Name for Emails"] || companyData.name || companyData["name"] || "",
          industry: companyData["Branża"] || companyData["Industry"] || companyData.industry || companyData["industry"] || null,
          market: normalizeMarket(inferredMarket),
          country: companyData["Kraj"] || companyData["Company Country"] || companyData.country || companyData["country"] || null,
          city: companyData["Miasto"] || companyData["Company City"] || companyData.city || companyData["city"] || null,
          postalCode: companyData["Kod pocztowy"] || companyData["Company Postal Code"] || companyData.postalCode || companyData["postalCode"] || null,
          street: companyData["Ulica"] || companyData["Company Street"] || companyData.street || companyData["street"] || null,
          buildingNumber: companyData["Numer budynku"] || companyData.buildingNumber || companyData["buildingNumber"] || null,
          website: companyData["Strona www"] || companyData["Website"] || companyData.website || companyData["website"] || null,
          description: companyData["Opis"] || companyData["Short Description"] || companyData.description || companyData["description"] || null,
          activityDescription: companyData["Opis działalności"] || companyData["Short Description"] || companyData.activityDescription || companyData["activityDescription"] || null,
          nip: companyData["NIP"] || companyData.nip || companyData["nip"] || null,
          regon: companyData["REGON"] || companyData.regon || companyData["regon"] || null,
          krs: companyData["KRS"] || companyData.krs || companyData["krs"] || null,
          legalForm: companyData["Forma prawna"] || companyData.legalForm || companyData["legalForm"] || null,
          establishmentDate: parseDate(companyData["Data założenia"] || companyData["Founded Year"] || companyData.establishmentDate || companyData["establishmentDate"]),
          companySize: companyData["Wielkość firmy"] || companyData.companySize || companyData["companySize"] || null,
          employeeCount: companyData["Liczba pracowników"] || companyData["# Employees"] || companyData.employeeCount || companyData["employeeCount"] || null,
          revenue: companyData["Przychody"] || companyData["Annual Revenue"] || companyData.revenue || companyData["revenue"] || null,
          netProfit: companyData["Zysk netto"] || companyData.netProfit || companyData["netProfit"] || null,
          locationCount: parseIntSafe(companyData["Liczba lokalizacji"] || companyData["Number of Retail Locations"] || companyData.locationCount || companyData["locationCount"]),
          ratingPoints: parseIntSafe(companyData["Punkty oceny"] || companyData.ratingPoints || companyData["ratingPoints"]),
          keywords: companyData["Keywords"] || companyData.keywords || companyData["keywords"] || null,
          apolloAccountId: companyData["Apollo Account Id"] || companyData["Apollo\nAccount Id"] || companyData.apolloAccountId || companyData["apolloAccountId"] || null,
          sicCode: companyData["Kod SIC"] || companyData["SIC Codes"] || companyData.sicCode || companyData["sicCode"] || null,
          naceCode: companyData["Kod NACE"] || companyData["NAICS Codes"] || companyData.naceCode || companyData["naceCode"] || null,
          // Dane z weryfikacji CSV (jeśli były)
          csvVerificationStatus: companyData["Status weryfikacji"] || companyData.csvVerificationStatus || companyData["csvVerificationStatus"] || null,
          verificationComment: companyData["Komentarz weryfikacji"] || companyData.verificationComment || companyData["verificationComment"] || null,
          csvVerificationDate: parseDate(companyData["Data weryfikacji"] || companyData.csvVerificationDate || companyData["csvVerificationDate"]),
          csvModificationDate: parseDate(companyData["Data ostatniej modyfikacji"] || companyData.csvModificationDate || companyData["csvModificationDate"]),
          csvModifiedBy: companyData["Użytkownik modyfikujący"] || companyData.csvModifiedBy || companyData["csvModifiedBy"] || null,
        };

        // Normalizuj podstawowe pola tekstowe
        company.name = company.name?.toString().trim();
        company.website = company.website?.toString().trim() || null;

        // Jeśli brak nazwy, pomiń
        if (!company.name || company.name.trim() === "") {
          logger.warn("company-import", `Pominięto firmę bez nazwy (wiersz ${i + 1})`, {
            availableKeys: Object.keys(companyData),
            sampleData: Object.entries(companyData).slice(0, 5),
          });
          skippedCount++;
          continue;
        }

        // Jeśli brak strony www, pomiń
        if (!company.website) {
          if (skippedCount < 5) {
            logger.warn("company-import", `Pominięto firmę bez strony www: "${company.name}" (wiersz ${i + 1})`);
          }
          skippedCount++;
          continue;
        }

        // Sprawdź czy firma już istnieje (po nazwie)
        const existing = await db.company.findFirst({
          where: {
            name: company.name,
          },
        });

        // Określ status weryfikacji
        // UWAGA: Nie sprawdzamy listy zablokowanych podczas importu CSV - zostanie to zrobione podczas weryfikacji
        // To zapewnia, że:
        // 1. Import CSV jest szybki i prosty
        // 2. Zawsze sprawdzamy aktualną listę zablokowanych podczas weryfikacji
        // 3. Jeśli lista zablokowanych się zmieni, istniejące firmy PENDING zostaną sprawdzone podczas weryfikacji
        let verificationStatus = "PENDING";
        if (company.verificationComment) {
          const comment = company.verificationComment.toLowerCase();
          if (comment.includes("nie wykonuje")) {
            verificationStatus = "REJECTED";
          } else if (comment.includes("wykonuje")) {
            verificationStatus = "QUALIFIED";
          }
        }

        if (existing) {
          skippedCount++;
          if (skippedCount <= 3) {
            logger.debug("company-import", `Pominięto duplikat firmy: "${existing.name}" (ID: ${existing.id}) w batchId ${batchId}`);
          }
        } else {
          // Utwórz nową firmę
          logger.debug("company-import", `Próbuję utworzyć firmę: "${company.name}"`);
          const created = await db.company.create({
            data: {
              ...company,
              verificationStatus,
              importBatchId: batchId,
            },
          });
          await ensureCompanyClassification(created);
          importedCount++;
          logger.info("company-import", `Utworzono firmę: ${created.name} (ID: ${created.id})`);
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error("company-import", `Błąd importu firmy (wiersz ${i + 1})`, companyData, errorObj);
        errors.push({
          row: i + 1,
          error: errorObj.message,
          data: companyData,
        });
        skippedCount++;
      }
    }

    await db.companyImportBatch.update({
      where: { id: batchId },
      data: {
        processedRows: { increment: companies.length },
        importedCount: { increment: importedCount },
        updatedCount: { increment: updatedCount },
        skippedCount: { increment: skippedCount },
        errorCount: { increment: errors.length },
        updatedAt: new Date(),
      },
    });

    // Sprawdź ile firm jest teraz w bazie
    const totalInDb = await db.company.count();
    logger.info(
      "company-import",
      `Zakończono import (batchId: ${batchId}): ${importedCount} zaimportowanych, ${updatedCount} zaktualizowanych, ${skippedCount} pominiętych, łącznie w bazie: ${totalInDb}`
    );

    return NextResponse.json({
      success: true,
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: companies.length,
      totalInDb: totalInDb,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Pokaż pierwsze 10 błędów
      errorCount: errors.length,
      batchId,
    });
  } catch (error) {
    console.error("[Company Import] Błąd:", error);
    return NextResponse.json(
      { error: "Błąd importu firm", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

