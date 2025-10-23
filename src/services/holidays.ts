// Serwis do zarządzania świętami dla różnych krajów
import { db } from "@/lib/db";

/**
 * Pobiera święta z darmowego API dla danego kraju i roku
 * API: https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}
 */
export async function fetchHolidaysForCountry(
  countryCode: string,
  year: number
): Promise<{ date: Date; name: string }[]> {
  try {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
    console.log(`[HOLIDAYS] Pobieranie świąt dla ${countryCode}/${year}...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[HOLIDAYS] Błąd API: ${response.status}`);
      return [];
    }
    
    const holidays = await response.json();
    
    return holidays.map((h: any) => ({
      date: new Date(h.date),
      name: h.name || h.localName
    }));
  } catch (error) {
    console.error(`[HOLIDAYS] Błąd pobierania świąt dla ${countryCode}:`, error);
    return [];
  }
}

/**
 * Pobiera i cache'uje święta dla danego kraju i roku
 */
export async function cacheHolidaysForCountry(
  countryCode: string,
  year: number
): Promise<void> {
  console.log(`[HOLIDAYS] Cache'owanie świąt: ${countryCode}/${year}`);
  
  // Sprawdź czy już mamy w cache
  const existing = await db.holiday.count({
    where: {
      countryCode,
      year
    }
  });
  
  if (existing > 0) {
    console.log(`[HOLIDAYS] Święta ${countryCode}/${year} już w cache (${existing} dni)`);
    return;
  }
  
  // Pobierz z API
  const holidays = await fetchHolidaysForCountry(countryCode, year);
  
  if (holidays.length === 0) {
    console.log(`[HOLIDAYS] Brak świąt dla ${countryCode}/${year}`);
    return;
  }
  
  // Zapisz do bazy (po jednym, bo SQLite nie wspiera skipDuplicates)
  for (const holiday of holidays) {
    try {
      await db.holiday.create({
        data: {
          date: holiday.date,
          name: holiday.name,
          countryCode,
          year
        }
      });
    } catch (error) {
      // Ignoruj duplikaty
    }
  }
  
  console.log(`[HOLIDAYS] ✓ Zapisano ${holidays.length} świąt dla ${countryCode}/${year}`);
}

/**
 * Sprawdza czy dana data jest świętem w określonych krajach
 */
export async function isHoliday(
  date: Date,
  countryCodes: string[]
): Promise<boolean> {
  if (countryCodes.length === 0) {
    return false;
  }
  
  // Normalizuj datę do początku dnia (bez godzin)
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  const count = await db.holiday.count({
    where: {
      date: dateOnly,
      countryCode: {
        in: countryCodes
      }
    }
  });
  
  return count > 0;
}

/**
 * Pobiera listę świąt dla krajów w danym okresie
 */
export async function getHolidays(
  startDate: Date,
  endDate: Date,
  countryCodes: string[]
): Promise<Array<{ date: Date; name: string; countryCode: string }>> {
  return await db.holiday.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      },
      countryCode: {
        in: countryCodes
      }
    },
    orderBy: {
      date: 'asc'
    }
  });
}

/**
 * Prefetch świąt dla najczęściej używanych krajów
 */
export async function prefetchHolidays(): Promise<void> {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const countries = ['PL', 'DE', 'FR', 'GB', 'US', 'IT', 'ES', 'NL', 'BE', 'AT'];
  
  console.log('[HOLIDAYS] Prefetch świąt...');
  
  for (const country of countries) {
    await cacheHolidaysForCountry(country, currentYear);
    await cacheHolidaysForCountry(country, nextYear);
  }
  
  console.log('[HOLIDAYS] ✓ Prefetch zakończony');
}

/**
 * Sprawdza czy potrzebny jest prefetch świąt i wykonuje go tylko w razie potrzeby
 */
export async function checkAndPrefetchHolidays(): Promise<void> {
  const currentYear = new Date().getFullYear();
  const countries = ['PL', 'DE', 'FR', 'GB', 'US'];
  
  // Sprawdź czy mamy dane dla bieżącego roku dla głównych krajów
  const existingCount = await db.holiday.count({
    where: {
      year: currentYear,
      countryCode: { in: countries }
    }
  });
  
  // Jeśli mamy mniej niż 50 świąt, wykonaj prefetch
  if (existingCount < 50) {
    console.log(`[HOLIDAYS] Brak danych w cache (${existingCount} świąt), wykonuję prefetch...`);
    await prefetchHolidays();
  } else {
    console.log(`[HOLIDAYS] ✓ Dane w cache (${existingCount} świąt), pomijam prefetch`);
  }
}

