import { NextRequest, NextResponse } from "next/server";
import { listPersonaVerifications } from "@/services/personaVerificationService";
import { db } from "@/lib/db";

export async function GET(_: NextRequest) {
  const results = await listPersonaVerifications();
  const companyIds = results.map((item) => item.companyId);

  const companies = companyIds.length
    ? await db.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      })
    : [];

  const companyMap = new Map(companies.map((item) => [item.id, item.name]));

  return NextResponse.json({
    success: true,
    data: results.map((item) => ({
      companyId: item.companyId,
      companyName: companyMap.get(item.companyId) ?? null,
      personaCriteriaId: item.personaCriteriaId,
      positiveCount: item.positiveCount,
      negativeCount: item.negativeCount,
      unknownCount: item.unknownCount,
      verifiedAt: item.verifiedAt,
    })),
  });
}

