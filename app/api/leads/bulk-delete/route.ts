import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  try {
    const { leadIds } = await req.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "Nieprawidłowa lista ID leadów" }, { status: 400 });
    }

    // Sprawdź czy leady istnieją
    const existingLeads = await db.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true }
    });

    if (existingLeads.length === 0) {
      return NextResponse.json({ error: "Nie znaleziono leadów do usunięcia" }, { status: 404 });
    }

    // Usuń powiązania w tabeli CampaignLead
    await db.campaignLead.deleteMany({
      where: { leadId: { in: leadIds } }
    });

    // Usuń powiązania w tabeli LeadTag
    await db.leadTag.deleteMany({
      where: { leadId: { in: leadIds } }
    });

    // Usuń powiązania w tabeli SendLog
    await db.sendLog.deleteMany({
      where: { leadId: { in: leadIds } }
    });

    // Usuń powiązania w tabeli InboxReply
    await db.inboxReply.updateMany({
      where: { leadId: { in: leadIds } },
      data: { leadId: null }
    });

    // Usuń leady
    const deletedLeads = await db.lead.deleteMany({
      where: { id: { in: leadIds } }
    });

    return NextResponse.json({ 
      message: `Usunięto ${deletedLeads.count} leadów`,
      deletedCount: deletedLeads.count
    });

  } catch (error: any) {
    console.error("Błąd usuwania leadów:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
