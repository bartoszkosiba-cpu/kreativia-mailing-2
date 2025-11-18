import { db } from "@/lib/db";

export type PersonaMatchType = "contains" | "exact" | "regex" | "embedding";

export interface PersonaRoleConfig {
  label: string;
  matchType?: PersonaMatchType;
  keywords?: string[];
  departments?: string[];
  minSeniority?: string;
  confidence?: number;
}

export interface PersonaConditionalRule {
  rule: "include" | "exclude";
  whenAll?: string[];
  whenAny?: string[];
  unless?: string[];
  notes?: string;
}

export interface PersonaBriefPayload {
  summary: string;
  decisionGuidelines?: string[];
  targetProfiles?: string[];
  avoidProfiles?: string[];
  additionalNotes?: string;
}

export interface PersonaBriefDto extends PersonaBriefPayload {
  id: number;
  companyCriteriaId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonaCriteriaPayload {
  name: string;
  description?: string;
  positiveRoles: PersonaRoleConfig[];
  negativeRoles: PersonaRoleConfig[];
  conditionalRules?: PersonaConditionalRule[];
  language?: string;
  chatHistory?: unknown[];
  lastUserMessage?: string;
  lastAIResponse?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface PersonaCriteriaDto extends PersonaCriteriaPayload {
  id: number;
  companyCriteriaId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function safeStringify(value: unknown, fallback: string): string {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback));
  } catch {
    return fallback;
  }
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseStringArray(value: string | null | undefined): string[] {
  return parseJson<string[]>(value, []);
}

function stringifyStringArray(value?: string[]): string | null {
  if (!value || value.length === 0) {
    return null;
  }
  return safeStringify(value, "[]");
}

export async function getPersonaCriteria(criteriaId: number): Promise<PersonaCriteriaDto | null> {
  const record = await db.companyPersonaCriteria.findUnique({
    where: { companyCriteriaId: criteriaId },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    companyCriteriaId: record.companyCriteriaId,
    name: record.name,
    description: record.description ?? undefined,
    positiveRoles: parseJson<PersonaRoleConfig[]>(record.positiveRoles, []),
    negativeRoles: parseJson<PersonaRoleConfig[]>(record.negativeRoles, []),
    conditionalRules: parseJson<PersonaConditionalRule[]>(record.conditionalRules, []),
    language: record.language ?? undefined,
    chatHistory: parseJson<unknown[]>(record.chatHistory, []),
    lastUserMessage: record.lastUserMessage ?? undefined,
    lastAIResponse: record.lastAIResponse ?? undefined,
    createdBy: record.createdBy ?? undefined,
    updatedBy: record.updatedBy ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function upsertPersonaCriteria(
  criteriaId: number,
  payload: PersonaCriteriaPayload
): Promise<PersonaCriteriaDto> {
  const positiveRoles = safeStringify(payload.positiveRoles ?? [], "[]");
  const negativeRoles = safeStringify(payload.negativeRoles ?? [], "[]");
  const conditionalRules = payload.conditionalRules
    ? safeStringify(payload.conditionalRules, "[]")
    : null;
  const chatHistory = payload.chatHistory ? safeStringify(payload.chatHistory, "[]") : null;

  const existing = await db.companyPersonaCriteria.findUnique({
    where: { companyCriteriaId: criteriaId },
  });

  const record = existing
    ? await db.companyPersonaCriteria.update({
        where: { id: existing.id },
        data: {
          name: payload.name,
          description: payload.description ?? null,
          positiveRoles,
          negativeRoles,
          conditionalRules,
          language: payload.language ?? null,
          chatHistory,
          lastUserMessage: payload.lastUserMessage ?? null,
          lastAIResponse: payload.lastAIResponse ?? null,
          updatedBy: payload.updatedBy ?? null,
          updatedAt: new Date(),
        },
      })
    : await db.companyPersonaCriteria.create({
        data: {
          companyCriteriaId: criteriaId,
          name: payload.name,
          description: payload.description ?? null,
          positiveRoles,
          negativeRoles,
          conditionalRules,
          language: payload.language ?? null,
          chatHistory,
          lastUserMessage: payload.lastUserMessage ?? null,
          lastAIResponse: payload.lastAIResponse ?? null,
          createdBy: payload.createdBy ?? null,
          updatedBy: payload.updatedBy ?? null,
        },
      });

  return {
    id: record.id,
    companyCriteriaId: record.companyCriteriaId,
    name: record.name,
    description: record.description ?? undefined,
    positiveRoles: parseJson<PersonaRoleConfig[]>(record.positiveRoles, []),
    negativeRoles: parseJson<PersonaRoleConfig[]>(record.negativeRoles, []),
    conditionalRules: parseJson<PersonaConditionalRule[]>(record.conditionalRules, []),
    language: record.language ?? undefined,
    chatHistory: parseJson<unknown[]>(record.chatHistory, []),
    lastUserMessage: record.lastUserMessage ?? undefined,
    lastAIResponse: record.lastAIResponse ?? undefined,
    createdBy: record.createdBy ?? undefined,
    updatedBy: record.updatedBy ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Pobierz personę po ID (niezależnie od companyCriteriaId)
 */
export async function getPersonaCriteriaById(personaId: number): Promise<PersonaCriteriaDto | null> {
  const record = await db.companyPersonaCriteria.findUnique({
    where: { id: personaId },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    companyCriteriaId: record.companyCriteriaId,
    name: record.name,
    description: record.description ?? undefined,
    positiveRoles: parseJson<PersonaRoleConfig[]>(record.positiveRoles, []),
    negativeRoles: parseJson<PersonaRoleConfig[]>(record.negativeRoles, []),
    conditionalRules: parseJson<PersonaConditionalRule[]>(record.conditionalRules, []),
    language: record.language ?? undefined,
    chatHistory: parseJson<unknown[]>(record.chatHistory, []),
    lastUserMessage: record.lastUserMessage ?? undefined,
    lastAIResponse: record.lastAIResponse ?? undefined,
    createdBy: record.createdBy ?? undefined,
    updatedBy: record.updatedBy ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Utwórz lub zaktualizuj personę po ID (niezależnie od companyCriteriaId)
 */
export async function upsertPersonaCriteriaById(
  personaId: number | null,
  payload: PersonaCriteriaPayload,
  companyCriteriaId?: number | null
): Promise<PersonaCriteriaDto> {
  const positiveRoles = safeStringify(payload.positiveRoles ?? [], "[]");
  const negativeRoles = safeStringify(payload.negativeRoles ?? [], "[]");
  const conditionalRules = payload.conditionalRules
    ? safeStringify(payload.conditionalRules, "[]")
    : null;
  const chatHistory = payload.chatHistory ? safeStringify(payload.chatHistory, "[]") : null;

  if (personaId) {
    // Aktualizuj istniejącą personę
    const existing = await db.companyPersonaCriteria.findUnique({
      where: { id: personaId },
    });

    if (!existing) {
      throw new Error(`Persona o ID ${personaId} nie istnieje`);
    }

    const record = await db.companyPersonaCriteria.update({
      where: { id: personaId },
      data: {
        ...(companyCriteriaId !== undefined && { companyCriteriaId: companyCriteriaId || null }),
        name: payload.name,
        description: payload.description ?? null,
        positiveRoles,
        negativeRoles,
        conditionalRules,
        language: payload.language ?? null,
        chatHistory,
        lastUserMessage: payload.lastUserMessage ?? null,
        lastAIResponse: payload.lastAIResponse ?? null,
        updatedBy: payload.updatedBy ?? null,
        updatedAt: new Date(),
      },
    });

    return {
      id: record.id,
      companyCriteriaId: record.companyCriteriaId,
      name: record.name,
      description: record.description ?? undefined,
      positiveRoles: parseJson<PersonaRoleConfig[]>(record.positiveRoles, []),
      negativeRoles: parseJson<PersonaRoleConfig[]>(record.negativeRoles, []),
      conditionalRules: parseJson<PersonaConditionalRule[]>(record.conditionalRules, []),
      language: record.language ?? undefined,
      chatHistory: parseJson<unknown[]>(record.chatHistory, []),
      lastUserMessage: record.lastUserMessage ?? undefined,
      lastAIResponse: record.lastAIResponse ?? undefined,
      createdBy: record.createdBy ?? undefined,
      updatedBy: record.updatedBy ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  } else {
    // Utwórz nową personę
    const record = await db.companyPersonaCriteria.create({
      data: {
        companyCriteriaId: companyCriteriaId || null,
        name: payload.name,
        description: payload.description ?? null,
        positiveRoles,
        negativeRoles,
        conditionalRules,
        language: payload.language ?? null,
        chatHistory,
        lastUserMessage: payload.lastUserMessage ?? null,
        lastAIResponse: payload.lastAIResponse ?? null,
        createdBy: payload.createdBy ?? null,
        updatedBy: payload.updatedBy ?? null,
      },
    });

    return {
      id: record.id,
      companyCriteriaId: record.companyCriteriaId,
      name: record.name,
      description: record.description ?? undefined,
      positiveRoles: parseJson<PersonaRoleConfig[]>(record.positiveRoles, []),
      negativeRoles: parseJson<PersonaRoleConfig[]>(record.negativeRoles, []),
      conditionalRules: parseJson<PersonaConditionalRule[]>(record.conditionalRules, []),
      language: record.language ?? undefined,
      chatHistory: parseJson<unknown[]>(record.chatHistory, []),
      lastUserMessage: record.lastUserMessage ?? undefined,
      lastAIResponse: record.lastAIResponse ?? undefined,
      createdBy: record.createdBy ?? undefined,
      updatedBy: record.updatedBy ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

