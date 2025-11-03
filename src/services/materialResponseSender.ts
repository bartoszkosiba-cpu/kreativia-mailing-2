/**
 * Material Response Sender - Serwis do obsługi wysyłki automatycznych odpowiedzi z materiałami
 * 
 * Funkcjonalność:
 * 1. Planuje wysyłkę materiałów (po opóźnieniu)
 * 2. Wysyła materiały z odpowiedzią AI
 * 3. Zarządza kolejką wysyłek
 */

import { db } from "@/lib/db";
import { generateMaterialResponse } from "./materialResponseAI";
import { createSmtpTransport } from "@/integrations/smtp/client";
import * as fs from "fs";
import * as path from "path";

/**
 * Zwraca domyślne powitanie w danym języku (gdy brak imienia lub błąd AI)
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

// Funkcja convertToHtml - dokładnie taka sama jak w client.ts
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
 * Planuje wysyłkę materiałów dla leada (po opóźnieniu)
 */
export async function scheduleMaterialResponse(
  replyId: number,
  analysis: {
    isMaterialRequest: boolean;
    confidence: number;
    reasoning: string;
    suggestedAction: "SEND" | "DONT_SEND" | "ASK_ADMIN";
  }
): Promise<number> {
  console.log(`[MATERIAL SENDER] Planuję wysyłkę materiałów dla odpowiedzi ${replyId}`);
  
  // Pobierz odpowiedź z pełnymi danymi
  const reply = await db.inboxReply.findUnique({
    where: { id: replyId },
    include: {
      lead: true,
      campaign: {
        include: {
          virtualSalesperson: true,
          materials: {
            where: { isActive: true },
            orderBy: { order: 'asc' }
          }
        }
      }
    }
  });

  if (!reply || !reply.lead || !reply.campaign) {
    throw new Error(`Nie znaleziono odpowiedzi ${replyId} lub brak danych`);
  }

  if (!reply.campaign.materials || reply.campaign.materials.length === 0) {
    throw new Error(`Kampania ${reply.campaign.id} nie ma żadnych materiałów`);
  }

  // Wygeneruj odpowiedź AI
  const campaignLanguage = reply.campaign.virtualSalesperson?.language || reply.lead.language || 'pl';
  const responseContent = await generateMaterialResponse(
    {
      firstName: reply.lead.firstName,
      lastName: reply.lead.lastName,
      greetingForm: reply.lead.greetingForm,
      language: reply.lead.language || 'pl'
    },
    {
      id: reply.campaign.id,
      name: reply.campaign.name,
      autoReplyContext: reply.campaign.autoReplyContext,
      autoReplyRules: reply.campaign.autoReplyRules,
      virtualSalespersonLanguage: reply.campaign.virtualSalesperson?.language || null,
      autoReplyContent: reply.campaign.autoReplyContent || null // ✅ NOWE: Statyczna treść
    },
    reply.campaign.materials.map(m => ({
      name: m.name,
      type: m.type as "LINK" | "ATTACHMENT",
      url: m.url,
      fileName: m.fileName
    })),
    reply.content,
    reply.subject // ✅ NOWE: Temat z odpowiedzi leada (dla "Re:")
  );

  // Oblicz czas wysyłki (teraz + opóźnienie)
  const delayMinutes = reply.campaign.autoReplyDelayMinutes || 15;
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  // ✅ SPRAWDŹ czy już istnieje MaterialResponse dla tego replyId (zapobieganie duplikatom)
  // Sprawdzamy wszystkie statusy poza 'sent' - jeśli jest jakikolwiek MaterialResponse (nawet failed),
  // to nie tworzymy nowego (użytkownik może odświeżyć/ponownie zaplanować istniejący)
  const existing = await db.materialResponse.findFirst({
    where: {
      replyId: reply.id,
      status: { not: 'sent' } // Wszystkie poza 'sent' (pending, scheduled, sending, failed)
    },
    orderBy: {
      createdAt: 'desc' // Weź najnowszy
    }
  });

  if (existing) {
    console.log(`[MATERIAL SENDER] ⚠️ MaterialResponse już istnieje dla replyId ${reply.id} (ID: ${existing.id}, status: ${existing.status}) - pomijam tworzenie duplikatu`);
    
    // Jeśli istniejący jest w failed, zaktualizuj go na scheduled (zamiast tworzyć nowy)
    if (existing.status === 'failed') {
      const delayMinutes = reply.campaign.autoReplyDelayMinutes || 15;
      const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      
      await db.materialResponse.update({
        where: { id: existing.id },
        data: {
          status: 'scheduled',
          scheduledAt: scheduledAt,
          error: null, // Wyczyść błąd
          updatedAt: new Date()
        }
      });
      
      console.log(`[MATERIAL SENDER] ✅ Zaktualizowano failed MaterialResponse ${existing.id} na scheduled (ponowne zaplanowanie)`);
      return existing.id;
    }
    
    return existing.id;
  }

  // ✅ Utwórz JEDEN MaterialResponse na odpowiedź (wszystkie materiały będą w jednym emailu)
  const materialResponse = await db.materialResponse.create({
    data: {
      leadId: reply.lead.id,
      campaignId: reply.campaign.id,
      materialId: null, // NULL - bo to odpowiedź z wszystkimi materiałami kampanii
      replyId: reply.id,
      responseText: responseContent.content,
      subject: responseContent.subject,
      aiConfidence: analysis.confidence,
      aiReasoning: analysis.reasoning,
      status: 'scheduled',
      scheduledAt: scheduledAt
    }
  });

  console.log(`[MATERIAL SENDER] Utworzono MaterialResponse ID: ${materialResponse.id} dla replyId ${reply.id}, wysyłka zaplanowana na ${scheduledAt.toLocaleString('pl-PL')}`);
  
  // Aktualizuj status leada (z logiką reaktywacji jeśli był zablokowany)
  const currentLead = await db.lead.findUnique({
    where: { id: reply.lead.id },
    select: { status: true, isBlocked: true, blockedReason: true }
  });

  const wasBlocked = currentLead?.isBlocked || currentLead?.status === 'BLOCKED' || currentLead?.status === 'BLOKADA';
  const isReactivation = wasBlocked;

  // ✅ Pobierz aktualne blockedCampaigns
  const currentBlockedCampaigns = await db.lead.findUnique({
    where: { id: reply.lead.id },
    select: { blockedCampaigns: true }
  });
  
  // ✅ POŁĄCZ blockedCampaigns (nowe + istniejące, bez duplikatów)
  let blockedCampaignsArray: number[] = [];
  if (currentBlockedCampaigns?.blockedCampaigns) {
    try {
      blockedCampaignsArray = JSON.parse(currentBlockedCampaigns.blockedCampaigns);
    } catch (e) {
      console.warn(`[MATERIAL SENDER] Błąd parsowania blockedCampaigns dla lead ${reply.lead.id}:`, e);
      blockedCampaignsArray = [];
    }
  }
  
  // ✅ Dodaj kampanię do zablokowanych (jeśli jeszcze nie jest)
  if (reply.campaign?.id && !blockedCampaignsArray.includes(reply.campaign.id)) {
    blockedCampaignsArray.push(reply.campaign.id);
  }

  await db.lead.update({
    where: { id: reply.lead.id },
    data: {
      status: 'ZAINTERESOWANY',
      subStatus: 'ZAINTERESOWANY_CAMPAIGN',
      blockedCampaigns: blockedCampaignsArray.length > 0 
        ? JSON.stringify(blockedCampaignsArray) 
        : null, // ✅ ZAPISZ blockedCampaigns
      isBlocked: false, // Odblokuj jeśli był zablokowany
      blockedReason: isReactivation ? null : undefined,
      blockedAt: isReactivation ? null : undefined,
      reactivatedAt: isReactivation ? new Date() : undefined,
      lastReactivation: isReactivation ? (currentLead?.status || 'BLOCKED') : undefined,
      updatedAt: new Date()
    }
  });

  // ✅ REAKTYWACJA: Jeśli lead był zablokowany, dodaj go z powrotem do kampanii (jeśli nie jest już w niej)
  if (isReactivation && reply.campaign) {
    const existingCampaignLead = await db.campaignLead.findFirst({
      where: {
        leadId: reply.lead.id,
        campaignId: reply.campaign.id
      }
    });

    if (!existingCampaignLead) {
      // Dodaj leada z powrotem do kampanii
      await db.campaignLead.create({
        data: {
          leadId: reply.lead.id,
          campaignId: reply.campaign.id,
          status: 'queued' // Dodaj jako gotowy do wysyłki jeśli kampania jest aktywna
        }
      });
      console.log(`[MATERIAL SENDER] ✅ Dodano reaktywowanego lead ${reply.lead.id} z powrotem do kampanii ${reply.campaign.id}`);
    }
  }

  if (isReactivation) {
    console.log(`[MATERIAL SENDER] ✅ REAKTYWACJA lead ${reply.lead.id}: ${currentLead?.status} → ZAINTERESOWANY`);
  }

  return materialResponse.id;
}

