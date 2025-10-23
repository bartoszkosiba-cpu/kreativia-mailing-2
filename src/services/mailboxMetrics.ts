/**
 * Mailbox Metrics Service
 * 
 * Oblicza i aktualizuje statystyki zdrowia skrzynek email:
 * - Bounce Rate: Procent nieudanych wysyłek
 * - Reply Rate: Procent odpowiedzi
 * - Deliverability Score: Ogólna ocena reputacji (0-100)
 */

import { db } from '@/lib/db';

interface MailboxMetrics {
  deliverabilityScore: number;
  bounceRate: number;
  replyRate: number;
  totalSent: number;
  totalFailed: number;
  totalReplies: number;
}

/**
 * Oblicza metryki dla pojedynczej skrzynki
 */
export async function calculateMailboxMetrics(mailboxId: number): Promise<MailboxMetrics> {
  try {
    // Pobierz skrzynkę
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId }
    });

    if (!mailbox) {
      throw new Error(`Mailbox ${mailboxId} not found`);
    }

    // 1. Statystyki z WarmupEmail
    const warmupStats = await db.warmupEmail.groupBy({
      by: ['status'],
      where: { mailboxId },
      _count: { id: true }
    });

    const warmupSent = warmupStats.find(s => s.status === 'sent')?._count.id || 0;
    const warmupFailed = warmupStats.find(s => s.status === 'failed')?._count.id || 0;
    const warmupTotal = warmupSent + warmupFailed;

    // 2. Statystyki z SendLog (kampanie)
    const campaignStats = await db.sendLog.groupBy({
      by: ['status'],
      where: { mailboxId },
      _count: { id: true }
    });

    const campaignSent = campaignStats.find(s => s.status === 'sent')?._count.id || 0;
    const campaignFailed = campaignStats.find(s => s.status === 'failed')?._count.id || 0;
    const campaignTotal = campaignSent + campaignFailed;

    // 3. Statystyki odpowiedzi
    // TODO: Reply rate wymaga dodatkowej relacji w bazie
    // Na razie nie możemy policzyć odpowiedzi per mailbox
    const totalReplies = 0;

    // Łączne statystyki
    const totalSent = warmupSent + campaignSent;
    const totalFailed = warmupFailed + campaignFailed;
    const totalEmails = totalSent + totalFailed;

    // Obliczanie wskaźników
    const bounceRate = totalEmails > 0 
      ? (totalFailed / totalEmails) * 100 
      : 0;

    const replyRate = totalSent > 0 
      ? (totalReplies / totalSent) * 100 
      : 0;

    // Deliverability Score (0-100)
    const deliverabilityScore = calculateDeliverabilityScore({
      bounceRate,
      replyRate,
      warmupDay: mailbox.warmupDay,
      warmupStatus: mailbox.warmupStatus,
      totalSent,
      totalFailed
    });

    return {
      deliverabilityScore: Math.round(deliverabilityScore),
      bounceRate: Math.round(bounceRate * 10) / 10, // 1 miejsce po przecinku
      replyRate: Math.round(replyRate * 10) / 10,
      totalSent,
      totalFailed,
      totalReplies
    };

  } catch (error) {
    console.error(`[METRICS] Błąd obliczania metryk dla mailbox ${mailboxId}:`, error);
    throw error;
  }
}

/**
 * Oblicza Deliverability Score na podstawie różnych czynników
 */
