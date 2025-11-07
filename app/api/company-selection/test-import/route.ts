import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Test endpoint - symuluje import z przykładowymi danymi
 * GET /api/company-selection/test-import
 */
export async function GET(req: NextRequest) {
  try {
    console.log("[Test Import] Rozpoczynam test importu...");

    // Sprawdź czy db.company jest dostępne
    if (!db.company) {
      return NextResponse.json(
        {
          success: false,
          error: "db.company is undefined",
          availableModels: Object.keys(db).filter(k => !k.startsWith('_') && !k.startsWith('$')),
        },
        { status: 500 }
      );
    }

    // Przykładowe dane firmy (jak z CSV)
    const testCompanies = [
      {
        "Nazwa": "Test Firma 1",
        "Branża": "Targi",
        "Kraj": "Polska",
        "Miasto": "Warszawa",
        "Strona www": "https://example.com",
        "Opis": "Firma testowa do weryfikacji",
        "Opis działalności": "Organizacja targów",
      },
      {
        "Nazwa": "Test Firma 2",
        "Branża": "Produkcja",
        "Kraj": "Polska",
        "Miasto": "Kraków",
      },
    ];

    let importedCount = 0;
    let errors: any[] = [];

    for (let i = 0; i < testCompanies.length; i++) {
      const companyData = testCompanies[i];
      try {
        console.log(`[Test Import] Przetwarzam firmę ${i + 1}:`, companyData);

        const company = {
          name: companyData["Nazwa"] || "",
          industry: companyData["Branża"] || null,
          country: companyData["Kraj"] || null,
          city: companyData["Miasto"] || null,
          website: companyData["Strona www"] || null,
          description: companyData["Opis"] || null,
          activityDescription: companyData["Opis działalności"] || null,
          verificationStatus: "PENDING" as const,
        };

        if (!company.name || company.name.trim() === "") {
          console.log(`[Test Import] Pominięto firmę bez nazwy`);
          continue;
        }

        const created = await db.company.create({
          data: company,
        });

        console.log(`[Test Import] ✅ Utworzono firmę: ${created.name} (ID: ${created.id})`);
        importedCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Test Import] ❌ Błąd dla firmy ${i + 1}:`, errorMsg);
        errors.push({
          row: i + 1,
          error: errorMsg,
          data: companyData,
        });
      }
    }

    const totalInDb = await db.company.count();

    return NextResponse.json({
      success: true,
      imported: importedCount,
      errors: errors.length > 0 ? errors : undefined,
      errorCount: errors.length,
      totalInDb: totalInDb,
      message: `Test zakończony: ${importedCount} firm zaimportowanych, ${errors.length} błędów`,
    });
  } catch (error) {
    console.error("[Test Import] Błąd:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}

