import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWeekFromDay, getPerformanceLimits } from "@/services/mailboxManager";

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

    const { getStartOfTodayPL, isTodayPL } = await import('@/utils/polishTime');
    const todayStart = getStartOfTodayPL();

    const mailboxIds = mailboxes.map((m) => m.id);

    // Zlicz rzeczywiste wysyłki dzisiaj (wszystkie kampanie) w jednym zapytaniu
    const sentTodayAllRaw = mailboxIds.length
      ? await db.sendLog.groupBy({
          by: ['mailboxId'],
          where: {
            mailboxId: { in: mailboxIds },
            status: 'sent',
            createdAt: { gte: todayStart }
          },
          _count: { _all: true }
        })
      : [];

    const sentTodayAllMap = new Map<number, number>();
    for (const item of sentTodayAllRaw) {
      if (item.mailboxId !== null) {
        sentTodayAllMap.set(item.mailboxId, item._count._all);
      }
    }

    // Zlicz wysyłki dzisiaj dla konkretnej kampanii (jedno zapytanie)
    const sentTodayForCampaignRaw = mailboxIds.length
      ? await db.sendLog.groupBy({
          by: ['mailboxId'],
          where: {
            mailboxId: { in: mailboxIds },
            campaignId,
            status: 'sent',
            createdAt: { gte: todayStart }
          },
          _count: { _all: true }
        })
      : [];

    const sentTodayForCampaignMap = new Map<number, number>();
    for (const item of sentTodayForCampaignRaw) {
      if (item.mailboxId !== null) {
        sentTodayForCampaignMap.set(item.mailboxId, item._count._all);
      }
    }

    // Oblicz efektywne limity dla każdej skrzynki (jak w getNextAvailableMailbox)
    const mailboxesWithLimits = await Promise.all(mailboxes.map(async (mailbox) => {
      let effectiveLimit: number;
      let currentSent: number;
      let status: string;
      const sentAll = sentTodayAllMap.get(mailbox.id) ?? 0;
      const sentForCampaign = sentTodayForCampaignMap.get(mailbox.id) ?? 0;
      
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
        const campaignCounter = Math.max(0, mailbox.currentDailySent - mailbox.warmupTodaySent);
        currentSent = campaignCounter;
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
      // ✅ Dla wyświetlania użyj rzeczywistej liczby z SendLog (dokładne dane)
      const currentSentForDisplay = sentAll;
      
      // ✅ Oblicz remaining i isAvailable na podstawie rzeczywistego stanu systemu
      // currentSent (z currentDailySent) jest używany przez system do logiki wysyłki
      // currentSentForDisplay (z SendLog) jest używany tylko do wyświetlania w UI
      let remaining = effectiveLimit - currentSent; // ✅ Użyj currentSent (z currentDailySent) dla logiki
      if (!mailbox.lastResetDate || !isTodayPL(mailbox.lastResetDate)) {
        // Liczniki jeszcze nie zostały zresetowane dzisiaj – pokaż ostrożnie, ale nie modyfikuj bazy
        remaining = effectiveLimit;
      }
      if (remaining < 0) {
        remaining = 0;
      }
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
        sentTodayForCampaign: sentForCampaign, // ✅ Wysłane dzisiaj z tej kampanii
        remaining, // ✅ Obliczone na podstawie currentSent (z uwzględnieniem warmup)
        isAvailable, // ✅ Obliczone na podstawie currentSent (z uwzględnieniem warmup)
        status,
        isMain: mailbox.id === campaign.virtualSalesperson?.mainMailboxId,
        lastUsedAt: mailbox.lastUsedAt,
        lastResetDate: mailbox.lastResetDate
      };
    }));

    const totalSentTodayAll = mailboxesWithLimits.reduce((sum, mailbox) => sum + (sentTodayAllMap.get(mailbox.id) ?? 0), 0);
    const activeMailboxes = mailboxesWithLimits.filter((m) => m.isActive);
    const availableMailboxes = activeMailboxes.filter((m) => m.isAvailable).length;
    const totalDailyLimit = mailboxes.reduce((sum, m) => sum + m.dailyEmailLimit, 0);
    const totalRemaining = activeMailboxes.reduce((sum, m) => sum + (m.remaining > 0 ? m.remaining : 0), 0);
    const totalRemainingToday = Math.max(0, totalDailyLimit - totalSentTodayAll);

    return NextResponse.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name
        },
        salesperson: campaign.virtualSalesperson,
        summary: {
          totalMailboxes: mailboxes.length,
          activeMailboxes: activeMailboxes.length,
          availableMailboxes,
          totalDailyLimit,
          totalSentToday: totalSentTodayAll,
          totalRemainingToday,
          effectiveRemainingToday: totalRemaining
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

