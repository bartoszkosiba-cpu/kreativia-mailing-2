// Inicjalizuje automatyczne pobieranie maili i warmup
// Ten plik jest importowany przy starcie aplikacji

import { startEmailCron } from './emailCron';
import { startWarmupCron } from './warmup/cron'; // NOWY SYSTEM
import { startReminderCron } from './notificationReminderCron';

// Globalna flaga zapobiegająca wielokrotnej inicjalizacji
let cronInitialized = false;

// Globalny kill-switch dla wszystkich cronów (tymczasowe wyłączenie automatycznej wysyłki)
const CRON_DISABLED = process.env.CRON_DISABLED === '1' || process.env.CRON_DISABLED === 'true';

// Uruchom cron job tylko raz, przy pierwszym imporcie (o ile nie wyłączono)
if (typeof window === 'undefined' && !cronInitialized) {
  // Tylko po stronie serwera (nie w przeglądarce) i tylko raz
  cronInitialized = true;
  if (CRON_DISABLED) {
    console.warn('[INIT] CRON_DISABLED aktywny – automatyczne zadania (kampanie, warmup, follow-upy, materiały) są WYŁĄCZONE');
  } else {
    console.log('[INIT] Inicjalizacja cron jobs...');
    startEmailCron();
    startWarmupCron(); // NOWY SYSTEM WARMUP
    // startReminderCron(); // ❌ WYŁĄCZONE - System przypomnień o zainteresowanych
  }
}

export {};

