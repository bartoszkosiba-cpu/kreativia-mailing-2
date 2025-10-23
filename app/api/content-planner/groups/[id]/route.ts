import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz grupę z tematami
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = parseInt(params.id);

    const group = await db.productGroup.findUnique({
      where: { id: groupId },
      include: {
        campaignThemes: {
          include: {
            _count: {
              select: { versions: true }
            }
          },
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!group) {
      return NextResponse.json(
        { error: "Grupa nie istnieje" },
        { status: 404 }
      );
    }

    return NextResponse.json(group);
  } catch (error: any) {
    console.error("Błąd pobierania grupy:", error);
    return NextResponse.json(
      { error: "Błąd pobierania grupy", details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Aktualizuj grupę
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = parseInt(params.id);
    const body = await req.json();

    const group = await db.productGroup.update({
      where: { id: groupId },
      data: {
        name: body.name,
        description: body.description,
        targetAudience: body.targetAudience,
        markets: body.markets,
        iconEmoji: body.iconEmoji,
        isActive: body.isActive
      }
    });

    return NextResponse.json(group);
  } catch (error: any) {
    console.error("Błąd aktualizacji grupy:", error);
    return NextResponse.json(
      { error: "Błąd aktualizacji grupy", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Usuń grupę
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = parseInt(params.id);

    // Sprawdź czy są tematy
    const themesCount = await db.campaignTheme.count({
      where: { productGroupId: groupId }
    });

    if (themesCount > 0) {
      return NextResponse.json(
        { error: `Nie można usunąć grupy - ma ${themesCount} tematów kampanii` },
        { status: 400 }
      );
    }

    await db.productGroup.delete({
      where: { id: groupId }
    });

    return NextResponse.json({ message: "Grupa usunięta" });
  } catch (error: any) {
    console.error("Błąd usuwania grupy:", error);
    return NextResponse.json(
      { error: "Błąd usuwania grupy", details: error.message },
      { status: 500 }
    );
  }
}

