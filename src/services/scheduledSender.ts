// Serwis do wysyłki zaplanowanych kampanii z uwzględnieniem harmonogramu
import { db } from "@/lib/db";
import { sendCampaignEmail } from "@/integrations/smtp/client";
import { getNextScheduledCampaign, isValidSendTime } from "./campaignScheduler";
import { getRemainingDailyLimit, incrementSentCounter, recalculateQueueForSalesperson } from "./queueManager";

import { getNextAvailableMailbox, incrementMailboxCounter } from "./mailboxManager";

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

/**
 * Prosta funkcja hash dla deterministycznego wyboru wariantu
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Wybiera wariant A/B dla leada
 * @returns "A" | "B"
 */
function selectVariant(
  campaign: any,
  leadId: number,
  index: number
): "A" | "B" {
  // Jeśli A/B test jest wyłączony, zawsze używaj wariantu A
  if (!campaign.abTestEnabled) {
    return "A";
  }

  const mode = campaign.abTestMode || "hash";

  switch (mode) {
    case "alternating":
      // ABABAB... deterministycznie
      return index % 2 === 0 ? "A" : "B";
    
    case "random":
      // Losowy wybór (może być nierównomierny dla małych próbek)
      return Math.random() < 0.5 ? "A" : "B";
    
    case "hash":
    default:
      // Hash-based deterministic - lead zawsze dostanie ten sam wariant
      const hashInput = `${leadId}_${campaign.id}`;
      const hash = simpleHash(hashInput);
      return hash % 2 === 0 ? "A" : "B";
  }
}

/**
 * Pobiera pola kampanii dla wybranego wariantu
 */
function getCampaignFieldsForVariant(campaign: any, variant: "A" | "B") {
  if (variant === "A" || !campaign.abTestEnabled) {
    return {
      subject: campaign.subject,
      text: campaign.text,
      jobDescription: campaign.jobDescription,
      postscript: campaign.postscript,
      linkText: campaign.linkText,
      linkUrl: campaign.linkUrl
    };
  } else {
    // Wariant B
    return {
      subject: campaign.subjectB || campaign.subject, // Fallback na A jeśli B nie ustawione
      text: campaign.textB || campaign.text,
      jobDescription: campaign.jobDescriptionB || campaign.jobDescription,
      postscript: campaign.postscriptB || campaign.postscript,
      linkText: campaign.linkTextB || campaign.linkText,
      linkUrl: campaign.linkUrlB || campaign.linkUrl
    };
  }
}

/**
 * Wysyła pojedynczego maila z opóźnieniem
 */
