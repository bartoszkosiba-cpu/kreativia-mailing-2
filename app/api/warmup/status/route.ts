import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/warmup/status - Pobierz ogólny status warmup systemu
 */
export async function GET(request: NextRequest) {
  try {
    // Statystyki ogólne
    const totalMailboxes = await db.mailbox.count();
    const warmingMailboxes = await db.mailbox.count({
      where: { warmupStatus: 'warming' }
    });
    const readyMailboxes = await db.mailbox.count({
      where: { warmupStatus: 'ready' }
    });
    const dnsPendingMailboxes = await db.mailbox.count({
      where: { warmupStatus: 'dns_pending' }
    });
    const inactiveMailboxes = await db.mailbox.count({
      where: { warmupStatus: 'inactive' }
    });

    // Statystyki emaili warmup z ostatnich 24h
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const warmupEmails24h = await db.warmupEmail.count({
      where: {
        createdAt: {
          gte: yesterday
        }
      }
    });

    const sentWarmupEmails24h = await db.warmupEmail.count({
      where: {
        createdAt: {
          gte: yesterday
        },
        status: 'sent'
      }
    });

    const failedWarmupEmails24h = await db.warmupEmail.count({
      where: {
        createdAt: {
          gte: yesterday
        },
        status: 'failed'
      }
    });

    // Statystyki według typów
    const emailsByType = await db.warmupEmail.groupBy({
      by: ['type'],
      _count: {
        id: true
      },
      where: {
        createdAt: {
          gte: yesterday
        }
      }
    });

    // Średnie metryki deliverability
    const avgDeliverability = await db.mailbox.aggregate({
      _avg: {
        deliverabilityScore: true,
        bounceRate: true,
        openRate: true,
        replyRate: true
      },
      where: {
        warmupStatus: {
          in: ['warming', 'ready']
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalMailboxes,
          warmingMailboxes,
          readyMailboxes,
          dnsPendingMailboxes,
          inactiveMailboxes
        },
        last24h: {
          totalEmails: warmupEmails24h,
          sentEmails: sentWarmupEmails24h,
          failedEmails: failedWarmupEmails24h,
          successRate: warmupEmails24h > 0 ? (sentWarmupEmails24h / warmupEmails24h) * 100 : 0
        },
        emailsByType: emailsByType.map(item => ({
          type: item.type,
          count: item._count.id
        })),
        deliverability: {
          avgScore: avgDeliverability._avg.deliverabilityScore || 0,
          avgBounceRate: avgDeliverability._avg.bounceRate || 0,
          avgOpenRate: avgDeliverability._avg.openRate || 0,
          avgReplyRate: avgDeliverability._avg.replyRate || 0
        }
      }
    });
  } catch (error) {
    console.error('Błąd podczas pobierania statusu warmup:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas pobierania statusu warmup' },
      { status: 500 }
    );
  }
}
