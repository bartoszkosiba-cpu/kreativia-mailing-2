import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/inbox - pobierz listę odpowiedzi
 * Query params:
 * - filter: all | interested | replies | unsubscribe | ooo | redirect | other
 * - unreadOnly: true | false
 * - campaignId: number
 * - classification: INTERESTED | NOT_INTERESTED | MAYBE_LATER | REDIRECT | OOO | BOUNCE | UNSUBSCRIBE | OTHER
 * - status: all | handled | unhandled
 * - search: string (wyszukiwanie w subject, content, fromEmail, toEmail, lead name/company)
 * - dateFrom: YYYY-MM-DD
 * - dateTo: YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const campaignId = searchParams.get("campaignId");
    const classification = searchParams.get("classification");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    
    const where: any = {};
    
    // Filtrowanie według kampanii
    if (campaignId) {
      where.campaignId = parseInt(campaignId);
    }
    
    // Filtrowanie według klasyfikacji
    if (classification) {
      where.classification = classification.toUpperCase();
    } else if (filter !== "all") {
      if (filter === "interested") {
        where.classification = "INTERESTED";
      } else if (filter === "replies") {
        // Odpowiedzi które nie są auto-obsłużone
        where.classification = {
          notIn: ["INTERESTED", "BOUNCE", "UNSUBSCRIBE"]
        };
      } else {
        where.classification = filter.toUpperCase();
      }
    } else {
      // Domyślnie NIE pokazuj auto-obsłużonych (BOUNCE, UNSUBSCRIBE) oraz warmup/test
      where.classification = {
        notIn: ["BOUNCE", "UNSUBSCRIBE", "INTERNAL_WARMUP"]
      };
    }
    
    // Filtrowanie według statusu (handled/unhandled)
    if (status === "handled") {
      where.isHandled = true;
    } else if (status === "unhandled") {
      where.isHandled = false;
    }
    
    if (unreadOnly) {
      where.isRead = false;
    }
    
    // Filtrowanie według daty
    if (dateFrom || dateTo) {
      where.receivedAt = {};
      if (dateFrom) {
        where.receivedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.receivedAt.lte = endDate;
      }
    }
    
    // Wyszukiwanie (będzie filtrowane po pobraniu danych)
    
    const replies = await db.inboxReply.findMany({
      where,
      include: {
        lead: true,
        campaign: true,
        notifications: {
          where: { status: 'CONFIRMED' },
          select: {
            id: true,
            status: true,
            confirmedAt: true,
            salespersonEmail: true
          },
          take: 1 // Tylko jedno najnowsze potwierdzenie
        }
      },
      orderBy: {
        receivedAt: "desc"
      }
    });
    
    // Dodaj informację o potwierdzeniu do każdej odpowiedzi
    let repliesWithConfirmation = replies.map(reply => ({
      ...reply,
      isConfirmed: reply.notifications && reply.notifications.length > 0,
      confirmedAt: reply.notifications?.[0]?.confirmedAt || null,
      confirmedBy: reply.notifications?.[0]?.salespersonEmail || null
    }));
    
    // Filtrowanie wyszukiwania (po pobraniu danych, bo Prisma nie obsługuje OR w contains)
    if (search) {
      const searchLower = search.toLowerCase();
      repliesWithConfirmation = repliesWithConfirmation.filter(reply => {
        const matchesSubject = reply.subject?.toLowerCase().includes(searchLower);
        const matchesContent = reply.content?.toLowerCase().includes(searchLower);
        const matchesFromEmail = reply.fromEmail?.toLowerCase().includes(searchLower);
        const matchesToEmail = reply.toEmail?.toLowerCase().includes(searchLower);
        const matchesLeadName = `${reply.lead?.firstName || ""} ${reply.lead?.lastName || ""}`.toLowerCase().includes(searchLower);
        const matchesLeadCompany = reply.lead?.company?.toLowerCase().includes(searchLower);
        const matchesLeadEmail = reply.lead?.email?.toLowerCase().includes(searchLower);
        
        return matchesSubject || matchesContent || matchesFromEmail || matchesToEmail || matchesLeadName || matchesLeadCompany || matchesLeadEmail;
      });
    }
    
    return NextResponse.json(repliesWithConfirmation);
    
  } catch (error) {
    console.error("Błąd pobierania inbox:", error);
    return NextResponse.json(
      { error: "Błąd pobierania inbox" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inbox - dodaj nową odpowiedź (do testowania)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromEmail, toEmail, subject, content, receivedAt, mailboxId } = body;
    
    if (!fromEmail || !toEmail || !subject || !content) {
      return NextResponse.json(
        { error: "Brakuje wymaganych pól: fromEmail, toEmail, subject, content" },
        { status: 400 }
      );
    }
    
    // Znajdź leada po emailu
    const lead = await db.lead.findFirst({
      where: { email: fromEmail }
    });
    
    if (!lead) {
      return NextResponse.json(
        { error: "Lead z tym emailem nie istnieje" },
        { status: 404 }
      );
    }
    
    // Utwórz odpowiedź
    const reply = await db.inboxReply.create({
      data: {
        fromEmail,
        toEmail,
        subject,
        content,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
        leadId: lead.id,
        classification: "PENDING", // Będzie przetworzone przez AI Agent
        isRead: false,
        messageId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    });
    
    // Automatycznie uruchom AI Agent
    try {
      const { EmailAgentAI } = await import('@/services/emailAgentAI');
      const analysis = await EmailAgentAI.processEmailReply(reply.id);
      await EmailAgentAI.executeActions(analysis, reply.id);
      console.log(`[INBOX] 🤖 AI Agent przetworzył odpowiedź ID: ${reply.id}`);
    } catch (aiError: any) {
      console.error(`[INBOX] ⚠ Błąd AI Agent dla odpowiedzi ${reply.id}:`, aiError.message);
    }
    
    return NextResponse.json({
      success: true,
      replyId: reply.id,
      message: "Odpowiedź dodana i przetworzona przez AI Agent"
    });
    
  } catch (error: any) {
    console.error("Błąd dodawania odpowiedzi:", error);
    return NextResponse.json(
      { error: "Błąd dodawania odpowiedzi", details: error.message },
      { status: 500 }
    );
  }
}

