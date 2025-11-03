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
    const { resetMailboxCounter } = await import('@/services/mailboxManager');
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
      }
    }

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
        
        currentSent = Math.max(0, mailbox.currentDailySent - mailbox.warmupTodaySent);
        status = `Warmup (tydzień ${week})`;
      } 
      // PRZYPADEK 1: Nowa skrzynka, nie w warmup - STAŁE 10 maili dziennie
      else if (mailbox.warmupStatus === 'inactive' || mailbox.warmupStatus === 'ready_to_warmup') {
        effectiveLimit = 10; // NEW_MAILBOX_LIMIT
        currentSent = mailbox.currentDailySent;
        status = mailbox.warmupStatus === 'inactive' ? 'Nieaktywna (warmup)' : 'Gotowa do warmup';
      }
      // PRZYPADEK 2 i 4: Gotowa skrzynka (nie w warmup) - użyj limitu ze skrzynki
      else {
        effectiveLimit = mailbox.dailyEmailLimit;
        currentSent = mailbox.currentDailySent;
        status = 'Gotowa (produkcja)';
      }
      
      const remaining = effectiveLimit - currentSent;
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
        currentSent,
        remaining,
        isAvailable,
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

