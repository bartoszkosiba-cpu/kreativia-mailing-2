/**
 * WARMUP SCHEDULER - Planowanie maili warmup
 * 
 * Odpowiedzialny za:
 * - Generowanie harmonogramu maili na cały dzień
 * - Losowe rozkładanie godzin wysyłki (06:00-22:00)
 * - Zapis do WarmupQueue z konkretnymi godzinami
 */

import { db } from '@/lib/db';
import { getWarmupConfig, WARMUP_TEMPLATES, TIMING_CONFIG } from './config';
import { addMinutes, addDays, setHours, setMinutes, format, startOfDay } from 'date-fns';

/**
 * Generuje losowe godziny wysyłki dla danej liczby maili
 * 
 * Zasady:
 * - Rozłożone między 06:00-22:00
 * - Losowe odstępy 10-30 minut
 * - Nie wysyłamy w nocy
 */
function generateRandomScheduleTimes(count: number, targetDate: Date): Date[] {
  const times: Date[] = [];
  
  // KROK 1: Normalizuj datę (midnight)
  const baseDate = startOfDay(targetDate);
  
  // KROK 2: Dodaj START_HOUR + random(0-30) minut
  const startMinutes = Math.floor(Math.random() * 30);
  let currentTime = setMinutes(
    setHours(baseDate, TIMING_CONFIG.START_HOUR),
    startMinutes
  );
  
  // KROK 3: Dodawaj maile z odstępami
  for (let i = 0; i < count; i++) {
    // Sprawdź limit godzinowy PRZED dodaniem
    if (currentTime.getHours() >= TIMING_CONFIG.END_HOUR) {
      console.warn(`[WARMUP SCHEDULER] ⚠️  Przekroczono END_HOUR po ${i} mailach`);
      break;
    }
    
    // Dodaj do listy
    times.push(new Date(currentTime));
    
    // Przygotuj następny czas (tylko jeśli nie jest ostatni)
    if (i < count - 1) {
      const delay = TIMING_CONFIG.MIN_DELAY_MINUTES + 
                    Math.random() * (TIMING_CONFIG.MAX_DELAY_MINUTES - TIMING_CONFIG.MIN_DELAY_MINUTES);
      currentTime = addMinutes(currentTime, delay);
    }
  }
  
  return times;
}

/**
 * Wybiera losowy szablon maila
 */
