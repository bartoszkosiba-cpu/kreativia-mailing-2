import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startBriefing } from "@/services/contentAI";

// GET - Pobierz tematy (opcjonalnie filtrowane po grupie)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");

    const where = groupId ? { productGroupId: parseInt(groupId) } : {};

    const themes = await db.campaignTheme.findMany({
      where,
      include: {
        productGroup: true,
        _count: {
          select: { versions: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json(themes);
  } catch (error: any) {
    console.error("Błąd pobierania tematów:", error);
    return NextResponse.json(
      { error: "Błąd pobierania tematów", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Utwórz nowy temat kampanii
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.productGroupId) {
      return NextResponse.json(
        { error: "Nazwa i ID grupy są wymagane" },
        { status: 400 }
      );
    }

    // Utwórz temat
    const theme = await db.campaignTheme.create({
      data: {
        productGroupId: body.productGroupId,
        name: body.name,
        description: body.description || null,
        status: "draft"
      }
    });

    // Automatycznie rozpocznij briefing z AI
    const aiGreeting = await startBriefing(theme.id);

    return NextResponse.json({
      theme,
      aiGreeting
    }, { status: 201 });
  } catch (error: any) {
    console.error("Błąd tworzenia tematu:", error);
    return NextResponse.json(
      { error: "Błąd tworzenia tematu", details: error.message },
      { status: 500 }
    );
  }
}

