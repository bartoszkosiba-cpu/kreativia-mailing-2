/**
 * WARMUP SENDER - Wysyłanie zaplanowanych maili warmup
 * 
 * Odpowiedzialny za:
 * - Wysyłanie maili z WarmupQueue
 * - Atomic updates (przeciw race conditions)
 * - Sprawdzanie limitów przed wysłaniem
 * - Zapisywanie do WarmupEmail (historia)
 */

import { db } from '@/lib/db';
import { sendEmail } from '@/integrations/smtp/client';
import { TIMING_CONFIG } from './config';
import { addMinutes } from 'date-fns';

/**
 * Wysyła JEDEN zaplanowany mail (najbliższy w czasie)
 * 
 * Używa transakcji atomic aby zapobiec race conditions
 */
export async function sendNextScheduledEmail(): Promise<{
  success: boolean;
  mailSent?: boolean;
  mailboxEmail?: string;
  error?: string;
}> {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    
    // SPRAWDŹ GODZINY WYSYŁANIA - jeśli poza zakresem, nie wysyłaj
    if (currentHour < TIMING_CONFIG.START_HOUR || currentHour >= TIMING_CONFIG.END_HOUR) {
      console.log(`[WARMUP SENDER] ⏰ Poza godzinami wysyłania (${currentHour}:00). START: ${TIMING_CONFIG.START_HOUR}:00, END: ${TIMING_CONFIG.END_HOUR}:00`);
      return { success: true, mailSent: false };
    }
    
    const toleranceWindow = addMinutes(now, TIMING_CONFIG.TOLERANCE_MINUTES);
    
    // KROK 1: Znajdź najbliższy mail do wysłania (z tolerancją)
    const nextEmail = await db.warmupQueue.findFirst({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: toleranceWindow  // Do "teraz + 10 minut"
        }
      },
      orderBy: {
        scheduledAt: 'asc'  // Najstarszy pierwszy
      },
      include: {
        mailbox: {
          include: {
            virtualSalesperson: true
          }
        }
      }
    });
    
    if (!nextEmail) {
      // Brak maili do wysłania - to OK
      return { success: true, mailSent: false };
    }
    
    console.log(`[WARMUP SENDER] 📧 Znaleziono mail do wysłania:`);
    console.log(`[WARMUP SENDER]   → ID: ${nextEmail.id}`);
    console.log(`[WARMUP SENDER]   → Skrzynka: ${nextEmail.mailbox.email}`);
    console.log(`[WARMUP SENDER]   → Zaplanowane: ${nextEmail.scheduledAt.toISOString()}`);
    console.log(`[WARMUP SENDER]   → Do: ${nextEmail.toEmail}`);
    console.log(`[WARMUP SENDER]   → Typ: ${nextEmail.emailType}`);
    
    // KROK 2: Sprawdź czy skrzynka jest nadal w warmup
    if (nextEmail.mailbox.warmupStatus !== 'warming') {
      console.log(`[WARMUP SENDER] ⏭️  Skrzynka ${nextEmail.mailbox.email} nie jest już w warmup - pomijam`);
      
      // Oznacz jako cancelled
      await db.warmupQueue.update({
        where: { id: nextEmail.id },
        data: { status: 'cancelled' }
      });
      
      return { success: true, mailSent: false };
    }
    
    // KROK 3: REZERWUJ SLOT - atomic increment PRZED wysłaniem
    // To jest kluczowe - increment musi być PRZED sprawdzeniem SMTP!
    let incrementResult;
    try {
      incrementResult = await db.$executeRaw`
        UPDATE Mailbox 
        SET warmupTodaySent = warmupTodaySent + 1
        WHERE id = ${nextEmail.mailboxId}
        AND warmupTodaySent < warmupDailyLimit
      `;
    } catch (err: any) {
      console.error(`[WARMUP SENDER] ❌ Błąd SQL:`, err);
      return { success: false, error: err.message };
    }
    
    console.log(`[WARMUP SENDER] 🔒 Próba rezerwacji slotu...`);
    console.log(`[WARMUP SENDER]   → Rows affected: ${incrementResult}`);
    
    // Jeśli 0 rows affected = limit osiągnięty lub skrzynka nie istnieje
    if (incrementResult === 0) {
      console.log(`[WARMUP SENDER] ✋ LIMIT OSIĄGNIĘTY - brak dostępnych slotów`);
      
      // Oznacz mail jako cancelled
      await db.warmupQueue.update({
        where: { id: nextEmail.id },
        data: { 
          status: 'cancelled',
          error: 'Daily limit reached'
        }
      });
      
      return { 
        success: true, 
        mailSent: false,
        mailboxEmail: nextEmail.mailbox.email 
      };
    }
    
    console.log(`[WARMUP SENDER] ✅ Slot zarezerwowany!`);
    
    // KROK 4: Oznacz mail jako "sending"
    await db.warmupQueue.update({
      where: { id: nextEmail.id },
      data: { status: 'sending' }
    });
    
    // KROK 5: WYŚLIJ MAIL (po rezerwacji slotu)
    let sendResult;
    try {
      sendResult = await sendEmail({
        from: nextEmail.mailbox.email || 'warmup@kreativia.pl',
        to: nextEmail.toEmail,
        subject: nextEmail.subject,
        html: nextEmail.body.replace(/\n/g, '<br>'),
        mailboxId: nextEmail.mailboxId,
        type: 'warmup'
      });
      
      console.log(`[WARMUP SENDER] ✅ Mail wysłany!`);
      
    } catch (sendError: any) {
      console.error(`[WARMUP SENDER] ❌ Błąd wysyłki SMTP:`, sendError.message);
      
      // Oznacz jako failed i zapisz do historii
      await db.$transaction(async (tx) => {
        await tx.warmupQueue.update({
          where: { id: nextEmail.id },
          data: { 
            status: 'failed',
            error: sendError.message
          }
        });
        
        // Zapisz failed mail do historii (WarmupEmail)
        await tx.warmupEmail.create({
          data: {
            mailboxId: nextEmail.mailboxId,
            type: nextEmail.emailType,
            subtype: 'scheduled',
            toEmail: nextEmail.toEmail,
            subject: nextEmail.subject,
            content: nextEmail.body,
            status: 'failed',
            errorMessage: sendError.message,
            warmupDay: nextEmail.warmupDay,
            warmupPhase: 'active'
          }
        });
      });
      
      console.log(`[WARMUP SENDER] 💾 Zapisano failed mail do historii`);
      
      return {
        success: false,
        error: sendError.message,
        mailboxEmail: nextEmail.mailbox.email
      };
    }
    
    // KROK 6: Zapisz do historii (slot już zarezerwowany w KROK 3!)
    await db.$transaction(async (tx) => {
      // Zaktualizuj WarmupQueue
      await tx.warmupQueue.update({
        where: { id: nextEmail.id },
        data: {
          status: 'sent',
          sentAt: new Date()
        }
      });
      
      // Zaktualizuj lastWarmupEmailAt i currentDailySent
      await tx.mailbox.update({
        where: { id: nextEmail.mailboxId },
        data: {
          lastWarmupEmailAt: new Date(),
          currentDailySent: { increment: 1 },
          totalEmailsSent: { increment: 1 },
          lastUsedAt: new Date()
        }
      });
      
      // Zapisz do WarmupEmail (historia)
      await tx.warmupEmail.create({
        data: {
          mailboxId: nextEmail.mailboxId,
          type: nextEmail.emailType,
          subtype: 'scheduled',
          toEmail: nextEmail.toEmail,
          subject: nextEmail.subject,
          content: nextEmail.body,
          messageId: sendResult?.messageId,
          status: 'sent',
          sentAt: new Date(),
          warmupDay: nextEmail.warmupDay,
          warmupPhase: 'active'
        }
      });
      
      console.log(`[WARMUP SENDER] 💾 Zapisano do historii`);
    });
    
    // KROK 7: Pobierz zaktualizowany stan
    const updatedMailbox = await db.mailbox.findUnique({
      where: { id: nextEmail.mailboxId },
      select: {
        email: true,
        warmupTodaySent: true,
        warmupDailyLimit: true
      }
    });
    
    console.log(`[WARMUP SENDER] ✅ SUKCES!`);
    console.log(`[WARMUP SENDER]   → ${updatedMailbox?.email}: ${updatedMailbox?.warmupTodaySent}/${updatedMailbox?.warmupDailyLimit}`);
    
    return {
      success: true,
      mailSent: true,
      mailboxEmail: nextEmail.mailbox.email
    };
    
  } catch (error: any) {
    console.error(`[WARMUP SENDER] ❌ Błąd krytyczny:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Wysyła wszystkie zaplanowane maile w oknie czasowym
 * 
 * Wywołuje sendNextScheduledEmail() w pętli
 * UWAGA: Wysyła tylko 1 mail na wywołanie aby uniknąć "salw"
 */
export async function sendScheduledEmails(): Promise<{
  success: boolean;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const stats = {
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  console.log(`[WARMUP SENDER] 🔍 Sprawdzam zaplanowane maile...`);
  
  // WYSYŁAJ TYLKO 1 MAIL NA WYWOŁANIE
  // Dzięki temu unikamy "salw" - każdy cron (co 5 min) wysyła max 1 mail
  const result = await sendNextScheduledEmail();
  
  if (result.success) {
    if (result.mailSent) {
      stats.sent++;
      console.log(`[WARMUP SENDER] ✅ Wysłano: ${result.mailboxEmail}`);
    } else {
      stats.skipped++;
    }
  } else {
    stats.failed++;
    if (result.error) {
      stats.errors.push(result.error);
    }
  }
  
  return {
    success: true,
    ...stats
  };
}

