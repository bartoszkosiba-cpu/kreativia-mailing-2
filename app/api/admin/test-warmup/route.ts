import { NextRequest, NextResponse } from 'next/server';
import { sendScheduledEmails } from '@/services/warmup/sender';

/**
 * POST /api/admin/test-warmup - Test warmup - wyślij zaplanowane maile ręcznie
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[ADMIN] Test warmup - wysyłanie zaplanowanych maili...');
    
    const result = await sendScheduledEmails();
    
    console.log('[ADMIN] ✅ Test warmup zakończony');
    console.log(`[ADMIN]    → Wysłano: ${result.sent}`);
    console.log(`[ADMIN]    → Błędów: ${result.failed}`);

    return NextResponse.json({
      success: true,
      message: `Test warmup zakończony - wysłano ${result.sent} maili`,
      result
    });

  } catch (error: any) {
    console.error('[ADMIN] Błąd podczas testu warmup:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Błąd podczas testu warmup' },
      { status: 500 }
    );
  }
}
