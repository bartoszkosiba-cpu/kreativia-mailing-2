import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/mailboxes/[id]/reset
 * Bezpieczny reset skrzynki mailowej
 * 
 * Resetuje skrzynkę tak, jakby była dodana właśnie teraz:
 * - Zmienia createdAt na teraz (od tej chwili będą pobierane nowe maile)
 * - Resetuje liczniki dzienne
 * - Usuwa historię maili (SendLog, InboxReply, WarmupEmail, WarmupQueue)
 * 
 * Cel: Pozwala usunąć leady utworzone z OOO/REDIRECT, które nie będą już wracać
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mailboxId = parseInt(params.id);

    if (isNaN(mailboxId)) {
      return NextResponse.json(
        { error: "Nieprawidłowe ID skrzynki" },
        { status: 400 }
      );
    }

    // Sprawdź czy skrzynka istnieje
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId },
      include: {
        virtualSalesperson: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!mailbox) {
      return NextResponse.json(
        { error: "Skrzynka nie została znaleziona" },
        { status: 404 }
      );
    }

    // Sprawdź czy warmup jest aktywny
    const isWarmupActive = mailbox.warmupStatus === "warming" || mailbox.warmupStatus === "ready_to_warmup";
    
    // Sprawdź czy skrzynka jest używana w aktywnych kampaniach
    const activeCampaignsCount = await db.sendLog.count({
      where: {
        mailboxId: mailboxId,
        campaign: {
          status: {
            in: ["IN_PROGRESS", "SCHEDULED"] as any
          }
        }
      }
    });
    
    // Pobierz unikalne ID kampanii dla ostrzeżenia
    const activeCampaignIds = await db.sendLog.findMany({
      where: {
        mailboxId: mailboxId,
        campaign: {
          status: {
            in: ["IN_PROGRESS", "SCHEDULED"] as any
          }
        }
      },
      select: {
        campaignId: true
      },
      distinct: ["campaignId"]
    });

    // Ostrzeżenia (ale nie blokujemy - użytkownik potwierdził w UI)
    const warnings: string[] = [];
    if (isWarmupActive) {
      warnings.push(`Skrzynka jest w trakcie warmup (status: ${mailbox.warmupStatus}). Reset przerwie ten proces.`);
    }
    if (activeCampaignsCount > 0) {
      warnings.push(`Skrzynka jest używana w ${activeCampaignIds.length} aktywnych kampaniach. Historia wysyłek dla tych kampanii zostanie utracona.`);
    }

    // Rozpocznij transakcję
    const now = new Date();
    
    console.log(`[RESET MAILBOX] Rozpoczynam reset skrzynki ${mailbox.email} (ID: ${mailboxId})`);

    // 1. Usuń SendLog dla tej skrzynki
    const sendLogCount = await db.sendLog.count({
      where: { mailboxId: mailboxId }
    });
    await db.sendLog.deleteMany({
      where: { mailboxId: mailboxId }
    });
    console.log(`[RESET MAILBOX] Usunięto ${sendLogCount} wpisów SendLog`);

    // 2. Usuń InboxReply dla tej skrzynki (gdzie toEmail = mailbox.email)
    const inboxReplyCount = await db.inboxReply.count({
      where: { toEmail: mailbox.email }
    });
    await db.inboxReply.deleteMany({
      where: { toEmail: mailbox.email }
    });
    console.log(`[RESET MAILBOX] Usunięto ${inboxReplyCount} wpisów InboxReply`);

    // 3. Usuń WarmupEmail dla tej skrzynki
    const warmupEmailCount = await db.warmupEmail.count({
      where: { mailboxId: mailboxId }
    });
    await db.warmupEmail.deleteMany({
      where: { mailboxId: mailboxId }
    });
    console.log(`[RESET MAILBOX] Usunięto ${warmupEmailCount} wpisów WarmupEmail`);

    // 4. Usuń WarmupQueue (pending/scheduled) dla tej skrzynki
    const warmupQueueCount = await db.warmupQueue.count({
      where: {
        mailboxId: mailboxId,
        status: {
          in: ["pending", "scheduled"] as any
        }
      }
    });
    await db.warmupQueue.deleteMany({
      where: {
        mailboxId: mailboxId,
        OR: [
          { status: "pending" },
          { status: "scheduled" }
        ]
      }
    });
    console.log(`[RESET MAILBOX] Usunięto ${warmupQueueCount} wpisów WarmupQueue`);

    // 5. Zresetuj skrzynkę
    const resetMailbox = await db.mailbox.update({
      where: { id: mailboxId },
      data: {
        createdAt: now, // Główny cel - od teraz będą pobierane tylko nowe maile
        currentDailySent: 0,
        warmupTodaySent: 0,
        lastResetDate: now,
        // Opcjonalnie: reset warmup jeśli był aktywny
        ...(isWarmupActive ? {
          warmupStatus: "inactive",
          warmupDay: 0,
          warmupDailyLimit: 0,
          warmupStartDate: null,
          warmupCompletedAt: null
        } : {})
      }
    });

    console.log(`[RESET MAILBOX] ✓ Reset skrzynki ${mailbox.email} zakończony pomyślnie`);

    return NextResponse.json({
      success: true,
      message: `Skrzynka ${mailbox.email} została zresetowana`,
      data: {
        mailboxId: mailboxId,
        mailboxEmail: mailbox.email,
        resetAt: now.toISOString(),
        deletedCounts: {
          sendLog: sendLogCount,
          inboxReply: inboxReplyCount,
          warmupEmail: warmupEmailCount,
          warmupQueue: warmupQueueCount
        },
        warnings: warnings.length > 0 ? warnings : undefined
      }
    });

  } catch (error: any) {
    console.error("[RESET MAILBOX] Błąd resetu skrzynki:", error);
    return NextResponse.json(
      { 
        error: "Błąd resetu skrzynki", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

