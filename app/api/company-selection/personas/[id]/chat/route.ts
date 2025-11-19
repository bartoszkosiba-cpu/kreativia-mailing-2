import { NextRequest, NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { db } from "@/lib/db";
import { trackTokenUsage } from "@/services/tokenTracker";
import { logger } from "@/services/logger";
import {
  getPersonaCriteriaById,
  upsertPersonaCriteriaById,
  type PersonaCriteriaPayload,
  type PersonaCriteriaDto,
} from "@/services/personaCriteriaService";
import { upsertPersonaBrief } from "@/services/personaBriefService";

type AllowedRole = "system" | "user" | "assistant";

function parsePersonaId(raw: string | string[] | undefined): number | null {
  if (!raw || Array.isArray(raw)) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeHistory(history: unknown): ChatCompletionMessageParam[] {
  if (!Array.isArray(history)) {
    return [];
  }

  const allowedRoles: AllowedRole[] = ["system", "user", "assistant"];

  return history.reduce<ChatCompletionMessageParam[]>((accumulator, item) => {
    if (!item || typeof item !== "object") {
      return accumulator;
    }

    const role = Reflect.get(item, "role");
    const content = Reflect.get(item, "content");

    if (typeof role !== "string" || typeof content !== "string") {
      return accumulator;
    }

    if (!allowedRoles.includes(role as AllowedRole)) {
      return accumulator;
    }

    accumulator.push({ role: role as AllowedRole, content });
    return accumulator;
  }, []);
}

function buildPayload(
  personaId: number,
  existing: PersonaCriteriaDto | null,
  overrides: Partial<PersonaCriteriaPayload>
): PersonaCriteriaPayload {
  return {
    name: overrides.name ?? existing?.name ?? `Persony #${personaId}`,
    description: overrides.description ?? existing?.description,
    positiveRoles: overrides.positiveRoles ?? existing?.positiveRoles ?? [],
    negativeRoles: overrides.negativeRoles ?? existing?.negativeRoles ?? [],
    conditionalRules: overrides.conditionalRules ?? existing?.conditionalRules ?? [],
    language: overrides.language ?? existing?.language ?? "pl",
    chatHistory: overrides.chatHistory ?? existing?.chatHistory ?? [],
    lastUserMessage: overrides.lastUserMessage ?? existing?.lastUserMessage,
    lastAIResponse: overrides.lastAIResponse ?? existing?.lastAIResponse,
    createdBy: existing?.createdBy,
    updatedBy: overrides.updatedBy ?? existing?.updatedBy,
  };
}

function detectReadyToGenerate(response: string): boolean {
  const normalized = response.toLowerCase();

  return (
    normalized.includes("pozytywne persony") ||
    normalized.includes("negatywne persony") ||
    normalized.includes("lista person") ||
    normalized.includes("role docelowe") ||
    normalized.includes("role do unikania") ||
    normalized.includes("podsumowanie person")
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const personaId = parsePersonaId(params.id);

  if (personaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID persony" }, { status: 400 });
  }

  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Wiadomość jest wymagana" },
        { status: 400 }
      );
    }

    const existing = await getPersonaCriteriaById(personaId);
    
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono persony" },
        { status: 404 }
      );
    }

    // Pobierz companyCriteria jeśli istnieje (dla kontekstu)
    let baseCriteria = null;
    if (existing.companyCriteriaId) {
      baseCriteria = await db.companyVerificationCriteria.findUnique({ 
        where: { id: existing.companyCriteriaId } 
      });
    }

    let chatHistory = normalizeHistory(existing?.chatHistory ?? []);
    chatHistory.push({ role: "user", content: message });

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Sprawdź, czy istnieje brief z ustawioną rolą AI
    const brief = await db.personaBrief.findUnique({ where: { companyCriteriaId: personaId } });
    const hasAiRole = brief?.aiRole && brief.aiRole.trim().length > 0;

    // Przygotuj informacje o istniejących personach
    const existingPositiveRoles = (existing.positiveRoles ?? []).map((r: any) => 
      `- ${r.label}${r.keywords?.length ? ` (słowa kluczowe: ${r.keywords.join(", ")})` : ""}${r.departments?.length ? ` [działy: ${r.departments.join(", ")}]` : ""}`
    ).join("\n");
    const existingNegativeRoles = (existing.negativeRoles ?? []).map((r: any) => 
      `- ${r.label}${r.keywords?.length ? ` (słowa kluczowe: ${r.keywords.join(", ")})` : ""}${r.departments?.length ? ` [działy: ${r.departments.join(", ")}]` : ""}`
    ).join("\n");

    const systemPrompt = `Jesteś ekspertem ds. prospectingu B2B. Twoim zadaniem jest pomóc zdefiniować persony (stanowiska) do kontaktu handlowego dla kampanii cold mailingowych.

ZASADY:
- Na początku rozmowy (jeśli jeszcze nie ustalono) zapytaj użytkownika: "W jakiej roli mam się wcielić podczas weryfikacji person? (np. ekspert od stoisk targowych, analityk sprzedażowy B2B, specjalista od produktu X). To pomoże mi lepiej ocenić, które osoby są wartościowe dla Twojej kampanii."
- Jeśli użytkownik nie poda roli, zaproponuj rolę na podstawie opisu persony i kontekstu kampanii.
- Ustal pozytywne persony: stanowiska, role, zakresy obowiązków, słowa kluczowe w tytułach i działach.
- Zidentyfikuj negatywne persony: kogo unikać.
- Zwracaj uwagę na seniority, działy, język komunikacji.
- Przedstawiaj wnioski w punktach, pytaj o brakujące informacje.
- Gdy będziesz gotowy, podsumuj pozytywne/negatywne persony.
- Nie generuj finalnej struktury JSON – to nastąpi w osobnym kroku.
- Jeśli użytkownik chce zmodyfikować istniejące persony, zapytaj o szczegóły zmian i zaproponuj aktualizacje.

Kontekst kampanii (jeśli dostępny):
Nazwa kryteriów firmowych: ${baseCriteria?.name ?? "brak"}
Opis: ${baseCriteria?.description ?? "brak"}
Nazwa person: ${existing.name}
Opis person: ${existing.description ?? "brak"}
${hasAiRole ? `Ustawiona rola AI: ${brief.aiRole}` : "Rola AI: (nie ustalona - zapytaj użytkownika)"}

${existingPositiveRoles ? `Aktualne pozytywne persony:\n${existingPositiveRoles}\n` : ""}
${existingNegativeRoles ? `Aktualne negatywne persony:\n${existingNegativeRoles}\n` : ""}
${!existingPositiveRoles && !existingNegativeRoles ? "Uwaga: To jest nowa konfiguracja - nie ma jeszcze zdefiniowanych person.\n" : ""}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    if (completion.usage) {
      await trackTokenUsage({
        operation: "persona_criteria_chat",
        model: "gpt-4o",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        metadata: { personaId },
      });
    }

    const aiResponse = completion.choices[0]?.message?.content ?? "";
    chatHistory.push({ role: "assistant", content: aiResponse });

    const payload = buildPayload(personaId, existing, {
      name: existing.name,
      description: existing.description,
      chatHistory,
      lastUserMessage: message,
      lastAIResponse: aiResponse,
      updatedBy: "persona-agent",
    });

    const saved = await upsertPersonaCriteriaById(personaId, payload);

    logger.info("persona-criteria-chat", "Zapisano wiadomość w czacie person", { personaId });

    return NextResponse.json({
      success: true,
      response: aiResponse,
      chatHistory,
      shouldGenerate: detectReadyToGenerate(aiResponse),
      data: saved,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria-chat", "Błąd rozmowy o personach", { personaId }, err);
    return NextResponse.json(
      { success: false, error: "Błąd czatu z agentem", details: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const personaId = parsePersonaId(params.id);

  if (personaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID persony" }, { status: 400 });
  }

  try {
    const existing = await getPersonaCriteriaById(personaId);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono persony" },
        { status: 404 }
      );
    }

    const history = normalizeHistory(existing.chatHistory ?? []);

    if (history.length === 0) {
      return NextResponse.json(
        { success: false, error: "Brak wiadomości do analizy" },
        { status: 400 }
      );
    }

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Przygotuj informacje o istniejących personach dla kontekstu
    const existingPositiveRoles = (existing.positiveRoles ?? []).map((r: any) => 
      `- ${r.label}${r.keywords?.length ? ` (słowa kluczowe: ${r.keywords.join(", ")})` : ""}${r.departments?.length ? ` [działy: ${r.departments.join(", ")}]` : ""}`
    ).join("\n");
    const existingNegativeRoles = (existing.negativeRoles ?? []).map((r: any) => 
      `- ${r.label}${r.keywords?.length ? ` (słowa kluczowe: ${r.keywords.join(", ")})` : ""}${r.departments?.length ? ` [działy: ${r.departments.join(", ")}]` : ""}`
    ).join("\n");

    // Sprawdź, czy nazwa jest domyślna - jeśli nie, nie pozwól AI jej zmieniać
    const isDefaultName = !existing.name || existing.name.trim() === "" || existing.name === "Nowe persony weryfikacji";
    const nameInstruction = isDefaultName 
      ? `"name": "Nazwa konfiguracji" (możesz zaproponować nazwę na podstawie rozmowy)`
      : `"name": "${existing.name}" (ZACHOWAJ TĘ NAZWĘ - nie zmieniaj jej)`;

    const prompt = `Na podstawie historii rozmowy z użytkownikiem przygotuj strukturę person dla prospectingu B2B. 

