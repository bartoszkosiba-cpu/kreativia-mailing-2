/**
 * WARMUP CONFIGURATION - Harmonogram 30-dniowy
 * 
 * Stopniowe rozgrzewanie skrzynek mailowych
 */

export interface WarmupDayConfig {
  day: number;
  dailyLimit: number;        // Ile maili warmup dziennie
  campaignLimit: number;     // Ile maili z kampanii dziennie
  internalPercent: number;   // % maili między skrzynkami (80 = 80%)
  seedPercent: number;       // % maili do seed addresses (20 = 20%)
}

/**
 * HARMONOGRAM 30-DNIOWY
 * 
 * Zasady:
 * - Dni 1-2: Start (15 maili, 0 kampanii)
 * - Dni 3-7: Gradual (20-30 maili, 10 kampanii)
 * - Dni 8-14: Building (35-50 maili, 20 kampanii)
 * - Dni 15-30: Active (60-100 maili, 40 kampanii)
 */
export const WARMUP_SCHEDULE: WarmupDayConfig[] = [
  // DNI 1-2: SILENT PHASE - BEZPIECZNE ROZPOCZĘCIE
  { day: 1, dailyLimit: 15, campaignLimit: 5, internalPercent: 80, seedPercent: 20 },
  { day: 2, dailyLimit: 15, campaignLimit: 5, internalPercent: 80, seedPercent: 20 },
  
  // DNI 3-7: GRADUAL PHASE - STOPNIOWY WZROST
  { day: 3, dailyLimit: 20, campaignLimit: 10, internalPercent: 75, seedPercent: 25 },
  { day: 4, dailyLimit: 20, campaignLimit: 10, internalPercent: 75, seedPercent: 25 },
  { day: 5, dailyLimit: 20, campaignLimit: 10, internalPercent: 70, seedPercent: 30 },
  { day: 6, dailyLimit: 25, campaignLimit: 10, internalPercent: 70, seedPercent: 30 },
  { day: 7, dailyLimit: 25, campaignLimit: 10, internalPercent: 70, seedPercent: 30 },
  
  // DNI 8-14: BUILDING PHASE - KONTROLOWANY WZROST
  { day: 8, dailyLimit: 25, campaignLimit: 15, internalPercent: 65, seedPercent: 35 },
  { day: 9, dailyLimit: 25, campaignLimit: 15, internalPercent: 65, seedPercent: 35 },
  { day: 10, dailyLimit: 30, campaignLimit: 15, internalPercent: 60, seedPercent: 40 },
  { day: 11, dailyLimit: 30, campaignLimit: 15, internalPercent: 60, seedPercent: 40 },
  { day: 12, dailyLimit: 30, campaignLimit: 15, internalPercent: 60, seedPercent: 40 },
  { day: 13, dailyLimit: 35, campaignLimit: 15, internalPercent: 60, seedPercent: 40 },
  { day: 14, dailyLimit: 35, campaignLimit: 15, internalPercent: 60, seedPercent: 40 },
  
  // DNI 15-30: ACTIVE PHASE - STABILNE LIMITY
  { day: 15, dailyLimit: 30, campaignLimit: 20, internalPercent: 55, seedPercent: 45 },
  { day: 16, dailyLimit: 30, campaignLimit: 20, internalPercent: 55, seedPercent: 45 },
  { day: 17, dailyLimit: 30, campaignLimit: 20, internalPercent: 55, seedPercent: 45 },
  { day: 18, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 19, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 20, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 21, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 22, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 23, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 24, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 25, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 26, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 27, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 28, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 29, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
  { day: 30, dailyLimit: 30, campaignLimit: 20, internalPercent: 50, seedPercent: 50 },
];

/**
 * Pobiera konfigurację dla danego dnia warmup
 */
export function getWarmupConfig(day: number): WarmupDayConfig | null {
  if (day < 1 || day > 30) {
    return null;
  }
  
  return WARMUP_SCHEDULE[day - 1] || null;
}

/**
 * SZABLONY MAILI WARMUP
 */
export const WARMUP_TEMPLATES = {
  internal: [
    {
      subject: 'Sprawdzenie poczty - {{date}}',
      body: 'Dzień dobry,\n\nTo automatyczna wiadomość testowa sprawdzająca działanie skrzynki mailowej.\n\nPozdrawiam,\n{{senderName}}'
    },
    {
      subject: 'Aktualizacja systemu - {{date}}',
      body: 'Cześć,\n\nInformuję o pomyślnej aktualizacji systemu mailowego.\n\nPozdrawiam,\n{{senderName}}'
    },
    {
      subject: 'Test dostarczenia - {{date}}',
      body: 'Witam,\n\nTest dostarczalności wiadomości email.\n\nPozdrawiam,\n{{senderName}}'
    },
    {
      subject: 'Weryfikacja połączenia - {{date}}',
      body: 'Dzień dobry,\n\nWeryfikacja połączenia mailowego.\n\nPozdrawiam,\n{{senderName}}'
    },
    {
      subject: 'Powiadomienie systemowe - {{date}}',
      body: 'Witam,\n\nPowiadomienie o statusie systemu mailowego.\n\nPozdrawiam,\n{{senderName}}'
    },
    {
      subject: 'Sprawdzenie połączenia SMTP - {{date}}',
      body: 'Cześć,\n\nSprawdzenie działania połączenia SMTP.\n\nPozdrawiam,\n{{senderName}}'
    },
    {
      subject: 'Codzienne sprawdzenie systemu - {{date}}',
      body: 'Dzień dobry,\n\nCodzienne sprawdzenie działania systemu.\n\nPozdrawiam,\n{{senderName}}'
    },
  ],
  
  seed: [
    {
      subject: 'Test dostarczenia - {{date}}',
      body: 'Hello,\n\nThis is a test message.\n\nBest regards,\n{{senderName}}'
    },
    {
      subject: 'System check - {{date}}',
      body: 'Hi,\n\nSystem check email.\n\nBest,\n{{senderName}}'
    },
  ]
};

// USTALENIE: Warmup TYLKO między naszymi skrzynkami (internal)
// Nie wysyłamy warmup do zewnętrznych skrzynek

/**
 * TIMING CONFIG - Konfiguracja timing
 */
export const TIMING_CONFIG = {
  // Godziny wysyłania (06:00-22:00)
  START_HOUR: 6,
  END_HOUR: 22,
  
  // Odstępy między mailami (w minutach)
  MIN_DELAY_MINUTES: 10,
  MAX_DELAY_MINUTES: 30,
  
  // Jak często sprawdzać queue (w minutach)
  CRON_CHECK_INTERVAL: 5,
  
  // Tolerancja opóźnienia (w minutach)
  // Jeśli mail miał być wysłany o 7:23, ale cron uruchomił się o 7:28,
  // to nadal wyślij jeśli różnica < TOLERANCE_MINUTES
  TOLERANCE_MINUTES: 10,
};

