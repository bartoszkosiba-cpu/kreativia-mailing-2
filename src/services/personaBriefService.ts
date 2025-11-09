import { db } from "@/lib/db";

export interface PersonaBriefDto {
  summary: string;
  decisionGuidelines: string[];
  targetProfiles: string[];
  avoidProfiles: string[];
  additionalNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_BRIEF: PersonaBriefDto = {
  summary: "",
  decisionGuidelines: [],
  targetProfiles: [],
  avoidProfiles: [],
  additionalNotes: null,
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
}

function safeStringifyArray(value?: string[]): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}

export async function upsertPersonaBrief(companyCriteriaId: number, payload: PersonaBriefPayload) {
  await db.personaBrief.upsert({
    where: { companyCriteriaId },
    create: {
      companyCriteriaId,
      summary: payload.summary ?? "",
      decisionGuidelines: safeStringifyArray(payload.decisionGuidelines),
      targetProfiles: safeStringifyArray(payload.targetProfiles),
      avoidProfiles: safeStringifyArray(payload.avoidProfiles),
      additionalNotes: payload.additionalNotes ?? null,
    },
    update: {
      summary: payload.summary ?? "",
      decisionGuidelines: safeStringifyArray(payload.decisionGuidelines),
      targetProfiles: safeStringifyArray(payload.targetProfiles),
      avoidProfiles: safeStringifyArray(payload.avoidProfiles),
      additionalNotes: payload.additionalNotes ?? null,
      updatedAt: new Date(),
    },
  });
}
