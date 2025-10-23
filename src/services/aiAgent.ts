// AI Agent do automatycznej analizy i obsługi odpowiedzi emailowych
import { db } from "@/lib/db";
import { classifyReply } from "@/integrations/ai/client";

export interface AIAction {
  type: "FORWARD" | "BLOCK" | "UNSUBSCRIBE" | "ADD_LEAD" | "SCHEDULE_FOLLOWUP" | "NO_ACTION";
  priority: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  data?: any;
}

export interface AIAnalysis {
  classification: string;
  sentiment: string;
  confidence: number;
  summary: string;
  suggestedAction: string;
  extractedEmails: string[];
  extractedData: Record<string, any>;
  actions: AIAction[];
}

/**
 * Główna funkcja AI Agent - analizuje odpowiedź i podejmuje akcje
 */
export async function processReplyWithAI(replyId: number): Promise<AIAnalysis> {
  console.log(`[AI AGENT] Przetwarzam odpowiedź ID: ${replyId}`);
  
  // Pobierz odpowiedź z bazy
  const reply = await db.inboxReply.findUnique({
    where: { id: replyId },
    include: {
      lead: true, // Zawsze include, może być null
      campaign: {
        include: {
          virtualSalesperson: true
        }
      }
    }
  });

  if (!reply) {
    throw new Error(`Nie znaleziono odpowiedzi o ID: ${replyId}`);
  }

  // ============================================================================
  // WARMUP FILTER - Ignoruj warmup maile
  // ============================================================================
  
  // Sprawdź czy to warmup mail (maile między własnymi domenami)
  const isWarmupEmail = await isWarmupReply(reply);
  if (isWarmupEmail) {
    console.log(`[AI AGENT] Ignoruję warmup mail od: ${reply.fromEmail}`);
    
    // Oznacz jako przetworzone ale bez analizy
    await db.inboxReply.update({
      where: { id: replyId },
      data: {
        classification: "WARMUP_IGNORED",
        aiSummary: "Mail warmup - zignorowany przez AI Agent",
        suggestedAction: "Brak akcji - mail warmup",
        isHandled: true,
        isRead: true
      }
    });
    
    // Zwróć pustą analizę
    return {
      classification: "WARMUP_IGNORED",
      sentiment: "neutral",
      confidence: 1.0,
      summary: "Mail warmup - zignorowany",
      suggestedAction: "Brak akcji",
      extractedEmails: [],
      extractedData: {},
      actions: [{
        type: "NO_ACTION",
        priority: "LOW",
        description: "Mail warmup - zignorowany"
      }]
    };
  }

  // Analiza AI
  const analysis = await analyzeReply(reply.content, reply.fromEmail, reply.subject);
  
  // Podejmij akcje na podstawie analizy
  const actions = await executeActions(reply, analysis);
  
  // Aktualizuj odpowiedź w bazie
  await db.inboxReply.update({
    where: { id: replyId },
    data: {
      classification: analysis.classification,
      sentiment: analysis.sentiment,
      aiSummary: analysis.summary,
      suggestedAction: analysis.suggestedAction,
      extractedEmails: JSON.stringify(analysis.extractedEmails),
      extractedData: JSON.stringify(analysis.extractedData),
      isHandled: analysis.classification !== "OTHER", // Oznacz jako handled jeśli nie OTHER
      wasForwarded: actions.some(a => a.type === "FORWARD"),
      wasBlocked: actions.some(a => a.type === "BLOCK" || a.type === "UNSUBSCRIBE"),
      newContactsAdded: actions.filter(a => a.type === "ADD_LEAD").length,
      isRead: true
    }
  });

  console.log(`[AI AGENT] Zakończono przetwarzanie odpowiedzi ID: ${replyId}`);
  console.log(`[AI AGENT] Klasyfikacja: ${analysis.classification}, Akcje: ${actions.length}`);
  
  return {
    ...analysis,
    actions
  };
}

/**
 * Analizuje treść odpowiedzi używając AI
 */
