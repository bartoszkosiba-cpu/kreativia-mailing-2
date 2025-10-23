import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz wszystkie skrzynki dla handlowca
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salespersonId = parseInt(params.id);

    const mailboxes = await db.mailbox.findMany({
      where: { virtualSalespersonId: salespersonId },
      orderBy: [
        { priority: "asc" },
        { createdAt: "asc" }
      ]
    });

    return NextResponse.json(mailboxes);
  } catch (error: any) {
    console.error("Błąd pobierania skrzynek:", error);
    return NextResponse.json(
      { error: "Błąd pobierania skrzynek", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Dodaj nową skrzynkę
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salespersonId = parseInt(params.id);
    const body = await req.json();

    // Sprawdź czy handlowiec istnieje
    const salesperson = await db.virtualSalesperson.findUnique({
      where: { id: salespersonId }
    });

    if (!salesperson) {
      return NextResponse.json(
        { error: "Handlowiec nie istnieje" },
        { status: 404 }
      );
    }

    // Sprawdź czy email nie jest już użyty
    const existing = await db.mailbox.findUnique({
      where: { email: body.email }
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email już jest używany przez inną skrzynkę" },
        { status: 400 }
      );
    }

    // Sprawdź czy priority nie jest już użyty
    const requestedPriority = body.priority || 999;
    if (requestedPriority !== 999) {
      const existingPriority = await db.mailbox.findFirst({
        where: {
          virtualSalespersonId: salespersonId,
          priority: requestedPriority
        }
      });

      if (existingPriority) {
        return NextResponse.json(
          { error: `Priorytet ${requestedPriority} jest już używany przez skrzynkę ${existingPriority.email}. Wybierz inny priorytet.` },
          { status: 400 }
        );
      }
    }

    // Utwórz skrzynkę
    const mailbox = await db.mailbox.create({
      data: {
        virtualSalespersonId: salespersonId,
        email: body.email,
        displayName: body.displayName || null,
        description: body.description || null,
        
        // SMTP
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpUser: body.smtpUser,
        smtpPass: body.smtpPass,
        smtpSecure: body.smtpSecure,
        
        // IMAP
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapUser: body.imapUser,
        imapPass: body.imapPass,
        imapSecure: body.imapSecure,
        
        // Limity
        dailyEmailLimit: body.dailyEmailLimit,
        priority: body.priority || 999,
        isActive: body.isActive !== false,
        
        // Typ skrzynki
        mailboxType: body.mailboxType || 'new',
        
        // Warmup - logika zależna od typu skrzynki
        warmupStatus: body.mailboxType === 'warmed_up' ? 'ready' : 
                     (body.autoStartWarmup ? 'warming' : 'inactive'),
        warmupDay: body.mailboxType === 'warmed_up' ? 0 : 
                  (body.autoStartWarmup ? 1 : 0),
        warmupDailyLimit: body.mailboxType === 'warmed_up' ? 0 : 
                         (body.autoStartWarmup ? 15 : 5),
        warmupTodaySent: 0
      }
    });

    // Jeśli automatycznie rozpoczęto warmup (tylko dla nowych skrzynek), zaplanuj maile od razu
    if (body.autoStartWarmup && body.mailboxType !== 'warmed_up') {
      try {
        const { scheduleDailyEmailsForMailbox } = await import('@/services/warmup/scheduler');
        await scheduleDailyEmailsForMailbox(mailbox.id);
        console.log(`[MAILBOX CREATE] ✅ Automatycznie rozpoczęto warmup dla nowej skrzynki ${mailbox.email}`);
      } catch (error) {
        console.error(`[MAILBOX CREATE] ❌ Błąd planowania warmup dla nowej skrzynki:`, error);
      }
    }

    return NextResponse.json(mailbox, { status: 201 });
  } catch (error: any) {
    console.error("Błąd tworzenia skrzynki:", error);
    return NextResponse.json(
      { error: "Błąd tworzenia skrzynki", details: error.message },
      { status: 500 }
    );
  }
}

