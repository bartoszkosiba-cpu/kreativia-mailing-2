import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT - Aktualizuj skrzynkę
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; mailboxId: string } }
) {
  try {
    const mailboxId = parseInt(params.mailboxId);
    const body = await req.json();

    // Sprawdź czy skrzynka istnieje
    const existing = await db.mailbox.findUnique({
      where: { id: mailboxId }
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Skrzynka nie istnieje" },
        { status: 404 }
      );
    }

    // Jeśli zmienia email, sprawdź czy nowy nie jest zajęty
    if (body.email && body.email !== existing.email) {
      const emailTaken = await db.mailbox.findUnique({
        where: { email: body.email }
      });

      if (emailTaken) {
        return NextResponse.json(
          { error: "Email już jest używany przez inną skrzynkę" },
          { status: 400 }
        );
      }
    }

    // Przygotuj dane do aktualizacji
    const updateData: any = {
      email: body.email,
      displayName: body.displayName || null,
      description: body.description || null,
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      smtpUser: body.smtpUser,
      smtpSecure: body.smtpSecure,
      imapHost: body.imapHost,
      imapPort: body.imapPort,
      imapUser: body.imapUser,
      imapSecure: body.imapSecure,
      dailyEmailLimit: body.dailyEmailLimit,
      priority: body.priority,
      isActive: body.isActive,
      mailboxType: body.mailboxType || 'new'
    };

    // Aktualizuj hasła tylko jeśli podano nowe
    if (body.smtpPass) {
      updateData.smtpPass = body.smtpPass;
    }
    if (body.imapPass) {
      updateData.imapPass = body.imapPass;
    }

    // Jeśli typ zmienia się na 'warmed_up', zaktualizuj status warmup
    if (body.mailboxType === 'warmed_up') {
      updateData.warmupStatus = 'ready';
      updateData.warmupDay = 0;
      updateData.warmupDailyLimit = 0;
    }

    const mailbox = await db.mailbox.update({
      where: { id: mailboxId },
      data: updateData
    });

    return NextResponse.json(mailbox);
  } catch (error: any) {
    console.error("Błąd aktualizacji skrzynki:", error);
    return NextResponse.json(
      { error: "Błąd aktualizacji skrzynki", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Częściowa aktualizacja (np. zmiana statusu)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; mailboxId: string } }
) {
  try {
    const mailboxId = parseInt(params.mailboxId);
    const body = await req.json();

    const mailbox = await db.mailbox.update({
      where: { id: mailboxId },
      data: body
    });

    return NextResponse.json(mailbox);
  } catch (error: any) {
    console.error("Błąd aktualizacji skrzynki:", error);
    return NextResponse.json(
      { error: "Błąd aktualizacji skrzynki", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Usuń skrzynkę
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; mailboxId: string } }
) {
  try {
    const mailboxId = parseInt(params.mailboxId);

    // Sprawdź czy są wysłane maile z tej skrzynki
    const sentCount = await db.sendLog.count({
      where: { mailboxId }
    });

    if (sentCount > 0) {
      return NextResponse.json(
        { 
          error: "Nie można usunąć skrzynki, która ma historię wysyłek",
          sentCount 
        },
        { status: 400 }
      );
    }

    await db.mailbox.delete({
      where: { id: mailboxId }
    });

    return NextResponse.json({ message: "Skrzynka usunięta" });
  } catch (error: any) {
    console.error("Błąd usuwania skrzynki:", error);
    return NextResponse.json(
      { error: "Błąd usuwania skrzynki", details: error.message },
      { status: 500 }
    );
  }
}

