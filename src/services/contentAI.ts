/**
 * AI Content Planner - Inteligentny asystent do tworzenia treści kampanii
 * 
 * Model: GPT-4o (najlepszy dla polskiego B2B)
 * Funkcje:
 * - Interaktywny briefing (zadawanie pytań)
 * - Generowanie 3 wariantów treści (A, B, C)
 * - Pamięć kontekstu rozmowy
 * - Iteracyjne poprawki
 */

import OpenAI from "openai";
import { db } from "@/lib/db";
import { DEFAULT_SYSTEM_PERSONA } from "./metaAI";
import { trackTokenUsage } from "./tokenTracker";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Model AI - GPT-4o (najlepszy dla polskiego content marketingu)
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

// ============================================================================
// DYNAMICZNY SYSTEM_PERSONA - Ładowany z konfiguracji
// ============================================================================

/**
 * Pobierz SYSTEM_PERSONA (dynamiczny lub default)
 */
async function getSystemPersona(productGroupId?: number): Promise<string> {
  try {
    // Pobierz konfigurację z bazy
    const config = await db.aIPersonaConfig.findFirst({
      where: { isActive: true }
    });

    if (!config || !config.generatedPrompt) {
      console.log("[CONTENT AI] Używam DEFAULT_SYSTEM_PERSONA");
      return DEFAULT_SYSTEM_PERSONA;
    }

    let prompt = config.generatedPrompt;

    // Dodaj zasady specyficzne dla grupy produktowej
    if (productGroupId && config.groupSpecificRules) {
      const groupRules = JSON.parse(config.groupSpecificRules);
      const specificRules = groupRules[productGroupId];
      
      if (specificRules) {
        console.log(`[CONTENT AI] Dodaję zasady dla grupy ${productGroupId}`);
        prompt += `\n\n[ZASADY DLA TEJ GRUPY PRODUKTOWEJ]\n`;
        
        if (specificRules.additionalRules) {
          prompt += `Dodatkowe zasady:\n${specificRules.additionalRules.map((r: string) => `- ${r}`).join('\n')}\n`;
        }
        
        if (specificRules.tone) {
          prompt += `\nTon dla tej grupy: ${specificRules.tone}\n`;
        }
      }
    }

    console.log(`[CONTENT AI] Używam custom SYSTEM_PERSONA (v${config.promptVersion})`);
    return prompt;

  } catch (error) {
    console.error("[CONTENT AI] Błąd ładowania SYSTEM_PERSONA, używam default:", error);
    return DEFAULT_SYSTEM_PERSONA;
  }
}

// Stary SYSTEM_PERSONA (już nie używany - dla referencji)
const LEGACY_SYSTEM_PERSONA = `Jesteś ekspertem od content marketingu B2B, specjalizującym się w branży wystawienniczej, drukarskiej i produkcji materiałów POS/VM.

TWOJA ROLA:
- Pomagasz tworzyć skuteczne zimne maile B2B
- Prowadzisz briefing zadając pytania (nie zakładasz - pytasz!)
- Generejesz 3 warianty treści (A, B, C) aby dać wybór
- Uczysz się z feedbacku i iterujesz

ZASADY PISANIA ZIMNYCH MAILI:
1. KRÓTKO - max 3-4 akapity (nikt nie czyta długich maili)
2. KONKRET - liczby, dane, fakty (nie ogólniki typu "wysoka jakość")
3. PROBLEM→ROZWIĄZANIE - zacznij od bólu klienta, pokaż jak go rozwiązujesz
4. KORZYŚCI nie CECHY - "montaż w 15 min" zamiast "lekka konstrukcja"
5. JASNE CTA - konkretna akcja (umów rozmowę / zobacz realizacje / pobierz katalog)
6. TON ROZMOWY - biznesowy ale ludzi, nie korporacyjny żargon

JĘZYK POLSKI B2B:
- Używaj form grzecznościowych (Pani/Panie) ale nie sztywno
- Unikaj anglicyzmów gdzie można (ale "case study" OK jeśli naturalnie)
- Krótkie zdania, aktywna strona
- Konkretne czasowniki (skracamy/realizujemy/dostarczamy nie zapewniamy/oferujemy)

BRIEFING:
- Zadawaj pytania po kolei (nie wszystkie naraz!)
- Potwierdzaj każdą odpowiedź ("✅ Zapisałem: Odbiorca = ...")
- Gdy masz 7 kluczowych info → generuj content
- Jeśli brakuje istotnej info - dopytaj!

GENEROWANIE:
- ZAWSZE 3 warianty (A, B, C) dla każdego typu maila
- Każdy wariant różni się podejściem:
  * A = klasyczny (problem → rozwiązanie → CTA)
  * B = case study / proof based
  * C = kreatywny / nietypowy hook
- Do każdego wariantu dodaj krótkie "💡 Dlaczego ten wariant"

ITERACJA:
- Słuchaj feedbacku użytkownika
- "Za długie" → skracaj o 30-40%
- "Zmień CTA" → tylko CTA, reszta zostaje
- "Weź A ale hook z B" → łącz elementy
- Nie tłumacz się - po prostu poprawiaj

Pamiętaj: Twój cel to pomóc stworzyć mail który DOSTANIE ODPOWIEDŹ, nie tylko będzie "profesjonalny".`;

