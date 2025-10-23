import { NextResponse } from 'next/server';
import { sendNextScheduledEmail } from '@/services/warmup/sender';

/**
 * TYMCZASOWY ENDPOINT - wysyła wszystkie zaplanowane maile naraz (dla testów)
 */
export async function POST() {
  try {
    console.log('[ADMIN] 🚀 Masowe wysyłanie zaplanowanych maili warmup...');
    
    let sent = 0;
    let failed = 0;
    let maxIterations = 200; // Zabezpieczenie przed infinite loop
    
    // Wysyłaj dopóki są maile w kolejce
    for (let i = 0; i < maxIterations; i++) {
      const result = await sendNextScheduledEmail();
      
      if (!result.mailSent) {
        // Brak maili do wysłania
        break;
      }
      
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
      
      // Co 10 maili - loguj progress
      if (sent % 10 === 0) {
        console.log(`[ADMIN] Progress: ${sent} wysłanych, ${failed} błędów`);
      }
    }
    
    console.log(`[ADMIN] ✅ Zakończono masową wysyłkę`);
    console.log(`[ADMIN]    → Wysłano: ${sent}`);
    console.log(`[ADMIN]    → Błędów: ${failed}`);
    
    return NextResponse.json({
      success: true,
      sent,
      failed
    });
  } catch (error: any) {
    console.error('[ADMIN] ❌ Błąd masowej wysyłki:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

