import { NextResponse } from "next/server";
import { scheduleDailyEmailsForAll } from "@/services/warmup/scheduler";
import { advanceWarmupDays } from "@/services/warmup/tracker";

/**
 * Ręczne wywołanie scheduler warmup (dla testów/debugowania)
 */
export async function POST() {
  try {
    console.log('[API] 🔧 Ręczne uruchomienie warmup scheduler...');
    
    // 1. Zwiększ dni warmup
    console.log('[API] 1️⃣ Zwiększanie dni warmup...');
    const advResult = await advanceWarmupDays();
    console.log(`[API]    → Advanced: ${advResult.advanced}, Completed: ${advResult.completed}`);
    
    // 2. Zaplanuj maile
    console.log('[API] 2️⃣ Planowanie maili na dziś...');
    const schedResult = await scheduleDailyEmailsForAll();
    console.log(`[API]    → Zaplanowano: ${schedResult.total} maili dla ${schedResult.mailboxes} skrzynek`);
    
    return NextResponse.json({
      success: true,
      advance: advResult,
      schedule: schedResult
    });
  } catch (error: any) {
    console.error('[API] ❌ Błąd:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

