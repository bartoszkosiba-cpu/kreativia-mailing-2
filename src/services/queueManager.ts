// Serwis do zarządzania kolejką kampanii per handlowiec
import { db } from "@/lib/db";
import { isHoliday } from "./holidays";
import { WarmupManager } from "./warmupManager";
import { resetDailyCounters as resetWarmupCounters } from "./warmup/tracker";

/**
 * Resetuje dzienny licznik wysłanych maili dla handlowca (jeśli nowy dzień)
 */
export async function resetDailyCounterIfNeeded(salespersonId: number): Promise<void> {
  const salesperson = await db.virtualSalesperson.findUnique({
    where: { id: salespersonId }
  });

  if (!salesperson) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastReset = salesperson.lastResetDate ? new Date(salesperson.lastResetDate) : null;
  
  if (!lastReset || lastReset < today) {
    // Nowy dzień - resetuj licznik
    await db.virtualSalesperson.update({
      where: { id: salespersonId },
      data: {
        currentDailySent: 0,
        lastResetDate: today
      }
    });
    
    console.log(`[QUEUE] Reset licznika dla handlowca ${salespersonId}`);
  }
}

/**
 * Sprawdza ile handlowiec może jeszcze wysłać dzisiaj
 */
export async function getRemainingDailyLimit(salespersonId: number): Promise<number> {
  await resetDailyCounterIfNeeded(salespersonId);
  
  const salesperson = await db.virtualSalesperson.findUnique({
    where: { id: salespersonId }
  });

  if (!salesperson) return 0;

  return Math.max(0, salesperson.dailyEmailLimit - salesperson.currentDailySent);
}

/**
 * Inkrementuje licznik wysłanych maili
 */
export async function incrementSentCounter(salespersonId: number, count: number = 1): Promise<void> {
  await db.virtualSalesperson.update({
    where: { id: salespersonId },
    data: {
      currentDailySent: {
        increment: count
      }
    }
  });
}

/**
 * Oblicza szacowane daty rozpoczęcia i zakończenia kampanii
 */
export async function calculateEstimatedDates(
  salespersonId: number,
  leadsCount: number,
  startHour: number,
  endHour: number,
  allowedDays: string[],
  respectHolidays: boolean,
  targetCountries: string[]
): Promise<{ estimatedStart: Date; estimatedEnd: Date; daysNeeded: number }> {
  const salesperson = await db.virtualSalesperson.findUnique({
    where: { id: salespersonId }
  });

  if (!salesperson) {
    throw new Error("Nie znaleziono handlowca");
  }

  const dailyLimit = salesperson.dailyEmailLimit;
  
  // Pobierz aktualnie wysyłane/zaplanowane kampanie tego handlowca
  const activeCampaigns = await db.campaign.findMany({
    where: {
      virtualSalespersonId: salespersonId,
      status: {
        in: ["SCHEDULED", "IN_PROGRESS"]
      }
    },
    orderBy: {
      queuePriority: "asc"
    }
  });

  // Znajdź datę rozpoczęcia (po ostatniej aktywnej kampanii)
  let estimatedStart = new Date();
  
  if (activeCampaigns.length > 0) {
    const lastCampaign = activeCampaigns[activeCampaigns.length - 1];
    if (lastCampaign.estimatedEndDate) {
      estimatedStart = new Date(lastCampaign.estimatedEndDate);
    }
  }

  // Oblicz ile dni potrzebujemy
  const daysNeeded = Math.ceil(leadsCount / dailyLimit);
  
  // Znajdź datę zakończenia (uwzględniając weekendy i święta)
  let estimatedEnd = new Date(estimatedStart);
  let workDaysAdded = 0;
  
  while (workDaysAdded < daysNeeded) {
    estimatedEnd.setDate(estimatedEnd.getDate() + 1);
    
    // Sprawdź dzień tygodnia
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const dayName = dayNames[estimatedEnd.getDay()];
    
    if (!allowedDays.includes(dayName)) {
      continue; // Pomiń ten dzień
    }
    
    // Sprawdź święta
    if (respectHolidays && targetCountries.length > 0) {
      const isHol = await isHoliday(estimatedEnd, targetCountries);
      if (isHol) {
        continue; // Pomiń święto
      }
    }
    
    workDaysAdded++;
  }

  // Ustaw godzinę zakończenia
  estimatedEnd.setHours(endHour, 0, 0, 0);

  return {
    estimatedStart,
    estimatedEnd,
    daysNeeded: workDaysAdded
  };
}

