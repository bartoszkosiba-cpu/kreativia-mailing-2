import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/admin/reset-warmup-history
 * Usuwa całą historię warmup emails i resetuje liczniki
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[RESET WARMUP HISTORY] Rozpoczynam czyszczenie historii warmup...');

    // Usuń wszystkie warmup emails
    const deletedEmails = await db.warmupEmail.deleteMany({});
    
    console.log(`[RESET WARMUP HISTORY] ✅ Usunięto ${deletedEmails.count} warmup emails`);

    // Zresetuj liczniki warmup dla wszystkich skrzynek
    const updatedMailboxes = await db.mailbox.updateMany({
      where: {
        warmupStatus: 'warming'
      },
      data: {
        warmupTodaySent: 0,
        warmupInternalEmails: 0,
        warmupTestEmails: 0
      }
    });

    console.log(`[RESET WARMUP HISTORY] ✅ Zresetowano liczniki dla ${updatedMailboxes.count} skrzynek`);

    return NextResponse.json({
      success: true,
      message: `Historia warmup wyczyszczona: usunięto ${deletedEmails.count} maili, zresetowano ${updatedMailboxes.count} skrzynek`,
      data: {
        deletedEmails: deletedEmails.count,
        resetMailboxes: updatedMailboxes.count
      }
    });

  } catch (error: any) {
    console.error('[RESET WARMUP HISTORY] ❌ Błąd:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Błąd podczas czyszczenia historii warmup' },
      { status: 500 }
    );
  }
}

