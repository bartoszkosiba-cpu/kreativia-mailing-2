/**
 * WARMUP TRACKER - Zarządzanie stanem warmup
 * 
 * Odpowiedzialny za:
 * - Reset liczników codziennie o 00:00
 * - Zwiększanie dni warmup o 01:00
 * - Aktualizacja limitów według harmonogramu
 * - Sprawdzanie ukończenia warmup (30 dni)
 */

import { db } from '@/lib/db';
// Removed import getWarmupConfig - using performanceLimits instead
import { differenceInDays, startOfDay } from 'date-fns';

/**
 * Resetuje liczniki warmupTodaySent dla wszystkich skrzynek
 * Wywołaj codziennie o 00:00
 */
export async function resetDailyCounters(): Promise<number> {
  try {
    console.log(`[WARMUP TRACKER] 🔄 Reset liczników warmup i wszystkich skrzynek...`);
    
    // ✅ Pobierz początek dzisiejszego dnia w polskim czasie
    const { getStartOfTodayPL } = await import('@/utils/polishTime');
    const startOfTodayPL = getStartOfTodayPL();
    
    // ✅ RESET WSZYSTKICH SKRZYNEK - zarówno warmup jak i kampanii
    // To zapewnia, że wszystkie skrzynki są resetowane codziennie o 00:00 PL
    const result = await db.mailbox.updateMany({
      where: {
        // Resetuj wszystkie aktywne skrzynki
        isActive: true
      },
      data: {
        // Resetuj licznik warmup dla skrzynek w warmup
        warmupTodaySent: 0,
        // Resetuj licznik kampanii dla wszystkich skrzynek
        // (dla skrzynek w warmup, currentDailySent będzie aktualizowane przez kampanie,
        // ale resetujemy też na wszelki wypadek dla skrzynek które nie są w warmup)
        currentDailySent: 0,
        // Ustaw lastResetDate na początek dzisiejszego dnia w PL
        lastResetDate: startOfTodayPL
      }
    });
    
    console.log(`[WARMUP TRACKER] ✅ Zresetowano wszystkie liczniki dla ${result.count} aktywnych skrzynek (00:00 PL)`);
    return result.count;
    
  } catch (error) {
    console.error(`[WARMUP TRACKER] ❌ Błąd resetu liczników:`, error);
    throw error;
  }
}

/**
 * Zwiększa dzień warmup dla skrzynek (jeśli minął kalendarzowy dzień)
 * Wywołaj codziennie o 01:00
 */
export async function advanceWarmupDays(): Promise<{
  advanced: number;
  completed: number;
}> {
  try {
    console.log(`[WARMUP TRACKER] 📅 Sprawdzam dni warmup...`);
    
    const today = new Date();
    
    // Pobierz wszystkie skrzynki w warmup
    const mailboxes = await db.mailbox.findMany({
      where: {
        warmupStatus: 'warming',
        warmupStartDate: { not: null }
      }
    });
    
    let advancedCount = 0;
    let completedCount = 0;
    
    for (const mailbox of mailboxes) {
      if (!mailbox.warmupStartDate) continue;
      
      // Oblicz ile dni minęło od startu
      const daysSinceStart = differenceInDays(
        startOfDay(today),
        startOfDay(mailbox.warmupStartDate)
      );
      
      const correctDay = daysSinceStart + 1; // Dzień 1 = pierwszy dzień
      
      console.log(`[WARMUP TRACKER] 📧 ${mailbox.email}:`);
      console.log(`[WARMUP TRACKER]   → Start: ${mailbox.warmupStartDate.toISOString().split('T')[0]}`);
      console.log(`[WARMUP TRACKER]   → Dni od startu: ${daysSinceStart}`);
      console.log(`[WARMUP TRACKER]   → Aktualny dzień warmup: ${mailbox.warmupDay}`);
      console.log(`[WARMUP TRACKER]   → Poprawny dzień: ${correctDay}`);
      
      // Jeśli dzień się zmienił
      if (correctDay > mailbox.warmupDay) {
        // Sprawdź czy warmup zakończony (30 dni)
        if (correctDay > 30) {
          console.log(`[WARMUP TRACKER] 🎉 Warmup zakończony! (${correctDay} dni)`);
          
          await db.mailbox.update({
            where: { id: mailbox.id },
            data: {
              warmupStatus: 'ready',
              warmupDay: 30,
              warmupCompletedAt: today,
              warmupDailyLimit: 100 // Max limit po zakończeniu
            }
          });
          
          completedCount++;
          
        } else {
          // Zwiększ dzień i zaktualizuj limit z /settings/performance
          const getWeekFromDay = (day: number): number => {
            if (day <= 0) return 1;
            if (day <= 7) return 1;
            if (day <= 14) return 2;
            if (day <= 21) return 3;
            if (day <= 28) return 4;
            return 5;
          };

          const getPerformanceLimits = async (week: number): Promise<{ warmup: number; campaign: number }> => {
            try {
              const settings = await db.companySettings.findFirst();
              
              if (!settings || !settings.warmupPerformanceSettings) {
                return { warmup: 15, campaign: 10 };
              }
              
              const weeks: Array<{ week: number; warmup: number; campaign: number }> = JSON.parse(settings.warmupPerformanceSettings);
              const weekData = weeks.find(w => w.week === week);
              
              if (!weekData) {
                return weeks[0] || { warmup: 15, campaign: 10 };
              }
              
              return { warmup: weekData.warmup, campaign: weekData.campaign };
            } catch (error) {
              console.error('[WARMUP TRACKER] Błąd pobierania ustawień wydajności:', error);
              return { warmup: 15, campaign: 10 };
            }
          };

          const week = getWeekFromDay(correctDay);
          const performanceLimits = await getPerformanceLimits(week);
          
          console.log(`[WARMUP TRACKER] ⬆️  Zwiększam dzień: ${mailbox.warmupDay} → ${correctDay} (Tydzień ${week})`);
          console.log(`[WARMUP TRACKER]   → Nowy limit warmup: ${performanceLimits.warmup}`);
          
          await db.mailbox.update({
            where: { id: mailbox.id },
            data: {
              warmupDay: correctDay,
              warmupDailyLimit: performanceLimits.warmup
            }
          });
          
          advancedCount++;
        }
      } else {
        console.log(`[WARMUP TRACKER] ✅ Dzień ${correctDay} - bez zmian`);
      }
    }
    
    console.log(`[WARMUP TRACKER] 📊 Podsumowanie:`);
    console.log(`[WARMUP TRACKER]   → Zwiększono dni: ${advancedCount}`);
    console.log(`[WARMUP TRACKER]   → Zakończono warmup: ${completedCount}`);
    
    return {
      advanced: advancedCount,
      completed: completedCount
    };
    
  } catch (error) {
    console.error(`[WARMUP TRACKER] ❌ Błąd zwiększania dni:`, error);
    throw error;
  }
}

