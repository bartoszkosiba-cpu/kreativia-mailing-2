import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/services/logger";
import { db } from "@/lib/db";
import { getCompanyVerificationBrief } from "@/services/companyVerificationBriefService";

function parseCriteriaId(rawId: string | string[] | undefined): number | null {
  if (!rawId) return null;
  const str = Array.isArray(rawId) ? rawId[0] : rawId;
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const criteriaId = parseCriteriaId(params.id);

  if (criteriaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID kryteriów" }, { status: 400 });
  }

  try {
    const criteria = await db.companyVerificationCriteria.findUnique({
      where: { id: criteriaId },
    });

    if (!criteria) {
      return NextResponse.json({ success: false, error: "Nie znaleziono kryteriów" }, { status: 404 });
    }

    const brief = await getCompanyVerificationBrief(criteriaId);

    // Jeśli brief nie istnieje, zwróć null (nie pusty obiekt)
    return NextResponse.json({
      success: true,
      data: brief,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("criteria-brief", "Błąd pobierania briefu", { criteriaId }, err);
    return NextResponse.json({ success: false, error: "Błąd pobierania briefu" }, { status: 500 });
  }
}

