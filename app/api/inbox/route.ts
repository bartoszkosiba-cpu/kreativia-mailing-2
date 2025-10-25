import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/inbox - pobierz listę odpowiedzi
 * Query params:
 * - filter: all | interested | unsubscribe | ooo | redirect | other
 * - unreadOnly: true | false
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const campaignId = searchParams.get("campaignId");
    
    const where: any = {};
    
    // Filtrowanie według kampanii
    if (campaignId) {
      where.campaignId = parseInt(campaignId);
    }
    
    // Filtrowanie według klasyfikacji
    if (filter !== "all") {
      where.classification = filter.toUpperCase();
    }
    
    if (unreadOnly) {
      where.isRead = false;
    }
    
    const replies = await db.inboxReply.findMany({
      where,
      include: {
        lead: true,
        campaign: true
      },
      orderBy: {
        receivedAt: "desc"
      }
    });
    
    return NextResponse.json(replies);
    
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

