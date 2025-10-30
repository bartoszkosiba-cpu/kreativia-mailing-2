/**
 * WARMUP CONFIGURATION - Harmonogram 30-dniowy
 * 
 * Stopniowe rozgrzewanie skrzynek mailowych
 */

export interface WarmupDayConfig {
  day: number;
  dailyLimit: number;        // Ile maili warmup dziennie
  campaignLimit: number;     // Ile maili z kampanii dziennie
  // UWAGA: Wszystkie maile warmup wysyłane są TYLKO między skrzynkami systemowymi (internal)
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
  { day: 1, dailyLimit: 15, campaignLimit: 5 },
  { day: 2, dailyLimit: 15, campaignLimit: 5 },
  
  // DNI 3-7: GRADUAL PHASE - STOPNIOWY WZROST
  { day: 3, dailyLimit: 20, campaignLimit: 10 },
  { day: 4, dailyLimit: 20, campaignLimit: 10 },
  { day: 5, dailyLimit: 20, campaignLimit: 10 },
  { day: 6, dailyLimit: 25, campaignLimit: 10 },
  { day: 7, dailyLimit: 25, campaignLimit: 10 },
  
  // DNI 8-14: BUILDING PHASE - KONTROLOWANY WZROST
  { day: 8, dailyLimit: 25, campaignLimit: 15 },
  { day: 9, dailyLimit: 25, campaignLimit: 15 },
  { day: 10, dailyLimit: 30, campaignLimit: 15 },
  { day: 11, dailyLimit: 30, campaignLimit: 15 },
  { day: 12, dailyLimit: 30, campaignLimit: 15 },
  { day: 13, dailyLimit: 35, campaignLimit: 15 },
  { day: 14, dailyLimit: 35, campaignLimit: 15 },
  
  // DNI 15-30: ACTIVE PHASE - STABILNE LIMITY
  { day: 15, dailyLimit: 30, campaignLimit: 20 },
  { day: 16, dailyLimit: 30, campaignLimit: 20 },
  { day: 17, dailyLimit: 30, campaignLimit: 20 },
  { day: 18, dailyLimit: 30, campaignLimit: 20 },
  { day: 19, dailyLimit: 30, campaignLimit: 20 },
  { day: 20, dailyLimit: 30, campaignLimit: 20 },
  { day: 21, dailyLimit: 30, campaignLimit: 20 },
  { day: 22, dailyLimit: 30, campaignLimit: 20 },
  { day: 23, dailyLimit: 30, campaignLimit: 20 },
  { day: 24, dailyLimit: 30, campaignLimit: 20 },
  { day: 25, dailyLimit: 30, campaignLimit: 20 },
  { day: 26, dailyLimit: 30, campaignLimit: 20 },
  { day: 27, dailyLimit: 30, campaignLimit: 20 },
  { day: 28, dailyLimit: 30, campaignLimit: 20 },
  { day: 29, dailyLimit: 30, campaignLimit: 20 },
  { day: 30, dailyLimit: 30, campaignLimit: 20 },
];

/**
 * Pobiera aktualny harmonogram (z bazy lub domyślny)
 */
export async function getWarmupSchedule(): Promise<WarmupDayConfig[]> {
  try {
    const { db } = await import('@/lib/db');
    const settings = await db.companySettings.findFirst();
    
    if (settings?.warmupSchedule) {
      try {
        const customSchedule = JSON.parse(settings.warmupSchedule) as WarmupDayConfig[];
        if (Array.isArray(customSchedule) && customSchedule.length === 30) {
          return customSchedule;
        }
      } catch (e) {
        // Jeśli parsing się nie powiedzie, użyj domyślnego
      }
    }
  } catch (error) {
    console.error('[WARMUP CONFIG] Błąd pobierania harmonogramu z bazy:', error);
  }
  
  return WARMUP_SCHEDULE;
}

/**
 * Pobiera konfigurację dla danego dnia warmup (async)
 */
export async function getWarmupConfig(day: number): Promise<WarmupDayConfig | null> {
  if (day < 1 || day > 30) {
    return null;
  }
  
  const schedule = await getWarmupSchedule();
  return schedule[day - 1] || null;
}

/**
 * Synchronous version - używa tylko domyślnego harmonogramu (dla backwards compatibility)
 * @deprecated Użyj getWarmupConfig() async
 */
export function getWarmupConfigSync(day: number): WarmupDayConfig | null {
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

