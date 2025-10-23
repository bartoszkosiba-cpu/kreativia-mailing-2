import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE - Usuń kampanię
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);

    // Sprawdź czy kampania istnieje
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie istnieje" }, { status: 404 });
    }

    // Usuń powiązane rekordy w odpowiedniej kolejności
    // 1. SendLog
    await db.sendLog.deleteMany({
      where: { campaignId }
    });

    // 2. InboxReply
    await db.inboxReply.deleteMany({
      where: { campaignId }
    });

    // 3. CampaignLead
    await db.campaignLead.deleteMany({
      where: { campaignId }
    });

    // 4. Follow-up campaigns (jeśli to parent)
    await db.campaign.updateMany({
      where: { parentCampaignId: campaignId },
      data: { parentCampaignId: null }
    });

    // 5. Usuń samą kampanię
    await db.campaign.delete({
      where: { id: campaignId }
    });

    return NextResponse.json({ 
      message: "Kampania została usunięta" 
    });

  } catch (error: any) {
    console.error("Błąd usuwania kampanii:", error);
    return NextResponse.json({ 
      error: "Wystąpił błąd podczas usuwania kampanii",
      details: error.message 
    }, { status: 500 });
  }
}

