import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * Czyści wyniki weryfikacji person (Apollo + AI) dla wszystkich firm w selekcji
 * DELETE /api/company-selection/personas/clear?selectionId=14
 */
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const selectionId = searchParams.get("selectionId");

    if (!selectionId) {
      return NextResponse.json(
        { success: false, error: "Brak selectionId" },
        { status: 400 }
      );
    }

    const selectionIdNum = parseInt(selectionId, 10);
    if (Number.isNaN(selectionIdNum)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe selectionId" },
        { status: 400 }
      );
    }

    // Sprawdź, czy selekcja istnieje
    const selection = await db.companySelection.findUnique({
      where: { id: selectionIdNum },
      select: { id: true, name: true },
    });

    if (!selection) {
      return NextResponse.json(
        { success: false, error: "Selekcja nie istnieje" },
        { status: 404 }
      );
    }

    // Pobierz wszystkie ID firm z tej selekcji
    const selectionCompanies = await db.companySelectionCompany.findMany({
      where: { selectionId: selectionIdNum },
      select: { companyId: true },
    });

    const companyIds = selectionCompanies.map((sc) => sc.companyId);

    if (companyIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Brak firm w selekcji do wyczyszczenia",
        deletedCount: 0,
      });
    }

    // Usuń wszystkie wyniki weryfikacji person dla tych firm
    const deleteResult = await db.personaVerificationResult.deleteMany({
      where: {
        companyId: { in: companyIds },
      },
    });

    logger.info(
      "persona-clear",
      `Wyczyszczono wyniki weryfikacji person dla selekcji "${selection.name}" (ID: ${selectionIdNum})`,
      {
        selectionId: selectionIdNum,
        companyCount: companyIds.length,
        deletedCount: deleteResult.count,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Wyczyszczono wyniki weryfikacji person dla ${deleteResult.count} rekordów w ${companyIds.length} firmach`,
      deletedCount: deleteResult.count,
      companyCount: companyIds.length,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-clear", "Błąd czyszczenia wyników weryfikacji person", null, err);
    return NextResponse.json(
      { success: false, error: "Błąd czyszczenia wyników weryfikacji person", details: err.message },
      { status: 500 }
    );
  }
}


