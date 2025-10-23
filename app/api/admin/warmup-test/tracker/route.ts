import { NextResponse } from 'next/server';
import { resetDailyCounters, advanceWarmupDays, startWarmup, stopWarmup } from '@/services/warmup/tracker';

/**
 * POST /api/admin/warmup-test/tracker
 * 
 * Testuje funkcje tracker
 * 
 * Body:
 * {
 *   "action": "reset" | "advance" | "start" | "stop",
 *   "mailboxId": 7  // Dla start/stop
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, mailboxId } = body;
    
    console.log(`[WARMUP TEST] Tracker action: ${action}`);
    
    switch (action) {
      case 'reset':
        const resetCount = await resetDailyCounters();
        return NextResponse.json({
          success: true,
          message: `Zresetowano ${resetCount} skrzynek`,
          count: resetCount
        });
      
      case 'advance':
        const advanceResult = await advanceWarmupDays();
        return NextResponse.json({
          success: true,
          message: `Zwiększono: ${advanceResult.advanced}, Zakończono: ${advanceResult.completed}`,
          ...advanceResult
        });
      
      case 'start':
        if (!mailboxId) {
          return NextResponse.json({
            success: false,
            error: 'mailboxId required'
          }, { status: 400 });
        }
        await startWarmup(mailboxId);
        return NextResponse.json({
          success: true,
          message: `Warmup rozpoczęty dla skrzynki ${mailboxId}`
        });
      
      case 'stop':
        if (!mailboxId) {
          return NextResponse.json({
            success: false,
            error: 'mailboxId required'
          }, { status: 400 });
        }
        await stopWarmup(mailboxId);
        return NextResponse.json({
          success: true,
          message: `Warmup zatrzymany dla skrzynki ${mailboxId}`
        });
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: reset, advance, start, stop'
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('[WARMUP TEST] Błąd tracker:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

