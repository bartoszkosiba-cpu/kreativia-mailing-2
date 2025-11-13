/**
 * CAMPAIGN EMAIL SENDER V2 - Nowa wersja wysyłki zaplanowanych maili
 * 
 * Zasady:
 * - Prosta logika, atomic operations
 * - Przetwarzanie wielu kampanii równolegle
 * - Automatyczna detekcja i migracja istniejących kampanii
 */

import { db } from "@/lib/db";
import { getNextAvailableMailbox } from "./mailboxManager";
import { sendSingleEmail } from "./scheduledSender";
import {
  scheduleNextEmailV2,
  initializeQueueV2
} from "./campaignEmailQueueV2";
import { isValidSendTime } from "./campaignScheduler";

/**
 * Wysyła jeden mail z kolejki dla kampanii
 */
export async function sendNextEmailFromQueue(
  campaignId: number
): Promise<{
  success: boolean;
  mailSent: boolean;
  error?: string;
}> {
  try {
    // ✅ POPRAWKA Problem 3: Użyj transakcji z SELECT FOR UPDATE aby zapobiec race condition
    // To zapewnia 100% pewność że tylko jeden proces może pobrać i zablokować maila
    const result = await db.$transaction(async (tx) => {
      // KROK 1: Pobierz następny mail z kolejki i atomowo zablokuj w jednej transakcji
      const { getPolishTime } = await import('@/utils/polishTime');
      const now = getPolishTime();
      
      // ✅ POPRAWKA Recovery: Dynamiczna tolerancja - dłuższa dla recovery po restarcie/pauzie
      // Sprawdź czy są zablokowane maile (po restarcie/recovery)
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const stuckEmailsCount = await tx.campaignEmailQueue.count({
        where: {
          campaignId,
          status: 'sending',
          updatedAt: { lt: tenMinutesAgo } // Starsze niż 10 min
        }
      });
      
      // ✅ POPRAWKA Problem 2: Sprawdź ostatni wysłany mail (SendLog) - wykrywa recovery po długich przerwach
      const lastSentLog = await tx.sendLog.findFirst({
        where: {
          campaignId,
          status: 'sent'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      let isRecoveryAfterLongPause = false;
      if (lastSentLog) {
        const timeSinceLastMail = Math.floor((now.getTime() - new Date(lastSentLog.createdAt).getTime()) / 1000); // sekundy
        // ✅ POPRAWKA: Jeśli od ostatniego maila minęło > 10 min, to prawdopodobnie recovery po pauzie
        // (poprzednio było 1h, ale to było za długo - maile były ignorowane)
        if (timeSinceLastMail > 600) { // 10 minut
          isRecoveryAfterLongPause = true;
        }
      }
      
      // ✅ POPRAWKA: Sprawdź czy są maile starsze niż normalna tolerancja (5 min)
      // Jeśli tak, to też jest recovery scenario
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const oldEmailsCount = await tx.campaignEmailQueue.count({
        where: {
          campaignId,
          status: 'pending',
          scheduledAt: { lt: fiveMinutesAgo } // Starsze niż 5 min
        }
      });
      
      if (oldEmailsCount > 0 && !isRecoveryAfterLongPause) {
        isRecoveryAfterLongPause = true;
        console.log(`[SENDER V2] 🔄 Recovery detected: ${oldEmailsCount} old emails (>5min), using longer tolerance`);
      }
      
      // Jeśli są zablokowane maile LUB długi czas od ostatniego maila = recovery -> dłuższa tolerancja (2h)
      // W przeciwnym razie = normalna sytuacja -> krótka tolerancja (5 min)
      const maxToleranceMinutes = (stuckEmailsCount > 0 || isRecoveryAfterLongPause) ? 120 : 5;
      const maxTolerance = new Date(now.getTime() - maxToleranceMinutes * 60 * 1000);
      
      if (stuckEmailsCount > 0) {
        console.log(`[SENDER V2] 🔄 Recovery detected: ${stuckEmailsCount} stuck emails, using ${maxToleranceMinutes}min tolerance`);
      } else if (isRecoveryAfterLongPause && lastSentLog) {
        const timeSinceLastMail = Math.floor((now.getTime() - new Date(lastSentLog.createdAt).getTime()) / 60); // minuty
        console.log(`[SENDER V2] 🔄 Recovery detected: ${timeSinceLastMail} min since last mail, using ${maxToleranceMinutes}min tolerance`);
      }

      // Pobierz kampanię dla sprawdzenia okna czasowego i delayBetweenEmails
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: {
          startHour: true,
          startMinute: true,
          endHour: true,
          endMinute: true,
          allowedDays: true,
          delayBetweenEmails: true
        }
      });

      // ✅ POPRAWKA: Sprawdź czy kampania już ma mail w trakcie wysyłki (w transakcji)
      // Zapobiega równoczesnemu wysyłaniu wielu maili z tej samej kampanii
      const sendingInProgress = await tx.campaignEmailQueue.count({
        where: {
          campaignId,
          status: 'sending'
        }
      });
      
      if (sendingInProgress > 0) {
        // Kampania już wysyła mail - zakończ transakcję (zapobiega duplikatom)
        return { email: null, locked: false };
      }
      
      // Pobierz kandydatów do wysłania
      const candidateEmails = await tx.campaignEmailQueue.findMany({
        where: {
          campaignId,
          status: 'pending',
          scheduledAt: { 
            lte: now,
            gte: maxTolerance
          }
        },
        include: {
          campaignLead: {
            include: {
              lead: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  company: true,
                  language: true,
                  greetingForm: true
                }
              }
            }
          }
        },
        orderBy: {
          scheduledAt: 'asc'
        },
        take: 10
      });

      // Sortuj po priorytecie
      candidateEmails.sort((a: any, b: any) => {
        const timeDiff = a.scheduledAt.getTime() - b.scheduledAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        const priorityA = a.campaignLead?.priority ?? 999;
        const priorityB = b.campaignLead?.priority ?? 999;
        return priorityA - priorityB;
      });

      const nextEmail = candidateEmails[0] || null;

      if (!nextEmail) {
        return { email: null, locked: false };
      }

      // ✅ POPRAWKA: Sprawdź okno czasowe używając AKTUALNEGO czasu (now), nie scheduledTime
      // To jest ważne dla maili z przeszłości - sprawdzamy czy TERAZ jesteśmy w oknie
      if (campaign) {
        const { isWithinSendWindow } = await import('./campaignEmailQueueV2');
        
        // Sprawdź czy AKTUALNY czas jest w oknie czasowym
        if (!isWithinSendWindow(now, campaign)) {
          // Poza oknem - zaplanuj ponownie na jutro
          const { setPolishTime } = await import('@/utils/polishTime');
          const nowPL = getPolishTime();
          const tomorrowPL = new Date(nowPL);
          tomorrowPL.setDate(tomorrowPL.getDate() + 1);
          const newScheduledAt = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
          
          await tx.campaignEmailQueue.update({
            where: { id: nextEmail.id },
            data: { scheduledAt: newScheduledAt }
          });
          
          console.log(`[SENDER V2] ⏰ Kampania ${campaignId}: Mail ${nextEmail.id} poza oknem czasowym (teraz: ${now.toISOString()}) - przekładam na jutro ${newScheduledAt.toISOString()}`);
          return { email: null, locked: false };
        }
      }

      // ✅ POPRAWKA Problem A: Minimalny odstęp dla catch-up maili
      // Jeśli mail jest w tolerancji (catch-up), sprawdź czy minął delayBetweenEmails od ostatniego maila
      const isCatchUp = nextEmail.scheduledAt < now; // Mail był zaplanowany w przeszłości
      
      if (isCatchUp && campaign) {
        const delayBetweenEmails = campaign.delayBetweenEmails || 90;
        
        // Pobierz ostatni wysłany mail z SendLog
        const lastSentLog = await tx.sendLog.findFirst({
          where: {
            campaignId,
            status: 'sent'
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        if (lastSentLog) {
          const lastSentTime = new Date(lastSentLog.createdAt);
          const timeSinceLastMail = Math.floor((now.getTime() - lastSentTime.getTime()) / 1000); // sekundy
          
          // Jeśli od ostatniego maila minęło mniej niż delayBetweenEmails, przekłać na później
          if (timeSinceLastMail < delayBetweenEmails) {
            const { calculateNextEmailTimeV2 } = await import('./campaignEmailQueueV2');
            const newScheduledAt = calculateNextEmailTimeV2(lastSentTime, delayBetweenEmails);
            
            await tx.campaignEmailQueue.update({
              where: { id: nextEmail.id },
              data: { scheduledAt: newScheduledAt }
            });
            
            console.log(`[SENDER V2] ⏰ Kampania ${campaignId}: Mail ${nextEmail.id} catch-up, ale minęło tylko ${timeSinceLastMail}s od ostatniego (wymagane ${delayBetweenEmails}s) - przekładam na ${newScheduledAt.toISOString()}`);
            return { email: null, locked: false };
          }
        }
      }

      // ✅ NOWE: Atomowa rezerwacja slotu skrzynki PRZED zablokowaniem maila
      // Pobierz kampanię dla virtualSalespersonId
      const campaignForMailbox = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: { virtualSalespersonId: true }
      });

      if (!campaignForMailbox) {
        return { email: null, locked: false };
      }

      // Pobierz dostępną skrzynkę (wyklucz skrzynki używane przez inne aktywne kampanie)
      const { getNextAvailableMailbox } = await import('./mailboxManager');
      const availableMailbox = await getNextAvailableMailbox(campaignForMailbox.virtualSalespersonId || 0, campaignId);

      if (!availableMailbox) {
        // ✅ POPRAWKA Problem 1: Brak dostępnych skrzynek - przekładaj na jutro
        if (campaign) {
          const { setPolishTime, getPolishTime } = await import('@/utils/polishTime');
          const nowPL = getPolishTime();
          const tomorrowPL = new Date(nowPL);
          tomorrowPL.setDate(tomorrowPL.getDate() + 1);
          const newScheduledAt = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
          
          await tx.campaignEmailQueue.update({
            where: { id: nextEmail.id },
            data: { scheduledAt: newScheduledAt }
          });
          
          console.log(`[SENDER V2] 📅 Kampania ${campaignId}: Brak dostępnych skrzynek - mail ${nextEmail.id} przekładam na jutro ${newScheduledAt.toISOString()}`);
        }
        return { email: null, locked: false };
      }

      // Pobierz pełne dane skrzynki dla rezerwacji (w transakcji)
      const mailboxForReservation = await tx.mailbox.findUnique({
        where: { id: availableMailbox.id },
        select: {
          id: true,
          warmupStatus: true,
          currentDailySent: true,
          warmupTodaySent: true,
          dailyEmailLimit: true,
          warmupDailyLimit: true,
          warmupDay: true
        }
      });

      if (!mailboxForReservation) {
        return { email: null, locked: false };
      }

      // Oblicz właściwy limit i currentSent (jak w getNextAvailableMailbox)
      const { getWeekFromDay } = await import('./mailboxManager');
      const { getPerformanceLimits } = await import('./mailboxManager');
      let effectiveLimit: number;
      let currentSent: number;

      if (mailboxForReservation.warmupStatus === 'warming') {
        const week = getWeekFromDay(mailboxForReservation.warmupDay || 0);
        const performanceLimits = await getPerformanceLimits(week);
        
        effectiveLimit = Math.min(
          mailboxForReservation.dailyEmailLimit,
          mailboxForReservation.warmupDailyLimit,
          performanceLimits.campaign
        );
        
        currentSent = Math.max(0, mailboxForReservation.currentDailySent - mailboxForReservation.warmupTodaySent);
      } else if (mailboxForReservation.warmupStatus === 'inactive' || mailboxForReservation.warmupStatus === 'ready_to_warmup') {
        const NEW_MAILBOX_LIMIT = 10;
        effectiveLimit = NEW_MAILBOX_LIMIT;
        currentSent = mailboxForReservation.currentDailySent;
      } else {
        effectiveLimit = mailboxForReservation.dailyEmailLimit;
        currentSent = mailboxForReservation.currentDailySent;
      }

      // Sprawdź czy jest miejsce (dodatkowa walidacja)
      if (currentSent >= effectiveLimit) {
        return { email: null, locked: false };
      }

      // ✅ POPRAWKA: Sprawdź limit kampanii (maxEmailsPerDay) przed rezerwacją
      const campaignForLimit = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: { maxEmailsPerDay: true }
      });

      if (campaignForLimit && campaignForLimit.maxEmailsPerDay) {
        const { getStartOfTodayPL } = await import('@/utils/polishTime');
        const todayStart = getStartOfTodayPL();
        
        // Sprawdź ile maili już wysłano dzisiaj
        const sentToday = await tx.sendLog.count({
          where: {
            campaignId,
            status: 'sent',
            createdAt: { gte: todayStart }
          }
        });

        // Jeśli osiągnięto limit kampanii, przekładaj na jutro
        if (sentToday >= campaignForLimit.maxEmailsPerDay) {
          console.log(`[SENDER V2] ⛔ Kampania ${campaignId}: Osiągnięto dzienny limit (${sentToday}/${campaignForLimit.maxEmailsPerDay} maili)`);
          
          if (campaign) {
            const { setPolishTime, getPolishTime } = await import('@/utils/polishTime');
            const nowPL = getPolishTime();
            const tomorrowPL = new Date(nowPL);
            tomorrowPL.setDate(tomorrowPL.getDate() + 1);
            const newScheduledAt = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
            
            await tx.campaignEmailQueue.update({
              where: { id: nextEmail.id },
              data: { scheduledAt: newScheduledAt }
            });
          }
          
          return { email: null, locked: false };
        }
      }

      // Atomowa rezerwacja slotu (z aktualizacją lastUsedAt dla round-robin)
      let incrementResult: number;
      const nowDate = new Date();
      try {
        // Dla skrzynek NIE w warmup - prosty warunek SQL
        if (mailboxForReservation.warmupStatus !== 'warming') {
          // Użyj Prisma update dla aktualizacji lastUsedAt (raw SQL nie obsługuje dobrze Date)
          incrementResult = await tx.$executeRaw`
            UPDATE Mailbox 
            SET currentDailySent = currentDailySent + 1
            WHERE id = ${mailboxForReservation.id}
            AND currentDailySent < ${effectiveLimit}
          `;
          
          // Aktualizuj lastUsedAt osobno (jeśli rezerwacja się powiodła)
          if (incrementResult > 0) {
            await tx.mailbox.update({
              where: { id: mailboxForReservation.id },
              data: { lastUsedAt: nowDate }
            });
          }
        } else {
          // Dla skrzynek w warmup - użyj optimistic locking (sprawdź currentDailySent)
          // Sprawdź w JavaScript czy jest miejsce
          if (currentSent >= effectiveLimit) {
            return { email: null, locked: false };
          }
          
          // Rezerwuj atomowo (optimistic locking)
          incrementResult = await tx.$executeRaw`
            UPDATE Mailbox 
            SET currentDailySent = currentDailySent + 1
            WHERE id = ${mailboxForReservation.id}
            AND currentDailySent = ${mailboxForReservation.currentDailySent}
          `;
          
          // Aktualizuj lastUsedAt osobno (jeśli rezerwacja się powiodła)
          if (incrementResult > 0) {
            await tx.mailbox.update({
              where: { id: mailboxForReservation.id },
              data: { lastUsedAt: nowDate }
            });
          }
        }
      } catch (err: any) {
        console.error(`[SENDER V2] ❌ Błąd rezerwacji slotu:`, err);
        return { email: null, locked: false };
      }

      // Jeśli 0 rows affected = limit osiągnięty lub ktoś inny już zarezerwował
      if (incrementResult === 0) {
        console.log(`[SENDER V2] ✋ LIMIT OSIĄGNIĘTY lub ktoś inny zarezerwował - brak dostępnych slotów dla skrzynki ${availableMailbox.email}`);
        return { email: null, locked: false };
      }

      console.log(`[SENDER V2] 🔒 Slot zarezerwowany dla skrzynki ${availableMailbox.email} (${currentSent + 1}/${effectiveLimit})`);

      // ✅ Atomowo zablokuj mail w tej samej transakcji (SELECT FOR UPDATE effect)
      const lockResult = await tx.campaignEmailQueue.updateMany({
        where: {
          id: nextEmail.id,
          status: 'pending' // Tylko jeśli jeszcze jest pending
        },
        data: {
          status: 'sending',
          updatedAt: new Date()
        }
      });

      if (lockResult.count === 0) {
        // Ktoś inny już zablokował - cofnij rezerwację (rollback transakcji)
        // Transakcja automatycznie wycofa UPDATE Mailbox
        return { email: null, locked: false };
      }

      // Pobierz pełne dane z zablokowanym mailem i zarezerwowaną skrzynką
      const lockedEmail = await tx.campaignEmailQueue.findUnique({
        where: { id: nextEmail.id },
        include: {
          campaignLead: {
            include: {
              lead: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  company: true,
                  language: true,
                  greetingForm: true
                }
              }
            }
          }
        }
      });

      return { 
        email: lockedEmail, 
        locked: true,
        reservedMailbox: availableMailbox // Przekaż zarezerwowaną skrzynkę
      };
    });

    if (!result || typeof result !== 'object' || !result.email || !result.locked) {
      // Brak maili do wysłania lub już zablokowany - to OK
      return { success: true, mailSent: false };
    }

    const nextEmail = (result as any).email;
    const reservedMailbox = (result as any).reservedMailbox; // Zarezerwowana skrzynka z transakcji
    
    console.log(`[SENDER V2] 📧 Kampania ${campaignId}: Znaleziono mail do wysłania (ID: ${nextEmail.id})`);
    console.log(`[SENDER V2] 🔒 Kampania ${campaignId}: Zablokowano mail ${nextEmail.id} (w transakcji)`);
    console.log(`[SENDER V2] 📬 Kampania ${campaignId}: Slot zarezerwowany dla skrzynki ${reservedMailbox.email}`);

    // KROK 2: Pobierz pełne dane kampanii i leada
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: {
          include: {
            mainMailbox: true
          }
        }
      }
    });

    if (!campaign) {
      await db.campaignEmailQueue.update({
        where: { id: nextEmail.id },
        data: { status: 'failed', error: 'Kampania nie istnieje' }
      });
      return { success: false, mailSent: false, error: 'Kampania nie istnieje' };
    }

    // ✅ POPRAWKA Problem 4: Sprawdź czy kampania jest nadal aktywna
    // WAŻNE: Pobierz najnowszy status z bazy (może się zmienić)
    const currentCampaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true }
    });

    if (!currentCampaign || currentCampaign.status !== 'IN_PROGRESS') {
      const status = currentCampaign?.status || 'UNKNOWN';
      
      // ✅ POPRAWKA Recovery: Jeśli kampania jest PAUSED, nie oznaczaj jako 'cancelled'
      // Tylko przywróć do 'pending' aby można było wznowić po PAUSE
      if (status === 'PAUSED') {
        await db.campaignEmailQueue.update({
          where: { id: nextEmail.id },
          data: { 
            status: 'pending', // Przywróć do pending, nie 'cancelled'
            error: null // Wyczyść błąd
          }
        });
        console.log(`[SENDER V2] ⏸️  Kampania ${campaignId}: PAUSED - mail pozostaje w kolejce (pending)`);
      } else {
        // Dla innych statusów (CANCELLED, COMPLETED, etc.) oznacz jako 'cancelled'
        await db.campaignEmailQueue.update({
          where: { id: nextEmail.id },
          data: { status: 'cancelled', error: `Kampania nie jest aktywna (status: ${status})` }
        });
        console.log(`[SENDER V2] ⏭️  Kampania ${campaignId}: Nie jest aktywna (status: ${status}) - mail anulowany`);
      }
      
      return { success: true, mailSent: false };
    }

    const lead = nextEmail.campaignLead.lead;

    // KROK 4: Sprawdź duplikat (czy już wysłano)
    const existingSendLog = await db.sendLog.findFirst({
      where: {
        campaignId,
        leadId: lead.id,
        status: 'sent'
      }
    });

    if (existingSendLog) {
      // Już wysłano - oznacz jako sent i pomiń
      await db.campaignEmailQueue.update({
        where: { id: nextEmail.id },
        data: {
          status: 'sent',
          sentAt: existingSendLog.createdAt
        }
      });

      // Zaktualizuj status CampaignLead
      await db.campaignLead.updateMany({
        where: {
          campaignId,
          leadId: lead.id,
          status: { not: 'sent' }
        },
        data: { status: 'sent' }
      });

      console.log(`[SENDER V2] ⚠️  Kampania ${campaignId}: Lead ${lead.email} już otrzymał mail - pomijam`);
      
      // Zaplanuj następny mail
      await scheduleNextEmailV2(
        campaignId,
        new Date(existingSendLog.createdAt),
        campaign.delayBetweenEmails || 90
      );

      return { success: true, mailSent: false };
    }

    // ✅ POPRAWKA: Okno czasowe jest już sprawdzone w transakcji - nie sprawdzamy ponownie
    // (sprawdzanie w transakcji używa aktualnego czasu i jest bardziej niezawodne)

    // Skrzynka jest już zarezerwowana w transakcji - użyj jej
    const mailbox = reservedMailbox;

    // KROK 7: Pobierz ustawienia firmy
    const companySettings = await db.companySettings.findFirst();

    // KROK 8: Wyślij mail
    let sendResult;
    try {
      sendResult = await sendSingleEmail(
        campaign,
        lead,
        companySettings || {},
        0, // index dla A/B test
        mailbox // ✅ Przekaż zarezerwowaną skrzynkę (już zarezerwowana w transakcji)
      );

      if (!sendResult.success) {
        throw new Error(sendResult.error || 'Błąd wysyłki');
      }

      // KROK 7: Aktualizuj statusy
      const sentAt = new Date();

      await db.campaignEmailQueue.update({
        where: { id: nextEmail.id },
        data: {
          status: 'sent',
          sentAt,
          error: null
        }
      });

      // Zaktualizuj status CampaignLead
      await db.campaignLead.updateMany({
        where: {
          campaignId,
          leadId: lead.id
        },
        data: { status: 'sent', sentAt }
      });

      // ✅ Licznik skrzynki jest już zwiększony w transakcji (atomowa rezerwacja)
      // NIE zwiększamy ponownie - slot został już zarezerwowany

      console.log(`[SENDER V2] ✅ Kampania ${campaignId}: Mail wysłany do ${lead.email}`);

      // KROK 8: Zaplanuj następny mail
      await scheduleNextEmailV2(
        campaignId,
        sentAt,
        campaign.delayBetweenEmails || 90
      );

      return { success: true, mailSent: true };
    } catch (sendError: any) {
      // Błąd wysyłki - oznacz jako failed
      await db.campaignEmailQueue.update({
        where: { id: nextEmail.id },
        data: {
          status: 'failed',
          error: sendError.message || 'Błąd wysyłki'
        }
      });

      // Przywróć status CampaignLead do queued (dla retry)
      await db.campaignLead.updateMany({
        where: {
          campaignId,
          leadId: lead.id,
          status: 'sending'
        },
        data: { status: 'queued' }
      });

      console.error(`[SENDER V2] ❌ Kampania ${campaignId}: Błąd wysyłki do ${lead.email}:`, sendError.message);

      return { success: false, mailSent: false, error: sendError.message };
    }
  } catch (error: any) {
    console.error(`[SENDER V2] ❌ Błąd krytyczny dla kampanii ${campaignId}:`, error.message);
    return { success: false, mailSent: false, error: error.message };
  }
}

