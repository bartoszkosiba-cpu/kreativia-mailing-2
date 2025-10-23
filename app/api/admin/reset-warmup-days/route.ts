import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    console.log('[RESET WARMUP DAYS] Rozpoczynam resetowanie dni warmup...');
    
    // Zresetuj dni warmup do 1 dla wszystkich skrzynek w warmup
    const result = await db.mailbox.updateMany({
      where: {
        warmupStatus: 'warming'
      },
      data: {
        warmupDay: 1,
        warmupTodaySent: 0,
        warmupPhase: 'silent',
        warmupDailyLimit: 15,
        dailyEmailLimit: 15
      }
    });

    console.log(`[RESET WARMUP DAYS] ✅ Zresetowano ${result.count} skrzynek do dnia 1`);

    return NextResponse.json({
      success: true,
      message: `Zresetowano ${result.count} skrzynek do dnia 1`,
      count: result.count
    });

  } catch (error) {
    console.error('[RESET WARMUP DAYS] ❌ Błąd podczas resetowania dni warmup:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas resetowania dni warmup' },
      { status: 500 }
    );
  }
}