${existingPositiveRoles || existingNegativeRoles ? `UWAGA: Istnieją już zdefiniowane persony. Jeśli użytkownik chce je zmodyfikować, zaktualizuj odpowiednie pozycje. Jeśli użytkownik chce dodać nowe, dodaj je do listy. Jeśli użytkownik chce usunąć, nie uwzględniaj ich w odpowiedzi.

Aktualne pozytywne persony:
${existingPositiveRoles || "(brak)"}

Aktualne negatywne persony:
${existingNegativeRoles || "(brak)"}

` : ""}Odpowiedz TYLKO w JSON:
{
  ${nameInstruction},
  "description": "Krótki opis",
  "language": "pl",
  "positiveRoles": [
    {
      "label": "Stanowisko",
      "matchType": "contains",
      "keywords": ["słowo", "inne"],
      "departments": ["dział"],
      "minSeniority": "mid",
      "confidence": 0.9
    }
  ],
  "negativeRoles": [
    {
      "label": "Stanowisko niepożądane",
      "keywords": ["marketing"],
      "departments": ["marketing"],
      "confidence": 0.8
    }
  ],
  "conditionalRules": [
    {
      "rule": "include",
      "whenAll": ["production", "manager"],
      "unless": ["assistant"],
      "notes": "Uwzględniaj tylko managerów produkcji"
    }
  ]
}

