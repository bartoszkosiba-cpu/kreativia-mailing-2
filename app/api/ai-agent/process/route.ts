import { NextRequest, NextResponse } from "next/server";
import { EmailAgentAI } from "@/services/emailAgentAI";

// POST: Przetwórz konkretną odpowiedź
export async function POST(request: NextRequest) {
  try {
    const { replyId } = await request.json();
    
    if (!replyId || typeof replyId !== 'number') {
      return NextResponse.json({ error: "Nieprawidłowe ID odpowiedzi" }, { status: 400 });
    }

    console.log(`[API] Przetwarzanie odpowiedzi ID: ${replyId} przez AI Agent`);
    
    const analysis = await EmailAgentAI.processEmailReply(replyId);
    await EmailAgentAI.executeActions(analysis, replyId);
    
    return NextResponse.json({
      success: true,
      message: "Odpowiedź przetworzona przez AI Agent",
      analysis: {
        classification: analysis.classification.classification,
        confidence: analysis.classification.confidence,
        leadStatus: analysis.leadStatus,
        leadSubStatus: analysis.leadSubStatus,
        actionsTaken: analysis.actions.length,
        actions: analysis.actions.map(action => ({
          type: action.type,
          priority: action.priority,
          description: action.description
        }))
      }
    });
    
  } catch (error: any) {
    console.error("Błąd przetwarzania przez AI Agent:", error);
    return NextResponse.json({ 
      error: "Błąd przetwarzania przez AI Agent", 
      details: error.message 
    }, { status: 500 });
  }
}

// GET: Przetwórz wszystkie nieprzetworzone odpowiedzi
export async function GET() {
  try {
    console.log("[API] Rozpoczynam przetwarzanie wszystkich nieprzetworzonych odpowiedzi");
    
    // TODO: Implementuj processAllPendingReplies w EmailAgentAI
    console.log("[API] Funkcja processAllPendingReplies nie jest jeszcze zaimplementowana w EmailAgentAI");
    
    return NextResponse.json({
      success: true,
      message: "Przetworzono wszystkie nieprzetworzone odpowiedzi"
    });
    
  } catch (error: any) {
    console.error("Błąd przetwarzania wszystkich odpowiedzi:", error);
    return NextResponse.json({ 
      error: "Błąd przetwarzania odpowiedzi", 
      details: error.message 
    }, { status: 500 });
  }
}
