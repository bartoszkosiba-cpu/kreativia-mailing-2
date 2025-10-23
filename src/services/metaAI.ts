/**
 * META-AI SERVICE
 * 
 * AI Agent który rozmawia z użytkownikiem o preferencjach pisania kampanii
 * i dynamicznie generuje/modyfikuje SYSTEM_PERSONA dla Content AI.
 * 
 * Flow:
 * 1. User: "Zawsze pisz krótko, max 150 słów"
 * 2. Meta-AI: Rozumie → ekstraktuje zasadę → generuje nowy SYSTEM_PERSONA
 * 3. Content AI używa nowego SYSTEM_PERSONA w następnych kampaniach
 */

import OpenAI from "openai";
import { db } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const AI_MODEL = "gpt-4o";

// ============================================================================
// DEFAULT SYSTEM_PERSONA (bazowy, jeśli nie ma custom config)
// ============================================================================

export const DEFAULT_SYSTEM_PERSONA = `Jesteś ekspertem od content marketingu B2B, specjalizującym się w branży wystawienniczej, drukarskiej i produkcji materiałów POS/VM.

TWOJA ROLA:
- Pomagasz tworzyć skuteczne zimne maile B2B
- Prowadzisz briefing zadając pytania (nie zakładasz - pytasz!)
- Generejesz 3 warianty treści (A, B, C) aby dać wybór
- Uczysz się z feedbacku i iterujesz

ZASADY PISANIA ZIMNYCH MAILI:
1. KRÓTKO - max 3-4 akapity (nikt nie czyta długich maili)
2. KONKRET - używaj liczb, danych, faktów które podaje użytkownik (NIE wymyślaj własnych!)
3. PROBLEM→ROZWIĄZANIE - zacznij od bólu klienta, pokaż jak go rozwiązujesz
4. KORZYŚCI nie CECHY - opisuj efekt/rezultat, nie tylko właściwości
5. JASNE CTA - konkretna akcja (umów rozmowę / zobacz realizacje / pobierz katalog)
6. TON ROZMOWY - biznesowy ale ludzki, nie korporacyjny żargon
7. WAŻNE: Pytaj użytkownika o dane, NIE wymyślaj ich sam!

JĘZYK POLSKI B2B:
- Używaj form grzecznościowych (Pani/Panie) ale nie sztywno
- Unikaj anglicyzmów gdzie można (ale "case study" OK jeśli naturalnie)
- Krótkie zdania, aktywna strona
- Konkretne czasowniki (skracamy/realizujemy/dostarczamy nie zapewniamy/oferujemy)

BRIEFING:
- Zadawaj pytania po kolei (nie wszystkie naraz!)
- Potwierdzaj każdą odpowiedź ("✅ Zapisałem: Odbiorca = ...")
- PYTAJ o konkretne dane (czas montażu, liczby, ceny) - NIE WYMYŚLAJ!
- Jeśli user nie podał danych - NIE zakładaj, ZAPYTAJ!
- Gdy masz wystarczające info → generuj content

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
// META-AGENT PROMPT
// ============================================================================

const META_AGENT_SYSTEM_PROMPT = `Jesteś META-AGENTEM który pomaga użytkownikowi skonfigurować zachowanie AI Content Assistant.

TWOJA ROLA:
- Rozmawiasz z użytkownikiem o jego preferencjach dotyczących stylu pisania zimnych maili
- Ekstraktujesz konkretne zasady w format JSON
- Generujesz zaktualizowany SYSTEM_PERSONA dla Content AI
- Pomagasz tworzyć zarówno zasady globalne (dla wszystkich kampanii) jak i specyficzne dla grup produktowych

ZASADY ROZMOWY:
1. Bądź przyjazny i pomocny
2. Potwierdzaj każdą zmianę ("✅ Zapisałem: ...")
3. Pokazuj PRZED/PO przy zmianach
4. Pytaj o potwierdzenie przed zapisem
5. Sugeruj best practices jeśli user chce coś szkodliwego

STRUKTURA ODPOWIEDZI:
Musisz ZAWSZE zwrócić JSON w tym formacie:
{
  "message": "Treść odpowiedzi dla użytkownika (markdown OK)",
  "rules": {
    "global": {
      "maxLength": 150,
      "maxParagraphs": 3,
      "tone": "biznesowy-przystępny",
      "alwaysInclude": ["konkretne dane", "case study jeśli możliwe"],
      "neverUse": ["PR-owe frazesy", "ogólniki"],
      "custom": {}
    },
    "groupSpecific": {
      "1": {
        "additionalRules": ["zawsze wspomnieć certyfikaty"],
        "tone": "techniczny-konkretny"
      }
    }
  },
  "changedFields": ["maxLength", "tone"],
  "needsConfirmation": false
}

PRZYKŁADY ROZMOWY:

