import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Filtry
    const type = searchParams.get("type"); // "sent", "received", "all"
    const campaignId = searchParams.get("campaignId");
    const leadEmail = searchParams.get("leadEmail");
    const search = searchParams.get("search"); // full-text search
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const classification = searchParams.get("classification");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let sentEmails: any[] = [];
    let receivedEmails: any[] = [];

    // Pobierz wysłane maile (SendLog)
    if (type === "sent" || type === "all" || !type) {
      const sentWhere: any = {};
      
      if (campaignId) sentWhere.campaignId = parseInt(campaignId);
      if (leadEmail) {
        sentWhere.lead = { email: { contains: leadEmail } };
      }
      if (status) sentWhere.status = status;
      // Search temporarily simplified - full-text search requires more complex Prisma queries
      if (search && !leadEmail) {
        sentWhere.lead = { 
          company: { contains: search }
        };
      }
      if (dateFrom || dateTo) {
        sentWhere.createdAt = {};
        if (dateFrom) sentWhere.createdAt.gte = new Date(dateFrom);
        if (dateTo) sentWhere.createdAt.lte = new Date(dateTo);
      }

      sentEmails = await db.sendLog.findMany({
        where: sentWhere,
        include: {
          lead: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              company: true,
              status: true
            }
          },
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
              subject: true,
              text: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: type === "all" ? limit / 2 : limit,
        skip: offset
      });
    }

    // Pobierz odebrane maile (InboxReply)
    if (type === "received" || type === "all" || !type) {
      const receivedWhere: any = {};
      
      if (campaignId) receivedWhere.campaignId = parseInt(campaignId);
      if (leadEmail) receivedWhere.fromEmail = { contains: leadEmail };
      if (classification) receivedWhere.classification = classification;
      // Search temporarily simplified
      if (search && !leadEmail) {
        receivedWhere.fromEmail = { contains: search };
      }
      if (dateFrom || dateTo) {
        receivedWhere.receivedAt = {};
        if (dateFrom) receivedWhere.receivedAt.gte = new Date(dateFrom);
        if (dateTo) receivedWhere.receivedAt.lte = new Date(dateTo);
      }

      receivedEmails = await db.inboxReply.findMany({
        where: receivedWhere,
        include: {
          lead: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              company: true,
              status: true
            }
          },
          campaign: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        },
        orderBy: { receivedAt: "desc" },
        take: type === "all" ? limit / 2 : limit,
        skip: offset
      });
    }

    // Formatuj dane do ujednoliconej struktury
    const history = [
      ...sentEmails.map((email) => ({
        id: `sent-${email.id}`,
        sequenceNumber: email.id, // Użyj ID jako numeru sekwencyjnego
        type: "sent" as const,
        date: email.createdAt,
        leadId: email.leadId,
        leadEmail: email.lead?.email || "N/A",
        leadName: email.lead ? `${email.lead.firstName || ""} ${email.lead.lastName || ""}`.trim() : "N/A",
        leadCompany: email.lead?.company || "N/A",
        leadStatus: email.lead?.status || "N/A",
        campaignId: email.campaignId,
        campaignName: email.campaign?.name || "N/A",
        campaignStatus: email.campaign?.status || "N/A",
        subject: email.campaign?.subject || "N/A",
        status: email.status, // sent, failed, bounced
        classification: null,
        sentiment: null,
        aiSummary: null,
        content: email.campaign?.text || null,
        systemActions: [] // Wysłane maile nie mają akcji systemowych
      })),
      ...receivedEmails.map((email) => {
        // Zbierz akcje systemowe
        const systemActions: string[] = [];
        if (email.wasForwarded) systemActions.push("Przekazano do handlowca");
        if (email.wasBlocked) systemActions.push("Lead zablokowany");
        if (email.newContactsAdded > 0) systemActions.push(`Dodano ${email.newContactsAdded} nowych kontaktów`);
        if (email.isHandled) systemActions.push("Obsłużone ręcznie");
        
        return {
          id: `received-${email.id}`,
          sequenceNumber: email.id,
          type: "received" as const,
          date: email.receivedAt,
          leadId: email.leadId,
          leadEmail: email.fromEmail,
          leadName: email.lead ? `${email.lead.firstName || ""} ${email.lead.lastName || ""}`.trim() : "Nieznany",
          leadCompany: email.lead?.company || "N/A",
          leadStatus: email.lead?.status || "N/A",
          campaignId: email.campaignId,
          campaignName: email.campaign?.name || "N/A",
          campaignStatus: email.campaign?.status || "N/A",
          subject: email.subject || "N/A",
          status: null,
          classification: email.classification,
          sentiment: email.sentiment,
          aiSummary: email.aiSummary,
          content: email.content,
          systemActions
        };
      })
    ];

    // Sortuj wszystko po dacie (najnowsze pierwsze)
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Statystyki
    const stats = {
      totalSent: type === "received" ? 0 : await db.sendLog.count(),
      totalReceived: type === "sent" ? 0 : await db.inboxReply.count(),
      total: history.length
    };

    return NextResponse.json({
      success: true,
      history: history.slice(0, limit),
      stats,
      hasMore: history.length > limit
    });

  } catch (error) {
    console.error("[HISTORY API] Błąd:", error);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania historii" },
      { status: 500 }
    );
  }
}

