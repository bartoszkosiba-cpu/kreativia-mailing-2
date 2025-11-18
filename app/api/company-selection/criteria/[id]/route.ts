import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * Usuń kryteria weryfikacji
 * DELETE /api/company-selection/criteria/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { success: false, error: "Niepoprawne ID kryteriów" },
        { status: 400 }
      );
    }

    const criteria = await db.companyVerificationCriteria.findUnique({
      where: { id },
      include: {
        selection: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!criteria) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono kryteriów" },
        { status: 404 }
      );
    }

    // Sprawdź czy kryterium jest używane w aktywnej selekcji
    if (criteria.selectionId != null && criteria.selection != null) {
      return NextResponse.json(
        {
          success: false,
          error: `Nie można usunąć kryteriów, ponieważ są używane w selekcji "${criteria.selection.name}". Najpierw usuń selekcję lub odepnij kryteria od selekcji.`,
          isUsed: true,
          selectionName: criteria.selection.name,
        },
        { status: 400 }
      );
    }

    // Usuń kryterium (jeśli ma powiązane personaCriteria, zostanie usunięte przez CASCADE)
    await db.companyVerificationCriteria.delete({
      where: { id },
    });

    logger.info("company-criteria", `Usunięto kryteria: "${criteria.name}" (ID: ${id})`);

    return NextResponse.json({
      success: true,
      message: "Kryteria zostały usunięte pomyślnie",
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-criteria", "Błąd usuwania kryteriów", null, errorObj);
    return NextResponse.json(
      {
        success: false,
        error: "Nie udało się usunąć kryteriów",
        details: errorObj.message,
      },
      { status: 500 }
    );
  }
}

