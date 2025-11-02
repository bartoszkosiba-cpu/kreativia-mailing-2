import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduleMaterialResponse } from "@/services/materialResponseSender";

/**
 * POST - Podjęcie decyzji przez administratora (APPROVED/REJECTED)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decisionId = parseInt(params.id);
    const body = await req.json();

    const {
      status, // "APPROVED" | "REJECTED"
      decisionNote,
      decidedBy // Email/username administratora
    } = body;

    // Walidacja
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status musi być APPROVED lub REJECTED" },
        { status: 400 }
      );
    }

    // Pobierz decyzję
    const decision = await db.pendingMaterialDecision.findUnique({
      where: { id: decisionId },
      include: {
        lead: true,
        campaign: true,
        reply: true
      }
    });

    if (!decision) {
      return NextResponse.json(
        { success: false, error: "Decyzja nie istnieje" },
        { status: 404 }
      );
    }

    if (decision.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: "Decyzja została już podjęta" },
        { status: 400 }
      );
    }

    // Jeśli APPROVED - zaplanuj wysyłkę materiałów
    if (status === 'APPROVED') {
      try {
        await scheduleMaterialResponse(
          decision.replyId,
          {
            isMaterialRequest: true,
            confidence: decision.aiConfidence,
            reasoning: decision.aiReasoning,
            suggestedAction: 'SEND'
          }
        );
      } catch (error: any) {
        console.error("[MATERIAL DECISIONS] Błąd planowania wysyłki:", error);
        return NextResponse.json(
          { success: false, error: `Błąd planowania wysyłki: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Aktualizuj decyzję
    const updatedDecision = await db.pendingMaterialDecision.update({
      where: { id: decisionId },
      data: {
        status: status as any,
        decidedAt: new Date(),
        decidedBy: decidedBy || null,
        decisionNote: decisionNote?.trim() || null
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true
          }
        },
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        reply: {
          select: {
            id: true,
            fromEmail: true,
            subject: true,
            content: true,
            createdAt: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedDecision,
      message: status === 'APPROVED' 
        ? 'Decyzja zatwierdzona - materiały zostały zaplanowane do wysyłki' 
        : 'Decyzja odrzucona'
    });
  } catch (error: any) {
    console.error("[MATERIAL DECISIONS] Błąd aktualizacji decyzji:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas aktualizacji decyzji" },
      { status: 500 }
    );
  }
}

