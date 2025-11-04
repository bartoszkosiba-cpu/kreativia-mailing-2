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
    if (!status || !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status musi być APPROVED, REJECTED lub PENDING" },
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

    // Pozwól na zmianę statusu z REJECTED na APPROVED (reaktywacja)
    // Pozwól na zmianę statusu z REJECTED na PENDING (przywrócenie do kolejki)
    // Ale nie pozwól zmienić z APPROVED na REJECTED (raz wysłane, nie odwołujemy)
    if (decision.status === 'APPROVED' && status === 'REJECTED') {
      return NextResponse.json(
        { success: false, error: "Nie można odwołać już zatwierdzonej decyzji" },
        { status: 400 }
      );
    }
    
    // Jeśli zmieniamy z REJECTED na PENDING - przywróć do kolejki
    if (decision.status === 'REJECTED' && status === 'PENDING') {
      // Wyczyść pola związane z decyzją (żeby było jakby nowa)
      await db.pendingMaterialDecision.update({
        where: { id: decisionId },
        data: {
          status: 'PENDING',
          decidedAt: null,
          decidedBy: null,
          decisionNote: null
        }
      });
      
      return NextResponse.json({
        success: true,
        data: await db.pendingMaterialDecision.findUnique({
          where: { id: decisionId },
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
        }),
        message: 'Decyzja została przywrócona do kolejki oczekujących'
      });
    }
    
    // Jeśli zmieniamy z REJECTED na APPROVED - usuń poprzednie MaterialResponse jeśli istnieje
    // (może zostało utworzone przed odrzuceniem, a potem usunięte)
    if (decision.status === 'REJECTED' && status === 'APPROVED') {
      // Usuń stare MaterialResponse jeśli istnieją (z poprzedniej próby)
      await db.materialResponse.deleteMany({
        where: {
          replyId: decision.replyId,
          status: {
            in: ['pending', 'scheduled', 'failed']
          }
        }
      });
      console.log(`[MATERIAL DECISIONS] Reaktywacja decyzji ${decisionId} - usunięto stare MaterialResponse`);
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

