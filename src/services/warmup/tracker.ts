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
import { getWarmupConfig } from './config';
import { differenceInDays, startOfDay } from 'date-fns';

/**
 * Resetuje liczniki warmupTodaySent dla wszystkich skrzynek
 * Wywołaj codziennie o 00:00
 */
export async function resetDailyCounters(): Promise<number> {
  try {
    console.log(`[WARMUP TRACKER] 🔄 Reset liczników warmup...`);
    
    const result = await db.mailbox.updateMany({
      where: {
        warmupStatus: 'warming'
      },
      data: {
        warmupTodaySent: 0
      }
    });
    
    console.log(`[WARMUP TRACKER] ✅ Zresetowano ${result.count} skrzynek`);
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
          // Zwiększ dzień i zaktualizuj limit
          const newConfig = await getWarmupConfig(correctDay);
          
          if (newConfig) {
            console.log(`[WARMUP TRACKER] ⬆️  Zwiększam dzień: ${mailbox.warmupDay} → ${correctDay}`);
            console.log(`[WARMUP TRACKER]   → Nowy limit warmup: ${newConfig.dailyLimit}`);
            
            await db.mailbox.update({
              where: { id: mailbox.id },
              data: {
                warmupDay: correctDay,
                warmupDailyLimit: newConfig.dailyLimit
              }
            });
            
            advancedCount++;
          }
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
    
    const config = await getWarmupConfig(1); // Dzień 1
    
    if (!config) {
      throw new Error('Brak konfiguracji dla dnia 1');
    }
    
    await db.mailbox.update({
      where: { id: mailboxId },
      data: {
        warmupStatus: 'warming',
        warmupStartDate: new Date(),
        warmupDay: 1,
        warmupDailyLimit: config.dailyLimit,
        warmupTodaySent: 0,
        warmupCompletedAt: null,
        warmupIssues: null  // Clear any previous issues when starting warmup
      }
    });
    
    console.log(`[WARMUP TRACKER] ✅ Warmup rozpoczęty`);
    console.log(`[WARMUP TRACKER]   → Dzień: 1`);
    console.log(`[WARMUP TRACKER]   → Limit: ${config.dailyLimit}`);
    
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

