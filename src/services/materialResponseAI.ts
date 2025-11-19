/**
 * Material Response AI - Moduł do analizy i generowania automatycznych odpowiedzi z materiałami
 * 
 * Funkcjonalność:
 * 1. Analizuje odpowiedź INTERESTED - czy lead prosi o materiały (katalog, cennik, etc.)
 * 2. Generuje odpowiedź z materiałami używając kontekstu kampanii
 * 3. Zwraca pewność AI (confidence) dla decyzji o wysłaniu
 */

// Moduł AI do automatycznych odpowiedzi z materiałami
// Nie wymaga importów zewnętrznych - używa OpenAI bezpośrednio

import { trackTokenUsage } from "./tokenTracker";

export interface MaterialRequestAnalysis {
  isMaterialRequest: boolean; // Czy to prośba o materiały
  confidence: number; // Pewność AI (0.0-1.0)
  reasoning: string; // Uzasadnienie decyzji AI
  suggestedAction: "SEND" | "DONT_SEND" | "ASK_ADMIN"; // Sugerowana akcja
}

export interface MaterialResponseContent {
  subject: string; // Temat maila
  content: string; // Treść maila (w języku kampanii) - BEZ stopki i informacji o opiekunie (dodawane później)
}

/**
 * Analizuje odpowiedź leada - czy prosi o materiały (katalog, cennik, etc.)
 */
export async function analyzeMaterialRequest(
  leadResponse: string,
  campaignContext: string | null,
  campaignLanguage: string = 'pl'
): Promise<MaterialRequestAnalysis> {
  
  // Buduj prompt dla AI
  const prompt = buildAnalysisPrompt(leadResponse, campaignContext, campaignLanguage);
  
  try {
    // Wywołaj AI do analizy
    const aiResponse = await analyzeWithAI(prompt);
    
    return {
      isMaterialRequest: aiResponse.isMaterialRequest,
      confidence: aiResponse.confidence,
      reasoning: aiResponse.reasoning,
      suggestedAction: determineAction(aiResponse.confidence)
    };
  } catch (error) {
    console.error("[MATERIAL AI] Błąd analizy AI:", error);
    
    // Fallback - prosta heurystyka
    return fallbackAnalysis(leadResponse, campaignLanguage);
  }
}

/**
 * Generuje treść odpowiedzi z materiałami
 */
export async function generateMaterialResponse(
  lead: {
    firstName: string | null;
    lastName: string | null;
    greetingForm: string | null;
    language: string;
  },
  campaign: {
    id: number;
    name: string;
    autoReplyContext: string | null;
    autoReplyRules: string | null;
    virtualSalespersonLanguage: string | null; // Język z handlowca
    autoReplyContent: string | null; // Statyczna treść odpowiedzi (NOWE)
  },
  materials: Array<{
    name: string;
    type: "LINK" | "ATTACHMENT";
    url: string | null;
    fileName: string | null;
  }>,
  leadOriginalResponse?: string, // Opcjonalnie: treść odpowiedzi leada
  originalSubject?: string | null // Temat z odpowiedzi leada (dla "Re:")
): Promise<MaterialResponseContent> {
  
  // Język kampanii = język handlowca lub język leada
  const campaignLanguage = campaign.virtualSalespersonLanguage || lead.language || 'pl';
  
  // ✅ NOWA LOGIKA: Jeśli jest statyczna treść (autoReplyContent), użyj jej z personalizacją przez AI
  if (campaign.autoReplyContent && campaign.autoReplyContent.trim()) {
    console.log("[MATERIAL AI] Używam statycznej treści z kampanii (autoReplyContent)");
    try {
      // AI personalizuje statyczną treść (podstawia {firstName}, {materials}, etc.)
      const personalizedContent = await personalizeStaticContent(
        campaign.autoReplyContent,
        lead,
        materials,
        campaignLanguage
      );
      
      // Temat: użyj tematu z odpowiedzi leada, dodaj "Re:" jeśli brakuje
      const subject = buildEmailSubject(originalSubject, campaign.name);
      
      return {
        subject,
        content: personalizedContent
      };
    } catch (error) {
      console.error("[MATERIAL AI] Błąd personalizacji statycznej treści:", error);
      // Fallback na AI generowanie
    }
  }
  
  // ✅ FALLBACK: Generuj przez AI (jak dotychczas)
  const prompt = buildResponsePrompt(lead, campaign, materials, leadOriginalResponse, campaignLanguage);
  
  try {
    const aiResponse = await generateWithAI(prompt, campaignLanguage);
    
    // Temat: użyj tematu z odpowiedzi leada lub wygenerowanego przez AI, dodaj "Re:" jeśli brakuje
    const subject = buildEmailSubject(originalSubject || aiResponse.subject, campaign.name);
    
    return {
      subject,
      content: aiResponse.content
    };
  } catch (error) {
    console.error("[MATERIAL AI] Błąd generowania odpowiedzi:", error);
    
    // Fallback - szablon
    const subject = buildEmailSubject(originalSubject, campaign.name);
    const fallback = fallbackResponse(lead, campaign, materials, campaignLanguage);
    
    return {
      subject,
      content: fallback.content
    };
  }
}

