import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; companyId: string } }
) {
  try {
    const selectionId = Number(params.id);
    const companyId = Number(params.companyId);

    if (!Number.isFinite(selectionId) || !Number.isFinite(companyId)) {
      return NextResponse.json(
        { success: false, error: "Niepoprawne parametry" },
        { status: 400 }
      );
    }

    const selectionCompany = await db.companySelectionCompany.findUnique({
      where: {
        selectionId_companyId: {
          selectionId,
          companyId,
        },
      },
    });

    if (!selectionCompany) {
      return NextResponse.json(
        { success: false, error: "Powiązanie firmy z selekcją nie istnieje" },
        { status: 404 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.companySelectionCompany.delete({
        where: {
          selectionId_companyId: {
            selectionId,
            companyId,
          },
        },
      });

      await tx.companySelection.update({
        where: { id: selectionId },
        data: {
          totalCompanies: { decrement: 1 },
          activeCompanies: { decrement: 1 },
        },
      });
    });

    logger.info(
      "company-selection",
      `Usunięto firmę ${companyId} z selekcji ${selectionId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(
      "company-selection",
      "Błąd usuwania firmy z selekcji",
      { selectionId: params.id, companyId: params.companyId },
      err
    );
    return NextResponse.json(
      {
        success: false,
        error: "Nie udało się usunąć firmy z selekcji",
        details: err.message,
      },
      { status: 500 }
    );
  }
}


