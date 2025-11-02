import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH - Aktualizuj kampanię (częściowo)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const body = await req.json();

    // Sprawdź czy kampania istnieje
    const existingCampaign = await db.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!existingCampaign) {
      return NextResponse.json(
        { success: false, error: "Kampania nie istnieje" },
        { status: 404 }
      );
    }

    // Przygotuj dane do aktualizacji
    const updateData: any = {};

    // Automatyczne odpowiedzi z materiałami
    if (body.autoReplyEnabled !== undefined) {
      // Upewnij się że wartość jest boolean (nie string)
      const boolValue = typeof body.autoReplyEnabled === 'boolean' 
        ? body.autoReplyEnabled 
        : body.autoReplyEnabled === true || body.autoReplyEnabled === 'true';
      updateData.autoReplyEnabled = boolValue;
      console.log(`[CAMPAIGN PATCH] autoReplyEnabled: ${JSON.stringify(body.autoReplyEnabled)} (type: ${typeof body.autoReplyEnabled}) → ${boolValue} (type: ${typeof boolValue})`);
    }
    if (body.autoReplyContext !== undefined) {
      updateData.autoReplyContext = body.autoReplyContext?.trim() || null;
    }
    if (body.autoReplyRules !== undefined) {
      updateData.autoReplyRules = body.autoReplyRules?.trim() || null;
    }
    if (body.autoReplyDelayMinutes !== undefined) {
      updateData.autoReplyDelayMinutes = parseInt(body.autoReplyDelayMinutes) || 15;
    }

    // Inne pola kampanii (jeśli są w body)
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.subject !== undefined) updateData.subject = body.subject?.trim() || null;
    if (body.text !== undefined) updateData.text = body.text?.trim() || null;

    // Aktualizuj kampanię
    const campaign = await db.campaign.update({
      where: { id: campaignId },
      data: updateData,
      include: {
        materials: {
          where: { isActive: true },
          orderBy: { order: 'asc' }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    console.error("[CAMPAIGN] Błąd aktualizacji kampanii:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas aktualizacji kampanii" },
      { status: 500 }
    );
  }
}

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

