/**
 * CAMPAIGN EMAIL QUEUE V2 - Nowa wersja kolejki zaplanowanych maili
 * 
 * Zasady:
 * - Prosta logika, atomic operations
 * - Precyzyjne planowanie z scheduledAt
 * - Automatyczne dodawanie następnych maili po wysłaniu
 */

import { db } from "@/lib/db";

/**
 * Oblicza czas następnego maila na podstawie ostatniego wysłanego
 * Z opóźnieniem ± 20%
 */
export function calculateNextEmailTimeV2(
  lastSentTime: Date,
  delayBetweenEmails: number
): Date {
  // Delay = delayBetweenEmails + 0-100% (losowo od bazowego do podwójnego)
  const minDelay = delayBetweenEmails; // 90s (0% dodatku)
  const maxDelay = delayBetweenEmails * 2; // 180s (100% dodatku)
  
  // ✅ Losowy delay w zakresie [minDelay, maxDelay] włącznie
  // Math.random() zwraca [0, 1), więc Math.floor(Math.random() * (range + 1)) daje [0, range]
  // + minDelay daje [minDelay, maxDelay] włącznie
  const range = maxDelay - minDelay;
  const actualDelay = Math.floor(Math.random() * (range + 1)) + minDelay; // [minDelay, maxDelay] włącznie
  
  // Czas następnego maila
  const nextTime = new Date(lastSentTime.getTime() + (actualDelay * 1000));
  
  return nextTime;
}

/**
 * Sprawdza czy czas jest w dozwolonym oknie wysyłki kampanii
 */
export function isWithinSendWindow(
  scheduledTime: Date,
  campaign: {
    startHour: number | null;
    startMinute: number | null;
    endHour: number | null;
    endMinute: number | null;
    allowedDays: string | null;
  }
): boolean {
  // Jeśli brak ustawień okna, pozwól na wysyłkę
  if (!campaign.startHour || !campaign.endHour) {
    return true;
  }

  const now = scheduledTime;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDay = now.getDay(); // 0 = niedziela, 1 = poniedziałek, etc.

  // Sprawdź dzień tygodnia
  if (campaign.allowedDays) {
    const allowedDaysArray = campaign.allowedDays.split(',').map(d => d.trim().toUpperCase());
    // Mapowanie: 0 = niedziela, 1 = poniedziałek, ..., 6 = sobota
    // allowedDays używa formatu: MON, TUE, WED, THU, FRI, SAT, SUN
    const dayMapping: { [key: number]: string } = {
      0: 'SUN', // niedziela
      1: 'MON', // poniedziałek
      2: 'TUE', // wtorek
      3: 'WED', // środa
      4: 'THU', // czwartek
      5: 'FRI', // piątek
      6: 'SAT'  // sobota
    };
    
    const currentDayCode = dayMapping[currentDay];
    
    if (!currentDayCode || !allowedDaysArray.includes(currentDayCode)) {
      return false;
    }
  }

  // Sprawdź godzinę
  const startTimeMinutes = (campaign.startHour || 9) * 60 + (campaign.startMinute || 0);
  const endTimeMinutes = (campaign.endHour || 17) * 60 + (campaign.endMinute || 0);
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  // Sprawdź czy jest w oknie czasowym
  if (currentTimeMinutes < startTimeMinutes || currentTimeMinutes >= endTimeMinutes) {
    return false;
  }

  return true;
}

/**
 * Inicjalizuje kolejkę dla kampanii - dodaje pierwsze maile (bufor)
 */
