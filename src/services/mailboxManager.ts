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
      await resetMailboxCounter(mailbox.id);
      console.log(`[MAILBOX] ✓ Zresetowano licznik dla ${mailbox.email}`);
    }
  }

  // Znajdź pierwszą skrzynkę która ma wolne miejsce
  for (const mailbox of mailboxes) {
    const remaining = mailbox.dailyEmailLimit - mailbox.currentDailySent;
    
    if (remaining > 0) {
      console.log(`[MAILBOX] ✅ Wybrano skrzynkę: ${mailbox.email} (pozostało: ${remaining}/${mailbox.dailyEmailLimit})`);
      
      return {
        id: mailbox.id,
        email: mailbox.email,
        displayName: mailbox.displayName,
        dailyEmailLimit: mailbox.dailyEmailLimit,
        currentDailySent: mailbox.currentDailySent,
        remainingToday: remaining,
        smtpHost: mailbox.smtpHost,
        smtpPort: mailbox.smtpPort,
        smtpUser: mailbox.smtpUser,
        smtpPass: mailbox.smtpPass,
        smtpSecure: mailbox.smtpSecure
      };
    } else {
      console.log(`[MAILBOX] ⏭️  Skrzynka ${mailbox.email} wyczerpana (${mailbox.currentDailySent}/${mailbox.dailyEmailLimit})`);
    }
  }

  console.log(`[MAILBOX] ❌ Wszystkie skrzynki wyczerpane na dzisiaj`);
  return null;
}

/**
 * Resetuje licznik dziennych wysyłek dla skrzynki
 */
export async function resetMailboxCounter(mailboxId: number): Promise<void> {
  await db.mailbox.update({
    where: { id: mailboxId },
    data: {
      currentDailySent: 0,
      lastResetDate: new Date()
    }
  });
}

/**
 * Zwiększa licznik wysłanych maili dla skrzynki
 */
export async function incrementMailboxCounter(mailboxId: number): Promise<void> {
  await db.mailbox.update({
    where: { id: mailboxId },
    data: {
      currentDailySent: { increment: 1 },
      totalEmailsSent: { increment: 1 },
      lastUsedAt: new Date()
    }
  });
  
  console.log(`[MAILBOX] ✓ Zwiększono licznik dla skrzynki ID: ${mailboxId}`);
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

