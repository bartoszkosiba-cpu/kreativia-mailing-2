import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * PATCH /api/inbox/[id] - aktualizuj status odpowiedzi
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const replyId = Number(params.id);
    if (Number.isNaN(replyId)) {
      return NextResponse.json({ error: "Nieprawidłowe ID" }, { status: 400 });
    }
    
    const { isRead, isHandled, handledNote } = await req.json();
    
    const data: any = {};
    if (typeof isRead === "boolean") data.isRead = isRead;
    if (typeof isHandled === "boolean") {
      data.isHandled = isHandled;
      data.handledAt = isHandled ? new Date() : null;
    }
    if (handledNote !== undefined) data.handledNote = handledNote;
    
    const reply = await db.inboxReply.update({
      where: { id: replyId },
      data
    });
    
    return NextResponse.json(reply);
    
  } catch (error) {
    console.error("Błąd aktualizacji odpowiedzi:", error);
    return NextResponse.json(
      { error: "Błąd aktualizacji odpowiedzi" },
      { status: 500 }
    );
  }
}

