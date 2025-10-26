// Placeholder AI klient: generowanie krótkiej personalizacji i klasyfikacja odpowiedzi

export async function generatePersonalization(
  firstName: string | null, 
  lastName: string | null,
  company: string | null, 
  industry: string | null, 
  title: string | null,
  companyCity: string | null,
  companyCountry: string | null,
  campaignText?: string,
  language: string = 'pl'
) {
  // TODO: wywołanie dostawcy AI (OpenAI/Azure)
  // Na razie zwracamy przykładową personalizację
  
  if (campaignText) {
    // Prosta personalizacja - tylko "Dzień dobry Panie/Pani [Imię]!" na początku
    let personalizedText = campaignText;
    
    // Zamień podstawowe placeholdery jeśli są w tekście
    if (firstName) {
      personalizedText = personalizedText.replace(/\[IMIĘ\]/g, firstName);
      personalizedText = personalizedText.replace(/\[NAME\]/g, firstName);
    }
    
    if (lastName) {
      personalizedText = personalizedText.replace(/\[NAZWISKO\]/g, lastName);
      personalizedText = personalizedText.replace(/\[LASTNAME\]/g, lastName);
    }
    
    if (company) {
      personalizedText = personalizedText.replace(/\[FIRMA\]/g, company);
      personalizedText = personalizedText.replace(/\[COMPANY\]/g, company);
    }
    
    if (industry) {
      personalizedText = personalizedText.replace(/\[BRANŻA\]/g, industry);
      personalizedText = personalizedText.replace(/\[INDUSTRY\]/g, industry);
    }
    
    if (title) {
      personalizedText = personalizedText.replace(/\[STANOWISKO\]/g, title);
      personalizedText = personalizedText.replace(/\[TITLE\]/g, title);
    }
    
           // Dodaj personalizację na początku tekstu
           const greeting = await generateSimpleGreeting(firstName, lastName, language);
           personalizedText = greeting + "\n\n" + personalizedText;
    
    return personalizedText;
  }
  
  // Stara logika - tylko personalizacja
  return generateBasicPersonalization(firstName, lastName, company, industry, title, companyCity, companyCountry, language);
}

async function generateSimpleGreeting(firstName: string | null, lastName: string | null, language: string = 'pl') {
  if (!firstName) {
    return language === 'pl' ? "Dzień dobry" : "Hello";
  }
  
  const name = firstName.trim();
  const surname = lastName ? lastName.trim() : null;
  
  switch (language.toLowerCase()) {
    case 'pl':
      return await generatePolishGreeting(name);
    case 'en':
      return generateEnglishGreeting(surname || name);
    case 'de':
      return generateGermanGreeting(surname || name);
    case 'fr':
      return generateFrenchGreeting(surname || name);
    default:
      return await generatePolishGreeting(name);
  }
}

async function generatePolishGreeting(name: string) {
  const isFemale = name.toLowerCase().endsWith('a');
  const title = isFemale ? "Pani" : "Panie";
  
  // Użyj AI do poprawnej odmiany imienia
  const declinedName = await getPolishNameDeclension(name, isFemale);
  
  return `Dzień dobry ${title} ${declinedName}`;
}

async function getPolishNameDeclension(name: string, isFemale: boolean): Promise<string> {
  // TODO: Wywołanie AI (OpenAI/Azure) do poprawnej odmiany
  // Na razie zwracamy prostą logikę jako fallback
  
  if (isFemale) {
    // Pani + imię w wołaczu
    if (name.toLowerCase().endsWith('a')) {
      return name.slice(0, -1) + 'o';
    }
    return name;
  } else {
    // Panie + imię w dopełniaczu
    const nameLower = name.toLowerCase();
    
    // Proste przypadki
    if (nameLower === 'piotr') return 'Piotrze';
    if (nameLower === 'jakub') return 'Jakubie';
    if (nameLower === 'marek') return 'Marku';
    if (nameLower === 'paweł') return 'Pawle';
    if (nameLower === 'michał') return 'Michale';
    if (nameLower === 'krzysztof') return 'Krzysztofie';
    if (nameLower === 'tomasz') return 'Tomaszu';
    if (nameLower === 'andrzej') return 'Andrzeju';
    if (nameLower === 'marcin') return 'Marcinie';
    if (nameLower === 'dawid') return 'Dawidzie';
    
    // Fallback - dodaj -ie
    return name + 'ie';
  }
}

function generateEnglishGreeting(surname: string) {
  const isFemale = surname.toLowerCase().endsWith('a') || surname.toLowerCase().endsWith('e');
  const title = isFemale ? "Ms." : "Mr.";
  return `Dear ${title} ${surname}`;
}

function generateGermanGreeting(surname: string) {
  const isFemale = surname.toLowerCase().endsWith('a') || surname.toLowerCase().endsWith('e');
  const title = isFemale ? "Frau" : "Herr";
  return `Guten Tag ${title} ${surname}`;
}

function generateFrenchGreeting(surname: string) {
  const isFemale = surname.toLowerCase().endsWith('a') || surname.toLowerCase().endsWith('e');
  const title = isFemale ? "Madame" : "Monsieur";
  return `Bonjour ${title} ${surname}`;
}

