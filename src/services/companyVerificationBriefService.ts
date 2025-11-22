import { db } from "@/lib/db";

export interface CompanyVerificationBriefDto {
  id: number;
  criteriaId: number;
  summary: string;
  decisionGuidelines: string[];
  targetCompanies: string[];
  avoidCompanies: string[];
  additionalNotes?: string | null;
  aiRole?: string | null;
  qualifiedThreshold: number;
  generatedPrompt?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export async function getCompanyVerificationBrief(criteriaId: number): Promise<CompanyVerificationBriefDto | null> {
  const record = await db.companyVerificationBrief.findUnique({ where: { criteriaId } });
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    criteriaId: record.criteriaId,
    summary: record.summary ?? "",
    decisionGuidelines: parseJsonArray(record.decisionGuidelines),
    targetCompanies: parseJsonArray(record.targetCompanies),
    avoidCompanies: parseJsonArray(record.avoidCompanies),
    additionalNotes: record.additionalNotes,
    aiRole: record.aiRole ?? null,
    qualifiedThreshold: record.qualifiedThreshold ?? 0.8,
    generatedPrompt: record.generatedPrompt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export interface CompanyVerificationBriefPayload {
  summary?: string;
  decisionGuidelines?: string[];
  targetCompanies?: string[];
  avoidCompanies?: string[];
  additionalNotes?: string | null;
  aiRole?: string | null;
  qualifiedThreshold?: number;
}

function safeStringifyArray(value?: string[]): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}

export async function upsertCompanyVerificationBrief(
  criteriaId: number,
  payload: CompanyVerificationBriefPayload
): Promise<void> {
  const aiRoleValue = payload.aiRole ? payload.aiRole.trim() : null;
  const aiRoleFinal = aiRoleValue && aiRoleValue.length > 0 ? aiRoleValue : null;
  const qualifiedThreshold =
    typeof payload.qualifiedThreshold === "number"
      ? Math.max(0, Math.min(1, payload.qualifiedThreshold)) // Ogranicz do zakresu 0.0-1.0
      : 0.8; // Domyślnie 0.8

  await db.companyVerificationBrief.upsert({
    where: { criteriaId },
    create: {
      criteriaId,
      summary: payload.summary ?? "",
      decisionGuidelines: safeStringifyArray(payload.decisionGuidelines),
      targetCompanies: safeStringifyArray(payload.targetCompanies),
      avoidCompanies: safeStringifyArray(payload.avoidCompanies),
      additionalNotes: payload.additionalNotes ?? null,
      aiRole: aiRoleFinal,
      qualifiedThreshold: qualifiedThreshold,
      generatedPrompt: null, // Zostanie wygenerowany później w prompt/route.ts
    },
    update: {
      summary: payload.summary ?? "",
      decisionGuidelines: safeStringifyArray(payload.decisionGuidelines),
      targetCompanies: safeStringifyArray(payload.targetCompanies),
      avoidCompanies: safeStringifyArray(payload.avoidCompanies),
      additionalNotes: payload.additionalNotes ?? null,
      aiRole: aiRoleFinal,
      qualifiedThreshold: qualifiedThreshold,
      // generatedPrompt nie jest aktualizowany tutaj - jest generowany w prompt/route.ts
    },
  });
}

