import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SPECIALIZATION_BY_CODE } from "@/config/companySpecializations";

export async function GET() {
  try {
    const rows = await db.industryMappingSuggestion.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    });

    const suggestions = rows.map((row) => {
      const spec = SPECIALIZATION_BY_CODE.get(row.specializationCode as typeof SPECIALIZATION_BY_CODE extends Map<infer K, any> ? K : never);
      return {
        id: row.id,
        industry: row.industry,
        specializationCode: row.specializationCode,
        specializationLabel: spec?.label ?? row.specializationCode,
        companyClass: spec?.companyClass ?? "?",
        score: row.score,
        explanation: row.explanation,
        status: row.status,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Nie udało się pobrać propozycji",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