// ============================================================================
// BRIEFING QUESTIONS - Pytania dla użytkownika
// ============================================================================

interface BriefingQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "multiselect";
  options?: string[];
  required: boolean;
  followUp?: string; // Pytanie dodatkowe jeśli tak odpowie
}

const BRIEFING_QUESTIONS: BriefingQuestion[] = [
  {
    id: "audience",
    question: "Kto dokładnie jest odbiorcą tej kampanii? (np. wykonawcy stoisk, agencje reklamowe, sieci retail)",
    type: "text",
    required: true
  },
  {
    id: "problem",
    question: "Jaki główny problem/wyzwanie ma ten odbiorca, które Ty rozwiązujesz?",
    type: "text",
    required: true
  },
  {
    id: "unique_data",
    question: "Jakie konkretne liczby/dane możesz podać? (np. montaż w X minut, X realizacji, cena, czas dostawy)",
    type: "text",
    required: false
  },
  {
    id: "cta",
    question: "Jaki Call-To-Action? Co ma zrobić odbiorca? (np. umów rozmowę 15 min / zobacz realizacje / pobierz katalog)",
    type: "text",
    required: true
  },
  {
    id: "tone",
    question: "Jaki ton/styl języka? (formalny-korporacyjny / biznesowy-przystępny / swobodny-partnerski)",
    type: "select",
    options: ["formalny", "biznesowy", "swobodny"],
    required: true
  },
  {
    id: "length",
    question: "Jak długi ma być mail?",
    type: "select",
    options: [
      "krótki (2-3 akapity, ~100 słów)",
      "średni (4-5 akapitów, ~150 słów)",
      "długi (6+ akapitów, ~200+ słów)"
    ],
    required: true
  },
  {
    id: "proof",
    question: "Czy masz konkretne case study / referencje / klientów do wspomnienia? (możesz bez nazw, np. 'sieci retail')",
    type: "text",
    required: false
  }
];

// ============================================================================
// INTERFACES
// ============================================================================

export interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    action?: "briefing" | "generation" | "feedback" | "iteration";
    questionId?: string;
  };
}

export interface BriefingData {
  audience?: string;
  problem?: string;
  unique_data?: string;
  cta?: string;
  tone?: string;
  length?: string;
  proof?: string;
  [key: string]: string | undefined;
}

