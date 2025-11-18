import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Pobiera weryfikacje person dla wielu firm
 * GET /api/company-selection/personas/batch?companyIds=1,2,3
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const companyIdsParam = searchParams.get("companyIds");

    if (!companyIdsParam) {
      return NextResponse.json({ success: false, error: "companyIds jest wymagane" }, { status: 400 });
    }

    const companyIds = companyIdsParam
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (companyIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const verifications = await db.personaVerificationResult.findMany({
      where: {
        companyId: { in: companyIds },
      },
      select: {
        companyId: true,
        personaCriteriaId: true,
        positiveCount: true,
        negativeCount: true,
        unknownCount: true,
        verifiedAt: true,
        metadata: true,
      },
    });

    // Utwórz mapę companyId -> verification
    const verificationMap = new Map(
      verifications.map((v) => [
        v.companyId,
        {
          personaCriteriaId: v.personaCriteriaId,
          positiveCount: v.positiveCount,
          negativeCount: v.negativeCount,
          unknownCount: v.unknownCount,
          totalCount: v.positiveCount + v.negativeCount + v.unknownCount,
          verifiedAt: v.verifiedAt,
          metadata: v.metadata ? JSON.parse(v.metadata) : null,
        },
      ])
    );

    return NextResponse.json({
      success: true,
      data: Object.fromEntries(verificationMap),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: "Błąd pobierania weryfikacji person", details: err.message },
      { status: 500 }
    );
  }
}

