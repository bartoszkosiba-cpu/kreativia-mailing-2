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

/**
 * Regeneruje brief strategiczny na podstawie aktualnej rozmowy
 */
async function regenerateBriefFromConversation(
  personaId: number,
  history: ChatCompletionMessageParam[],
  savedPersonaCriteria: PersonaCriteriaDto,
  openai: any
): Promise<void> {
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
Pozytywne: ${JSON.stringify(savedPersonaCriteria.positiveRoles?.map((r: any) => r.label) || [], null, 2)}
Negatywne: ${JSON.stringify(savedPersonaCriteria.negativeRoles?.map((r: any) => r.label) || [], null, 2)}

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
        operation: "persona_brief_regenerate",
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

    let briefParsed: {
      summary?: string;
      decisionGuidelines?: string[];
      targetProfiles?: string[];
      avoidProfiles?: string[];
      aiRole?: string;
    };

    try {
      briefParsed = JSON.parse(briefClean);
    } catch (parseError) {
      logger.error("persona-brief-regenerate", "Błąd parsowania JSON briefu", { personaId }, parseError as Error);
      logger.error("persona-brief-regenerate", "Zawartość briefu", { personaId, content: briefClean.substring(0, 500) });
      return; // Nie rzucamy błędu - regeneracja briefu nie jest krytyczna
    }

    // Walidacja danych
    if (!briefParsed || typeof briefParsed !== "object") {
      logger.error("persona-brief-regenerate", "Brief nie jest obiektem", { personaId });
      return;
    }

    // Zapisz brief tylko jeśli są dane do zapisania
    if (briefParsed.summary || briefParsed.decisionGuidelines?.length || briefParsed.targetProfiles?.length || briefParsed.avoidProfiles?.length || briefParsed.aiRole) {
      const { upsertPersonaBrief } = await import("@/services/personaBriefService");
      await upsertPersonaBrief(personaId, {
        summary: briefParsed.summary || "",
        decisionGuidelines: Array.isArray(briefParsed.decisionGuidelines) ? briefParsed.decisionGuidelines : [],
        targetProfiles: Array.isArray(briefParsed.targetProfiles) ? briefParsed.targetProfiles : [],
        avoidProfiles: Array.isArray(briefParsed.avoidProfiles) ? briefParsed.avoidProfiles : [],
        aiRole: briefParsed.aiRole || null,
      });
      logger.info("persona-brief-regenerate", "Zregenerowano brief strategiczny z rozmowy", { personaId });
    }
  } catch (error) {
    logger.error("persona-brief-regenerate", "Błąd regeneracji briefu z rozmowy", { personaId }, error as Error);
    // Nie rzucamy błędu - regeneracja briefu nie jest krytyczna
  }
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

/**
 * Sprawdza czy AI przedstawiło podsumowanie w wymaganym formacie
 */
function hasSummaryFormat(text: string): boolean {
  const normalized = text.toLowerCase();
  
  // Sprawdź nagłówek
  const hasHeader = (
    (normalized.includes("## podsumowanie") && normalized.includes("proszę potwierdź")) ||
    normalized.includes("podsumowanie - proszę potwierdź") ||
    (normalized.includes("podsumowanie") && normalized.includes("proszę potwierdź") && 
     (normalized.includes("##") || normalized.includes("###")))
  );

  // Sprawdź wszystkie wymagane sekcje
  const hasSections = (
    (normalized.includes("kontekst biznesowy") || normalized.includes("produkt/usługa") || normalized.includes("produkt:") || normalized.includes("odbiorcy:")) &&
    normalized.includes("seniority") &&
    (normalized.includes("pozytywne persony") || normalized.includes("pozytywne:")) &&
    (normalized.includes("negatywne persony") || normalized.includes("negatywne:")) &&
    (normalized.includes("brief strategiczny") || normalized.includes("brief"))
  );

  // Sprawdź pytanie o potwierdzenie
  const hasQuestion = (
    normalized.includes("czy powyższe") ||
    normalized.includes("czy chcesz coś zmienić") ||
    normalized.includes("przed wygenerowaniem") ||
    normalized.includes("czy powyższe podsumowanie") ||
    normalized.includes("czy powyższe jest poprawne") ||
    normalized.includes("czy chcesz coś dodać")
  );

  return hasHeader && hasSections && hasQuestion;
}