/**
 * Buduje temat emaila - dodaje "Re:" jeśli brakuje
 */
function buildEmailSubject(originalSubject: string | null | undefined, campaignName: string): string {
  if (!originalSubject) {
    // Brak tematu - użyj domyślnego z "Re:"
    return `Re: ${campaignName}`;
  }
  
  // Usuń duplikaty "Re:" na początku (np. "Re: Re: Temat" -> "Re: Temat")
  let subject = originalSubject.trim();
  while (subject.match(/^re:\s*/i)) {
    subject = subject.replace(/^re:\s*/i, '');
  }
  
  // Dodaj "Re:" jeśli nie ma
  if (!subject.match(/^re:\s*/i)) {
    subject = `Re: ${subject}`;
  }
  
  return subject;
}

/**
 * Personalizuje statyczną treść przez AI (podstawia {firstName}, {materials}, etc.)
 */
async function personalizeStaticContent(
  staticContent: string,
  lead: { firstName: string | null; lastName: string | null; greetingForm: string | null },
  materials: Array<{ name: string; type: "LINK" | "ATTACHMENT"; url: string | null; fileName: string | null }>,
  language: string
): Promise<string> {
  
  // Prosta personalizacja - podstaw placeholder
  let content = staticContent;
  
  // Podstawienie podstawowych placeholderów (bez AI)
  const greeting = lead.greetingForm || 
    (lead.firstName ? `Dzień dobry ${lead.firstName}` : "Dzień dobry");
  
  content = content.replace(/\{firstName\}/g, lead.firstName || '');
  content = content.replace(/\{lastName\}/g, lead.lastName || '');
  content = content.replace(/\{greeting\}/g, greeting);
  
  // Materiały
  const materialsList = materials.map((m, idx) => {
    if (m.type === "LINK") {
      return `${idx + 1}. ${m.name}`;
    } else {
      return `${idx + 1}. ${m.name}`;
    }
  }).join('\n');
  
  content = content.replace(/\{materials\}/g, materialsList);
  content = content.replace(/\{materialsList\}/g, materialsList);
  
  // Jeśli są jeszcze inne placeholdery, użyj AI do dalszej personalizacji
  if (content.includes('{') && content.includes('}')) {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const prompt = `Otrzymałeś szablon emaila z placeholderami. Podstaw wszystkie placeholdery i zwróć finalną treść (BEZ placeholderów). Jeśli placeholder nie jest rozpoznawalny, użyj sensownej wartości lub pomiń go.

SZABLON:
${content}

LEAD:
Imię: ${lead.firstName || 'N/A'}
Nazwisko: ${lead.lastName || 'N/A'}
Powitanie: ${greeting}

MATERIAŁY:
${materialsList}

Zadanie: Zwróć TYLKO finalną treść emaila (bez placeholderów, bez JSON, bez dodatkowych komentarzy).`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Jesteś ekspertem w personalizacji emaili. Zwracasz TYLKO finalną treść, bez dodatkowych komentarzy."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3
      });
      
      // Track token usage
      if (response.usage) {
        await trackTokenUsage({
          operation: "material_response_personalize",
          model: "gpt-4o-mini",
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
        });
      }
      
      const aiContent = response.choices[0]?.message?.content;
      if (aiContent) {
        content = aiContent.trim();
      }
    } catch (error) {
      console.error("[MATERIAL AI] Błąd personalizacji przez AI:", error);
      // Zostaw content jak jest (z podstawionymi podstawowymi placeholderami)
    }
  }
  
  return content;
}

// ============================================================================
// PRIVATE FUNCTIONS
// ============================================================================

/**
 * Buduje prompt do analizy czy to prośba o materiały
 */
