import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Sprawdza status skrzynek dla kampanii
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
        virtualSalesperson: {
          include: {
            mailboxes: {
              where: { isActive: true },
              orderBy: { priority: "asc" }
            }
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie znaleziona" }, { status: 404 });
    }

    if (!campaign.virtualSalesperson) {
      return NextResponse.json({ error: "Kampania nie ma przypisanego handlowca" }, { status: 404 });
    }

    const mailboxes = campaign.virtualSalesperson.mailboxes.map(mb => ({
      id: mb.id,
      email: mb.email,
      dailyEmailLimit: mb.dailyEmailLimit,
      currentDailySent: mb.currentDailySent,
      remaining: mb.dailyEmailLimit - mb.currentDailySent,
      warmupStatus: mb.warmupStatus,
      isAvailable: (mb.dailyEmailLimit - mb.currentDailySent) > 0
    }));

    const totalRemaining = mailboxes.reduce((sum, mb) => sum + mb.remaining, 0);
    const availableCount = mailboxes.filter(mb => mb.isAvailable).length;

    return NextResponse.json({
      campaignId,
      salesperson: campaign.virtualSalesperson.name,
      mailboxes,
      summary: {
        total: mailboxes.length,
        available: availableCount,
        unavailable: mailboxes.length - availableCount,
        totalRemaining
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}


