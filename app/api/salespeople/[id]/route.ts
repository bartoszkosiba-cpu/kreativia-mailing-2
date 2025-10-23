import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz pojedynczego handlowca
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salespersonId = parseInt(params.id);

    const salesperson = await db.virtualSalesperson.findUnique({
      where: { id: salespersonId },
      include: {
        mainMailbox: true, // DODAJĘ GŁÓWNĄ SKRZYNKĘ
        mailboxes: {
          orderBy: { priority: "asc" }
        },
        campaigns: {
          select: {
            id: true,
            name: true,
            status: true
          },
          take: 5,
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!salesperson) {
      return NextResponse.json(
        { error: "Handlowiec nie istnieje" },
        { status: 404 }
      );
    }

    return NextResponse.json(salesperson);
  } catch (error: any) {
    console.error("Błąd pobierania handlowca:", error);
    return NextResponse.json(
      { error: "Błąd pobierania handlowca", details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Aktualizuj handlowca
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salespersonId = parseInt(params.id);
    const { 
      name, phone, language, markets, 
      realSalespersonEmail,
      realSalespersonName,
      isActive 
    } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Imię jest wymagane" }, { status: 400 });
    }

    // Sprawdź czy handlowiec istnieje
    const existing = await db.virtualSalesperson.findUnique({
      where: { id: salespersonId }
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Handlowiec nie istnieje" },
        { status: 404 }
      );
    }

    // Aktualizuj handlowca (email NIE jest aktualizowany - pochodzi z głównej skrzynki)
    const salesperson = await db.virtualSalesperson.update({
      where: { id: salespersonId },
      data: {
        name,
        // email nie jest aktualizowany - jest zarządzany przez główną skrzynkę
        phone: phone || null,
        language: language || "pl",
        markets: markets || null,
        realSalespersonEmail: realSalespersonEmail || null,
        realSalespersonName: realSalespersonName || null,
        isActive: isActive !== false
      }
    });

    return NextResponse.json(salesperson);
  } catch (error: any) {
    console.error("Błąd aktualizacji handlowca:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd podczas aktualizacji handlowca", details: error.message },
      { status: 500 }
    );
  }
}
