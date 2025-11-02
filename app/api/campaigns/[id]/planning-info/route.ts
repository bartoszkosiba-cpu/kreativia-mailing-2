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
    endWindow.setHours(campaign.endHour, campaign.endMinute ?? 0, 0);
    endWindow.setMinutes(endWindow.getMinutes() - 60); // -1h margines
    const msRemaining = endWindow.getTime() - now.getTime();
    const minutesRemaining = Math.floor(msRemaining / 1000 / 60);
    const secondsRemaining = Math.floor(msRemaining / 1000); // Konwertuj milisekundy na sekundy

    // Oblicz optymalny delay
    let optimalDelay = campaign.delayBetweenEmails;
    
    // Najpierw oblicz ile maili faktycznie można wysłać dzisiaj (z uwzględnieniem limitu dziennego)
    let estimatedEmailsToday = Math.min(remainingLeads, campaign.maxEmailsPerDay - sentCount);
    
    // Oblicz tylko jeśli jest czas w oknie i maile do wysłania
    if (secondsRemaining > 0 && estimatedEmailsToday > 0 && timeCheck.isValid) {
      // Oblicz delay na podstawie faktycznej liczby maili które można wysłać dzisiaj
      // Użyj sekund zamiast milisekund!
      optimalDelay = Math.floor(secondsRemaining / Math.max(1, estimatedEmailsToday));
      
      // Upewnij się że delay nie jest mniejszy niż bazowy (minimalne bezpieczeństwo)
      optimalDelay = Math.max(optimalDelay, campaign.delayBetweenEmails);
    } else if (secondsRemaining <= 0) {
      // Okno się skończyło - użyj bazowego delay
      optimalDelay = campaign.delayBetweenEmails;
      estimatedEmailsToday = 0; // Nie można wysłać nic dzisiaj
    } else if (!timeCheck.isValid) {
      // Okno nieaktywne - użyj bazowego delay
      optimalDelay = campaign.delayBetweenEmails;
      estimatedEmailsToday = 0; // Nie można wysłać nic dzisiaj
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
        endWindowSafe: endWindow.toISOString()
      },
      emails: {
        total: leads.length,
        sent: sentCount,
        remaining: remainingLeads,
        estimatedToday: estimatedEmailsToday,
        maxPerDay: campaign.maxEmailsPerDay
      },
      delay: {
        base: campaign.delayBetweenEmails,
        optimal: optimalDelay,
        min: Math.max(1, Math.floor(optimalDelay * 0.8)),
        max: Math.floor(optimalDelay * 1.2)
      },
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

