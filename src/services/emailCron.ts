// Serwis do automatycznego pobierania maili co 15 minut
import * as cron from 'node-cron';
import { fetchUnreadEmails } from '@/integrations/imap/client';
import { processReply } from '@/integrations/inbox/processor';
import { processScheduledCampaign } from './scheduledSender';
import { processScheduledEmailsV2 } from './campaignEmailSenderV2'; // NOWY SYSTEM V2
import { prefetchHolidays, checkAndPrefetchHolidays } from './holidays';
import { autoCreateFollowUps } from './followUpManager';
import { processAutoFollowUps } from './autoFollowUpManager';
import { sendDailyReportEmail } from './dailyReportEmail';

let emailCronJob: cron.ScheduledTask | null = null;
let campaignCronJob: cron.ScheduledTask | null = null;
let campaignCronJobV2: cron.ScheduledTask | null = null; // NOWY SYSTEM V2
let holidayCronJob: cron.ScheduledTask | null = null;
let dailyReportCronJob: cron.ScheduledTask | null = null;

// Flagi kolejkowania - zapobiegają nakładaniu się zadań
let isEmailCronTaskRunning = false;
let isCampaignCronTaskRunning = false;
let isCampaignCronTaskRunningV2 = false; // NOWY SYSTEM V2
let isHolidayCronTaskRunning = false;
let isDailyReportCronTaskRunning = false;

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
    // Kolejkowanie - zapobiega nakładaniu się zadań
    if (isEmailCronTaskRunning) {
      console.log('[CRON] ⏭️ Email cron już działa - pomijam');
      return;
    }
    
    isEmailCronTaskRunning = true;
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
            imapSecure: mailbox.imapSecure ?? true,
            createdAt: mailbox.createdAt // Przekaż datę utworzenia skrzynki jako filtr
          };

          // Pobierz nowe maile z tego mailbox
          const emails = await fetchUnreadEmails(imapConfig);
          console.log(`[CRON] ✓ Pobrano ${emails.length} maili z ${mailbox.email}`);
          
          totalEmailsCount += emails.length;

          // Przetwórz każdy mail
          for (const email of emails) {
            try {
              // ✅ Przekaż toEmail (adres skrzynki, na którą przyszedł mail)
              const result = await processReply(email, mailbox.email);
              
              if (result.error) {
                console.log(`[CRON] ⚠ Mail ${email.subject}: ${result.error}`);
                totalErrorCount++;
              } else {
                console.log(`[CRON] ✓ Mail ${email.subject}: ${result.classification}`);
                totalSuccessCount++;
                
                // Automatycznie uruchom AI Agent dla nowej odpowiedzi
                if (result.replyId) {
                  try {
                    const { EmailAgentAI } = await import('./emailAgentAI');
                    const analysis = await EmailAgentAI.processEmailReply(result.replyId);
                    await EmailAgentAI.executeActions(analysis, result.replyId);
                    console.log(`[CRON] 🤖 Email Agent AI przetworzył odpowiedź ID: ${result.replyId}`);
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
    } finally {
      isEmailCronTaskRunning = false;
    }
  });

  console.log('[CRON] ✓ Email cron uruchomiony (pobieranie co 15 minut)');
  
  // ✅ NOWY SYSTEM: Cron do wysyłki z CampaignEmailQueue (co 30 sekund - precyzyjne planowanie)
  // Używa kolejki z precyzyjnymi czasami scheduledAt
  // node-cron nie wspiera sekund, więc używamy co 1 minutę, ale w funkcji sprawdzamy czy czas minął
  campaignCronJob = cron.schedule('* * * * *', async () => {
    // Kolejkowanie - zapobiega nakładaniu się zadań
    if (isCampaignCronTaskRunning) {
      console.log('[CRON] ⏭️ Campaign cron już działa - pomijam');
      return;
    }
    
    isCampaignCronTaskRunning = true;
    const cronStartTime = new Date();
    console.log(`[CRON] 📧 Sprawdzam kolejkę kampanii... (start: ${cronStartTime.toISOString()})`);
    try {
      // NOWY SYSTEM: Wysyłaj z kolejki (CampaignEmailQueue)
      const { sendScheduledCampaignEmails } = await import('./campaignEmailSender');
      const result = await sendScheduledCampaignEmails();
      
      if (result.sent > 0) {
        console.log(`[CRON] ✅ Wysłano ${result.sent} mail(i) z kolejki`);
      }
      if (result.skipped > 0) {
        console.log(`[CRON] ⏭️  Pominięto ${result.skipped} mail(i) (opóźniony/brak skrzynek/okno czasowe)`);
      }
      if (result.failed > 0) {
        console.error(`[CRON] ❌ Błędy: ${result.failed}`, result.errors);
      }
      if (result.sent === 0 && result.skipped === 0 && result.failed === 0) {
        console.log(`[CRON] ℹ️  Brak maili do wysłania w tym momencie`);
      }
      
      const cronEndTime = new Date();
      const cronDuration = Math.floor((cronEndTime.getTime() - cronStartTime.getTime()) / 1000);
      if (cronDuration > 10) {
        console.log(`[CRON] ⚠️ SendScheduledCampaignEmails trwał ${cronDuration}s (dłużej niż 10s)`);
      }
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd wysyłki kampanii z kolejki:', error.message);
    }
    
    // Wyślij zaplanowane odpowiedzi z materiałami
    try {
      const { sendScheduledMaterialResponses } = await import('./materialResponseSender');
      const sentCount = await sendScheduledMaterialResponses();
      if (sentCount > 0) {
        console.log(`[CRON] ✓ Wysłano ${sentCount} odpowiedzi z materiałami`);
      }
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd wysyłki materiałów:', error.message);
    } finally {
      isCampaignCronTaskRunning = false;
    }
  });
  
  console.log('[CRON] ✓ Campaign cron uruchomiony (sprawdzanie kolejki co 1 minutę)');
  
  // ============================================================================
  // ✅ NOWY SYSTEM V2: Cron do wysyłki z CampaignEmailQueue V2 (co 30 sekund)
  // Testowo tylko dla kampanii ID: 4
  // Równolegle ze starym systemem - bezpieczna migracja
  // ============================================================================
  campaignCronJobV2 = cron.schedule('*/30 * * * * *', async () => {
    // Kolejkowanie - zapobiega nakładaniu się zadań
    if (isCampaignCronTaskRunningV2) {
      return; // Pomijaj jeśli już działa
    }
    
    isCampaignCronTaskRunningV2 = true;
    const cronStartTime = new Date();
    
    try {
      // ✅ SYSTEMOWE V2: Przetwarzaj wszystkie kampanie IN_PROGRESS
      const result = await processScheduledEmailsV2();
      
      if (result.sent > 0) {
        console.log(`[CRON V2] ✅ Wysłano ${result.sent} mail(i) z kolejki V2`);
      }
      if (result.processed > 0 && result.sent === 0) {
        // Przetworzono kampanie ale nie wysłano (brak maili w kolejce, brak skrzynek, etc.)
      }
      if (result.errors > 0) {
        console.error(`[CRON V2] ❌ Błędy: ${result.errors}`);
      }
    } catch (error: any) {
      console.error('[CRON V2] ✗ Błąd wysyłki kampanii V2:', error.message);
    } finally {
      isCampaignCronTaskRunningV2 = false;
    }
  }, {
    scheduled: true,
    timezone: 'Europe/Warsaw'
  });
  
  console.log('[CRON] ✓ Campaign cron V2 uruchomiony (sprawdzanie co 30 sekund, wszystkie kampanie IN_PROGRESS)');
  
  // ✅ STARY SYSTEM: Działa dalej dla wszystkich kampanii (backward compatibility)
  // Można usunąć po pełnej migracji do nowego systemu
  // TODO: Usuń po pełnej migracji do V2
  
  // Uruchom cron do prefetch świąt + follow-upy (raz dziennie o 00:05 - przesunięte o 5 min)
  holidayCronJob = cron.schedule('5 0 * * *', async () => {
    // Kolejkowanie - zapobiega nakładaniu się zadań
    if (isHolidayCronTaskRunning) {
      console.log('[CRON] ⏭️ Holiday cron już działa - pomijam');
      return;
    }
    
    isHolidayCronTaskRunning = true;
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
    
    console.log('[CRON] 🤖 Sprawdzam AUTO_FOLLOWUP...');
    try {
      await processAutoFollowUps();
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd AUTO_FOLLOWUP:', error.message);
    } finally {
      isHolidayCronTaskRunning = false;
    }
  });
  
  console.log('[CRON] ✓ Holiday & Follow-up & AUTO_FOLLOWUP cron uruchomiony (o 00:05)');
  
  // ============================================================================
  // 02:00 - CLEANUP STARYCH WPISÓW Z CAMPAIGN EMAIL QUEUE (polski czas)
  // ============================================================================
  const cleanupCronJob = cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] 🗑️ 02:00 (PL) - Cleanup starych wpisów z CampaignEmailQueue');
    try {
      const { cleanupCampaignQueue } = await import('./campaignEmailQueue');
      const deleted = await cleanupCampaignQueue();
      if (deleted > 0) {
        console.log(`[CRON] ✅ Usunięto ${deleted} starych wpisów z kolejki`);
      }
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd cleanup CampaignEmailQueue:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'Europe/Warsaw'
  });
  
  console.log('[CRON] ✓ Cleanup CampaignEmailQueue uruchomiony (o 02:00 PL)');
  
  // Uruchom cron do dziennego raportu (o 18:00 codziennie)
  if (dailyReportCronJob) {
    console.log('[CRON] Daily Report cron już działa');
    return;
  }
  
  dailyReportCronJob = cron.schedule('0 18 * * *', async () => {
    // Kolejkowanie - zapobiega nakładaniu się zadań
    if (isDailyReportCronTaskRunning) {
      console.log('[CRON] ⏭️ Daily report cron już działa - pomijam');
      return;
    }
    
    isDailyReportCronTaskRunning = true;
    console.log('[CRON] 📊 Wysyłam dzienny raport...');
    try {
      await sendDailyReportEmail();
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd wysyłki raportu:', error.message);
    } finally {
      isDailyReportCronTaskRunning = false;
    }
  }, {
    scheduled: true,
    timezone: 'Europe/Warsaw'
  });
  
  console.log('[CRON] ✓ Daily Report cron uruchomiony (o 18:00)');
  
  // Prefetch świąt tylko jeśli nie ma danych w cache
  checkAndPrefetchHolidays().catch(err => console.error('[CRON] Błąd initial prefetch:', err));
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
  
  if (campaignCronJobV2) {
    campaignCronJobV2.stop();
    campaignCronJobV2 = null;
    console.log('[CRON] ✓ Campaign cron V2 zatrzymany');
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

