// Inicjalizuje automatyczne pobieranie maili i warmup
// Ten plik jest importowany przy starcie aplikacji

import { startEmailCron } from './emailCron';
import { startWarmupCron } from './warmup/cron'; // NOWY SYSTEM

// Uruchom cron job tylko raz, przy pierwszym imporcie
if (typeof window === 'undefined') {
  // Tylko po stronie serwera (nie w przeglądarce)
  console.log('[INIT] Inicjalizacja cron jobs...');
  startEmailCron();
  startWarmupCron(); // NOWY SYSTEM WARMUP
}

export {};

