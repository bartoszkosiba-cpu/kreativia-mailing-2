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

export interface MaterialRequestAnalysis {
  isMaterialRequest: boolean; // Czy to prośba o materiały
  confidence: number; // Pewność AI (0.0-1.0)
  reasoning: string; // Uzasadnienie decyzji AI
  suggestedAction: "SEND" | "DONT_SEND" | "ASK_ADMIN"; // Sugerowana akcja
}

export interface MaterialResponseContent {
  subject: string; // Temat maila
  content: string; // Treść maila (w języku kampanii)
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
  },
  materials: Array<{
    name: string;
    type: "LINK" | "ATTACHMENT";
    url: string | null;
    fileName: string | null;
  }>,
  leadOriginalResponse?: string // Opcjonalnie: treść odpowiedzi leada
): Promise<MaterialResponseContent> {
  
  // Język kampanii = język handlowca lub język leada
  const campaignLanguage = campaign.virtualSalespersonLanguage || lead.language || 'pl';
  const prompt = buildResponsePrompt(lead, campaign, materials, leadOriginalResponse, campaignLanguage);
  
  try {
    const aiResponse = await generateWithAI(prompt, campaignLanguage);
    
    return {
      subject: aiResponse.subject,
      content: aiResponse.content
    };
  } catch (error) {
    console.error("[MATERIAL AI] Błąd generowania odpowiedzi:", error);
    
    // Fallback - szablon
    const campaignLanguage = campaign.virtualSalespersonLanguage || lead.language || 'pl';
    return fallbackResponse(lead, campaign, materials, campaignLanguage);
  }
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