function buildAnalysisPrompt(
  leadResponse: string,
  campaignContext: string | null,
  language: string
): string {
  const languageInstructions = {
    pl: `Analizujesz odpowiedź email od leada w języku polskim.`,
    en: `You are analyzing an email response from a lead in English.`,
    de: `Sie analysieren eine E-Mail-Antwort von einem Lead auf Deutsch.`,
    fr: `Vous analysez une réponse email d'un lead en français.`
  };
  
  const lang = languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.pl;
  
  return `${lang}

KONTEKST KAMPANII:
${campaignContext || "Brak kontekstu"}

ODPOWIEDŹ LEADA:
${leadResponse}

ZADANIE:
Czy lead prosi o materiały (katalog, cennik, wycenę, broszurę, PDF, dokumentację)? 
Analizuj odpowiedź i określ:
1. Czy wyraża chęć otrzymania materiałów? (TAK/NIE)
2. Pewność swojej decyzji (0.0-1.0)
3. Uzasadnienie decyzji

Zwróć odpowiedź w formacie JSON:
{
  "isMaterialRequest": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Wyjaśnienie decyzji po polsku"
}`;
}

/**
 * Buduje prompt do generowania odpowiedzi z materiałami
 */
function buildResponsePrompt(
  lead: { firstName: string | null; lastName: string | null; greetingForm: string | null; language: string },
  campaign: { name: string; autoReplyContext: string | null; autoReplyRules: string | null },
  materials: Array<{ name: string; type: "LINK" | "ATTACHMENT"; url: string | null; fileName: string | null }>,
  leadOriginalResponse: string | undefined,
  campaignLanguage: string
): string {
  
  const greeting = lead.greetingForm || 
    (lead.firstName ? `Dzień dobry ${lead.firstName}` : "Dzień dobry");
  
  const materialsList = materials.map((m, idx) => {
    if (m.type === "LINK") {
      return `${idx + 1}. ${m.name} - link do pobrania: ${m.url}`;
    } else {
      return `${idx + 1}. ${m.name} (załącznik: ${m.fileName || "plik"})`;
    }
  }).join('\n');
  
  const languageInstructions = {
    pl: `Napisz profesjonalną odpowiedź email po polsku.`,
    en: `Write a professional email response in English.`,
    de: `Schreiben Sie eine professionelle E-Mail-Antwort auf Deutsch.`,
    fr: `Écrivez une réponse email professionnelle en français.`
  };
  
  const lang = languageInstructions[campaignLanguage as keyof typeof languageInstructions] || languageInstructions.pl;
  
  let prompt = `${lang}

KONTEKST KAMPANII:
${campaign.autoReplyContext || "Brak kontekstu"}

ZASADY GENEROWANIA ODPOWIEDZI (JSON):
${campaign.autoReplyRules || "{}"}

POWITANIE LEADU (użyj tego):
${greeting}

MATERIAŁY DO WYSŁANIA:
${materialsList}

${leadOriginalResponse ? `ODPOWIEDŹ LEADA (odnieś się do niej):\n${leadOriginalResponse}\n` : ''}

ZADANIE:
Wygeneruj profesjonalną, krótką odpowiedź email (2-3 zdania) która:
1. Dziękuje za zainteresowanie
2. Wspomina o materiałach które wysyłasz
3. Informuje o załącznikach/linkach
4. Jest napisana w języku: ${campaignLanguage}

Zwróć odpowiedź w formacie JSON:
{
  "subject": "Temat maila",
  "content": "Treść maila"
}`;
  
  return prompt;
}

/**
 * Wywołanie AI do analizy
 */
async function analyzeWithAI(prompt: string): Promise<{
  isMaterialRequest: boolean;
  confidence: number;
  reasoning: string;
}> {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Jesteś ekspertem w analizie emaili B2B. Analizujesz odpowiedzi leadów i określasz czy proszą o materiały (katalog, cennik, wycenę). Zwracasz TYLKO JSON, bez dodatkowych komentarzy."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  // Track token usage
  if (response.usage) {
    await trackTokenUsage({
      operation: "material_request_analysis",
      model: "gpt-4o-mini",
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
    });
  }
  
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Brak odpowiedzi od AI");
  }
  
  const parsed = JSON.parse(content);
  
  return {
    isMaterialRequest: parsed.isMaterialRequest === true,
    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
    reasoning: parsed.reasoning || "Brak uzasadnienia"
  };
}

/**
 * Wywołanie AI do generowania odpowiedzi
 */
