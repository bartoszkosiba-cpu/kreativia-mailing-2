// Serwis do wysyłki zaplanowanych kampanii z uwzględnieniem harmonogramu
import { db } from "@/lib/db";
import { sendCampaignEmail } from "@/integrations/smtp/client";
import { getNextScheduledCampaign, isValidSendTime } from "./campaignScheduler";
import { getRemainingDailyLimit, incrementSentCounter, recalculateQueueForSalesperson } from "./queueManager";

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

    const result = await sendCampaignEmail({
      subject: campaign.subject || "Brak tematu",
      content: content,
      leadEmail: lead.email,
      leadLanguage: lead.language || "pl",
      leadName: lead.firstName ? `${lead.firstName} ${lead.lastName || ''}`.trim() : undefined,
      leadCompany: lead.company,
      salesperson: campaign.virtualSalesperson,
      campaign: {
        jobDescription: campaign.jobDescription,
        postscript: campaign.postscript,
        linkText: campaign.linkText,
        linkUrl: campaign.linkUrl
      },
      settings: companySettings
    });

    // Zapisz log wysyłki
    await db.sendLog.create({
      data: {
        campaignId: campaign.id,
        leadId: lead.id,
        status: "sent",
        messageId: result.messageId
      }
    });

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
    campaign.endHour,
    campaign.respectHolidays,
    targetCountries
  );
  
  if (!validation.isValid) {
    console.log(`[SCHEDULED SENDER] Teraz nie jest dobry moment: ${validation.reason}`);
    return;
  }
  
  // Oznacz kampanię jako "IN_PROGRESS"
  await db.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "IN_PROGRESS",
      sendingStartedAt: now
    }
  });
  
  console.log(`[SCHEDULED SENDER] ✓ Rozpoczynam wysyłkę kampanii ${campaign.name}`);
  
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
  
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    
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
      campaign.endHour,
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
    
    // Wyślij mail
    const result = await sendSingleEmail(campaign, lead, companySettings);
    
    if (result.success) {
      successCount++;
      
      // Inkrementuj licznik handlowca
      if (campaign.virtualSalesperson) {
        await incrementSentCounter(campaign.virtualSalesperson.id, 1);
      }
      
      console.log(`[SCHEDULED SENDER] ✓ Wysłano ${i + 1}/${leads.length} do ${lead.email}`);
    } else {
      errorCount++;
      console.log(`[SCHEDULED SENDER] ✗ Błąd ${i + 1}/${leads.length} do ${lead.email}`);
    }
    
    // Opóźnienie między mailami
    if (i < leads.length - 1) {
      const delay = campaign.delayBetweenEmails * 1000; // sekundy → ms
      console.log(`[SCHEDULED SENDER] Czekam ${campaign.delayBetweenEmails}s przed następnym mailem...`);
      await new Promise(resolve => setTimeout(resolve, delay));
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