/**
 * Wysyła zaplanowane materiały (wywoływane przez cron job)
 */
export async function sendScheduledMaterialResponses(): Promise<number> {
  console.log(`[MATERIAL SENDER] Sprawdzam zaplanowane wysyłki materiałów...`);
  
  const now = new Date();
  
  // Pobierz wszystkie zaplanowane wysyłki które są gotowe
  const scheduledResponses = await db.materialResponse.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: {
        lte: now // Zaplanowane na teraz lub wcześniej
      }
    },
    include: {
      lead: true,
      campaign: {
        include: {
          virtualSalesperson: {
            include: {
              mailboxes: {
                where: { isActive: true },
                orderBy: [
                  { priority: 'asc' },
                  { lastUsedAt: 'asc' }
                ]
              },
              mainMailbox: {
                select: {
                  email: true
                }
              }
            }
          },
          materials: true
        }
      },
      material: true,
      reply: true
    },
    orderBy: {
      scheduledAt: 'asc'
    },
    take: 50 // Max 50 na raz
  });

  if (scheduledResponses.length === 0) {
    return 0;
  }

  console.log(`[MATERIAL SENDER] Znaleziono ${scheduledResponses.length} zaplanowanych wysyłek`);

  let sentCount = 0;
  let failedCount = 0;

  // ✅ Każdy MaterialResponse już reprezentuje wszystkie materiały kampanii dla jednej odpowiedzi
  // Nie musimy grupować - każdy response to osobny email z wszystkimi materiałami
  for (const response of scheduledResponses) {
    
    if (!response.lead || !response.campaign) {
      console.error(`[MATERIAL SENDER] Brak leada lub kampanii dla MaterialResponse ID: ${response.id}`);
      continue;
    }

    // ✅ SPRAWDŹ czy status nie został już zmieniony (zapobieganie wielokrotnemu wysłaniu)
    const currentResponse = await db.materialResponse.findUnique({
      where: { id: response.id },
      select: { status: true }
    });

    if (!currentResponse || currentResponse.status !== 'scheduled') {
      console.log(`[MATERIAL SENDER] ⚠️ MaterialResponse ${response.id} już został przetworzony (status: ${currentResponse?.status}) - pomijam`);
      continue;
    }

    // ✅ Atomic update: zmień status na 'sending' (zapobiega równoległemu wysłaniu)
    try {
      await db.materialResponse.update({
        where: { id: response.id },
        data: { status: 'sending' as any }
      });
    } catch (updateError: any) {
      // Jeśli nie udało się zaktualizować (np. już jest 'sent'), pomiń
      console.log(`[MATERIAL SENDER] ⚠️ Nie można zaktualizować statusu MaterialResponse ${response.id} - pomijam`);
      continue;
    }

    try {
      // Znajdź skrzynkę do wysyłki
      const mailboxes = response.campaign.virtualSalesperson?.mailboxes || [];
      if (mailboxes.length === 0) {
        throw new Error(`Brak aktywnych skrzynek dla handlowca ${response.campaign.virtualSalesperson?.id}`);
      }

      const mailbox = mailboxes[0]; // Użyj pierwszej (najwyższy priorytet)
      
      // Pobierz wszystkie materiały dla tej kampanii (każdy MaterialResponse już zawiera wszystkie materiały)
      const materials = response.campaign.materials.filter(m => m.isActive);
      
      // ✅ PRZED WYSŁANIEM: Regeneruj treść i temat z aktualnymi ustawieniami kampanii
      // (na wypadek gdyby ustawienia zmieniły się po utworzeniu MaterialResponse)
      let finalSubject = response.subject;
      let finalContent = response.responseText;
      
      // Regeneruj jeśli kampania ma autoReplyContent (może zostało dodane później)
      if (response.campaign.autoReplyContent && response.campaign.autoReplyContent.trim()) {
        console.log(`[MATERIAL SENDER] Regeneruję treść z aktualnymi ustawieniami kampanii dla MaterialResponse ${response.id}`);
        try {
          const regeneratedContent = await generateMaterialResponse(
            {
              firstName: response.lead.firstName,
              lastName: response.lead.lastName,
              greetingForm: response.lead.greetingForm,
              language: response.lead.language || 'pl'
            },
            {
              id: response.campaign.id,
              name: response.campaign.name,
              autoReplyContext: response.campaign.autoReplyContext,
              autoReplyRules: response.campaign.autoReplyRules,
              virtualSalespersonLanguage: response.campaign.virtualSalesperson?.language || null,
              autoReplyContent: response.campaign.autoReplyContent
            },
            materials.map(m => ({
              name: m.name,
              type: m.type as "LINK" | "ATTACHMENT",
              url: m.url,
              fileName: m.fileName
            })),
            response.reply?.content || undefined, // ✅ undefined zamiast null
            response.reply?.subject || undefined // ✅ undefined zamiast null
          );
          
          finalSubject = regeneratedContent.subject;
          finalContent = regeneratedContent.content;
          
          // ✅ Zaktualizuj MaterialResponse z nową treścią i tematem
          // Ważne: upewnij się że rekord nadal ma status 'sending' (może zostać zmieniony przez inny proces)
          try {
            await db.materialResponse.update({
              where: { id: response.id, status: 'sending' }, // ✅ Tylko jeśli status jest 'sending'
              data: {
                subject: finalSubject,
                responseText: finalContent,
                updatedAt: new Date()
              }
            });
            console.log(`[MATERIAL SENDER] ✅ Zaktualizowano MaterialResponse ${response.id} z aktualną treścią i tematem`);
          } catch (updateError: any) {
            // Jeśli rekord nie ma już statusu 'sending' (np. został już wysłany lub usunięty), użyj zapisanej treści
            console.warn(`[MATERIAL SENDER] Nie można zaktualizować MaterialResponse ${response.id} (status może się zmienić): ${updateError.message}`);
            // Kontynuuj z zapisaną treścią
          }
        } catch (regenerateError: any) {
          console.warn(`[MATERIAL SENDER] Nie udało się zregenerować treści (użyję zapisanej): ${regenerateError.message}`);
          // Użyj zapisanej treści jako fallback
        }
      }
      
      // Przygotuj załączniki
      const attachments: Array<{ filename: string; path: string }> = [];
      const links: Array<{ name: string; url: string }> = [];
      
      for (const material of materials) {
        if (material.type === 'ATTACHMENT' && material.filePath) {
          // Pliki mogą być w różnych miejscach - sprawdź różne ścieżki
          // Format filePath może być: "materials/filename" lub "uploads/materials/filename" lub pełna ścieżka
          let filePathToCheck = material.filePath;
          
          // Jeśli zaczyna się od "materials/", dodaj "uploads/"
          if (filePathToCheck.startsWith('materials/')) {
            filePathToCheck = `uploads/${filePathToCheck}`;
          }
          
          const possiblePaths = [
            path.join(process.cwd(), filePathToCheck), // uploads/materials/filename
            path.join(process.cwd(), 'uploads', 'materials', path.basename(material.filePath)), // Tylko nazwa pliku
            path.join(process.cwd(), material.filePath), // Dokładnie jak zapisane
            path.join(process.cwd(), 'public', 'materials', path.basename(material.filePath)), // W public
            material.filePath // Pełna ścieżka bezwzględna (jeśli zapisana tak)
          ];
          
          let foundPath: string | null = null;
          for (const fullPath of possiblePaths) {
            if (fs.existsSync(fullPath)) {
              foundPath = fullPath;
              console.log(`[MATERIAL SENDER] Znaleziono plik: ${fullPath}`);
              break;
            }
          }
          
          if (foundPath) {
            attachments.push({
              filename: material.fileName || material.name || path.basename(material.filePath),
              path: foundPath
            });
          } else {
            console.warn(`[MATERIAL SENDER] Plik nie istnieje: ${material.filePath}`);
            console.warn(`[MATERIAL SENDER] Sprawdzono ścieżki: ${possiblePaths.slice(0, 3).join(', ')}...`);
          }
        } else if (material.type === 'LINK' && material.url) {
          links.push({
            name: material.name,
            url: material.url
          });
        }
      }

      // ✅ Pobierz ustawienia firmy dla pełnej stopki
      const companySettings = await db.companySettings.findFirst();
      
      // ✅ UŻYJ DOKŁADNIE TEJ SAMEJ STRUKTURY CO sendCampaignEmail:
      // 1. Powitanie (z lead.greetingForm) + "\n\n" + Treść odpowiedzi automatycznej
      // 2. (Opcjonalnie) Info o opiekunie przed stopką
      // 3. Pełna stopka kampanii (dokładnie jak w sendCampaignEmail)
      // 4. (Opcjonalnie) Linki do materiałów
      // 5. Załączniki (dodane przez nodemailer)
      // 6. Cytat z odpowiedzi leada NA KOŃCU (po stopce i załącznikach)
      
      // ✅ SPRAWDŹ JĘZYK KAMPANII vs JĘZYK LEADA
      const campaignLanguage = response.campaign.virtualSalesperson?.language || 'pl';
      const leadLanguage = response.lead.language || 'pl';
      const languageMismatch = campaignLanguage !== leadLanguage;
      
      // ✅ Wybierz odpowiednie powitanie (w języku kampanii jeśli różni się od języka leada)
      let greetingForm: string | null = null;
      
      if (languageMismatch) {
        // ✅ RÓŻNE JĘZYKI: Wygeneruj powitanie w języku kampanii
        console.log(`[MATERIAL SENDER] ⚠️ Konflikt języków: lead=${leadLanguage}, kampania=${campaignLanguage} - generuję powitanie w języku kampanii`);
        
        if (response.lead.firstName) {
          try {
            const { chatgptService } = await import('@/services/chatgptService');
            const results = await chatgptService.batchProcessNames(
              [response.lead.firstName],
              [response.lead.lastName || ''],
              [campaignLanguage] // ✅ Użyj języka kampanii, nie leada
            );
            
            if (results && results.length > 0 && results[0]?.greetingForm) {
              greetingForm = results[0].greetingForm;
              console.log(`[MATERIAL SENDER] ✅ Wygenerowano powitanie w języku kampanii (${campaignLanguage}): "${greetingForm}"`);
            }
          } catch (error: any) {
            console.error(`[MATERIAL SENDER] ❌ Błąd generowania powitania w języku kampanii:`, error.message);
            // Fallback - użyj domyślnego powitania w języku kampanii
            greetingForm = getDefaultGreetingForLanguage(campaignLanguage);
          }
        } else {
          // Brak imienia - użyj domyślnego powitania
          greetingForm = getDefaultGreetingForLanguage(campaignLanguage);
        }
      } else {
        // ✅ TAKI SAM JĘZYK: Użyj istniejącego powitania z bazy
        greetingForm = response.lead.greetingForm;
      }
      
      // 1. Buduj treść dokładnie jak w sendCampaignEmail: greetingForm + "\n\n" + content
      let emailContent = '';
      if (greetingForm) {
        emailContent = greetingForm + "\n\n" + finalContent;
      } else {
        emailContent = finalContent;
      }
      
      // ✅ Dodaj dane handlowca (jeśli włączone) - PRZED stopką
      let guardianEmailForCc: string | undefined = undefined;
      if (response.campaign.autoReplyIncludeGuardian && response.campaign.virtualSalesperson) {
        const salesperson = response.campaign.virtualSalesperson;
        const realName = salesperson.realSalespersonName;
        const realEmail = salesperson.realSalespersonEmail;
        const realPhone = salesperson.realSalespersonPhone;
        const realSignature = salesperson.realSalespersonSignature;
        
        if (realName && realEmail) {
          // Tekst wprowadzający (jeśli ustawiony)
          const introText = response.campaign.autoReplyGuardianIntroText?.trim();
          if (introText) {
            emailContent += '\n\n' + introText;
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
          
          guardianEmailForCc = realEmail;
        }
      }
      
      // ✅ 3. Linki do materiałów (jeśli są) - PRZED stopką
      if (links.length > 0) {
        emailContent += '\n\n';
        links.forEach(link => {
          emailContent += `\n${link.name}: ${link.url}`;
        });
      }
      
      // ✅ 2. Buduj pełną stopkę dokładnie jak w sendCampaignEmail
      // ✅ Dodaj entery między danymi opiekuna/materiałami a stopką (3 entery - zmniejszone o 1)
      if (response.campaign.autoReplyIncludeGuardian || links.length > 0) {
        emailContent += '\n\n\n'; // 3 entery (zmniejszone z 4 o 1)
      }
      
      let signature = buildCampaignSignature(
        response.campaign.virtualSalesperson,
        response.campaign,
        response.lead.language || 'pl',
        companySettings
      );
      
      emailContent += signature;
      
      // 4. Cytat z odpowiedzi leada NA KOŃCU (po stopce i linkach, przed wysłaniem)
      if (response.reply?.content && response.reply?.fromEmail && response.reply?.receivedAt) {
        // Pobierz datę odpowiedzi leada
        const replyDate = new Date(response.reply.receivedAt);
        const dateStr = replyDate.toLocaleDateString('pl-PL', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });
        const timeStr = replyDate.toLocaleTimeString('pl-PL', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        // Wyczyść treść odpowiedzi leada z HTML
        let leadReplyText = response.reply.content
          .replace(/<[^>]+>/g, '')
          .replace(/\n+/g, '\n')
          .trim();
        
        // ✅ Wyciągnij TYLKO bezpośrednią odpowiedź leada (usuń zagnieżdżone cytaty)
        // Usuń wszystko co wygląda na zagnieżdżony cytat (linie zaczynające się od ">", "Wiadomość napisana przez", "--", itp.)
        const lines = leadReplyText.split('\n');
        let directReplyLines: string[] = [];
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Jeśli linia wygląda na początek zagnieżdżonego cytatu, przerwij
          if (
            trimmedLine.startsWith('>') ||
            trimmedLine.match(/^Wiadomość napisana przez/i) ||
            trimmedLine.match(/^Message written by/i) ||
            trimmedLine.match(/^On .+ wrote:/i) ||
            trimmedLine.match(/^-----/i) ||
            trimmedLine.match(/^From:/i) ||
            trimmedLine === '--'
          ) {
            break; // Zatrzymaj się na pierwszym zagnieżdżonym cytacie
          }
          
          directReplyLines.push(line);
        }
        
        // Złącz linie i usuń puste na końcu
        let directReplyText = directReplyLines.join('\n').trim();
        
        // ✅ Zbuduj cytat TYLKO z bezpośredniej odpowiedzi leada (bez zagnieżdżonych cytatów)
        // Format:
        // Wiadomość napisana przez [Lead Name] <[Lead Email]> w dniu [Data]:
        // [Treść odpowiedzi leada - TYLKO bezpośrednia, bez cytatów]
        let quotedContent = '\n\n';
        
        const leadName = response.lead.firstName && response.lead.lastName 
          ? `${response.lead.firstName} ${response.lead.lastName}`
          : response.lead.email;
        quotedContent += `Wiadomość napisana przez ${leadName} <${response.reply.fromEmail}> w dniu ${dateStr}, o godz. ${timeStr}:\n\n`;
        quotedContent += directReplyText;
        quotedContent += '\n'; // ✅ Dodaj enter po zakończeniu cytatu na końcu
        
        emailContent += quotedContent;
      }

      // Utwórz transport SMTP
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

      // ✅ Konwersja do HTML dokładnie jak w sendCampaignEmail
      // Wersja tekstowa (usuń **bold**, znaczniki linków i logo)
      let textContent = emailContent.replace(/\*\*(.+?)\*\*/g, '$1');
      textContent = textContent.replace(/\[LINK\](.+?)\[\/LINK:(.+?)\]/g, '$1');
      textContent = textContent.replace(/\[LOGO\].+?\[\/LOGO\]/g, '[Logo firmy]');
      
      // Wersja HTML (konwertuj **bold** i linki, potem \n na <br>)
      const htmlContent = convertToHtml(emailContent).replace(/\n/g, '<br>');

      // Określ nadawcę (dokładnie jak w sendCampaignEmail)
      const fromEmail = mailbox.email;
      const fromName = mailbox.displayName || response.campaign.virtualSalesperson?.name || 'Kreativia';

      // Wyślij email
      const mailOptions: any = {
        from: `${fromName} <${fromEmail}>`,
        to: response.lead.email,
        subject: finalSubject,
        text: textContent,
        html: htmlContent,
        attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
        replyTo: mailbox.email
      };
      
      // ✅ Dodaj handlowca do CC (jeśli włączone)
      if (guardianEmailForCc) {
        mailOptions.cc = guardianEmailForCc;
        console.log(`[MATERIAL SENDER] Dodano handlowca ${guardianEmailForCc} do CC`);
      }

      const result = await transport.sendMail(mailOptions);

      // ✅ Aktualizuj MaterialResponse na 'sent' (już był 'sending', więc to jest bezpieczne)
      await db.materialResponse.update({
        where: { id: response.id, status: 'sending' }, // ✅ Dodatkowa ochrona: tylko jeśli status jest 'sending'
        data: {
          status: 'sent',
          sentAt: new Date(),
          mailboxId: mailbox.id,
          messageId: result.messageId
        }
      });

      // ✅ Zapisz do SendLog dla śledzenia
      try {
        await db.sendLog.create({
          data: {
            campaignId: response.campaignId,
            leadId: response.leadId,
            mailboxId: mailbox.id,
            messageId: result.messageId,
            toEmail: response.lead.email, // ✅ Dodaj toEmail dla poprawnego wyświetlania w archiwum i outbox
            subject: finalSubject, // ✅ Użyj zregenerowanego tematu
            content: emailContent.substring(0, 500), // Ogranicz do 500 znaków dla logu (pełna treść jest w wysłanym mailu)
            status: 'sent'
          }
        });
      } catch (logError: any) {
        // Nie przerywaj jeśli logowanie się nie powiedzie
        console.warn(`[MATERIAL SENDER] Nie udało się zapisać do SendLog dla MaterialResponse ${response.id}:`, logError.message);
      }

      // Aktualizuj lastUsedAt skrzynki
      await db.mailbox.update({
        where: { id: mailbox.id },
        data: {
          lastUsedAt: new Date(),
          currentDailySent: { increment: 1 },
          totalEmailsSent: { increment: 1 }
        }
      });

      sentCount++;
      console.log(`[MATERIAL SENDER] ✓ Wysłano materiały do ${response.lead.email} (${materials.length} materiałów)`);

    } catch (error: any) {
      console.error(`[MATERIAL SENDER] ✗ Błąd wysyłki dla MaterialResponse ID ${response.id}:`, error.message);
      
      // ✅ Oznacz jako failed (z powrotem z 'sending')
      // Sprawdź czy rekord nadal istnieje i ma status 'sending'
      try {
        await db.materialResponse.update({
          where: { id: response.id, status: 'sending' }, // ✅ Tylko jeśli status jest 'sending'
          data: {
            status: 'failed',
            error: error.message.substring(0, 1000) // Ogranicz długość błędu
          }
        });
        console.log(`[MATERIAL SENDER] Oznaczono MaterialResponse ${response.id} jako 'failed'`);
      } catch (updateError: any) {
        // Jeśli rekord nie ma już statusu 'sending' (np. został już zaktualizowany), tylko zaloguj
        console.warn(`[MATERIAL SENDER] Nie można zaktualizować statusu na 'failed' dla ${response.id} (może być już zaktualizowany): ${updateError.message}`);
      }
      
      failedCount++;
    }
  }

  console.log(`[MATERIAL SENDER] Zakończono: ${sentCount} wysłanych, ${failedCount} błędów`);
  
  return sentCount;
}

