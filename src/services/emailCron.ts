// Serwis do automatycznego pobierania maili co 15 minut
import * as cron from 'node-cron';
import { fetchUnreadEmails } from '@/integrations/imap/client';
import { processReply } from '@/integrations/inbox/processor';
import { processScheduledCampaign } from './scheduledSender';
import { prefetchHolidays } from './holidays';
import { autoCreateFollowUps } from './followUpManager';
import { sendDailyReportEmail } from './dailyReportEmail';

let emailCronJob: cron.ScheduledTask | null = null;
let campaignCronJob: cron.ScheduledTask | null = null;
let holidayCronJob: cron.ScheduledTask | null = null;
let dailyReportCronJob: cron.ScheduledTask | null = null;

/**
 * Uruchamia automatyczne pobieranie maili co 15 minut
 */
export function startEmailCron() {
  // Jeśli cron już działa, nie uruchamiaj ponownie
  if (emailCronJob) {
    console.log('[CRON] Email cron już działa');
    return;
  }

  // Uruchom cron job co 15 minut
  // Cron syntax: */15 * * * * = co 15 minut
  emailCronJob = cron.schedule('*/15 * * * *', async () => {
    console.log('[CRON] 🔄 Rozpoczynam automatyczne pobieranie maili ze wszystkich skrzynek...');
    
    try {
      // Pobierz wszystkie aktywne mailboxy
      const { db } = await import('@/lib/db');
      const allMailboxes = await db.mailbox.findMany({
        where: {
          isActive: true
        },
        include: {
          virtualSalesperson: true
        }
      });
      
      // Filtruj mailboxy które mają IMAP skonfigurowane
      const mailboxes = allMailboxes.filter(mb => 
        mb.imapHost && mb.imapUser && mb.imapPass
      );

      console.log(`[CRON] 📬 Znaleziono ${mailboxes.length} aktywnych skrzynek z IMAP`);

      let totalEmailsCount = 0;
      let totalSuccessCount = 0;
      let totalErrorCount = 0;

      // Iteruj po każdym mailbox i pobierz maile
      for (const mailbox of mailboxes) {
        console.log(`[CRON] 📥 Sprawdzam skrzynkę: ${mailbox.email}...`);
        
        try {
          // Konfiguracja IMAP dla tego mailbox
          const imapConfig = {
            imapHost: mailbox.imapHost!,
            imapPort: mailbox.imapPort!,
            imapUser: mailbox.imapUser!,
            imapPass: mailbox.imapPass!,
            imapSecure: mailbox.imapSecure ?? true
          };

          // Pobierz nowe maile z tego mailbox
          const emails = await fetchUnreadEmails(imapConfig);
          console.log(`[CRON] ✓ Pobrano ${emails.length} maili z ${mailbox.email}`);
          
          totalEmailsCount += emails.length;

          // Przetwórz każdy mail
          for (const email of emails) {
            try {
              const result = await processReply(email);
              
              if (result.error) {
                console.log(`[CRON] ⚠ Mail ${email.subject}: ${result.error}`);
                totalErrorCount++;
              } else {
                console.log(`[CRON] ✓ Mail ${email.subject}: ${result.classification}`);
                totalSuccessCount++;
                
                // Automatycznie uruchom AI Agent dla nowej odpowiedzi
                if (result.replyId) {
                  try {
                    const { processReplyWithAI } = await import('./aiAgent');
                    await processReplyWithAI(result.replyId);
                    console.log(`[CRON] 🤖 AI Agent przetworzył odpowiedź ID: ${result.replyId}`);
                  } catch (aiError: any) {
                    console.error(`[CRON] ⚠ Błąd AI Agent dla odpowiedzi ${result.replyId}:`, aiError.message);
                  }
                }
              }
            } catch (error: any) {
              console.error(`[CRON] ✗ Błąd przetwarzania maila ${email.subject}:`, error.message);
              totalErrorCount++;
            }
          }
        } catch (error: any) {
          console.error(`[CRON] ✗ Błąd pobierania maili z ${mailbox.email}:`, error.message);
        }
      }
      
      console.log(`[CRON] 🎉 Zakończono: ${totalEmailsCount} maili, ${totalSuccessCount} sukcesów, ${totalErrorCount} błędów`);
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd podczas pobierania maili:', error.message);
    }
  });

  console.log('[CRON] ✓ Email cron uruchomiony (pobieranie co 15 minut)');
  
  // Uruchom cron do wysyłki zaplanowanych kampanii (co 5 minut)
  campaignCronJob = cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] 📧 Sprawdzam zaplanowane kampanie...');
    try {
      await processScheduledCampaign();
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd wysyłki kampanii:', error.message);
    }
  });
  
  console.log('[CRON] ✓ Campaign cron uruchomiony (sprawdzanie co 5 minut)');
  
  // Uruchom cron do prefetch świąt + follow-upy (raz dziennie o 00:00)
  holidayCronJob = cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] 🎄 Prefetch świąt...');
    try {
      await prefetchHolidays();
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd prefetch świąt:', error.message);
    }
    
    console.log('[CRON] 🔄 Sprawdzam follow-upy...');
    try {
      await autoCreateFollowUps();
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd follow-upów:', error.message);
    }
  });
  
  console.log('[CRON] ✓ Holiday & Follow-up cron uruchomiony (o 00:00)');
  
  // Uruchom cron do dziennego raportu (o 18:00 codziennie)
  dailyReportCronJob = cron.schedule('0 18 * * *', async () => {
    console.log('[CRON] 📊 Wysyłam dzienny raport...');
    try {
      await sendDailyReportEmail();
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd wysyłki raportu:', error.message);
    }
  });
  
  console.log('[CRON] ✓ Daily Report cron uruchomiony (o 18:00)');
  
  // Wykonaj prefetch świąt od razu przy starcie
  prefetchHolidays().catch(err => console.error('[CRON] Błąd initial prefetch:', err));
}

/**
 * Zatrzymuje automatyczne pobieranie maili
 */
export function stopEmailCron() {
  if (emailCronJob) {
    emailCronJob.stop();
    emailCronJob = null;
    console.log('[CRON] ✓ Email cron zatrzymany');
  }
  
  if (campaignCronJob) {
    campaignCronJob.stop();
    campaignCronJob = null;
    console.log('[CRON] ✓ Campaign cron zatrzymany');
  }
  
  if (holidayCronJob) {
    holidayCronJob.stop();
    holidayCronJob = null;
    console.log('[CRON] ✓ Holiday cron zatrzymany');
  }
  
  if (dailyReportCronJob) {
    dailyReportCronJob.stop();
    dailyReportCronJob = null;
    console.log('[CRON] ✓ Daily Report cron zatrzymany');
  }
}

/**
 * Sprawdza czy cron job działa
 */
export function isEmailCronRunning(): boolean {
  return emailCronJob !== null && campaignCronJob !== null;
}

