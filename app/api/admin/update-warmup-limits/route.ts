import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/admin/update-warmup-limits - Zaktualizuj limity warmup dla istniejących skrzynek
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[ADMIN] Aktualizacja limitów warmup...');

    // Pobierz wszystkie skrzynki
    const mailboxes = await db.mailbox.findMany({
      where: {
        isActive: true
      }
    });

    console.log(`[ADMIN] Znaleziono ${mailboxes.length} skrzynek do aktualizacji`);

    const updatedMailboxes = [];

    for (const mailbox of mailboxes) {
      const updates: any = {};

      // Zaktualizuj limity warmup
      if (mailbox.warmupStatus === 'ready_to_warmup' || mailbox.warmupStatus === 'inactive') {
        // Skrzynki gotowe do warmup - ustaw nowe limity
        updates.warmupDailyLimit = 15;
        updates.dailyEmailLimit = 15; // Nowy limit kampanii
        console.log(`[ADMIN] Aktualizuję ${mailbox.email}: warmup 5→15, kampanie 150→15`);
      } else if (mailbox.warmupStatus === 'warming') {
        // Skrzynki w warmup - ustaw nowe limity na podstawie dnia
        const warmupDay = mailbox.warmupDay || 1;
        const newWarmupLimit = Math.min(15 + Math.floor((warmupDay - 1) / 2) * 2, 45);
        const newCampaignLimit = Math.min(15 + Math.floor((warmupDay - 1) / 2) * 2, 45);
        
        updates.warmupDailyLimit = newWarmupLimit;
        updates.dailyEmailLimit = newCampaignLimit;
        console.log(`[ADMIN] Aktualizuję ${mailbox.email} (dzień ${warmupDay}): warmup 5→${newWarmupLimit}, kampanie 150→${newCampaignLimit}`);
      } else if (mailbox.warmupStatus === 'ready') {
        // Skrzynki po warmup - ustaw limit na 75
        updates.dailyEmailLimit = 75;
        console.log(`[ADMIN] Aktualizuję ${mailbox.email} (po warmup): kampanie 150→75`);
      }

      if (Object.keys(updates).length > 0) {
        const updatedMailbox = await db.mailbox.update({
          where: { id: mailbox.id },
          data: updates
        });
        updatedMailboxes.push({
          id: mailbox.id,
          email: mailbox.email,
          warmupStatus: mailbox.warmupStatus,
          warmupDay: mailbox.warmupDay,
          updates
        });
      }
    }

    console.log(`[ADMIN] ✅ Zaktualizowano ${updatedMailboxes.length} skrzynek`);

    return NextResponse.json({
      success: true,
      message: `Zaktualizowano ${updatedMailboxes.length} skrzynek`,
      data: updatedMailboxes
    });

  } catch (error) {
    console.error('[ADMIN] Błąd podczas aktualizacji limitów warmup:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas aktualizacji limitów warmup' },
      { status: 500 }
    );
  }
}