export async function initializeQueueV2(
  campaignId: number,
  bufferSize: number = 20
): Promise<number> {
  try {
    console.log(`[QUEUE V2] 🚀 Inicjalizacja kolejki dla kampanii ${campaignId} (buffer: ${bufferSize})`);

    // Pobierz kampanię
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: true
      }
    });

    if (!campaign) {
      console.error(`[QUEUE V2] ❌ Kampania ${campaignId} nie istnieje`);
      return 0;
    }

    // Pobierz ostatni wysłany mail (jeśli istnieje)
    const lastSentLog = await db.sendLog.findFirst({
      where: {
        campaignId,
        status: "sent"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    // Określ startowy czas (w polskim czasie)
    const { getPolishTime } = await import('@/utils/polishTime');
    const now = getPolishTime();
    let currentTime: Date;
    
    if (lastSentLog) {
      const lastSentTime = new Date(lastSentLog.createdAt);
      const timeSinceLastMail = Math.floor((now.getTime() - lastSentTime.getTime()) / 1000);
      
      // Jeśli ostatni mail był wysłany więcej niż 10 minut temu - użyj aktualnego czasu
      if (timeSinceLastMail > 600) {
        console.log(`[QUEUE V2] ⚠️ Ostatni mail był ${Math.floor(timeSinceLastMail / 60)} minut temu - używam aktualnego czasu jako bazy`);
        currentTime = now;
      } else {
        // Oblicz następny czas od ostatniego wysłanego
        currentTime = calculateNextEmailTimeV2(
          lastSentTime,
          campaign.delayBetweenEmails || 90
        );
      }
    } else {
      // Pierwszy mail - użyj aktualnego czasu lub scheduledAt kampanii
      currentTime = campaign.scheduledAt && new Date(campaign.scheduledAt) <= now
        ? now
        : (campaign.scheduledAt ? new Date(campaign.scheduledAt) : now);
    }

    // Pobierz leady w statusie 'queued' lub 'planned' które jeszcze nie otrzymały maila
    const sentLeadIds = await db.sendLog.findMany({
      where: {
        campaignId,
        status: "sent"
      },
      select: { leadId: true }
    }).then(logs => new Set(logs.map(l => l.leadId)));

    // Pobierz leady które są już w kolejce (żeby nie duplikować)
    const existingQueueItems = await db.campaignEmailQueue.findMany({
      where: {
        campaignId,
        status: { in: ['pending', 'sending'] }
      },
      include: {
        campaignLead: true
      }
    });
    
    const existingQueueLeadIds = new Set(
      existingQueueItems
        .map(item => item.campaignLead?.leadId)
        .filter((id): id is number => id !== null && id !== undefined)
    );

    // Pobierz leady do dodania
    // Najpierw pobierz wszystkie, potem filtruj w JavaScript (prostsze i bardziej niezawodne)
    const allCampaignLeads = await db.campaignLead.findMany({
      where: {
        campaignId,
        status: { in: ['queued', 'planned'] }
      },
      include: {
        lead: true
      },
      orderBy: {
        priority: 'asc'
      }
    });

    // Filtruj w JavaScript
    const campaignLeads = allCampaignLeads
      .filter(cl => {
        const lead = cl.lead;
        // Nie te które już otrzymały mail
        if (sentLeadIds.has(lead.id)) return false;
        // Nie te które są już w kolejce
        if (existingQueueLeadIds.has(cl.leadId)) return false;
        // Nie zablokowane
        if (lead.status === 'BLOCKED' || lead.isBlocked) return false;
        return true;
      })
      .slice(0, bufferSize); // Ogranicz do bufferSize

    if (campaignLeads.length === 0) {
      console.log(`[QUEUE V2] ℹ️  Brak leadów do dodania do kolejki`);
      return 0;
    }

    // Dodaj leady do kolejki
    let added = 0;
    let nextTime = currentTime;

    // Sprawdź dostępność skrzynek przed planowaniem (wyklucz skrzynki używane przez inne aktywne kampanie)
    const { getNextAvailableMailbox } = await import('./mailboxManager');
    const availableMailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId || 0, campaignId);
    const hasAvailableMailbox = availableMailbox !== null;

    // Jeśli brak dostępnych skrzynek, zaplanuj wszystkie na jutro o startHour (w polskim czasie)
    if (!hasAvailableMailbox) {
      const { setPolishTime, getPolishTime } = await import('@/utils/polishTime');
      const nowPL = getPolishTime();
      const tomorrowPL = new Date(nowPL);
      tomorrowPL.setDate(tomorrowPL.getDate() + 1);
      nextTime = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
      console.log(`[QUEUE V2] ⚠️ Brak dostępnych skrzynek - planuję wszystkie maile na jutro od ${nextTime.toISOString()}`);
    }

    for (const campaignLead of campaignLeads) {
      // Sprawdź czy czas jest w oknie wysyłki
      if (!isWithinSendWindow(nextTime, campaign)) {
        // Jeśli poza oknem, zaplanuj na następny dzień o startHour (w polskim czasie)
        const { setPolishTime, getPolishTime } = await import('@/utils/polishTime');
        const nowPL = getPolishTime();
        const tomorrowPL = new Date(nowPL);
        tomorrowPL.setDate(tomorrowPL.getDate() + 1);
        nextTime = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
      }

      // Jeśli brak dostępnych skrzynek, upewnij się że nextTime jest na jutro
      if (!hasAvailableMailbox && nextTime.getDate() === new Date().getDate()) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(campaign.startHour || 9, campaign.startMinute || 0, 0, 0);
        nextTime = tomorrow;
      }

      // Dodaj do kolejki
      await db.campaignEmailQueue.create({
        data: {
          campaignId,
          campaignLeadId: campaignLead.id,
          scheduledAt: nextTime,
          status: "pending",
          metadata: JSON.stringify({
            leadEmail: campaignLead.lead.email,
            leadId: campaignLead.lead.id,
            calculatedDelay: Math.floor((nextTime.getTime() - (lastSentLog ? new Date(lastSentLog.createdAt).getTime() : now.getTime())) / 1000)
          })
        }
      });

      // Oblicz czas następnego maila
      nextTime = calculateNextEmailTimeV2(
        nextTime,
        campaign.delayBetweenEmails || 90
      );
      added++;
    }

    console.log(`[QUEUE V2] ✅ Dodano ${added} maili do kolejki dla kampanii ${campaignId}`);
    return added;
  } catch (error: any) {
    console.error(`[QUEUE V2] ❌ Błąd inicjalizacji kolejki:`, error.message);
    return 0;
  }
}

