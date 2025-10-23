import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz SavedContent
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contentId = parseInt(params.id);

    const content = await db.savedContent.findUnique({
      where: { id: contentId },
      include: {
        productGroup: true
      }
    });

    if (!content) {
      return NextResponse.json(
        { error: "Content nie istnieje" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      content
    });
  } catch (error: any) {
    console.error("Błąd pobierania content:", error);
    return NextResponse.json(
      { error: "Błąd pobierania", details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Aktualizuj SavedContent
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contentId = parseInt(params.id);
    const body = await req.json();

    const content = await db.savedContent.update({
      where: { id: contentId },
      data: {
        name: body.name,
        subject: body.subject,
        content: body.content,
        notes: body.notes,
        tags: body.tags,
        isFavorite: body.isFavorite,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      content
    });
  } catch (error: any) {
    console.error("Błąd aktualizacji content:", error);
    return NextResponse.json(
      { error: "Błąd aktualizacji", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Usuń SavedContent
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contentId = parseInt(params.id);

    await db.savedContent.update({
      where: { id: contentId },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: "Content usunięty (soft delete)"
    });
  } catch (error: any) {
    console.error("Błąd usuwania content:", error);
    return NextResponse.json(
      { error: "Błąd usuwania", details: error.message },
      { status: 500 }
    );
  }
}

