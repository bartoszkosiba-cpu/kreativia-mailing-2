import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT - Aktualizuj ustawienia wydajności warmup
export async function PUT(req: NextRequest) {
  try {
    const { weeks } = await req.json();
    
    console.log('[API PERFORMANCE] Otrzymano dane:', weeks);
    
    if (!weeks || !Array.isArray(weeks)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }
    
    // Walidacja - sprawdź strukturę
    if (weeks.length !== 5) {
      return NextResponse.json({ error: "Musisz podać dokładnie 5 tygodni" }, { status: 400 });
    }
    
    for (const week of weeks) {
      if (!week.week || !Number.isInteger(week.week) || week.week < 1 || week.week > 5) {
        return NextResponse.json({ error: `Nieprawidłowy numer tygodnia: ${week.week}` }, { status: 400 });
      }
      if (!Number.isInteger(week.warmup) || week.warmup < 0) {
        return NextResponse.json({ error: `Nieprawidłowy limit warmup dla tygodnia ${week.week}: ${week.warmup}` }, { status: 400 });
      }
      if (!Number.isInteger(week.campaign) || week.campaign < 0) {
        return NextResponse.json({ error: `Nieprawidłowy limit kampanii dla tygodnia ${week.week}: ${week.campaign}` }, { status: 400 });
      }
    }
    
    // Sortuj według tygodnia
    const sortedWeeks = [...weeks].sort((a, b) => a.week - b.week);
    
    // Pobierz istniejące ustawienia
    let settings = await db.companySettings.findFirst();
    
    if (!settings) {
      return NextResponse.json({ error: "Company settings not found" }, { status: 404 });
    }
    
    // Zapisz jako JSON
    const warmupPerformanceSettings = JSON.stringify(sortedWeeks);
    console.log('[API PERFORMANCE] Zapisuję:', warmupPerformanceSettings);
    
    // Aktualizuj
    settings = await db.companySettings.update({
      where: { id: settings.id },
      data: {
        warmupPerformanceSettings
      }
    });
    
    // Zwróć zapisane dane (z bazy)
    const savedSettings = JSON.parse(settings.warmupPerformanceSettings || '[]');
    console.log('[API PERFORMANCE] Zapisano:', savedSettings);
    
    return NextResponse.json({
      success: true,
      message: "Ustawienia wydajności zapisane pomyślnie",
      weeks: savedSettings
    });
  } catch (error: any) {
    console.error("[API PERFORMANCE] Błąd zapisywania ustawień wydajności:", error);
    return NextResponse.json({ 
      error: "Wystąpił błąd podczas zapisywania ustawień",
      details: error.message 
    }, { status: 500 });
  }
}