User: "Zawsze pisz krótko, max 2 akapity"
Ty: {
  "message": "✅ Zaktualizowałem zasadę globalną:\\n\\n**PRZED:**\\n1. KRÓTKO - max 3-4 akapity\\n\\n**PO:**\\n1. KRÓTKO - max 2 akapity\\n\\nTa zmiana będzie działać dla WSZYSTKICH nowych kampanii. Zapisać?",
  "rules": {
    "global": {
      "maxParagraphs": 2,
      "maxLength": 100
    }
  },
  "changedFields": ["maxParagraphs", "maxLength"],
  "needsConfirmation": true
}

User: "Dla podwieszeń targowych zawsze wspominaj certyfikaty"
Ty: {
  "message": "✅ Dodałem regułę specyficzną dla grupy 'Podwieszenia Targowe':\\n\\n📦 **PODWIESZENIA TARGOWE** - dodatkowe zasady:\\n• Zawsze wspomnieć certyfikaty/standardy\\n\\nGdy będziesz tworzyć kampanie w tej grupie, AI automatycznie zapyta o certyfikaty podczas briefingu. Zapisać?",
  "rules": {
    "groupSpecific": {
      "1": {
        "additionalRules": ["wspomnieć certyfikaty/standardy"]
      }
    }
  },
  "changedFields": ["groupSpecific"],
  "needsConfirmation": true
}

User: "Zapisz"
Ty: {
  "message": "✅ Gotowe! Twoje nowe zasady są aktywne.\\n\\n🎉 Możesz teraz tworzyć kampanie - AI będzie stosował Twoje preferencje automatycznie!",
  "rules": {},
  "changedFields": [],
  "needsConfirmation": false
}

WAŻNE:
- ZAWSZE zwracaj poprawny JSON (nie markdown, nie \`\`\`)
- Jeśli user pyta o obecne zasady → pokaż je czytelnie
- Jeśli user chce resetować → pytaj o potwierdzenie
- Zawsze sugeruj sensowne wartości`;

// ============================================================================
// INTERFACES
// ============================================================================

export interface MetaAIResponse {
  message: string;
  rules: {
    global?: any;
    groupSpecific?: Record<string, any>;
  };
  changedFields: string[];
  needsConfirmation: boolean;
}

interface ConfigHistory {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Chat z Meta-AI - główna funkcja
 */
export async function chatWithMetaAI(userMessage: string): Promise<{
  aiResponse: string;
  updatedConfig?: any;
  needsConfirmation: boolean;
}> {
  console.log(`[META-AI] User: ${userMessage.substring(0, 100)}...`);

  // 1. Pobierz obecną konfigurację
  let config = await db.aIPersonaConfig.findFirst({
    where: { isActive: true }
  });

  if (!config) {
    // Utwórz default config
    config = await db.aIPersonaConfig.create({
      data: {
        generatedPrompt: DEFAULT_SYSTEM_PERSONA,
        promptVersion: 1,
        isActive: true
      }
    });
  }

  // 2. Parse historii
  const history: ConfigHistory[] = config.configHistory 
    ? JSON.parse(config.configHistory)
    : [];

  // 3. Zbuduj kontekst dla meta-AI
  const currentRules = config.globalRules ? JSON.parse(config.globalRules) : {};
  const groupRules = config.groupSpecificRules ? JSON.parse(config.groupSpecificRules) : {};

  const contextMessage = `
OBECNA KONFIGURACJA:

Zasady globalne:
${JSON.stringify(currentRules, null, 2)}

Zasady dla grup produktowych:
${JSON.stringify(groupRules, null, 2)}

Wersja promptu: ${config.promptVersion}
`.trim();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: META_AGENT_SYSTEM_PROMPT },
    { role: "system", content: contextMessage },
    ...history.map(h => ({
      role: h.role as "user" | "assistant",
      content: h.content
    })),
    { role: "user", content: userMessage }
  ];

  // 4. Wywołaj GPT-4o
  console.log(`[META-AI] Wywołuję GPT-4o (${messages.length} messages)...`);

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: "json_object" }
  });

  const rawResponse = response.choices[0].message.content || "{}";
  console.log(`[META-AI] Raw response: ${rawResponse.substring(0, 200)}...`);

  // 5. Parse odpowiedzi
  const parsed: MetaAIResponse = JSON.parse(rawResponse);

  // 6. Zapisz do historii
  const newHistory: ConfigHistory[] = [
    ...history,
    {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString()
    },
    {
      role: "assistant",
      content: parsed.message,
      timestamp: new Date().toISOString()
    }
  ];

  // 7. Merge zasad (jeśli są zmiany)
  let updatedGlobalRules = currentRules;
  let updatedGroupRules = groupRules;
  let newPromptVersion = config.promptVersion;

  if (parsed.rules.global && Object.keys(parsed.rules.global).length > 0) {
    updatedGlobalRules = { ...currentRules, ...parsed.rules.global };
  }

  if (parsed.rules.groupSpecific && Object.keys(parsed.rules.groupSpecific).length > 0) {
    updatedGroupRules = { ...groupRules, ...parsed.rules.groupSpecific };
  }

  // 8. Wygeneruj nowy SYSTEM_PERSONA (jeśli były zmiany i nie wymaga potwierdzenia)
  let newPrompt = config.generatedPrompt;
  if (parsed.changedFields.length > 0 && !parsed.needsConfirmation) {
    newPrompt = generateSystemPersona(updatedGlobalRules);
    newPromptVersion++;
    console.log(`[META-AI] ✅ Wygenerowano nowy SYSTEM_PERSONA (v${newPromptVersion})`);
  }

  // 9. Zapisz do bazy
  await db.aIPersonaConfig.update({
    where: { id: config.id },
    data: {
      configHistory: JSON.stringify(newHistory),
      lastUserMessage: userMessage,
      lastAIResponse: parsed.message,
      globalRules: JSON.stringify(updatedGlobalRules),
      groupSpecificRules: JSON.stringify(updatedGroupRules),
      generatedPrompt: newPrompt,
      promptVersion: newPromptVersion,
      updatedAt: new Date()
    }
  });

  return {
    aiResponse: parsed.message,
    updatedConfig: {
      globalRules: updatedGlobalRules,
      groupSpecificRules: updatedGroupRules,
      promptVersion: newPromptVersion
    },
    needsConfirmation: parsed.needsConfirmation
  };
}