/**
 * Aktualizuje szacowane daty dla wszystkich kampanii w kolejce handlowca
 */
export async function recalculateQueueForSalesperson(salespersonId: number): Promise<void> {
  console.log(`[QUEUE] Przekalkulowuję kolejkę dla handlowca ${salespersonId}...`);
  
  const campaigns = await db.campaign.findMany({
    where: {
      virtualSalespersonId: salespersonId,
      status: {
        in: ["SCHEDULED", "IN_PROGRESS"]
      }
    },
    include: {
      CampaignLead: true
    },
    orderBy: {
      queuePriority: "asc"
    }
  });

  let runningDate = new Date();

  for (const campaign of campaigns) {
    const leadsCount = campaign.CampaignLead.length;
    const allowedDays = campaign.allowedDays.split(",");
    const targetCountries = campaign.targetCountries ? campaign.targetCountries.split(",") : [];

    const estimate = await calculateEstimatedDates(
      salespersonId,
      leadsCount,
      campaign.startHour,
      campaign.endHour,
      allowedDays,
      campaign.respectHolidays,
      targetCountries
    );

    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        estimatedStartDate: estimate.estimatedStart,
        estimatedEndDate: estimate.estimatedEnd
      }
    });

    runningDate = estimate.estimatedEnd;
    console.log(`[QUEUE] Kampania ${campaign.id}: ${estimate.estimatedStart.toLocaleDateString()} - ${estimate.estimatedEnd.toLocaleDateString()}`);
  }
}

/**
 * Pobiera kolejkę kampanii dla handlowca
 */
export async function getSalespersonQueue(salespersonId: number) {
  return await db.campaign.findMany({
    where: {
      virtualSalespersonId: salespersonId,
      status: {
        in: ["SCHEDULED", "SENDING", "DRAFT"]
      }
    },
    include: {
      CampaignLead: true
    },
    orderBy: {
      queuePriority: "asc"
    }
  });
}

// ============================================================================
// WARMUP QUEUE MANAGEMENT - Obsługa warmup maili
// ============================================================================

/**
 * Sprawdza czy mailbox może wysłać warmup mail
 */
export async function canSendWarmupEmail(mailboxId: number): Promise<boolean> {
  return await WarmupManager.canSendWarmupEmail(mailboxId);
}

/**
 * Pobiera limit warmup dla mailbox
 */
export async function getWarmupLimit(mailboxId: number): Promise<number> {
  return await WarmupManager.getWarmupLimit(mailboxId);
}

/**
 * Sprawdza czy mailbox może wysłać zwykły mail kampanii
 */
