import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateMaterialResponse } from "@/services/materialResponseAI";

/**
 * GET /api/material-decisions/[id]/preview - Generuj podgląd odpowiedzi dla decyzji
 */
export async function GET(
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

    // Wygeneruj podgląd odpowiedzi
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
        virtualSalespersonLanguage: decision.campaign.virtualSalesperson?.language || null
      },
      decision.campaign.materials.map(m => ({
        name: m.name,
        type: m.type as "LINK" | "ATTACHMENT",
        url: m.url,
        fileName: m.fileName
      })),
      decision.leadResponse
    );

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
      }
    });
  } catch (error: any) {
    console.error("[MATERIAL DECISION PREVIEW] Błąd:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas generowania podglądu" },
      { status: 500 }
    );
  }
}

