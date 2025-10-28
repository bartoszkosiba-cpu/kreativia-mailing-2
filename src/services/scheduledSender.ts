// Serwis do wysyłki zaplanowanych kampanii z uwzględnieniem harmonogramu
import { db } from "@/lib/db";
import { sendCampaignEmail } from "@/integrations/smtp/client";
import { getNextScheduledCampaign, isValidSendTime } from "./campaignScheduler";
import { getRemainingDailyLimit, incrementSentCounter, recalculateQueueForSalesperson } from "./queueManager";
import { getNextAvailableMailbox, incrementMailboxCounter } from "./mailboxManager";

/**
 * Wysyła pojedynczego maila z opóźnieniem
 */
async function sendSingleEmail(
  campaign: any,
  lead: any,
  companySettings: any
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Użyj greetingForm z bazy danych lub fallback na campaign.text
    let content = campaign.text || "";
    
    if (lead.greetingForm && campaign.text) {
      // Użyj istniejącej odmiany z bazy danych
      content = lead.greetingForm + "\n\n" + campaign.text;
    }

    // Pobierz dostępną skrzynkę mailową (round-robin)
    let mailbox = null;
    if (campaign.virtualSalespersonId) {
      mailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
      
      if (!mailbox) {
        const error = "Brak dostępnych skrzynek mailowych dla handlowca";
        console.error(`[SENDER] ${error}`);
        
        // Zapisz log błędu (z ochroną przed duplikatami)
        try {
          await db.sendLog.create({
            data: {
              campaignId: campaign.id,
              leadId: lead.id,
              status: "error",
              error: error
            }
          });
        } catch (dupError: any) {
          if (dupError.code !== 'P2002') {
            throw dupError; // Tylko duplikaty ignorujemy
          }
        }

        return { success: false, error: error };
      }
      
      console.log(`[SENDER] Używam skrzynki: ${mailbox.email} (pozostało: ${mailbox.remainingToday})`);
    }

    const result = await sendCampaignEmail({
      subject: campaign.subject || "Brak tematu",
      content: content,
      leadEmail: lead.email,
      leadLanguage: lead.language || "pl",
      leadName: lead.firstName ? `${lead.firstName} ${lead.lastName || ''}`.trim() : undefined,
      leadCompany: lead.company,
      salesperson: campaign.virtualSalesperson,
      mailbox: mailbox || undefined, // NOWE: Przekaż mailbox
      campaign: {
        jobDescription: campaign.jobDescription,
        postscript: campaign.postscript,
        linkText: campaign.linkText,
        linkUrl: campaign.linkUrl
      },
      settings: companySettings
    });

    // Zapisz log wysyłki (z ochroną przed duplikatami)
    try {
      await db.sendLog.create({
        data: {
          campaignId: campaign.id,
          leadId: lead.id,
          mailboxId: mailbox?.id || null,
          subject: campaign.subject || "Brak tematu", // NOWE: Zapisz subject
          content: content, // NOWE: Zapisz content
          status: "sent",
          messageId: result.messageId
        }
      });
    } catch (error: any) {
      // Jeśli już istnieje (duplikat przez race condition) - loguj i kontynuuj
      if (error.code === 'P2002') {
        console.log(`[SENDER] ⚠️  Duplikat wysyłki do ${lead.email} - już zapisany, pomijam`);
        return { success: true, messageId: result.messageId };
      }
      throw error; // Rzucamy dalej inne błędy
    }

    // Inkrementuj licznik użycia skrzynki
    if (mailbox) {
      await incrementMailboxCounter(mailbox.id);
    }

    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error(`[SENDER] Błąd wysyłki do ${lead.email}:`, error);

    // Zapisz log błędu
    await db.sendLog.create({
      data: {
        campaignId: campaign.id,
        leadId: lead.id,
        status: "error",
        error: error.message || "Nieznany błąd"
      }
    });

    return { success: false, error: error.message };
  }
}

/**
 * Przetwarza zaplanowaną kampanię i wysyła maile z uwzględnieniem harmonogramu
 */