export async function canSendCampaignEmail(mailboxId: number): Promise<boolean> {
  const mailbox = await db.mailbox.findUnique({
    where: { id: mailboxId }
  });

  if (!mailbox || !mailbox.isActive) {
    return false;
  }

  // PRZYPADEK 3: Skrzynka w warmup - użyj limitów z /settings/performance
  if (mailbox.warmupStatus === 'warming') {
    // Pobierz tydzień na podstawie dnia warmup
    const getWeekFromDay = (day: number): number => {
      if (day <= 0) return 1;
      if (day <= 7) return 1;
      if (day <= 14) return 2;
      if (day <= 21) return 3;
      if (day <= 28) return 4;
      return 5;
    };

    // Pobierz limity z ustawień wydajności
    const getPerformanceLimits = async (week: number): Promise<{ warmup: number; campaign: number }> => {
      try {
        const settings = await db.companySettings.findFirst();
        
        if (!settings || !settings.warmupPerformanceSettings) {
          return { warmup: 15, campaign: 10 };
        }
        
        const weeks: Array<{ week: number; warmup: number; campaign: number }> = JSON.parse(settings.warmupPerformanceSettings);
        const weekData = weeks.find(w => w.week === week);
        
        if (!weekData) {
          return weeks[0] || { warmup: 15, campaign: 10 };
        }
        
        return { warmup: weekData.warmup, campaign: weekData.campaign };
      } catch (error) {
        console.error('[QUEUE] Błąd pobierania ustawień wydajności:', error);
        return { warmup: 15, campaign: 10 };
      }
    };

    const week = getWeekFromDay(mailbox.warmupDay || 0);
    const performanceLimits = await getPerformanceLimits(week);
    
    // Sprawdź czy nie przekroczono limitu kampanii dla skrzynek w warmup
    // currentDailySent zawiera WSZYSTKIE maile (warmup + kampanie)
    // campaignEmailsSent = currentDailySent - warmupTodaySent
    const campaignEmailsSent = Math.max(0, mailbox.currentDailySent - mailbox.warmupTodaySent);
    return campaignEmailsSent < performanceLimits.campaign;
  }

  // PRZYPADEK 1: Nowa skrzynka, nie w warmup - STAŁE 10 maili dziennie
  if (mailbox.warmupStatus === 'inactive' || mailbox.warmupStatus === 'ready_to_warmup') {
    const NEW_MAILBOX_LIMIT = 10;
    return mailbox.currentDailySent < NEW_MAILBOX_LIMIT;
  }

  // PRZYPADEK 2 i 4: Gotowa skrzynka (nie w warmup) - użyj limitu ze skrzynki
  const canSend = mailbox.currentDailySent < mailbox.dailyEmailLimit;
  return canSend;
}

/**
 * Pobiera dostępne skrzynki do wysyłki kampanii (włącznie z warmup, ale z ograniczeniami)
 */
export async function getAvailableMailboxesForCampaign(salespersonId: number): Promise<any[]> {
  const mailboxes = await db.mailbox.findMany({
    where: {
      virtualSalespersonId: salespersonId,
      isActive: true
      // Usunięto wykluczenie skrzynek w warmup - teraz wszystkie skrzynki mogą wysyłać kampanie
    },
    orderBy: {
      priority: 'asc'
    }
  });

  // Sprawdź każdą skrzynkę osobno (async)
  const availableMailboxes = [];
  for (const mailbox of mailboxes) {
    const canSend = await canSendCampaignEmail(mailbox.id);
    if (canSend) {
      availableMailboxes.push(mailbox);
    }
  }
  
  return availableMailboxes;
}

/**
 * Pobiera skrzynki w warmup (do wysyłki warmup maili)
 */
export async function getWarmupMailboxes(salespersonId?: number): Promise<any[]> {
  const whereClause: any = {
    isActive: true,
    warmupStatus: 'warming'
  };

  if (salespersonId) {
    whereClause.virtualSalespersonId = salespersonId;
  }

  const mailboxes = await db.mailbox.findMany({
    where: whereClause,
    orderBy: {
      priority: 'asc'
    }
  });

  return mailboxes.filter(async (mailbox) => {
    return await canSendWarmupEmail(mailbox.id);
  });
}

/**
 * Aktualizuje licznik wysłanych maili dla mailbox
 */
export async function incrementMailboxCounter(mailboxId: number, count: number = 1): Promise<void> {
  await db.mailbox.update({
    where: { id: mailboxId },
    data: {
      currentDailySent: {
        increment: count
      },
      totalEmailsSent: {
        increment: count
      },
      lastUsedAt: new Date()
    }
  });
}

/**
 * Resetuje dzienne liczniki dla wszystkich mailbox (wywołuj o północy)
 */
export async function resetDailyMailboxCounters(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.mailbox.updateMany({
    where: {
      OR: [
        { lastResetDate: null },
        { lastResetDate: { lt: today } }
      ]
    },
    data: {
      currentDailySent: 0,
      warmupTodaySent: 0,
      lastResetDate: today
    }
  });

  // Reset warmup liczników
  await resetWarmupCounters();
  
  console.log(`[QUEUE] Reset liczników mailbox - ${new Date().toISOString()}`);
}

