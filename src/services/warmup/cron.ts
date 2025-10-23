/**
 * WARMUP CRON - Automatyzacja systemu warmup
 * 
 * Harmonogram zadań:
 * - 00:00 - Reset liczników (warmupTodaySent = 0)
 * - 00:30 - Planowanie maili na dzień
 * - 01:00 - Zwiększanie dni warmup
 * - Co 5 min - Wysyłanie zaplanowanych maili
 * - Co 6h - Sprawdzanie DNS
 */

import * as cron from 'node-cron';
import { resetDailyCounters, advanceWarmupDays, cleanupOldQueue } from './tracker';
import { scheduleDailyEmailsForAll } from './scheduler';
import { sendScheduledEmails } from './sender';
import { updateAllMailboxMetrics } from '../mailboxMetrics';

/**
 * Sprawdza DNS dla skrzynek
 */
async function checkDNSForMailboxes() {
  console.log(`[WARMUP CRON] 🔍 Sprawdzanie DNS...`);
  // TODO: Implementacja sprawdzania DNS (jeśli potrzebne)
  // Na razie pomijamy - DNS jest sprawdzany ręcznie
}

// ============================================================================
// GLOBALNY SINGLETON - zapobiega wielokrotnym instancjom crona
// ============================================================================
declare global {
  var warmupCronJobs: {
    reset: cron.ScheduledTask | null;
    schedule: cron.ScheduledTask | null;
    advance: cron.ScheduledTask | null;
    send: cron.ScheduledTask | null;
    dns: cron.ScheduledTask | null;
    cleanup: cron.ScheduledTask | null;
    metrics: cron.ScheduledTask | null;
  } | undefined;
}

if (!global.warmupCronJobs) {
  global.warmupCronJobs = {
    reset: null,
    schedule: null,
    advance: null,
    send: null,
    dns: null,
    cleanup: null,
    metrics: null
  };
}

/**
 * Uruchamia wszystkie cron jobs dla warmup
 */
export function startWarmupCron() {
  // Jeśli już uruchomione - pomiń
  if (global.warmupCronJobs!.reset !== null) {
    console.log(`[WARMUP CRON] ⏭️  Cron już uruchomiony - pomijam`);
    return;
  }
  
  console.log(`[WARMUP CRON] Inicjalizacja zadań warmup (NOWY SYSTEM)...`);
  
  // ============================================================================
  // 00:00 - RESET LICZNIKÓW
  // ============================================================================
  global.warmupCronJobs!.reset = cron.schedule('0 0 * * *', async () => {
    try {
      console.log(`[WARMUP CRON] 🕐 00:00 - Reset liczników dzienny`);
      await resetDailyCounters();
    } catch (error) {
      console.error(`[WARMUP CRON] ❌ Błąd resetu liczników:`, error);
    }
  });
  
  // ============================================================================
  // 00:30 - PLANOWANIE MAILI NA DZIEŃ
  // ============================================================================
  global.warmupCronJobs!.schedule = cron.schedule('30 0 * * *', async () => {
    try {
      console.log(`[WARMUP CRON] 🕐 00:30 - Planowanie maili na dzień`);
      const result = await scheduleDailyEmailsForAll();
      console.log(`[WARMUP CRON] ✅ Zaplanowano ${result.total} maili dla ${result.mailboxes} skrzynek`);
    } catch (error) {
      console.error(`[WARMUP CRON] ❌ Błąd planowania:`, error);
    }
  });
  
  // ============================================================================
  // 01:00 - ZWIĘKSZANIE DNI WARMUP
  // ============================================================================
  global.warmupCronJobs!.advance = cron.schedule('0 1 * * *', async () => {
    try {
      console.log(`[WARMUP CRON] 🕐 01:00 - Zwiększanie dni warmup`);
      const result = await advanceWarmupDays();
      console.log(`[WARMUP CRON] ✅ Zwiększono: ${result.advanced}, Zakończono: ${result.completed}`);
    } catch (error) {
      console.error(`[WARMUP CRON] ❌ Błąd zwiększania dni:`, error);
    }
  });
  
  // ============================================================================
  // CO 5 MINUT - WYSYŁANIE ZAPLANOWANYCH MAILI
  // ============================================================================
  global.warmupCronJobs!.send = cron.schedule('*/5 * * * *', async () => {
    try {
      // WAŻNE: Wysyłamy tylko 1 mail na wywołanie!
      // Dzięki temu maile są rozłożone w czasie (nie salwy)
      const result = await sendScheduledEmails();
      
      if (result.sent > 0) {
        console.log(`[WARMUP CRON] ✅ Wysłano: ${result.sent}, Pominięto: ${result.skipped}`);
      }
      
      if (result.failed > 0) {
        console.error(`[WARMUP CRON] ❌ Błędy: ${result.failed}`, result.errors);
      }
      
    } catch (error) {
      console.error(`[WARMUP CRON] ❌ Błąd wysyłania:`, error);
    }
  });
  
  // ============================================================================
  // CO 6 GODZIN - SPRAWDZANIE DNS
  // ============================================================================
  global.warmupCronJobs!.dns = cron.schedule('0 */6 * * *', async () => {
    try {
      console.log(`[WARMUP CRON] 🕐 Sprawdzanie DNS co 6h`);
      await checkDNSForMailboxes();
    } catch (error) {
      console.error(`[WARMUP CRON] ❌ Błąd sprawdzania DNS:`, error);
    }
  });
  
  // ============================================================================
  // CODZIENNIE O 02:00 - CLEANUP STARYCH WPISÓW
  // ============================================================================
  global.warmupCronJobs!.cleanup = cron.schedule('0 2 * * *', async () => {
    try {
      console.log(`[WARMUP CRON] 🕐 02:00 - Cleanup starych wpisów`);
      const deleted = await cleanupOldQueue();
      if (deleted > 0) {
        console.log(`[WARMUP CRON] 🗑️  Usunięto ${deleted} starych wpisów`);
      }
    } catch (error) {
      console.error(`[WARMUP CRON] ❌ Błąd cleanup:`, error);
    }
  });
  
  // ============================================================================
  // CO GODZINĘ - AKTUALIZACJA METRYK MAILBOXÓW
  // ============================================================================
  global.warmupCronJobs!.metrics = cron.schedule('0 * * * *', async () => {
    try {
      console.log(`[WARMUP CRON] 📊 Aktualizacja metryk mailboxów`);
      await updateAllMailboxMetrics();
    } catch (error) {
      console.error(`[WARMUP CRON] ❌ Błąd aktualizacji metryk:`, error);
    }
  });
  
  console.log(`[WARMUP CRON] ✅ Zadania warmup uruchomione (NOWY SYSTEM):`);
  console.log(`[WARMUP CRON]   - 00:00 - Reset liczników`);
  console.log(`[WARMUP CRON]   - 00:30 - Planowanie maili`);
  console.log(`[WARMUP CRON]   - 01:00 - Zwiększanie dni`);
  console.log(`[WARMUP CRON]   - */5 min - Wysyłanie maili (1 na raz!)`);
  console.log(`[WARMUP CRON]   - */6h - Sprawdzanie DNS`);
  console.log(`[WARMUP CRON]   - Co godzinę - Aktualizacja metryk`);
  console.log(`[WARMUP CRON]   - 02:00 - Cleanup`);
}

