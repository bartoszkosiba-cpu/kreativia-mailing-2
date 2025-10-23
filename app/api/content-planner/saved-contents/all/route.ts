import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz wszystkie SavedContent (ze wszystkich grup)
export async function GET(req: NextRequest) {
  try {
    const contents = await db.savedContent.findMany({
      where: { isActive: true },
      include: {
        productGroup: {
          select: { id: true, name: true, iconEmoji: true }
        }
      },
      orderBy: [
        { isFavorite: 'desc' },
        { updatedAt: 'desc' }
      ]
    });

    // Format dla selecta
    const formatted = contents.map(c => ({
      id: c.id,
      label: `${c.productGroup.iconEmoji || "📦"} ${c.productGroup.name} > ${c.name} (${c.type})`,
      subject: c.subject,
      content: c.content,
      type: c.type,
      productGroup: c.productGroup.name
    }));

    return NextResponse.json({
      success: true,
      contents: formatted
    });
  } catch (error: any) {
    console.error("Błąd pobierania saved contents:", error);
    return NextResponse.json(
      { error: "Błąd pobierania", details: error.message },
      { status: 500 }
    );
  }
}

