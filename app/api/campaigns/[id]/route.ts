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
      const oldAutoReplyEnabled = existingCampaign.autoReplyEnabled;
      updateData.autoReplyEnabled = boolValue;
      console.log(`[CAMPAIGN PATCH] autoReplyEnabled: ${JSON.stringify(body.autoReplyEnabled)} (type: ${typeof body.autoReplyEnabled}) → ${boolValue} (type: ${typeof boolValue})`);
      
      // ✅ Jeśli wyłączamy automatyczne odpowiedzi, anuluj wszystkie MaterialResponse w statusie 'scheduled'
      if (oldAutoReplyEnabled && !boolValue) {
        console.log(`[CAMPAIGN PATCH] ⚠️ Wyłączono automatyczne odpowiedzi dla kampanii ${campaignId} - anuluję zaplanowane MaterialResponse`);
        const cancelledCount = await db.materialResponse.updateMany({
          where: {
            campaignId: campaignId,
            status: 'scheduled'
          },
          data: {
            status: 'cancelled',
            error: 'Automatyczne odpowiedzi zostały wyłączone dla tej kampanii'
          }
        });
        if (cancelledCount.count > 0) {
          console.log(`[CAMPAIGN PATCH] ✅ Anulowano ${cancelledCount.count} MaterialResponse w statusie 'scheduled'`);
        }
      }
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
    if (body.autoReplyContent !== undefined) {
      updateData.autoReplyContent = body.autoReplyContent?.trim() || null;
    }
    if (body.autoReplyGuardianTemplate !== undefined) {
      updateData.autoReplyGuardianTemplate = body.autoReplyGuardianTemplate?.trim() || null;
    }
    if (body.autoReplyGuardianTitle !== undefined) {
      updateData.autoReplyGuardianTitle = body.autoReplyGuardianTitle?.trim() || null;
    }
    if (body.autoReplyIncludeGuardian !== undefined) {
      // ✅ NOWE: Upewnij się że wartość jest boolean
      const boolValue = typeof body.autoReplyIncludeGuardian === 'boolean' 
        ? body.autoReplyIncludeGuardian 
        : (body.autoReplyIncludeGuardian === true || body.autoReplyIncludeGuardian === 'true' || body.autoReplyIncludeGuardian === 1 || body.autoReplyIncludeGuardian === '1');
      updateData.autoReplyIncludeGuardian = boolValue;
      console.log(`[CAMPAIGN PATCH] autoReplyIncludeGuardian: ${JSON.stringify(body.autoReplyIncludeGuardian)} (type: ${typeof body.autoReplyIncludeGuardian}) → ${boolValue} (type: ${typeof boolValue})`);
    }
    if (body.autoReplyGuardianIntroText !== undefined) {
      // ✅ NOWE: Poprawna obsługa pustego stringa - jeśli pusty lub tylko białe znaki, ustaw null
      const trimmedText = typeof body.autoReplyGuardianIntroText === 'string' 
        ? body.autoReplyGuardianIntroText.trim() 
        : null;
      updateData.autoReplyGuardianIntroText = trimmedText && trimmedText.length > 0 ? trimmedText : null;
    }

    // Inne pola kampanii (jeśli są w body)
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.subject !== undefined) updateData.subject = body.subject?.trim() || null;
    if (body.text !== undefined) updateData.text = body.text?.trim() || null;

    // Sprawdź czy są jakieś dane do aktualizacji
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: false,
        error: "Brak danych do aktualizacji"
      }, { status: 400 });
    }

    // Loguj dane przed aktualizacją (dla debuggingu)
    console.log(`[CAMPAIGN PATCH] Aktualizacja kampanii ${campaignId} z danymi:`, JSON.stringify(updateData, null, 2));

    // Aktualizuj kampanię
    try {
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
    } catch (updateError: any) {
      console.error("[CAMPAIGN] Błąd podczas update w Prisma:", updateError);
      console.error("[CAMPAIGN] Szczegóły błędu Prisma:", updateError.message);
      console.error("[CAMPAIGN] Metadane błędu:", updateError.meta);
      throw updateError; // Rzuć dalej aby obsłużyć w głównym catch
    }
  } catch (error: any) {
    console.error("[CAMPAIGN] Błąd aktualizacji kampanii:", error);
    console.error("[CAMPAIGN] Szczegóły błędu:", error.message);
    console.error("[CAMPAIGN] Stack trace:", error.stack);
    return NextResponse.json(
      { 
        success: false, 
        error: "Błąd podczas aktualizacji kampanii",
        details: error.message // ✅ Dodaj szczegóły błędu dla debuggingu
      },
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

