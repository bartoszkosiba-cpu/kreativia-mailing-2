import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { initializeCampaignQueue } from "@/services/campaignEmailQueue";

/**
 * POST /api/campaigns/[id]/reinit-queue
 * Ponownie inicjalizuje kolejkę dla kampanii (gdy kolejka jest pusta, ale kampania jest IN_PROGRESS)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);

    if (isNaN(campaignId)) {
      return NextResponse.json(
        { error: "Nieprawidłowe ID kampanii" },
        { status: 400 }
      );
    }

    // Pobierz kampanię
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Kampania nie istnieje" },
        { status: 404 }
      );
    }

    if (campaign.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { 
          error: "Kampania nie jest aktywna",
          reason: `Status kampanii: ${campaign.status}. Można inicjalizować kolejkę tylko dla kampanii IN_PROGRESS.`
        },
        { status: 400 }
      );
    }

    // Sprawdź ile maili jest już w kolejce
    const existingQueue = await db.campaignEmailQueue.count({
      where: {
        campaignId,
        status: { in: ["pending", "sending"] }
      }
    });

    // Sprawdź ile leadów jest gotowych do wysłania
    const readyLeads = await db.campaignLead.count({
      where: {
        campaignId,
        status: "queued",
        lead: {
          status: { not: "BLOCKED" },
          isBlocked: false
        }
      }
    });

    // Sprawdź ile leadów ma już wpisy w kolejce
    const leadsWithQueue = await db.campaignLead.count({
      where: {
        campaignId,
        status: "queued",
        lead: {
          status: { not: "BLOCKED" },
          isBlocked: false
        },
        campaignEmailQueue: {
          some: {
            status: { in: ["pending", "sending"] }
          }
        }
      }
    });

    const leadsWithoutQueue = readyLeads - leadsWithQueue;

    if (existingQueue > 0 && leadsWithoutQueue === 0) {
      return NextResponse.json({
        success: true,
        message: `Kolejka już istnieje (${existingQueue} maili w kolejce)`,
        existingQueue,
        readyLeads,
        leadsWithoutQueue: 0
      });
    }

    // ✅ NOWE: Jeśli są leady bez wpisów w kolejce, dodaj je
    const bufferSize = leadsWithoutQueue > 0 ? Math.min(leadsWithoutQueue, 20) : 10;
    
    // Inicjalizuj kolejkę (doda tylko te które nie mają wpisów)
    const initialized = await initializeCampaignQueue(
      campaignId,
      campaign.delayBetweenEmails || 90,
      bufferSize
    );

    return NextResponse.json({
      success: true,
      message: initialized > 0 
        ? `Dodano ${initialized} nowych maili do kolejki (łącznie: ${existingQueue + initialized} pending/sending)`
        : `Kolejka jest aktualna (${existingQueue} maili w kolejce, ${readyLeads} leadów gotowych)`,
      initialized,
      existingQueue,
      readyLeads,
      leadsWithoutQueue
    });

  } catch (error: any) {
    console.error("[REINIT QUEUE] Błąd:", error);
    return NextResponse.json(
      { error: error.message || "Wystąpił błąd podczas inicjalizacji kolejki" },
      { status: 500 }
    );
  }
}