/**
 * Tworzy wpis w kolejce decyzji administratora
 */
export async function createPendingMaterialDecision(
  replyId: number,
  analysis: {
    isMaterialRequest: boolean;
    confidence: number;
    reasoning: string;
    suggestedAction: "SEND" | "DONT_SEND" | "ASK_ADMIN";
  }
): Promise<number> {
  console.log(`[MATERIAL SENDER] Tworzę kolejkę decyzji dla odpowiedzi ${replyId}`);
  
  // ✅ SPRAWDŹ czy już istnieje decyzja dla tego replyId (zapobieganie duplikatom)
  const existing = await db.pendingMaterialDecision.findFirst({
    where: {
      replyId: replyId,
      status: 'PENDING' // Tylko aktywne decyzje
    }
  });

  if (existing) {
    console.log(`[MATERIAL SENDER] ⚠️ Decyzja już istnieje dla replyId ${replyId} (ID: ${existing.id}) - pomijam tworzenie duplikatu`);
    return existing.id;
  }
  
  const reply = await db.inboxReply.findUnique({
    where: { id: replyId },
    include: {
      lead: true,
      campaign: true
    }
  });

  if (!reply || !reply.lead || !reply.campaign) {
    throw new Error(`Nie znaleziono odpowiedzi ${replyId} lub brak danych`);
  }

  const pending = await db.pendingMaterialDecision.create({
    data: {
      leadId: reply.lead.id,
      campaignId: reply.campaign.id,
      replyId: reply.id,
      aiConfidence: analysis.confidence,
      aiReasoning: analysis.reasoning,
      leadResponse: reply.content,
      suggestedAction: analysis.suggestedAction === 'SEND' ? 'SEND' : 'DONT_SEND',
      status: 'PENDING'
    }
  });

  console.log(`[MATERIAL SENDER] Utworzono PendingMaterialDecision ID: ${pending.id}`);
  
  return pending.id;
}

/**
 * Generuje pełną stopkę kampanii (dokładnie tak jak w sendCampaignEmail)
 * Zawiera:
 * 1. Podpis handlowca (imię, telefon, email)
 * 2. Job description z kampanii
 * 3. Disclaimer wielojęzyczny
 * 4. PS z kampanii
 * 5. Logo
 * 6. Adres firmy
 * 7. Link do strony
 * 8. Stopka prawna
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
  
  // 2. Disclaimer wielojęzyczny z ustawień - USUNIĘTY (zgodnie z prośbą użytkownika)
  // if (companySettings) {
  //   const lang = leadLanguage || 'pl';
  //   let disclaimer = "";
  //   ...
  //   signature += "\n\n" + disclaimer;
  // }
  
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
    // Zawsze wyświetlamy tekst z linkText, ale kierujemy do linkUrl (jeśli istnieje) lub linkText (jeśli nie)
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

// Funkcja buildGuardianInfo została usunięta - informacja o opiekunie nie jest już automatycznie dodawana
// Użytkownik sam dodaje te informacje w treści swojej odpowiedzi

