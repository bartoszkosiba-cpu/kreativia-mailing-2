// API endpoint dla AI Chat Interface
import { NextRequest, NextResponse } from "next/server";
import { AIChatInterface } from "@/services/aiChatInterface";

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Wiadomość jest wymagana' },
        { status: 400 }
      );
    }

    console.log(`[AI CHAT API] Otrzymano wiadomość: ${message.substring(0, 50)}...`);

    const response = await AIChatInterface.processChatMessage(message, userId);

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('[AI CHAT API] Błąd:', error);
    return NextResponse.json(
      { 
        error: 'Błąd przetwarzania wiadomości',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId') || undefined;

    const history = await AIChatInterface.getChatHistory(limit, userId);
    const stats = await AIChatInterface.getChatStats();

    return NextResponse.json({
      success: true,
      data: {
        history,
        stats
      }
    });

  } catch (error) {
    console.error('[AI CHAT API] Błąd pobierania historii:', error);
    return NextResponse.json(
      { 
        error: 'Błąd pobierania historii chat',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}
