import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COMPANY_SPECIALIZATIONS, SPECIALIZATION_BY_CODE } from "@/config/companySpecializations";

export async function GET() {
  try {
    const rows = await db.industrySpecializationRule.findMany({
      where: {
        status: "ACTIVE",
      },
      orderBy: [{ industry: "asc" }, { score: "desc" }],
    });

    const rules = rows.map((row) => {
      const spec = SPECIALIZATION_BY_CODE.get(row.specializationCode as typeof COMPANY_SPECIALIZATIONS[number]["code"]);
      return {
        industry: row.industry,
        specializationCode: row.specializationCode,
        specializationLabel: spec?.label ?? row.specializationCode,
        companyClass: spec?.companyClass ?? "?",
        score: Number(row.score ?? 0),
        source: row.source,
        updatedAt: row.updatedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ rules });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Nie udało się pobrać reguł",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
