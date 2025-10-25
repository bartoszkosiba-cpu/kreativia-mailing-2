// Inicjalizuje automatyczne pobieranie maili i warmup
// Ten plik jest importowany przy starcie aplikacji

import { startEmailCron } from './emailCron';
import { startWarmupCron } from './warmup/cron'; // NOWY SYSTEM

// Globalna flaga zapobiegająca wielokrotnej inicjalizacji
let cronInitialized = false;

// Uruchom cron job tylko raz, przy pierwszym imporcie
if (typeof window === 'undefined' && !cronInitialized) {
  // Tylko po stronie serwera (nie w przeglądarce) i tylko raz
  cronInitialized = true;
  console.log('[INIT] Inicjalizacja cron jobs...');
  startEmailCron();
  startWarmupCron(); // NOWY SYSTEM WARMUP
}

export {};