async function sendSingleEmail(
  campaign: any,
  lead: any,
  companySettings: any,
  index: number = 0 // Indeks leada (dla alternating mode)
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Wybierz wariant A/B
    const variant = selectVariant(campaign, lead.id, index);
    const campaignFields = getCampaignFieldsForVariant(campaign, variant);
    
    console.log(`[SENDER] Wariant ${variant} dla leada ${lead.id} (kampania ${campaign.id})`);
    
    // ✅ SPRAWDŹ JĘZYK KAMPANII vs JĘZYK LEADA
    const campaignLanguage = campaign.virtualSalesperson?.language || 'pl';
    const leadLanguage = lead.language || 'pl';
    const languageMismatch = campaignLanguage !== leadLanguage;
    
    let greetingForm: string | null = null;
    
    if (languageMismatch) {
      // ✅ RÓŻNE JĘZYKI: Wygeneruj powitanie w języku kampanii
      console.log(`[SENDER] ⚠️ Konflikt języków: lead=${leadLanguage}, kampania=${campaignLanguage} - generuję powitanie w języku kampanii`);
      
      if (lead.firstName) {
        try {
          const { chatgptService } = await import('@/services/chatgptService');
          const results = await chatgptService.batchProcessNames(
            [lead.firstName],
            [lead.lastName || ''],
            [campaignLanguage] // ✅ Użyj języka kampanii, nie leada
          );
          
          if (results && results.length > 0 && results[0]?.greetingForm) {
            greetingForm = results[0].greetingForm;
            console.log(`[SENDER] ✅ Wygenerowano powitanie w języku kampanii (${campaignLanguage}): "${greetingForm}"`);
          }
        } catch (error: any) {
          console.error(`[SENDER] ❌ Błąd generowania powitania w języku kampanii:`, error.message);
          // Fallback - użyj domyślnego powitania w języku kampanii
          greetingForm = getDefaultGreetingForLanguage(campaignLanguage);
        }
      } else {
        // Brak imienia - użyj domyślnego powitania
        greetingForm = getDefaultGreetingForLanguage(campaignLanguage);
      }
    } else {
      // ✅ TAKI SAM JĘZYK: Użyj istniejącego powitania z bazy
      greetingForm = lead.greetingForm;
      if (greetingForm) {
        console.log(`[SENDER] Używam powitania z bazy: "${greetingForm}" (język: ${leadLanguage})`);
      }
    }
    
    // Składaj treść emaila
    let content = campaignFields.text || "";
    if (greetingForm && campaignFields.text) {
      content = greetingForm + "\n\n" + campaignFields.text;
    } else if (!greetingForm && campaignFields.text) {
      // Fallback jeśli nie ma powitania
      console.warn(`[SENDER] ⚠️ Brak powitania dla lead ${lead.id} - wysyłam bez powitania`);
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
      subject: campaignFields.subject || "Brak tematu",
      content: content,
      leadEmail: lead.email,
      leadLanguage: lead.language || "pl",
      leadName: lead.firstName ? `${lead.firstName} ${lead.lastName || ''}`.trim() : undefined,
      leadCompany: lead.company,
      salesperson: campaign.virtualSalesperson,
      mailbox: mailbox || undefined, // NOWE: Przekaż mailbox
      campaign: {
        jobDescription: campaignFields.jobDescription,
        postscript: campaignFields.postscript,
        linkText: campaignFields.linkText,
        linkUrl: campaignFields.linkUrl
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
          subject: campaignFields.subject || "Brak tematu", // Zapisz subject użytego wariantu
          content: content, // Zapisz content
          variantLetter: variant, // Zapisz użyty wariant A/B
          status: "sent",
          messageId: result.messageId
        }
      });
    } catch (error: any) {
      // ✅ Unique constraint zapobiegł duplikatowi na poziomie bazy danych
      if (error.code === 'P2002') {
        console.log(`[SENDER] ⚠️  Duplikat wysyłki do ${lead.email} wykryty przez unique constraint - mail już zapisany przez inny proces, pomijam`);
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
  const processStartTime = new Date();
  console.log(`[SCHEDULED SENDER] ⏰ Rozpoczynam processScheduledCampaign (${processStartTime.toISOString()})`);
  
  const queryStartTime = Date.now();
  const campaign = await getNextScheduledCampaign();
  const queryDuration = Date.now() - queryStartTime;
  
  if (queryDuration > 1000) {
    console.log(`[SCHEDULED SENDER] ⚠️ getNextScheduledCampaign trwało ${queryDuration}ms (dłużej niż 1s)`);
  }
  
  if (!campaign) {
    console.log('[SCHEDULED SENDER] Brak zaplanowanych kampanii');
    return;
  }
  
  console.log(`[SCHEDULED SENDER] ✅ Znaleziono kampanię: ${campaign.name} (ID: ${campaign.id}, status: ${campaign.status})`);
  
  // ✅ SPRAWDŹ CZY KAMPANIA NIE JEST PAUSED/CANCELLED (PRZED ROZPOCZĘCIEM)
  if (campaign.status === "PAUSED" || campaign.status === "CANCELLED") {
    console.log(`[SCHEDULED SENDER] ⏸️  Kampania ${campaign.name} jest ${campaign.status} - pomijam`);
    
    // Przywróć wszystkie leady ze statusem "sending" do "queued" (recovery po crash)
    await db.campaignLead.updateMany({
      where: {
        campaignId: campaign.id,
        status: "sending"
      },
      data: {
        status: "queued"
      }
    });
    
    return;
  }
  
  console.log(`[SCHEDULED SENDER] Znaleziono kampanię: ${campaign.name} (ID: ${campaign.id})`);
  
  // ✅ ODŚWIEŻ USTAWIENIA KAMPANII Z BAZY (aby mieć aktualne wartości po zmianach)
  const freshCampaign = await db.campaign.findUnique({
    where: { id: campaign.id },
    select: {
      startHour: true,
      startMinute: true,
      endHour: true,
      endMinute: true,
      allowedDays: true,
      targetCountries: true,
      respectHolidays: true
    }
  });
  
  if (!freshCampaign) {
    console.log(`[SCHEDULED SENDER] ⚠️ Kampania ${campaign.id} nie istnieje w bazie`);
    return;
  }
  
  // Aktualizuj obiekt kampanii najnowszymi wartościami
  campaign.startHour = freshCampaign.startHour;
  campaign.startMinute = freshCampaign.startMinute ?? 0;
  campaign.endHour = freshCampaign.endHour;
  campaign.endMinute = freshCampaign.endMinute ?? 0;
  campaign.allowedDays = freshCampaign.allowedDays;
  campaign.targetCountries = freshCampaign.targetCountries;
  campaign.respectHolidays = freshCampaign.respectHolidays;
  
  // Parsuj ustawienia
  const allowedDays = campaign.allowedDays.split(',');
  const targetCountries = campaign.targetCountries ? campaign.targetCountries.split(',') : [];
  
  // Sprawdź czy teraz jest dobry moment na wysyłkę (używając ODŚWIEŻONYCH wartości)
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
  // Jeśli już jest IN_PROGRESS - kontynuuj wysyłkę (dla nowo dodanych leadów)
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
  
  let isContinuingCampaign = false;
  if (updated.count === 0) {
    // Kampania już jest IN_PROGRESS - sprawdź czy to nie inny proces
    const currentCampaign = await db.campaign.findUnique({
      where: { id: campaign.id },
      select: { status: true }
    });
    
    if (currentCampaign?.status === "IN_PROGRESS") {
      // Kontynuuj wysyłkę dla kampanii IN_PROGRESS (nowo dodani leady w kolejce)
      console.log(`[SCHEDULED SENDER] ⏩ Kampania ${campaign.name} już w trakcie - kontynuuję wysyłkę dla leadów w kolejce`);
      isContinuingCampaign = true;
      // Nie przerywaj - kontynuuj dalej
    } else {
      // Ktoś inny już wziął kampanię lub zmienił status (race condition lub PAUSED/CANCELLED)
      console.log(`[SCHEDULED SENDER] ⏭️ Kampania ${campaign.name} została już wzięta przez inny proces (status: ${currentCampaign?.status}) - pomijam`);
      return;
    }
  }
  
  console.log(`[SCHEDULED SENDER] ✓ Rozpoczynam wysyłkę kampanii ${campaign.name}`);
  
  // ✅ USUNIĘTO SPRAWDZANIE SKRZYNKI NA POCZĄTKU - sprawdzamy dopiero gdy jest lead do wysłania
  // To pozwala kampanii działać nawet jeśli tymczasowo brakuje skrzynek (może się zwolnić w ciągu minuty)
  
  // ✅ NOWE: Przygotuj statusy do przetworzenia (dla nowych kampanii)
  if (!isContinuingCampaign) {
    // Dla kampanii SCHEDULED (nowo startująca): zmień "planned" na "queued", "sending" na "queued"
    await db.campaignLead.updateMany({
      where: {
        campaignId: campaign.id,
        status: { in: ["planned", "sending"] },
        lead: {
          status: { not: "BLOCKED" },
          isBlocked: false
        }
      },
      data: { status: "queued" }
    });
  }
  
  // ✅ ATOMOWE POBRANIE I LOCK: Znajdź JEDEN lead i od razu zmień na "sending"
  // To zapobiega race condition - tylko jeden proces może zająć leada
  // Używamy bezpośredniego zapytania do bazy zamiast relacji campaign.CampaignLead
  const atomicLead = await db.campaignLead.findFirst({
    where: {
      campaignId: campaign.id,
      status: "queued",
      lead: {
        status: { not: "BLOCKED" },
        isBlocked: false
      }
    },
    include: {
      lead: true
    },
    orderBy: {
      createdAt: "asc" // Najstarszy pierwszy
    }
  });
  
  if (!atomicLead || !atomicLead.lead) {
    console.log(`[SCHEDULED SENDER] ❌ Brak leadów do wysłania (campaignId: ${campaign.id})`);
    return;
  }
  
  console.log(`[SCHEDULED SENDER] 📧 Znalazłem leada do wysłania: ${atomicLead.lead.email} (leadId: ${atomicLead.lead.id}, campaignLeadId: ${atomicLead.id})`);
  
  // ✅ ATOMOWA BLOKADA: Zmień status na "sending" (tylko jeden proces może to zrobić)
  const atomicUpdate = await db.campaignLead.updateMany({
    where: {
      id: atomicLead.id,
      status: "queued" // Tylko jeśli nadal jest "queued"
    },
    data: {
      status: "sending"
    }
  });
  
  if (atomicUpdate.count === 0) {
    // Inny proces już zajął tego leada - koniec (tylko 1 mail na wywołanie cron)
    console.log(`[SCHEDULED SENDER] ⚠️  Lead ${atomicLead.lead.email} został już zajęty przez inny proces`);
    return;
  }
  
  const lead = atomicLead.lead;
  const campaignLead = atomicLead;
  
  // Pobierz ustawienia firmy
  const companySettings = await db.companySettings.findFirst();
  
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  let consecutiveNoMailboxErrors = 0;
  
  // ✅ Sprawdź SendLog PRZED wysyłką (dodatkowa ochrona)
  const alreadySentCheck = await db.sendLog.findFirst({
    where: {
      campaignId: campaign.id,
      leadId: lead.id,
      status: "sent"
    }
  });

  if (alreadySentCheck) {
    // Mail już wysłany - oznacz CampaignLead jako "sent" i zakończ
    await db.campaignLead.update({
      where: { id: campaignLead.id },
      data: { status: "sent" }
    });
    console.log(`[SCHEDULED SENDER] ⚠️  Pomijam ${lead.email} - mail już wysłany (wykryty przed wysyłką, wysłany o ${alreadySentCheck.createdAt.toISOString()})`);
    return;
  }
  
  // ✅ Sprawdź limit dzienny kampanii (używając polskiego czasu)
  const { getStartOfTodayPL } = await import('@/utils/polishTime');
  const startOfTodayPL = getStartOfTodayPL();
  
  const sentTodayCount = await db.sendLog.count({
    where: {
      campaignId: campaign.id,
      status: 'sent',
      createdAt: { gte: startOfTodayPL }
    }
  });
  
  if (sentTodayCount >= campaign.maxEmailsPerDay) {
    console.log(`[SCHEDULED SENDER] ⛔ Osiągnięto dzienny limit kampanii (${campaign.maxEmailsPerDay} maili). Zatrzymuję.`);
    
    await db.campaign.update({
      where: { id: campaign.id },
      data: { 
        status: "SCHEDULED",
        description: (campaign.description || "") + `\n\n[Automatyczne zatrzymanie ${new Date().toISOString()}] Osiągnięto dzienny limit kampanii - wysłano ${sentTodayCount}/${campaign.maxEmailsPerDay} maili. Kampania zostanie wznowiona jutro.`
      }
    });
    
    // Przywróć lead do queued
    await db.campaignLead.update({
      where: { id: campaignLead.id },
      data: { status: "queued" }
    });
    return;
  }
  
  // ✅ Odśwież ustawienia kampanii (na wypadek zmiany w trakcie)
  const currentCampaign = await db.campaign.findUnique({
    where: { id: campaign.id },
    select: { 
      status: true,
      endHour: true,
      endMinute: true,
      startHour: true,
      startMinute: true,
      delayBetweenEmails: true
    }
  });
  
  if (currentCampaign?.status !== "IN_PROGRESS") {
    console.log(`[SCHEDULED SENDER] ⏸️  Kampania zatrzymana (status: ${currentCampaign?.status}) - przywracam lead do queued`);
    await db.campaignLead.update({
      where: { id: campaignLead.id },
      data: { status: "queued" }
    });
    return;
  }
  
  // Odśwież ustawienia
  if (currentCampaign) {
    campaign.endHour = currentCampaign.endHour;
    campaign.endMinute = currentCampaign.endMinute;
    campaign.startHour = currentCampaign.startHour;
    campaign.startMinute = currentCampaign.startMinute;
    campaign.delayBetweenEmails = currentCampaign.delayBetweenEmails;
  }
    
  // Sprawdź limit dzienny handlowca
  if (campaign.virtualSalesperson) {
    const remaining = await getRemainingDailyLimit(campaign.virtualSalesperson.id);
    
    if (remaining <= 0) {
      console.log(`[SCHEDULED SENDER] Osiągnięto dzienny limit dla handlowca. Pauza do jutra.`);
      
      await db.campaign.update({
        where: { id: campaign.id },
        data: { status: "SCHEDULED" }
      });
      
      // Przywróć lead do queued
      await db.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: "queued" }
      });
      return;
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
    
    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "SCHEDULED" }
    });
    
    // Przywróć lead do queued
    await db.campaignLead.update({
      where: { id: campaignLead.id },
      data: { status: "queued" }
    });
    return;
  }
  
  // Sprawdź czy są dostępne skrzynki
  let availableMailbox = null;
  if (campaign.virtualSalespersonId) {
    availableMailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
    if (!availableMailbox) {
      console.log(`[SCHEDULED SENDER] ⚠️ Osiągnięto dzienny limit wszystkich skrzynek. Przywracam lead do kolejki - spróbuję za minutę.`);
      
      // ✅ NIE ZATRZYMUJ KAMPANII - tylko przywróć lead do kolejki
      // Kampania zostanie w IN_PROGRESS i cron spróbuje ponownie za minutę
      // (może inna skrzynka się zwolni lub limit się zresetuje jutro)
      await db.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: "queued" }
      });
      return;
    }
    console.log(`[SCHEDULED SENDER] ✓ Dostępna skrzynka: ${availableMailbox.email} (limit: ${availableMailbox.remainingToday})`);
  }
  
  // ✅ PROSTA LOGIKA: Sprawdź czy minął delay od ostatniego maila
  // Delay = delayBetweenEmails ± 20% (bez równomiernego rozkładu)
  const lastSentLog = await db.sendLog.findFirst({
    where: {
      campaignId: campaign.id,
      status: 'sent'
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (lastSentLog) {
    const lastSentTime = new Date(lastSentLog.createdAt);
    // ✅ WAŻNE: Oblicz delay używając AKTUALNEGO czasu (nie checkTime z początku funkcji)
    const nowForDelay = new Date();
    const timeSinceLastMail = Math.floor((nowForDelay.getTime() - lastSentTime.getTime()) / 1000); // sekundy
    
    // ✅ PROSTY DELAY: Bazowy ± 20%
    const baseDelay = campaign.delayBetweenEmails;
    const randomVariation = 0.2;
    const minRequiredDelay = Math.floor(baseDelay * (1 - randomVariation)); // 80% bazowego
    
    // ✅ DEBUG: Szczegółowe logowanie
    console.log(`[SCHEDULED SENDER] 🕐 Sprawdzam delay: ostatni mail ${lastSentTime.toISOString()}, teraz ${nowForDelay.toISOString()}, minęło ${timeSinceLastMail}s, wymagane minimum ${minRequiredDelay}s (bazowy ${baseDelay}s)`);
    
    // Jeśli delay jeszcze nie minął - przywróć lead do queued i zakończ
    if (timeSinceLastMail < minRequiredDelay) {
      const remainingDelay = minRequiredDelay - timeSinceLastMail;
      console.log(`[SCHEDULED SENDER] ⏳ Delay jeszcze nie minął (minęło: ${timeSinceLastMail}s, wymagane minimum: ${minRequiredDelay}s, bazowy: ${baseDelay}s, pozostało: ${remainingDelay}s). Następne wywołanie cron za ~1 minutę.`);
      
      // Przywróć lead do queued (zamiast zostawić w "sending")
      await db.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: "queued" }
      });
      return;
    }
    
    console.log(`[SCHEDULED SENDER] ⏱️  Delay minął (minęło: ${timeSinceLastMail}s, wymagane minimum: ${minRequiredDelay}s, bazowy: ${baseDelay}s) - kontynuuję wysyłkę`);
  } else {
    console.log(`[SCHEDULED SENDER] 📧 Brak poprzednich maili - wysyłam pierwszy mail z kampanii`);
  }
  
  // Wyślij mail
  const result = await sendSingleEmail(campaign, lead, companySettings, 0);
  
  if (result.success) {
    // Inkrementuj licznik handlowca
    if (campaign.virtualSalesperson) {
      await incrementSentCounter(campaign.virtualSalesperson.id, 1);
    }
    
    // ✅ Zaktualizuj status CampaignLead na "sent" (już był "sending" przez atomową blokadę)
    await db.campaignLead.update({
      where: { id: campaignLead.id },
      data: {
        status: "sent",
        sentAt: new Date()
      }
    });
    
    console.log(`[SCHEDULED SENDER] ✓ Wysłano mail do ${lead.email}`);
  } else {
    // Błąd wysyłki - przywróć lead do queued (umożliwia ponowną próbę)
    await db.campaignLead.update({
      where: { id: campaignLead.id },
      data: { status: "queued" }
    });
    
    console.log(`[SCHEDULED SENDER] ✗ Błąd wysyłki do ${lead.email}: ${result.error}`);
  }
  
  // ✅ Zakończono - tylko jeden lead na wywołanie cron
  // Następne wywołanie cron wyśle kolejny lead (jeśli delay minął)
}