async function generateWithAI(prompt: string, language: string): Promise<{
  subject: string;
  content: string;
}> {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  const languageModel = {
    pl: "Jesteś ekspertem w pisaniu profesjonalnych emaili B2B po polsku.",
    en: "You are an expert in writing professional B2B emails in English.",
    de: "Sie sind Experte für professionelle B2B-E-Mails auf Deutsch.",
    fr: "Vous êtes expert en rédaction d'emails B2B professionnels en français."
  };
  
  const systemPrompt = languageModel[language as keyof typeof languageModel] || languageModel.pl;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${systemPrompt} Zwracasz TYLKO JSON z polem "subject" i "content", bez dodatkowych komentarzy.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    response_format: { type: "json_object" }
  });
  
  // Track token usage
  if (response.usage) {
    await trackTokenUsage({
      operation: "material_response_generate",
      model: "gpt-4o-mini",
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      metadata: { language },
    });
  }
  
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Brak odpowiedzi od AI");
  }
  
  const parsed = JSON.parse(content);
  
  return {
    subject: parsed.subject || "Materiały - " + (language === 'pl' ? "Kreativia" : "Kreativia"),
    content: parsed.content || ""
  };
}

/**
 * Określa akcję na podstawie pewności
 */
function determineAction(confidence: number): "SEND" | "DONT_SEND" | "ASK_ADMIN" {
  if (confidence >= 0.8) {
    return "SEND"; // Wysoka pewność - wyślij automatycznie
  } else if (confidence >= 0.6) {
    return "ASK_ADMIN"; // Średnia pewność - zapytaj administratora
  } else {
    return "DONT_SEND"; // Niska pewność - nie wysyłaj
  }
}

/**
 * Fallback analiza (proste słowa kluczowe)
 */
function fallbackAnalysis(leadResponse: string, language: string): MaterialRequestAnalysis {
  const text = leadResponse.toLowerCase();
  
  const keywords = {
    pl: ["katalog", "cennik", "wycena", "wycenę", "materiały", "informacje", "proszę o", "prosze", "tak, proszę", "oczywiście"],
    en: ["catalog", "price", "quote", "materials", "information", "please", "yes please", "sure"],
    de: ["katalog", "preis", "angebot", "materialien", "information", "bitte", "ja bitte"],
    fr: ["catalogue", "prix", "devis", "matériaux", "informations", "s'il vous plaît", "oui s'il vous plaît"]
  };
  
  const langKeywords = keywords[language as keyof typeof keywords] || keywords.pl;
  
  let matches = 0;
  for (const keyword of langKeywords) {
    if (text.includes(keyword)) {
      matches++;
    }
  }
  
  const confidence = Math.min(0.7, matches * 0.15); // Max 0.7 dla fallback
  const isMaterialRequest = matches > 0;
  
  return {
    isMaterialRequest,
    confidence,
    reasoning: `Analiza heurystyczna: znaleziono ${matches} słów kluczowych związanych z prośbą o materiały`,
    suggestedAction: determineAction(confidence)
  };
}

/**
 * Fallback odpowiedź (szablon)
 */
function fallbackResponse(
  lead: { firstName: string | null; greetingForm: string | null },
  campaign: { name: string },
  materials: Array<{ name: string; type: "LINK" | "ATTACHMENT"; url: string | null; fileName: string | null }>,
  language: string
): MaterialResponseContent {
  
  const greeting = lead.greetingForm || 
    (lead.firstName ? `Dzień dobry ${lead.firstName}` : "Dzień dobry");
  
  const templates = {
    pl: {
      subject: "Materiały - " + campaign.name,
      content: `${greeting},\n\nDziękuję za zainteresowanie naszą ofertą.\n\nZałączam materiały:\n${materials.map(m => `- ${m.name}`).join('\n')}\n\nW razie pytań, proszę o kontakt.\n\nPozdrawiam`
    },
    en: {
      subject: "Materials - " + campaign.name,
      content: `${greeting},\n\nThank you for your interest in our offer.\n\nPlease find attached materials:\n${materials.map(m => `- ${m.name}`).join('\n')}\n\nIf you have any questions, please contact us.\n\nBest regards`
    },
    de: {
      subject: "Materialien - " + campaign.name,
      content: `${greeting},\n\nVielen Dank für Ihr Interesse an unserem Angebot.\n\nAnbei finden Sie die Materialien:\n${materials.map(m => `- ${m.name}`).join('\n')}\n\nBei Fragen kontaktieren Sie uns bitte.\n\nMit freundlichen Grüßen`
    },
    fr: {
      subject: "Matériaux - " + campaign.name,
      content: `${greeting},\n\nMerci pour votre intérêt pour notre offre.\n\nVeuillez trouver ci-joint les matériaux:\n${materials.map(m => `- ${m.name}`).join('\n')}\n\nSi vous avez des questions, n'hésitez pas à nous contacter.\n\nCordialement`
    }
  };
  
  const template = templates[language as keyof typeof templates] || templates.pl;
  
  return {
    subject: template.subject,
    content: template.content
  };
}

