import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST - Utwórz wersję ręcznie (bez AI)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const themeId = parseInt(params.id);
    const { type, subject, content, variantLetter } = await req.json();

    if (!type || !subject || !content) {
      return NextResponse.json(
        { error: "Typ, temat i treść są wymagane" },
        { status: 400 }
      );
    }

    // Znajdź kolejny versionNumber
    const lastVersion = await db.campaignVersion.findFirst({
      where: { campaignThemeId: themeId, type },
      orderBy: { versionNumber: "desc" }
    });

    const versionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const version = await db.campaignVersion.create({
      data: {
        campaignThemeId: themeId,
        versionNumber,
        type,
        variantLetter: variantLetter || null,
        subject,
        content,
        aiRationale: "Utworzone ręcznie przez użytkownika",
        aiModel: "manual",
        status: "draft"
      }
    });

    console.log(`[CONTENT PLANNER] Utworzono ręczną wersję ${versionNumber} (${type})`);

    return NextResponse.json({
      success: true,
      version
    }, { status: 201 });
  } catch (error: any) {
    console.error("Błąd tworzenia ręcznej wersji:", error);
    return NextResponse.json(
      { error: "Błąd tworzenia wersji", details: error.message },
      { status: 500 }
    );
  }
}

