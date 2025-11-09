import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/campaigns/[id]/sending-info
 * Pobiera szczegółowe informacje o wysyłce kampanii
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);

    if (isNaN(campaignId)) {
      return NextResponse.json(
        { success: false, error: 'Nieprawidłowe ID kampanii' },
        { status: 400 }
      );
    }

    // Pobierz kampanię
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Kampania nie istnieje' },
        { status: 404 }
      );
    }

    // Data dzisiaj
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Pobierz ostatnie 5 wysłanych maili
    const lastSentLogs = await db.sendLog.findMany({
      where: {
        campaignId,
        status: 'sent'
      },
      select: {
        id: true,
        createdAt: true,
        lead: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 15
    });

    // Oblicz odstępy między mailami (pierwszy jest najnowszy, więc obliczamy odstęp do poprzedniego)
    // Odwróć kolejność - od najstarszego do najnowszego
    const reversedLogs = [...lastSentLogs].reverse();
    const emailsWithIntervals = reversedLogs.map((log, index) => {
      if (index === 0) {
        return {
          ...log,
          intervalSeconds: null as number | null
        };
      }
      const prevLog = reversedLogs[index - 1];
      // Oblicz odstęp: nowszy - starszy (dodatni)
      const interval = Math.floor((new Date(log.createdAt).getTime() - new Date(prevLog.createdAt).getTime()) / 1000);
      return {
        ...log,
        intervalSeconds: interval
      };
    });
    // Odwróć z powrotem, aby najnowszy był pierwszy
    emailsWithIntervals.reverse();

    // Pobierz liczbę leadów w kolejce dzisiaj
    const queuedToday = await db.campaignLead.count({
      where: {
        campaignId,
        status: 'queued'
      }
    });

    // Pobierz wysłane dzisiaj
    const sentToday = await db.sendLog.count({
      where: {
        campaignId,
        status: 'sent',
        createdAt: {
          gte: today,
          lte: endOfDay
        }
      }
    });

    // Pobierz wszystkie leady w kolejce
    const totalQueued = await db.campaignLead.count({
      where: {
        campaignId,
        status: { in: ['queued', 'planned'] }
      }
    });

    // Szacowany odstęp między mailami (z uwzględnieniem ±20%)
    const baseDelay = campaign.delayBetweenEmails || 90;
    const minDelay = Math.floor(baseDelay * 0.8); // 80%
    const maxDelay = Math.floor(baseDelay * 1.2); // 120%
    const avgDelay = Math.floor((minDelay + maxDelay) / 2);

    // Oblicz ile maili może wyjść dzisiaj - uwzględniając okno czasowe
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const startHour = campaign.startHour || 9;
    const startMinute = campaign.startMinute || 0;
    const endHour = campaign.endHour || 17;
    const endMinute = campaign.endMinute || 0;

    // Oblicz ile sekund zostało w oknie czasowym dzisiaj
    const startTimeToday = new Date(today);
    startTimeToday.setHours(startHour, startMinute, 0, 0);
    
    const endTimeToday = new Date(today);
    endTimeToday.setHours(endHour, endMinute, 59, 999);

    let secondsRemainingToday = 0;
    if (now >= startTimeToday && now <= endTimeToday) {
      // Jesteśmy w oknie czasowym - oblicz pozostały czas
      secondsRemainingToday = Math.floor((endTimeToday.getTime() - now.getTime()) / 1000);
    } else if (now < startTimeToday) {
      // Jeszcze nie zaczęliśmy - pełne okno
      secondsRemainingToday = Math.floor((endTimeToday.getTime() - startTimeToday.getTime()) / 1000);
    } else {
      // Okno czasowe zakończone
      secondsRemainingToday = 0;
    }

    // Oblicz ile maili może wyjść w pozostałym czasie (używając średniego delay)
    const estimatedEmailsRemaining = avgDelay > 0 ? Math.floor(secondsRemainingToday / avgDelay) : 0;
    
    // Rzeczywiste możliwe do wysłania = minimum z (limit dzienny - wysłane, leady w kolejce, szacowane w oknie czasowym)
    const maxPossibleToday = Math.min(
      campaign.maxEmailsPerDay,
      totalQueued,
      sentToday + estimatedEmailsRemaining
    );

    // Helper function do formatowania czasu
    const formatScheduleTime = (hour: number, minute: number) => {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    };

    // Sprawdź czy kampania jest aktywna dzisiaj (czy dzisiejszy dzień jest w allowedDays)
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const todayDay = dayNames[today.getDay()];
    const allowedDays = campaign.allowedDays ? campaign.allowedDays.split(',') : [];
    const isActiveToday = allowedDays.includes(todayDay);

    // ✅ Oblicz kiedy wyjdzie kolejny mail i jaki będzie następny ruch systemu
    let nextEmailTime: Date | null = null;
    let nextAction: string = '';
    let nextActionReason: string = '';
    let waitTimeSeconds: number | null = null;
    
    // ✅ SPRAWDŹ NAJBLIŻSZY MAIL W KOLEJCE (CampaignEmailQueue) - to jest prawdziwy czas!
    let nextQueuedEmail = null;
    try {
      nextQueuedEmail = await db.campaignEmailQueue.findFirst({
        where: {
          campaignId,
          status: 'pending'
        },
        orderBy: {
          scheduledAt: 'asc'
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
                  company: true
                }
              }
            }
          }
        }
      });
    } catch (error: any) {
      // Jeśli model nie istnieje - to OK, kolejka może być pusta lub nieużywana
      console.warn(`[SENDING-INFO] Nie można sprawdzić CampaignEmailQueue: ${error.message}`);
      nextQueuedEmail = null;
    }
    
    // Sprawdź najbliższego leada w kolejce (jako fallback)
    const nextQueuedLead = await db.campaignLead.findFirst({
      where: {
        campaignId,
        status: 'queued',
        lead: {
          status: { not: 'BLOCKED' },
          isBlocked: false
        }
      },
      include: {
        lead: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            company: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (campaign.status !== 'IN_PROGRESS') {
      // Kampania nie jest aktywna - ale sprawdź czy są maile zaplanowane w kolejce
      if (nextQueuedEmail) {
        // Są maile zaplanowane - pokaż kiedy będą wysłane po wznowieniu
        nextAction = 'Czeka na uruchomienie kampanii';
        nextActionReason = `Status kampanii: ${campaign.status}. Maile zaplanowane w kolejce, będą wysłane po wznowieniu.`;
        nextEmailTime = new Date(nextQueuedEmail.scheduledAt);
        waitTimeSeconds = Math.max(0, Math.floor((nextEmailTime.getTime() - now.getTime()) / 1000));
        // nextLead zostanie ustawiony poniżej z nextQueuedEmail
      } else if (nextQueuedLead) {
        // Brak maili w kolejce, ale są leady w kolejce - pokaż że po wznowieniu będą wysłane
        nextAction = 'Czeka na uruchomienie kampanii';
        nextActionReason = `Status kampanii: ${campaign.status}. Są leady w kolejce (${totalQueued}), będą wysłane po wznowieniu.`;
        // nextLead zostanie ustawiony poniżej z nextQueuedLead
      } else {
        // Brak maili i leadów w kolejce
        nextAction = 'Czeka na uruchomienie kampanii';
        nextActionReason = `Status kampanii: ${campaign.status}`;
      }
    } else if (totalQueued === 0) {
      // Brak leadów w kolejce
      nextAction = 'Brak leadów do wysłania';
      nextActionReason = 'Wszystkie leady zostały już wysłane';
    } else if (!isActiveToday) {
      // Nie jest dozwolony dzień
      nextAction = 'Czeka na dozwolony dzień';
      nextActionReason = `Dziś jest ${todayDay}, dozwolone dni: ${allowedDays.join(', ')}`;
      // Oblicz kiedy będzie następny dozwolony dzień
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(startHour, startMinute, 0, 0);
      nextEmailTime = tomorrow;
      waitTimeSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    } else if (secondsRemainingToday <= 0) {
      // Okno czasowe zakończone
      nextAction = 'Czeka na okno czasowe jutro';
      nextActionReason = `Okno czasowe: ${formatScheduleTime(startHour, startMinute)} - ${formatScheduleTime(endHour, endMinute)}`;
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(startHour, startMinute, 0, 0);
      nextEmailTime = tomorrow;
      waitTimeSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    } else if (sentToday >= campaign.maxEmailsPerDay) {
      // Osiągnięto limit dzienny
      nextAction = 'Osiągnięto limit dzienny kampanii';
      nextActionReason = `Wysłano ${sentToday}/${campaign.maxEmailsPerDay} maili dzisiaj`;
      // Następny mail jutro
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(startHour, startMinute, 0, 0);
      nextEmailTime = tomorrow;
      waitTimeSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    } else {
      // ✅ SPRAWDŹ DOSTĘPNOŚĆ SKRZYNEK (przed delay check)
      const { getNextAvailableMailbox } = await import('@/services/mailboxManager');
      const availableMailbox = await getNextAvailableMailbox(
        campaign.virtualSalespersonId || 0,
        campaignId,
        { readOnly: true }
      );
      
      if (!availableMailbox) {
        // Brak dostępnych skrzynek - sprawdź które kampanie blokują
        const { getStartOfTodayPL } = await import('@/utils/polishTime');
        const todayStart = getStartOfTodayPL();
        
        const blockingCampaigns = await db.campaign.findMany({
          where: {
            virtualSalespersonId: campaign.virtualSalespersonId,
            status: 'IN_PROGRESS',
            id: { not: campaignId }
          },
          select: {
            id: true,
            name: true
          }
        });

        if (blockingCampaigns.length > 0) {
          const blockingCampaignIds = blockingCampaigns.map(c => c.id);
          const usedMailboxes = await db.sendLog.findMany({
            where: {
              campaignId: { in: blockingCampaignIds },
              mailboxId: { not: null },
              createdAt: { gte: todayStart },
              status: 'sent'
            },
            select: { mailboxId: true },
            distinct: ['mailboxId']
          });

          const usedMailboxIds = usedMailboxes.map(m => m.mailboxId).filter((id): id is number => id !== null);
          
          // Pobierz nazwy skrzynek
          const mailboxEmails = usedMailboxIds.length > 0
            ? await db.mailbox.findMany({
                where: { id: { in: usedMailboxIds } },
                select: { email: true }
              }).then(mbs => mbs.map(m => m.email))
            : [];

          const blockingNames = blockingCampaigns.map(c => c.name).join(', ');
          
          nextAction = 'Czeka na dostępność skrzynek';
          nextActionReason = `Wszystkie skrzynki są używane przez inne aktywne kampanie: ${blockingNames}. Skrzynki: ${mailboxEmails.join(', ') || 'wszystkie'}`;
          
          // Spróbuj ponownie za 1-2 minuty (gdy inna kampania może zakończyć wysyłkę lub wyczerpać limit)
          const retryTime = new Date(now);
          retryTime.setMinutes(retryTime.getMinutes() + 2);
          nextEmailTime = retryTime;
          waitTimeSeconds = Math.floor((retryTime.getTime() - now.getTime()) / 1000);
        } else {
          // Brak innych kampanii, ale brak skrzynek - wszystkie wyczerpane
          nextAction = 'Czeka na dostępność skrzynek';
          nextActionReason = 'Wszystkie skrzynki wyczerpały dzienny limit. Skrzynki będą dostępne jutro po resecie.';
          
          // Spróbuj jutro o startHour
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(startHour, startMinute, 0, 0);
          nextEmailTime = tomorrow;
          waitTimeSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
        }
      } else if (lastSentLogs.length > 0) {
        // Jest ostatni wysłany mail - sprawdź delay
        const lastSent = new Date(lastSentLogs[0].createdAt);
        const timeSinceLastMail = Math.floor((now.getTime() - lastSent.getTime()) / 1000);
        
        if (timeSinceLastMail < minDelay) {
          // Delay jeszcze nie minął
          const remainingDelay = minDelay - timeSinceLastMail;
          nextAction = 'Czeka na minięcie delay';
          nextActionReason = `Minęło ${timeSinceLastMail}s, wymagane minimum ${minDelay}s (bazowy ${baseDelay}s)`;
          nextEmailTime = new Date(lastSent.getTime() + minDelay * 1000);
          waitTimeSeconds = remainingDelay;
          
          // Sprawdź czy nie wykracza poza okno czasowe
          if (nextEmailTime > endTimeToday) {
            nextAction = 'Czeka na okno czasowe jutro';
            nextActionReason = 'Delay minąłby poza oknem czasowym';
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(startHour, startMinute, 0, 0);
            nextEmailTime = tomorrow;
            waitTimeSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
          }
        } else {
          // Delay minął - może wysłać teraz
          // ✅ Jeśli jest mail w kolejce - użyj jego scheduledAt (stabilny czas)
          if (nextQueuedEmail) {
            nextAction = 'Gotowy do wysłania';
            nextActionReason = 'Mail zaplanowany w kolejce, cron wyśle gdy scheduledAt minie';
            nextEmailTime = new Date(nextQueuedEmail.scheduledAt);
            waitTimeSeconds = Math.max(0, Math.floor((nextEmailTime.getTime() - now.getTime()) / 1000));
          } else {
            // Brak maili w kolejce - pokaż że system czeka na inicjalizację
            nextAction = 'Gotowy do wysłania';
            nextActionReason = 'Delay minął, brak maili w kolejce - system automatycznie zainicjalizuje w ciągu ~1 minuty';
            // Użyj stabilnego czasu: zaokrąglij do następnej pełnej minuty (nie przesuwa się co sekundę)
            const nextMinute = new Date(now);
            nextMinute.setSeconds(0);
            nextMinute.setMilliseconds(0);
            nextMinute.setMinutes(nextMinute.getMinutes() + 1); // Następna pełna minuta
            nextEmailTime = nextMinute;
            waitTimeSeconds = Math.max(0, Math.floor((nextEmailTime.getTime() - now.getTime()) / 1000));
          }
        }
      } else {
        // Brak wysłanych maili, ale są leady w kolejce (else dla else if (lastSentLogs.length > 0))
        if (now < startTimeToday) {
          // Jeszcze nie zaczęliśmy
          nextAction = 'Czeka na początek okna czasowego';
          nextActionReason = `Okno czasowe zaczyna się o ${formatScheduleTime(startHour, startMinute)}`;
          nextEmailTime = startTimeToday;
          waitTimeSeconds = Math.floor((startTimeToday.getTime() - now.getTime()) / 1000);
        } else {
          // Jesteśmy w oknie czasowym - może wysłać teraz
          // ✅ Jeśli jest mail w kolejce - użyj jego scheduledAt
          if (nextQueuedEmail) {
            nextAction = 'Gotowy do wysłania';
            nextActionReason = 'Mail zaplanowany w kolejce, cron wyśle gdy scheduledAt minie';
            nextEmailTime = new Date(nextQueuedEmail.scheduledAt);
            waitTimeSeconds = Math.max(0, Math.floor((nextEmailTime.getTime() - now.getTime()) / 1000));
          } else {
            // Brak maili w kolejce
            nextAction = 'Gotowy do wysłania';
            nextActionReason = 'Pierwszy mail z kampanii, brak maili w kolejce - system automatycznie zainicjalizuje w ciągu ~1 minuty';
            // Użyj stabilnego czasu: zaokrąglij do następnej pełnej minuty (nie przesuwa się co sekundę)
            const nextMinute = new Date(now);
            nextMinute.setSeconds(0);
            nextMinute.setMilliseconds(0);
            nextMinute.setMinutes(nextMinute.getMinutes() + 1); // Następna pełna minuta
            // Ale nie wcześniej niż startTimeToday
            const baseTime = campaign.scheduledAt && new Date(campaign.scheduledAt) > now 
              ? new Date(campaign.scheduledAt) 
              : (startTimeToday > nextMinute ? startTimeToday : nextMinute);
            nextEmailTime = baseTime;
            waitTimeSeconds = Math.max(0, Math.floor((nextEmailTime.getTime() - now.getTime()) / 1000));
          }
        }
      }
    }

    // Oblicz ile leadów może wyjść dzisiaj (z uwzględnieniem limitów i okna czasowego)
    const remainingToday = Math.min(
      campaign.maxEmailsPerDay - sentToday,
      totalQueued,
      estimatedEmailsRemaining
    );

    return NextResponse.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status
        },
        delayInfo: {
          base: baseDelay,
          min: minDelay,
          max: maxDelay,
          average: avgDelay
        },
        lastEmails: emailsWithIntervals.map(log => ({
          id: log.id,
          sentAt: log.createdAt,
          lead: log.lead,
          intervalSeconds: log.intervalSeconds
        })),
        nextEmailTime,
        nextAction: {
          action: nextAction,
          reason: nextActionReason,
          waitTimeSeconds,
          nextLead: nextQueuedEmail?.campaignLead?.lead ? {
            email: nextQueuedEmail.campaignLead.lead.email,
            firstName: nextQueuedEmail.campaignLead.lead.firstName,
            lastName: nextQueuedEmail.campaignLead.lead.lastName,
            company: nextQueuedEmail.campaignLead.lead.company
          } : (nextQueuedLead?.lead ? {
            email: nextQueuedLead.lead.email,
            firstName: nextQueuedLead.lead.firstName,
            lastName: nextQueuedLead.lead.lastName,
            company: nextQueuedLead.lead.company
          } : null)
        },
        todayInfo: {
          isActiveToday,
          sentToday,
          queuedToday,
          remainingToday: Math.min(remainingToday, maxPossibleToday),
          maxPerDay: campaign.maxEmailsPerDay,
          estimatedRemaining: estimatedEmailsRemaining,
          secondsRemainingInWindow: secondsRemainingToday > 0 ? secondsRemainingToday : 0
        },
        schedule: {
          startHour: campaign.startHour,
          startMinute: campaign.startMinute,
          endHour: campaign.endHour,
          endMinute: campaign.endMinute,
          allowedDays: campaign.allowedDays
        }
      }
    });

  } catch (error: any) {
    console.error('[SENDING-INFO] Błąd pobierania informacji:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Błąd podczas pobierania informacji',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