/**
 * Rozpoczyna warmup dla skrzynki
 */
export async function startWarmup(mailboxId: number): Promise<void> {
  try {
    console.log(`[WARMUP TRACKER] 🚀 Rozpoczynam warmup dla skrzynki ${mailboxId}`);
    
    // Pobierz limity z /settings/performance dla tygodnia 1 (dni 1-7)
    const getPerformanceLimits = async (week: number): Promise<{ warmup: number; campaign: number }> => {
      try {
        const settings = await db.companySettings.findFirst();
        
        if (!settings || !settings.warmupPerformanceSettings) {
          return { warmup: 15, campaign: 10 };
        }
        
        const weeks: Array<{ week: number; warmup: number; campaign: number }> = JSON.parse(settings.warmupPerformanceSettings);
        const weekData = weeks.find(w => w.week === week);
        
        if (!weekData) {
          return weeks[0] || { warmup: 15, campaign: 10 };
        }
        
        return { warmup: weekData.warmup, campaign: weekData.campaign };
      } catch (error) {
        console.error('[WARMUP TRACKER] Błąd pobierania ustawień wydajności:', error);
        return { warmup: 15, campaign: 10 };
      }
    };

    const performanceLimits = await getPerformanceLimits(1); // Tydzień 1 dla dnia 1
    
    await db.mailbox.update({
      where: { id: mailboxId },
      data: {
        warmupStatus: 'warming',
        warmupStartDate: new Date(),
        warmupDay: 1,
        warmupDailyLimit: performanceLimits.warmup,
        warmupTodaySent: 0,
        warmupCompletedAt: null,
        warmupIssues: null  // Clear any previous issues when starting warmup
      }
    });
    
    console.log(`[WARMUP TRACKER] ✅ Warmup rozpoczęty`);
    console.log(`[WARMUP TRACKER]   → Dzień: 1 (Tydzień 1)`);
    console.log(`[WARMUP TRACKER]   → Limit warmup: ${performanceLimits.warmup}`);
    console.log(`[WARMUP TRACKER]   → Limit kampanii: ${performanceLimits.campaign}`);
    
  } catch (error) {
    console.error(`[WARMUP TRACKER] ❌ Błąd startu warmup:`, error);
    throw error;
  }
}

/**
 * Zatrzymuje warmup dla skrzynki
 */
export async function stopWarmup(mailboxId: number): Promise<void> {
  try {
    console.log(`[WARMUP TRACKER] ⏸️  Zatrzymuję warmup dla skrzynki ${mailboxId}`);
    
    // Oznacz wszystkie pending maile jako cancelled
    await db.warmupQueue.updateMany({
      where: {
        mailboxId,
        status: 'pending'
      },
      data: {
        status: 'cancelled',
        error: 'Warmup stopped by user'
      }
    });
    
    await db.mailbox.update({
      where: { id: mailboxId },
      data: {
        warmupStatus: 'inactive'
      }
    });
    
    console.log(`[WARMUP TRACKER] ✅ Warmup zatrzymany`);
    
  } catch (error) {
    console.error(`[WARMUP TRACKER] ❌ Błąd zatrzymania warmup:`, error);
    throw error;
  }
}

/**
 * Cleanup - usuwa stare wpisy z WarmupQueue (starsze niż 30 dni)
 */
export async function cleanupOldQueue(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await db.warmupQueue.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    });
    
    if (result.count > 0) {
      console.log(`[WARMUP TRACKER] 🗑️  Usunięto ${result.count} starych wpisów z queue`);
    }
    
    return result.count;
    
  } catch (error) {
    console.error(`[WARMUP TRACKER] ❌ Błąd cleanup:`, error);
    throw error;
  }
}

