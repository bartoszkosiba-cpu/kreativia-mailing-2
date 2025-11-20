import { db } from "@/lib/db";
import { getPersonaCriteriaById } from "./personaCriteriaService";
import { getFullPromptText } from "./personaVerificationAI";

export interface PersonaBriefDto {
  summary: string;
  decisionGuidelines: string[];
  targetProfiles: string[];
  avoidProfiles: string[];
  additionalNotes?: string | null;
  aiRole?: string | null; // Rola/perspektywa AI podczas weryfikacji
  positiveThreshold?: number; // Próg procentowy (0.0-1.0) dla klasyfikacji pozytywnej. Score >= threshold = positive, score < threshold = negative
  generatedPrompt?: string | null; // Wygenerowany prompt do weryfikacji person przez AI
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
    generatedPrompt: (record as any).generatedPrompt ?? null,
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

/**
 * Generuje i zapisuje prompt do weryfikacji person
 */
async function generateAndSavePrompt(companyCriteriaId: number): Promise<string | null> {
  try {
    // Pobierz PersonaCriteria
    const personaCriteria = await getPersonaCriteriaById(companyCriteriaId);
    if (!personaCriteria) {
      console.error(`[personaBriefService] Nie znaleziono PersonaCriteria dla ID: ${companyCriteriaId}`);
      return null;
    }

    // Pobierz Brief
    const brief = await getPersonaBrief(companyCriteriaId);
    if (!brief || !brief.summary) {
      // Jeśli nie ma briefu, nie generuj promptu
      console.warn(`[personaBriefService] Brak briefu lub summary dla ID: ${companyCriteriaId}`);
      return null;
    }

    // Przygotuj brief context
    const briefContext = {
      summary: brief.summary,
      decisionGuidelines: brief.decisionGuidelines || [],
      targetProfiles: brief.targetProfiles || [],
      avoidProfiles: brief.avoidProfiles || [],
      additionalNotes: brief.additionalNotes || null,
      aiRole: brief.aiRole || null,
      positiveThreshold: brief.positiveThreshold || 0.5,
    };

    // Wygeneruj pełny prompt
    const promptText = getFullPromptText(personaCriteria, briefContext);
    
    if (!promptText || promptText.trim().length === 0) {
      console.error(`[personaBriefService] Wygenerowany prompt jest pusty dla ID: ${companyCriteriaId}`);
      return null;
    }

    // Zapisz prompt do bazy
    const updated = await db.personaBrief.update({
      where: { companyCriteriaId },
      data: {
        generatedPrompt: promptText,
      } as any,
    });

    console.log(`[personaBriefService] ✅ Zapisano prompt dla ID: ${companyCriteriaId}, długość: ${promptText.length} znaków`);
    
    // Weryfikacja że prompt został zapisany
    if (!updated.generatedPrompt) {
      console.error(`[personaBriefService] ❌ Prompt nie został zapisany dla ID: ${companyCriteriaId}`);
      return null;
    }

    return promptText;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[personaBriefService] ❌ Błąd generowania promptu dla ID: ${companyCriteriaId}:`, err.message);
    console.error(`[personaBriefService] Stack trace:`, err.stack);
    return null;
  }
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
      generatedPrompt: null, // Zostanie wygenerowany poniżej
    } as any,
    update: {
      summary: payload.summary ?? "",
      decisionGuidelines: safeStringifyArray(payload.decisionGuidelines),
      targetProfiles: safeStringifyArray(payload.targetProfiles),
      avoidProfiles: safeStringifyArray(payload.avoidProfiles),
      additionalNotes: payload.additionalNotes ?? null,
      aiRole: aiRoleFinal,
      positiveThreshold: positiveThreshold,
      // generatedPrompt zostanie zaktualizowany poniżej
    } as any,
  });

  // Po zapisaniu briefu, wygeneruj i zapisz prompt
  // Prompt jest generowany tylko jeśli brief ma summary (jest kompletny)
  if (payload.summary && payload.summary.trim().length > 0) {
    await generateAndSavePrompt(companyCriteriaId);
  }
}

/**
 * Regeneruje prompt dla danego PersonaCriteria (wywoływane przy zmianie PersonaCriteria)
 */
export async function regeneratePromptForPersonaCriteria(personaCriteriaId: number): Promise<void> {
  await generateAndSavePrompt(personaCriteriaId);
}
