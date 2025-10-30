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

    // Oblicz optymalny delay
    let optimalDelay = campaign.delayBetweenEmails;
    let estimatedEmailsToday = remainingLeads;
    
    // Oblicz tylko jeśli jest czas w oknie
    if (msRemaining > 0 && remainingLeads > 0 && timeCheck.isValid) {
      optimalDelay = Math.floor(msRemaining / Math.max(1, remainingLeads));
      
      // Ogranicz do maksymalnego limitu dziennego
      estimatedEmailsToday = Math.min(remainingLeads, campaign.maxEmailsPerDay - sentCount);
    } else if (msRemaining <= 0) {
      // Okno się skończyło - użyj bazowego delay
      optimalDelay = campaign.delayBetweenEmails;
    }

    // Sprawdź czy zbliżamy się do limitów
    const isApproachingDailyLimit = sentCount >= campaign.maxEmailsPerDay - 10;
    const isApproachingTimeLimit = msRemaining <= 300000; // 5 minut
    const isInSafetyMargin = msRemaining <= 0;

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

