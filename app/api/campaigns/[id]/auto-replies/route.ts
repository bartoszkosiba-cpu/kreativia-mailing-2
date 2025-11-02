import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/campaigns/[id]/auto-replies - Pobierz historię automatycznych odpowiedzi dla kampanii
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);
    const searchParams = req.nextUrl.searchParams;
    
    // Paginacja
    const limit = parseInt(searchParams.get("limit") || "25");
    const offset = parseInt(searchParams.get("offset") || "0");
    
    // Filtry
    const status = searchParams.get("status"); // pending | scheduled | sent | failed | PENDING | APPROVED | REJECTED
    const type = searchParams.get("type"); // "material" | "decision"

    // Pobierz MaterialResponse dla tej kampanii
    const materialResponseWhere: any = {
      campaignId
    };
    if (status && type !== "decision") {
      materialResponseWhere.status = status;
    }

    const [materialResponses, materialResponsesTotal] = await Promise.all([
      db.materialResponse.findMany({
        where: materialResponseWhere,
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
          material: {
            select: {
              id: true,
              name: true,
              type: true,
              fileName: true,
              url: true
            }
          },
          reply: {
            select: {
              id: true,
              subject: true,
              content: true,
              receivedAt: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: type === "material" ? offset : 0,
        take: type === "material" ? limit : 1000
      }),
      db.materialResponse.count({
        where: materialResponseWhere
      })
    ]);

    // Pobierz PendingMaterialDecision dla tej kampanii
    const decisionWhere: any = {
      campaignId
    };
    if (status && type !== "material") {
      decisionWhere.status = status;
    }

    // Pobierz decyzje - wyklucz zatwierdzone które już mają MaterialResponse (żeby nie pokazywać duplikatów)
    const [pendingDecisions, pendingDecisionsTotal] = await Promise.all([
      db.pendingMaterialDecision.findMany({
        where: decisionWhere,
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
          reply: {
            select: {
              id: true,
              subject: true,
              content: true,
              receivedAt: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: type === "decision" ? offset : 0,
        take: type === "decision" ? limit : 1000
      }),
      db.pendingMaterialDecision.count({
        where: decisionWhere
      })
    ]);

    // ✅ Filtruj decyzje: ukryj zatwierdzone (APPROVED) które już mają powiązany MaterialResponse
    // (żeby nie pokazywać duplikatów - pokazujemy tylko faktyczną wysyłkę)
    // Najpierw pobierz wszystkie MaterialResponse dla replyId z decyzji
    const decisionReplyIds = pendingDecisions
      .filter(d => d.status === 'APPROVED')
      .map(d => d.replyId);
    
    const materialResponsesForDecisions = decisionReplyIds.length > 0
      ? await db.materialResponse.findMany({
          where: {
            replyId: { in: decisionReplyIds },
            status: { in: ['scheduled', 'sending', 'sent'] }
          },
          select: { replyId: true }
        })
      : [];
    
    const replyIdsWithMaterialResponse = new Set(
      materialResponsesForDecisions.map(mr => mr.replyId)
    );
    
    // Filtruj decyzje - ukryj APPROVED które mają MaterialResponse
    const filteredDecisions = pendingDecisions.filter(decision => {
      // Jeśli decyzja jest APPROVED i ma MaterialResponse, pomiń ją
      if (decision.status === 'APPROVED' && replyIdsWithMaterialResponse.has(decision.replyId)) {
        return false;
      }
      return true;
    });

    // Połącz wyniki (jeśli type nie jest określony)
    let combinedData: any[] = [];
    let totalCount = 0;

    if (!type || type === "all") {
      // Kombinuj oba typy i sortuj po dacie
      combinedData = [
        ...materialResponses.map(mr => ({
          id: mr.id,
          type: "material" as const,
          lead: mr.lead,
          status: mr.status,
          aiConfidence: mr.aiConfidence,
          aiReasoning: mr.aiReasoning,
          createdAt: mr.createdAt,
          scheduledAt: mr.scheduledAt,
          sentAt: mr.sentAt,
          subject: mr.subject,
          responseText: mr.responseText,
          error: mr.error,
          material: mr.material,
          reply: mr.reply
        })),
        ...filteredDecisions.map(pd => ({
          id: pd.id,
          type: "decision" as const,
          lead: pd.lead,
          status: pd.status,
          aiConfidence: pd.aiConfidence,
          aiReasoning: pd.aiReasoning,
          createdAt: pd.createdAt,
          decidedAt: pd.decidedAt,
          suggestedAction: pd.suggestedAction,
          decisionNote: pd.decisionNote,
          leadResponse: pd.leadResponse,
          reply: pd.reply
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      totalCount = materialResponsesTotal + filteredDecisions.length;
      
      // Zastosuj paginację na połączonych wynikach
      combinedData = combinedData.slice(offset, offset + limit);
    } else if (type === "material") {
      combinedData = materialResponses.map(mr => ({
        id: mr.id,
        type: "material" as const,
        lead: mr.lead,
        status: mr.status,
        aiConfidence: mr.aiConfidence,
        aiReasoning: mr.aiReasoning,
        createdAt: mr.createdAt,
        scheduledAt: mr.scheduledAt,
        sentAt: mr.sentAt,
        subject: mr.subject,
        responseText: mr.responseText,
        error: mr.error,
        material: mr.material,
        reply: mr.reply
      }));
      totalCount = materialResponsesTotal;
    } else if (type === "decision") {
      combinedData = filteredDecisions.map(pd => ({
        id: pd.id,
        type: "decision" as const,
        lead: pd.lead,
        status: pd.status,
        aiConfidence: pd.aiConfidence,
        aiReasoning: pd.aiReasoning,
        createdAt: pd.createdAt,
        decidedAt: pd.decidedAt,
        suggestedAction: pd.suggestedAction,
        decisionNote: pd.decisionNote,
        leadResponse: pd.leadResponse,
        reply: pd.reply
      }));
      totalCount = filteredDecisions.length;
    }

    return NextResponse.json({
      success: true,
      data: combinedData,
      total: totalCount,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: Math.floor(offset / limit) + 1
      }
    });
  } catch (error: any) {
    console.error("[AUTO-REPLIES] Błąd pobierania historii:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas pobierania historii" },
      { status: 500 }
    );
  }
}

