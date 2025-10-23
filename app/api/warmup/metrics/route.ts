import { NextRequest, NextResponse } from 'next/server';
import { updateAllMailboxMetrics } from '@/services/mailboxMetrics';

/**
 * POST /api/warmup/metrics - Ręczne przeliczenie metryk wszystkich skrzynek
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[API] Ręczne przeliczenie metryk mailboxów...');
    
    await updateAllMailboxMetrics();
    
    return NextResponse.json({
      success: true,
      message: 'Metryki zostały przeliczone'
    });
    
  } catch (error: any) {
    console.error('[API] Błąd przeliczania metryk:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Błąd podczas przeliczania metryk',
        details: error.message
      },
      { status: 500 }
    );
  }
}

