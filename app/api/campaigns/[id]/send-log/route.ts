import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/campaigns/[id]/send-log?mailboxId=X&messageId=Y
 * Pobiera pełną treść maila z SendLog
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const searchParams = req.nextUrl.searchParams;
    const mailboxId = searchParams.get("mailboxId");
    const messageId = searchParams.get("messageId");

    if (isNaN(campaignId)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe ID kampanii" },
        { status: 400 }
      );
    }

    if (!mailboxId) {
      return NextResponse.json(
        { success: false, error: "Brakuje mailboxId" },
        { status: 400 }
      );
    }

    // Jeśli jest messageId, szukaj po nim, jeśli nie - szukaj po leadId i mailboxId
    let sendLog;
    if (messageId) {
      sendLog = await db.sendLog.findFirst({
        where: {
          campaignId,
          mailboxId: parseInt(mailboxId),
          messageId: messageId
        },
        select: {
          id: true,
          subject: true,
          content: true,
          createdAt: true
        }
      });
    } else {
      // Fallback: szukaj najnowszego SendLog dla tego mailboxId w tej kampanii
      const leadId = searchParams.get("leadId");
      if (leadId) {
        sendLog = await db.sendLog.findFirst({
          where: {
            campaignId,
            mailboxId: parseInt(mailboxId),
            leadId: parseInt(leadId),
            status: 'sent'
          },
          select: {
            id: true,
            subject: true,
            content: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        });
      }
    }

    if (!sendLog) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono rekordu w SendLog" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        subject: sendLog.subject,
        content: sendLog.content,
        createdAt: sendLog.createdAt
      }
    });
  } catch (error: any) {
    console.error("[SEND-LOG API] Błąd:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas pobierania SendLog", details: error.message },
      { status: 500 }
    );
  }
}
