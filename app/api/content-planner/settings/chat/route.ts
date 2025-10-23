import { NextRequest, NextResponse } from "next/server";
import { chatWithMetaAI } from "@/services/metaAI";

// POST - Wyślij wiadomość do Meta-AI
export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Wiadomość jest wymagana" },
        { status: 400 }
      );
    }

    console.log(`[API] Meta-AI chat: "${message}"`);

    const result = await chatWithMetaAI(message);

    return NextResponse.json({
      success: true,
      response: result.aiResponse,
      config: result.updatedConfig,
      needsConfirmation: result.needsConfirmation
    });
  } catch (error: any) {
    console.error("Błąd Meta-AI chat:", error);
    return NextResponse.json(
      { error: "Błąd komunikacji z Meta-AI", details: error.message },
      { status: 500 }
    );
  }
}