function generateBasicPersonalization(
  firstName: string | null, 
  lastName: string | null,
  company: string | null, 
  industry: string | null, 
  title: string | null,
  companyCity: string | null,
  companyCountry: string | null,
  language: string = 'pl'
) {
  const parts = [];
  
  if (firstName) {
    parts.push(`Cześć ${firstName}!`);
  } else {
    parts.push("Witam!");
  }
  
  if (company) {
    parts.push(`Widzę, że pracujesz w ${company}`);
  }
  
  if (industry) {
    parts.push(`w branży ${industry}`);
  }
  
  if (title) {
    parts.push(`jako ${title}`);
  }
  
  if (companyCity && companyCountry) {
    parts.push(`z ${companyCity}, ${companyCountry}`);
  }
  
  parts.push("- to świetne połączenie!");
  
  return parts.join(" ");
}

// Stara, prosta klasyfikacja (zakomentowana, może się przydać)
// export type ReplyClass = "OOO" | "NO" | "YES" | "UNKNOWN";
// export async function classifyReplySimple(text: string): Promise<ReplyClass> { ... }

/**
 * Klasyfikuje odpowiedź z maila przy użyciu AI
 */
export interface ReplyClassification {
  classification: "INTERESTED" | "NOT_INTERESTED" | "UNSUBSCRIBE" | "OOO" | "REDIRECT" | "BOUNCE" | "OTHER";
  sentiment: "positive" | "negative" | "neutral";
  aiSummary: string;
  suggestedAction: string;
  extractedEmails: string[]; // Adresy email znalezione w odpowiedzi (zastępcy)
  extractedData: {
    newContactName?: string;
    oooReturnDate?: string;
    phoneNumber?: string;
    [key: string]: any;
  };
}

/**
 * Klasyfikuje odpowiedź używając OpenAI API
 */
