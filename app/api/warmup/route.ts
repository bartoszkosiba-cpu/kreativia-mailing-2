import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/warmup - Pobierz listę wszystkich skrzynek z warmup
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const salespersonId = searchParams.get('salespersonId');

    const whereClause: any = {};
    if (salespersonId) {
      whereClause.virtualSalespersonId = parseInt(salespersonId);
    }

    const mailboxes = await db.mailbox.findMany({
      where: whereClause,
      include: {
        virtualSalesperson: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        warmupEmails: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Automatycznie aktualizuj status warmup dla skrzynek z gotowym DNS
    const mailboxesWithUpdatedStatus = await Promise.all(
      mailboxes.map(async (mailbox) => {
        // Jeśli DNS jest gotowy i status to 'inactive', zmień na 'ready_to_warmup'
        if (mailbox.dnsSetupCompleted && 
            mailbox.spfRecordStatus === 'configured' && 
            mailbox.dkimRecordStatus === 'configured' && 
            mailbox.dmarcRecordStatus === 'configured' &&
            mailbox.warmupStatus === 'inactive') {
          
          const updatedMailbox = await db.mailbox.update({
            where: { id: mailbox.id },
            data: { warmupStatus: 'ready_to_warmup' }
          });
          
          return updatedMailbox;
        }
        return mailbox;
      })
    );

    // Pobierz statystyki warmup dla każdej skrzynki
    const mailboxesWithStats = await Promise.all(
      mailboxesWithUpdatedStatus.map(async (mailbox) => {
        // Statystyki według dni
        const allEmails = await db.warmupEmail.findMany({
          where: { mailboxId: mailbox.id },
          select: {
            warmupDay: true,
            status: true
          }
        });
        
        const byDay: Record<number, { sent: number; failed: number; total: number }> = {};
        for (const email of allEmails) {
          const day = email.warmupDay || 0;
          if (!byDay[day]) {
            byDay[day] = { sent: 0, failed: 0, total: 0 };
          }
          byDay[day].total++;
          if (email.status === 'sent') {
            byDay[day].sent++;
          } else {
            byDay[day].failed++;
          }
        }
        
        return {
          ...mailbox,
          dailyStats: byDay
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: mailboxesWithStats
    });
  } catch (error) {
    console.error('Błąd podczas pobierania warmup:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas pobierania danych warmup' },
      { status: 500 }
    );
  }
}