/**
 * Sprawdza czy użytkownik potwierdził podsumowanie lub że nie chce nic dodać
 */
function isUserConfirmation(message: string): boolean {
  const userMsg = message.toLowerCase().trim();
  
  return (
    userMsg === "ok" || userMsg === "ok." || userMsg === "ok," ||
    userMsg.includes("zgadza się") ||
    userMsg.includes("poprawnie") ||
    userMsg.includes("wygeneruj") ||
    userMsg.includes("generuj") ||
    userMsg.includes("wszystko ok") ||
    userMsg.includes("nie mam nic") ||
    userMsg.includes("nie chcę nic") ||
    userMsg.includes("nie chce nic") ||
    userMsg.includes("nie ma nic") ||
    (userMsg === "nie" && userMsg.length <= 5) || // "nie" samo w sobie (krótkie)
    (userMsg.includes("tak") && (userMsg.includes("poprawne") || userMsg.includes("zgadza") || userMsg.includes("ok")))
  );
}

/**
 * Sprawdza czy AI powiedział że ma już wszystkie informacje
 */
function aiHasAllInfo(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("mam już wszystkie") ||
    normalized.includes("mam wszystkie potrzebne") ||
    normalized.includes("mam już wszystkie potrzebne") ||
    (normalized.includes("wszystkie informacje") && normalized.includes("mam")) ||
    (normalized.includes("mam już") && normalized.includes("informacje") && normalized.includes("wszystkie"))
  );
}

/**
 * Sprawdza czy AI zapytało o generowanie person
 */
function aiAsksToGenerate(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("czy generujemy") ||
    normalized.includes("czy wygenerować") ||
    normalized.includes("czy wygenerujmy") ||
    normalized.includes("generujemy teraz") ||
    (normalized.includes("generować") && normalized.includes("persony")) ||
    (normalized.includes("generuj") && normalized.includes("persony"))
  );
}

/**
 * Sprawdza czy system jest gotowy do generowania person
 * Sprawdza ostatnią odpowiedź AI oraz historię (jeśli ostatnia nie zawiera podsumowania)
 */
function detectReadyToGenerate(
  lastAiResponse: string,
  lastUserMessage: string,
  chatHistory?: ChatCompletionMessageParam[]
): boolean {
  // Sprawdź ostatnią odpowiedź AI
  let summaryFound = hasSummaryFormat(lastAiResponse);
  let aiHasAllInfoFound = aiHasAllInfo(lastAiResponse);
  let aiAskedToGenerate = aiAsksToGenerate(lastAiResponse);

  // Jeśli nie ma w ostatniej odpowiedzi, sprawdź historię (od końca)
  if (!summaryFound && !aiAskedToGenerate && chatHistory) {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg.role === "assistant" && msg.content) {
        const content = typeof msg.content === "string" ? msg.content : "";
        if (content && hasSummaryFormat(content)) {
          summaryFound = true;
          break;
        }
        if (content && aiHasAllInfo(content)) {
          aiHasAllInfoFound = true;
        }
        if (content && aiAsksToGenerate(content)) {
          aiAskedToGenerate = true;
          break;
        }
      }
    }
  }

  // Jeśli AI zapytało o generowanie, sprawdź czy użytkownik potwierdził
  if (aiAskedToGenerate && lastUserMessage) {
    const userMsg = lastUserMessage.toLowerCase().trim();
    return (
      userMsg.includes("tak") ||
      userMsg === "ok" || userMsg === "ok." || userMsg === "ok," ||
      userMsg.includes("generuj") ||
      userMsg.includes("wygeneruj") ||
      userMsg.includes("zgadza się") ||
      userMsg.includes("poprawnie")
    );
  }

  // Jeśli AI powiedział że ma wszystkie informacje, sprawdź czy użytkownik potwierdził że nie chce nic dodać
  if (aiHasAllInfoFound && lastUserMessage) {
    const userMsg = lastUserMessage.toLowerCase().trim();
    // Jeśli użytkownik potwierdził że nie chce nic dodać
    if (
      userMsg.includes("nie") && (userMsg.includes("dodać") || userMsg.includes("zmienić") || userMsg.includes("nic")) ||
      userMsg.includes("wszystko ok") ||
      userMsg === "nie" ||
      userMsg.includes("nie mam nic") ||
      userMsg.includes("nie chcę nic")
    ) {
      // AI powinno teraz pokazać podsumowanie - sprawdź czy już je pokazało
      if (summaryFound) {
        return isUserConfirmation(lastUserMessage);
      }
      // Jeśli jeszcze nie pokazało podsumowania, zwróć false (AI powinno je pokazać)
      return false;
    }
  }

  // Jeśli nie znaleziono podsumowania, zwróć false
  if (!summaryFound) {
    return false;
  }

  // Sprawdź czy użytkownik potwierdził
  return isUserConfirmation(lastUserMessage);
}

