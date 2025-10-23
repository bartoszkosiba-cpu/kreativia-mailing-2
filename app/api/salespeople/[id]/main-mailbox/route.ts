import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT - Zmień główną skrzynkę handlowca
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salespersonId = parseInt(params.id);
    const { mainMailboxId } = await req.json();

    if (!mainMailboxId) {
      return NextResponse.json(
        { error: "ID głównej skrzynki jest wymagane" },
        { status: 400 }
      );
    }

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

    // Sprawdź czy skrzynka istnieje i należy do tego handlowca
    const mailbox = await db.mailbox.findFirst({
      where: {
        id: mainMailboxId,
        virtualSalespersonId: salespersonId,
        isActive: true
      }
    });

    if (!mailbox) {
      return NextResponse.json(
        { error: "Skrzynka nie istnieje lub nie należy do tego handlowca" },
        { status: 400 }
      );
    }

    // Ustaw główną skrzynkę i zaktualizuj email handlowca
    await db.virtualSalesperson.update({
      where: { id: salespersonId },
      data: { 
        mainMailboxId,
        email: mailbox.email // Zaktualizuj email handlowca na email głównej skrzynki
      }
    });

    return NextResponse.json({
      success: true,
      message: "Główna skrzynka zmieniona pomyślnie",
      mainMailboxId,
      updatedEmail: mailbox.email
    });

  } catch (error: any) {
    console.error("Błąd zmiany głównej skrzynki:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd podczas zmiany głównej skrzynki", details: error.message },
      { status: 500 }
    );
  }
}
