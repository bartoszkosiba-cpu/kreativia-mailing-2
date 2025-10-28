import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Filtry
    const type = searchParams.get("type"); // "sent", "received", "warmup", "all"
    const mailboxId = searchParams.get("mailboxId");
    const campaignId = searchParams.get("campaignId");
    const leadEmail = searchParams.get("leadEmail");
    const search = searchParams.get("search"); // full-text search
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const classification = searchParams.get("classification");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let allEmails: any[] = [];

    // Pobierz wysłane maile (SendLog)
    if (!type || type === "sent" || type === "all") {
      const sentWhere: any = {};
      
      if (mailboxId) sentWhere.mailboxId = parseInt(mailboxId);
      if (campaignId) sentWhere.campaignId = parseInt(campaignId);
      if (leadEmail) sentWhere.lead = { email: { contains: leadEmail } };
      if (status) sentWhere.status = status;
      if (dateFrom || dateTo) {
        sentWhere.createdAt = {};
        if (dateFrom) sentWhere.createdAt.gte = new Date(dateFrom);
        if (dateTo) sentWhere.createdAt.lte = new Date(dateTo);
      }

      const sentEmails = await db.sendLog.findMany({
        where: sentWhere,
        include: {
          lead: true,
          campaign: true,
          mailbox: {
            include: {
              virtualSalesperson: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      allEmails.push(...sentEmails.map(email => {
        // Określ kategorię maila
        const isNotification = email.subject?.includes('[LEAD ZAINTERESOWANY]') || email.subject?.includes('[NOWY LEAD]');
        const emailType = isNotification ? "NOTIFICATION" : (email.campaignId && email.leadId ? "CAMPAIGN" : "TEST");
        const direction = "outgoing";
        const source = isNotification ? "notification" : (email.campaignId ? "campaign" : "verification");
        
        // Dla powiadomień: użyj zapisany toEmail, dla zwykłych maili: użyj email leada
        let toEmail = "Nieznany odbiorca";
        if (isNotification && email.toEmail) {
          // Dla powiadomień: użyj zapisany odbiorca
          toEmail = email.toEmail;
        } else {
          // Dla zwykłych maili: użyj email leada lub skrzynki
          toEmail = email.lead?.email || email.mailbox?.email || "Nieznany odbiorca";
        }
        
        return {
          id: `sent-${email.id}`,
          type: "sent",
          date: email.createdAt,
          fromEmail: email.mailbox?.email || "Nieznana skrzynka",
          toEmail: toEmail,
          subject: email.subject || "Brak tematu",
          content: email.content,
          status: email.status,
          error: email.error,
          leadId: email.leadId,
          leadName: email.lead ? `${email.lead.firstName || ''} ${email.lead.lastName || ''}`.trim() || email.lead.email : "Test/Weryfikacja",
          leadCompany: email.lead?.company || null,
          campaignId: email.campaignId,
          campaignName: email.campaign?.name || "Brak kampanii",
          mailboxId: email.mailboxId,
          mailboxName: email.mailbox?.displayName || email.mailbox?.email,
          salespersonName: email.mailbox?.virtualSalesperson?.name,
          classification: isNotification ? "NOTIFICATION" : null,
          sentiment: null,
          aiSummary: null,
          emailType,
          direction,
          source
        };
      }));
    }

    // Pobierz odebrane maile (InboxReply)
    if (!type || type === "received" || type === "all") {
      const receivedWhere: any = {};
      
      if (mailboxId) receivedWhere.toEmail = { contains: mailboxId };
      if (campaignId) receivedWhere.campaignId = parseInt(campaignId);
      if (leadEmail) receivedWhere.fromEmail = { contains: leadEmail };
      if (classification) receivedWhere.classification = classification;
      if (dateFrom || dateTo) {
        receivedWhere.receivedAt = {};
        if (dateFrom) receivedWhere.receivedAt.gte = new Date(dateFrom);
        if (dateTo) receivedWhere.receivedAt.lte = new Date(dateTo);
      }

      const receivedEmails = await db.inboxReply.findMany({
        where: receivedWhere,
        include: {
          lead: true,
          campaign: true
        },
        orderBy: { receivedAt: 'desc' }
      });

      allEmails.push(...receivedEmails.map(email => {
        // Określ kategorię maila przychodzącego
        let emailType: string;
        let direction = "incoming";
        let source: string;
        
        if (email.classification === "INTERNAL_WARMUP") {
          // Mail wewnętrzny - sprawdź czy to test czy warmup
          emailType = email.subject?.includes("[TEST]") ? "TEST" : "WARMUP";
          source = emailType === "TEST" ? "verification" : "warmup";
        } else if (email.classification === "BOUNCE") {
          // BOUNCE - zawsze jako UNKNOWN (odbicie)
          emailType = "UNKNOWN";
          source = "bounce";
        } else if (!email.leadId) {
          // Brak leada - obcy mail
          emailType = "UNKNOWN";
          source = "unknown";
        } else if (email.campaignId) {
          // Jest lead i kampania - odpowiedź od leada z kampanii
          emailType = "CAMPAIGN";
          source = "campaign";
        } else {
          // Jest lead ale brak kampanii - obcy mail (ale z leadem)
          emailType = "UNKNOWN";
          source = "unknown";
        }
        
        return {
          id: `received-${email.id}`,
          type: "received",
          date: email.receivedAt,
          fromEmail: email.fromEmail,
          toEmail: email.toEmail || "Nieznana skrzynka",
          subject: email.subject,
          content: email.content,
          status: email.isHandled ? "handled" : "unhandled",
          error: null,
          leadId: email.leadId,
          leadName: email.lead ? `${email.lead.firstName || ''} ${email.lead.lastName || ''}`.trim() || email.lead.email : email.fromEmail,
          leadCompany: email.lead?.company,
          campaignId: email.campaignId,
          campaignName: email.campaign?.name,
          mailboxId: null,
          mailboxName: email.toEmail,
          salespersonName: null,
          classification: email.classification,
          sentiment: email.sentiment,
          aiSummary: email.aiSummary,
          emailType,
          direction,
          source
        };
      }));
    }

    // Pobierz maile warmup (WarmupEmail)
    if (!type || type === "warmup" || type === "all") {
      const warmupWhere: any = {};
      
      if (mailboxId) warmupWhere.mailboxId = parseInt(mailboxId);
      if (status) warmupWhere.status = status;
      if (dateFrom || dateTo) {
        warmupWhere.createdAt = {};
        if (dateFrom) warmupWhere.createdAt.gte = new Date(dateFrom);
        if (dateTo) warmupWhere.createdAt.lte = new Date(dateTo);
      }

      const warmupEmails = await db.warmupEmail.findMany({
        where: warmupWhere,
        include: {
          mailbox: {
            include: {
              virtualSalesperson: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      allEmails.push(...warmupEmails.map(email => ({
        id: `warmup-${email.id}`,
        type: "warmup",
        date: email.createdAt,
        fromEmail: email.mailbox.email,
        toEmail: email.toEmail,
        subject: email.subject,
        content: email.content,
        status: email.status,
        error: email.errorMessage,
        leadId: null,
        leadName: email.toEmail,
        leadCompany: null,
        campaignId: null,
        campaignName: `Warmup ${email.type}`,
        mailboxId: email.mailboxId,
        mailboxName: email.mailbox.displayName || email.mailbox.email,
        salespersonName: email.mailbox.virtualSalesperson?.name,
        classification: null,
        sentiment: null,
        aiSummary: null,
        warmupDay: email.warmupDay,
        warmupPhase: email.warmupPhase,
        emailType: "WARMUP",
        direction: "outgoing",
        source: "warmup"
      })));
    }

    // Sortuj wszystkie maile po dacie (najnowsze pierwsze)
    allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filtruj po wyszukiwaniu tekstowym
    if (search) {
      const searchLower = search.toLowerCase();
      allEmails = allEmails.filter(email => 
        email.subject?.toLowerCase().includes(searchLower) ||
        email.content?.toLowerCase().includes(searchLower) ||
        email.fromEmail?.toLowerCase().includes(searchLower) ||
        email.toEmail?.toLowerCase().includes(searchLower) ||
        email.leadName?.toLowerCase().includes(searchLower) ||
        email.leadCompany?.toLowerCase().includes(searchLower) ||
        email.campaignName?.toLowerCase().includes(searchLower)
      );
    }

    // Filtruj po kampanii (jeśli podano)
    if (campaignId) {
      const campaignIdNum = parseInt(campaignId);
      if (!isNaN(campaignIdNum)) {
        allEmails = allEmails.filter(email => email.campaignId === campaignIdNum);
      } else {
        // Wyszukiwanie po nazwie kampanii
        const campaignNameLower = campaignId.toLowerCase();
        allEmails = allEmails.filter(email => 
          email.campaignName?.toLowerCase().includes(campaignNameLower)
        );
      }
    }

    // Statystyki
    const stats = {
      total: allEmails.length,
      sent: allEmails.filter(e => e.type === "sent").length,
      received: allEmails.filter(e => e.type === "received").length,
      warmup: allEmails.filter(e => e.type === "warmup").length,
      byStatus: allEmails.reduce((acc, email) => {
        acc[email.status] = (acc[email.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byClassification: allEmails.reduce((acc, email) => {
        if (email.classification) {
          acc[email.classification] = (acc[email.classification] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({
      success: true,
      data: {
        emails: allEmails.slice(offset, offset + limit),
        stats,
        total: allEmails.length,
        pagination: {
          limit,
          offset,
          total: allEmails.length
        }
      }
    });

  } catch (error) {
    console.error("[ARCHIVE] Błąd pobierania archiwum:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas pobierania archiwum maili" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/archive - Usuń maile z archiwum
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type"); // "sent", "received", "warmup", "all"
    const olderThan = searchParams.get("olderThan"); // Data w formacie ISO string
    
    let deletedCount = 0;

    if (type === "sent" || type === "all" || !type) {
      const whereClause: any = {};
      if (olderThan) {
        whereClause.createdAt = { lt: new Date(olderThan) };
      }
      
      const result = await db.sendLog.deleteMany({ where: whereClause });
      deletedCount += result.count;
    }

    if (type === "received" || type === "all" || !type) {
      const whereClause: any = {};
      if (olderThan) {
        whereClause.receivedAt = { lt: new Date(olderThan) };
      }
      
      const result = await db.inboxReply.deleteMany({ where: whereClause });
      deletedCount += result.count;
    }

    if (type === "warmup" || type === "all" || !type) {
      const whereClause: any = {};
      if (olderThan) {
        whereClause.createdAt = { lt: new Date(olderThan) };
      }
      
      const result = await db.warmupEmail.deleteMany({ where: whereClause });
      deletedCount += result.count;
    }

    return NextResponse.json({
      success: true,
      message: `Usunięto ${deletedCount} rekordów z archiwum`,
      deletedCount
    });

  } catch (error) {
    console.error('[ARCHIVE DELETE] Błąd usuwania:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Błąd podczas usuwania maili',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