export interface GeneratedContent {
  type: "initial" | "followup_1" | "followup_2" | "followup_3" | "followup_4";
  variants: Array<{
    letter: "A" | "B" | "C";
    subject: string;
    content: string;
    rationale: string; // Dlaczego ten wariant
  }>;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Chat z AI - główna funkcja rozmowy
 */
export async function chatWithContentAI(
  campaignThemeId: number,
  userMessage: string
): Promise<string> {
  console.log(`[CONTENT AI] Chat dla tematu ID: ${campaignThemeId}`);
  console.log(`[CONTENT AI] User: ${userMessage.substring(0, 100)}...`);

  // 1. Pobierz temat kampanii z historią
  const theme = await db.campaignTheme.findUnique({
    where: { id: campaignThemeId },
    include: { productGroup: true }
  });

  if (!theme) {
    throw new Error("Campaign theme not found");
  }

  // 2. Odczytaj historię rozmowy
  const history: ConversationMessage[] = theme.conversationHistory 
    ? JSON.parse(theme.conversationHistory)
    : [];

  // 3. Zbuduj kontekst dla AI (dynamiczny SYSTEM_PERSONA)
  const systemPersona = await getSystemPersona(theme.productGroupId);
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPersona },
    { role: "system", content: buildProductGroupContext(theme.productGroup) },
    { role: "system", content: buildThemeContext(theme) },
    ...history.map(msg => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content
    })),
    { role: "user", content: userMessage }
  ];

  // 4. Wywołaj GPT-4o
  console.log(`[CONTENT AI] Wywołuję GPT-4o z ${messages.length} wiadomościami...`);
  
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 3000
  });

  // Track tokens
  await trackAICall(response, "content_generation", { 
    campaignThemeId: theme.id,
    productGroupId: theme.productGroupId 
  });

  const aiResponse = response.choices[0].message.content || "";
  
  console.log(`[CONTENT AI] AI: ${aiResponse.substring(0, 100)}...`);

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

  await db.campaignTheme.update({
    where: { id: campaignThemeId },
    data: {
      conversationHistory: JSON.stringify(newHistory),
      lastAIResponse: aiResponse,
      updatedAt: new Date()
    }
  });

  // 6. Analiza: czy AI zebrał kompletny briefing? Jeśli tak - update briefingData
  await analyzeBriefingProgress(campaignThemeId, newHistory);
  
  // 7. Po każdych kilku wiadomościach - spróbuj wyekstraktować briefing
  if (newHistory.length >= 4 && newHistory.length % 2 === 0) {
    try {
      await extractBriefingFromConversation(campaignThemeId);
    } catch (error) {
      console.log("[CONTENT AI] Nie udało się wyekstraktować briefingu (jeszcze za wcześnie)");
    }
  }

  return aiResponse;
}

/**
 * Rozpocznij briefing - AI zadaje pierwsze pytanie
 */
export async function startBriefing(campaignThemeId: number): Promise<string> {
  console.log(`[CONTENT AI] Rozpoczynam briefing dla tematu ID: ${campaignThemeId}`);

  const theme = await db.campaignTheme.findUnique({
    where: { id: campaignThemeId },
    include: { productGroup: true }
  });

  if (!theme) {
    throw new Error("Campaign theme not found");
  }

  // Wygeneruj pierwsze powitanie i pytanie
  const initialPrompt = `Rozpocznij briefing dla nowego tematu kampanii:
Grupa produktowa: ${theme.productGroup.name}
Temat kampanii: ${theme.name}

Przywitaj się i zadaj pierwsze pytanie z briefingu (audience).`;

  const systemPersona = await getSystemPersona(theme.productGroupId);
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPersona },
    { role: "system", content: buildProductGroupContext(theme.productGroup) },
    { role: "user", content: initialPrompt }
  ];

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    temperature: 0.8,
    max_tokens: 500
  });

  const aiResponse = response.choices[0].message.content || "";

  // Zapisz do historii
  const history: ConversationMessage[] = [
    {
      role: "assistant",
      content: aiResponse,
      timestamp: new Date().toISOString(),
      metadata: { action: "briefing", questionId: "start" }
    }
  ];

  await db.campaignTheme.update({
    where: { id: campaignThemeId },
    data: {
      conversationHistory: JSON.stringify(history),
      lastAIResponse: aiResponse,
      status: "in_briefing",
      updatedAt: new Date()
    }
  });

  return aiResponse;
}

