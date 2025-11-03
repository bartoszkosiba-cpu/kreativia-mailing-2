import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET - Pobierz kolejkę decyzji administratora (PENDING)
 * Query params:
 * - status: PENDING (domyślnie)
 * - campaignId: filtruj po konkretnej kampanii
 */
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') || 'PENDING';
    const campaignId = req.nextUrl.searchParams.get('campaignId');

    const where: any = {
      status: status as any
    };

    if (campaignId) {
      where.campaignId = parseInt(campaignId);
    }

    const decisions = await db.pendingMaterialDecision.findMany({
      where,
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      decisions: decisions
    });
  } catch (error: any) {
    console.error("[MATERIAL DECISIONS] Błąd pobierania decyzji:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas pobierania decyzji" },
      { status: 500 }
    );
  }
}