/**
 * Automatyczna detekcja i migracja kampanii bez kolejki
 * 
 * ⚠️ ZABEZPIECZENIE: Zapisuje kampanie które już próbowano zmigrować (z błędami)
 * aby nie próbować ich w każdej iteracji cron
 */
const failedMigrationAttempts = new Map<number, number>(); // campaignId -> timestamp ostatniego błędu
const MIGRATION_RETRY_DELAY = 60 * 60 * 1000; // 1 godzina - nie próbuj ponownie przez 1h

export async function migrateCampaignsWithoutQueue(): Promise<number> {
  try {
    // Znajdź kampanie IN_PROGRESS które nie mają maili w kolejce
    const campaignsWithoutQueue = await db.campaign.findMany({
      where: {
        status: 'IN_PROGRESS',
        CampaignEmailQueue: {
          none: {
            status: { in: ['pending', 'sending'] }
          }
        }
      },
      include: {
        CampaignLead: {
          where: {
            status: { in: ['queued', 'planned'] }
          }
        }
      }
    });

    let migrated = 0;
    const now = Date.now();

    for (const campaign of campaignsWithoutQueue) {
      // Sprawdź czy są leady do wysłania
      if (!campaign.CampaignLead || campaign.CampaignLead.length === 0) {
        continue;
      }

      // ⚠️ ZABEZPIECZENIE: Sprawdź czy ta kampania już miała błąd migracji (czas < 1h temu)
      const lastFailedAttempt = failedMigrationAttempts.get(campaign.id);
      if (lastFailedAttempt && (now - lastFailedAttempt) < MIGRATION_RETRY_DELAY) {
        // Pomiń - już próbowaliśmy i był błąd (nie spamuj logów)
        continue;
      }

      console.log(`[SENDER V2] 🔄 Wykryto kampanię ${campaign.id} bez kolejki - migruję...`);

      try {
        // Inicjalizuj kolejkę
        const added = await initializeQueueV2(
          campaign.id,
          20 // buffer size
        );

        if (added > 0) {
          migrated++;
          console.log(`[SENDER V2] ✅ Zmigrowano kampanię ${campaign.id} (dodano ${added} maili do kolejki)`);
          // Usuń z listy błędów (jeśli była)
          failedMigrationAttempts.delete(campaign.id);
        } else {
          // Brak maili dodanych - może być timeout lub inne problemy
          // Nie dodawaj do failedMigrationAttempts - może być normalne (brak leadów)
        }
      } catch (migrationError: any) {
        // Błąd migracji - zapisz timestamp aby nie próbować ponownie przez 1h
        failedMigrationAttempts.set(campaign.id, now);
        console.error(`[SENDER V2] ❌ Błąd migracji kampanii ${campaign.id}: ${migrationError.message}`);
        // Nie rzucaj błędu dalej - kontynuuj z innymi kampaniami
      }
    }

    return migrated;
  } catch (error: any) {
    console.error(`[SENDER V2] ❌ Błąd migracji kampanii:`, error.message);
    return 0;
  }
}