/**
 * Generuj 3 warianty treści (A, B, C)
 */
export async function generateContentVariants(
  campaignThemeId: number,
  type: "initial" | "followup_1" | "followup_2" | "followup_3" | "followup_4"
): Promise<GeneratedContent> {
  console.log(`[CONTENT AI] Generuję 3 warianty dla tematu ID: ${campaignThemeId}, typ: ${type}`);

  const theme = await db.campaignTheme.findUnique({
    where: { id: campaignThemeId },
    include: { productGroup: true }
  });

  if (!theme) {
    throw new Error("Campaign theme not found");
  }

  // Odczytaj briefing
  const briefing: BriefingData = theme.briefingData 
    ? JSON.parse(theme.briefingData)
    : {};

  if (!briefing.audience || !briefing.problem || !briefing.cta) {
    throw new Error("Briefing niekompletny - uzupełnij najpierw audience, problem i CTA");
  }

  // Zbuduj prompt dla generowania
  const generationPrompt = buildGenerationPrompt(theme, briefing, type);
  
  const systemPersona = await getSystemPersona(theme.productGroupId);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPersona },
    { role: "system", content: buildProductGroupContext(theme.productGroup) },
    { role: "user", content: generationPrompt }
  ];

  console.log(`[CONTENT AI] Wywołuję GPT-4o do generowania...`);

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    temperature: 0.8,
    max_tokens: 4000
  });

  const aiResponse = response.choices[0].message.content || "";

  // Parse odpowiedzi AI (oczekujemy struktury JSON)
  const variants = parseGeneratedVariants(aiResponse);

  // Zapisz wersje do bazy
  const versionNumber = await getNextVersionNumber(campaignThemeId, type);

  for (const variant of variants) {
    await db.campaignVersion.create({
      data: {
        campaignThemeId,
        versionNumber,
        type,
        variantLetter: variant.letter,
        subject: variant.subject,
        content: variant.content,
        aiRationale: variant.rationale,
        aiModel: AI_MODEL,
        status: "draft"
      }
    });
  }

  console.log(`[CONTENT AI] ✅ Wygenerowano 3 warianty (${type}, v${versionNumber})`);

  return {
    type,
    variants
  };
}

/**
 * Iteruj nad istniejącą wersją (feedback + poprawa)
 */
export async function iterateContent(
  versionId: number,
  userFeedback: string
): Promise<{
  subject: string;
  content: string;
  rationale: string;
}> {
  console.log(`[CONTENT AI] Iteruję wersję ID: ${versionId}`);

  const version = await db.campaignVersion.findUnique({
    where: { id: versionId },
    include: {
      campaignTheme: {
        include: { productGroup: true }
      }
    }
  });

  if (!version) {
    throw new Error("Version not found");
  }

  const iterationPrompt = `Masz wygenerowaną treść maila:

TEMAT: ${version.subject}

TREŚĆ:
${version.content}

FEEDBACK UŻYTKOWNIKA: "${userFeedback}"

Popraw treść zgodnie z feedbackiem. Zwróć TYLKO JSON:
{
  "subject": "...",
  "content": "...",
  "rationale": "Co zmieniłem i dlaczego"
}`;

  const systemPersona = await getSystemPersona(version.campaignTheme.productGroupId);

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPersona },
      { role: "user", content: iterationPrompt }
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");

  // Zapisz feedback
  await db.campaignVersion.update({
    where: { id: versionId },
    data: {
      userFeedback
    }
  });

  // Utwórz nową wersję (iteracja)
  const newVersionNumber = version.versionNumber + 1;
  
  const newVersion = await db.campaignVersion.create({
    data: {
      campaignThemeId: version.campaignThemeId,
      versionNumber: newVersionNumber,
      type: version.type,
      variantLetter: version.variantLetter,
      subject: result.subject,
      content: result.content,
      aiRationale: result.rationale,
      aiModel: AI_MODEL,
      status: "draft"
    }
  });

  console.log(`[CONTENT AI] ✅ Utworzono wersję v${newVersionNumber} (iteracja)`);

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildProductGroupContext(group: any): string {
  return `
KONTEKST GRUPY PRODUKTOWEJ:
Nazwa: ${group.name}
Opis: ${group.description || "brak"}
Docelowa grupa: ${group.targetAudience || "do ustalenia"}
Rynki: ${group.markets || "PL"}
`.trim();
}

