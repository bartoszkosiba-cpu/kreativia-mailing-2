import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidSendTime } from "@/services/campaignScheduler";
import { processScheduledCampaign } from "@/services/scheduledSender";

/**
 * START KAMPANII - Uruchom według harmonogramu
 * 
 * Sprawdza:
 * 1. Czy kampania może być uruchomiona (status)
 * 2. Czy teraz jest w oknie czasowym (dzień, godzina, święta)
 * 3. Jeśli TAK → uruchamia OD RAZU z pełnym harmonogramem
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = Number(params.id);
    if (Number.isNaN(campaignId)) {
      return NextResponse.json({ error: "Nieprawidłowe ID kampanii" }, { status: 400 });
    }

    // Pobierz kampanię
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie istnieje" }, { status: 404 });
    }

    // 1. Walidacja statusu
    if (campaign.status === "IN_PROGRESS") {
      return NextResponse.json({ 
        error: "Kampania już działa", 
        reason: "Kampania jest obecnie w trakcie wysyłki. Sprawdź Outbox." 
      }, { status: 400 });
    }

    if (campaign.status === "COMPLETED") {
      return NextResponse.json({ 
        error: "Kampania już zakończona", 
        reason: "Ta kampania została już zakończona. Sprawdź Outbox." 
      }, { status: 400 });
    }

    if (campaign.status === "CANCELLED") {
      return NextResponse.json({ 
        error: "Kampania anulowana", 
        reason: "Ta kampania została anulowana." 
      }, { status: 400 });
    }

    // 2. Walidacja wymaganych pól
    if (!campaign.subject) {
      return NextResponse.json({ 
        error: "Brak tematu", 
        reason: "Kampania nie ma tematu maila. Uzupełnij temat i spróbuj ponownie." 
      }, { status: 400 });
    }

    if (!campaign.text) {
      return NextResponse.json({ 
        error: "Brak treści", 
        reason: "Kampania nie ma treści maila. Uzupełnij treść i spróbuj ponownie." 
      }, { status: 400 });
    }

    // Pobierz liczbę leadów
    const leadsCount = await db.campaignLead.count({
      where: {
        campaignId,
        lead: {
          status: { not: "BLOCKED" }
        }
      }
    });

    if (leadsCount === 0) {
      return NextResponse.json({ 
        error: "Brak leadów", 
        reason: "Kampania nie ma leadów do wysłania." 
      }, { status: 400 });
    }

    // 3. Sprawdź czy teraz jest w oknie czasowym
    const now = new Date();
    const allowedDays = campaign.allowedDays.split(',');
    const targetCountries = campaign.targetCountries ? campaign.targetCountries.split(',') : [];
    
    const validation = await isValidSendTime(
      now,
      allowedDays,
      campaign.startHour,
      campaign.startMinute ?? 0,
      campaign.endHour,
      campaign.endMinute ?? 0,
      campaign.respectHolidays,
      targetCountries
    );

    if (!validation.isValid) {
      return NextResponse.json({ 
        error: "Teraz nie jest dobry moment",
        reason: validation.reason 
      }, { status: 400 });
    }

    // 4. Ustaw scheduledAt = now() i status = SCHEDULED
    await db.campaign.update({
      where: { id: campaignId },
      data: {
        scheduledAt: now,
        status: "SCHEDULED"
      }
    });

    // 5. ✅ NOWY SYSTEM V2: Inicjalizuj kolejkę (CampaignEmailQueue V2)
    // Najpierw zmień status "planned" → "queued" (dla spójności)
    await db.campaignLead.updateMany({
      where: {
        campaignId,
        status: "planned",
        lead: {
          status: { not: "BLOCKED" },
          isBlocked: false
        }
      },
      data: {
        status: "queued"
      }
    });

    // ✅ WDROŻENIE V2: Użyj initializeQueueV2 zamiast starego initializeCampaignQueue
    const { initializeQueueV2 } = await import('@/services/campaignEmailQueueV2');
    const queueInitialized = await initializeQueueV2(
      campaignId,
      20 // Buffer: pierwsze 20 maili
    );

    if (queueInitialized > 0) {
      console.log(`[START CAMPAIGN] ✅ Inicjalizowano kolejkę V2: ${queueInitialized} maili`);
    } else {
      console.log(`[START CAMPAIGN] ⚠️ Inicjalizacja kolejki V2 zwróciła 0 maili - sprawdź czy są leady w statusie "queued"`);
    }

    // 6. Zmień status na IN_PROGRESS
    await db.campaign.update({
      where: { id: campaignId },
      data: {
        status: "IN_PROGRESS",
        sendingStartedAt: now
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Kampania uruchomiona! Wysyłanie ${leadsCount} maili...`,
      campaignId,
      leadsCount,
      estimatedDuration: Math.ceil((leadsCount * campaign.delayBetweenEmails) / 60) // minuty
    });

  } catch (error: any) {
    console.error("[START CAMPAIGN] Błąd:", error);
    return NextResponse.json({ 
      error: error.message || "Wystąpił błąd podczas uruchamiania kampanii" 
    }, { status: 500 });
  }
}

/**
 * PAUSA KAMPANII - Zatrzymaj wysyłkę
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = Number(params.id);
    const { action } = await req.json();

    if (!action || action !== "pause") {
      return NextResponse.json({ error: "Nieprawidłowa akcja" }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampania nie istnieje" }, { status: 404 });
    }

    if (campaign.status !== "IN_PROGRESS") {
      return NextResponse.json({ 
        error: "Nie można zatrzymać", 
        reason: "Kampania nie jest w trakcie wysyłki" 
      }, { status: 400 });
    }

    // Zmień status na PAUSED i anuluj kolejkę
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "PAUSED" }
    });

    // Anuluj wszystkie pending/sending wpisy w kolejce
    const { cancelCampaignQueue } = await import('@/services/campaignEmailQueue');
    await cancelCampaignQueue(campaignId);

    return NextResponse.json({ 
      success: true, 
      message: "Kampania zatrzymana" 
    });

  } catch (error: any) {
    console.error("[PAUSE CAMPAIGN] Błąd:", error);
    return NextResponse.json({ 
      error: error.message || "Wystąpił błąd podczas zatrzymywania kampanii" 
    }, { status: 500 });
  }
}

