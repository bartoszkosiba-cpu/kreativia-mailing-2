/**
 * Utility functions for working with Polish time (Europe/Warsaw timezone)
 */

/**
 * Pobiera aktualny czas w polskiej strefie czasowej
 */
export function getPolishTime(): Date {
  const now = new Date();
  const polishTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  return polishTime;
}

/**
 * Pobiera początek dzisiejszego dnia w polskiej strefie czasowej (00:00:00)
 */
export function getStartOfTodayPL(): Date {
  const nowPL = getPolishTime();
  const startOfDay = new Date(nowPL);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
}

/**
 * Pobiera koniec dzisiejszego dnia w polskiej strefie czasowej (23:59:59.999)
 */
export function getEndOfTodayPL(): Date {
  const nowPL = getPolishTime();
  const endOfDay = new Date(nowPL);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

/**
 * Sprawdza czy data jest dzisiaj w polskiej strefie czasowej
 */
export function isTodayPL(date: Date | null): boolean {
  if (!date) return false;
  const todayPL = getStartOfTodayPL();
  
  // Konwertuj datę na polski czas i sprawdź czy to ten sam dzień
  const dateStrPL = new Date(date).toLocaleString('en-US', { 
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStrPL = todayPL.toLocaleString('en-US', { 
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  return dateStrPL === todayStrPL;
}

/**
 * Pobiera datę jako string w polskiej strefie czasowej (do porównań)
 */
export function getTodayPLString(): string {
  return getStartOfTodayPL().toDateString();
}