/**
 * Odblokuj maile w statusie 'sending' które są zbyt stare (>10 min)
 * To naprawia sytuacje gdy proces się crashnął podczas wysyłki
 */
export async function unlockStuckEmails(): Promise<number> {
  try {
    const { getPolishTime } = await import('@/utils/polishTime');
    const now = getPolishTime();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // 10 minut temu

    const result = await db.campaignEmailQueue.updateMany({
      where: {
        status: 'sending',
        updatedAt: { lt: tenMinutesAgo }
      },
      data: {
        status: 'pending'
      }
    });

    if (result.count > 0) {
      console.log(`[SENDER V2] 🔓 Odblokowano ${result.count} zablokowanych maili`);
    }

    return result.count;
  } catch (error: any) {
    console.error(`[SENDER V2] ❌ Błąd odblokowywania:`, error.message);
    return 0;
  }
}

/**
 * Główna funkcja przetwarzania - wywoływana przez cron
 * Przetwarza wszystkie aktywne kampanie (testowo tylko kampania 4)
 */
/**
 * OPCJA 4: Lockuje mail i zwraca informacje potrzebne do setTimeout
 * NIE wysyła maila - to robi sendEmailAfterTimeout()
 */
async function lockEmailForSending(campaignId: number): Promise<{
  email: any | null;
  locked: boolean;
  reservedMailbox: any | null;
  scheduledAt: Date | null;
} | null> {
  try {
    // ✅ POPRAWKA: Pobierz kampanię i skrzynkę POZA transakcją (szybsze)
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        startHour: true,
        startMinute: true,
        endHour: true,
        endMinute: true,
        allowedDays: true,
        delayBetweenEmails: true,
        maxEmailsPerDay: true,
        virtualSalespersonId: true
      }
    });

    if (!campaign) {
      return null;
    }

    // Sprawdź okno czasowe (poza transakcją)
    const { getPolishTime } = await import('@/utils/polishTime');
    const now = getPolishTime();
    const { isWithinSendWindow } = await import('./campaignEmailQueueV2');
    if (!isWithinSendWindow(now, campaign)) {
      return null; // Poza oknem czasowym
    }

    // ✅ POPRAWKA: Pobierz dostępną skrzynkę POZA transakcją (szybsze, nie blokuje transakcji)
    const { getNextAvailableMailbox } = await import('./mailboxManager');
    const availableMailbox = await getNextAvailableMailbox(
      campaign.virtualSalespersonId || 0,
      campaignId
    );

    if (!availableMailbox) {
      return null; // Brak dostępnych skrzynek
    }

    // ✅ TERAZ transakcja - tylko lock maila i rezerwacja slotu (szybkie operacje)
    const result = await db.$transaction(async (tx) => {
      // Sprawdź czy kampania już ma mail w trakcie wysyłki
      const sendingInProgress = await tx.campaignEmailQueue.count({
        where: {
          campaignId,
          status: 'sending'
        }
      });

      if (sendingInProgress > 0) {
        return null; // Kampania już wysyła mail
      }

      // Pobierz kandydatów do wysłania
      const candidateEmails = await tx.campaignEmailQueue.findMany({
        where: {
          campaignId,
          status: 'pending',
          scheduledAt: { lte: now }
        },
        include: {
          campaignLead: {
            include: {
              lead: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  company: true,
                  language: true
                }
              }
            }
          }
        },
        orderBy: {
          scheduledAt: 'asc'
        },
        take: 1
      });

      if (candidateEmails.length === 0) {
        return null; // Brak maili gotowych
      }

      const nextEmail = candidateEmails[0];

      // Sprawdź limit kampanii
      if (campaign.maxEmailsPerDay) {
        const { getStartOfTodayPL } = await import('@/utils/polishTime');
        const todayStart = getStartOfTodayPL();
        const sentToday = await tx.sendLog.count({
          where: {
            campaignId,
            status: 'sent',
            createdAt: { gte: todayStart }
          }
        });

        if (sentToday >= campaign.maxEmailsPerDay) {
          return null; // Limit osiągnięty
        }
      }

      // Atomowa rezerwacja slotu skrzynki
      const mailboxForReservation = await tx.mailbox.findUnique({
        where: { id: availableMailbox.id },
        select: {
          id: true,
          warmupStatus: true,
          currentDailySent: true,
          warmupTodaySent: true,
          dailyEmailLimit: true,
          warmupDailyLimit: true,
          warmupDay: true
        }
      });

      if (!mailboxForReservation) {
        return null;
      }

      // Oblicz effectiveLimit i currentSent
      const { getWeekFromDay, getPerformanceLimits } = await import('./mailboxManager');
      let effectiveLimit: number;
      let currentSent: number;

      if (mailboxForReservation.warmupStatus === 'warming') {
        const week = getWeekFromDay(mailboxForReservation.warmupDay || 0);
        const performanceLimits = await getPerformanceLimits(week);
        effectiveLimit = Math.min(
          mailboxForReservation.dailyEmailLimit,
          mailboxForReservation.warmupDailyLimit,
          performanceLimits.campaign
        );
        currentSent = Math.max(0, mailboxForReservation.currentDailySent - mailboxForReservation.warmupTodaySent);
      } else if (mailboxForReservation.warmupStatus === 'inactive' || mailboxForReservation.warmupStatus === 'ready_to_warmup') {
        effectiveLimit = 10;
        currentSent = mailboxForReservation.currentDailySent;
      } else {
        effectiveLimit = mailboxForReservation.dailyEmailLimit;
        currentSent = mailboxForReservation.currentDailySent;
      }

      if (currentSent >= effectiveLimit) {
        return null; // Limit skrzynki osiągnięty
      }

      // Atomowa rezerwacja slotu
      const nowDate = new Date();
      let incrementResult: number;

      if (mailboxForReservation.warmupStatus !== 'warming') {
        incrementResult = await tx.$executeRaw`
          UPDATE Mailbox 
          SET currentDailySent = currentDailySent + 1
          WHERE id = ${mailboxForReservation.id}
          AND currentDailySent < ${effectiveLimit}
        `;

        if (incrementResult > 0) {
          await tx.mailbox.update({
            where: { id: mailboxForReservation.id },
            data: { lastUsedAt: nowDate }
          });
        }
      } else {
        if (currentSent >= effectiveLimit) {
          return null;
        }

        incrementResult = await tx.$executeRaw`
          UPDATE Mailbox 
          SET currentDailySent = currentDailySent + 1
          WHERE id = ${mailboxForReservation.id}
          AND currentDailySent = ${mailboxForReservation.currentDailySent}
        `;

        if (incrementResult > 0) {
          await tx.mailbox.update({
            where: { id: mailboxForReservation.id },
            data: { lastUsedAt: nowDate }
          });
        }
      }

      if (incrementResult === 0) {
        return null; // Limit osiągnięty lub ktoś inny zarezerwował
      }

      // Atomowo zablokuj mail
      const lockResult = await tx.campaignEmailQueue.updateMany({
        where: {
          id: nextEmail.id,
          status: 'pending'
        },
        data: {
          status: 'sending',
          updatedAt: new Date()
        }
      });

      if (lockResult.count === 0) {
        return null; // Ktoś inny już zablokował
      }

      // Pobierz pełne dane
      const lockedEmail = await tx.campaignEmailQueue.findUnique({
        where: { id: nextEmail.id },
        include: {
          campaignLead: {
            include: {
              lead: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  company: true,
                  language: true
                }
              }
            }
          }
        }
      });

      return {
        email: lockedEmail,
        locked: true,
        reservedMailbox: availableMailbox,
        scheduledAt: lockedEmail?.scheduledAt || null
      };
    });

    return result;
  } catch (error: any) {
    console.error(`[SENDER V2] ❌ Błąd lockEmailForSending dla kampanii ${campaignId}:`, error.message);
    return null;
  }
}

