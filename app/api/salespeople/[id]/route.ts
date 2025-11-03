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
    
    if (isNaN(salespersonId)) {
      return NextResponse.json({ error: "Nieprawidłowe ID handlowca" }, { status: 400 });
    }
    
    const body = await req.json();
    const { 
      name, phone, language, markets, 
      realSalespersonEmail,
      realSalespersonName,
      realSalespersonPhone,
      realSalespersonSignature,
      isActive 
    } = body;

    console.log("[SALESPEOPLE PUT] Otrzymane dane:", {
      salespersonId,
      name,
      realSalespersonPhone,
      realSalespersonSignature,
      hasRealPhone: realSalespersonPhone !== undefined,
      hasRealSignature: realSalespersonSignature !== undefined
    });

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

    // Przygotuj dane do aktualizacji (tylko pola które są zdefiniowane)
    const updateData: any = {
      name,
      phone: phone !== undefined ? (phone || null) : undefined,
      language: language || "pl",
      markets: markets !== undefined ? (markets || null) : undefined,
      realSalespersonEmail: realSalespersonEmail !== undefined ? (realSalespersonEmail || null) : undefined,
      realSalespersonName: realSalespersonName !== undefined ? (realSalespersonName || null) : undefined,
      realSalespersonPhone: realSalespersonPhone !== undefined ? (realSalespersonPhone || null) : undefined,
      realSalespersonSignature: realSalespersonSignature !== undefined ? (realSalespersonSignature || null) : undefined,
      isActive: isActive !== false
    };
    
    // Usuń undefined z obiektu
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    console.log("[SALESPEOPLE PUT] Dane do aktualizacji:", updateData);

    // Aktualizuj handlowca (email NIE jest aktualizowany - pochodzi z głównej skrzynki)
    const salesperson = await db.virtualSalesperson.update({
      where: { id: salespersonId },
      data: updateData
    });

    return NextResponse.json(salesperson);
  } catch (error: any) {
    console.error("Błąd aktualizacji handlowca:", error);
    console.error("Szczegóły błędu:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { 
        error: "Wystąpił błąd podczas aktualizacji handlowca", 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
