// Serwis do planowania i walidacji harmonogramu kampanii
import { db } from "@/lib/db";
import { isHoliday } from "./holidays";

export interface ScheduleValidation {
  isValid: boolean;
  reason?: string;
  suggestedDate?: Date;
}

/**
 * Sprawdza czy data jest w dozwolonym oknie czasowym
 */
export async function isValidSendTime(
  date: Date,
  allowedDays: string[], // ["MON", "TUE", "WED", "THU", "FRI"]
  startHour: number,      // 9
  endHour: number,        // 15
  respectHolidays: boolean,
  targetCountries: string[]
): Promise<ScheduleValidation> {
  // 1. Sprawdź dzień tygodnia
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const dayName = dayNames[date.getDay()];
  
  if (!allowedDays.includes(dayName)) {
    return {
      isValid: false,
      reason: `Wysyłka niedozwolona w ${dayName}. Dozwolone dni: ${allowedDays.join(", ")}`
    };
  }
  
  // 2. Sprawdź godziny
  const hour = date.getHours();
  if (hour < startHour || hour >= endHour) {
    return {
      isValid: false,
      reason: `Wysyłka poza dozwolonymi godzinami. Dozwolone: ${startHour}:00-${endHour}:00`
    };
  }
  
  // 3. Sprawdź święta
  if (respectHolidays && targetCountries.length > 0) {
    const isHol = await isHoliday(date, targetCountries);
    if (isHol) {
      return {
        isValid: false,
        reason: `Ta data jest świętem w jednym z krajów docelowych`
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Znajduje najbliższy dostępny slot czasowy
 */
export async function findNextAvailableSlot(
  startDate: Date,
  allowedDays: string[],
  startHour: number,
  endHour: number,
  respectHolidays: boolean,
  targetCountries: string[]
): Promise<Date> {
  let testDate = new Date(startDate);
  const maxDays = 30; // Nie szukaj dalej niż 30 dni
  
  for (let i = 0; i < maxDays; i++) {
    // Ustaw na początek okna czasowego
    testDate.setHours(startHour, 0, 0, 0);
    
    const validation = await isValidSendTime(
      testDate,
      allowedDays,
      startHour,
      endHour,
      respectHolidays,
      targetCountries
    );
    
    if (validation.isValid) {
      return testDate;
    }
    
    // Spróbuj następny dzień
    testDate = new Date(testDate);
    testDate.setDate(testDate.getDate() + 1);
  }
  
  // Jeśli nic nie znaleziono, zwróć datę za 7 dni o godz. 9:00
  const fallback = new Date(startDate);
  fallback.setDate(fallback.getDate() + 7);
  fallback.setHours(startHour, 0, 0, 0);
  return fallback;
}

/**
 * Oblicza szacowany czas zakończenia wysyłki
 */
export function estimateSendingDuration(
  leadsCount: number,
  delayBetweenEmails: number, // sekundy
  startHour: number,
  endHour: number,
  allowedDays: string[]
): { durationHours: number; estimatedEnd: Date; businessDays: number } {
  const totalSeconds = leadsCount * delayBetweenEmails;
  const totalHours = totalSeconds / 3600;
  
  // Ile godzin dziennie możemy wysyłać
  const hoursPerDay = endHour - startHour;
  
  // Ile dni roboczych potrzebujemy
  const businessDays = Math.ceil(totalHours / hoursPerDay);
  
  // Oszacuj datę zakończenia (uproszczone - nie uwzględnia świąt)
  const now = new Date();
  const estimatedEnd = new Date(now);
  estimatedEnd.setDate(estimatedEnd.getDate() + businessDays);
  
  return {
    durationHours: totalHours,
    estimatedEnd,
    businessDays
  };
}

/**
 * Pobiera następną zaplanowaną kampanię do wysłania
 * Zwraca kampanie SCHEDULED lub IN_PROGRESS (np. wznowione dla OOO leadów)
 */
export async function getNextScheduledCampaign() {
  const now = new Date();
  
  return await db.campaign.findFirst({
    where: {
      OR: [
        {
          status: "SCHEDULED",
          scheduledAt: {
            lte: now
          }
        },
        {
          status: "IN_PROGRESS" // Kampanie wznowione (np. dla OOO leadów)
        }
      ]
    },
    orderBy: [
      { status: "desc" }, // IN_PROGRESS najpierw (wyższy priorytet)
      { scheduledAt: "asc" }
    ],
    include: {
      virtualSalesperson: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          language: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
          smtpSecure: true
        }
      },
      CampaignLead: {
        where: {
          lead: {
            status: {
              not: "BLOCKED" // Pomijaj zablokowane leady
            }
          }
        },
        include: {
          lead: true
        },
        orderBy: {
          priority: "asc" // Wysoki priorytet (1) najpierw!
        }
      }
    }
  });
}

