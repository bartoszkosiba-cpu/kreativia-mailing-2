// Serwis do automatycznego pobierania maili co 15 minut
import * as cron from 'node-cron';
import { fetchUnreadEmails } from '@/integrations/imap/client';
import { processReply } from '@/integrations/inbox/processor';
import { processScheduledEmailsV2 } from './campaignEmailSenderV2'; // NOWY SYSTEM V2
import { prefetchHolidays, checkAndPrefetchHolidays } from './holidays';
import { autoCreateFollowUps } from './followUpManager';
import { processAutoFollowUps } from './autoFollowUpManager';
import { sendDailyReportEmail } from './dailyReportEmail';
import { db } from '@/lib/db';

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
  // Kill-switch: globalne wyłączenie wszystkich zadań cron
  if (process.env.CRON_DISABLED === '1' || process.env.CRON_DISABLED === 'true') {
    console.warn('[CRON] CRON_DISABLED aktywny – pomijam startEmailCron()');
    return;
  }
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
  
  // ❌ V1 SYSTEM WYŁĄCZONY - wszystkie kampanie używają V2
  // Oryginalny cron V1 był tutaj, ale został wyłączony bo wszystkie kampanie są w V2
  // campaignCronJob = cron.schedule('* * * * *', async () => { ... });
  
  // Wyślij zaplanowane odpowiedzi z materiałami (to NIE jest V1, więc zostaje)
  let isMaterialResponseCronRunning = false;
  const materialResponseCron = cron.schedule('*/2 * * * *', async () => {
    if (process.env.DISABLE_MATERIAL_SENDER === '1' || process.env.DISABLE_MATERIAL_SENDER === 'true') {
      return; // wyłączone flagą
    }
    // ✅ ZABEZPIECZENIE: Zapobiega równoległemu uruchomieniu (duplikaty)
    if (isMaterialResponseCronRunning) {
      console.log('[CRON] ⚠️ Material Response cron już działa - pomijam');
      return;
    }
    
    isMaterialResponseCronRunning = true;
    try {
      const { sendScheduledMaterialResponses } = await import('./materialResponseSender');
      const sentCount = await sendScheduledMaterialResponses();
      if (sentCount > 0) {
        console.log(`[CRON] ✓ Wysłano ${sentCount} odpowiedzi z materiałami`);
      }
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd wysyłki materiałów:', error.message);
    } finally {
      isMaterialResponseCronRunning = false;
    }
  });
  
  console.log('[CRON] ✓ V1 cron wyłączony - wszystkie kampanie używają V2');
  
  // ============================================================================
  // ✅ OPCJA 4: Cron do wysyłki z CampaignEmailQueue V2 (co 30 sekund)
  // Cron uruchamia setTimeout dla gotowych maili → idealna randomizacja (72-108s)
  // Obciążenie: ~1 zapytanie/30s w praktyce (minimalne)
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
    
    if (!(process.env.DISABLE_AUTO_CREATE_FOLLOWUPS === '1' || process.env.DISABLE_AUTO_CREATE_FOLLOWUPS === 'true')) {
      console.log('[CRON] 🔄 Sprawdzam follow-upy...');
      try {
        await autoCreateFollowUps();
      } catch (error: any) {
        console.error('[CRON] ✗ Błąd follow-upów:', error.message);
      }
    } else {
      console.log('[CRON] ⏸️ Auto-create follow-ups wyłączone flagą');
    }
    
    if (!(process.env.DISABLE_AUTO_FOLLOWUP === '1' || process.env.DISABLE_AUTO_FOLLOWUP === 'true')) {
      console.log('[CRON] 🤖 Sprawdzam AUTO_FOLLOWUP...');
      try {
        await processAutoFollowUps();
      } catch (error: any) {
        console.error('[CRON] ✗ Błąd AUTO_FOLLOWUP:', error.message);
      } finally {
        isHolidayCronTaskRunning = false;
      }
    } else {
      console.log('[CRON] ⏸️ AUTO_FOLLOWUP wyłączony flagą');
      isHolidayCronTaskRunning = false;
    }
  });
  
  console.log('[CRON] ✓ Holiday & Follow-up & AUTO_FOLLOWUP cron uruchomiony (o 00:05)');
  
  // ============================================================================
  // 02:00 - CLEANUP STARYCH WPISÓW Z CAMPAIGN EMAIL QUEUE V2 (polski czas)
  // ============================================================================
  const cleanupCronJob = cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] 🗑️ 02:00 (PL) - Cleanup starych wpisów z CampaignEmailQueueV2');
    try {
      // ✅ Użyj polskiego czasu dla obliczenia "wczoraj"
      const { getStartOfTodayPL } = await import('@/utils/polishTime');
      const startOfTodayPL = getStartOfTodayPL();
      const yesterdayPL = new Date(startOfTodayPL);
      yesterdayPL.setDate(yesterdayPL.getDate() - 1);
      yesterdayPL.setHours(0, 0, 0, 0);

      const result = await db.campaignEmailQueue.deleteMany({
        where: {
          status: { in: ["sent", "failed", "cancelled"] },
          sentAt: {
            lt: yesterdayPL
          }
        }
      });

      if (result.count > 0) {
        console.log(`[CRON] ✅ Usunięto ${result.count} starych wpisów z kolejki V2`);
      }
    } catch (error: any) {
      console.error('[CRON] ✗ Błąd cleanup CampaignEmailQueueV2:', error.message);
    }
  }, {
    timezone: 'Europe/Warsaw'
  });
  
  console.log('[CRON] ✓ Cleanup CampaignEmailQueueV2 uruchomiony (o 02:00 PL)');
  
  // Uruchom cron do dziennego raportu (o 18:00 codziennie)
  if (dailyReportCronJob) {
    console.log('[CRON] Daily Report cron już działa');
    return;
  }
  
  // ❌ WYŁĄCZONE: Dzienny raport (można zobaczyć w UI - dashboard i statystyki)
  // dailyReportCronJob = cron.schedule('0 18 * * *', async () => {
  //   // Kolejkowanie - zapobiega nakładaniu się zadań
  //   if (isDailyReportCronTaskRunning) {
  //     console.log('[CRON] ⏭️ Daily report cron już działa - pomijam');
  //     return;
  //   }
  //   
  //   isDailyReportCronTaskRunning = true;
  //   console.log('[CRON] 📊 Wysyłam dzienny raport...');
  //   try {
  //     await sendDailyReportEmail();
  //   } catch (error: any) {
  //     console.error('[CRON] ✗ Błąd wysyłki raportu:', error.message);
  //   } finally {
  //     isDailyReportCronTaskRunning = false;
  //   }
  // }, {
  //   timezone: 'Europe/Warsaw'
  // });
  
  // console.log('[CRON] ✓ Daily Report cron uruchomiony (o 18:00)');
  
  // Prefetch świąt tylko jeśli nie ma danych w cache
  checkAndPrefetchHolidays().catch(err => console.error('[CRON] Błąd initial prefetch:', err));
  
  // OPCJA 4: Recovery zablokowanych maili po restarcie
  import('./campaignEmailSenderV2').then(({ recoverStuckEmailsAfterRestart }) => {
    recoverStuckEmailsAfterRestart().catch(err => console.error('[CRON] Błąd recovery po restarcie:', err));
  });
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

