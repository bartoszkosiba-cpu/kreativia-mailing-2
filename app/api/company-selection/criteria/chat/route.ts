import { NextRequest, NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { db } from "@/lib/db";
import { trackTokenUsage } from "@/services/tokenTracker";
import { logger } from "@/services/logger";

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

    // Pobierz istniejącą konfigurację lub utwórz nową
    let criteria = criteriaId
      ? await db.companyVerificationCriteria.findUnique({
          where: { id: criteriaId },
        })
      : null;

    // Przygotuj historię rozmowy
    type AllowedRole = "system" | "user" | "assistant";
    const allowedRoles: AllowedRole[] = ["system", "user", "assistant"];

    let chatHistory: ChatCompletionMessageParam[] = [];
    if (criteria?.chatHistory) {
      try {
        const parsed = JSON.parse(criteria.chatHistory) as Array<{ role?: string; content?: unknown }>;
        if (Array.isArray(parsed)) {
          chatHistory = parsed.reduce<ChatCompletionMessageParam[]>((acc, item) => {
            if (typeof item?.role !== "string") {
              return acc;
            }
            if (typeof item?.content !== "string") {
              return acc;
            }
            if (!allowedRoles.includes(item.role as AllowedRole)) {
              return acc;
            }

            acc.push({ role: item.role as AllowedRole, content: item.content });
            return acc;
          }, []);
        }
      } catch (e) {
        chatHistory = [];
      }
    }

    // Dodaj wiadomość użytkownika
    chatHistory.push({ role: "user", content: message });

    // Wywołaj AI
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = `Jesteś ekspertem od tworzenia kryteriów weryfikacji firm dla systemu prospectingu. Twoim zadaniem jest pomóc użytkownikowi określić, jakie firmy są odpowiednie do poszukiwania w nich leadów (pracowników).

ZACHOWANIE:
- Bądź pomocny i profesjonalny w rozmowie
- Zadawaj pytania, gdy potrzebujesz więcej informacji, aby stworzyć precyzyjne kryteria
- Gdy masz wystarczające informacje, zaproponuj gotowe kryteria
- Słuchaj uważnie - jeśli użytkownik mówi, że coś nie ma znaczenia lub wyklucza jakieś kategorie, nie pytaj o to ponownie
- Jeśli użytkownik wyraźnie mówi "działaj", "mam wszystko", "to wszystko" - to sygnał, że ma wszystkie potrzebne informacje i chce, żebyś zaproponował kryteria
- Jeśli użytkownik prosi Cię o zadanie pytań (np. "zadaj mi pytania"), zadaj pytania, które pomogą doprecyzować kryteria

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
      ],
      temperature: 0.7, // Zwiększona temperatura dla bardziej naturalnych odpowiedzi
      max_tokens: 1500, // Zwiększone dla dłuższych odpowiedzi z kryteriami
    });

    // Track token usage
    if (response.usage) {
      await trackTokenUsage({
        operation: "company_criteria_chat",
        model: "gpt-4o-mini",
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        metadata: { criteriaId: criteria?.id || "new" },
      });
    }

    const aiResponse = response.choices[0].message.content || "";

    // Dodaj odpowiedź AI do historii
    chatHistory.push({ role: "assistant", content: aiResponse });

    // Zaktualizuj lub utwórz konfigurację
    if (criteria) {
      criteria = await db.companyVerificationCriteria.update({
        where: { id: criteria.id },
        data: {
          chatHistory: JSON.stringify(chatHistory),
          lastUserMessage: message,
          lastAIResponse: aiResponse,
        },
      });
    } else {
      // Utwórz nową konfigurację (nieaktywną, użytkownik musi ją zatwierdzić)
      criteria = await db.companyVerificationCriteria.create({
        data: {
          name: "Nowa konfiguracja",
          criteriaText: "Kryteria będą wygenerowane po zakończeniu rozmowy",
          chatHistory: JSON.stringify(chatHistory),
          lastUserMessage: message,
          lastAIResponse: aiResponse,
          isActive: false,
          isDefault: false,
        },
      });
    }

    // Sprawdź, czy odpowiedź zawiera gotowe kryteria (sygnał, że agent zakończył)
    const hasCriteria = aiResponse.includes("KRYTERIA WERYFIKACJI") || 
                        aiResponse.includes("Co TAK:") || 
                        aiResponse.includes("PROGI PEWNOŚCI");

    logger.info("company-criteria-chat", `Wysłano wiadomość do agenta (criteriaId: ${criteria.id})`);
    return NextResponse.json({
      success: true,
      response: aiResponse,
      criteriaId: criteria.id,
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

    // Wygeneruj finalne kryteria na podstawie historii czatu
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const chatHistory = criteria.chatHistory
      ? JSON.parse(criteria.chatHistory)
      : [];

    const prompt = `Na podstawie poniższej rozmowy, wygeneruj finalne kryteria weryfikacji firm w formacie JSON.

Rozmowa:
${JSON.stringify(chatHistory, null, 2)}

Odpowiedz TYLKO w formacie JSON:
{
  "criteriaText": "Szczegółowy tekst kryteriów dla AI (co TAK, co NIE)",
  "qualifiedKeywords": ["słowo1", "słowo2"],
  "rejectedKeywords": ["słowo1", "słowo2"],
  "qualifiedThreshold": 0.8,
  "rejectedThreshold": 0.3,
  "name": "Nazwa konfiguracji",
  "description": "Krótki opis"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Jesteś ekspertem od tworzenia kryteriów weryfikacji. Odpowiadasz TYLKO w formacie JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    // Track token usage
    if (response.usage) {
      await trackTokenUsage({
        operation: "company_criteria_generate",
        model: "gpt-4o-mini",
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

    // Usuń flagę isDefault z innych kryteriów
    const allDefaultCriteria = await db.companyVerificationCriteria.findMany({
      where: {
        isDefault: true,
      },
    });
    
    for (const otherCriteria of allDefaultCriteria) {
      if (otherCriteria.id !== criteriaId) {
        await db.companyVerificationCriteria.update({
          where: { id: otherCriteria.id },
          data: { isDefault: false },
        });
      }
    }

    // Zaktualizuj konfigurację i ustaw jako aktywną i domyślną
    const updated = await db.companyVerificationCriteria.update({
      where: { id: criteriaId },
      data: {
        name: generatedCriteria.name || criteria.name,
        description: generatedCriteria.description || criteria.description,
        criteriaText: generatedCriteria.criteriaText,
        qualifiedKeywords: JSON.stringify(generatedCriteria.qualifiedKeywords || []),
        rejectedKeywords: JSON.stringify(generatedCriteria.rejectedKeywords || []),
        qualifiedThreshold: generatedCriteria.qualifiedThreshold || 0.8,
        rejectedThreshold: generatedCriteria.rejectedThreshold || 0.3,
        isActive: true,
        isDefault: true,
      },
    });

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

