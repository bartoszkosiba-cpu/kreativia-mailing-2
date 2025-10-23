import { NextRequest, NextResponse } from "next/server";
import { chatWithContentAI } from "@/services/contentAI";

// POST - Wyślij wiadomość do AI (chat)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const themeId = parseInt(params.id);
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Wiadomość jest wymagana" },
        { status: 400 }
      );
    }

    console.log(`[API] Chat z AI dla tematu ${themeId}: "${message}"`);

    const aiResponse = await chatWithContentAI(themeId, message);

    return NextResponse.json({
      success: true,
      response: aiResponse
    });
  } catch (error: any) {
    console.error("Błąd chat z AI:", error);
    return NextResponse.json(
      { error: "Błąd komunikacji z AI", details: error.message },
      { status: 500 }
    );
  }
}

