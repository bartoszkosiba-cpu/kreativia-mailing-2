import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz leady kampanii
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);

    // Pobierz leady kampanii
    const campaignLeads = await db.campaignLead.findMany({
      where: { campaignId },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            status: true
          }
        }
      }
    });

    // Sprawdź które leady już otrzymały mail
    const sentLogs = await db.sendLog.findMany({
      where: {
        campaignId,
        status: "sent"
      },
      select: {
        leadId: true
      }
    });
    
    const sentLeadIds = new Set(sentLogs.map(log => log.leadId));
    
    // Filtruj tylko aktywne leady (nie zablokowane)
    const leadsWithStatus = campaignLeads
      .filter(cl => cl.lead.status !== 'BLOCKED')
      .map(cl => ({
        id: cl.lead.id,
        firstName: cl.lead.firstName,
        lastName: cl.lead.lastName,
        email: cl.lead.email,
        company: cl.lead.company,
        hasSentEmail: sentLeadIds.has(cl.lead.id)
      }));

    return NextResponse.json({ leads: leadsWithStatus });

  } catch (error: any) {
    console.error("Błąd pobierania leadów kampanii:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Usuń leada/lidów z kampanii
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const body = await req.json();
    const leadIds = body.leadIds || (body.leadId ? [body.leadId] : []);

    if (leadIds.length === 0) {
      return NextResponse.json({ 
        error: "Brak leadów do usunięcia" 
      }, { status: 400 });
    }

    // Sprawdź czy kampania istnieje i jej status
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie istnieje" }, { status: 404 });
    }

    // Blokada edycji podczas wysyłki
    if (campaign.status === "IN_PROGRESS") {
      return NextResponse.json({ 
        error: "Nie można edytować leadów podczas wysyłki kampanii" 
      }, { status: 400 });
    }

    // Sprawdź które leady już otrzymały mail
    const alreadySent = await db.sendLog.findMany({
      where: {
        campaignId,
        leadId: { in: leadIds },
        status: "sent"
      }
    });

    if (alreadySent.length > 0) {
      const sentIds = alreadySent.map(log => log.leadId);
      // Filtruj tylko leady które jeszcze nie otrzymały maila
      const idsToRemove = leadIds.filter(id => !sentIds.includes(id));
      
      if (idsToRemove.length === 0) {
        return NextResponse.json({ 
          error: "Wszystkie zaznaczone leady już otrzymały mail i nie można ich usunąć" 
        }, { status: 400 });
      }

      // Usuń tylko te które można usunąć
      await db.campaignLead.deleteMany({
        where: {
          campaignId,
          leadId: { in: idsToRemove }
        }
      });

      return NextResponse.json({ 
        message: `Usunięto ${idsToRemove.length} leadów z kampanii (${alreadySent.length} pominięto - już wysłano mail)` 
      });
    }

    // Usuń wszystkie
    await db.campaignLead.deleteMany({
      where: {
        campaignId,
        leadId: { in: leadIds }
      }
    });

    return NextResponse.json({ 
      message: `Usunięto ${leadIds.length} leadów z kampanii` 
    });

  } catch (error: any) {
    console.error("Błąd usuwania leada z kampanii:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Dodaj leadów do kampanii
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const { leadIds } = await req.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ 
        error: "Brak leadów do dodania" 
      }, { status: 400 });
    }

    // Sprawdź czy kampania istnieje i jej status
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie istnieje" }, { status: 404 });
    }

    // Blokada edycji podczas wysyłki
    if (campaign.status === "IN_PROGRESS") {
      return NextResponse.json({ 
        error: "Nie można edytować leadów podczas wysyłki kampanii" 
      }, { status: 400 });
    }

    // Sprawdź które leady już są w kampanii
    const existing = await db.campaignLead.findMany({
      where: {
        campaignId,
        leadId: {
          in: leadIds
        }
      }
    });

    const existingIds = existing.map(cl => cl.leadId);
    const newLeadIds = leadIds.filter(id => !existingIds.includes(id));

    // Sprawdź status leadów
    const leadsToCheck = await db.lead.findMany({
      where: {
        id: { in: newLeadIds }
      },
      select: {
        id: true,
        email: true,
        status: true,
        greetingForm: true,
        language: true
      }
    });

    // BLOKUJ ZABLOKOWANYCH LEADÓW
    const blockedLeads = leadsToCheck.filter(lead => lead.status === 'BLOCKED' || lead.status === 'BLOKADA');
    if (blockedLeads.length > 0) {
      return NextResponse.json({ 
        error: `Nie można dodać ${blockedLeads.length} zablokowanych leadów do kampanii. Ledy zostały odblokowane lub usunięte.`,
        blockedLeads: blockedLeads.map(lead => ({
          id: lead.id,
          email: lead.email,
          status: lead.status
        }))
      }, { status: 400 });
    }

    // ✅ NOWE: Automatycznie dodaj powitania dla leadów które nie mają
    const leadsWithoutGreeting = leadsToCheck.filter(lead => 
      lead.status === "NO_GREETING" || !lead.greetingForm
    );

    if (leadsWithoutGreeting.length > 0) {
      console.log(`[CAMPAIGN LEADS] Znaleziono ${leadsWithoutGreeting.length} leadów bez powitania - generuję domyślne...`);
      
      // Generuj powitania dla leadów bez nich
      for (const lead of leadsWithoutGreeting) {
        const lang = lead.language || "pl";
        let defaultGreeting: string;
        
        if (lang === "en") defaultGreeting = "Hello,";
        else if (lang === "de") defaultGreeting = "Guten Tag,";
        else if (lang === "fr") defaultGreeting = "Bonjour,";
        else defaultGreeting = "Dzień dobry,";
        
        await db.lead.update({
          where: { id: lead.id },
          data: { greetingForm: defaultGreeting }
        });
        
        console.log(`[CAMPAIGN LEADS] Dodano domyślne powitanie dla ${lead.email}: "${defaultGreeting}"`);
      }
    }

    // Dodaj nowe powiązania
    const created = await db.campaignLead.createMany({
      data: newLeadIds.map(leadId => ({
        campaignId,
        leadId
      }))
    });

    return NextResponse.json({ 
      message: `Dodano ${created.count} leadów do kampanii`,
      addedCount: created.count,
      skippedCount: existingIds.length
    });

  } catch (error: any) {
    console.error("Błąd dodawania leadów do kampanii:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