Historia rozmowy:
${JSON.stringify(history, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Jesteś ekspertem ds. prospectingu. Zwracasz wyłącznie poprawny JSON zgodny ze schematem.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1400,
    });

    if (completion.usage) {
      await trackTokenUsage({
        operation: "persona_criteria_generate",
        model: "gpt-4o",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        metadata: { personaId },
      });
    }

    let content = completion.choices[0]?.message?.content ?? "";
    let clean = content.trim();

    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    }

    const parsed = JSON.parse(clean) as PersonaCriteriaPayload;

    // Zachowaj nazwę użytkownika - nie nadpisuj jej nazwą z AI, chyba że jest domyślna
    // isDefaultName jest już zdefiniowane wyżej, więc używamy tej samej zmiennej
    const finalName = isDefaultName ? (parsed.name ?? existing.name) : existing.name;

    const payload = buildPayload(personaId, existing, {
      name: finalName,
      description: parsed.description ?? existing.description,
      language: parsed.language ?? existing.language,
      positiveRoles: parsed.positiveRoles ?? existing.positiveRoles,
      negativeRoles: parsed.negativeRoles ?? existing.negativeRoles,
      conditionalRules: parsed.conditionalRules ?? existing.conditionalRules,
      chatHistory: existing.chatHistory ?? [],
      updatedBy: "persona-agent",
    });

    const saved = await upsertPersonaCriteriaById(personaId, payload);

    // Automatycznie wygeneruj brief strategiczny na podstawie rozmowy
    try {
      const briefPrompt = `Na podstawie historii rozmowy z użytkownikiem przygotuj brief strategiczny dla weryfikacji person. Odpowiedz TYLKO w JSON:
{
  "summary": "Krótkie podsumowanie celów i kontekstu kampanii",
  "decisionGuidelines": ["Wskazówka 1", "Wskazówka 2"],
  "targetProfiles": ["Przykładowa persona pozytywna 1", "Przykładowa persona pozytywna 2"],
  "avoidProfiles": ["Przykładowa persona negatywna 1", "Przykładowa persona negatywna 2"],
  "aiRole": "Rola AI podczas weryfikacji (np. ekspert od stoisk targowych, analityk sprzedażowy B2B)"
}

Historia rozmowy:
${JSON.stringify(history, null, 2)}

Wygenerowane persony:
Pozytywne: ${JSON.stringify(parsed.positiveRoles?.map((r: any) => r.label) || [], null, 2)}
Negatywne: ${JSON.stringify(parsed.negativeRoles?.map((r: any) => r.label) || [], null, 2)}`;

      const briefCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Jesteś ekspertem ds. prospectingu. Zwracasz wyłącznie poprawny JSON zgodny ze schematem.",
          },
          { role: "user", content: briefPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      if (briefCompletion.usage) {
        await trackTokenUsage({
          operation: "persona_brief_generate",
          model: "gpt-4o",
          promptTokens: briefCompletion.usage.prompt_tokens,
          completionTokens: briefCompletion.usage.completion_tokens,
          metadata: { personaId },
        });
      }

      let briefContent = briefCompletion.choices[0]?.message?.content ?? "";
      let briefClean = briefContent.trim();

      if (briefClean.startsWith("```json")) {
        briefClean = briefClean.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      } else if (briefClean.startsWith("```")) {
        briefClean = briefClean.replace(/^```\s*/i, "").replace(/```\s*$/i, "");
      }

      const briefParsed = JSON.parse(briefClean) as {
        summary?: string;
        decisionGuidelines?: string[];
        targetProfiles?: string[];
        avoidProfiles?: string[];
        aiRole?: string;
      };

      // Zapisz brief tylko jeśli AI wygenerował jakieś dane
      if (briefParsed.summary || briefParsed.decisionGuidelines?.length || briefParsed.targetProfiles?.length || briefParsed.avoidProfiles?.length || briefParsed.aiRole) {
        await upsertPersonaBrief(personaId, {
          summary: briefParsed.summary || "",
          decisionGuidelines: briefParsed.decisionGuidelines || [],
          targetProfiles: briefParsed.targetProfiles || [],
          avoidProfiles: briefParsed.avoidProfiles || [],
          aiRole: briefParsed.aiRole || null,
        });
        logger.info("persona-brief-generate", "Wygenerowano brief strategiczny z rozmowy", { personaId });
      }
    } catch (briefError) {
      // Nie przerywamy procesu jeśli generowanie briefu się nie powiodło
      logger.error("persona-brief-generate", "Błąd generowania briefu z rozmowy", { personaId }, briefError as Error);
    }

    logger.info("persona-criteria-generate", "Zaktualizowano konfigurację person", { personaId });

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria-generate", "Błąd generowania person", { personaId }, err);
    return NextResponse.json(
      { success: false, error: "Błąd generowania person", details: err.message },
      { status: 500 }
    );
  }
}

