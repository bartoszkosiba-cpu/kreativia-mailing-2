import { NextRequest, NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { db } from "@/lib/db";
import { trackTokenUsage } from "@/services/tokenTracker";
import { logger } from "@/services/logger";
import { upsertCompanyVerificationBrief, getCompanyVerificationBrief } from "@/services/companyVerificationBriefService";

type AllowedRole = "system" | "user" | "assistant";

// Wspólny system prompt dla agenta - używany w GET i POST
const AGENT_SYSTEM_PROMPT = `Jesteś ekspertem od tworzenia kryteriów weryfikacji firm dla systemu prospectingu. Twoim zadaniem jest pomóc użytkownikowi określić, jakie firmy są odpowiednie do poszukiwania w nich leadów (pracowników).

ZACHOWANIE:
- Bądź zwięzły i bezpośredni - NIE używaj uprzejmości typu "Dziękuję za informację", "Chciałbym", "Pomogę Ci" - one zabierają czas i przestrzeń
- ZAWSZE zadawaj tylko JEDNO pytanie na raz - nie zadawaj wielu pytań jednocześnie
- Zaczynaj od najważniejszych pytań (np. co to za produkt/usługa, do jakich firm jest kierowany)
- Czekaj na odpowiedź użytkownika przed zadaniem kolejnego pytania
- Gdy masz wystarczające informacje, zaproponuj gotowe kryteria
- Słuchaj uważnie - jeśli użytkownik mówi, że coś nie ma znaczenia lub wyklucza jakieś kategorie, nie pytaj o to ponownie
- Jeśli użytkownik wyraźnie mówi "działaj", "mam wszystko", "to wszystko" - to sygnał, że ma wszystkie potrzebne informacje i chce, żebyś zaproponował kryteria
- Jeśli użytkownik prosi Cię o zadanie pytań (np. "zadaj mi pytania"), zadaj JEDNO najważniejsze pytanie i poczekaj na odpowiedź

WAŻNE - LICZBA PRACOWNIKÓW:
- Jeśli liczba pracowników może mieć znaczenie dla kryteriów (np. szukamy małych/średnich firm), zapytaj o to
- Jeśli z kontekstu rozmowy wynika, że liczba pracowników nie ma znaczenia (np. użytkownik mówi "nie ma znaczenia" lub "wszystkie firmy"), nie pytaj o to
- Pamiętaj: w bazie danych brak informacji o liczbie pracowników (0 lub null) NIE oznacza, że firma nie ma pracowników - oznacza tylko brak danych. W takim przypadku firma powinna być traktowana jako pozytywna w kontekście liczby pracowników (brak danych nie może dyskwalifikować)

KRYTERIA WERYFIKACJI powinny zawierać:
- Co TAK: jakie firmy są kwalifikowane (szczegółowy opis)
- Co NIE: jakie firmy są odrzucane (szczegółowy opis)
- Progi pewności: qualifiedThreshold (domyślnie 0.8), rejectedThreshold (domyślnie 0.3)

FORMAT ODPOWIEDZI:
Gdy masz wystarczające informacje, zaproponuj kryteria w formacie:

KRYTERIA WERYFIKACJI:

Co TAK: [szczegółowy opis firm kwalifikowanych]

Co NIE: [szczegółowy opis firm odrzucanych]

PROGI PEWNOŚCI:
- Kwalifikacja: >= 0.8
- Odrzucenie: <= 0.3

Bądź elastyczny - czasem wystarczy podstawowa informacja, czasem potrzebujesz więcej szczegółów. Decyduj sam, czy masz wystarczające informacje, czy warto zadać jeszcze pytania.`;

function normalizeHistory(history: unknown): ChatCompletionMessageParam[] {
  if (!history) return [];
  
  try {
    const parsed = typeof history === "string" ? JSON.parse(history) : history;
    if (!Array.isArray(parsed)) return [];
    
    const allowedRoles: AllowedRole[] = ["system", "user", "assistant"];
    
    return parsed.reduce<ChatCompletionMessageParam[]>((acc, item) => {
      if (!item || typeof item !== "object") return acc;
      
      const role = (item as any).role;
      const content = (item as any).content;
      
      if (typeof role !== "string" || typeof content !== "string") return acc;
      if (!allowedRoles.includes(role as AllowedRole)) return acc;
      
      acc.push({ role: role as AllowedRole, content });
      return acc;
    }, []);
  } catch (e) {
    return [];
  }
}

/**
 * Rozpocznij rozmowę - GET /api/company-selection/criteria/chat?criteriaId=X
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const criteriaIdParam = searchParams.get("criteriaId");
    
    if (!criteriaIdParam) {
      return NextResponse.json(
        { success: false, error: "ID kryteriów jest wymagane" },
        { status: 400 }
      );
    }
    
    const criteriaId = parseInt(criteriaIdParam, 10);
    if (Number.isNaN(criteriaId)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe ID kryteriów" },
        { status: 400 }
      );
    }
    
    const criteria = await db.companyVerificationCriteria.findUnique({
      where: { id: criteriaId },
    });
    
    if (!criteria) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono kryteriów" },
        { status: 404 }
      );
    }
    
    // Sprawdź czy historia jest pusta - jeśli nie, zwróć istniejącą historię
    const chatHistory = normalizeHistory(criteria.chatHistory);
    if (chatHistory.length > 0) {
      return NextResponse.json({
        success: true,
        response: null,
        chatHistory,
        shouldGenerateCriteria: false,
        criteria,
      });
    }
    
    // Rozpocznij nową rozmowę - AI zadaje pierwsze pytanie
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: "Przywitaj się i zadaj pierwsze pytanie, które pomoże mi określić, jakie firmy są odpowiednie do poszukiwania w nich leadów.",
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const aiResponse = completion.choices[0]?.message?.content || "";
    
    // Track token usage
    if (completion.usage) {
      await trackTokenUsage({
        operation: "company_criteria_chat_start",
        model: "gpt-4o",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        metadata: { criteriaId },
      });
    }
    
    // Zapisz pierwszą wiadomość do historii
    const initialHistory: ChatCompletionMessageParam[] = [
      { role: "assistant", content: aiResponse },
    ];
    
    await db.companyVerificationCriteria.update({
      where: { id: criteriaId },
      data: {
        chatHistory: JSON.stringify(initialHistory),
        lastAIResponse: aiResponse,
      },
    });
    
    logger.info("company-criteria-chat", `Rozpoczęto rozmowę (criteriaId: ${criteriaId})`);
    
    return NextResponse.json({
      success: true,
      response: aiResponse,
      chatHistory: initialHistory,
      shouldGenerateCriteria: false,
      criteria,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-criteria-chat", "Błąd rozpoczynania rozmowy", null, errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd rozpoczynania rozmowy", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Czat z agentem do określania kryteriów weryfikacji
 * POST /api/company-selection/criteria/chat
 */
export async function POST(req: NextRequest) {
  try {
    const { message, criteriaId } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Wiadomość jest wymagana" },
        { status: 400 }
      );
    }

    // Pobierz istniejącą konfigurację - wymagamy criteriaId
    if (!criteriaId) {
      return NextResponse.json(
        { error: "ID kryteriów jest wymagane. Najpierw utwórz kryteria lub wybierz istniejące." },
        { status: 400 }
      );
    }

    const criteria = await db.companyVerificationCriteria.findUnique({
      where: { id: criteriaId },
    });

    if (!criteria) {
      return NextResponse.json(
        { error: "Nie znaleziono kryteriów o podanym ID" },
        { status: 404 }
      );
    }

    // Przygotuj historię rozmowy
    const chatHistory = normalizeHistory(criteria.chatHistory);

    // Dodaj wiadomość użytkownika
    chatHistory.push({ role: "user", content: message });

    // Wywołaj AI
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        ...chatHistory,
      ],
      temperature: 0.7, // Zwiększona temperatura dla bardziej naturalnych odpowiedzi
      max_tokens: 1500, // Zwiększone dla dłuższych odpowiedzi z kryteriami
    });

    // Track token usage
    if (response.usage) {
      await trackTokenUsage({
        operation: "company_criteria_chat",
        model: "gpt-4o",
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        metadata: { criteriaId: criteria?.id || "new" },
      });
    }

    const aiResponse = response.choices[0].message.content || "";

    // Dodaj odpowiedź AI do historii
    chatHistory.push({ role: "assistant", content: aiResponse });

    // Zaktualizuj konfigurację
    const updatedCriteria = await db.companyVerificationCriteria.update({
      where: { id: criteria.id },
      data: {
        chatHistory: JSON.stringify(chatHistory),
        lastUserMessage: message,
        lastAIResponse: aiResponse,
      },
    });

    // Sprawdź, czy odpowiedź zawiera gotowe kryteria (sygnał, że agent zakończył)
    const hasCriteria = aiResponse.includes("KRYTERIA WERYFIKACJI") || 
                        aiResponse.includes("Co TAK:") || 
                        aiResponse.includes("PROGI PEWNOŚCI");

    logger.info("company-criteria-chat", `Wysłano wiadomość do agenta (criteriaId: ${updatedCriteria.id})`);
    return NextResponse.json({
      success: true,
      response: aiResponse,
      criteriaId: updatedCriteria.id,
      chatHistory,
      shouldGenerateCriteria: hasCriteria, // Sugeruj wygenerowanie, jeśli agent zaproponował kryteria
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-criteria-chat", "Błąd czatu z agentem", null, errorObj);
    return NextResponse.json(
      { error: "Błąd czatu z agentem", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Wygeneruj finalne kryteria na podstawie historii czatu
 * POST /api/company-selection/criteria/generate
 */
export async function PUT(req: NextRequest) {
  try {
    const { criteriaId } = await req.json();

    if (!criteriaId) {
      return NextResponse.json(
        { error: "ID konfiguracji jest wymagane" },
        { status: 400 }
      );
    }

    const criteria = await db.companyVerificationCriteria.findUnique({
      where: { id: criteriaId },
    });

    if (!criteria) {
      return NextResponse.json(
        { error: "Konfiguracja nie została znaleziona" },
        { status: 404 }
      );
    }

    // Loguj nazwę przed generowaniem - dla debugowania
    logger.info("company-criteria-generate", `Generowanie kryteriów dla ID ${criteriaId}, zachowuję nazwę użytkownika: "${criteria.name}"`);

    // Wygeneruj finalne kryteria na podstawie historii czatu
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const chatHistory = normalizeHistory(criteria.chatHistory);

    // KROK 1: Najpierw wygeneruj brief strategiczny (jeśli nie istnieje)
    let brief = await getCompanyVerificationBrief(criteriaId);
    
    if (!brief || !brief.summary) {
      try {
        const briefPrompt = `Na podstawie historii rozmowy z użytkownikiem przygotuj brief strategiczny dla weryfikacji firm. Odpowiedz TYLKO w JSON:
{
  "summary": "SZCZEGÓŁOWE podsumowanie kontekstu biznesowego - MUSISZ uwzględnić: 1) Co to za produkt/usługa (dokładny opis), 2) Do jakich firm jest kierowany (profil odbiorców), 3) Dlaczego te firmy są odpowiednie (logika biznesowa), 4) Jaki jest cel kampanii. To jest KLUCZOWE dla poprawnej weryfikacji firm przez AI.",
  "decisionGuidelines": ["Wskazówka 1 - jak oceniać firmy", "Wskazówka 2 - co brać pod uwagę"],
  "targetCompanies": ["Przykłady firm kwalifikowanych - typy firm, branże"],
  "avoidCompanies": ["Przykłady firm odrzucanych - typy firm, branże"],
  "aiRole": "Rola AI podczas weryfikacji (np. ekspert od weryfikacji firm B2B, analityk rynku)"
}

Historia rozmowy:
${JSON.stringify(chatHistory, null, 2)}`;

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
            operation: "company_criteria_brief_generate",
            model: "gpt-4o",
            promptTokens: briefCompletion.usage.prompt_tokens,
            completionTokens: briefCompletion.usage.completion_tokens,
            metadata: { criteriaId },
          });
        }

        let briefContent = briefCompletion.choices[0]?.message?.content ?? "";
        let briefClean = briefContent.trim();

        if (briefClean.startsWith("```json")) {
          briefClean = briefClean.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
        } else if (briefClean.startsWith("```")) {
          briefClean = briefClean.replace(/^```\s*/, "").replace(/```\s*$/, "");
        }

        let briefParsed: {
          summary?: string;
          decisionGuidelines?: string[];
          targetCompanies?: string[];
          avoidCompanies?: string[];
          aiRole?: string;
        } | undefined;

        try {
          briefParsed = JSON.parse(briefClean);
        } catch (parseError) {
          logger.error("company-criteria-brief-generate", "Błąd parsowania JSON briefu", { criteriaId }, parseError as Error);
          logger.error("company-criteria-brief-generate", "Zawartość briefu", { criteriaId, content: briefClean.substring(0, 500) });
          briefParsed = undefined;
        }

        // Zapisz brief jeśli został poprawnie sparsowany
        if (briefParsed && typeof briefParsed === "object" && briefParsed !== null) {
          if (briefParsed.summary || briefParsed.decisionGuidelines?.length || briefParsed.targetCompanies?.length || briefParsed.avoidCompanies?.length || briefParsed.aiRole) {
            await upsertCompanyVerificationBrief(criteriaId, {
              summary: briefParsed.summary || "",
              decisionGuidelines: Array.isArray(briefParsed.decisionGuidelines) ? briefParsed.decisionGuidelines : [],
              targetCompanies: Array.isArray(briefParsed.targetCompanies) ? briefParsed.targetCompanies : [],
              avoidCompanies: Array.isArray(briefParsed.avoidCompanies) ? briefParsed.avoidCompanies : [],
              aiRole: briefParsed.aiRole || null,
            });
            logger.info("company-criteria-brief-generate", "Wygenerowano brief strategiczny z rozmowy", { criteriaId });
          }
        }
      } catch (briefError) {
        // Nie przerywamy procesu jeśli generowanie briefu się nie powiodło
        logger.error("company-criteria-brief-generate", "Błąd generowania briefu z rozmowy", { criteriaId }, briefError as Error);
      }
      
      // Pobierz brief po wygenerowaniu (jeśli się udało)
      if (!brief || !brief.summary) {
        brief = await getCompanyVerificationBrief(criteriaId);
      }
    }

    // KROK 3: Wygeneruj criteriaText na podstawie briefu (PRIORYTET 1) + rozmowy (PRIORYTET 2)
    let criteriaPrompt = `Na podstawie poniższej rozmowy i briefu strategicznego, wygeneruj finalne kryteria weryfikacji firm w formacie JSON.

`;

    if (brief) {
      criteriaPrompt += `[BRIEF STRATEGICZNY - PRIORYTET 1]
Podsumowanie: ${brief.summary}
Wskazówki decyzyjne: ${brief.decisionGuidelines.join(", ")}
Przykłady firm kwalifikowanych: ${brief.targetCompanies.join(", ")}
Przykłady firm odrzucanych: ${brief.avoidCompanies.join(", ")}
Rola AI: ${brief.aiRole || "brak"}

`;
    }

    criteriaPrompt += `[ROZMOWA - PRIORYTET 2]
${JSON.stringify(chatHistory, null, 2)}

Odpowiedz TYLKO w formacie JSON:
{
  "criteriaText": "Szczegółowy tekst kryteriów dla AI (co TAK, co NIE) - MUSISZ uwzględnić kontekst z briefu strategicznego",
  "qualifiedKeywords": ["słowo1", "słowo2"],
  "rejectedKeywords": ["słowo1", "słowo2"],
  "qualifiedThreshold": 0.8,
  "rejectedThreshold": 0.3,
  "description": "Krótki opis"
}

UWAGA: Nie generuj pola "name" - nazwa jest już ustawiona przez użytkownika i nie będzie zmieniana.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Jesteś ekspertem od tworzenia kryteriów weryfikacji. Odpowiadasz TYLKO w formacie JSON.",
        },
        { role: "user", content: criteriaPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    // Track token usage
    if (response.usage) {
      await trackTokenUsage({
        operation: "company_criteria_generate",
        model: "gpt-4o",
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        metadata: { criteriaId },
      });
    }

    const content = response.choices[0].message.content || "";
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```json")) {
      cleanContent = cleanContent.replace(/^```json\s*/, "").replace(/```\s*$/, "");
    } else if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }

    const generatedCriteria = JSON.parse(cleanContent);

    // Usuń pole "name" z generatedCriteria jeśli istnieje - nie chcemy go używać
    // Nazwa jest zawsze zachowywana z criteria.name (podana przez użytkownika)
    if (generatedCriteria.name) {
      logger.warn("company-criteria-generate", `AI wygenerowało nazwę "${generatedCriteria.name}", ale ignorujemy ją i zachowujemy nazwę użytkownika: "${criteria.name}"`);
      delete generatedCriteria.name;
    }

    // Usuń flagę isDefault z innych kryteriów (optymalizacja: użyj updateMany zamiast pętli)
    await db.companyVerificationCriteria.updateMany({
      where: {
        isDefault: true,
        id: { not: criteriaId },
      },
      data: { isDefault: false },
    });

    // Zaktualizuj konfigurację i ustaw jako aktywną i domyślną
    // WAŻNE: Zachowaj nazwę podaną przez użytkownika, tylko opis może być generowany
    const updated = await db.companyVerificationCriteria.update({
      where: { id: criteriaId },
      data: {
        name: criteria.name, // ZAWSZE zachowaj nazwę podaną przez użytkownika
        description: generatedCriteria.description || criteria.description, // Opis może być generowany z chatu
        criteriaText: generatedCriteria.criteriaText,
        qualifiedKeywords: JSON.stringify(generatedCriteria.qualifiedKeywords || []),
        rejectedKeywords: JSON.stringify(generatedCriteria.rejectedKeywords || []),
        qualifiedThreshold: generatedCriteria.qualifiedThreshold || 0.8,
        rejectedThreshold: generatedCriteria.rejectedThreshold || 0.3,
        isActive: true,
        isDefault: true,
      },
    });
    
    logger.info("company-criteria-generate", `Zapisano kryteria z nazwą: "${updated.name}" (ID: ${updated.id})`);

    logger.info("company-criteria-chat", `Wygenerowano finalne kryteria (criteriaId: ${updated.id})`);
    return NextResponse.json({
      success: true,
      criteria: updated,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-criteria-chat", "Błąd generowania kryteriów", null, errorObj);
    return NextResponse.json(
      { error: "Błąd generowania kryteriów", details: errorObj.message },
      { status: 500 }
    );
  }
}