async function classifyReplyWithAI(
  replyContent: string,
  language: string = 'pl'
): Promise<ReplyClassification> {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `Jesteś ekspertem od analizy odpowiedzi emailowych w kampaniach marketingowych.
Przeanalizuj poniższą odpowiedź i sklasyfikuj ją według następujących kategorii:

KATEGORIE:
- INTERESTED: Osoba jest zainteresowana ofertą, chce więcej informacji, prosi o kontakt
- NOT_INTERESTED: Osoba NIE jest zainteresowana, odmawia, nie potrzebuje
- UNSUBSCRIBE: Osoba prosi o usunięcie z listy mailingowej, zgłasza spam
- OOO: Automatyczna odpowiedź "out of office", osoba na urlopie
- REDIRECT: Osoba przekierowuje do innej osoby, podaje inny kontakt
- BOUNCE: Email odbity, błąd dostarczenia
- OTHER: Inne odpowiedzi, które nie pasują do powyższych kategorii

WAŻNE ZASADY:
1. Zwróć szczególną uwagę na negacje! "Nie jestem zainteresowany" to NOT_INTERESTED, NIE INTERESTED!
2. W "extractedEmails" i "contacts" WYCIĄGAJ TYLKO kontakty osób zastępczych lub przekierowanych
3. NIE WYCIĄGAJ adresów nadawców wiadomości (np. z pola "From:" lub podpisu nadawcy)
4. NIE WYCIĄGAJ adresów z cytowanej wiadomości oryginalnej (po znaku ">")
5. Wyciągaj TYLKO adresy osób trzecich, do których odbiorca przekierowuje kontakt

Odpowiedź do analizy:
"""
${replyContent}
"""

Odpowiedz w formacie JSON:
{
  "classification": "INTERESTED" | "NOT_INTERESTED" | "UNSUBSCRIBE" | "OOO" | "REDIRECT" | "BOUNCE" | "OTHER",
  "sentiment": "positive" | "negative" | "neutral",
  "aiSummary": "krótkie podsumowanie (max 150 znaków)",
  "suggestedAction": "sugerowana akcja (max 100 znaków)",
  "extractedEmails": ["lista emaili osób zastępczych - NIE nadawców!"],
  "extractedData": {
    "contacts": [
      {
        "email": "email@example.com",
        "firstName": "Imię",
        "lastName": "Nazwisko"
      }
    ],
    "oooReturnDate": "data powrotu (jeśli OOO)",
    "phoneNumber": "numer telefonu (jeśli podano)"
  }
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Jesteś ekspertem od analizy odpowiedzi emailowych. Odpowiadasz TYLKO w formacie JSON." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 500
  });

  // Track token usage
  if (response.usage) {
    const { trackTokenUsage } = await import("@/services/tokenTracker");
    await trackTokenUsage({
      operation: "email_classification",
      model: "gpt-4o-mini",
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      metadata: { language }
    });
  }

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Brak odpowiedzi z OpenAI");
  }

  try {
    // Usuń markdown code blocks jeśli są
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }
    
    const result = JSON.parse(cleanContent);
    console.log(`[AI] Sklasyfikowano jako: ${result.classification}`);
    return result;
  } catch (error) {
    console.error("[AI] Błąd parsowania odpowiedzi JSON:", content);
    throw new Error("Nieprawidłowy format odpowiedzi z OpenAI");
  }
}

export async function classifyReply(
  replyContent: string,
  language: string = 'pl'
): Promise<ReplyClassification> {
  // Spróbuj użyć OpenAI API jeśli dostępny
  const useAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0;
  
  if (useAI) {
    try {
      return await classifyReplyWithAI(replyContent, language);
    } catch (error) {
      console.error("[AI] Błąd klasyfikacji przez OpenAI, używam fallback:", error);
      // Fallback do heurystyki
    }
  }
  
  // Fallback: prosta heurystyka
  const contentLower = replyContent.toLowerCase();
  
  // Wykrywanie UNSUBSCRIBE
  if (
    contentLower.includes("usuń") ||
    contentLower.includes("unsubscribe") ||
    contentLower.includes("remove") ||
    contentLower.includes("skąd") ||
    contentLower.includes("spam")
  ) {
    return {
      classification: "UNSUBSCRIBE",
      sentiment: "negative",
      aiSummary: "Klient prosi o wypisanie z listy mailingowej",
      suggestedAction: "Kontakt został automatycznie zablokowany",
      extractedEmails: [],
      extractedData: {}
    };
  }
  
  // Wykrywanie OOO
  if (
    contentLower.includes("urlop") ||
    contentLower.includes("out of office") ||
    contentLower.includes("vacation") ||
    contentLower.includes("urlaub") ||
    contentLower.includes("congé")
  ) {
    // Próba wyciągnięcia emaili zastępców
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    let foundEmails = replyContent.match(emailRegex) || [];
    
    // ❌ FILTRUJ: Usuń emaile z cytowanej wiadomości (po ">")
    foundEmails = foundEmails.filter(email => {
      // Znajdź pozycję emaila w tekście
      const emailIndex = replyContent.indexOf(email);
      if (emailIndex === -1) return false;
      
      // Znajdź ostatni znak ">" przed tym emailem (max 500 znaków wstecz)
      const textBefore = replyContent.substring(Math.max(0, emailIndex - 500), emailIndex);
      const lastQuoteIndex = textBefore.lastIndexOf('>');
      
      // Jeśli ostatni ">" jest dalej niż 100 znaków - to prawdopodobnie w cytacie
      return lastQuoteIndex === -1 || (emailIndex - lastQuoteIndex) > 100;
    });
    
    // Usuń duplikaty
    foundEmails = [...new Set(foundEmails)];
    
    return {
      classification: "OOO",
      sentiment: "neutral",
      aiSummary: foundEmails.length > 0 
        ? `Osoba na urlopie, podano kontakt zastępczy: ${foundEmails.join(", ")}`
        : "Osoba na urlopie (brak kontaktu zastępczego)",
      suggestedAction: foundEmails.length > 0
        ? `Automatycznie dodano ${foundEmails.length} nowy kontakt`
        : "Brak akcji - osoba na urlopie",
      extractedEmails: foundEmails,
      extractedData: {}
    };
  }
  
  // Wykrywanie BRAKU zainteresowania (negacja)
  if (
    contentLower.includes("nie jestem zainteresowany") ||
    contentLower.includes("nie zainteresowany") ||
    contentLower.includes("not interested") ||
    contentLower.includes("no interest") ||
    contentLower.includes("nie interesuje") ||
    contentLower.includes("brak zainteresowania") ||
    contentLower.includes("nie chcę") ||
    contentLower.includes("don't want") ||
    contentLower.includes("nie potrzebuję") ||
    contentLower.includes("nie potrzebujemy")
  ) {
    return {
      classification: "NOT_INTERESTED",
      sentiment: "negative",
      aiSummary: "Klient nie jest zainteresowany ofertą",
      suggestedAction: "Zablokuj kontakt - brak zainteresowania",
      extractedEmails: [],
      extractedData: {}
    };
  }
  
  // Wykrywanie zainteresowania (TYLKO jeśli nie ma negacji)
  if (
    contentLower.includes("zainteresowany") ||
    contentLower.includes("interested") ||
    contentLower.includes("ofert") ||
    contentLower.includes("offer") ||
    contentLower.includes("więcej informacji") ||
    contentLower.includes("more information") ||
    contentLower.includes("proszę zadzwonić") ||
    contentLower.includes("call me") ||
    contentLower.includes("please call")
  ) {
    return {
      classification: "INTERESTED",
      sentiment: "positive",
      aiSummary: "Klient wyraża zainteresowanie - czeka na kontakt",
      suggestedAction: "Skontaktuj się z klientem telefonicznie lub mailem",
      extractedEmails: [],
      extractedData: {}
    };
  }
  
  // Domyślnie - inne
  return {
    classification: "OTHER",
    sentiment: "neutral",
    aiSummary: "Odpowiedź wymaga ręcznego przejrzenia",
    suggestedAction: "Przejrzyj treść odpowiedzi i zdecyduj o dalszych krokach",
    extractedEmails: [],
    extractedData: {}
  };
}

