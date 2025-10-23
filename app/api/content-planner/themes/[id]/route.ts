import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Pobierz temat z wersjami i historią
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const themeId = parseInt(params.id);

    const theme = await db.campaignTheme.findUnique({
      where: { id: themeId },
      include: {
        productGroup: true,
        versions: {
          orderBy: [
            { type: "asc" },
            { versionNumber: "desc" },
            { variantLetter: "asc" }
          ]
        }
      }
    });

    if (!theme) {
      return NextResponse.json(
        { error: "Temat nie istnieje" },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const response = {
      ...theme,
      conversationHistory: theme.conversationHistory 
        ? JSON.parse(theme.conversationHistory)
        : [],
      briefingData: theme.briefingData 
        ? JSON.parse(theme.briefingData)
        : {}
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Błąd pobierania tematu:", error);
    return NextResponse.json(
      { error: "Błąd pobierania tematu", details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Aktualizuj temat
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const themeId = parseInt(params.id);
    const body = await req.json();

    const theme = await db.campaignTheme.update({
      where: { id: themeId },
      data: {
        name: body.name,
        description: body.description,
        status: body.status,
        targetAudience: body.targetAudience,
        problemStatement: body.problemStatement,
        callToAction: body.callToAction,
        toneOfVoice: body.toneOfVoice,
        emailLength: body.emailLength,
        mainArguments: body.mainArguments
      }
    });

    return NextResponse.json(theme);
  } catch (error: any) {
    console.error("Błąd aktualizacji tematu:", error);
    return NextResponse.json(
      { error: "Błąd aktualizacji tematu", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Usuń temat
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const themeId = parseInt(params.id);

    await db.campaignTheme.delete({
      where: { id: themeId }
    });

    return NextResponse.json({ message: "Temat usunięty" });
  } catch (error: any) {
    console.error("Błąd usuwania tematu:", error);
    return NextResponse.json(
      { error: "Błąd usuwania tematu", details: error.message },
      { status: 500 }
    );
  }
}