/**
 * Rozpoczyna rozmowę - AI zadaje pierwsze pytanie
 */
export async function GET(
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

    // Sprawdź czy historia jest pusta - jeśli nie, nie rozpoczynaj ponownie
    const chatHistory = normalizeHistory(existing?.chatHistory ?? []);
    if (chatHistory.length > 0) {
      return NextResponse.json({
        success: true,
        response: null,
        chatHistory,
        shouldGenerate: false,
        data: existing,
      });
    }

    // Pobierz companyCriteria jeśli istnieje (dla kontekstu)
    let baseCriteria = null;
    if (existing.companyCriteriaId) {
      baseCriteria = await db.companyVerificationCriteria.findUnique({ 
        where: { id: existing.companyCriteriaId } 
      });
    }

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Sprawdź, czy istnieje brief z ustawioną rolą AI
    const brief = await db.personaBrief.findUnique({ where: { companyCriteriaId: personaId } });
    const hasAiRole = Boolean(brief?.aiRole && brief.aiRole.trim().length > 0);

    const systemPrompt = buildSystemPrompt(existing, baseCriteria, hasAiRole, brief);

    // Rozpocznij rozmowę - AI zadaje pierwsze pytanie
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Rozpocznij rozmowę. Zadaj pierwsze pytanie, aby poznać kontekst biznesowy." },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    if (completion.usage) {
      await trackTokenUsage({
        operation: "persona_criteria_chat_start",
        model: "gpt-4o",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        metadata: { personaId },
      });
    }

    const aiResponse = completion.choices[0]?.message?.content ?? "";
    const newChatHistory: ChatCompletionMessageParam[] = [
      { role: "assistant", content: aiResponse }
    ];

    // Zapisz rozpoczęcie rozmowy
    const payload = buildPayload(personaId, existing, {
      name: existing.name,
      description: existing.description,
      chatHistory: newChatHistory,
      lastUserMessage: undefined,
      lastAIResponse: aiResponse,
      updatedBy: "persona-agent",
    });

    const saved = await upsertPersonaCriteriaById(personaId, payload);

    logger.info("persona-criteria-chat", "Rozpoczęto rozmowę - AI zadało pierwsze pytanie", { personaId });

    return NextResponse.json({
      success: true,
      response: aiResponse,
      chatHistory: newChatHistory,
      shouldGenerate: false,
      data: saved,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria-chat", "Błąd rozpoczynania rozmowy", { personaId }, err);
    return NextResponse.json(
      { success: false, error: "Błąd rozpoczynania rozmowy", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * Buduje system prompt dla chatu
 */
function buildSystemPrompt(
  existing: PersonaCriteriaDto,
  baseCriteria: any,
  hasAiRole: boolean,
  brief: any
): string {
  const existingPositiveRoles = (existing.positiveRoles ?? []).map((r: any) => 
    `- ${r.label}${r.keywords?.length ? ` (słowa kluczowe: ${r.keywords.join(", ")})` : ""}${r.departments?.length ? ` [działy: ${r.departments.join(", ")}]` : ""}`
  ).join("\n");
  const existingNegativeRoles = (existing.negativeRoles ?? []).map((r: any) => 
    `- ${r.label}${r.keywords?.length ? ` (słowa kluczowe: ${r.keywords.join(", ")})` : ""}${r.departments?.length ? ` [działy: ${r.departments.join(", ")}]` : ""}`
  ).join("\n");

  return `Jesteś ekspertem ds. prospectingu B2B. Twoim zadaniem jest pomóc zdefiniować persony (stanowiska) do kontaktu handlowego dla kampanii cold mailingowych.

🎯 TWOJA ROLA:
Prowadzisz naturalną, przyjazną rozmowę z użytkownikiem, aby zebrać wszystkie potrzebne informacje do stworzenia skutecznego briefu strategicznego i listy person.

📋 STRUKTURA ROZMOWY (prowadź rozmowę naturalnie, pytania mogą być elastyczne):

FAZA 1: KONTEKST BIZNESOWY (zadawaj pytania jedno po drugim, czekając na odpowiedzi)
1. Produkt/Usługa:
   - "Czym się zajmujesz? Jaki produkt lub usługę oferujesz?"
   - "Opisz krótko swój produkt/usługę - co dokładnie oferujesz?"
   
2. Odbiorcy:
   - "Do jakich firm kierujesz swoją ofertę?"
   - "Jaki jest profil Twoich idealnych klientów? (branża, wielkość firmy, lokalizacja)"
   
3. Logika decyzyjna:
   - "Kto w tych firmach podejmuje decyzje zakupowe?"
   - "Jakie stanowiska mają wpływ na wybór Twojego produktu/usługi?"
   - "Jaki jest proces decyzyjny w firmach docelowych?"
   
4. Przykłady pozytywnych stanowisk:
   - "Podaj przykłady stanowisk, które ZAWSZE powinny być pozytywne (np. Project Manager, CEO, Sales Manager)"
   - "Jakie role są kluczowe dla Twojej kampanii?"
   
5. Stanowiska do unikania:
   - "Jakie stanowiska lub działy powinniśmy unikać?"
   - "Kogo NIE powinniśmy kontaktować?"

FAZA 2: SZCZEGÓŁY (zadawaj po zebraniu kontekstu biznesowego)
6. Seniority:
   - "Czy poziom seniority (junior/mid/senior) jest dla Ciebie ważny przy wyborze person?"
   - Jeśli użytkownik wspomniał wcześniej, POTWIERDŹ: "Rozumiem, że seniority jest [ważne/nieistotne] - czy to się zgadza?"
   
7. Rola AI:
   - "W jakiej roli mam się wcielić podczas weryfikacji person? (np. ekspert od stoisk targowych, analityk sprzedażowy B2B, specjalista od produktu X)"
   - Jeśli użytkownik nie poda, zaproponuj rolę na podstawie kontekstu

FAZA 3: ZAKOŃCZENIE (gdy masz wszystkie informacje)
8. Sprawdź kompletność (ZAWSZE przed zakończeniem):
   - Przeanalizuj czy masz WSZYSTKIE potrzebne informacje:
     ✓ Produkt/usługa (szczegółowy opis - co dokładnie oferujesz, jakie problemy rozwiązujesz)
     ✓ Odbiorcy (profil firm docelowych - branża, wielkość, lokalizacja)
     ✓ Logika decyzyjna (kto podejmuje decyzje, jaki proces, jakie stanowiska mają wpływ)
     ✓ Przykłady pozytywnych stanowisk (konkretne role, które ZAWSZE powinny być pozytywne)
     ✓ Stanowiska do unikania (kogo NIE kontaktować)
     ✓ Seniority (czy poziom seniority jest ważny - TAK/NIE)
     ✓ Rola AI (w jakiej roli ma weryfikować persony - np. ekspert od X)
   
   - WAŻNE: Nie kończ rozmowy, jeśli brakuje któregokolwiek z powyższych elementów!
   - Jeśli brakuje informacji, zadaj pytania uzupełniające

9. Gdy masz WSZYSTKIE informacje (wszystkie 7 punktów powyżej):
   - Powiedz dokładnie: "Mam już wszystkie potrzebne informacje. Czy chcesz coś dodać lub zmienić?"
   - CZEKAJ na odpowiedź użytkownika
   - Jeśli użytkownik mówi "nie", "wszystko ok", "nie mam nic do dodania", "nie chcę nic dodać" → przejdź do punktu 10 (podsumowanie)
   - Jeśli użytkownik chce coś dodać/zmienić → zadaj dodatkowe pytania i wróć do punktu 8

10. Przedstaw podsumowanie (TYLKO gdy użytkownik potwierdził że nie chce nic dodać):
   - MUSISZ przedstawić podsumowanie w DOKŁADNIE takim formacie:
   
   ## PODSUMOWANIE - PROSZĘ POTWIERDŹ
   
   **KONTEKST BIZNESOWY:**
   [Szczegółowy opis produktu/usługi, odbiorców, logiki decyzyjnej - użyj informacji z rozmowy]
   
   **SENIORITY:**
   [Czy seniority jest ważne? Jeśli nie, napisz "Seniority nie jest ważne"]
   
   **POZYTYWNE PERSONY:**
   [Lista WSZYSTKICH stanowisk, które ZAWSZE powinny być pozytywne - użyj przykładów z rozmowy]
   
   **NEGATYWNE PERSONY:**
   [Lista WSZYSTKICH stanowisk/działów do unikania - użyj przykładów z rozmowy]
   
   **BRIEF STRATEGICZNY:**
   [Krótkie podsumowanie strategii weryfikacji - jak AI ma oceniać persony]
   
   Czy powyższe podsumowanie jest poprawne? Czy chcesz coś zmienić przed wygenerowaniem person?

11. Po potwierdzeniu przez użytkownika:
   - Jeśli użytkownik potwierdzi (np. "tak", "zgadza się", "ok", "poprawne"), MUSISZ zapytać: "Świetnie! Czy generujemy teraz persony?"
   - CZEKAJ na odpowiedź użytkownika
   - Jeśli użytkownik odpowie "tak", "ok", "generuj", "wygeneruj" → możesz zakończyć rozmowę potwierdzeniem (np. "Doskonale! Generowanie person zostanie uruchomione.")
   - Jeśli użytkownik chce coś zmienić, zadaj pytania o szczegóły zmian

ZASADY KONWERSACJI:
- Prowadź rozmowę naturalnie i przyjaźnie
- Zadawaj pytania jedno po drugim, czekając na odpowiedzi
- Dostosowuj pytania do kontekstu - jeśli użytkownik wspomniał o czymś wcześniej, nie pytaj ponownie
- Jeśli użytkownik podaje niepełne informacje, zadaj pytania uzupełniające
- Bądź konkretny - zadawaj pytania, które pomogą stworzyć dobry brief
- Nie zadawaj wszystkich pytań naraz - prowadź rozmowę krok po kroku
- Gdy masz wszystkie informacje, jasno to zakomunikuj

Kontekst kampanii (jeśli dostępny):
Nazwa kryteriów firmowych: ${baseCriteria?.name ?? "brak"}
Opis: ${baseCriteria?.description ?? "brak"}
Nazwa person: ${existing.name}
Opis person: ${existing.description ?? "brak"}
${hasAiRole ? `Ustawiona rola AI: ${brief.aiRole}` : "Rola AI: (nie ustalona - zapytaj użytkownika)"}

${existingPositiveRoles ? `Aktualne pozytywne persony:\n${existingPositiveRoles}\n` : ""}
${existingNegativeRoles ? `Aktualne negatywne persony:\n${existingNegativeRoles}\n` : ""}
${!existingPositiveRoles && !existingNegativeRoles ? "Uwaga: To jest nowa konfiguracja - nie ma jeszcze zdefiniowanych person.\n" : ""}`;
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
    const hasAiRole = Boolean(brief?.aiRole && brief.aiRole.trim().length > 0);

    const systemPrompt = buildSystemPrompt(existing, baseCriteria, hasAiRole, brief);

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

    // Sprawdź gotowość do generowania (uproszczona logika)
    const shouldGenerate = detectReadyToGenerate(aiResponse, message, chatHistory);
    
    logger.info("persona-criteria-chat", "shouldGenerate check", {
      shouldGenerate,
      aiResponseLength: aiResponse.length,
      userMessagePreview: message.substring(0, 100),
    });

    logger.info("persona-criteria-chat", "Zapisano wiadomość w czacie person", { personaId });

    return NextResponse.json({
      success: true,
      response: aiResponse,
      chatHistory,
      shouldGenerate,
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

    let parsed: PersonaCriteriaPayload;
    try {
      parsed = JSON.parse(clean);
    } catch (parseError) {
      logger.error("persona-criteria-generate", "Błąd parsowania JSON person", { personaId }, parseError as Error);
      logger.error("persona-criteria-generate", "Zawartość odpowiedzi", { personaId, content: clean.substring(0, 500) });
      return NextResponse.json(
        { success: false, error: "Błąd parsowania odpowiedzi AI. Spróbuj ponownie." },
        { status: 500 }
      );
    }

    // Walidacja danych
    if (!parsed || typeof parsed !== "object") {
      logger.error("persona-criteria-generate", "Odpowiedź AI nie jest obiektem", { personaId });
      return NextResponse.json(
        { success: false, error: "Nieprawidłowy format odpowiedzi AI." },
        { status: 500 }
      );
    }

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

    // Sprawdź czy brief już istnieje (przed generowaniem nowego)
    const { getPersonaBrief } = await import("@/services/personaBriefService");
    const existingBrief = await getPersonaBrief(personaId);

    // Regeneruj prompt i brief po zakończeniu rozmowy/generowaniu person
    try {
      // Zawsze regeneruj prompt (bo konfiguracja person mogła się zmienić)
      await regeneratePromptForPersonaCriteria(personaId);
      
      // Jeśli brief już istnieje, zregeneruj go na podstawie aktualnej rozmowy
      if (existingBrief && existingBrief.summary) {
        await regenerateBriefFromConversation(personaId, history, saved, openai);
      }
    } catch (promptError) {
      // Nie przerywamy procesu jeśli regeneracja promptu się nie powiodła
      logger.error("persona-criteria-chat", "Błąd regeneracji promptu/briefu", { personaId }, promptError as Error);
    }

    // Automatycznie wygeneruj brief strategiczny na podstawie rozmowy (tylko jeśli nie istnieje)
    if (!existingBrief || !existingBrief.summary) {
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

      let briefParsed: {
        summary?: string;
        decisionGuidelines?: string[];
        targetProfiles?: string[];
        avoidProfiles?: string[];
        aiRole?: string;
      } | undefined;

      try {
        briefParsed = JSON.parse(briefClean);
      } catch (parseError) {
        logger.error("persona-brief-generate", "Błąd parsowania JSON briefu", { personaId }, parseError as Error);
        logger.error("persona-brief-generate", "Zawartość briefu", { personaId, content: briefClean.substring(0, 500) });
        // Nie przerywamy procesu - brief nie jest krytyczny
        briefParsed = undefined;
      }

      // Walidacja i zapis briefu
      if (briefParsed && typeof briefParsed === "object" && briefParsed !== null) {
      if (briefParsed.summary || briefParsed.decisionGuidelines?.length || briefParsed.targetProfiles?.length || briefParsed.avoidProfiles?.length || briefParsed.aiRole) {
        await upsertPersonaBrief(personaId, {
          summary: briefParsed.summary || "",
            decisionGuidelines: Array.isArray(briefParsed.decisionGuidelines) ? briefParsed.decisionGuidelines : [],
            targetProfiles: Array.isArray(briefParsed.targetProfiles) ? briefParsed.targetProfiles : [],
            avoidProfiles: Array.isArray(briefParsed.avoidProfiles) ? briefParsed.avoidProfiles : [],
          aiRole: briefParsed.aiRole || null,
        });
        logger.info("persona-brief-generate", "Wygenerowano brief strategiczny z rozmowy", { personaId });
        }
      }
    } catch (briefError) {
      // Nie przerywamy procesu jeśli generowanie briefu się nie powiodło
      logger.error("persona-brief-generate", "Błąd generowania briefu z rozmowy", { personaId }, briefError as Error);
    }
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