function buildThemeContext(theme: any): string {
  const briefing: BriefingData = theme.briefingData 
    ? JSON.parse(theme.briefingData)
    : {};

  return `
KONTEKST TEMATU KAMPANII:
Nazwa tematu: ${theme.name}
Opis: ${theme.description || "brak"}

ZEBRANE DANE Z BRIEFINGU:
${Object.entries(briefing).map(([key, value]) => `- ${key}: ${value}`).join('\n') || "Briefing jeszcze nie wypełniony"}
`.trim();
}

function buildGenerationPrompt(theme: any, briefing: BriefingData, type: string): string {
  const typeLabels = {
    "initial": "MAIL POCZĄTKOWY (pierwszy kontakt)",
    "followup_1": "FOLLOW-UP 1 (przypomnienie po ~7 dniach)",
    "followup_2": "FOLLOW-UP 2 (inne podejście po ~14 dniach)",
    "followup_3": "FOLLOW-UP 3 (ostatnia szansa po ~21 dniach)",
    "followup_4": "FOLLOW-UP 4 (finał po ~28 dniach)"
  };

  return `Wygeneruj 3 WARIANTY (A, B, C) treści dla:
${typeLabels[type as keyof typeof typeLabels] || type}

BRIEFING:
- Odbiorca: ${briefing.audience}
- Problem: ${briefing.problem}
- Dane/liczby: ${briefing.unique_data || "brak"}
- CTA: ${briefing.cta}
- Ton: ${briefing.tone || "biznesowy"}
- Długość: ${briefing.length || "krótki"}
- Dowody/referencje: ${briefing.proof || "brak"}

WYTYCZNE:
- Wariant A: Klasyczne podejście (problem → rozwiązanie → CTA)
- Wariant B: Oparte na danych/case study/proof
- Wariant C: Kreatywny hook / nietypowe otwarcie

${type === "initial" ? `
Dla MAILA POCZĄTKOWEGO:
- Zacznij od hooking question LUB konkretnego problemu
- Nie przedstawiaj się długo (1 zdanie max)
- Główna wartość w środku (2 akapity)
- CTA na końcu (pytanie, nie nakaz)
` : `
Dla FOLLOW-UPU:
- Krótszy niż mail początkowy (max 2-3 akapity)
- Nawiąż do poprzedniego maila ("Pisałem XYZ temu...")
- ${type === "followup_1" ? "Delikatne przypomnienie + dodatkowa wartość" : ""}
- ${type === "followup_2" ? "Inne podejście - może case study / inny argument" : ""}
- ${type === "followup_3" ? "Ostatnia szansa - pilność / FOMO" : ""}
- Zawsze nowe CTA lub inne sformułowanie
`}

ZWRÓĆ TYLKO JSON (bez markdown, bez \`\`\`):
{
  "variants": [
    {
      "letter": "A",
      "subject": "...",
      "content": "...",
      "rationale": "Dlaczego ten wariant (1-2 zdania)"
    },
    {
      "letter": "B",
      "subject": "...",
      "content": "...",
      "rationale": "..."
    },
    {
      "letter": "C",
      "subject": "...",
      "content": "...",
      "rationale": "..."
    }
  ]
}`;
}

function parseGeneratedVariants(aiResponse: string): Array<{
  letter: "A" | "B" | "C";
  subject: string;
  content: string;
  rationale: string;
}> {
  try {
    // Usuń markdown jeśli AI dodał
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    }

    const parsed = JSON.parse(cleaned);
    return parsed.variants;
  } catch (error) {
    console.error("[CONTENT AI] Błąd parsowania AI response:", error);
    console.error("Raw response:", aiResponse);
    throw new Error("AI zwrócił niepoprawny format - spróbuj ponownie");
  }
}

