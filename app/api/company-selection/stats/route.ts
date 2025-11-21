import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * Endpoint zwracający statystyki firm w jednym zapytaniu
 * GET /api/company-selection/stats
 */
export async function GET() {
  try {
    const [pending, qualified, rejected, needsReview, total] = await Promise.all([
      db.company.count({ where: { verificationStatus: "PENDING" } }),
      db.company.count({ where: { verificationStatus: "QUALIFIED" } }),
      db.company.count({ where: { verificationStatus: "REJECTED" } }),
      db.company.count({ where: { verificationStatus: "NEEDS_REVIEW" } }),
      db.company.count(),
    ]);

    return NextResponse.json({
      success: true,
      pending,
      qualified,
      rejected,
      needsReview,
      total,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("company-selection", "Błąd pobierania statystyk firm", null, err);
    return NextResponse.json(
      { success: false, error: "Nie udało się pobrać statystyk", details: err.message },
      { status: 500 }
    );
  }
}

