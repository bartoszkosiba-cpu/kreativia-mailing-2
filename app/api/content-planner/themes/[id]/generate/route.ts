import { NextRequest, NextResponse } from "next/server";
import { generateContentVariants, extractBriefingFromConversation } from "@/services/contentAI";

// POST - Wygeneruj 3 warianty treści (A, B, C)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const themeId = parseInt(params.id);
    const { type } = await req.json();

    if (!type) {
      return NextResponse.json(
        { error: "Typ (initial/followup_X) jest wymagany" },
        { status: 400 }
      );
    }

    console.log(`[API] Generowanie 3 wariantów dla tematu ${themeId}, typ: ${type}`);

    // Najpierw wyciągnij briefing z rozmowy
    await extractBriefingFromConversation(themeId);

    // Wygeneruj 3 warianty
    const result = await generateContentVariants(themeId, type);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("Błąd generowania treści:", error);
    return NextResponse.json(
      { error: error.message || "Błąd generowania treści", details: error.stack },
      { status: 500 }
    );
  }
}

