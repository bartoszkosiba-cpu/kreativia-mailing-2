import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET - Pobierz kolejkę decyzji administratora (PENDING)
 */
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') || 'PENDING';

    const decisions = await db.pendingMaterialDecision.findMany({
      where: {
        status: status as any
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: decisions
    });
  } catch (error: any) {
    console.error("[MATERIAL DECISIONS] Błąd pobierania decyzji:", error);
    return NextResponse.json(
      { success: false, error: "Błąd podczas pobierania decyzji" },
      { status: 500 }
    );
  }
}

