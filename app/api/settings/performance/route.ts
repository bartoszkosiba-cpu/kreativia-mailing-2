import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT - Aktualizuj ustawienia wydajności warmup
export async function PUT(req: NextRequest) {
  try {
    const { weeks } = await req.json();
    
    if (!weeks || !Array.isArray(weeks)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }
    
    // Pobierz istniejące ustawienia
    let settings = await db.companySettings.findFirst();
    
    if (!settings) {
      return NextResponse.json({ error: "Company settings not found" }, { status: 404 });
    }
    
    // Zapisz jako JSON
    const warmupPerformanceSettings = JSON.stringify(weeks);
    
    // Aktualizuj
    settings = await db.companySettings.update({
      where: { id: settings.id },
      data: {
        warmupPerformanceSettings
      }
    });
    
    return NextResponse.json({
      message: "Ustawienia wydajności zapisane pomyślnie",
      settings
    });
  } catch (error) {
    console.error("Błąd zapisywania ustawień wydajności:", error);
    return NextResponse.json({ error: "Wystąpił błąd podczas zapisywania ustawień" }, { status: 500 });
  }
}


