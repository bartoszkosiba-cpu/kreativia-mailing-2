import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Test endpoint - próba zapisania testowej firmy
 * GET /api/company-selection/test
 */
export async function GET(req: NextRequest) {
  try {
    // Sprawdź czy db.company jest dostępne
    console.log("[Test] db object:", typeof db);
    console.log("[Test] db.company:", typeof db.company);
    console.log("[Test] Available models:", Object.keys(db).filter(k => !k.startsWith('_') && !k.startsWith('$')));

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

    // Próba utworzenia testowej firmy
    const testCompany = await db.company.create({
      data: {
        name: "Test Company " + Date.now(),
        industry: "Test",
        country: "Polska",
        city: "Warszawa",
        verificationStatus: "PENDING",
      },
    });

    // Sprawdź ile firm jest w bazie
    const count = await db.company.count();

    return NextResponse.json({
      success: true,
      testCompany,
      totalCompanies: count,
      message: "Testowa firma została utworzona",
    });
  } catch (error) {
    console.error("[Test] Błąd:", error);
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

