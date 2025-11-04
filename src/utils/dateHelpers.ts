/**
 * Helper functions for date formatting and display in Polish timezone
 * These functions should be used throughout the application for consistent date display
 */

import { formatPolishDateTime, formatPolishDate, formatPolishTime } from './polishTime';

/**
 * Formatuje datę i czas do wyświetlenia (dd.mm.yyyy HH:mm:ss)
 * Używa polskiego czasu
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  return formatPolishDateTime(date);
}

/**
 * Formatuje datę do wyświetlenia (dd.mm.yyyy)
 * Używa polskiego czasu
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  return formatPolishDate(date);
}

/**
 * Formatuje czas do wyświetlenia (HH:mm:ss)
 * Używa polskiego czasu
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  return formatPolishTime(date);
}

/**
 * Formatuje datę i czas do wyświetlenia z krótkim formatem (dd.mm.yyyy HH:mm)
 * Używa polskiego czasu
 */
export function formatDateTimeShort(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formatuje relatywny czas (np. "2 minuty temu", "wczoraj", "za 3 dni")
 * Używa polskiego czasu
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'przed chwilą';
  } else if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? 'minutę' : diffMin < 5 ? 'minuty' : 'minut'} temu`;
  } else if (diffHour < 24) {
    return `${diffHour} ${diffHour === 1 ? 'godzinę' : diffHour < 5 ? 'godziny' : 'godzin'} temu`;
  } else if (diffDay === 1) {
    return 'wczoraj';
  } else if (diffDay < 7) {
    return `${diffDay} ${diffDay === 1 ? 'dzień' : diffDay < 5 ? 'dni' : 'dni'} temu`;
  } else {
    return formatDate(d);
  }
}


