import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz wszystkie grupy produktowe
export async function GET(req: NextRequest) {
  try {
    const groups = await db.productGroup.findMany({
      include: {
        _count: {
          select: { 
            savedContents: true,
            campaignThemes: true 
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(groups);
  } catch (error: any) {
    console.error("Błąd pobierania grup:", error);
    return NextResponse.json(
      { error: "Błąd pobierania grup", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Utwórz nową grupę produktową
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Nazwa grupy jest wymagana" },
        { status: 400 }
      );
    }

    const group = await db.productGroup.create({
      data: {
        name: body.name,
        description: body.description || null,
        targetAudience: body.targetAudience || null,
        markets: body.markets || "PL",
        iconEmoji: body.iconEmoji || "📦",
        isActive: body.isActive !== false
      }
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error: any) {
    console.error("Błąd tworzenia grupy:", error);
    return NextResponse.json(
      { error: "Błąd tworzenia grupy", details: error.message },
      { status: 500 }
    );
  }
}

