/**
 * DYNAMIC ESTIMATOR - Dynamiczne przeliczanie szacowanych dat kampanii
 * 
 * Odpowiedzialny za:
 * - Codzienne przeliczanie szacowanej daty zakończenia
 * - Uwzględnianie dynamicznych limitów (warmup, skrzynki)
 * - Aktualizacja estimatedEndDate w czasie rzeczywistym
 */

import { db } from "@/lib/db";
import { getNextAvailableMailbox } from "./mailboxManager";

interface EstimationResult {
  estimatedEndDate: Date;
  daysRemaining: number;
  emailsPerDay: number;
  totalEmailsRemaining: number;
}

/**
 * Dynamicznie przelicza szacowaną datę zakończenia kampanii
 * Uwzględnia:
 * - Aktualną liczbę wysłanych maili
 * - Dostępne limity skrzynek (na DZISIAJ)
 * - Progres warmup skrzynek
 */
export async function recalculateCampaignEstimate(campaignId: number): Promise<EstimationResult> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      CampaignLead: {
        include: {
          lead: true
        }
      }
    }
  });

  if (!campaign || !campaign.virtualSalespersonId) {
    throw new Error("Kampania nie istnieje lub nie ma przypisanego handlowca");
  }

  // 1. Pobierz ile maili wysnolano do tej pory
  const sentCount = await db.sendLog.count({
    where: {
      campaignId,
      status: "sent"
    }
  });

  // 2. Pobierz ile maili pozostało do wysłania
  const totalLeads = campaign.CampaignLead.length;
  const remainingEmails = totalLeads - sentCount;

  if (remainingEmails <= 0) {
    // Kampania zakończona
    return {
      estimatedEndDate: campaign.sendingCompletedAt || new Date(),
      daysRemaining: 0,
      emailsPerDay: 0,
      totalEmailsRemaining: 0
    };
  }

  // 3. Oblicz dzisiejszą dostępną pojemność (z tego co jest dostępne TERAZ)
  const todayCapacity = await calculateTodayCapacity(campaign.virtualSalespersonId, campaign.maxEmailsPerDay);
  
  // 4. Oblicz ile dni potrzebujemy
  const daysNeeded = Math.ceil(remainingEmails / todayCapacity.emailsPerDay);

  // 5. Znajdź datę zakończenia (tylko dni robocze)
  const allowedDays = campaign.allowedDays.split(",");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let workDaysAdded = 0;
  let estimatedEnd = new Date(today);

  while (workDaysAdded < daysNeeded) {
    estimatedEnd.setDate(estimatedEnd.getDate() + 1);
    
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const dayName = dayNames[estimatedEnd.getDay()];
    
    if (!allowedDays.includes(dayName)) {
      continue; // Pomiń weekendy
    }
    
    // TODO: Uwzględnij święta jeśli respectHolidays
    workDaysAdded++;
  }

  // Ustaw godzinę zakończenia na koniec okna czasowego
  estimatedEnd.setHours(campaign.endHour, campaign.endMinute || 0, 0, 0);

  return {
    estimatedEndDate: estimatedEnd,
    daysRemaining: daysNeeded,
    emailsPerDay: todayCapacity.emailsPerDay,
    totalEmailsRemaining: remainingEmails
  };
}

/**
 * Oblicza dzisiejszą dostępną pojemność dla handlowca
 * Bierze najniższą wartość z:
 * - maxEmailsPerDay (kampania)
 * - Suma pozostałych limitów skrzynek
 */
