import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateMaterialResponse } from "@/services/materialResponseAI";
import * as fs from "fs";
import * as path from "path";

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
  // Najpierw konwertuj logo [LOGO]base64[/LOGO] na <img>
  let html = text.replace(/\[LOGO\](.+?)\[\/LOGO\]/g, '<img src="$1" alt="Company Logo" style="max-width: 112px; margin: 20px 0;" />');
  // Konwertuj linki [LINK]text[/LINK:url] na <a href="url">text</a>
  html = html.replace(/\[LINK\](.+?)\[\/LINK:(.+?)\]/g, '<a href="$2" style="color: #0066cc; text-decoration: underline;">$1</a>');
  // Konwertuj **bold** na <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return html;
}

/**
 * Buduje pełną stopkę kampanii
 */
function buildCampaignSignature(
  virtualSalesperson: any,
  campaign: any,
  leadLanguage: string,
  companySettings: any
): string {
  let signature = "";
  
  if (virtualSalesperson) {
    signature += "\n\n**" + virtualSalesperson.name + "**";
    
    if (campaign?.jobDescription) {
      signature += "\n" + campaign.jobDescription;
    }
    
    signature += "\n";
    if (virtualSalesperson.phone) {
      signature += "\nM. " + virtualSalesperson.phone;
    }
    const signatureEmail = virtualSalesperson.mainMailbox?.email || virtualSalesperson.email;
    signature += "\nE. " + signatureEmail;
  }
  
  if (campaign?.postscript) {
    signature += "\n\n**PS.** " + campaign.postscript;
  }
  
  if (companySettings?.logoBase64) {
    signature += "\n[LOGO]" + companySettings.logoBase64 + "[/LOGO]";
  }
  
  if (companySettings?.address) {
    signature += "\n" + companySettings.address;
  } else {
    signature += "\n\n";
    signature += "**Showroom & Office & Production:**\n";
    signature += "ul. Bukowska 16\n";
    signature += "62-081 Wysogotowo, PL";
  }
  
  if (campaign?.linkText) {
    const displayText = campaign.linkText;
    const targetUrl = campaign.linkUrl || campaign.linkText;
    signature += "\n\n**Visit our site:** [LINK]" + displayText + "[/LINK:" + targetUrl + "]";
  }
  
  if (companySettings?.legalFooter) {
    signature += "\n\n" + companySettings.legalFooter;
  } else {
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
 * POST /api/material-decisions/[id]/send-test - Wyślij testowy email z podglądem odpowiedzi
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decisionId = parseInt(params.id);

    // Pobierz decyzję z pełnymi danymi
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
                },
                mailboxes: {
                  where: { isActive: true },
                  orderBy: [
                    { priority: 'asc' },
                    { lastUsedAt: 'asc' }
                  ],
                  take: 1
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

    // Pobierz adres testowy z ustawień
    const companySettings = await db.companySettings.findFirst();
    const testEmail = companySettings?.forwardEmail || "bartosz.kosiba@kreativia.pl";

    if (!testEmail) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono adresu email do testowej wysyłki w ustawieniach" },
        { status: 400 }
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

    // Zbuduj pełną treść emaila (jak w preview)
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

    let emailContent = '';
    if (greetingForm) {
      emailContent = greetingForm + "\n\n" + responseContent.content;
    } else {
      emailContent = responseContent.content;
    }

    // Info o opiekunie (jeśli włączone)
    if (decision.campaign.autoReplyIncludeGuardian && decision.campaign.virtualSalesperson) {
      const salesperson = decision.campaign.virtualSalesperson;
      const realName = salesperson.realSalespersonName;
      const realEmail = salesperson.realSalespersonEmail;
      const realPhone = salesperson.realSalespersonPhone;
      const realSignature = salesperson.realSalespersonSignature;
      
      if (realName && realEmail) {
        const introText = decision.campaign.autoReplyGuardianIntroText?.trim();
        if (introText) {
          emailContent += '\n\n' + introText;
        }
        
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

    // ✅ Przygotuj załączniki (dokładnie jak w materialResponseSender.ts)
    const attachments: Array<{ filename: string; path: string }> = [];
    const links: Array<{ name: string; url: string }> = [];
    
    for (const material of decision.campaign.materials) {
      if (material.type === 'ATTACHMENT' && material.filePath) {
        let filePathToCheck = material.filePath;
        
        if (filePathToCheck.startsWith('materials/')) {
          filePathToCheck = `uploads/${filePathToCheck}`;
        }
        
        const possiblePaths = [
          path.join(process.cwd(), filePathToCheck),
          path.join(process.cwd(), 'uploads', 'materials', path.basename(material.filePath)),
          path.join(process.cwd(), material.filePath),
          path.join(process.cwd(), 'public', 'materials', path.basename(material.filePath)),
          material.filePath
        ];
        
        let foundPath: string | null = null;
        for (const fullPath of possiblePaths) {
          if (fs.existsSync(fullPath)) {
            foundPath = fullPath;
            console.log(`[MATERIAL TEST] Znaleziono plik: ${fullPath}`);
            break;
          }
        }
        
        if (foundPath) {
          attachments.push({
            filename: material.fileName || material.name || path.basename(material.filePath),
            path: foundPath
          });
        } else {
          console.warn(`[MATERIAL TEST] Plik nie istnieje: ${material.filePath}`);
        }
      } else if (material.type === 'LINK' && material.url) {
        links.push({
          name: material.name,
          url: material.url
        });
      }
    }

    // 3. Linki do materiałów (jeśli są) - PRZED stopką
    if (links.length > 0) {
      emailContent += '\n\n';
      links.forEach(link => {
        emailContent += `\n${link.name}: ${link.url}`;
      });
    }

    // 4. Pełna stopka kampanii
    if (decision.campaign.autoReplyIncludeGuardian || links.length > 0) {
      emailContent += '\n\n\n';
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
      
      let leadReplyText = decision.reply.content
        .replace(/<[^>]+>/g, '')
        .replace(/\n+/g, '\n')
        .trim();
      
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
        
        directReplyLines.push(line);
      }
      
      const cleanReplyText = directReplyLines.join('\n').trim();
      
      if (cleanReplyText) {
        const languageLabels = {
          pl: 'Wiadomość napisana przez',
          en: 'Message written by',
          de: 'Nachricht geschrieben von',
          fr: 'Message écrit par'
        };
        
        const label = languageLabels[campaignLanguage as keyof typeof languageLabels] || languageLabels.pl;
        const leadName = `${decision.lead.firstName || ''} ${decision.lead.lastName || ''}`.trim() || decision.lead.email;
        
        emailContent += '\n\n';
        emailContent += `${label} ${leadName} w dniu ${dateStr}, o godz. ${timeStr}:\n\n`;
        emailContent += cleanReplyText;
        emailContent += '\n';
      }
    }

    // ✅ Konwersja do HTML dokładnie jak w materialResponseSender.ts
    // Wersja tekstowa (usuń **bold**, znaczniki linków i logo)
    let textContent = emailContent.replace(/\*\*(.+?)\*\*/g, '$1');
    textContent = textContent.replace(/\[LINK\](.+?)\[\/LINK:(.+?)\]/g, '$1');
    textContent = textContent.replace(/\[LOGO\].+?\[\/LOGO\]/g, '[Logo firmy]');
    
    // Wersja HTML
    const htmlContent = convertToHtml(emailContent).replace(/\n/g, '<br>');

    // Pobierz pierwszą dostępną skrzynkę mailową
    const mailbox = decision.campaign.virtualSalesperson?.mailboxes?.[0];
    if (!mailbox) {
      return NextResponse.json(
        { success: false, error: "Brak dostępnej skrzynki mailowej dla kampanii" },
        { status: 400 }
      );
    }

    // Utwórz transport SMTP (dokładnie jak w materialResponseSender.ts)
    const { createSmtpTransport } = await import('@/integrations/smtp/client');
    const transport = createSmtpTransport({
      smtpHost: mailbox.smtpHost,
      smtpPort: mailbox.smtpPort,
      smtpUser: mailbox.smtpUser,
      smtpPass: mailbox.smtpPass,
      smtpSecure: mailbox.smtpSecure
    });

    // Przygotuj załączniki dla nodemailer
    const nodemailerAttachments = attachments.map(att => ({
      filename: att.filename,
      path: att.path
    }));

    // Wyślij email testowy
    const fromEmail = mailbox.email;
    const fromName = mailbox.displayName || decision.campaign.virtualSalesperson?.name || "Kreativia";

    const mailOptions: any = {
      from: `"${fromName}" <${fromEmail}>`,
      to: testEmail,
      subject: `[TEST] ${responseContent.subject}`,
      text: textContent,
      html: htmlContent,
      attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
      replyTo: mailbox.email
    };

    // ✅ NIE dodawaj handlowca do CC w testowym emailu (aby nie wprowadzać w błąd)

    try {
      const result = await transport.sendMail(mailOptions);
      console.log(`[MATERIAL TEST] ✅ Testowy email wysłany: ${fromEmail} -> ${testEmail} (${result.messageId})`);

      // ✅ Zapisz do SendLog dla archiwum
      try {
        await db.sendLog.create({
          data: {
            campaignId: decision.campaign.id,
            leadId: null, // Testowy email - nie ma leada
            mailboxId: mailbox.id,
            toEmail: testEmail, // Adres testowy
            subject: `[TEST] ${responseContent.subject}`,
            content: emailContent.substring(0, 500), // Ogranicz do 500 znaków dla logu
            status: 'sent',
            messageId: result.messageId
          }
        });
        console.log(`[MATERIAL TEST] ✅ Zapisano testowy email do SendLog`);
      } catch (logError: any) {
        console.warn(`[MATERIAL TEST] Nie udało się zapisać do SendLog:`, logError.message);
        // Nie przerywaj jeśli logowanie się nie powiedzie
      }

      return NextResponse.json({
        success: true,
        message: `Testowy email został wysłany na adres ${testEmail}${attachments.length > 0 ? ` z ${attachments.length} załącznikami` : ''}`
      });
    } catch (error: any) {
      console.error("[MATERIAL TEST] ❌ Błąd wysyłki testowej:", error);
      return NextResponse.json(
        { success: false, error: "Błąd podczas wysyłki testowej: " + error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[MATERIAL DECISION SEND TEST] Błąd:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas wysyłki testowej: " + error.message },
      { status: 500 }
    );
  }
}

