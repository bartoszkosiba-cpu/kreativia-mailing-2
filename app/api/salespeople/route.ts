import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const salespeople = await db.virtualSalesperson.findMany({
      include: {
        campaigns: {
          select: {
            id: true,
            name: true
          }
        },
        mainMailbox: {
          select: {
            id: true,
            email: true,
            isActive: true
          }
        },
        mailboxes: {
          select: {
            id: true,
            email: true,
            isActive: true,
            priority: true
          },
          orderBy: { priority: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(salespeople);
  } catch (error) {
    console.error("Błąd pobierania handlowców:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas pobierania handlowców" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { 
      name, phone, language, markets, 
      realSalespersonEmail,
      realSalespersonName,
      realSalespersonPhone,
      realSalespersonSignature,
      isActive 
    } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Imię jest wymagane" }, { status: 400 });
    }

    // Stwórz handlowca z placeholder emailem
    const salesperson = await db.virtualSalesperson.create({
      data: {
        name,
        email: `placeholder-${Date.now()}@kreativia.eu`, // Tymczasowy email
        phone: phone || null,
        language: language || "pl",
        markets: markets || null,
        realSalespersonEmail: realSalespersonEmail || null,
        realSalespersonName: realSalespersonName || null,
        realSalespersonPhone: realSalespersonPhone || null,
        realSalespersonSignature: realSalespersonSignature || null,
        isActive: isActive !== false
      }
    });

    return NextResponse.json(salesperson, { status: 201 });
  } catch (error) {
    console.error("Błąd tworzenia handlowca:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas tworzenia handlowca" }, { status: 500 });
  }
}
