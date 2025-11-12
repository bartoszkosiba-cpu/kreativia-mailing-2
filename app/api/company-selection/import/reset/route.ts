import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

export async function POST() {
  try {
    const totalBefore = await db.company.count();

    await db.$transaction(async (tx) => {
      await tx.companySelectionCompany.deleteMany();
      await tx.companyTagScore.deleteMany();
      await tx.personaVerificationResult.deleteMany();
      await tx.companyVerificationLog.deleteMany();
      await tx.company.deleteMany();
      await tx.companyImportBatch.deleteMany();
      await tx.companySelection.updateMany({
        data: {
          totalCompanies: 0,
          activeCompanies: 0,
        },
      });
    });

    logger.warn(
      "company-import-reset",
      "Wyczyszczono bazę firm",
      { removedCompanies: totalBefore }
    );

    return NextResponse.json({ success: true, removedCompanies: totalBefore });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("company-import-reset", "Błąd czyszczenia bazy firm", null, error instanceof Error ? error : new Error(message));
    return NextResponse.json({ success: false, error: "Nie udało się wyczyścić bazy firm", details: message }, { status: 500 });
  }
}
