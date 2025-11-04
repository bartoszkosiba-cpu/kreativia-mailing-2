/**
 * Utility functions for working with Polish time (Europe/Warsaw timezone)
 */

/**
 * Pobiera aktualny czas w polskiej strefie czasowej
 * Zwraca Date object który reprezentuje aktualny czas w PL
 */
export function getPolishTime(): Date {
  const now = new Date();
  // Konwertuj UTC na polski czas
  const polishTimeStr = now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' });
  return new Date(polishTimeStr);
}

/**
 * Tworzy Date object dla określonej daty i godziny w polskiej strefie czasowej
 * @param year Rok
 * @param month Miesiąc (1-12)
 * @param day Dzień
 * @param hour Godzina (0-23)
 * @param minute Minuta (0-59)
 * @param second Sekunda (0-59)
 */
export function createPolishDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date {
  // Utwórz string w formacie ISO dla polskiego czasu
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  
  // Utwórz Date object - JavaScript interpretuje to jako lokalny czas
  // Musimy przekonwertować na UTC z uwzględnieniem polskiego czasu
  const tempDate = new Date(dateStr);
  
  // Pobierz offset dla polskiego czasu (Europe/Warsaw) dla tej daty
  const polandOffset = getTimezoneOffset('Europe/Warsaw', tempDate);
  const localOffset = tempDate.getTimezoneOffset();
  
  // Oblicz różnicę offsetów i dostosuj datę
  const offsetDiff = (polandOffset - localOffset) * 60 * 1000;
  
  return new Date(tempDate.getTime() - offsetDiff);
}

/**
 * Pobiera offset timezone w minutach dla danej strefy czasowej
 */
function getTimezoneOffset(timeZone: string, date: Date): number {
  // Utwórz formatter dla UTC i dla danej strefy czasowej
  const utcFormatter = new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    hour: '2-digit',
    hour12: false
  });
  
  const tzFormatter = new Intl.DateTimeFormat('en', {
    timeZone: timeZone,
    hour: '2-digit',
    hour12: false
  });
  
  // Pobierz godzinę w UTC i w danej strefie czasowej
  const utcHour = parseInt(utcFormatter.format(date).split(',')[0] || '0');
  const tzHour = parseInt(tzFormatter.format(date).split(',')[0] || '0');
  
  // Oblicz różnicę w godzinach, następnie konwertuj na minuty
  // Uwzględnij również dzień (może być różnica dni przy przejściu daty)
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
}

/**
 * Pobiera początek dzisiejszego dnia w polskiej strefie czasowej (00:00:00)
 */
export function getStartOfTodayPL(): Date {
  const now = new Date();
  const nowPL = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  
  // Utwórz datę dla 00:00:00 w PL
  const year = nowPL.getFullYear();
  const month = nowPL.getMonth() + 1;
  const day = nowPL.getDate();
  
  return createPolishDate(year, month, day, 0, 0, 0);
}

/**
 * Pobiera koniec dzisiejszego dnia w polskiej strefie czasowej (23:59:59.999)
 */
export function getEndOfTodayPL(): Date {
  const now = new Date();
  const nowPL = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  
  const year = nowPL.getFullYear();
  const month = nowPL.getMonth() + 1;
  const day = nowPL.getDate();
  
  return createPolishDate(year, month, day, 23, 59, 59);
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

/**
 * Konwertuje Date z UTC na polski czas i zwraca Date object
 * Używa się do konwersji dat z bazy (UTC) na polski czas
 */
export function toPolishTime(utcDate: Date): Date {
  const polishTimeStr = utcDate.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' });
  return new Date(polishTimeStr);
}

/**
 * Formatuje datę do wyświetlenia w polskim formacie (dd.mm.yyyy HH:mm:ss)
 */
export function formatPolishDateTime(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Formatuje datę do wyświetlenia w polskim formacie (dd.mm.yyyy)
 */
export function formatPolishDate(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formatuje czas do wyświetlenia w polskim formacie (HH:mm:ss)
 */
export function formatPolishTime(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Ustawia godzinę dla daty w polskiej strefie czasowej
 * @param date Data bazowa
 * @param hour Godzina (0-23)
 * @param minute Minuta (0-59)
 * @param second Sekunda (0-59)
 */
export function setPolishTime(date: Date, hour: number, minute: number = 0, second: number = 0): Date {
  // Konwertuj datę na polski czas
  const polishDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  polishDate.setHours(hour, minute, second, 0);
  
  // Konwertuj z powrotem na UTC
  const year = polishDate.getFullYear();
  const month = polishDate.getMonth() + 1;
  const day = polishDate.getDate();
  
  return createPolishDate(year, month, day, hour, minute, second);
}