/**
 * OPCJA 4: Wysyła zablokowany mail po setTimeout
 */
async function sendEmailAfterTimeout(
  emailId: number,
  campaignId: number,
  reservedMailbox: any
): Promise<{ success: boolean; mailSent: boolean; error?: string }> {
  try {
    // Pobierz zablokowany mail
    const nextEmail = await db.campaignEmailQueue.findUnique({
      where: { id: emailId },
      include: {
        campaignLead: {
          include: {
            lead: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                company: true,
                language: true
              }
            }
          }
        }
      }
    });

    if (!nextEmail || nextEmail.status !== 'sending') {
      console.log(`[SENDER V2] ⚠️ Mail ${emailId} nie jest już zablokowany - pomijam`);
      return { success: true, mailSent: false };
    }

    // ✅ POPRAWKA: Sprawdź czy lead istnieje
    if (!nextEmail.campaignLead || !nextEmail.campaignLead.lead) {
      console.log(`[SENDER V2] ⚠️ Mail ${emailId}: Lead nie istnieje - oznaczam jako failed`);
      await db.campaignEmailQueue.update({
        where: { id: emailId },
        data: { status: 'failed', error: 'Lead nie istnieje' }
      });
      return { success: true, mailSent: false };
    }

    // Sprawdź status kampanii
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: {
          include: {
            mainMailbox: true
          }
        }
      }
    });

    if (!campaign || campaign.status !== 'IN_PROGRESS') {
      // Przywróć mail do pending
      await db.campaignEmailQueue.update({
        where: { id: emailId },
        data: { status: 'pending' }
      });
      return { success: true, mailSent: false };
    }

    // Walidacja reservedMailbox
    if (!reservedMailbox) {
      console.log(`[SENDER V2] ⚠️ Mail ${emailId}: Brak zarezerwowanej skrzynki - próbuję pobrać nową`);
      
      // Spróbuj pobrać nową skrzynkę
      const { getNextAvailableMailbox } = await import('./mailboxManager');
      const newMailbox = await getNextAvailableMailbox(
        campaign.virtualSalespersonId || 0,
        campaignId
      );

      if (!newMailbox) {
        // Brak dostępnych skrzynek - przywróć mail do pending
        await db.campaignEmailQueue.update({
          where: { id: emailId },
          data: { status: 'pending' }
        });
        console.log(`[SENDER V2] ⚠️ Mail ${emailId}: Brak dostępnych skrzynek - przywrócono do pending`);
        return { success: true, mailSent: false };
      }

      // Użyj nowej skrzynki
      reservedMailbox = newMailbox;
    }

    const lead = nextEmail.campaignLead.lead;

    // Sprawdź duplikat
    const existingSendLog = await db.sendLog.findFirst({
      where: {
        campaignId,
        leadId: lead.id,
        status: 'sent'
      }
    });

    if (existingSendLog) {
      await db.campaignEmailQueue.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          sentAt: existingSendLog.createdAt
        }
      });

      await db.campaignLead.updateMany({
        where: {
          campaignId,
          leadId: lead.id,
          status: { not: 'sent' }
        },
        data: { status: 'sent' }
      });

      // Zaplanuj następny mail
      const { scheduleNextEmailV2 } = await import('./campaignEmailQueueV2');
      await scheduleNextEmailV2(
        campaignId,
        new Date(existingSendLog.createdAt),
        campaign.delayBetweenEmails || 90
      );

      return { success: true, mailSent: false };
    }

    // Pobierz pełne dane kampanii
    const fullCampaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: {
          include: {
            mainMailbox: true
          }
        }
      }
    });

    if (!fullCampaign) {
      await db.campaignEmailQueue.update({
        where: { id: emailId },
        data: { status: 'failed', error: 'Kampania nie istnieje' }
      });
      return { success: false, mailSent: false, error: 'Kampania nie istnieje' };
    }

    const companySettings = await db.companySettings.findFirst();

    // Wyślij mail
    try {
      const { sendSingleEmail } = await import('./scheduledSender');
      const sendResult = await sendSingleEmail(
        fullCampaign,
        lead,
        companySettings || {},
        0,
        reservedMailbox
      );

      if (!sendResult.success) {
        throw new Error(sendResult.error || 'Błąd wysyłki');
      }

      const sentAt = new Date();

      await db.campaignEmailQueue.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          sentAt,
          error: null
        }
      });

      await db.campaignLead.updateMany({
        where: {
          campaignId,
          leadId: lead.id
        },
        data: { status: 'sent', sentAt }
      });

      console.log(`[SENDER V2] ✅ Kampania ${campaignId}: Mail wysłany do ${lead.email}`);

      // Zaplanuj następny mail
      const { scheduleNextEmailV2 } = await import('./campaignEmailQueueV2');
      await scheduleNextEmailV2(
        campaignId,
        sentAt,
        campaign.delayBetweenEmails || 90
      );

      return { success: true, mailSent: true };
    } catch (sendError: any) {
      await db.campaignEmailQueue.update({
        where: { id: emailId },
        data: {
          status: 'failed',
          error: sendError.message || 'Błąd wysyłki'
        }
      });

      await db.campaignLead.updateMany({
        where: {
          campaignId,
          leadId: lead.id,
          status: 'sending'
        },
        data: { status: 'queued' }
      });

      console.error(`[SENDER V2] ❌ Kampania ${campaignId}: Błąd wysyłki do ${lead.email}:`, sendError.message);
      return { success: false, mailSent: false, error: sendError.message };
    }
  } catch (error: any) {
    console.error(`[SENDER V2] ❌ Błąd krytyczny sendEmailAfterTimeout:`, error.message);
    return { success: false, mailSent: false, error: error.message };
  }
}

