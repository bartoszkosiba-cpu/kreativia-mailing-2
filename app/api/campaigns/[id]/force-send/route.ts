import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendNextEmailFromQueue } from "@/services/campaignEmailSenderV2";
import { addMinutes } from "date-fns";

/**
 * Testowy endpoint do wymuszenia wysyłki maila z kolejki
 * Użyj tylko do debugowania - wymusza wysłanie nawet jeśli warunki nie są spełnione
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const now = new Date();
    
    // Sprawdź czy kampania istnieje
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: true
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie znaleziona" }, { status: 404 });
    }

    // Sprawdź kolejkę - szczegółowe informacje
    const toleranceWindow = addMinutes(now, 5);
    const nextEmail = await db.campaignEmailQueue.findFirst({
      where: {
        campaignId,
        status: "pending",
        scheduledAt: { lte: toleranceWindow }
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        campaignLead: {
          include: {
            lead: true
          }
        }
      }
    });

    const queueInfo = {
      totalPending: await db.campaignEmailQueue.count({
        where: { campaignId, status: "pending" }
      }),
      totalSending: await db.campaignEmailQueue.count({
        where: { campaignId, status: "sending" }
      }),
      nextEmail: nextEmail ? {
        id: nextEmail.id,
        scheduledAt: nextEmail.scheduledAt,
        isPastDue: new Date(nextEmail.scheduledAt) < now,
        leadEmail: nextEmail.campaignLead.lead?.email,
        minutesPast: Math.floor((now.getTime() - new Date(nextEmail.scheduledAt).getTime()) / 1000 / 60)
      } : null
    };

    // Sprawdź dostępność skrzynek
    let mailboxInfo = null;
    if (campaign.virtualSalesperson) {
      const { getNextAvailableMailbox } = await import("@/services/mailboxManager");
      const mailbox = await getNextAvailableMailbox(campaign.virtualSalesperson.id);
      mailboxInfo = mailbox ? {
        email: mailbox.email,
        remaining: mailbox.remainingToday
      } : {
        error: "Brak dostępnych skrzynek"
      };
    }

    // ✅ V2: Wymuś wysłanie maila z kolejki V2
    console.log(`[FORCE-SEND] 🔧 Wymuszam wysłanie maila dla kampanii ${campaignId}`);
    const result = await sendNextEmailFromQueue(campaignId);

    return NextResponse.json({
      success: result.success,
      mailSent: result.mailSent,
      error: result.error,
      campaignId: campaignId,
      message: result.mailSent 
        ? "Mail został wysłany" 
        : result.error 
          ? `Błąd: ${result.error}`
          : "Mail nie został wysłany (sprawdź logi)",
      debug: {
        campaignStatus: campaign.status,
        hasVirtualSalesperson: !!campaign.virtualSalesperson,
        queueInfo,
        mailboxInfo,
        now: now.toISOString()
      }
    });
  } catch (error: any) {
    console.error("[FORCE-SEND] ❌ Błąd:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

