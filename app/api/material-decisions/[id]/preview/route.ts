import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateMaterialResponse } from "@/services/materialResponseAI";

/**
 * Zwraca domyślne powitanie w danym języku
 */
function getDefaultGreetingForLanguage(language: string): string {
  switch (language.toLowerCase()) {
    case 'de':
      return 'Guten Tag';
    case 'en':
      return 'Hello';
    case 'fr':
      return 'Bonjour';
    case 'pl':
    default:
      return 'Dzień dobry';
  }
}

/**
 * Funkcja convertToHtml - dokładnie taka sama jak w materialResponseSender.ts
 */
function convertToHtml(text: string): string {
  let html = text.replace(/\[LOGO\](.+?)\[\/LOGO\]/g, '<img src="$1" alt="Company Logo" style="max-width: 112px; margin: 20px 0;" />');
  html = html.replace(/\[LINK\](.+?)\[\/LINK:(.+?)\]/g, '<a href="$2" style="color: #0066cc; text-decoration: underline;">$1</a>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return html;
}

/**
 * Buduje pełną stopkę kampanii (dokładnie tak jak w materialResponseSender.ts)
 */
function buildCampaignSignature(
  virtualSalesperson: any,
  campaign: any,
  leadLanguage: string,
  companySettings: any
): string {
  let signature = "";
  
  // 1. Podpis handlowca (imię, nazwisko, telefon, email)
  if (virtualSalesperson) {
    signature += "\n\n**" + virtualSalesperson.name + "**";
    
    // Dodaj opis stanowiska z kampanii (jeśli istnieje)
    if (campaign?.jobDescription) {
      signature += "\n" + campaign.jobDescription;
    }
    
    signature += "\n";
    if (virtualSalesperson.phone) {
      signature += "\nM. " + virtualSalesperson.phone;
    }
    // Używaj email głównej skrzynki w podpisie
    const signatureEmail = virtualSalesperson.mainMailbox?.email || virtualSalesperson.email;
    signature += "\nE. " + signatureEmail;
  }
  
  // 3. PS. z kampanii (jeśli istnieje)
  if (campaign?.postscript) {
    signature += "\n\n**PS.** " + campaign.postscript;
  }
  
  // 4. Logo (jeśli istnieje w ustawieniach)
  if (companySettings?.logoBase64) {
    signature += "\n[LOGO]" + companySettings.logoBase64 + "[/LOGO]";
  }
  
  // 5. Adres firmy z ustawień
  if (companySettings?.address) {
    signature += "\n" + companySettings.address;
  } else {
    // Fallback na domyślny adres
    signature += "\n\n";
    signature += "**Showroom & Office & Production:**\n";
    signature += "ul. Bukowska 16\n";
    signature += "62-081 Wysogotowo, PL";
  }
  
  // 6. Link do strony kampanii (jeśli istnieje)
  if (campaign?.linkText) {
    const displayText = campaign.linkText;
    const targetUrl = campaign.linkUrl || campaign.linkText;
    signature += "\n\n**Visit our site:** [LINK]" + displayText + "[/LINK:" + targetUrl + "]";
  }
  
  // 7. Stopka prawna z ustawień
  if (companySettings?.legalFooter) {
    signature += "\n\n" + companySettings.legalFooter;
  } else {
    // Fallback na domyślną stopkę
    signature += "\n\n";
    signature += "The content of this message is confidential and covered by the NDA. ";
    signature += "The recipient can only be the recipient of the exclusion of third party access. ";
    signature += "If you are not the addressee of this message, or employee is authorized to transfer it to the addressee, ";
    signature += "to announce that its dissemination, copying or distribution is prohibited. ";
    signature += "If you have received this message in error, please notify the sender by sending a reply ";
    signature += "and delete this message with attachments from your mailbox. Thank you. Kreativia.";
  }
  
  return signature;
}

/**
 * GET /api/material-decisions/[id]/preview - Generuj podgląd odpowiedzi dla decyzji
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decisionId = parseInt(params.id);

    const decision = await db.pendingMaterialDecision.findUnique({
      where: { id: decisionId },
      include: {
        lead: true,
        campaign: {
          include: {
            virtualSalesperson: {
              include: {
                mainMailbox: {
                  select: {
                    email: true
                  }
                }
              }
            },
            materials: {
              where: { isActive: true },
              orderBy: { order: 'asc' }
            }
          }
        },
        reply: true
      }
    });

    if (!decision) {
      return NextResponse.json(
        { success: false, error: "Decyzja nie została znaleziona" },
        { status: 404 }
      );
    }

    // Wygeneruj podstawową treść odpowiedzi
    const campaignLanguage = decision.campaign.virtualSalesperson?.language || decision.lead.language || 'pl';
    
    const responseContent = await generateMaterialResponse(
      {
        firstName: decision.lead.firstName,
        lastName: decision.lead.lastName,
        greetingForm: decision.lead.greetingForm,
        language: decision.lead.language || 'pl'
      },
      {
        id: decision.campaign.id,
        name: decision.campaign.name,
        autoReplyContext: decision.campaign.autoReplyContext,
        autoReplyRules: decision.campaign.autoReplyRules,
        virtualSalespersonLanguage: decision.campaign.virtualSalesperson?.language || null,
        autoReplyContent: decision.campaign.autoReplyContent
      },
      decision.campaign.materials.map(m => ({
        name: m.name,
        type: m.type as "LINK" | "ATTACHMENT",
        url: m.url,
        fileName: m.fileName
      })),
      decision.leadResponse,
      decision.reply.subject || null
    );

    // ✅ ZBUDUJ PEŁNĄ TREŚĆ EMAILA (jak w materialResponseSender.ts):
    // 1. Powitanie + treść odpowiedzi
    // 2. Info o opiekunie (jeśli włączone)
    // 3. Linki do materiałów
    // 4. Pełna stopka kampanii
    // 5. Cytat z odpowiedzi leada

    // Sprawdź język kampanii vs język leada
    const leadLanguage = decision.lead.language || 'pl';
    const languageMismatch = campaignLanguage !== leadLanguage;
    
    let greetingForm: string | null = null;
    
    if (languageMismatch) {
      if (decision.lead.firstName) {
        try {
          const { chatgptService } = await import('@/services/chatgptService');
          const results = await chatgptService.batchProcessNames(
            [decision.lead.firstName],
            [decision.lead.lastName || ''],
            [campaignLanguage]
          );
          
          if (results && results.length > 0 && results[0]?.greetingForm) {
            greetingForm = results[0].greetingForm;
          }
        } catch (error: any) {
          greetingForm = getDefaultGreetingForLanguage(campaignLanguage);
        }
      } else {
        greetingForm = getDefaultGreetingForLanguage(campaignLanguage);
      }
    } else {
      greetingForm = decision.lead.greetingForm;
    }

    // 1. Buduj treść: greetingForm + "\n\n" + content
    let emailContent = '';
    if (greetingForm) {
      emailContent = greetingForm + "\n\n" + responseContent.content;
    } else {
      emailContent = responseContent.content;
    }

    // 2. (Opcjonalnie) Info o opiekunie przed stopką
    if (decision.campaign.autoReplyIncludeGuardian && decision.campaign.virtualSalesperson) {
      const salesperson = decision.campaign.virtualSalesperson;
      const realName = salesperson.realSalespersonName;
      const realEmail = salesperson.realSalespersonEmail;
      const realPhone = salesperson.realSalespersonPhone;
      const realSignature = salesperson.realSalespersonSignature;
      
      if (realName && realEmail) {
        // Tekst wprowadzający (jeśli ustawiony)
        const introText = decision.campaign.autoReplyGuardianIntroText?.trim();
        if (introText) {
          emailContent += '\n\n\n\n' + introText; // ✅ Dwa dodatkowe entery przed tekstem
        }
        
        // Formatowanie danych handlowca (BOLD dla imienia)
        emailContent += '\n\n**' + realName + '**';
        if (realSignature) {
          emailContent += '\n' + realSignature;
        }
        if (realPhone || realEmail) {
          emailContent += '\n';
          if (realPhone) {
            emailContent += '\nM. ' + realPhone;
          }
          if (realEmail) {
            emailContent += '\nE. ' + realEmail;
          }
        }
      }
    }

    // 3. Linki do materiałów (jeśli są) - PRZED stopką
    const links = decision.campaign.materials.filter(m => m.type === 'LINK' && m.url);
    if (links.length > 0) {
      emailContent += '\n\n';
      links.forEach(link => {
        emailContent += `\n${link.name}: ${link.url}`;
      });
    }

    // 4. Pełna stopka kampanii
    const companySettings = await db.companySettings.findFirst();
    
    if (decision.campaign.autoReplyIncludeGuardian || links.length > 0) {
      emailContent += '\n\n\n'; // 3 entery
    }
    
    const signature = buildCampaignSignature(
      decision.campaign.virtualSalesperson,
      decision.campaign,
      leadLanguage,
      companySettings
    );
    
    emailContent += signature;

    // 5. Cytat z odpowiedzi leada NA KOŃCU
    if (decision.reply?.content && decision.reply?.fromEmail && decision.reply?.receivedAt) {
      const replyDate = new Date(decision.reply.receivedAt);
      const dateStr = replyDate.toLocaleDateString('pl-PL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      const timeStr = replyDate.toLocaleTimeString('pl-PL', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // ✅ Wyczyść treść odpowiedzi leada z HTML, ale ZACHOWAJ formatowanie (puste linie, odstępy)
      let leadReplyText = decision.reply.content
        .replace(/<[^>]+>/g, '') // Usuń HTML tagi
        .replace(/&nbsp;/g, ' ') // Zamień &nbsp; na spacje
        .replace(/&amp;/g, '&') // Przywróć &
        .replace(/&lt;/g, '<') // Przywróć <
        .replace(/&gt;/g, '>') // Przywróć >
        .replace(/&quot;/g, '"') // Przywróć "
        // ✅ NIE usuń wielokrotnych \n - zachowaj puste linie dla formatowania
        .trim();
      
      // ✅ Wyciągnij TYLKO bezpośrednią odpowiedź leada (usuń zagnieżdżone cytaty)
      const lines = leadReplyText.split('\n');
      let directReplyLines: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (
          trimmedLine.startsWith('>') ||
          trimmedLine.match(/^Wiadomość napisana przez/i) ||
          trimmedLine.match(/^Message written by/i) ||
          trimmedLine.match(/^On .+ wrote:/i) ||
          trimmedLine.match(/^-----/i) ||
          trimmedLine.match(/^From:/i) ||
          trimmedLine === '--'
        ) {
          break;
        }
        
        // ✅ Zachowaj pustą linię jeśli istnieje (dla formatowania)
        directReplyLines.push(line);
      }
      
      // ✅ Usuń puste linie tylko na początku i końcu, ale ZACHOWAJ w środku
      let cleanReplyText = directReplyLines.join('\n');
      cleanReplyText = cleanReplyText.replace(/^\n+/, '').replace(/\n+$/, '');
      
      if (cleanReplyText) {
        const languageLabels = {
          pl: 'Wiadomość napisana przez',
          en: 'Message written by',
          de: 'Nachricht geschrieben von',
          fr: 'Message écrit par'
        };
        
        const label = languageLabels[campaignLanguage as keyof typeof languageLabels] || languageLabels.pl;
        const leadName = `${decision.lead.firstName || ''} ${decision.lead.lastName || ''}`.trim() || decision.lead.email;
        
        // ✅ Dodaj odstępy przed cytatem i wizualne oznaczenie
        emailContent += '\n\n\n';
        emailContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        emailContent += `${label} ${leadName} w dniu ${dateStr}, o godz. ${timeStr}:\n`;
        emailContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        // ✅ Dodaj prefix "> " do każdej linii cytatu, ZACHOWAJ puste linie (są ważne dla formatowania!)
        const quotedLines = cleanReplyText.split('\n').map(line => {
          if (line.trim() === '') {
            // Pusta linia - zachowaj jako pustą linię (będzie renderowana jako odstęp w HTML)
            return '>';
          } else {
            return `> ${line}`;
          }
        });
        emailContent += quotedLines.join('\n');
        emailContent += '\n\n';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        subject: responseContent.subject,
        content: emailContent, // ✅ Pełna treść z opiekunem, stopką i cytatem
        materials: decision.campaign.materials.map(m => ({
          id: m.id,
          name: m.name,
          type: m.type,
          url: m.url,
          fileName: m.fileName
        }))
      }
    });
  } catch (error: any) {
    console.error("[MATERIAL DECISION PREVIEW] Błąd:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas generowania podglądu" },
      { status: 500 }
    );
  }
}

