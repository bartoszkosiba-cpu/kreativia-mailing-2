import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WARMUP_SCHEDULE, WarmupDayConfig } from "@/services/warmup/config";

/**
 * GET /api/warmup/schedule - Pobierz harmonogram warmup
 */
export async function GET() {
  try {
    // Spróbuj pobrać z bazy (jeśli istnieje custom harmonogram)
    const settings = await db.companySettings.findFirst();
    
    if (settings?.warmupSchedule) {
      try {
        const customSchedule = JSON.parse(settings.warmupSchedule) as WarmupDayConfig[];
        return NextResponse.json({
          success: true,
          data: customSchedule,
          isCustom: true
        });
      } catch (e) {
        // Jeśli parsing się nie powiedzie, użyj domyślnego
      }
    }
    
    // Zwróć domyślny harmonogram
    return NextResponse.json({
      success: true,
      data: WARMUP_SCHEDULE,
      isCustom: false
    });
  } catch (error) {
    console.error("Błąd pobierania harmonogramu:", error);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania harmonogramu" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/warmup/schedule - Zapisz harmonogram warmup
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { schedule } = body;
    
    if (!Array.isArray(schedule)) {
      return NextResponse.json(
        { success: false, error: "Schedule musi być tablicą" },
        { status: 400 }
      );
    }
    
    // Walidacja
    if (schedule.length !== 30) {
      return NextResponse.json(
        { success: false, error: "Harmonogram musi mieć 30 dni" },
        { status: 400 }
      );
    }
    
    for (let i = 0; i < schedule.length; i++) {
      const day = schedule[i];
      if (!day.day || day.day !== i + 1) {
        return NextResponse.json(
          { success: false, error: `Nieprawidłowy dzień ${i + 1}` },
          { status: 400 }
        );
      }
      if (typeof day.dailyLimit !== "number" || day.dailyLimit < 0) {
        return NextResponse.json(
          { success: false, error: `Nieprawidłowy dailyLimit dla dnia ${i + 1}` },
          { status: 400 }
        );
      }
      if (typeof day.campaignLimit !== "number" || day.campaignLimit < 0) {
        return NextResponse.json(
          { success: false, error: `Nieprawidłowy campaignLimit dla dnia ${i + 1}` },
          { status: 400 }
        );
      }
    }
    
    // Zapisz do bazy
    await db.companySettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        warmupSchedule: JSON.stringify(schedule)
      },
      update: {
        warmupSchedule: JSON.stringify(schedule)
      }
    });
    
    return NextResponse.json({
      success: true,
      message: "Harmonogram zapisany pomyślnie"
    });
  } catch (error) {
    console.error("Błąd zapisywania harmonogramu:", error);
    return NextResponse.json(
      { success: false, error: "Błąd zapisywania harmonogramu" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/warmup/schedule - Przywróć domyślny harmonogram
 */
export async function DELETE() {
  try {
    await db.companySettings.update({
      where: { id: 1 },
      data: {
        warmupSchedule: null
      }
    });
    
    return NextResponse.json({
      success: true,
      data: WARMUP_SCHEDULE,
      message: "Przywrócono domyślny harmonogram"
    });
  } catch (error) {
    console.error("Błąd przywracania harmonogramu:", error);
    return NextResponse.json(
      { success: false, error: "Błąd przywracania harmonogramu" },
      { status: 500 }
    );
  }
}

