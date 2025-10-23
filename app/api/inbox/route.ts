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