export async function processScheduledCampaign(): Promise<void> {
  console.log('[SCHEDULED SENDER] Sprawdzam zaplanowane kampanie...');
  
  const campaign = await getNextScheduledCampaign();
  
  if (!campaign) {
    console.log('[SCHEDULED SENDER] Brak zaplanowanych kampanii');
    return;
  }
  
  console.log(`[SCHEDULED SENDER] Znaleziono kampanię: ${campaign.name} (ID: ${campaign.id})`);
  
  // Parsuj ustawienia
  const allowedDays = campaign.allowedDays.split(',');
  const targetCountries = campaign.targetCountries ? campaign.targetCountries.split(',') : [];
  
  // Sprawdź czy teraz jest dobry moment na wysyłkę
  const now = new Date();
  const validation = await isValidSendTime(
    now,
    allowedDays,
    campaign.startHour,
    campaign.startMinute ?? 0,
    campaign.endHour,
    campaign.endMinute ?? 0,
    campaign.respectHolidays,
    targetCountries
  );
  
  if (!validation.isValid) {
    console.log(`[SCHEDULED SENDER] Teraz nie jest dobry moment: ${validation.reason}`);
    return;
  }
  
  // Oznacz kampanię jako "IN_PROGRESS" (ATOMIC - zapobiega race condition)
  // Tylko jeśli status = SCHEDULED (ktoś inny nie wziął już)
  const updated = await db.campaign.updateMany({
    where: { 
      id: campaign.id,
      status: "SCHEDULED" // Tylko SCHEDULED może przejść do IN_PROGRESS
    },
    data: {
      status: "IN_PROGRESS",
      sendingStartedAt: now
    }
  });
  
  if (updated.count === 0) {
    // Ktoś inny już wziął kampanię (race condition)
    console.log(`[SCHEDULED SENDER] ⏭️ Kampania ${campaign.name} została już wzięta przez inny proces - pomijam`);
    return;
  }
  
  console.log(`[SCHEDULED SENDER] ✓ Rozpoczynam wysyłkę kampanii ${campaign.name}`);
  
  // SPRAWDŹ CZY SĄ DOSTĘPNE SKRZYNKI (PRZED ROZPOCZĘCIEM)
  if (campaign.virtualSalespersonId) {
    const availableMailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
    if (!availableMailbox) {
      console.log('[SCHEDULED SENDER] ⛔ BRAK DOSTĘPNYCH SKRZYNKEK - zatrzymuję kampanię');
      
      await db.campaign.update({
        where: { id: campaign.id },
        data: { 
          status: "SCHEDULED",
          description: (campaign.description || "") + "\n\n[Automatyczne zatrzymanie " + new Date().toISOString() + "] Brak dostępnych skrzynek - kampania zostanie wznowiona jutro."
        }
      });
      
      return; // Zatrzymaj kampanię natychmiast
    }
    console.log(`[SCHEDULED SENDER] ✓ Dostępna skrzynka: ${availableMailbox.email} (limit: ${availableMailbox.remainingToday})`);
  }
  
  // Pobierz leady
  const leads = campaign.CampaignLead.map((cl: any) => cl.lead).filter((l: any) => 
    l && l.status !== "BLOCKED" && !l.isBlocked
  );
  
  console.log(`[SCHEDULED SENDER] Leadów do wysłania: ${leads.length}`);
  
  // Pobierz ustawienia firmy
  const companySettings = await db.companySettings.findFirst();
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  let consecutiveNoMailboxErrors = 0; // Licznik kolejnych błędów "brak skrzynek"
  
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    
    // Sprawdź limit dzienny kampanii (PIERWSZY FILTR)
    if (successCount >= campaign.maxEmailsPerDay) {
      console.log(`[SCHEDULED SENDER] ⛔ Osiągnięto dzienny limit kampanii (${campaign.maxEmailsPerDay} maili). Zatrzymuję.`);
      
      await db.campaign.update({
        where: { id: campaign.id },
        data: { 
          status: "SCHEDULED",
          description: (campaign.description || "") + `\n\n[Automatyczne zatrzymanie ${new Date().toISOString()}] Osiągnięto dzienny limit kampanii - wysłano ${successCount}/${campaign.maxEmailsPerDay} maili. Kampania zostanie wznowiona jutro.`
        }
      });
      
      skippedCount = leads.length - i;
      break;
    }
    
    // ✅ Sprawdź czy kampania nie została zatrzymana (PAUSED/CANCELLED) - co 5 maili
    if (i % 5 === 0) {
      const currentCampaign = await db.campaign.findUnique({
        where: { id: campaign.id },
        select: { status: true }
      });
      
      if (currentCampaign?.status !== "IN_PROGRESS") {
        console.log(`[SCHEDULED SENDER] ⏸️  Kampania zatrzymana (status: ${currentCampaign?.status}) - przerwanie`);
        skippedCount = leads.length - i;
        break;
      }
    }
    
    // Sprawdź czy mail już został wysłany (zapobieganie duplikatom)
    const alreadySent = await db.sendLog.findFirst({
      where: {
        campaignId: campaign.id,
        leadId: lead.id,
        status: "sent"
      }
    });

    if (alreadySent) {
      console.log(`[SCHEDULED SENDER] Pomijam ${lead.email} - mail już wysłany`);
      continue;
    }
    
    // Sprawdź limit dzienny handlowca
    if (campaign.virtualSalesperson) {
      const remaining = await getRemainingDailyLimit(campaign.virtualSalesperson.id);
      
      if (remaining <= 0) {
        console.log(`[SCHEDULED SENDER] Osiągnięto dzienny limit dla handlowca. Pauza do jutra.`);
        
        // Oznacz kampanię jako SCHEDULED - wznowi się jutro
        await db.campaign.update({
          where: { id: campaign.id },
          data: { status: "SCHEDULED" }
        });
        
        skippedCount = leads.length - i;
        break;
      }
    }
    
    // Sprawdź czy nadal jesteśmy w oknie czasowym
    const checkTime = new Date();
    const timeCheck = await isValidSendTime(
      checkTime,
      allowedDays,
      campaign.startHour,
      campaign.startMinute ?? 0,
      campaign.endHour,
      campaign.endMinute ?? 0,
      campaign.respectHolidays,
      targetCountries
    );
    
    if (!timeCheck.isValid) {
      console.log(`[SCHEDULED SENDER] Koniec okna czasowego. Pauza wysyłki.`);
      
      // Oznacz kampanię jako SCHEDULED - wznowi się następnego dnia
      await db.campaign.update({
        where: { id: campaign.id },
        data: { status: "SCHEDULED" }
      });
      
      skippedCount = leads.length - i;
      break;
    }
    
    // Sprawdź czy są dostępne skrzynki (przed wysłaniem)
    if (campaign.virtualSalespersonId) {
      const availableMailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
      if (!availableMailbox) {
        console.log(`[SCHEDULED SENDER] Osiągnięto dzienny limit wszystkich skrzynek. Zatrzymuję kampanię.`);
        
        // Oznacz kampanię jako SCHEDULED - wznowi się jutro
        await db.campaign.update({
          where: { id: campaign.id },
          data: { 
            status: "SCHEDULED",
            description: (campaign.description || "") + "\n\n[Automatyczne zatrzymanie " + new Date().toISOString() + "] Osiągnięto dzienny limit - wysłano " + successCount + " maili. Kampania zostanie wznowiona jutro."
          }
        });
        
        skippedCount = leads.length - i;
        break;
      }
    }
    
    // Wyślij mail
    const result = await sendSingleEmail(campaign, lead, companySettings);
    
    if (result.success) {
      successCount++;
      consecutiveNoMailboxErrors = 0; // Reset licznika przy udanym wysłaniu
      
      // Inkrementuj licznik handlowca
      if (campaign.virtualSalesperson) {
        await incrementSentCounter(campaign.virtualSalesperson.id, 1);
      }
      
      console.log(`[SCHEDULED SENDER] ✓ Wysłano ${i + 1}/${leads.length} do ${lead.email}`);
    } else {
      errorCount++;
      console.log(`[SCHEDULED SENDER] ✗ Błąd ${i + 1}/${leads.length} do ${lead.email}`);
      
      // Sprawdź czy to błąd braku skrzynek
      if (result.error?.includes("Brak dostępnych skrzynek")) {
        consecutiveNoMailboxErrors++;
        console.log(`[SCHEDULED SENDER] ⚠️  Brak skrzynek (${consecutiveNoMailboxErrors}/3 z rzędu)`);
        
        // Jeśli 3 błędy z rzędu - zatrzymaj kampanię
        if (consecutiveNoMailboxErrors >= 3) {
          console.log(`[SCHEDULED SENDER] ⏸️  Zatrzymanie kampanii - brak dostępnych skrzynek (3x z rzędu)`);
          
          await db.campaign.update({
            where: { id: campaign.id },
            data: { 
              status: "SCHEDULED",
              description: (campaign.description || "") + "\n\n[Automatyczne zatrzymanie] Brak dostępnych skrzynek - kampania zostanie wznowiona jutro."
            }
          });
          
          skippedCount = leads.length - i;
          break;
        }
      } else {
        consecutiveNoMailboxErrors = 0; // Reset dla innych błędów
      }
    }
    
    // Opóźnienie między mailami (dynamiczne rozkładanie w oknie czasowym)
    if (i < leads.length - 1) {
      const now = new Date();
      
      // Oblicz koniec okna z marginesem 1h bezpieczeństwa
      const endWindow = new Date(now);
      endWindow.setHours(campaign.endHour, campaign.endMinute ?? 0, 0);
      endWindow.setMinutes(endWindow.getMinutes() - 60); // -1h margines
      
      const msRemaining = endWindow.getTime() - now.getTime();
      
      // Sprawdź czy zbliżamy się do limitów
      const isApproachingDailyLimit = successCount >= campaign.maxEmailsPerDay - 10; // 10 maili przed limitem
      const isApproachingTimeLimit = msRemaining <= 300000; // 5 minut do końca
      
      let actualDelay: number;
      
      if (msRemaining <= 0 || isApproachingTimeLimit) {
        // Czas minął lub kończy się - użyj bazowego delay
        const baseDelay = campaign.delayBetweenEmails;
        const randomVariation = 0.2;
        const minDelay = baseDelay * (1 - randomVariation);
        const maxDelay = baseDelay * (1 + randomVariation);
        actualDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        
        console.log(`[SCHEDULED SENDER] ⏰ ${isApproachingTimeLimit ? 'Kończy się okno czasowe' : 'Okno wygasło'}. Delay: ${actualDelay}s (bazowy)`);
      } else if (isApproachingDailyLimit) {
        // Zbliżamy się do dziennego limitu - zwiększ delay
        const baseDelay = campaign.delayBetweenEmails;
        const randomVariation = 0.2;
        const minDelay = baseDelay * 1.5 * (1 - randomVariation); // 1.5x bazowy
        const maxDelay = baseDelay * 1.5 * (1 + randomVariation);
        actualDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        
        console.log(`[SCHEDULED SENDER] 📊 Zbliża się limit dzienny (${successCount}/${campaign.maxEmailsPerDay}). Delay: ${actualDelay}s`);
      } else {
        // Normalny tryb - dynamiczne rozkładanie
        const remainingInLoop = leads.length - i - 1; // -1 bo obecny jest już wysłany w linii 296
        const optimalDelay = Math.floor(msRemaining / Math.max(1, remainingInLoop));
        
        // ZAWSZE używaj co najmniej bazowego delay, ale maksymalnie 10x bazowy (żeby nie było zbyt długich opóźnień)
        const finalOptimalDelay = Math.max(
          campaign.delayBetweenEmails, 
          Math.min(optimalDelay, campaign.delayBetweenEmails * 10)
        );
        
        // Losowość ±20%
        const randomVariation = 0.2;
        const minDelay = finalOptimalDelay * (1 - randomVariation);
        const maxDelay = finalOptimalDelay * (1 + randomVariation);
        actualDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
        
        console.log(`[SCHEDULED SENDER] ⏱️  Delay: ${actualDelay}s (optymalny: ${optimalDelay}s → użyty: ${finalOptimalDelay}s, okno: ${Math.floor(msRemaining/1000/60)}min, pozostało: ${remainingInLoop} maili)`);
      }
      
      if (actualDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, actualDelay * 1000));
      }
    }
  }
  
  // Jeśli wszystko wysłano, oznacz jako COMPLETED
  if (successCount + errorCount === leads.length) {
    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "COMPLETED",
        sendingCompletedAt: new Date()
      }
    });
    
    console.log(`[SCHEDULED SENDER] 🎉 Kampania zakończona: ${successCount} sukces, ${errorCount} błędów`);
    
    // Przekalkuluj kolejkę handlowca - następna kampania może się rozpocząć
    if (campaign.virtualSalesperson) {
      await recalculateQueueForSalesperson(campaign.virtualSalesperson.id);
    }
  } else {
    console.log(`[SCHEDULED SENDER] ⏸️ Kampania wstrzymana: ${successCount} sukces, ${errorCount} błędów, ${skippedCount} pozostało`);
  }
}