export async function calculateTodayCapacity(virtualSalespersonId: number, campaignDailyLimit: number): Promise<{ emailsPerDay: number; breakdown: string[] }> {
  // Pobierz wszystkie skrzynki
  const mailboxes = await db.mailbox.findMany({
    where: {
      virtualSalespersonId,
      isActive: true
    }
  });

  let totalCapacity = 0;
  const breakdown: string[] = [];

  // ✅ NAPRAWIONE: Oblicz remainingToday dla każdej skrzynki bezpośrednio
  // (nie używaj getNextAvailableMailbox w pętli - zwraca tylko pierwszą dostępną)
  
  const today = new Date().toDateString();

  // Funkcje pomocnicze (skopiowane z mailboxManager.ts)
  const getWeekFromDay = (day: number): number => {
    if (day <= 0) return 1;
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    if (day <= 28) return 4;
    return 5;
  };

  const getPerformanceLimits = async (week: number): Promise<{ warmup: number; campaign: number }> => {
    try {
      const settings = await db.companySettings.findFirst();
      
      if (!settings || !settings.warmupPerformanceSettings) {
        return { warmup: 15, campaign: 10 };
      }
      
      const weeks: Array<{ week: number; warmup: number; campaign: number }> = JSON.parse(settings.warmupPerformanceSettings);
      const weekData = weeks.find(w => w.week === week);
      
      return weekData || weeks[0] || { warmup: 15, campaign: 10 };
    } catch (error) {
      console.error('[CALCULATE CAPACITY] Błąd pobierania ustawień wydajności:', error);
      return { warmup: 15, campaign: 10 };
    }
  };

  for (const mailbox of mailboxes) {
    // Resetuj licznik jeśli nowy dzień (używamy isTodayPL z polishTime)
    const { isTodayPL } = await import('@/utils/polishTime');
    if (!mailbox.lastResetDate || !isTodayPL(mailbox.lastResetDate)) {
      const { resetMailboxCounter } = await import('./mailboxManager');
      await resetMailboxCounter(mailbox.id, mailbox.warmupStatus || undefined);
    }

    // Oblicz effectiveLimit i currentSent (ta sama logika co getNextAvailableMailbox)
    let effectiveLimit: number;
    let currentSent: number;
    
    // PRZYPADEK 3: W warmup - użyj limitów z /settings/performance
    if (mailbox.warmupStatus === 'warming') {
      const week = getWeekFromDay(mailbox.warmupDay || 0);
      const performanceLimits = await getPerformanceLimits(week);
      
      effectiveLimit = Math.min(
        mailbox.dailyEmailLimit,
        mailbox.warmupDailyLimit || 10,
        performanceLimits.campaign
      );
      
      currentSent = Math.max(0, mailbox.currentDailySent - (mailbox.warmupTodaySent || 0));
    } 
    // PRZYPADEK 1: Nowa skrzynka, nie w warmup - STAŁE 10 maili dziennie
    else if (mailbox.warmupStatus === 'inactive' || mailbox.warmupStatus === 'ready_to_warmup') {
      const NEW_MAILBOX_LIMIT = 10;
      effectiveLimit = NEW_MAILBOX_LIMIT;
      currentSent = mailbox.currentDailySent;
    }
    // PRZYPADEK 2 i 4: Gotowa skrzynka (nie w warmup) - użyj limitu ze skrzynki
    else {
      effectiveLimit = mailbox.dailyEmailLimit;
      currentSent = mailbox.currentDailySent;
    }
    
    const remaining = Math.max(0, effectiveLimit - currentSent);
    totalCapacity += remaining;
    
    if (remaining > 0) {
      breakdown.push(`${mailbox.email}: ${remaining}/${effectiveLimit}`);
    }
  }

  // Weź najniższą wartość
  const effectiveCapacity = Math.min(campaignDailyLimit, totalCapacity);

  return {
    emailsPerDay: effectiveCapacity || campaignDailyLimit, // Fallback jeśli brak skrzynek
    breakdown
  };
}

/**
 * Wywołaj codziennie w cron do aktualizacji szacowanych dat
 */
export async function updateAllCampaignEstimates(): Promise<void> {
  console.log('[ESTIMATOR] 🔄 Aktualizuję szacowane daty dla wszystkich kampanii...');
  
  const campaigns = await db.campaign.findMany({
    where: {
      status: {
        in: ["SCHEDULED", "IN_PROGRESS"]
      }
    }
  });

  let updated = 0;

  for (const campaign of campaigns) {
    try {
      const estimate = await recalculateCampaignEstimate(campaign.id);
      
      await db.campaign.update({
        where: { id: campaign.id },
        data: {
          estimatedEndDate: estimate.estimatedEndDate
        }
      });

      console.log(`[ESTIMATOR] ✓ Kampania ${campaign.id}: ${estimate.daysRemaining} dni, ${estimate.emailsPerDay} maili/dzień`);
      updated++;
    } catch (error: any) {
      console.error(`[ESTIMATOR] ✗ Błąd dla kampanii ${campaign.id}:`, error.message);
    }
  }

  console.log(`[ESTIMATOR] ✅ Zaktualizowano ${updated} kampanii`);
}



