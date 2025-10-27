/**
 * Mailbox Manager - zarządza wieloma skrzynkami mailowymi dla wirtualnych handlowców
 * 
 * Funkcjonalności:
 * - Round-robin selection (rotacja skrzynek)
 * - Automatyczne resetowanie liczników dziennych
 * - Priorytetyzacja skrzynek
 * - Health checking
 */

import { db } from "@/lib/db";
import { Mailbox } from "@prisma/client";

interface PerformanceWeek {
  week: number;
  warmup: number;
  campaign: number;
}

/**
 * Pobiera tydzień na podstawie dnia warmup (1-35)
 * Tydzień 1 = dni 1-7
 * Tydzień 2 = dni 8-14
 * Tydzień 3 = dni 15-21
 * Tydzień 4 = dni 22-28
 * Tydzień 5 = dni 29-35
 */
function getWeekFromDay(day: number): number {
  if (day <= 0) return 1; // Dla skrzynek bez warmup użyj tygodnia 1
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

/**
 * Pobiera limity wydajności dla danego tygodnia
 */
async function getPerformanceLimits(week: number): Promise<{ warmup: number; campaign: number }> {
  try {
    const settings = await db.companySettings.findFirst();
    
    if (!settings || !settings.warmupPerformanceSettings) {
      // Domyślne wartości jeśli brak ustawień
      return { warmup: 15, campaign: 10 };
    }
    
    const weeks: PerformanceWeek[] = JSON.parse(settings.warmupPerformanceSettings);
    const weekData = weeks.find(w => w.week === week);
    
    if (!weekData) {
      // Fallback do tygodnia 1
      return weeks[0] || { warmup: 15, campaign: 10 };
    }
    
    return { warmup: weekData.warmup, campaign: weekData.campaign };
  } catch (error) {
    console.error('[MAILBOX] Błąd pobierania ustawień wydajności:', error);
    return { warmup: 15, campaign: 10 };
  }
}

export interface AvailableMailbox {
  id: number;
  email: string;
  displayName: string | null;
  dailyEmailLimit: number;
  currentDailySent: number;
  remainingToday: number;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
}

/**
 * Pobiera następną dostępną skrzynkę dla wirtualnego handlowca (round-robin)
 */
export async function getNextAvailableMailbox(
  virtualSalespersonId: number
): Promise<AvailableMailbox | null> {
  console.log(`[MAILBOX] Szukam dostępnej skrzynki dla handlowca ID: ${virtualSalespersonId}`);

  // Pobierz handlowca z główną skrzynką
  const salesperson = await db.virtualSalesperson.findUnique({
    where: { id: virtualSalespersonId },
    select: { mainMailboxId: true }
  });

  if (!salesperson) {
    console.log(`[MAILBOX] ❌ Handlowiec ID: ${virtualSalespersonId} nie istnieje`);
    return null;
  }

  // Pobierz wszystkie aktywne skrzynki dla tego handlowca
  const mailboxes = await db.mailbox.findMany({
    where: {
      virtualSalespersonId,
      isActive: true
    },
    orderBy: [
      { priority: "asc" },      // Najpierw po priorytecie
      { lastUsedAt: "asc" }     // Potem po dacie ostatniego użycia (najdawniej użyta = pierwsza)
    ]
  });

  // Jeśli jest główna skrzynka, ustaw ją jako pierwszą
  if (salesperson.mainMailboxId && mailboxes.length > 0) {
    const mainMailboxIndex = mailboxes.findIndex(mb => mb.id === salesperson.mainMailboxId);
    if (mainMailboxIndex > 0) {
      // Przenieś główną skrzynkę na początek
      const mainMailbox = mailboxes.splice(mainMailboxIndex, 1)[0];
      mailboxes.unshift(mainMailbox);
      console.log(`[MAILBOX] 🎯 Ustawiono główną skrzynkę: ${mainMailbox.email} (ID: ${mainMailbox.id})`);
    }
  }

  if (mailboxes.length === 0) {
    console.log(`[MAILBOX] ❌ Brak aktywnych skrzynek dla handlowca ID: ${virtualSalespersonId}`);
    return null;
  }

  console.log(`[MAILBOX] Znaleziono ${mailboxes.length} aktywnych skrzynek`);

  const today = new Date().toDateString();

  // Resetuj liczniki dla skrzynek jeśli nowy dzień
  for (const mailbox of mailboxes) {
    if (!mailbox.lastResetDate || mailbox.lastResetDate.toDateString() !== today) {
      await resetMailboxCounter(mailbox.id, mailbox.warmupStatus);
      console.log(`[MAILBOX] ✓ Zresetowano licznik dla ${mailbox.email}`);
    }
  }

  // Znajdź pierwszą skrzynkę która ma wolne miejsce
  for (const mailbox of mailboxes) {
    // Ustaw właściwy limit w zależności od statusu warmup
    let effectiveLimit: number;
    let currentSent: number;
    
    if (mailbox.warmupStatus === 'warming' || mailbox.warmupStatus === 'ready_to_warmup') {
      // W trybie warmup - użyj Math.min(3 limity)
      const week = getWeekFromDay(mailbox.warmupDay || 0);
      const performanceLimits = await getPerformanceLimits(week);
      
      // Math.min(3 limity): dailyEmailLimit, warmupDailyLimit, campaign z ustawień
      effectiveLimit = Math.min(
        mailbox.dailyEmailLimit,
        mailbox.warmupDailyLimit,
        performanceLimits.campaign
      );
      
      currentSent = mailbox.warmupTodaySent;
    } else {
      // W normalnym trybie (bez warmup) - użyj Math.min(2 limity)
      const week = getWeekFromDay(0); // Tydzień 1 dla skrzynek bez warmup
      const performanceLimits = await getPerformanceLimits(week);
      
      effectiveLimit = Math.min(
        mailbox.dailyEmailLimit,
        performanceLimits.campaign
      );
      
      currentSent = mailbox.currentDailySent;
    }
    
    const remaining = effectiveLimit - currentSent;
    
    if (remaining > 0) {
      const statusInfo = mailbox.warmupStatus === 'warming' || mailbox.warmupStatus === 'ready_to_warmup' 
        ? `(warmup: pozostało: ${remaining}/${effectiveLimit})`
        : `(pozostało: ${remaining}/${effectiveLimit})`;
      
      console.log(`[MAILBOX] ✅ Wybrano skrzynkę: ${mailbox.email} ${statusInfo}`);
      
      return {
        id: mailbox.id,
        email: mailbox.email,
        displayName: mailbox.displayName,
        dailyEmailLimit: effectiveLimit,
        currentDailySent: currentSent,
        remainingToday: remaining,
        smtpHost: mailbox.smtpHost,
        smtpPort: mailbox.smtpPort,
        smtpUser: mailbox.smtpUser,
        smtpPass: mailbox.smtpPass,
        smtpSecure: mailbox.smtpSecure
      };
    } else {
      console.log(`[MAILBOX] ⏭️  Skrzynka ${mailbox.email} wyczerpana (${currentSent}/${effectiveLimit})`);
    }
  }

  console.log(`[MAILBOX] ❌ Wszystkie skrzynki wyczerpane na dzisiaj`);
  return null;
}

/**
 * Resetuje licznik dziennych wysyłek dla skrzynki
 */
export async function resetMailboxCounter(mailboxId: number, warmupStatus?: string): Promise<void> {
  const updateData: any = {
    lastResetDate: new Date()
  };
  
  // Zresetuj odpowiedni licznik w zależności od statusu warmup
  if (warmupStatus === 'warming' || warmupStatus === 'ready_to_warmup') {
    updateData.warmupTodaySent = 0;
  } else {
    updateData.currentDailySent = 0;
  }
  
  await db.mailbox.update({
    where: { id: mailboxId },
    data: updateData
  });
}

/**
 * Zwiększa licznik wysłanych maili dla skrzynki
 */
export async function incrementMailboxCounter(mailboxId: number): Promise<void> {
  // Pobierz skrzynkę aby sprawdzić status warmup
  const mailbox = await db.mailbox.findUnique({
    where: { id: mailboxId },
    select: { warmupStatus: true }
  });
  
  if (!mailbox) {
    console.log(`[MAILBOX] ❌ Nie znaleziono skrzynki ID: ${mailboxId}`);
    return;
  }
  
  // Przygotuj dane do aktualizacji
  const updateData: any = {
    totalEmailsSent: { increment: 1 },
    lastUsedAt: new Date()
  };
  
  // Zwiększ odpowiedni licznik w zależności od statusu warmup
  if (mailbox.warmupStatus === 'warming' || mailbox.warmupStatus === 'ready_to_warmup') {
    updateData.warmupTodaySent = { increment: 1 };
    console.log(`[MAILBOX] ✓ Zwiększono licznik warmup dla skrzynki ID: ${mailboxId}`);
  } else {
    updateData.currentDailySent = { increment: 1 };
    console.log(`[MAILBOX] ✓ Zwiększono licznik dla skrzynki ID: ${mailboxId}`);
  }
  
  await db.mailbox.update({
    where: { id: mailboxId },
    data: updateData
  });
}

/**
 * Pobiera statystyki wszystkich skrzynek dla handlowca
 */
export async function getMailboxStats(virtualSalespersonId: number) {
  const mailboxes = await db.mailbox.findMany({
    where: { virtualSalespersonId },
    orderBy: { priority: "asc" }
  });

  const stats = {
    totalMailboxes: mailboxes.length,
    activeMailboxes: mailboxes.filter(m => m.isActive).length,
    totalDailyLimit: mailboxes.reduce((sum, m) => sum + m.dailyEmailLimit, 0),
    totalSentToday: mailboxes.reduce((sum, m) => sum + m.currentDailySent, 0),
    totalSentAll: mailboxes.reduce((sum, m) => sum + m.totalEmailsSent, 0),
    remainingToday: mailboxes.reduce((sum, m) => {
      const remaining = m.dailyEmailLimit - m.currentDailySent;
      return sum + (remaining > 0 ? remaining : 0);
    }, 0)
  };

  return { ...stats, mailboxes };
}

/**
 * Pobiera skrzynkę dla odbioru maili IMAP (używa pierwszej aktywnej)
 */
export async function getImapMailbox(virtualSalespersonId: number): Promise<AvailableMailbox | null> {
  const mailbox = await db.mailbox.findFirst({
    where: {
      virtualSalespersonId,
      isActive: true
    },
    orderBy: { priority: "asc" }
  });

  if (!mailbox) {
    console.log(`[MAILBOX] ❌ Brak aktywnej skrzynki IMAP dla handlowca ID: ${virtualSalespersonId}`);
    return null;
  }

  return {
    id: mailbox.id,
    email: mailbox.email,
    displayName: mailbox.displayName,
    dailyEmailLimit: mailbox.dailyEmailLimit,
    currentDailySent: mailbox.currentDailySent,
    remainingToday: mailbox.dailyEmailLimit - mailbox.currentDailySent,
    smtpHost: mailbox.smtpHost,
    smtpPort: mailbox.smtpPort,
    smtpUser: mailbox.smtpUser,
    smtpPass: mailbox.smtpPass,
    smtpSecure: mailbox.smtpSecure
  };
}