function calculateDeliverabilityScore(params: {
  bounceRate: number;
  replyRate: number;
  warmupDay: number;
  warmupStatus: string;
  totalSent: number;
  totalFailed: number;
}): number {
  const { bounceRate, replyRate, warmupDay, warmupStatus, totalSent, totalFailed } = params;

  // Bazowy score
  let score = 100;

  // 1. Bounce Rate (najważniejszy czynnik - negatywny)
  // Każdy % bounce zabiera 3 punkty
  score -= bounceRate * 3;

  // 2. Reply Rate (bardzo pozytywny czynnik)
  // Każdy % reply dodaje 1.5 punkta (max +30)
  score += Math.min(replyRate * 1.5, 30);

  // 3. Warmup Progress (pozytywny czynnik)
  // Im dłużej w warmup, tym lepiej (max +20)
  if (warmupStatus === 'warming' || warmupStatus === 'ready') {
    score += Math.min(warmupDay * 0.7, 20);
  }

  // 4. Failure Rate (negatywny czynnik)
  // Procent nieudanych wysyłek
  if (totalSent + totalFailed > 0) {
    const failureRate = (totalFailed / (totalSent + totalFailed)) * 100;
    score -= failureRate * 2;
  }

  // 5. Penalty dla nowych skrzynek bez historii
  if (totalSent < 10) {
    score -= 20; // -20 punktów dla skrzynek bez historii
  } else if (totalSent < 50) {
    score -= 10; // -10 punktów dla skrzynek z małą historią
  }

  // 6. Bonus za stabilność (brak failureów)
  if (totalSent > 20 && totalFailed === 0) {
    score += 15; // +15 za perfekcyjną wysyłkę
  }

  // Ogranicz do zakresu 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Aktualizuje metryki dla pojedynczej skrzynki
 */
export async function updateMailboxMetrics(mailboxId: number): Promise<void> {
  try {
    console.log(`[METRICS] Obliczam metryki dla mailbox ${mailboxId}...`);
    
    const metrics = await calculateMailboxMetrics(mailboxId);

    await db.mailbox.update({
      where: { id: mailboxId },
      data: {
        deliverabilityScore: metrics.deliverabilityScore,
        bounceRate: metrics.bounceRate,
        replyRate: metrics.replyRate
      }
    });

    console.log(`[METRICS] ✅ Zaktualizowano metryki dla mailbox ${mailboxId}:`, {
      score: metrics.deliverabilityScore,
      bounce: metrics.bounceRate,
      reply: metrics.replyRate
    });

  } catch (error) {
    console.error(`[METRICS] ❌ Błąd aktualizacji metryk dla mailbox ${mailboxId}:`, error);
  }
}

/**
 * Aktualizuje metryki dla wszystkich aktywnych skrzynek
 */
export async function updateAllMailboxMetrics(): Promise<void> {
  try {
    console.log('[METRICS] 📊 Rozpoczynam aktualizację metryk dla wszystkich skrzynek...');

    // Pobierz wszystkie aktywne skrzynki
    const mailboxes = await db.mailbox.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        email: true
      }
    });

    console.log(`[METRICS] Znaleziono ${mailboxes.length} aktywnych skrzynek`);

    let successCount = 0;
    let errorCount = 0;

    // Aktualizuj po kolei (nie równolegle, żeby nie przeciążyć bazy)
    for (const mailbox of mailboxes) {
      try {
        await updateMailboxMetrics(mailbox.id);
        successCount++;
        
        // Małe opóźnienie między aktualizacjami
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[METRICS] Błąd dla ${mailbox.email}:`, error);
        errorCount++;
      }
    }

    console.log(`[METRICS] ✅ Zakończono aktualizację metryk: ${successCount} sukces, ${errorCount} błędów`);

  } catch (error) {
    console.error('[METRICS] ❌ Błąd podczas aktualizacji metryk:', error);
  }
}

/**
 * Aktualizuje metryki dla skrzynek w warmup
 */
export async function updateWarmupMailboxMetrics(): Promise<void> {
  try {
    const mailboxes = await db.mailbox.findMany({
      where: {
        isActive: true,
        warmupStatus: {
          in: ['warming', 'ready']
        }
      },
      select: {
        id: true,
        email: true
      }
    });

    console.log(`[METRICS] Aktualizuję metryki dla ${mailboxes.length} skrzynek w warmup...`);

    for (const mailbox of mailboxes) {
      await updateMailboxMetrics(mailbox.id);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

  } catch (error) {
    console.error('[METRICS] Błąd podczas aktualizacji metryk warmup:', error);
  }
}

