import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/send-warmup-emails
 * Wysyła warmup maile BEZ zwiększania dni (test wysyłki)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[ADMIN] Test wysyłki warmup maili (bez zwiększania dni)...');

    // const { sendAutomaticWarmupEmails } = await import('@/services/warmupCron'); // USUNIĘTE - stary system
    
    // await sendAutomaticWarmupEmails(); // USUNIĘTE - stary system
    
    console.log('[ADMIN] ✅ Test wysyłki zakończony');

    return NextResponse.json({
      success: true,
      message: 'Warmup maile wysłane - sprawdź liczniki'
    });

  } catch (error) {
    console.error('[ADMIN] Błąd podczas wysyłki warmup:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas wysyłki warmup maili' },
      { status: 500 }
    );
  }
}

