import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMailboxStats } from "@/services/mailboxManager";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    
    if (isNaN(campaignId)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe ID kampanii" },
        { status: 400 }
      );
    }

    // Pobierz kampanię z handlowcem
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        virtualSalespersonId: true,
        virtualSalesperson: {
          select: {
            id: true,
            name: true,
            mainMailboxId: true
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Kampania nie została znaleziona" },
        { status: 404 }
      );
    }

    if (!campaign.virtualSalespersonId) {
      return NextResponse.json({
        success: true,
        data: {
          campaign: {
            id: campaign.id,
            name: campaign.name
          },
          message: "Kampania nie ma przypisanego handlowca",
          mailboxes: []
        }
      });
    }

    // Pobierz statystyki skrzynek
    const stats = await getMailboxStats(campaign.virtualSalespersonId);

    // Pobierz szczegółowe informacje o każdej skrzynce
    const mailboxes = await db.mailbox.findMany({
      where: {
        virtualSalespersonId: campaign.virtualSalespersonId
      },
      orderBy: [
        { priority: "asc" },
        { lastUsedAt: "asc" }
      ],
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        priority: true,
        dailyEmailLimit: true,
        currentDailySent: true,
        warmupStatus: true,
        warmupDay: true,
        warmupDailyLimit: true,
        warmupTodaySent: true,
        lastResetDate: true,
        lastUsedAt: true
      }
    });

    // ✅ Resetuj liczniki dla skrzynek jeśli nowy dzień (przed obliczaniem limitów)
    const { getTodayPLString, isTodayPL } = await import('@/utils/polishTime');
    const { resetMailboxCounter, syncMailboxCounterFromSendLog } = await import('@/services/mailboxManager');
    const todayPL = getTodayPLString();
    
    for (const mailbox of mailboxes) {
      const needsReset = !mailbox.lastResetDate || !isTodayPL(mailbox.lastResetDate);
      if (needsReset) {
        await resetMailboxCounter(mailbox.id, mailbox.warmupStatus || undefined);
        // Odśwież dane skrzynki po resecie
        const refreshed = await db.mailbox.findUnique({
          where: { id: mailbox.id },
          select: {
            currentDailySent: true,
            warmupTodaySent: true,
            lastResetDate: true
          }
        });
        if (refreshed) {
          mailbox.currentDailySent = refreshed.currentDailySent;
          mailbox.warmupTodaySent = refreshed.warmupTodaySent || 0;
          mailbox.lastResetDate = refreshed.lastResetDate;
        }
      } else {
        // ✅ Synchronizuj currentDailySent z SendLog (naprawia rozbieżności z V1 lub błędów)
        // To działa systemowo dla wszystkich kampanii
        try {
          const syncResult = await syncMailboxCounterFromSendLog(mailbox.id);
          if (syncResult.synced) {
            // Odśwież dane skrzynki po synchronizacji
            const refreshed = await db.mailbox.findUnique({
              where: { id: mailbox.id },
              select: {
                currentDailySent: true,
                warmupTodaySent: true,
                lastResetDate: true
              }
            });
            if (refreshed) {
              mailbox.currentDailySent = refreshed.currentDailySent;
              mailbox.warmupTodaySent = refreshed.warmupTodaySent || 0;
              mailbox.lastResetDate = refreshed.lastResetDate;
            }
          }
        } catch (error: any) {
          // Nie przerywamy - tylko logujemy błąd synchronizacji
          console.error(`[MAILBOXES API] Błąd synchronizacji skrzynki ${mailbox.id}:`, error.message);
        }
      }
    }

    // ✅ Pobierz GLOBALNĄ liczbę maili wysłanych DZISIAJ ze skrzynki (wszystkie kampanie)
    // Używamy mailbox.currentDailySent, który już zawiera wszystkie maile dzisiaj
    // (jest resetowany codziennie o 00:00 PL i aktualizowany przy każdej wysyłce)
    
    // ✅ Pobierz początek dzisiaj w polskim czasie
    const { getStartOfTodayPL } = await import('@/utils/polishTime');
    const todayStart = getStartOfTodayPL();

    // Oblicz efektywne limity dla każdej skrzynki (jak w getNextAvailableMailbox)
    const mailboxesWithLimits = await Promise.all(mailboxes.map(async (mailbox) => {
      let effectiveLimit: number;
      let currentSent: number;
      let status: string;
      
      // Import funkcji pomocniczych
      const mailboxManager = await import('@/services/mailboxManager');
      const getWeekFromDay = mailboxManager.getWeekFromDay;
      const getPerformanceLimits = mailboxManager.getPerformanceLimits;
      
      // PRZYPADEK 3: W warmup - użyj limitów z /settings/performance
      if (mailbox.warmupStatus === 'warming') {
        const week = getWeekFromDay(mailbox.warmupDay || 0);
        const performanceLimits = await getPerformanceLimits(week);
        
        effectiveLimit = Math.min(
          mailbox.dailyEmailLimit,
          mailbox.warmupDailyLimit,
          performanceLimits.campaign
        );
        
        // ✅ Użyj GLOBALNEJ liczby maili (wszystkie kampanie dzisiaj) - to jest rzeczywisty stan skrzynki
        // Licznik kampanii = wszystkie maile dzisiaj MINUS maile warmup
        currentSent = Math.max(0, mailbox.currentDailySent - mailbox.warmupTodaySent);
        status = `Warmup (tydzień ${week})`;
      } 
      // PRZYPADEK 1: Nowa skrzynka, nie w warmup - STAŁE 10 maili dziennie
      else if (mailbox.warmupStatus === 'inactive' || mailbox.warmupStatus === 'ready_to_warmup') {
        effectiveLimit = 10; // NEW_MAILBOX_LIMIT
        // ✅ Użyj GLOBALNEJ liczby maili (wszystkie kampanie dzisiaj) - to jest rzeczywisty stan skrzynki
        currentSent = mailbox.currentDailySent;
        status = mailbox.warmupStatus === 'inactive' ? 'Nieaktywna (warmup)' : 'Gotowa do warmup';
      }
      // PRZYPADEK 2 i 4: Gotowa skrzynka (nie w warmup) - użyj limitu ze skrzynki
      else {
        effectiveLimit = mailbox.dailyEmailLimit;
        // ✅ Użyj GLOBALNEJ liczby maili (wszystkie kampanie dzisiaj) - to jest rzeczywisty stan skrzynki
        currentSent = mailbox.currentDailySent;
        status = 'Gotowa (produkcja)';
      }
      
      // ✅ Policz maile wysłane DZISIAJ z TEJ kampanii
      const sentTodayForCampaign = await db.sendLog.count({
        where: {
          mailboxId: mailbox.id,
          campaignId: campaignId,
          status: 'sent',
          createdAt: { gte: todayStart }
        }
      });
      
      // ✅ Policz WSZYSTKIE maile wysłane DZISIAJ (z SendLog - rzeczywiste dane)
      // Używamy SendLog zamiast currentDailySent, bo currentDailySent może być niezsynchronizowany
      const sentTodayAll = await db.sendLog.count({
        where: {
          mailboxId: mailbox.id,
          status: 'sent',
          createdAt: { gte: todayStart }
        }
      });
      
      // ✅ Dla wyświetlania użyj rzeczywistej liczby z SendLog (dokładne dane)
      const currentSentForDisplay = sentTodayAll;
      
      // ✅ Oblicz remaining i isAvailable na podstawie rzeczywistego stanu systemu
      // currentSent (z currentDailySent) jest używany przez system do logiki wysyłki
      // currentSentForDisplay (z SendLog) jest używany tylko do wyświetlania w UI
      const remaining = effectiveLimit - currentSent; // ✅ Użyj currentSent (z currentDailySent) dla logiki
      const isAvailable = mailbox.isActive && remaining > 0;
      
      return {
        id: mailbox.id,
        email: mailbox.email,
        displayName: mailbox.displayName,
        isActive: mailbox.isActive,
        priority: mailbox.priority,
        warmupStatus: mailbox.warmupStatus,
        warmupDay: mailbox.warmupDay,
        effectiveLimit,
        currentSent: currentSentForDisplay, // ✅ Rzeczywiste dane z SendLog dla wyświetlania
        sentTodayForCampaign, // ✅ Wysłane dzisiaj z tej kampanii
        remaining, // ✅ Obliczone na podstawie currentSent (z uwzględnieniem warmup)
        isAvailable, // ✅ Obliczone na podstawie currentSent (z uwzględnieniem warmup)
        status,
        isMain: mailbox.id === campaign.virtualSalesperson?.mainMailboxId,
        lastUsedAt: mailbox.lastUsedAt,
        lastResetDate: mailbox.lastResetDate
      };
    }));

    return NextResponse.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name
        },
        salesperson: campaign.virtualSalesperson,
        summary: {
          totalMailboxes: stats.totalMailboxes,
          activeMailboxes: stats.activeMailboxes,
          availableMailboxes: mailboxesWithLimits.filter(m => m.isAvailable).length,
          totalDailyLimit: stats.totalDailyLimit,
          totalSentToday: stats.totalSentToday,
          totalRemainingToday: stats.remainingToday,
          effectiveRemainingToday: mailboxesWithLimits
            .filter(m => m.isActive)
            .reduce((sum, m) => sum + (m.remaining > 0 ? m.remaining : 0), 0)
        },
        mailboxes: mailboxesWithLimits
      }
    });
  } catch (error: any) {
    console.error('[MAILBOXES] Błąd pobierania skrzynek:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Błąd podczas pobierania skrzynek',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