async function analyzeReply(content: string, fromEmail: string, subject: string): Promise<Omit<AIAnalysis, 'actions'>> {
  console.log(`[AI AGENT] Analizuję odpowiedź od: ${fromEmail}`);
  
  // Klasyfikacja odpowiedzi - classifyReply zwraca cały obiekt ReplyClassification
  const classificationResult = await classifyReply(content);
  
  // Użyj danych z classifyReply
  return {
    classification: classificationResult.classification,
    sentiment: classificationResult.sentiment,
    confidence: 0.85, // TODO: Implement confidence scoring
    summary: classificationResult.aiSummary,
    suggestedAction: classificationResult.suggestedAction,
    extractedEmails: classificationResult.extractedEmails,
    extractedData: classificationResult.extractedData
  };
}

/**
 * Podejmuje akcje na podstawie analizy
 */
async function executeActions(reply: any, analysis: Omit<AIAnalysis, 'actions'>): Promise<AIAction[]> {
  const actions: AIAction[] = [];
  
  console.log(`[AI AGENT] Podejmuję akcje dla klasyfikacji: ${analysis.classification}`);
  
  switch (analysis.classification) {
    case "INTERESTED":
      // Wyślij do prawdziwego handlowca (jeśli jest ustawiony)
      if (reply.campaign?.virtualSalesperson?.realSalespersonEmail) {
        actions.push({
          type: "FORWARD",
          priority: "HIGH",
          description: `Przekaż odpowiedź zainteresowanego leada do prawdziwego handlowca: ${reply.campaign.virtualSalesperson.realSalespersonName || reply.campaign.virtualSalesperson.realSalespersonEmail}`,
          data: {
            realSalespersonEmail: reply.campaign.virtualSalesperson.realSalespersonEmail,
            realSalespersonName: reply.campaign.virtualSalesperson.realSalespersonName,
            leadEmail: reply.fromEmail,
            summary: analysis.summary
          }
        });
      } else {
        console.log("[AI AGENT] Brak prawdziwego handlowca przypisanego do wirtualnego handlowca - pomijam forward");
      }
      break;
      
    case "NOT_INTERESTED":
      if (reply.lead) {
        actions.push({
          type: "BLOCK",
          priority: "MEDIUM",
          description: `Zablokuj leada ${reply.lead.email} - nie jest zainteresowany`,
          data: {
            leadId: reply.lead.id,
            reason: "Not interested"
          }
        });
        actions.push({
          type: "BLOCK",
          priority: "HIGH",
          description: `Zablokuj leada ${reply.lead.email} (usunięcie ze wszystkich kampanii)`,
          data: {
            leadId: reply.lead.id
          }
        });
      }
      break;
      
    case "UNSUBSCRIBE":
      if (reply.lead) {
        actions.push({
          type: "UNSUBSCRIBE",
          priority: "HIGH",
          description: `Wypisz leada ${reply.lead.email} z wszystkich kampanii`,
          data: {
            leadId: reply.lead.id,
            reason: "Unsubscribe request"
          }
        });
        actions.push({
          type: "BLOCK",
          priority: "HIGH",
          description: `Zablokuj leada ${reply.lead.email} (usunięcie ze wszystkich kampanii)`,
          data: {
            leadId: reply.lead.id
          }
        });
      }
      break;
      
    case "OUT_OF_OFFICE":
    case "OOO":
      // NIE blokuj leada - dostanie kolejny email z follow-up
      // Wyciągnij emaile zastępców i sklonuj leada
      if (analysis.extractedEmails && analysis.extractedEmails.length > 0 && reply.lead) {
        // Spróbuj wyciągnąć dane kontaktów z extractedData
        const contacts = analysis.extractedData?.contacts || [];
        
        for (let i = 0; i < analysis.extractedEmails.length; i++) {
          const newEmail = analysis.extractedEmails[i];
          const contactInfo = contacts.find((c: any) => c.email === newEmail) || null;
          
          actions.push({
            type: "ADD_LEAD",
            priority: "HIGH",
            description: `Dodaj zastępcę z OOO: ${newEmail}`,
            data: {
              email: newEmail,
              cloneFromLeadId: reply.lead.id,
              campaignId: reply.campaignId,
              source: "OOO substitute",
              contactInfo: contactInfo
            }
          });
        }
      }
      break;
      
    case "REDIRECT":
      if (analysis.extractedEmails.length > 0) {
        actions.push({
          type: "ADD_LEAD",
          priority: "MEDIUM",
          description: `Dodaj nowy lead z przekierowania: ${analysis.extractedEmails[0]}`,
          data: {
            email: analysis.extractedEmails[0],
            originalEmail: reply.fromEmail,
            source: "Redirect from reply"
          }
        });
      }
      break;
      
    case "BOUNCE":
      if (reply.lead) {
        actions.push({
          type: "BLOCK",
          priority: "HIGH",
          description: `Zablokuj leada ${reply.lead.email} - nieprawidłowy email`,
          data: {
            leadId: reply.lead.id,
            reason: "Bounce - invalid email"
          }
        });
      }
      break;
      
    default:
      actions.push({
        type: "NO_ACTION",
        priority: "LOW",
        description: "Odpowiedź wymaga ręcznego przejrzenia"
      });
  }
  
  // Wykonaj akcje
  for (const action of actions) {
    try {
      await executeAction(action, reply);
      console.log(`[AI AGENT] Wykonano akcję: ${action.type} - ${action.description}`);
    } catch (error) {
      console.error(`[AI AGENT] Błąd wykonania akcji ${action.type}:`, error);
    }
  }
  
  return actions;
}

