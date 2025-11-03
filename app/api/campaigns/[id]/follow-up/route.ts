import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/campaigns/[id]/follow-up
 * Tworzy kampanię follow-up dla wskazanej kampanii głównej
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const body = await request.json();
    
    const {
      followUpText,      // Treść follow-upu
      followUpDays,      // Po ilu dniach wysłać
      followUpSequence   // Numer follow-upu (1, 2, 3, ...)
    } = body;
    
    // Walidacja
    if (!followUpText || !followUpDays || !followUpSequence) {
      return NextResponse.json(
        { error: "Brak wymaganych pól: followUpText, followUpDays, followUpSequence" },
        { status: 400 }
      );
    }
    
    if (followUpSequence < 1 || followUpSequence > 10) {
      return NextResponse.json(
        { error: "followUpSequence musi być między 1 a 10" },
        { status: 400 }
      );
    }
    
    // Pobierz kampanię nadrzędną
    const parentCampaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: true,
        CampaignLead: {
          where: {
            lead: {
              status: {
                not: "BLOCKED" // Licz tylko aktywne leady
              }
            }
          },
          include: {
            lead: true
          }
        },
        followUpCampaigns: true
      }
    });
    
    if (!parentCampaign) {
      return NextResponse.json(
        { error: "Nie znaleziono kampanii" },
        { status: 404 }
      );
    }
    
    // Sprawdź czy follow-up o tym numerze już istnieje
    const existingFollowUp = parentCampaign.followUpCampaigns.find(
      fu => fu.followUpSequence === followUpSequence
    );
    
    if (existingFollowUp) {
      return NextResponse.json(
        { error: `Follow-up #${followUpSequence} już istnieje (ID: ${existingFollowUp.id})` },
        { status: 400 }
      );
    }
    
    // Znajdź leadów którzy NIE odpowiedzieli lub odpowiedzieli OOO
    const allLeadIds = parentCampaign.CampaignLead.map(cl => cl.leadId);
    
    console.log(`[FOLLOW-UP] Leady w kampanii głównej: ${allLeadIds.length}`);
    
    // Pobierz odpowiedzi dla tych leadów (dla TEJ kampanii lub bez kampanii - bounce'y)
    const replies = await db.inboxReply.findMany({
      where: {
        leadId: { in: allLeadIds },
        OR: [
          { campaignId: campaignId },
          { campaignId: null, classification: "BOUNCE" } // Uwzględnij bounce'y bez campaignId
        ]
      }
    });
    
    // Znajdź leadów dla follow-upu
    console.log(`[FOLLOW-UP] Analiza leadów dla follow-upu...`);
    console.log(`[FOLLOW-UP] Total leadów w kampanii: ${parentCampaign.CampaignLead.length}`);
    console.log(`[FOLLOW-UP] Znaleziono odpowiedzi: ${replies.length}`);
    
    // Pobierz wszystkie leady z oryginalnej kampanii
    const allLeads = await db.lead.findMany({
      where: { id: { in: allLeadIds } },
      include: { LeadTag: { include: { tag: true } } }
    });
    
    const leadsForFollowUp = allLeads.filter(lead => {
      // Pomijaj zablokowanych
      if (lead.isBlocked || lead.status === 'BLOKADA') {
        console.log(`[FOLLOW-UP] Pomijam ${lead.email} - zablokowany (${lead.blockedReason || lead.status})`);
        return false;
      }
      
      // ✅ NOWE: Pomijaj ZAINTERESOWANY z tej kampanii (dostali automatyczną odpowiedź lub forward)
      if (lead.status === 'ZAINTERESOWANY') {
        // Sprawdź czy kampania jest zablokowana
        let blockedCampaignsArray: number[] = [];
        if (lead.blockedCampaigns) {
          try {
            blockedCampaignsArray = JSON.parse(lead.blockedCampaigns);
          } catch (e) {
            console.warn(`[FOLLOW-UP] Błąd parsowania blockedCampaigns dla lead ${lead.id}:`, e);
            blockedCampaignsArray = [];
          }
        }
        
        if (blockedCampaignsArray.includes(campaignId)) {
          console.log(`[FOLLOW-UP] Pomijam ${lead.email} - kampania zablokowana (ZAINTERESOWANY, blockedCampaigns: ${blockedCampaignsArray.join(',')})`);
          return false;
        }
      }
      
      // Znajdź odpowiedź tego leada
      const leadReply = replies.find(r => r.leadId === lead.id);
      
      if (!leadReply) {
        // Brak odpowiedzi - dodaj do follow-upu
        console.log(`[FOLLOW-UP] ✅ Dodaję ${lead.email} - brak odpowiedzi`);
        return true;
      }
      
      // Dodaj tylko jeśli odpowiedź była OOO
      const shouldAdd = leadReply.classification === "OOO";
      if (shouldAdd) {
        console.log(`[FOLLOW-UP] ✅ Dodaję ${lead.email} - odpowiedź OOO`);
      } else {
        console.log(`[FOLLOW-UP] Pomijam ${lead.email} - odpowiedział: ${leadReply.classification}`);
      }
      return shouldAdd;
    });
    
    console.log(`[FOLLOW-UP] Leadów do follow-upu: ${leadsForFollowUp.length}`);
    
    if (leadsForFollowUp.length === 0) {
      return NextResponse.json(
        { 
          error: "Brak leadów do follow-upu (wszyscy odpowiedzieli lub są zablokowani)",
          leadsCount: 0
        },
        { status: 400 }
      );
    }
    
    // Oblicz datę zaplanowania follow-upu
    const parentCompletedAt = parentCampaign.sendingCompletedAt || new Date();
    const scheduledDate = new Date(parentCompletedAt);
    scheduledDate.setDate(scheduledDate.getDate() + followUpDays);
    
    // Utwórz kampanię follow-up
    const followUpCampaign = await db.campaign.create({
      data: {
        name: `${parentCampaign.name} - Follow-up ${followUpSequence}`,
        description: `Automatyczny follow-up #${followUpSequence} dla kampanii "${parentCampaign.name}"`,
        subject: `Re: ${parentCampaign.subject}`,
        text: followUpText,
        jobDescription: parentCampaign.jobDescription,
        postscript: parentCampaign.postscript,
        linkText: parentCampaign.linkText,
        linkUrl: parentCampaign.linkUrl,
        
        virtualSalespersonId: parentCampaign.virtualSalespersonId,
        
        // Follow-up specifics
        isFollowUp: true,
        parentCampaignId: parentCampaign.id,
        followUpSequence: followUpSequence,
        followUpDays: followUpDays,
        
        // Harmonogram - skopiuj z rodzica
        status: "SCHEDULED",
        scheduledAt: scheduledDate,
        delayBetweenEmails: parentCampaign.delayBetweenEmails,
        maxEmailsPerDay: parentCampaign.maxEmailsPerDay,
        allowedDays: parentCampaign.allowedDays,
        startHour: parentCampaign.startHour,
        endHour: parentCampaign.endHour,
        respectHolidays: parentCampaign.respectHolidays,
        targetCountries: parentCampaign.targetCountries,
        
        dailyLimit: parentCampaign.dailyLimit,
        queuePriority: parentCampaign.queuePriority
      }
    });
    
    // Dodaj leadów do follow-upu
    console.log(`[FOLLOW-UP] Dodawanie leadów do CampaignLead...`);
    console.log(`[FOLLOW-UP] leadsForFollowUp.length: ${leadsForFollowUp.length}`);
    
    let addedCount = 0;
    const errors: string[] = [];
    
    for (const lead of leadsForFollowUp) {
      console.log(`[FOLLOW-UP] Próbuję dodać leada ID: ${lead.id} (${lead.email}) do kampanii ${followUpCampaign.id}`);
      
      try {
        const created = await db.campaignLead.create({
          data: {
            campaignId: followUpCampaign.id,
            leadId: lead.id,
            status: 'planned',
            priority: 999 // Normalny priorytet dla follow-upów
          }
        });
        addedCount++;
        console.log(`[FOLLOW-UP] ✅ Dodano lead ${lead.email} - CampaignLead ID: ${created.id}`);
      } catch (error: any) {
        const errorMsg = `${lead.email}: ${error.message}`;
        console.error(`[FOLLOW-UP] ❌ Błąd dodawania leada:`, errorMsg);
        errors.push(errorMsg);
      }
    }
    
    console.log(`[FOLLOW-UP] PODSUMOWANIE: Dodano ${addedCount}/${leadsForFollowUp.length} leadów`);
    if (errors.length > 0) {
      console.error(`[FOLLOW-UP] Błędy (${errors.length}):`, errors);
    }
    
    console.log(`[FOLLOW-UP] Utworzono kampanię follow-up #${followUpSequence} z ${addedCount} leadami`);
    
    return NextResponse.json({
      success: true,
      followUpCampaign: {
        id: followUpCampaign.id,
        name: followUpCampaign.name,
        scheduledAt: followUpCampaign.scheduledAt,
        leadsCount: addedCount,
        expectedLeads: leadsForFollowUp.length,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `Utworzono follow-up #${followUpSequence} z ${addedCount} leadami. Wysyłka: ${scheduledDate.toLocaleDateString('pl-PL')}`,
      warning: errors.length > 0 ? `${errors.length} leadów nie zostało dodanych z powodu błędów` : undefined
    });
    
  } catch (error: any) {
    console.error("[API] Błąd tworzenia follow-upu:", error);
    return NextResponse.json(
      { error: error.message || "Błąd tworzenia follow-upu" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/[id]/follow-up
 * Pobiera informacje o możliwych follow-upach dla kampanii
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        CampaignLead: {
          where: {
            lead: {
              status: {
                not: "BLOCKED" // Licz tylko aktywne leady
              }
            }
          },
          include: {
            lead: true
          }
        },
        followUpCampaigns: {
          orderBy: {
            followUpSequence: 'asc'
          }
        }
      }
    });
    
    if (!campaign) {
      return NextResponse.json(
        { error: "Nie znaleziono kampanii" },
        { status: 404 }
      );
    }
    
    // Znajdź leadów bez odpowiedzi lub z OOO
    const allLeadIds = campaign.CampaignLead.map(cl => cl.leadId);
    
    const replies = await db.inboxReply.findMany({
      where: {
        leadId: { in: allLeadIds },
        OR: [
          { campaignId: campaignId },
          { campaignId: null, classification: "BOUNCE" } // Uwzględnij bounce'y bez campaignId (stare)
        ]
      }
    });
    
    let noReplyCount = 0;
    let oooCount = 0;
    let blockedCount = 0;
    
    // Policz statystyki dla leadów
    campaign.CampaignLead.forEach(cl => {
      const lead = cl.lead;
      
      // Zablokowane leady są już przefiltrowane w zapytaniu Prisma
      if (lead.status === 'BLOCKED') {
        blockedCount++;
        return;
      }
      
      const leadReply = replies.find(r => r.leadId === lead.id);
      
      if (!leadReply) {
        noReplyCount++;
      } else if (leadReply.classification === "OOO") {
        oooCount++;
      }
    });
    
    const eligibleForFollowUp = noReplyCount + oooCount;
    
    // Oblicz minimalny czas opóźnienia (czas trwania wysyłki)
    const leadsCount = campaign.CampaignLead.length;
    const delaySeconds = campaign.delayBetweenEmails;
    const totalSeconds = leadsCount * delaySeconds;
    const hoursPerDay = campaign.endHour - campaign.startHour;
    const minDays = Math.ceil((totalSeconds / 3600) / hoursPerDay);
    
    return NextResponse.json({
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      completedAt: campaign.sendingCompletedAt,
      stats: {
        total: campaign.CampaignLead.length,
        noReply: noReplyCount,
        ooo: oooCount,
        blocked: blockedCount,
        eligibleForFollowUp
      },
      existingFollowUps: campaign.followUpCampaigns.map(fu => ({
        id: fu.id,
        name: fu.name,
        sequence: fu.followUpSequence,
        status: fu.status,
        scheduledAt: fu.scheduledAt,
        daysDelay: fu.followUpDays
      })),
      minFollowUpDays: Math.max(minDays, 3), // Minimum 3 dni lub czas wysyłki
      maxFollowUps: 10
    });
    
  } catch (error: any) {
    console.error("[API] Błąd pobierania info o follow-upach:", error);
    return NextResponse.json(
      { error: error.message || "Błąd pobierania danych" },
      { status: 500 }
    );
  }
}

