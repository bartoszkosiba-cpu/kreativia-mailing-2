import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/campaigns/[id]/outbox
 * Pobiera historię wysyłek dla kampanii (outbox)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id);

    if (isNaN(campaignId)) {
      return NextResponse.json(
        { success: false, error: 'Nieprawidłowe ID kampanii' },
        { status: 400 }
      );
    }

    // Pobierz kampanię
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        status: true
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Kampania nie istnieje' },
        { status: 404 }
      );
    }

    // Pobierz wszystkie wysyłki dla kampanii
    const sendLogs = await db.sendLog.findMany({
      where: {
        campaignId
      },
      include: {
        lead: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            company: true,
            status: true,
            isBlocked: true,
            blockedReason: true
          }
        },
        mailbox: {
          select: {
            id: true,
            email: true,
            displayName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Statystyki
    const stats = {
      total: sendLogs.length,
      sent: sendLogs.filter(log => log.status === 'sent').length,
      failed: sendLogs.filter(log => log.status === 'error').length,
      queued: sendLogs.filter(log => log.status === 'queued').length,
      sentToBlocked: sendLogs.filter(log => 
        log.status === 'sent' && 
        (log.lead.status === 'BLOCKED' || log.lead.isBlocked)
      ).length
    };

    // Grupowanie po mailboxach (z których skrzynek wysyłano)
    const mailboxStats = sendLogs.reduce((acc: any, log) => {
      if (log.mailbox) {
        const key = log.mailbox.email;
        if (!acc[key]) {
          acc[key] = {
            email: log.mailbox.email,
            displayName: log.mailbox.displayName,
            sent: 0,
            failed: 0
          };
        }
        if (log.status === 'sent') acc[key].sent++;
        if (log.status === 'error') acc[key].failed++;
      }
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status
        },
        sendLogs,
        stats,
        mailboxStats: Object.values(mailboxStats)
      }
    });

  } catch (error: any) {
    console.error('[OUTBOX] Błąd pobierania wysyłek:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Błąd podczas pobierania wysyłek',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