/**
 * Wykonuje konkretną akcję
 */
async function executeAction(action: AIAction, reply: any): Promise<void> {
  switch (action.type) {
    case "FORWARD":
      await forwardToSalesperson(action.data, reply);
      break;
      
    case "BLOCK":
      await blockLead(action.data.leadId, action.data.reason);
      break;
      
    case "UNSUBSCRIBE":
      await unsubscribeLead(action.data.leadId, action.data.reason);
      break;
      
    case "ADD_LEAD":
      await addNewLead(action.data);
      break;
      
    case "SCHEDULE_FOLLOWUP":
      await scheduleFollowUp(action.data);
      break;
      
    case "BLOCK":
      await removeFromCampaigns(action.data.leadId);
      break;
      
    case "NO_ACTION":
      // Brak akcji - tylko logowanie
      console.log(`[AI AGENT] Brak akcji dla odpowiedzi ID: ${reply.id}`);
      break;
  }
}

// Funkcje pomocnicze

function analyzeSentiment(content: string): string {
  const positiveWords = ["tak", "tak", "zainteresowany", "interesuje", "chcę", "proszę", "dziękuję"];
  const negativeWords = ["nie", "nie", "nieinteresuje", "nie chcę", "stop", "wypisz", "unsubscribe"];
  
  const lowerContent = content.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
  
  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

function extractEmails(content: string): string[] {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  return content.match(emailRegex) || [];
}

function extractData(content: string): Record<string, any> {
  const data: Record<string, any> = {};
  
  // Telefony
  const phoneRegex = /(\+?48\s?)?[0-9]{3}[\s-]?[0-9]{3}[\s-]?[0-9]{3}/g;
  const phones = content.match(phoneRegex);
  if (phones) data.phones = phones;
  
  // Firmy (proste wykrywanie)
  const companyWords = ["sp. z o.o.", "spółka", "ltd", "gmbh", "s.a.", "corp", "inc"];
  const foundCompanies = companyWords.filter(word => 
    content.toLowerCase().includes(word.toLowerCase())
  );
  if (foundCompanies.length > 0) data.companies = foundCompanies;
  
  return data;
}

function generateSummary(content: string, classification: string, sentiment: string): string {
  const maxLength = 150;
  let summary = "";
  
  switch (classification) {
    case "INTERESTED":
      summary = "Lead wyraża zainteresowanie ofertą i prosi o więcej informacji.";
      break;
    case "NOT_INTERESTED":
      summary = "Lead nie jest zainteresowany ofertą.";
      break;
    case "UNSUBSCRIBE":
      summary = "Lead prosi o usunięcie z listy mailingowej.";
      break;
    case "OUT_OF_OFFICE":
      summary = "Automatyczna odpowiedź 'out of office' - lead jest nieobecny.";
      break;
    case "REDIRECT":
      summary = "Lead przekierowuje na inny adres email.";
      break;
    case "BOUNCE":
      summary = "Email odbity - nieprawidłowy adres.";
      break;
    default:
      summary = "Odpowiedź wymaga ręcznego przejrzenia.";
  }
  
  // Dodaj fragment treści jeśli miejsce
  const remainingLength = maxLength - summary.length - 20;
  if (remainingLength > 0 && content.length > remainingLength) {
    summary += ` Treść: ${content.substring(0, remainingLength)}...`;
  }
  
  return summary;
}

function generateSuggestedAction(classification: string, sentiment: string, extractedEmails: string[]): string {
  switch (classification) {
    case "INTERESTED":
      return "Przekaż odpowiedź do handlowca i oznacz jako 'hot lead'";
    case "NOT_INTERESTED":
      return "Zablokuj leada aby nie wysyłać więcej emaili";
    case "UNSUBSCRIBE":
      return "Wypisz leada ze wszystkich kampanii natychmiast";
    case "OUT_OF_OFFICE":
      return "Zaplanuj follow-up za kilka dni";
    case "REDIRECT":
      return extractedEmails.length > 0 ? 
        `Dodaj nowy lead: ${extractedEmails[0]}` : 
        "Przejrzyj odpowiedź aby znaleźć nowy email";
    case "BOUNCE":
      return "Zablokuj leada - nieprawidłowy email";
    default:
      return "Przejrzyj odpowiedź ręcznie";
  }
}

// Funkcje wykonawcze

/**
 * Tłumaczy tekst na polski używając OpenAI API
 */
async function translateEmail(content: string): Promise<string> {
  console.log(`[AI AGENT] Tłumaczę email na polski...`);
  
  try {
    const { classifyReply } = await import("@/integrations/ai/client");
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.log("[AI AGENT] Brak OpenAI API key - pomijam tłumaczenie");
      return "[Tłumaczenie niedostępne - brak API key]";
    }
    
    // Użyj OpenAI do tłumaczenia
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: "Przetłumacz poniższy email biznesowy na język polski. Zachowaj profesjonalny ton i strukturę. Jeśli email jest już po polsku, zwróć go bez zmian."
      }, {
        role: "user",
        content
      }],
      temperature: 0.3
    });
    
    const translation = response.choices[0].message.content || "[Błąd tłumaczenia]";
    console.log(`[AI AGENT] Tłumaczenie zakończone sukcesem`);
    return translation;
    
  } catch (error) {
    console.error("[AI AGENT] Błąd tłumaczenia:", error);
    return "[Tłumaczenie niedostępne - błąd API]";
  }
}

