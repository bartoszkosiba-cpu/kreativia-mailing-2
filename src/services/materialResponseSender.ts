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
      virtualSalespersonLanguage: reply.campaign.virtualSalesperson?.language || null
    },
    reply.campaign.materials.map(m => ({
      name: m.name,
      type: m.type as "LINK" | "ATTACHMENT",
      url: m.url,
      fileName: m.fileName
    })),
    reply.content
  );

  // Oblicz czas wysyłki (teraz + opóźnienie)
  const delayMinutes = reply.campaign.autoReplyDelayMinutes || 15;
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  // ✅ SPRAWDŹ czy już istnieje MaterialResponse dla tego replyId (zapobieganie duplikatom)
  const existing = await db.materialResponse.findFirst({
    where: {
      replyId: reply.id,
      status: { in: ['pending', 'scheduled'] } // Tylko aktywne
    }
  });

  if (existing) {
    console.log(`[MATERIAL SENDER] ⚠️ MaterialResponse już istnieje dla replyId ${reply.id} (ID: ${existing.id}) - pomijam tworzenie duplikatu`);
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
  
  // Aktualizuj status leada
  await db.lead.update({
    where: { id: reply.lead.id },
    data: {
      status: 'ZAINTERESOWANY',
      subStatus: 'ZAINTERESOWANY_CAMPAIGN',
      updatedAt: new Date()
    }
  });

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

      // Przygotuj treść z linkami (jeśli są)
      let content = response.responseText;
      if (links.length > 0) {
        content += '\n\n';
        links.forEach(link => {
          content += `\n${link.name}: ${link.url}`;
        });
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

      // Wyślij email
      const result = await transport.sendMail({
        from: `${mailbox.displayName || response.campaign.virtualSalesperson?.name || 'Kreativia'} <${mailbox.email}>`,
        to: response.lead.email,
        subject: response.subject,
        text: content,
        html: content.replace(/\n/g, '<br>'),
        attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
        replyTo: mailbox.email
      });

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
            subject: response.subject,
            content: content.substring(0, 500), // Ogranicz do 500 znaków dla logu
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
      
      // Oznacz jako failed (z powrotem z 'sending')
      try {
        await db.materialResponse.update({
          where: { id: response.id },
          data: {
            status: 'failed',
            error: error.message
          }
        });
      } catch (updateError: any) {
        console.error(`[MATERIAL SENDER] Nie można zaktualizować statusu na 'failed' dla ${response.id}:`, updateError.message);
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