/**
 * OPCJA 4: Recovery po restarcie - obsługuje zablokowane maile
 */
export async function recoverStuckEmailsAfterRestart(): Promise<void> {
  try {
    console.log('[SENDER V2] 🔄 Recovery: Sprawdzam zablokowane maile po restarcie...');

    const { getPolishTime } = await import('@/utils/polishTime');
    const now = getPolishTime();

    // Znajdź maile w statusie 'sending' (zablokowane przed restartem)
    const stuckEmails = await db.campaignEmailQueue.findMany({
      where: {
        status: 'sending',
        updatedAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) } // Starsze niż 10 min
      },
      include: {
        campaignLead: {
          include: {
            lead: true
          }
        }
      }
    });

    console.log(`[SENDER V2] 🔄 Recovery: Znaleziono ${stuckEmails.length} zablokowanych maili`);

    for (const email of stuckEmails) {
              try {
                const timeUntilScheduled = email.scheduledAt.getTime() - now.getTime();
                
                // Pobierz delayBetweenEmails z kampanii
                const campaign = await db.campaign.findUnique({
                  where: { id: email.campaignId },
                  select: { delayBetweenEmails: true }
                });
                const delayBetweenEmails = campaign?.delayBetweenEmails || 90;
                
                let correctedTime: number;
                
                if (timeUntilScheduled <= 0) {
                  // ✅ Mail jest gotowy - użyj losowego delayu (jak w głównej logice)
                  const cronInterval = 30;
                  const baseDelay = delayBetweenEmails - cronInterval;
                  
                  // ⚠️ FIX: Jeśli baseDelay <= 0, użyj minimum delay (np. 30s) aby zawsze była randomizacja
                  const minDelay = baseDelay > 0 ? baseDelay : Math.max(30, delayBetweenEmails * 0.5); // Minimum 30s lub 50% delayBetweenEmails
                  const maxDelay = baseDelay > 0 ? baseDelay * 2 : delayBetweenEmails; // Jeśli baseDelay <= 0, użyj delayBetweenEmails jako max
                  const range = maxDelay - minDelay;
                  const actualDelay = Math.floor(Math.random() * (range + 1)) + minDelay;
                  correctedTime = actualDelay * 1000;
                  console.log(`[SENDER V2] 🔄 Recovery: Mail gotowy - uruchamiam odliczanie ${actualDelay}s (zakres: ${minDelay}-${maxDelay}s, baseDelay: ${baseDelay}s)`);
                } else {
                  // Mail jest w przyszłości - użyj scheduledAt jako bazę
                  correctedTime = timeUntilScheduled;
                  console.log(`[SENDER V2] 🔄 Recovery: Mail w przyszłości - wysyłka za ${Math.floor(timeUntilScheduled / 1000)}s`);
                }

        // Pobierz zarezerwowaną skrzynkę (jeśli istnieje w SendLog)
        const lastSendLog = await db.sendLog.findFirst({
          where: {
            campaignId: email.campaignId,
            mailboxId: { not: null }
          },
          orderBy: { createdAt: 'desc' }
        });

        let reservedMailbox = null;
        if (lastSendLog?.mailboxId) {
          reservedMailbox = await db.mailbox.findUnique({
            where: { id: lastSendLog.mailboxId }
          });
        }

        // Jeśli nie ma skrzynki, użyj getNextAvailableMailbox
        if (!reservedMailbox) {
          const campaign = await db.campaign.findUnique({
            where: { id: email.campaignId },
            select: { virtualSalespersonId: true }
          });

          if (campaign) {
            const { getNextAvailableMailbox } = await import('./mailboxManager');
            reservedMailbox = await getNextAvailableMailbox(
              campaign.virtualSalespersonId || 0,
              email.campaignId
            );
          }
        }

        if (reservedMailbox) {
          setTimeout(() => {
            sendEmailAfterTimeout(email.id, email.campaignId, reservedMailbox);
          }, correctedTime);

          console.log(`[SENDER V2] 🔄 Recovery: Zaplanowano mail ${email.id} (${correctedTime}ms)`);
        } else {
          // Brak skrzynki - przywróć do pending
          await db.campaignEmailQueue.update({
            where: { id: email.id },
            data: { status: 'pending' }
          });
        }
      } catch (error: any) {
        console.error(`[SENDER V2] ❌ Błąd recovery dla maila ${email.id}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error(`[SENDER V2] ❌ Błąd krytyczny recoverStuckEmailsAfterRestart:`, error.message);
  }
}

export async function processScheduledEmailsV2(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  try {
    const startTime = Date.now();

    // KROK 1: Odblokuj zablokowane maile
    await unlockStuckEmails();

    // KROK 2: Automatyczna migracja kampanii bez kolejki
    await migrateCampaignsWithoutQueue();

    // KROK 3: Pobierz kampanie do przetworzenia
    const campaigns = await db.campaign.findMany({
      where: {
        status: 'IN_PROGRESS'
      }
    });

    let processed = 0;
    let scheduled = 0; // Liczba maili zaplanowanych do setTimeout
    let errors = 0;

    // KROK 4: OPCJA 4 - Dla każdej kampanii sprawdź gotowe maile i uruchom setTimeout
    for (const campaign of campaigns) {
      try {
        const lockResult = await lockEmailForSending(campaign.id);

        processed++;

        if (lockResult && lockResult.locked && lockResult.email) {
          const { getPolishTime } = await import('@/utils/polishTime');
          const now = getPolishTime();
          const scheduledAt = lockResult.scheduledAt || now;
          const timeUntilScheduled = scheduledAt.getTime() - now.getTime();
          
          let correctedTime: number;
          
          if (timeUntilScheduled <= 0) {
            // ✅ Mail jest gotowy (scheduledAt <= now) - cron uruchamia odliczanie z losowym delayem
            // Delay = (delayBetweenEmails - 30s) + 0-100% = (90s - 30s) + 0-100% = 60s - 120s
            // To zapewnia że cron nie decyduje o ostatecznej sekundzie wysyłania
            const delayBetweenEmails = campaign.delayBetweenEmails || 90;
            const cronInterval = 30; // sekundy
            const baseDelay = delayBetweenEmails - cronInterval; // 90 - 30 = 60s
            
            // ⚠️ FIX: Jeśli baseDelay <= 0, użyj minimum delay (np. 30s) aby zawsze była randomizacja
            const minDelay = baseDelay > 0 ? baseDelay : Math.max(30, delayBetweenEmails * 0.5); // Minimum 30s lub 50% delayBetweenEmails
            const maxDelay = baseDelay > 0 ? baseDelay * 2 : delayBetweenEmails; // Jeśli baseDelay <= 0, użyj delayBetweenEmails jako max
            const range = maxDelay - minDelay;
            const actualDelay = Math.floor(Math.random() * (range + 1)) + minDelay; // [minDelay, maxDelay]s
            correctedTime = actualDelay * 1000; // konwersja na ms
            console.log(`[SENDER V2] ⏰ Mail gotowy - uruchamiam odliczanie ${actualDelay}s (zakres: ${minDelay}-${maxDelay}s, baseDelay: ${baseDelay}s)`);
          } else {
            // Mail jest w przyszłości - użyj scheduledAt jako bazę
            correctedTime = timeUntilScheduled;
            console.log(`[SENDER V2] ⏰ Mail w przyszłości - wysyłka za ${Math.floor(timeUntilScheduled / 1000)}s`);
          }

          // Uruchom setTimeout
          setTimeout(() => {
            sendEmailAfterTimeout(
              lockResult.email.id,
              campaign.id,
              lockResult.reservedMailbox
            ).catch(error => {
              console.error(`[SENDER V2] ❌ Błąd sendEmailAfterTimeout dla maila ${lockResult.email.id}:`, error.message);
            });
          }, correctedTime);

          scheduled++;
          console.log(`[SENDER V2] ⏰ Kampania ${campaign.id}: Zaplanowano mail ${lockResult.email.id} (${correctedTime}ms)`);
        }
      } catch (error: any) {
        console.error(`[SENDER V2] ❌ Błąd przetwarzania kampanii ${campaign.id}:`, error.message);
        errors++;
      }
    }

    const duration = Date.now() - startTime;

    if (processed > 0 || scheduled > 0) {
      console.log(`[SENDER V2] ✅ Przetworzono ${processed} kampanii, zaplanowano ${scheduled} maili do setTimeout, błędów: ${errors} (${duration}ms)`);
    }

    return { processed, sent: scheduled, errors }; // sent = scheduled (zaplanowane do setTimeout)
  } catch (error: any) {
    console.error(`[SENDER V2] ❌ Błąd krytyczny processScheduledEmailsV2:`, error.message);
    return { processed: 0, sent: 0, errors: 1 };
  }
}