/**
 * Pobierz następny mail do wysłania dla kampanii
 */
export async function getNextEmailForCampaign(
  campaignId: number
): Promise<{
  id: number;
  campaignId: number;
  campaignLeadId: number;
  scheduledAt: Date;
  campaignLead: {
    lead: {
      id: number;
      email: string;
      firstName: string | null;
      lastName: string | null;
      company: string | null;
      language: string | null;
    };
  };
} | null> {
  try {
    const { getPolishTime } = await import('@/utils/polishTime');
    const now = getPolishTime();
    
    // ✅ POPRAWKA Recovery: Dynamiczna tolerancja - dłuższa dla recovery po restarcie/pauzie
    // Sprawdź czy są zablokowane maile (po restarcie/recovery)
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const stuckEmailsCount = await db.campaignEmailQueue.count({
      where: {
        campaignId,
        status: 'sending',
        updatedAt: { lt: tenMinutesAgo } // Starsze niż 10 min
      }
    });
    
    // ✅ POPRAWKA Problem 2: Sprawdź ostatni wysłany mail (SendLog) - wykrywa recovery po długich przerwach
    const lastSentLog = await db.sendLog.findFirst({
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
      // Jeśli od ostatniego maila minęło > 1h, to prawdopodobnie recovery po pauzie
      if (timeSinceLastMail > 3600) {
        isRecoveryAfterLongPause = true;
      }
    }
    
    // Jeśli są zablokowane maile LUB długi czas od ostatniego maila = recovery -> dłuższa tolerancja (2h)
    // W przeciwnym razie = normalna sytuacja -> krótka tolerancja (5 min)
    const maxToleranceMinutes = (stuckEmailsCount > 0 || isRecoveryAfterLongPause) ? 120 : 5;
    const maxTolerance = new Date(now.getTime() - maxToleranceMinutes * 60 * 1000);
    
    if (stuckEmailsCount > 0) {
      console.log(`[QUEUE V2] 🔄 Recovery detected: ${stuckEmailsCount} stuck emails, using ${maxToleranceMinutes}min tolerance`);
    } else if (isRecoveryAfterLongPause && lastSentLog) {
      const timeSinceLastMail = Math.floor((now.getTime() - new Date(lastSentLog.createdAt).getTime()) / 60); // minuty
      console.log(`[QUEUE V2] 🔄 Recovery detected: ${timeSinceLastMail} min since last mail, using ${maxToleranceMinutes}min tolerance`);
    }

    // Pobierz kampanię dla sprawdzenia okna czasowego
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        startHour: true,
        startMinute: true,
        endHour: true,
        endMinute: true,
        allowedDays: true
      }
    });

    // ✅ POPRAWKA kolejności: Prisma nie wspiera sortowania przez nested relation
    // ✅ POPRAWKA catch-up: Ograniczamy do 1 maila na cykl cron (aby nie wysyłać zbyt szybko)
    // Pobierz tylko najstarszy mail (limit 10 dla sortowania, potem bierzemy pierwszy)
    const candidateEmails = await db.campaignEmailQueue.findMany({
      where: {
        campaignId,
        status: 'pending',
        scheduledAt: { 
          lte: now, // Tylko maile które już powinny być wysłane
          gte: maxTolerance // ✅ POPRAWKA: Nie wysyłaj maili starszych niż 5 min
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
                language: true
              }
            }
          }
        }
      },
      orderBy: {
        scheduledAt: 'asc' // Najpierw po czasie
      },
      take: 10 // ✅ Ogranicz do 10 najstarszych dla sortowania po priorytecie
    });

    // ✅ Sortuj w JavaScript: najpierw po scheduledAt, potem po priorytecie
    // To zachowuje kolejność leadów nawet gdy przekładamy maile na jutro
    candidateEmails.sort((a, b) => {
      // Najpierw po czasie
      const timeDiff = a.scheduledAt.getTime() - b.scheduledAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      
      // Jeśli ten sam czas, sortuj po priorytecie (niższy priority = wyższy priorytet)
      const priorityA = a.campaignLead?.priority ?? 999;
      const priorityB = b.campaignLead?.priority ?? 999;
      return priorityA - priorityB;
    });

    const nextEmail = candidateEmails[0] || null;

    if (!nextEmail) {
      return null;
    }

    // ✅ NOTE: Filtrowanie w WHERE clause (linia 321) już zapewnia że scheduledAt >= maxTolerance
    // Ten kod był nieosiągalny - usunięty jako redundante

    // ✅ POPRAWKA Problem 2: Sprawdź okno czasowe przed zwróceniem
    if (campaign) {
      const scheduledTime = new Date(nextEmail.scheduledAt);
      
      // Sprawdź czy czas jest w oknie wysyłki
      if (!isWithinSendWindow(scheduledTime, campaign)) {
        // Poza oknem - zaplanuj ponownie na następny dzień o startHour
        const { setPolishTime } = await import('@/utils/polishTime');
        const nowPL = getPolishTime();
        const tomorrowPL = new Date(nowPL);
        tomorrowPL.setDate(tomorrowPL.getDate() + 1);
        const newScheduledAt = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
        
        await db.campaignEmailQueue.update({
          where: { id: nextEmail.id },
          data: {
            scheduledAt: newScheduledAt
          }
        });
        
        console.log(`[QUEUE V2] ⏰ Mail ${nextEmail.id} poza oknem czasowym - zaplanowano ponownie na ${newScheduledAt.toISOString()}`);
        return null; // Nie zwracaj tego maila - będzie zaplanowany na jutro
      }
    }

    return nextEmail;
  } catch (error: any) {
    console.error(`[QUEUE V2] ❌ Błąd pobierania następnego maila:`, error.message);
    return null;
  }
}

