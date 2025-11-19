import { NextResponse } from "next/server";
import { getTokenStats, trackTokenUsage } from "@/services/tokenTracker";

/**
 * Endpoint sprawdzający czy ChatGPT API działa
 * GET /api/ai/health
 */
export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        status: "error",
        message: "Brak OPENAI_API_KEY w zmiennych środowiskowych",
        isWorking: false,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Prosty test - zapytaj ChatGPT o coś banalnego
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });

    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ 
        role: "user", 
        content: "Odpowiedz jednym słowem: OK" 
      }],
      temperature: 0,
      max_tokens: 10,
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const answer = response.choices[0].message.content?.trim() || "";

    // Track token usage
    if (response.usage) {
      await trackTokenUsage({
        operation: "ai_health_check",
        model: "gpt-4o-mini",
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
      });
    }

    // Pobierz statystyki tokenów
    const tokenStats = await getTokenStats("today");

    if (answer.toLowerCase().includes("ok")) {
      return NextResponse.json({
        status: "success",
        message: "ChatGPT API działa prawidłowo",
        isWorking: true,
        responseTime: responseTime,
        model: "gpt-4o-mini",
        timestamp: new Date().toISOString(),
        tokenStats: {
          today: tokenStats.summary
        }
      });
    } else {
      return NextResponse.json({
        status: "warning",
        message: "ChatGPT odpowiedział, ale nieoczekiwanie",
        isWorking: true,
        responseTime: responseTime,
        response: answer,
        timestamp: new Date().toISOString(),
        tokenStats: {
          today: tokenStats.summary
        }
      });
    }

  } catch (error: any) {
    console.error("[AI HEALTH] Błąd sprawdzania ChatGPT:", error);
    
    return NextResponse.json({
      status: "error",
      message: error.message || "Nieznany błąd",
      isWorking: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

