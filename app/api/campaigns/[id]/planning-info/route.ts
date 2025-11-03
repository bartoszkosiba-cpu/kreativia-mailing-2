import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidSendTime } from "@/services/campaignScheduler";

/**
 * API endpoint do obliczania informacji o planowaniu kampanii
 * Pokazuje: pozostały czas, liczba maili na dziś, obliczony delay
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    
    // Pobierz kampanię
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        CampaignLead: {
          include: {
            lead: true
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie znaleziona" }, { status: 404 });
    }

    // Pobierz wszystkie leady z kampanii
    const allLeads = campaign.CampaignLead.map(cl => cl.lead);
    
    // Polic filtry (aktywne, nie zablokowane, nie wysłane)
    const leads = allLeads.filter(l => 
      l && l.status !== "BLOCKED" && !l.isBlocked
    );

    // Policz ile już wysłano
    const sentLogs = await db.sendLog.findMany({
      where: {
        campaignId: campaign.id,
        status: "sent",
        // Wyklucz testowe wysyłki (bez leadId)
        leadId: { not: null }
      },
      select: { leadId: true }
    });
    
    const sentLeadIds = new Set(sentLogs.map(log => log.leadId));
    const sentCount = sentLogs.length;
    const remainingLeads = leads.length - sentCount;

    // Oblicz informacje o oknie czasowym
    const now = new Date();
    const allowedDays = campaign.allowedDays.split(',');
    const targetCountries = campaign.targetCountries ? campaign.targetCountries.split(',') : [];
    
    const timeCheck = await isValidSendTime(
      now,
      allowedDays,
      campaign.startHour,
      campaign.startMinute ?? 0,
      campaign.endHour,
      campaign.endMinute ?? 0,
      campaign.respectHolidays,
      targetCountries
    );

    // Oblicz pozostały czas w oknie
    const endWindow = new Date(now);
    endWindow.setHours(campaign.endHour, campaign.endMinute ?? 0, 59, 999);
    const msRemaining = endWindow.getTime() - now.getTime();
    const minutesRemaining = Math.floor(msRemaining / 1000 / 60);
    const secondsRemaining = Math.floor(msRemaining / 1000); // Konwertuj milisekundy na sekundy

    // ✅ PROSTA LOGIKA: Delay = delayBetweenEmails ± 20% (bez równomiernego rozkładu)
    const baseDelay = campaign.delayBetweenEmails;
    const randomVariation = 0.2;
    const minDelay = Math.floor(baseDelay * (1 - randomVariation)); // 80% bazowego
    const maxDelay = Math.floor(baseDelay * (1 + randomVariation)); // 120% bazowego
    
    // Oblicz ile maili faktycznie można wysłać dzisiaj (z uwzględnieniem limitu dziennego)
    let estimatedEmailsToday = Math.min(remainingLeads, campaign.maxEmailsPerDay - sentCount);
    
    if (secondsRemaining <= 0 || !timeCheck.isValid) {
      estimatedEmailsToday = 0; // Nie można wysłać nic dzisiaj
    }
    
    // Oblicz czas następnego maila (jeśli jest ostatni wysłany)
    let nextEmailTime: string | null = null;
    const lastSentLog = await db.sendLog.findFirst({
      where: {
        campaignId: campaign.id,
        status: "sent",
        leadId: { not: null }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (lastSentLog && timeCheck.isValid && estimatedEmailsToday > 0) {
      const lastSentTime = new Date(lastSentLog.createdAt);
      const timeSinceLastMail = Math.floor((now.getTime() - lastSentTime.getTime()) / 1000); // sekundy
      const minRequiredDelay = minDelay;
      
      if (timeSinceLastMail < minRequiredDelay) {
        // Delay jeszcze nie minął - oblicz kiedy będzie następny
        const remainingDelay = minRequiredDelay - timeSinceLastMail;
        const nextEmail = new Date(now.getTime() + remainingDelay * 1000);
        nextEmailTime = nextEmail.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      } else {
        // Delay już minął - następny mail będzie w kolejnym cron (za ~1 min)
        const nextEmail = new Date(now.getTime() + 60 * 1000); // Cron co 1 minutę
        nextEmailTime = nextEmail.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
    } else if (!lastSentLog && timeCheck.isValid && estimatedEmailsToday > 0) {
      // Brak wysłanych maili - następny mail będzie w kolejnym cron
      const nextEmail = new Date(now.getTime() + 60 * 1000);
      nextEmailTime = nextEmail.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    // Sprawdź czy zbliżamy się do limitów
    const isApproachingDailyLimit = sentCount >= campaign.maxEmailsPerDay - 10;
    const isApproachingTimeLimit = secondsRemaining <= 300; // 5 minut = 300 sekund
    const isInSafetyMargin = secondsRemaining <= 0;

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status
      },
      timeWindow: {
        isValid: timeCheck.isValid,
        reason: timeCheck.reason,
        minutesRemaining,
        endHour: campaign.endHour,
        endMinute: campaign.endMinute ?? 0,
        endWindow: endWindow.toISOString()
      },
      emails: {
        total: leads.length,
        sent: sentCount,
        remaining: remainingLeads,
        estimatedToday: estimatedEmailsToday,
        maxPerDay: campaign.maxEmailsPerDay
      },
      delay: {
        base: baseDelay,
        optimal: baseDelay, // Dla prostoty = bazowy (bez równomiernego rozkładu)
        min: minDelay,
        max: maxDelay
      },
      nextEmailTime,
      warnings: {
        isApproachingDailyLimit,
        isApproachingTimeLimit,
        isInSafetyMargin,
        canFitAllEmails: msRemaining > 0 && estimatedEmailsToday <= remainingLeads
      }
    });
  } catch (error: any) {
    console.error("[PLANNING INFO] Błąd:", error);
    return NextResponse.json(
      { error: "Błąd obliczania planowania" },
      { status: 500 }
    );
  }
}

