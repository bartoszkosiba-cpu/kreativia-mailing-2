import { NextResponse } from 'next/server';
import { sendScheduledEmails, sendNextScheduledEmail } from '@/services/warmup/sender';

/**
 * POST /api/admin/warmup-test/send
 * 
 * Wysyła zaplanowane maile warmup (test)
 */
export async function POST() {
  try {
    console.log(`[WARMUP TEST] Wysyłanie zaplanowanych maili...`);
    
    const result = await sendScheduledEmails();
    
    return NextResponse.json({
      message: `Wysłano: ${result.sent}, Pominięto: ${result.skipped}, Błędy: ${result.failed}`,
      ...result
    });
    
  } catch (error: any) {
    console.error('[WARMUP TEST] Błąd wysyłania:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