/**
 * Atomowo blokuje mail do wysłania (przeciw race conditions)
 */
export async function lockEmail(
  queueId: number
): Promise<boolean> {
  try {
    const result = await db.campaignEmailQueue.updateMany({
      where: {
        id: queueId,
        status: 'pending' // Tylko jeśli jeszcze jest pending
      },
      data: {
        status: 'sending',
        updatedAt: new Date()
      }
    });

    // Jeśli affected > 0, oznacza że udało się zablokować
    return result.count > 0;
  } catch (error: any) {
    console.error(`[QUEUE V2] ❌ Błąd blokowania maila:`, error.message);
    return false;
  }
}

/**
 * Dodaje następny mail do kolejki (po wysłaniu poprzedniego)
 */
export async function scheduleNextEmailV2(
  campaignId: number,
  lastSentTime: Date,
  delayBetweenEmails: number
): Promise<number | null> {
  try {
    // ✅ NOWA FUNKCJONALNOŚĆ: Sprawdź czy to 10. mail DZISIAJ - jeśli tak, dodaj pauzę (10 min + 0-50%)
    // ✅ POPRAWKA: Licz tylko maile wysłane DZISIAJ, nie wszystkie w historii
    const { getStartOfTodayPL } = await import('@/utils/polishTime');
    const startOfToday = getStartOfTodayPL();
    
    const sentCountToday = await db.sendLog.count({
      where: {
        campaignId,
        status: 'sent',
        createdAt: {
          gte: startOfToday // Tylko maile wysłane dzisiaj
        }
      }
    });

    let nextTime = lastSentTime;
    
    // Jeśli to wielokrotność 10 (10, 20, 30, ...) DZISIAJ, dodaj pauzę
    if (sentCountToday > 0 && sentCountToday % 10 === 0) {
      const basePauseMinutes = 10; // 10 minut bazowej pauzy
      const randomVariation = 0.5; // 0-50% randomizacji
      const minPauseMinutes = basePauseMinutes; // 10 min (0% dodatku)
      const maxPauseMinutes = basePauseMinutes * (1 + randomVariation); // 15 min (50% dodatku)
      const pauseRange = maxPauseMinutes - minPauseMinutes;
      const actualPauseMinutes = Math.floor(Math.random() * (pauseRange * 60 + 1)) + (minPauseMinutes * 60); // [600, 900]s
      
      nextTime = new Date(lastSentTime.getTime() + (actualPauseMinutes * 1000));
      console.log(`[QUEUE V2] ⏸️  Pauza co 10 maili: ${sentCountToday} maili wysłanych DZISIAJ, dodaję pauzę ${Math.floor(actualPauseMinutes / 60)} min ${actualPauseMinutes % 60}s (${Math.floor(minPauseMinutes)}-${Math.floor(maxPauseMinutes)} min)`);
    } else {
      // Normalny odstęp między mailami
      nextTime = calculateNextEmailTimeV2(
        lastSentTime,
        delayBetweenEmails
      );
    }

    // ✅ POPRAWKA: Pobierz leady które są już w kolejce (pending/sending) aby je wykluczyć
    const leadsInQueue = await db.campaignEmailQueue.findMany({
      where: {
        campaignId,
        status: { in: ['pending', 'sending'] }
      },
      select: {
        campaignLeadId: true
      }
    });
    const leadsInQueueIds = leadsInQueue.map(e => e.campaignLeadId);

    // ✅ POPRAWKA: Pobierz następny lead z CampaignLead (status = queued) który NIE jest w kolejce
    const nextCampaignLead = await db.campaignLead.findFirst({
      where: {
        campaignId,
        status: "queued",
        // Wyklucz leady które są już w kolejce
        ...(leadsInQueueIds.length > 0 ? {
          id: { notIn: leadsInQueueIds }
        } : {}),
        lead: {
          status: { not: "BLOCKED" },
          isBlocked: false
        }
      },
      include: {
        lead: true
      },
      orderBy: {
        priority: "asc"
      }
    });

    if (!nextCampaignLead) {
      console.log(`[QUEUE V2] ℹ️  Brak więcej leadów w kolejce dla kampanii ${campaignId}`);
      return null;
    }

    // ✅ POPRAWKA Problem 5: Sprawdź czy lead już otrzymał mail (SendLog)
    const existingSendLog = await db.sendLog.findFirst({
      where: {
        campaignId,
        leadId: nextCampaignLead.lead.id,
        status: 'sent'
      }
    });

    if (existingSendLog) {
      console.log(`[QUEUE V2] ⚠️  Lead ${nextCampaignLead.lead.email} już otrzymał mail - pomijam`);
      // Zaktualizuj status CampaignLead
      await db.campaignLead.updateMany({
        where: {
          campaignId,
          leadId: nextCampaignLead.lead.id,
          status: { not: 'sent' }
        },
        data: { status: 'sent' }
      });
      return null;
    }

    // ✅ Sprawdzenie czy już jest w kolejce jest teraz niepotrzebne (już wykluczone w zapytaniu)
    // Ale zostawiamy jako dodatkowe zabezpieczenie
    const existing = await db.campaignEmailQueue.findFirst({
      where: {
        campaignId,
        campaignLeadId: nextCampaignLead.id,
        status: { in: ['pending', 'sending'] }
      }
    });

    if (existing) {
      console.log(`[QUEUE V2] ⚠️  Lead ${nextCampaignLead.lead.email} już jest w kolejce (double-check)`);
      return null;
    }

    // Pobierz kampanię dla ustawień okna czasowego
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        startHour: true,
        startMinute: true,
        endHour: true,
        endMinute: true,
        allowedDays: true
      }
    });

    if (!campaign) {
      return null;
    }

    // Użyj obliczony nextTime (z pauzą jeśli potrzeba) lub oblicz normalny odstęp
    let scheduledAt = nextTime;

    // Sprawdź czy czas jest w oknie wysyłki
    if (!isWithinSendWindow(scheduledAt, campaign)) {
      // Jeśli poza oknem, zaplanuj na następny dzień o startHour
      const tomorrow = new Date(scheduledAt);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(campaign.startHour || 9, campaign.startMinute || 0, 0, 0);
      scheduledAt = tomorrow;
    }

    // Dodaj do kolejki
    const queueEntry = await db.campaignEmailQueue.create({
      data: {
        campaignId,
        campaignLeadId: nextCampaignLead.id,
        scheduledAt,
        status: "pending",
        metadata: JSON.stringify({
          leadEmail: nextCampaignLead.lead.email,
          leadId: nextCampaignLead.lead.id,
          calculatedDelay: Math.floor((scheduledAt.getTime() - lastSentTime.getTime()) / 1000)
        })
      }
    });

    console.log(`[QUEUE V2] ✅ Zaplanowano mail dla ${nextCampaignLead.lead.email} na ${scheduledAt.toISOString()}`);

    return queueEntry.id;
  } catch (error: any) {
    console.error(`[QUEUE V2] ❌ Błąd dodawania do kolejki:`, error.message);
    return null;
  }
}

/**
 * Cleanup - usuwa stare wpisy z kolejki (sent/failed starsze niż 24h)
 */
export async function cleanupCampaignQueueV2(): Promise<number> {
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const result = await db.campaignEmailQueue.deleteMany({
      where: {
        status: { in: ['sent', 'failed'] },
        updatedAt: { lt: oneDayAgo }
      }
    });

    console.log(`[QUEUE V2] 🧹 Usunięto ${result.count} starych wpisów z kolejki`);
    return result.count;
  } catch (error: any) {
    console.error(`[QUEUE V2] ❌ Błąd cleanup:`, error.message);
    return 0;
  }
}

