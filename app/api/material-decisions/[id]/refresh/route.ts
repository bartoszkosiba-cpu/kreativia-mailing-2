import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateMaterialResponse } from "@/services/materialResponseAI";

/**
 * POST /api/material-decisions/[id]/refresh - Regeneruj odpowiedź z aktualnymi ustawieniami kampanii
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decisionId = parseInt(params.id);

    const decision = await db.pendingMaterialDecision.findUnique({
      where: { id: decisionId },
      include: {
        lead: true,
        campaign: {
          include: {
            virtualSalesperson: true,
            materials: {
              where: { isActive: true },
              orderBy: { order: 'asc' }
            }
          }
        },
        reply: true
      }
    });

    if (!decision) {
      return NextResponse.json(
        { success: false, error: "Decyzja nie została znaleziona" },
        { status: 404 }
      );
    }

    // Pozwól odświeżyć wszystkie decyzje (nie tylko PENDING)
    // Użytkownik może chcieć zobaczyć jak odpowiedź wyglądała z aktualnymi ustawieniami nawet jeśli decyzja już została podjęta
    // if (decision.status !== 'PENDING') {
    //   return NextResponse.json(
    //     { success: false, error: "Można odświeżyć tylko oczekujące decyzje" },
    //     { status: 400 }
    //   );
    // }

    // Wygeneruj nową odpowiedź z aktualnymi ustawieniami kampanii
    const campaignLanguage = decision.campaign.virtualSalesperson?.language || decision.lead.language || 'pl';
    
    const responseContent = await generateMaterialResponse(
      {
        firstName: decision.lead.firstName,
        lastName: decision.lead.lastName,
        greetingForm: decision.lead.greetingForm,
        language: decision.lead.language || 'pl'
      },
      {
        id: decision.campaign.id,
        name: decision.campaign.name,
        autoReplyContext: decision.campaign.autoReplyContext,
        autoReplyRules: decision.campaign.autoReplyRules,
        virtualSalespersonLanguage: decision.campaign.virtualSalesperson?.language || null,
        autoReplyContent: decision.campaign.autoReplyContent // ✅ Nowa statyczna treść
      },
      decision.campaign.materials.map(m => ({
        name: m.name,
        type: m.type as "LINK" | "ATTACHMENT",
        url: m.url,
        fileName: m.fileName
      })),
      decision.leadResponse, // leadOriginalResponse
      decision.reply.subject || null // originalSubject dla "Re:"
    );

    // Aktualizuj decyzję - zapisz nową odpowiedź (opcjonalnie, dla cache)
    // Możemy też zapisać w materialResponse jeśli istnieje
    const existingMaterialResponse = await db.materialResponse.findFirst({
      where: {
        replyId: decision.replyId,
        status: {
          in: ['pending', 'scheduled']
        }
      }
    });

    if (existingMaterialResponse) {
      // Zaktualizuj istniejący MaterialResponse z nową odpowiedzią
      await db.materialResponse.update({
        where: { id: existingMaterialResponse.id },
        data: {
          subject: responseContent.subject,
          responseText: responseContent.content,
          updatedAt: new Date()
        }
      });
      console.log(`[REFRESH] Zaktualizowano MaterialResponse ${existingMaterialResponse.id} z nową odpowiedzią`);
    }

    return NextResponse.json({
      success: true,
      data: {
        subject: responseContent.subject,
        content: responseContent.content,
        materials: decision.campaign.materials.map(m => ({
          id: m.id,
          name: m.name,
          type: m.type,
          url: m.url,
          fileName: m.fileName
        }))
      },
      message: "Odpowiedź została odświeżona z aktualnymi ustawieniami kampanii"
    });
  } catch (error: any) {
    console.error("[MATERIAL DECISION REFRESH] Błąd:", error);
    return NextResponse.json(
      { success: false, error: `Błąd podczas odświeżania odpowiedzi: ${error.message}` },
      { status: 500 }
    );
  }
}