async function forwardToSalesperson(data: any, reply: any): Promise<void> {
  if (!data.realSalespersonEmail) {
    console.log("[AI AGENT] Brak emaila prawdziwego handlowca - pomijam forward");
    return;
  }
  
  console.log(`[AI AGENT] Przygotowuję forward do handlowca: ${data.realSalespersonEmail}`);
  
  try {
    // Pobierz szczegóły kampanii i wysłanego emaila
    const campaign = reply.campaign || await db.campaign.findUnique({
      where: { id: reply.campaignId },
      include: {
        virtualSalesperson: true
      }
    });
    
    const lead = reply.lead || await db.lead.findUnique({
      where: { id: reply.leadId }
    });
    
    if (!lead || !campaign) {
      console.error("[AI AGENT] Brak danych leada lub kampanii");
      return;
    }
    
    // Znajdź wysłany email (oryginalny)
    const sentEmail = await db.sendLog.findFirst({
      where: {
        leadId: lead.id,
        campaignId: reply.campaignId,
        status: "sent"
      },
      orderBy: { createdAt: "desc" }
    });
    
    // Sprawdź czy kampania była po polsku (nie tłumacz jeśli tak)
    const campaignLanguage = campaign.virtualSalesperson?.language || "pl";
    const needsTranslation = campaignLanguage !== "pl";
    
    // Przetłumacz odpowiedź na polski (tylko jeśli kampania nie była po polsku)
    let translation = "";
    if (needsTranslation) {
      translation = await translateEmail(reply.content);
    }
    
    // Przygotuj temat emaila z oryginalnym tematem odpowiedzi
    const originalSubject = reply.subject || "Brak tematu";
    const emailSubject = `[LEAD ZAINTERESOWANY] ${originalSubject} | ${lead.firstName || ""} ${lead.lastName || ""} - ${lead.company || ""}`.trim();
    
    // Przygotuj treść emaila
    let emailBody = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 NOWY ZAINTERESOWANY LEAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 KTO ODPOWIEDZIAŁ:
├─ Email odpowiedzi: ${reply.fromEmail}
├─ Podsumowanie AI: ${reply.aiSummary || "Brak"}
├─ Źródło: ${campaign.name}
${reply.extractedEmails && JSON.parse(reply.extractedEmails).length > 0 ? `└─ ⚠️ PROSI O KONTAKT Z: ${JSON.parse(reply.extractedEmails).join(", ")}` : ""}

📋 DANE ORYGINALNEGO LEADA (do kogo wysłaliśmy):
├─ Imię i nazwisko: ${lead.firstName || ""} ${lead.lastName || ""}
├─ Firma: ${lead.company || ""}
├─ Email: ${lead.email}
├─ Telefon: ${lead.phone || "N/A"}
├─ Stanowisko: ${lead.title || "N/A"}
├─ Branża: ${lead.industry || "N/A"}
├─ Kraj: ${lead.companyCountry || "N/A"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 NASZ EMAIL DO LEADA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Temat: ${sentEmail?.subject || campaign.subject || "N/A"}
Wysłany: ${sentEmail?.createdAt ? new Date(sentEmail.createdAt).toLocaleString("pl-PL") : "N/A"}

${sentEmail?.content || campaign.text || "[Treść niedostępna]"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 ODPOWIEDŹ LEADA (oryginalna treść):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${reply.content}`;

    // Dodaj tłumaczenie tylko jeśli kampania nie była po polsku
    if (needsTranslation && translation) {
      emailBody += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 TŁUMACZENIE NA POLSKI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${translation}`;
    } else if (!needsTranslation) {
      emailBody += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️ UWAGA: Kampania była po polsku - nie tłumaczę odpowiedzi
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }
    
    emailBody += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 AKCJE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👉 Zobacz pełną kartę leada: ${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/leads/${lead.id}
👉 Zobacz inbox kampanii: ${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/campaigns/${campaign.id}/inbox
👉 Odpowiedz bezpośrednio na: ${reply.fromEmail}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ Wiadomość wygenerowana automatycznie przez AI Agent
   System Kreativia Mailing | ${new Date().toLocaleString("pl-PL")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
    
    // Wyślij email do prawdziwego handlowca
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: data.realSalespersonEmail,
      subject: emailSubject,
      text: emailBody,
      replyTo: lead.email
    });
    
    console.log(`[AI AGENT] ✅ Forward wysłany do: ${data.realSalespersonEmail}`);
    
  } catch (error) {
    console.error("[AI AGENT] Błąd wysyłki forward:", error);
  }
}

async function blockLead(leadId: number, reason: string): Promise<void> {
  await db.lead.update({
    where: { id: leadId },
    data: {
      status: "BLOCKED",
      blockedReason: reason,
      blockedAt: new Date(),
      isBlocked: true // Keep in sync for backward compatibility
    }
  });
  
  console.log(`[AI AGENT] Zablokowano leada ID: ${leadId}, powód: ${reason}`);
}

async function unsubscribeLead(leadId: number, reason: string): Promise<void> {
  await db.lead.update({
    where: { id: leadId },
    data: {
      status: "BLOCKED",
      blockedReason: reason,
      blockedAt: new Date(),
      isBlocked: true // Keep in sync for backward compatibility
    }
  });
  
  // TODO: Można dodać dodatkową tabelę dla unsubscribed
  console.log(`[AI AGENT] Wypisano leada ID: ${leadId}, powód: ${reason}`);
}

async function addNewLead(data: any): Promise<void> {
  console.log(`[AI AGENT] addNewLead wywołane dla: ${data.email}`);
  console.log(`[AI AGENT] Data:`, JSON.stringify(data));
  
  // Sprawdź czy lead już istnieje
  const existingLead = await db.lead.findFirst({
    where: { email: data.email }
  });
  
  if (existingLead) {
    console.log(`[AI AGENT] Lead ${data.email} już istnieje - pomijam`);
    return;
  }
  
  // Jeśli to klonowanie z OOO, sklonuj dane z oryginalnego leada
  if (data.cloneFromLeadId) {
    console.log(`[AI AGENT] Klonuję leada z ID: ${data.cloneFromLeadId}`);
    const originalLead = await db.lead.findUnique({
      where: { id: data.cloneFromLeadId },
      include: { LeadTag: { include: { tag: true } } }
    });
    
    if (!originalLead) {
      console.log(`[AI AGENT] Nie znaleziono oryginalnego leada ID: ${data.cloneFromLeadId}`);
      return;
    }
    
    // Wyciągnij imię i nazwisko z data.contactInfo (jeśli AI je znalazł)
    let firstName = null;
    let lastName = null;
    
    if (data.contactInfo && data.contactInfo.firstName && data.contactInfo.lastName) {
      firstName = data.contactInfo.firstName;
      lastName = data.contactInfo.lastName;
      console.log(`[AI AGENT] Użyto imienia z AI: ${firstName} ${lastName}`);
    } else {
      console.log(`[AI AGENT] Brak imienia/nazwiska z AI - pozostawiam puste`);
    }
    
    // Wygeneruj greeting dla nowego leada
    let greetingForm = "Dzień dobry";
    if (firstName && lastName && originalLead.language === "pl") {
      greetingForm = `Dzień dobry Panie/Pani ${firstName}`;
    } else if (firstName && lastName && originalLead.language === "de") {
      greetingForm = `Guten Tag ${firstName} ${lastName}`;
    } else if (firstName && lastName && originalLead.language === "en") {
      greetingForm = `Dear ${firstName} ${lastName}`;
    } else if (firstName && lastName && originalLead.language === "fr") {
      greetingForm = `Bonjour ${firstName} ${lastName}`;
    }
    
    console.log(`[AI AGENT] Greeting dla ${data.email}: ${greetingForm}`);
    
    // Sklonuj leada z nowymi danymi
    const newLead = await db.lead.create({
      data: {
        email: data.email,
        firstName: firstName,
        lastName: lastName,
        title: originalLead.title,
        company: originalLead.company,
        industry: originalLead.industry,
        keywords: originalLead.keywords,
        linkedinUrl: null,
        websiteUrl: originalLead.websiteUrl,
        companyCity: originalLead.companyCity,
        companyCountry: originalLead.companyCountry,
        language: originalLead.language,
        greetingForm: greetingForm,
        isBlocked: false
      }
    });
    
    console.log(`[AI AGENT] Sklonowano leada: ${newLead.email} z ID: ${originalLead.id}`);
    
    // Skopiuj tagi z oryginalnego leada
    if (originalLead.LeadTag && originalLead.LeadTag.length > 0) {
      for (const leadTag of originalLead.LeadTag) {
        await db.leadTag.create({
          data: {
            leadId: newLead.id,
            tagId: leadTag.tagId
          }
        });
        console.log(`[AI AGENT] Skopiowano tag: ${leadTag.tag.name}`);
      }
    }
    
    // Dodaj tag "Nowy kontakt"
    const nowyKontaktTag = await db.tag.findFirst({
      where: { name: "Nowy kontakt" }
    });
    
    if (nowyKontaktTag) {
      await db.leadTag.create({
        data: {
          leadId: newLead.id,
          tagId: nowyKontaktTag.id
        }
      });
      console.log(`[AI AGENT] Dodano tag: Nowy kontakt`);
    }
    
    // Dodaj do tej samej kampanii
    if (data.campaignId) {
      await db.campaignLead.create({
        data: {
          campaignId: data.campaignId,
          leadId: newLead.id
        }
      });
      console.log(`[AI AGENT] Dodano sklonowanego leada do kampanii ID: ${data.campaignId}`);
    }
  } else {
    // Zwykłe dodawanie leada (REDIRECT)
    console.log(`[AI AGENT] Dodaję nowy lead: ${data.email} (bez klonowania)`);
    // TODO: Implementuj dodawanie nowego leada z podstawowymi danymi
  }
}

async function scheduleFollowUp(data: any): Promise<void> {
  // TODO: Implementuj system follow-up
  console.log(`[AI AGENT] Zaplanuj follow-up dla ${data.email} na ${data.followupDate}`);
}

async function removeFromCampaigns(leadId: number): Promise<void> {
  const deletedCount = await db.campaignLead.deleteMany({
    where: { leadId }
  });
  
  console.log(`[AI AGENT] Usunięto leada ID: ${leadId} z ${deletedCount.count} kampanii`);
}

/**
 * Przetwarza wszystkie nieprzetworzone odpowiedzi
 */
export async function processAllPendingReplies(): Promise<void> {
  console.log("[AI AGENT] Rozpoczynam przetwarzanie wszystkich nieprzetworzonych odpowiedzi");
  
  const pendingReplies = await db.inboxReply.findMany({
    where: {
      classification: "PENDING" // lub inne pole oznaczające nieprzetworzone
    },
    take: 10 // Przetwarzaj po 10 na raz
  });
  
  console.log(`[AI AGENT] Znaleziono ${pendingReplies.length} nieprzetworzonych odpowiedzi`);
  
  for (const reply of pendingReplies) {
    try {
      await processReplyWithAI(reply.id);
    } catch (error) {
      console.error(`[AI AGENT] Błąd przetwarzania odpowiedzi ID ${reply.id}:`, error);
    }
  }
  
  console.log("[AI AGENT] Zakończono przetwarzanie nieprzetworzonych odpowiedzi");
}

/**
 * Sprawdza czy odpowiedź to warmup mail (maile między własnymi domenami)
 */
async function isWarmupReply(reply: any): Promise<boolean> {
  try {
    // Sprawdź czy nadawca to jedna z naszych skrzynek warmup
    const fromDomain = reply.fromEmail.split('@')[1];
    
    // Pobierz wszystkie aktywne skrzynki
    const mailboxes = await db.mailbox.findMany({
      where: {
        isActive: true,
        warmupStatus: {
          in: ['warming', 'ready'] // Skrzynki które mogą wysyłać warmup
        }
      },
      select: {
        email: true,
        warmupStatus: true
      }
    });
    
    // Sprawdź czy nadawca to jedna z naszych skrzynek
    const senderMailbox = mailboxes.find(mb => {
      const mailboxDomain = mb.email.split('@')[1];
      return mailboxDomain === fromDomain;
    });
    
    if (!senderMailbox) {
      return false; // To nie nasza skrzynka
    }
    
    // Sprawdź czy to mail warmup (maile do naszych własnych skrzynek)
    const toDomain = reply.subject?.includes('@') ? 
      reply.subject.split('@')[1] : null;
    
    if (!toDomain) {
      // Sprawdź w treści maila
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const emailsInContent = reply.content.match(emailRegex) || [];
      
      for (const email of emailsInContent) {
        const domain = email.split('@')[1];
        const isOurDomain = mailboxes.some(mb => {
          const mailboxDomain = mb.email.split('@')[1];
          return mailboxDomain === domain;
        });
        
        if (isOurDomain) {
          console.log(`[AI AGENT] Warmup mail wykryty: ${reply.fromEmail} -> ${email}`);
          return true;
        }
      }
      
      return false;
    }
    
    // Sprawdź czy domena docelowa to nasza domena
    const isOurDomain = mailboxes.some(mb => {
      const mailboxDomain = mb.email.split('@')[1];
      return mailboxDomain === toDomain;
    });
    
    if (isOurDomain) {
      console.log(`[AI AGENT] Warmup mail wykryty: ${reply.fromEmail} -> domena ${toDomain}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('[AI AGENT] Błąd podczas sprawdzania warmup maila:', error);
    return false; // W przypadku błędu, przetwórz normalnie
  }
}