/**
 * Generuj SYSTEM_PERSONA na podstawie zasad
 */
function generateSystemPersona(rules: any): string {
  // Zacznij od default
  let prompt = DEFAULT_SYSTEM_PERSONA;

  // Modyfikuj na podstawie zasad
  if (rules.maxParagraphs || rules.maxLength) {
    const lengthRule = rules.maxParagraphs 
      ? `max ${rules.maxParagraphs} akapity`
      : `max ${rules.maxLength} słów`;
    
    prompt = prompt.replace(
      /1\. KRÓTKO - max 3-4 akapity.*?\n/,
      `1. KRÓTKO - ${lengthRule} (użytkownik określił limit)\n`
    );
  }

  if (rules.tone) {
    prompt += `\n\n[CUSTOM TONE] Ton użytkownika: ${rules.tone}\n`;
  }

  if (rules.alwaysInclude && Array.isArray(rules.alwaysInclude)) {
    prompt += `\n\n[CUSTOM RULES] Zawsze uwzględnij:\n${rules.alwaysInclude.map((r: string) => `- ${r}`).join('\n')}\n`;
  }

  if (rules.neverUse && Array.isArray(rules.neverUse)) {
    prompt += `\n\n[CUSTOM RULES] Nigdy nie używaj:\n${rules.neverUse.map((r: string) => `- ${r}`).join('\n')}\n`;
  }

  if (rules.custom && Object.keys(rules.custom).length > 0) {
    prompt += `\n\n[CUSTOM RULES] Dodatkowe zasady użytkownika:\n${JSON.stringify(rules.custom, null, 2)}\n`;
  }

  return prompt;
}

/**
 * Pobierz obecną konfigurację
 */
export async function getCurrentConfig() {
  let config = await db.aIPersonaConfig.findFirst({
    where: { isActive: true }
  });

  if (!config) {
    config = await db.aIPersonaConfig.create({
      data: {
        generatedPrompt: DEFAULT_SYSTEM_PERSONA,
        promptVersion: 1,
        isActive: true
      }
    });
  }

  return {
    id: config.id,
    globalRules: config.globalRules ? JSON.parse(config.globalRules) : {},
    groupSpecificRules: config.groupSpecificRules ? JSON.parse(config.groupSpecificRules) : {},
    generatedPrompt: config.generatedPrompt || DEFAULT_SYSTEM_PERSONA,
    promptVersion: config.promptVersion,
    history: config.configHistory ? JSON.parse(config.configHistory) : [],
    lastUpdate: config.updatedAt
  };
}

/**
 * Reset do default
 */
export async function resetToDefault() {
  const config = await db.aIPersonaConfig.findFirst({
    where: { isActive: true }
  });

  if (config) {
    await db.aIPersonaConfig.update({
      where: { id: config.id },
      data: {
        configHistory: null,
        lastUserMessage: null,
        lastAIResponse: null,
        globalRules: null,
        groupSpecificRules: null,
        generatedPrompt: DEFAULT_SYSTEM_PERSONA,
        promptVersion: 1,
        updatedAt: new Date()
      }
    });
  }

  console.log("[META-AI] ✅ Reset do default konfiguracji");
}

