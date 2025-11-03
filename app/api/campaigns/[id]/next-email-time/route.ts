import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateTodayCapacity } from "@/services/dynamicEstimator";
import { isValidSendTime } from "@/services/campaignScheduler";

/**
 * GET /api/campaigns/[id]/next-email-time
 * Oblicza kiedy wyjdzie następny mail z kampanii
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: true,
        sendLogs: {
          where: {
            status: 'sent'
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1 // Ostatni wysłany mail
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie znaleziona" }, { status: 404 });
    }

    // Jeśli kampania nie jest w trakcie wysyłki
    if (campaign.status !== 'IN_PROGRESS') {
      return NextResponse.json({
        isActive: false,
        message: "Kampania nie jest w trakcie wysyłki",
        nextEmailTime: null
      });
    }

    // Pobierz ostatni wysłany mail
    const lastSentLog = campaign.sendLogs[0];
    
    if (!lastSentLog) {
      // Jeszcze nie wysłano żadnego maila - następny wyjdzie za delay
      const baseDelay = campaign.delayBetweenEmails || 90;
      
      // Użyj tej samej logiki losowości ±20% co dla kolejnych maili
      const randomVariation = 0.2;
      const minDelay = Math.floor(baseDelay * (1 - randomVariation));
      const maxDelay = Math.floor(baseDelay * (1 + randomVariation));
      const averageDelay = Math.floor((minDelay + maxDelay) / 2);
      
      // Sprawdź czy kampania już powinna się rozpocząć (scheduledAt)
      let nextTime: Date;
      if (campaign.scheduledAt && campaign.scheduledAt <= new Date()) {
        // Kampania już powinna być uruchomiona - pierwszy mail za średni delay od teraz
        nextTime = new Date(Date.now() + averageDelay * 1000);
      } else if (campaign.scheduledAt && campaign.scheduledAt > new Date()) {
        // Kampania zaplanowana na przyszłość - pierwszy mail o scheduledAt + średni delay
        nextTime = new Date(campaign.scheduledAt.getTime() + averageDelay * 1000);
      } else {
        // Brak scheduledAt - użyj teraz + średni delay
        nextTime = new Date(Date.now() + averageDelay * 1000);
      }
      
      // Oblicz harmonogram dla kolejnych 5 maili (z losowością ±20%)
      const schedule: Array<{ 
        emailNumber: number; 
        time: string; 
        delayFromPrevious: number;
        delayMin?: number;
        delayMax?: number;
      }> = [];
      let currentTime = new Date(nextTime);
      
      for (let i = 1; i <= 5; i++) {
        const scheduleTime = new Date(currentTime);
        schedule.push({
          emailNumber: i,
          time: scheduleTime.toLocaleTimeString('pl-PL', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          }),
          delayFromPrevious: i === 1 ? 0 : averageDelay,
          delayMin: i === 1 ? undefined : minDelay,
          delayMax: i === 1 ? undefined : maxDelay
        });
        
        // Następny mail będzie za średni delay sekund (z uwzględnieniem losowości ±20%)
        currentTime = new Date(currentTime.getTime() + averageDelay * 1000);
      }
      
      return NextResponse.json({
        isActive: true,
        nextEmailTime: nextTime.toISOString(),
        delaySeconds: averageDelay,
        schedule,
        message: `Pierwszy mail zostanie wysłany o ${nextTime.toLocaleTimeString('pl-PL', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        })}`
      });
    }

    // Oblicz dostępność skrzynek dzisiaj
    if (!campaign.virtualSalespersonId) {
      return NextResponse.json({
        isActive: false,
        message: "Brak przypisanego handlowca",
        nextEmailTime: null
      });
    }

    const { emailsPerDay } = await calculateTodayCapacity(
      campaign.virtualSalespersonId,
      campaign.maxEmailsPerDay || 500
    );

    // Sprawdź czy jest w oknie czasowym
    const now = new Date();
    const allowedDays = campaign.allowedDays?.split(',') || [];
    const targetCountries = campaign.targetCountries ? campaign.targetCountries.split(',') : [];
    
    const timeCheck = await isValidSendTime(
      now,
      allowedDays,
      campaign.startHour || 9,
      campaign.startMinute ?? 0,
      campaign.endHour || 17,
      campaign.endMinute ?? 0,
      campaign.respectHolidays || false,
      targetCountries
    );

    if (!timeCheck.isValid) {
      return NextResponse.json({
        isActive: false,
        message: `Kampania poza oknem czasowym: ${timeCheck.reason}`,
        nextEmailTime: null,
        reason: timeCheck.reason
      });
    }

    // Oblicz pozostały czas w oknie (faktyczna końcowa godzina)
    const endWindow = new Date(now);
    endWindow.setHours(campaign.endHour || 15, campaign.endMinute || 0, 59, 999);
    
    const msRemaining = endWindow.getTime() - now.getTime();
    const secondsRemaining = Math.floor(msRemaining / 1000);

    // Policz ile już wysłano dzisiaj
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const sentToday = await db.sendLog.count({
      where: {
        campaignId: campaign.id,
        status: 'sent',
        createdAt: {
          gte: todayStart
        }
      }
    });

    // ✅ SPRAWDŹ OBYDWA LIMITY: kampanii i skrzynek
    const campaignLimit = campaign.maxEmailsPerDay || 500;
    const campaignRemaining = Math.max(0, campaignLimit - sentToday);
    const mailboxRemaining = Math.max(0, emailsPerDay - sentToday);
    
    // Użyj minimum z obu limitów (kampania nie może wysłać więcej niż dozwolą skrzynki)
    const remainingEmailsToday = Math.min(campaignRemaining, mailboxRemaining);

    if (remainingEmailsToday === 0) {
      // Określ który limit został osiągnięty
      const limitReached = campaignRemaining === 0 ? 'kampanii' : 'skrzynek';
      
      return NextResponse.json({
        isActive: false,
        message: `Osiągnięto limit dzienny ${limitReached} - następny mail jutro`,
        nextEmailTime: null,
        sentToday,
        campaignLimit,
        emailsPerDay,
        campaignRemaining,
        mailboxRemaining
      });
    }

    // ✅ PROSTA LOGIKA: Delay = delayBetweenEmails ± 20% (bez równomiernego rozkładu)
    const baseDelay = campaign.delayBetweenEmails || 90;
    const randomVariation = 0.2;
    const minDelay = Math.floor(baseDelay * (1 - randomVariation)); // 80% bazowego
    const maxDelay = Math.floor(baseDelay * (1 + randomVariation)); // 120% bazowego
    const averageDelay = Math.floor((minDelay + maxDelay) / 2); // Średnia dla harmonogramu

    // ✅ PROSTA LOGIKA: Oblicz następny mail na podstawie ostatniego + minDelay (tak jak w scheduledSender)
    const lastSentTime = new Date(lastSentLog.createdAt);
    const timeSinceLastMail = Math.floor((now.getTime() - lastSentTime.getTime()) / 1000); // sekundy
    
    let nextEmailTime: Date;
    
    if (timeSinceLastMail < minDelay) {
      // Delay jeszcze nie minął - oblicz kiedy będzie następny (minDelay)
      const remainingDelay = minDelay - timeSinceLastMail;
      nextEmailTime = new Date(now.getTime() + remainingDelay * 1000);
    } else {
      // Delay już minął - następny mail będzie w kolejnym cron (za ~1 min, max 60s)
      // Ponieważ cron działa co 1 minutę, może być opóźnienie do 60s
      nextEmailTime = new Date(now.getTime() + 60 * 1000);
    }

    // Oblicz harmonogram dla kolejnych 5 maili (zaczynając od następnego)
    // Użyj średniego delay z losowością (żeby harmonogram pasował do rzeczywistej wysyłki)
    const schedule: Array<{ 
      emailNumber: number; 
      time: string; 
      delayFromPrevious: number;
      delayMin?: number; // Opcjonalnie: min delay (z -20%)
      delayMax?: number; // Opcjonalnie: max delay (z +20%)
    }> = [];
    let currentTime = new Date(nextEmailTime);
    
    for (let i = 1; i <= 5; i++) {
      const scheduleTime = new Date(currentTime);
      
      schedule.push({
        emailNumber: i,
        time: scheduleTime.toLocaleTimeString('pl-PL', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        delayFromPrevious: i === 1 ? 0 : averageDelay,
        delayMin: i === 1 ? undefined : minDelay,
        delayMax: i === 1 ? undefined : maxDelay
      });
      
      // Następny mail będzie za średnim delay sekund (z uwzględnieniem losowości ±20%)
      currentTime = new Date(currentTime.getTime() + averageDelay * 1000);
    }

    return NextResponse.json({
      isActive: true,
      nextEmailTime: nextEmailTime.toISOString(),
      delaySeconds: averageDelay,
      emailsPerDay,
      sentToday,
      remainingEmailsToday,
      timeRemainingInWindow: Math.floor(secondsRemaining / 60), // minuty
      lastSentAt: lastSentLog.createdAt.toISOString(),
      schedule,
      message: `Następny mail zostanie wysłany o ${nextEmailTime.toLocaleTimeString('pl-PL', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })}`
    });

  } catch (error: any) {
    console.error("Błąd obliczania czasu następnego maila:", error);
    return NextResponse.json(
      { error: error.message || "Błąd obliczania" },
      { status: 500 }
    );
  }
}

