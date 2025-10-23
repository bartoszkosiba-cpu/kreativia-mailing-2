import { NextResponse } from 'next/server';
import { scheduleDailyEmailsForAll, scheduleDailyEmailsForMailbox } from '@/services/warmup/scheduler';
import { db } from '@/lib/db';

/**
 * POST /api/admin/warmup-test/schedule
 * 
 * Planuje maile warmup (test)
 * 
 * Body (opcjonalne):
 * {
 *   "mailboxId": 7  // Jeśli chcesz zaplanować tylko dla jednej skrzynki
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mailboxId } = body;
    
    console.log(`[WARMUP TEST] Planowanie maili warmup...`);
    
    if (mailboxId) {
      // Zaplanuj dla jednej skrzynki
      const count = await scheduleDailyEmailsForMailbox(mailboxId);
      
      return NextResponse.json({
        success: true,
        message: `Zaplanowano ${count} maili dla skrzynki ${mailboxId}`,
        scheduled: count,
        mailboxId
      });
    } else {
      // Zaplanuj dla wszystkich
      const result = await scheduleDailyEmailsForAll();
      
      return NextResponse.json({
        success: true,
        message: `Zaplanowano ${result.total} maili dla ${result.mailboxes} skrzynek`,
        ...result
      });
    }
    
  } catch (error: any) {
    console.error('[WARMUP TEST] Błąd planowania:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/warmup-test/schedule
 * 
 * Pobiera statystyki zaplanowanych maili
 */
export async function GET() {
  try {
    // Statystyki queue
    const total = await db.warmupQueue.count();
    const pending = await db.warmupQueue.count({ where: { status: 'pending' } });
    const sent = await db.warmupQueue.count({ where: { status: 'sent' } });
    const failed = await db.warmupQueue.count({ where: { status: 'failed' } });
    
    // Grupuj po skrzynkach
    const byMailbox = await db.warmupQueue.groupBy({
      by: ['mailboxId', 'status'],
      _count: true,
      where: {
        status: 'pending'
      }
    });
    
    // Najbliższe zaplanowane maile
    const upcoming = await db.warmupQueue.findMany({
      where: {
        status: 'pending',
        scheduledAt: {
          gte: new Date()
        }
      },
      orderBy: {
        scheduledAt: 'asc'
      },
      take: 10,
      include: {
        mailbox: {
          select: {
            email: true,
            warmupDay: true
          }
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      stats: {
        total,
        pending,
        sent,
        failed
      },
      byMailbox,
      upcoming: upcoming.map(item => ({
        id: item.id,
        mailboxEmail: item.mailbox.email,
        warmupDay: item.mailbox.warmupDay,
        scheduledAt: item.scheduledAt,
        emailType: item.emailType,
        toEmail: item.toEmail,
        status: item.status
      }))
    });
    
  } catch (error: any) {
    console.error('[WARMUP TEST] Błąd pobierania statystyk:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

