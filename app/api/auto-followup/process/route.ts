// API endpoint do ręcznego uruchomienia AUTO_FOLLOWUP
import { NextRequest, NextResponse } from "next/server";
import { processAutoFollowUps } from "@/services/autoFollowUpManager";

export async function POST(request: NextRequest) {
  try {
    console.log("[API] Ręczne uruchomienie AUTO_FOLLOWUP");
    
    await processAutoFollowUps();
    
    return NextResponse.json({
      success: true,
      message: "AUTO_FOLLOWUP przetworzony pomyślnie"
    });
    
  } catch (error: any) {
    console.error("[API] Błąd AUTO_FOLLOWUP:", error);
    return NextResponse.json({ 
      error: "Błąd przetwarzania AUTO_FOLLOWUP", 
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    console.log("[API] Sprawdzanie statusu AUTO_FOLLOWUP");
    
    // Pokaż statystyki leadów oczekujących na AUTO_FOLLOWUP
    const { db } = await import("@/lib/db");
    
    const awaitingLeads = await db.lead.count({
      where: {
        status: "CZEKAJ",
        subStatus: "CZEKAJ_REDIRECT_AWAITING_CONTACT"
      }
    });
    
    const timeoutLeads = await db.lead.count({
      where: {
        status: "CZEKAJ",
        subStatus: "CZEKAJ_REDIRECT_AWAITING_CONTACT",
        updatedAt: {
          lte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      stats: {
        awaitingAutoFollowUp: awaitingLeads,
        timeoutCandidates: timeoutLeads,
        lastCheck: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error("[API] Błąd sprawdzania AUTO_FOLLOWUP:", error);
    return NextResponse.json({ 
      error: "Błąd sprawdzania AUTO_FOLLOWUP", 
      details: error.message 
    }, { status: 500 });
  }
}