async function getNextVersionNumber(campaignThemeId: number, type: string): Promise<number> {
  const lastVersion = await db.campaignVersion.findFirst({
    where: { campaignThemeId, type },
    orderBy: { versionNumber: "desc" }
  });

  return lastVersion ? lastVersion.versionNumber + 1 : 1;
}

/**
 * Analiza postępu briefingu i aktualizacja briefingData
 */
async function analyzeBriefingProgress(
  campaignThemeId: number,
  history: ConversationMessage[]
): Promise<void> {
  if (history.length === 0) return;

  // Szukaj odpowiedzi na kluczowe pytania w historii
  const conversationText = history
    .map(msg => `${msg.role}: ${msg.content}`)
    .join("\n");

  // Proste heurystyki (można ulepszyć AI analysis)
  let answeredQuestions = 0;
  const requiredCount = BRIEFING_QUESTIONS.filter(q => q.required).length; // 4 pytania

  // Sprawdź czy rozmowa zawiera kluczowe info
  const lowerText = conversationText.toLowerCase();
  
  if (lowerText.includes("odbiorca") || lowerText.includes("audience") || lowerText.includes("target")) {
    answeredQuestions++;
  }
  if (lowerText.includes("problem") || lowerText.includes("wyzwanie") || lowerText.includes("ból")) {
    answeredQuestions++;
  }
  if (lowerText.includes("cta") || lowerText.includes("call") || lowerText.includes("umów") || lowerText.includes("zobacz")) {
    answeredQuestions++;
  }
  if (lowerText.includes("ton") || lowerText.includes("styl") || lowerText.includes("formalny") || lowerText.includes("biznesowy")) {
    answeredQuestions++;
  }

  // Dodatkowe punkty za długość (dane, proof)
  if (history.length > 6) answeredQuestions++;
  if (history.length > 10) answeredQuestions++;

  const progress = Math.min(100, Math.round((answeredQuestions / (requiredCount + 2)) * 100));

  console.log(`[CONTENT AI] Briefing progress: ${progress}% (${answeredQuestions}/${requiredCount + 2} pytań)`);

  await db.campaignTheme.update({
    where: { id: campaignThemeId },
    data: {
      briefingProgress: progress,
      status: progress >= 70 ? "ready" : history.length > 0 ? "in_briefing" : "draft"
    }
  });
}

/**
 * Ekstrakcja briefingu z rozmowy (używa AI)
 */
export async function extractBriefingFromConversation(
  campaignThemeId: number
): Promise<BriefingData> {
  const theme = await db.campaignTheme.findUnique({
    where: { id: campaignThemeId }
  });

  if (!theme || !theme.conversationHistory) {
    return {};
  }

  const history: ConversationMessage[] = JSON.parse(theme.conversationHistory);
  const conversationText = history
    .map(msg => `${msg.role}: ${msg.content}`)
    .join("\n");

  const extractionPrompt = `Przeanalizuj rozmowę i wyciągnij dane briefingu.

ROZMOWA:
${conversationText}

Zwróć JSON z polami (tylko jeśli są w rozmowie):
{
  "audience": "...",
  "problem": "...",
  "unique_data": "...",
  "cta": "...",
  "tone": "...",
  "length": "...",
  "proof": "..."
}`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: "Jesteś ekspertem od ekstrakcji danych z rozmów." },
      { role: "user", content: extractionPrompt }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });

  const briefing = JSON.parse(response.choices[0].message.content || "{}");

  // Zapisz do bazy
  await db.campaignTheme.update({
    where: { id: campaignThemeId },
    data: {
      briefingData: JSON.stringify(briefing),
      targetAudience: briefing.audience,
      problemStatement: briefing.problem,
      callToAction: briefing.cta,
      toneOfVoice: briefing.tone,
      emailLength: briefing.length,
      mainArguments: briefing.unique_data
    }
  });

  return briefing;
}

// Export questions dla UI
export { BRIEFING_QUESTIONS };

