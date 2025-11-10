import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/material-responses/[id]/restore - Przywróć wysłany MaterialResponse do oczekujących decyzji
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const materialResponseId = parseInt(params.id);
    
    if (Number.isNaN(materialResponseId)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe ID MaterialResponse" },
        { status: 400 }
      );
    }

    // Pobierz MaterialResponse z wszystkimi potrzebnymi danymi
    const materialResponse = await db.materialResponse.findUnique({
      where: { id: materialResponseId },
      include: {
        lead: true,
        campaign: true,
        reply: true
      }
    });

    if (!materialResponse) {
      return NextResponse.json(
        { success: false, error: "MaterialResponse nie istnieje" },
        { status: 404 }
      );
    }

    // Sprawdź czy już istnieje PendingMaterialDecision dla tego reply
    const existingDecision = await db.pendingMaterialDecision.findFirst({
      where: {
        replyId: materialResponse.replyId,
        campaignId: materialResponse.campaignId
      }
    });

    if (existingDecision) {
      // Jeśli istnieje, po prostu zmień status na PENDING
      const updatedDecision = await db.pendingMaterialDecision.update({
        where: { id: existingDecision.id },
        data: {
          status: 'PENDING',
          decidedAt: null,
          decidedBy: null,
          decisionNote: null
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
              createdAt: true,
              receivedAt: true
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: updatedDecision,
        message: 'MaterialResponse został przywrócony do oczekujących decyzji (istniejąca decyzja została reaktywowana)'
      });
    }

    // Jeśli nie istnieje, musimy stworzyć nowy PendingMaterialDecision
    // Ale potrzebujemy danych AI (aiConfidence, aiReasoning, leadResponse, suggestedAction)
    // Te dane mogą być w MaterialResponse lub musimy je odczytać z reply
    
    // Pobierz treść odpowiedzi leada
    const leadResponse = materialResponse.reply.content || '';
    
    // Stwórz nowy PendingMaterialDecision
    // Użyjemy danych z MaterialResponse jako fallback
    const newDecision = await db.pendingMaterialDecision.create({
      data: {
        leadId: materialResponse.leadId,
        campaignId: materialResponse.campaignId,
        replyId: materialResponse.replyId,
        aiConfidence: materialResponse.aiConfidence || 0.8, // Fallback jeśli brak
        aiReasoning: materialResponse.aiReasoning || 'Przywrócone z wysłanych odpowiedzi',
        leadResponse: leadResponse.substring(0, 5000), // Ogranicz długość
        suggestedAction: 'SEND', // Domyślnie sugeruj wysłanie
        status: 'PENDING'
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
            createdAt: true,
            receivedAt: true
          }
        }
      }
    });

    // Opcjonalnie: zmień status MaterialResponse na "cancelled" (ale nie usuwaj - zachowaj historię)
    await db.materialResponse.update({
      where: { id: materialResponseId },
      data: {
        status: 'cancelled'
      }
    });

    return NextResponse.json({
      success: true,
      data: newDecision,
      message: 'MaterialResponse został przywrócony do oczekujących decyzji'
    });
  } catch (error: any) {
    console.error("[MATERIAL RESPONSES RESTORE] Błąd:", error);
    return NextResponse.json(
      { success: false, error: `Błąd przywracania: ${error.message}` },
      { status: 500 }
    );
  }
}