function getRandomTemplate() {
  const templates = WARMUP_TEMPLATES.internal;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generuje treść maila z szablonu
 */
function generateEmailContent(
  template: { subject: string; body: string },
  senderName: string
): { subject: string; body: string } {
  const date = format(new Date(), 'dd.MM.yyyy');
  
  return {
    subject: template.subject
      .replace('{{date}}', date)
      .replace('{{senderName}}', senderName),
    body: template.body
      .replace('{{date}}', date)
      .replace('{{senderName}}', senderName)
  };
}

/**
 * Planuje maile warmup dla jednej skrzynki na dany dzień
 */
export async function scheduleDailyEmailsForMailbox(
  mailboxId: number,
  targetDate: Date = new Date()
): Promise<number> {
  try {
    console.log(`[WARMUP SCHEDULER] 📅 Planowanie maili dla skrzynki ${mailboxId} na ${format(targetDate, 'yyyy-MM-dd')}`);
    
    // Pobierz dane skrzynki
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId },
      include: { virtualSalesperson: true }
    });
    
    if (!mailbox) {
      console.error(`[WARMUP SCHEDULER] ❌ Skrzynka ${mailboxId} nie istnieje`);
      return 0;
    }
    
    // Sprawdź status warmup
    if (mailbox.warmupStatus !== 'warming') {
      console.log(`[WARMUP SCHEDULER] ⏭️  Skrzynka ${mailbox.email} nie jest w warmup (status: ${mailbox.warmupStatus})`);
      return 0;
    }
    
    // Pobierz konfigurację dla aktualnego dnia warmup
    const config = await getWarmupConfig(mailbox.warmupDay);
    if (!config) {
      console.error(`[WARMUP SCHEDULER] ❌ Brak konfiguracji dla dnia ${mailbox.warmupDay}`);
      return 0;
    }
    
    console.log(`[WARMUP SCHEDULER]   → Dzień warmup: ${mailbox.warmupDay}`);
    console.log(`[WARMUP SCHEDULER]   → Limit dzienny: ${config.dailyLimit} maili warmup`);
    console.log(`[WARMUP SCHEDULER]   → Limit kampanii: ${config.campaignLimit} maili dziennie`);
    
    // Usuń stare zaplanowane maile na ten dzień (jeśli istnieją)
    const startOfDay = setHours(setMinutes(targetDate, 0), 0);
    const endOfDay = setHours(setMinutes(targetDate, 59), 23);
    
    await db.warmupQueue.deleteMany({
      where: {
        mailboxId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: 'pending'
      }
    });
    
    // Wygeneruj losowe godziny wysyłki
    const scheduledTimes = generateRandomScheduleTimes(config.dailyLimit, targetDate);
    
    if (scheduledTimes.length === 0) {
      console.error(`[WARMUP SCHEDULER] ❌ Nie udało się wygenerować godzin wysyłki`);
      return 0;
    }
    
    console.log(`[WARMUP SCHEDULER]   → Wygenerowano ${scheduledTimes.length} slotów czasowych`);
    console.log(`[WARMUP SCHEDULER]   → Pierwsze: ${format(scheduledTimes[0], 'HH:mm')}, Ostatnie: ${format(scheduledTimes[scheduledTimes.length - 1], 'HH:mm')}`);
    
    // USTALENIE: Warmup TYLKO między naszymi skrzynkami (internal)
    // Pobierz inne skrzynki (dla internal emails)
    const otherMailboxes = await db.mailbox.findMany({
      where: {
        id: { not: mailboxId },
        isActive: true
      },
      select: { email: true }
    });
    
    const internalEmails = otherMailboxes.map(m => m.email);
    
    // Sprawdź czy mamy inne skrzynki
    if (internalEmails.length === 0) {
      console.warn(`[WARMUP SCHEDULER] ⚠️  Brak innych skrzynek - pomijam warmup`);
      return 0;
    }
    
    console.log(`[WARMUP SCHEDULER]   → Internal: ${scheduledTimes.length} maili do ${internalEmails.length} skrzynek`);
    
    // Tworzenie wpisów w queue
    const queueItems: any[] = [];
    const senderName = mailbox.virtualSalesperson?.name || mailbox.email.split('@')[0];
    
    for (let i = 0; i < scheduledTimes.length; i++) {
      const scheduledAt = scheduledTimes[i];
      
      // Warmup TYLKO między naszymi skrzynkami (internal)
      const emailType = 'internal';
      
      // Wybierz losową skrzynkę (internal)
      const toEmail = internalEmails[Math.floor(Math.random() * internalEmails.length)];
      
      // Wygeneruj treść
      const template = getRandomTemplate();
      const { subject, body } = generateEmailContent(template, senderName);
      
      queueItems.push({
        mailboxId,
        scheduledAt,
        emailType,
        toEmail,
        subject,
        body,
        status: 'pending',
        warmupDay: mailbox.warmupDay,
        metadata: JSON.stringify({ senderName })
      });
    }
    
    // Zapisz wszystkie naraz (bulk insert)
    if (queueItems.length > 0) {
      await db.warmupQueue.createMany({
        data: queueItems
      });
      
      console.log(`[WARMUP SCHEDULER] ✅ Zaplanowano ${queueItems.length} maili dla ${mailbox.email}`);
      
      // Zaktualizuj nextWarmupEmailAt
      await db.mailbox.update({
        where: { id: mailboxId },
        data: { nextWarmupEmailAt: scheduledTimes[0] }
      });
    }
    
    return queueItems.length;
    
  } catch (error) {
    console.error(`[WARMUP SCHEDULER] ❌ Błąd planowania dla skrzynki ${mailboxId}:`, error);
    throw error;
  }
}

/**
 * Planuje maile dla wszystkich aktywnych skrzynek w warmup
 */
export async function scheduleDailyEmailsForAll(
  targetDate: Date = new Date()
): Promise<{ total: number; mailboxes: number }> {
  try {
    console.log(`[WARMUP SCHEDULER] 🚀 Planowanie maili na ${format(targetDate, 'yyyy-MM-dd')}`);
    
    // Pobierz wszystkie skrzynki w warmup
    const mailboxes = await db.mailbox.findMany({
      where: {
        warmupStatus: 'warming',
        isActive: true
      }
    });
    
    console.log(`[WARMUP SCHEDULER]   → Znaleziono ${mailboxes.length} skrzynek w warmup`);
    
    let totalScheduled = 0;
    
    for (const mailbox of mailboxes) {
      const count = await scheduleDailyEmailsForMailbox(mailbox.id, targetDate);
      totalScheduled += count;
    }
    
    console.log(`[WARMUP SCHEDULER] ✅ Zaplanowano łącznie ${totalScheduled} maili dla ${mailboxes.length} skrzynek`);
    
    return {
      total: totalScheduled,
      mailboxes: mailboxes.length
    };
    
  } catch (error) {
    console.error(`[WARMUP SCHEDULER] ❌ Błąd globalnego planowania:`, error);
    throw error;
  }
}

