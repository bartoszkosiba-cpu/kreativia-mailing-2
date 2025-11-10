import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

export async function POST(_req: NextRequest) {
  try {
    await db.$transaction([
      db.company.deleteMany({}),
      db.companyImportBatch.deleteMany({}),
    ]);

    logger.warn("company-clear", "Baza firm wyczyszczona na żądanie użytkownika");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("company-clear", "Błąd czyszczenia bazy firm", null, error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: "Błąd czyszczenia bazy firm" },
      { status: 500 }
    );
  }
}

