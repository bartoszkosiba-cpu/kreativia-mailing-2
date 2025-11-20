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
import { upsertPersonaBrief, regeneratePromptForPersonaCriteria } from "@/services/personaBriefService";

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

function detectReadyToGenerate(response: string, lastUserMessage?: string): boolean {
  const normalized = response.toLowerCase();
  const userMessage = (lastUserMessage || "").toLowerCase();

  // Sprawdź czy AI przedstawiło podsumowanie w wymaganym formacie
  // Musi zawierać DOKŁADNIE nagłówek "## PODSUMOWANIE - PROSZĘ POTWIERDŹ" lub podobny
  const hasSummaryHeader = (
    (normalized.includes("## podsumowanie") && normalized.includes("proszę potwierdź")) ||
    normalized.includes("podsumowanie - proszę potwierdź") ||
    (normalized.includes("podsumowanie") && normalized.includes("proszę potwierdź") && 
     (normalized.includes("##") || normalized.includes("###")))
  );

  // Sprawdź czy są wszystkie wymagane sekcje
  const hasAllSections = (
    (normalized.includes("kontekst biznesowy") || normalized.includes("produkt/usługa") || normalized.includes("produkt:") || normalized.includes("odbiorcy:")) &&
    normalized.includes("seniority") &&
    (normalized.includes("pozytywne persony") || normalized.includes("pozytywne:")) &&
    (normalized.includes("negatywne persony") || normalized.includes("negatywne:")) &&
    (normalized.includes("brief strategiczny") || normalized.includes("brief"))
  );

  // Sprawdź czy jest pytanie o potwierdzenie
  const hasConfirmationQuestion = (
    normalized.includes("czy powyższe") ||
    normalized.includes("czy chcesz coś zmienić") ||
    normalized.includes("przed wygenerowaniem") ||
    normalized.includes("czy powyższe podsumowanie") ||
    normalized.includes("czy powyższe jest poprawne") ||
    normalized.includes("czy chcesz coś dodać")
  );

  const hasSummaryFormat = hasSummaryHeader && hasAllSections && hasConfirmationQuestion;

  // Sprawdź czy użytkownik potwierdził podsumowanie (tylko w ostatniej wiadomości użytkownika)
  // WAŻNE: użytkownik musi potwierdzić TYLKO jeśli jest podsumowanie w formacie
  const userMessageTrimmed = userMessage.trim();
  const userConfirmed = hasSummaryFormat && userMessage && (
    (userMessage.includes("tak") && (userMessage.includes("poprawne") || userMessage.includes("zgadza") || userMessage.includes("ok"))) ||
    userMessage.includes("zgadza się") ||
    userMessage.includes("poprawnie") ||
    userMessage.includes("wygeneruj") ||
    userMessage.includes("generuj") ||
    userMessage.includes("wszystko ok") ||
    userMessageTrimmed === "ok" || userMessageTrimmed === "ok." || userMessageTrimmed === "ok," // "ok" samo w sobie
  );

  // Zwróć true TYLKO jeśli jest podsumowanie w formacie I użytkownik potwierdził
  // Jeśli nie ma podsumowania w formacie, ZAWSZE zwróć false
  return hasSummaryFormat && userConfirmed;
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

KRYTYCZNE - SEKWENCJA DZIAŁAŃ (MUSISZ PRZESTRZEGAĆ TEGO PORZĄDKU):

1. ZBIERZ KONTEKST BIZNESOWY:
   - Zapytaj o produkt/usługę: "Jaki produkt lub usługę oferujesz? Opisz go krótko."
   - Zapytaj o odbiorców: "Do jakich firm kierujesz swoją ofertę? Jaki jest ich profil biznesowy?"
   - Zapytaj o logikę decyzyjną: "Kto w tych firmach podejmuje decyzje zakupowe? Jakie stanowiska mają wpływ na wybór Twojego produktu/usługi?"
   - Zapytaj o przykłady: "Podaj przykłady stanowisk, które ZAWSZE powinny być pozytywne (np. Project Manager, CEO, Sales Manager)."
   - Zapytaj o stanowiska do unikania: "Jakie stanowiska lub działy powinniśmy unikać?"

2. ZAPYTAJ O SENIORITY (ZAWSZE, NAWET JEŚLI UŻYTKOWNIK WSPOMNIAŁ):
   - ZAWSZE zadaj pytanie: "Czy poziom seniority (junior/mid/senior) jest dla Ciebie ważny przy wyborze person?"
   - Nawet jeśli użytkownik wspomniał o seniority wcześniej, POTWIERDŹ swoje zrozumienie: "Rozumiem, że seniority jest [ważne/nieistotne] - czy to się zgadza?"
   - Jeśli użytkownik mówi, że seniority nie jest ważne, zapamiętaj to i ustaw minSeniority na null w briefie.

3. PRZEDSTAW PODSUMOWANIE W WYMAGANYM FORMACIE (PRZED ZAPROPONOWANIEM GENEROWANIA):
   - MUSISZ przedstawić podsumowanie w DOKŁADNIE takim formacie:
   
   ## PODSUMOWANIE - PROSZĘ POTWIERDŹ
   
   **KONTEKST BIZNESOWY:**
   [Opisz produkt/usługę, odbiorców, logikę decyzyjną]
   
   **SENIORITY:**
   [Czy seniority jest ważne? Jeśli nie, ustaw minSeniority na null]
   
   **POZYTYWNE PERSONY:**
   [Lista stanowisk, które ZAWSZE powinny być pozytywne]
   
   **NEGATYWNE PERSONY:**
   [Lista stanowisk/działów do unikania]
   
   **BRIEF STRATEGICZNY:**
   [Krótkie podsumowanie strategii weryfikacji]
   
   Czy powyższe podsumowanie jest poprawne? Czy chcesz coś zmienić przed wygenerowaniem person?

4. TYLKO PO POTWIERDZENIU PRZEZ UŻYTKOWNIKA:
   - Jeśli użytkownik potwierdzi (np. "tak", "zgadza się", "wygeneruj", "ok"), wtedy możesz zaproponować generowanie.
   - NIE proponuj generowania, jeśli nie przedstawiłeś podsumowania w wymaganym formacie.
   - NIE proponuj generowania, jeśli użytkownik nie potwierdził podsumowania.

ZASADY DODATKOWE:
- Na początku rozmowy (jeśli jeszcze nie ustalono) zapytaj użytkownika: "W jakiej roli mam się wcielić podczas weryfikacji person? (np. ekspert od stoisk targowych, analityk sprzedażowy B2B, specjalista od produktu X). To pomoże mi lepiej ocenić, które osoby są wartościowe dla Twojej kampanii."
- Jeśli użytkownik nie poda roli, zaproponuj rolę na podstawie opisu persony i kontekstu kampanii.
- Ustal pozytywne persony: stanowiska, role, zakresy obowiązków, słowa kluczowe w tytułach i działach.
- Zidentyfikuj negatywne persony: kogo unikać.
- Zwracaj uwagę na seniority, działy, język komunikacji.
- Przedstawiaj wnioski w punktach, pytaj o brakujące informacje.
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

    // Regeneruj prompt jeśli PersonaCriteria zostało zmienione
    try {
      await regeneratePromptForPersonaCriteria(personaId);
    } catch (promptError) {
      // Nie przerywamy procesu jeśli regeneracja promptu się nie powiodła
      logger.error("persona-criteria-chat", "Błąd regeneracji promptu", { personaId }, promptError as Error);
    }

    // Sprawdź gotowość do generowania - sprawdź OSTATNIĄ odpowiedź AI LUB poprzednie odpowiedzi w historii
    // Jeśli użytkownik potwierdził (np. "ok"), sprawdź czy w poprzednich odpowiedziach AI było podsumowanie
    let shouldGenerateFromFunction = detectReadyToGenerate(aiResponse, message);
    
    // Jeśli ostatnia odpowiedź AI nie zawiera podsumowania, ale użytkownik potwierdził,
    // sprawdź poprzednie odpowiedzi AI w historii
    if (!shouldGenerateFromFunction && message) {
      const userMsg = message.toLowerCase().trim();
      const isConfirmation = userMsg === "ok" || userMsg === "ok." || userMsg === "ok," ||
        userMsg.includes("zgadza się") || userMsg.includes("poprawnie") ||
        userMsg.includes("wygeneruj") || userMsg.includes("generuj") ||
        (userMsg.includes("tak") && (userMsg.includes("poprawne") || userMsg.includes("zgadza")));
      
      if (isConfirmation) {
        // Sprawdź poprzednie odpowiedzi AI w historii
        for (let i = chatHistory.length - 2; i >= 0; i--) {
          const prevResponse = chatHistory[i];
          if (prevResponse.role === "assistant" && prevResponse.content) {
            const prevCheck = detectReadyToGenerate(prevResponse.content, message);
            if (prevCheck) {
              shouldGenerateFromFunction = true;
              break;
            }
          }
        }
      }
    }
    
    // Sprawdź jeszcze raz lokalnie (dla pewności) - to jest ostateczna weryfikacja
    // Sprawdź OSTATNIĄ odpowiedź AI LUB poprzednie odpowiedzi
    let normalized = aiResponse.toLowerCase();
    const userMsg = message.toLowerCase();
    
    // Sprawdź ostatnią odpowiedź AI
    let hasHeader = (normalized.includes("## podsumowanie") && normalized.includes("proszę potwierdź")) ||
      normalized.includes("podsumowanie - proszę potwierdź");
    let hasSections = (normalized.includes("kontekst biznesowy") || normalized.includes("produkt/usługa") || normalized.includes("produkt:") || normalized.includes("odbiorcy:")) &&
      normalized.includes("seniority") &&
      (normalized.includes("pozytywne persony") || normalized.includes("pozytywne:")) &&
      (normalized.includes("negatywne persony") || normalized.includes("negatywne:")) &&
      (normalized.includes("brief strategiczny") || normalized.includes("brief"));
    let hasQuestion = normalized.includes("czy powyższe") ||
      normalized.includes("czy chcesz coś zmienić") ||
      normalized.includes("przed wygenerowaniem") ||
      normalized.includes("czy powyższe podsumowanie") ||
      normalized.includes("czy powyższe jest poprawne") ||
      normalized.includes("czy chcesz coś dodać");
    
    // Jeśli nie ma w ostatniej odpowiedzi, sprawdź poprzednie odpowiedzi w historii
    if (!hasHeader || !hasSections || !hasQuestion) {
      for (let i = chatHistory.length - 2; i >= 0; i--) {
        const prevResponse = chatHistory[i];
        if (prevResponse.role === "assistant" && prevResponse.content) {
          const prevNormalized = prevResponse.content.toLowerCase();
          if (!hasHeader) {
            hasHeader = (prevNormalized.includes("## podsumowanie") && prevNormalized.includes("proszę potwierdź")) ||
              prevNormalized.includes("podsumowanie - proszę potwierdź");
          }
          if (!hasSections) {
            hasSections = (prevNormalized.includes("kontekst biznesowy") || prevNormalized.includes("produkt/usługa") || prevNormalized.includes("produkt:") || prevNormalized.includes("odbiorcy:")) &&
              prevNormalized.includes("seniority") &&
              (prevNormalized.includes("pozytywne persony") || prevNormalized.includes("pozytywne:")) &&
              (prevNormalized.includes("negatywne persony") || prevNormalized.includes("negatywne:")) &&
              (prevNormalized.includes("brief strategiczny") || prevNormalized.includes("brief"));
          }
          if (!hasQuestion) {
            hasQuestion = prevNormalized.includes("czy powyższe") ||
              prevNormalized.includes("czy chcesz coś zmienić") ||
              prevNormalized.includes("przed wygenerowaniem") ||
              prevNormalized.includes("czy powyższe podsumowanie") ||
              prevNormalized.includes("czy powyższe jest poprawne") ||
              prevNormalized.includes("czy chcesz coś dodać");
          }
          if (hasHeader && hasSections && hasQuestion) {
            normalized = prevNormalized; // Użyj poprzedniej odpowiedzi do dalszej weryfikacji
            break;
          }
        }
      }
    }
    
    // Musi być wszystko razem
    const hasFormat = hasHeader && hasSections && hasQuestion;
    
    // Sprawdź czy użytkownik potwierdził
    // "ok" samo w sobie powinno być uznane za potwierdzenie jeśli jest podsumowanie
    const userConfirmed = hasFormat && userMsg && (
      (userMsg.includes("tak") && (userMsg.includes("poprawne") || userMsg.includes("zgadza") || userMsg.includes("ok"))) ||
      userMsg.includes("zgadza się") ||
      userMsg.includes("poprawnie") ||
      userMsg.includes("wygeneruj") ||
      userMsg.includes("generuj") ||
      (userMsg.trim() === "ok" || userMsg.trim() === "ok." || userMsg.trim() === "ok,") // "ok" samo w sobie
    );
    
    // FINALNA wartość - ZAWSZE false jeśli nie ma podsumowania w formacie
    const finalShouldGenerate = hasFormat && userConfirmed;
    
    // Logowanie - użyj logger.info (zapisuje do plików)
    logger.info("persona-criteria-chat", "shouldGenerate check", {
      shouldGenerateFromFunction,
      finalShouldGenerate,
      hasHeader,
      hasSections,
      hasQuestion,
      hasFormat,
      userConfirmed: !!userConfirmed,
      aiResponseLength: aiResponse.length,
      userMessagePreview: message.substring(0, 100),
      aiResponsePreview: aiResponse.substring(0, 300)
    });
    
    // WYŚWIETL W TERMINALU - użyj console.error (zawsze widoczne)
    if (!finalShouldGenerate) {
      console.error("\n[PERSONA-CHAT] shouldGenerate=FALSE");
      console.error("  hasHeader:", hasHeader);
      console.error("  hasSections:", hasSections);
      console.error("  hasQuestion:", hasQuestion);
      console.error("  hasFormat:", hasFormat);
      console.error("  userConfirmed:", !!userConfirmed);
      console.error("  AI Response preview:", aiResponse.substring(0, 200));
      console.error("");
    } else {
      console.error("\n[PERSONA-CHAT] shouldGenerate=TRUE - gotowe do generowania!\n");
    }

    logger.info("persona-criteria-chat", "Zapisano wiadomość w czacie person", { personaId });

    return NextResponse.json({
      success: true,
      response: aiResponse,
      chatHistory,
      shouldGenerate: finalShouldGenerate, // ZAWSZE użyj finalnej wartości - false jeśli nie ma podsumowania
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

    // Regeneruj prompt jeśli PersonaCriteria zostało zmienione
    try {
      await regeneratePromptForPersonaCriteria(personaId);
    } catch (promptError) {
      // Nie przerywamy procesu jeśli regeneracja promptu się nie powiodła
      logger.error("persona-criteria-chat", "Błąd regeneracji promptu", { personaId }, promptError as Error);
    }

    // Automatycznie wygeneruj brief strategiczny na podstawie rozmowy
    try {
      // Sprawdź czy użytkownik powiedział, że seniority nie jest ważne
      const historyText = JSON.stringify(history, null, 2).toLowerCase();
      const seniorityNotImportant = historyText.includes("seniority nie") || 
        historyText.includes("seniority nie jest") ||
        historyText.includes("seniority nie ma") ||
        historyText.includes("seniority nieistotne") ||
        historyText.includes("seniority nie ważne") ||
        (historyText.includes("seniority") && (historyText.includes("nie ważne") || historyText.includes("nieistotne")));
      
      const briefPrompt = `Na podstawie historii rozmowy z użytkownikiem przygotuj brief strategiczny dla weryfikacji person. Odpowiedz TYLKO w JSON:
{
  "summary": "SZCZEGÓŁOWE podsumowanie kontekstu biznesowego - MUSISZ uwzględnić: 1) Co to za produkt/usługa (dokładny opis), 2) Do jakich firm jest kierowany (profil odbiorców), 3) Kto w tych firmach podejmuje decyzje zakupowe i dlaczego (logika decyzyjna), 4) Jaki jest cel kampanii. To jest KLUCZOWE dla poprawnej weryfikacji person przez AI.",
  "decisionGuidelines": ["Wskazówka 1 - jak oceniać stanowiska", "Wskazówka 2 - co brać pod uwagę"],
  "targetProfiles": ["Wszystkie stanowiska pozytywne z wygenerowanych person - MUSISZ uwzględnić WSZYSTKIE z listy poniżej"],
  "avoidProfiles": ["Wszystkie stanowiska negatywne z wygenerowanych person - MUSISZ uwzględnić WSZYSTKIE z listy poniżej"],
  "aiRole": "Rola AI podczas weryfikacji (np. ekspert od stoisk targowych, analityk sprzedażowy B2B)"
}

${seniorityNotImportant ? "WAŻNE: Użytkownik wyraźnie stwierdził, że seniority nie jest ważne. W briefie nie uwzględniaj wymagań dotyczących poziomu seniority." : ""}

WAŻNE - MUSISZ uwzględnić WSZYSTKIE stanowiska z wygenerowanych person w targetProfiles i avoidProfiles. Nie pomijaj żadnego stanowiska.

Historia rozmowy:
${JSON.stringify(history, null, 2)}

Wygenerowane persony:
Pozytywne: ${JSON.stringify(parsed.positiveRoles?.map((r: any) => r.label) || [], null, 2)}
Negatywne: ${JSON.stringify(parsed.negativeRoles?.map((r: any) => r.label) || [], null, 2)}

Uwaga: W targetProfiles i avoidProfiles MUSISZ uwzględnić WSZYSTKIE stanowiska z powyższych list. Nie pomijaj żadnego.`;

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
        
        // Upewnij się że prompt został wygenerowany i zapisany
        try {
          await regeneratePromptForPersonaCriteria(personaId);
          logger.info("persona-brief-generate", "Wygenerowano i zapisano prompt po zapisaniu briefu", { personaId });
        } catch (promptError) {
          logger.error("persona-brief-generate", "Błąd generowania promptu po zapisaniu briefu", { personaId }, promptError as Error);
        }
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

