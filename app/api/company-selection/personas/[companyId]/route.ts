import { NextRequest, NextResponse } from "next/server";
import { getPersonaVerification, deletePersonaVerification } from "@/services/personaVerificationService";

function parseCompanyId(raw: string | string[] | undefined): number | null {
  if (!raw || Array.isArray(raw)) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function GET(_: NextRequest, { params }: { params: { companyId: string } }) {
  const companyId = parseCompanyId(params.companyId);
  if (companyId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID firmy" }, { status: 400 });
  }

  const result = await getPersonaVerification(companyId);
  if (!result) {
    return NextResponse.json({ success: false, error: "Brak zapisanej weryfikacji" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      companyId,
      personaCriteriaId: result.personaCriteriaId,
      positiveCount: result.positiveCount,
      negativeCount: result.negativeCount,
      unknownCount: result.unknownCount,
      verifiedAt: result.verifiedAt,
      employees: JSON.parse(result.employees),
      metadata: result.metadata ? JSON.parse(result.metadata) : null,
    },
  });
}

export async function DELETE(_: NextRequest, { params }: { params: { companyId: string } }) {
  const companyId = parseCompanyId(params.companyId);
  if (companyId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID firmy" }, { status: 400 });
  }

  await deletePersonaVerification(companyId);
  return NextResponse.json({ success: true });
}

