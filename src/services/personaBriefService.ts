import { db } from "@/lib/db";

export interface PersonaBriefDto {
  summary: string;
  decisionGuidelines: string[];
  targetProfiles: string[];
  avoidProfiles: string[];
  additionalNotes?: string | null;
  aiRole?: string | null; // Rola/perspektywa AI podczas weryfikacji
  positiveThreshold?: number; // Próg procentowy (0.0-1.0) dla klasyfikacji pozytywnej. Score >= threshold = positive, score < threshold = negative
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_BRIEF: PersonaBriefDto = {
  summary: "",
  decisionGuidelines: [],
  targetProfiles: [],
  avoidProfiles: [],
  additionalNotes: null,
  aiRole: null,
  positiveThreshold: 0.5, // Domyślnie 50%
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export async function getPersonaBrief(companyCriteriaId: number): Promise<PersonaBriefDto> {
  const record = await db.personaBrief.findUnique({ where: { companyCriteriaId } });
  if (!record) {
    return { ...DEFAULT_BRIEF };
  }

  return {
    summary: record.summary ?? "",
    decisionGuidelines: parseJsonArray(record.decisionGuidelines),
    targetProfiles: parseJsonArray(record.targetProfiles),
    avoidProfiles: parseJsonArray(record.avoidProfiles),
    additionalNotes: record.additionalNotes,
    aiRole: record.aiRole ?? null,
    positiveThreshold: typeof (record as any).positiveThreshold === "number" ? (record as any).positiveThreshold : 0.5,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

interface PersonaBriefPayload {
  summary?: string;
  decisionGuidelines?: string[];
  targetProfiles?: string[];
  avoidProfiles?: string[];
  additionalNotes?: string | null;
  aiRole?: string | null;
  positiveThreshold?: number;
}

function safeStringifyArray(value?: string[]): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}

export async function upsertPersonaBrief(companyCriteriaId: number, payload: PersonaBriefPayload) {
  const aiRoleValue = payload.aiRole ? payload.aiRole.trim() : null;
  const aiRoleFinal = aiRoleValue && aiRoleValue.length > 0 ? aiRoleValue : null;
  const positiveThreshold = typeof payload.positiveThreshold === "number" 
    ? Math.max(0, Math.min(1, payload.positiveThreshold)) // Ogranicz do zakresu 0.0-1.0
    : 0.5; // Domyślnie 50%
  
  await db.personaBrief.upsert({
    where: { companyCriteriaId },
    create: {
      companyCriteriaId,
      summary: payload.summary ?? "",
      decisionGuidelines: safeStringifyArray(payload.decisionGuidelines),
      targetProfiles: safeStringifyArray(payload.targetProfiles),
      avoidProfiles: safeStringifyArray(payload.avoidProfiles),
      additionalNotes: payload.additionalNotes ?? null,
      aiRole: aiRoleFinal,
      positiveThreshold: positiveThreshold,
    } as any,
    update: {
      summary: payload.summary ?? "",
      decisionGuidelines: safeStringifyArray(payload.decisionGuidelines),
      targetProfiles: safeStringifyArray(payload.targetProfiles),
      avoidProfiles: safeStringifyArray(payload.avoidProfiles),
      additionalNotes: payload.additionalNotes ?? null,
      aiRole: aiRoleFinal,
      positiveThreshold: positiveThreshold,
    } as any,
  });
}
