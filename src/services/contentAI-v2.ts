/**
 * AI Content Assistant V2 - Uproszczona wersja
 * 
 * ZMIANA: Chat na poziomie ProductGroup (nie Theme)
 * AI pamięta CAŁĄ rozmowę o produkcie i tworzy wiele treści
 */

import OpenAI from "openai";
import { db } from "@/lib/db";
import { DEFAULT_SYSTEM_PERSONA } from "./metaAI";
import { trackTokenUsage } from "./tokenTracker";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const AI_MODEL = "gpt-4o";

/**
 * Helper do trackowania tokenów z OpenAI
 */
async function trackAICall(
  response: OpenAI.Chat.Completions.ChatCompletion,
  operation: string,
  metadata?: Record<string, any>
) {
  if (response.usage) {
    await trackTokenUsage({
      operation,
      model: response.model,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      metadata
    });
  }
}

interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * Pobierz SYSTEM_PERSONA (dynamiczny)
 */
async function getSystemPersona(productGroupId: number): Promise<string> {
  try {
    const config = await db.aIPersonaConfig.findFirst({
      where: { isActive: true }
    });

    if (!config || !config.generatedPrompt) {
      return DEFAULT_SYSTEM_PERSONA;
    }

    let prompt = config.generatedPrompt;

    // Dodaj zasady specyficzne dla grupy
    if (config.groupSpecificRules) {
      const groupRules = JSON.parse(config.groupSpecificRules);
      const specificRules = groupRules[productGroupId];
      
      if (specificRules) {
        prompt += `\n\n[ZASADY DLA TEJ GRUPY PRODUKTOWEJ]\n`;
        if (specificRules.additionalRules) {
          prompt += `${specificRules.additionalRules.map((r: string) => `- ${r}`).join('\n')}\n`;
        }
      }
    }

    return prompt;
  } catch (error) {
    return DEFAULT_SYSTEM_PERSONA;
  }
}

/**
 * Chat z AI na poziomie ProductGroup
 */
export async function chatWithProductGroupAI(
  productGroupId: number,
  userMessage: string
): Promise<string> {
  console.log(`[CONTENT AI V2] Chat dla grupy ID: ${productGroupId}`);

  // 1. Pobierz grupę z historią
  const group = await db.productGroup.findUnique({
    where: { id: productGroupId }
  });

  if (!group) {
    throw new Error("Product group not found");
  }

  // 2. Odczytaj historię
  const history: ConversationMessage[] = group.conversationHistory 
    ? JSON.parse(group.conversationHistory)
    : [];

  // 3. Zbuduj kontekst
  const systemPersona = await getSystemPersona(productGroupId);
  
  const productContext = `
KONTEKST GRUPY PRODUKTOWEJ:
Nazwa: ${group.name}
Opis: ${group.description || "brak"}
Docelowa grupa: ${group.targetAudience || "do ustalenia"}
Rynki: ${group.markets || "PL"}

TWOJE ZADANIE:
- Rozmawiasz z użytkownikiem o kampaniach dla tego produktu
- PAMIĘTASZ całą rozmowę (możesz tworzyć wiele kampanii w jednej rozmowie)
- Gdy user poprosi o treść - GENERUJESZ (temat + treść)
- Gdy user powie "zapisz" - oznaczasz że ma zapisać ten content
- Możesz tworzyć: mail początkowy, follow-upy (1-4)

⚠️ KRYTYCZNIE WAŻNE - NIE WYMYŚLAJ DANYCH:
- NIE podawaj konkretnych liczb (czas, cena, ilość) jeśli user ich NIE podał
- Jeśli potrzebujesz danych → ZAPYTAJ użytkownika
- Używaj TYLKO informacji które user jawnie przekazał w rozmowie
- Jeśli user nie wspomniał o czasie/liczbie - NIE dodawaj tego do treści
- Lepiej zapytać niż zgadywać!

PRZYKŁAD ŹLE:
User: "Napisz o Smart Frame"
AI: "Smart Frame montujemy w 10 minut" ❌ (skąd 10 minut?!)

PRZYKŁAD DOBRZE:
User: "Napisz o Smart Frame"
AI: "Jaki jest główny selling point? Np. szybkość montażu?" ✅
User: "Tak, montaż w 8 minut"
AI: "Smart Frame montujemy w 8 minut" ✅
`.trim();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPersona },
    { role: "system", content: productContext },
    ...history.map(msg => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content
    })),
    { role: "user", content: userMessage }
  ];

  // 4. Wywołaj GPT-4o
  console.log(`[CONTENT AI V2] Wywołuję GPT-4o (${messages.length} messages)...`);
  
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2000
  });

  // Track tokens
  await trackAICall(response, "product_group_chat", { 
    productGroupId 
  });

  const aiResponse = response.choices[0].message.content || "";

  // 5. Zapisz do historii
  const newHistory: ConversationMessage[] = [
    ...history,
    {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString()
    },
    {
      role: "assistant",
      content: aiResponse,
      timestamp: new Date().toISOString()
    }
  ];

  await db.productGroup.update({
    where: { id: productGroupId },
    data: {
      conversationHistory: JSON.stringify(newHistory),
      lastAIResponse: aiResponse,
      updatedAt: new Date()
    }
  });

  console.log(`[CONTENT AI V2] ✅ Odpowiedź zapisana (historia: ${newHistory.length} wiadomości)`);

  return aiResponse;
}

/**
 * Zapisz content z rozmowy (ręcznie)
 */
export async function saveContentFromChat(
  productGroupId: number,
  data: {
    name: string;
    subject: string;
    content: string;
    type: string;
    language?: string;
    notes?: string;
    tags?: string;
  }
) {
  console.log(`[CONTENT AI V2] Zapisuję content: "${data.name}"`);

  const savedContent = await db.savedContent.create({
    data: {
      productGroupId,
      name: data.name,
      subject: data.subject,
      content: data.content,
      type: data.type,
      language: data.language || 'pl',
      notes: data.notes || null,
      tags: data.tags || null,
      sourceType: 'manual' // User zapisuje ręcznie z rozmowy
    }
  });

  console.log(`[CONTENT AI V2] ✅ Zapisano jako SavedContent ID: ${savedContent.id}`);

  return savedContent;
}

/**
 * Pobierz wszystkie SavedContent dla grupy
 */
export async function getSavedContentsForGroup(productGroupId: number) {
  return await db.savedContent.findMany({
    where: { 
      productGroupId,
      isActive: true
    },
    orderBy: [
      { isFavorite: 'desc' },
      { createdAt: 'desc' }
    ]
  });
}

