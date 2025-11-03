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

    // Pobierz parametry paginacji z query string
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const offset = (page - 1) * limit;

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

    // ✅ Data dzisiaj (dla statystyk dzisiejszych)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Pobierz całkowitą liczbę wysyłek (dla paginacji)
    const totalCount = await db.sendLog.count({
      where: {
        campaignId
      }
    });

    // ✅ STATYSTYKI DLA WSZYSTKIEJ KAMPANII (nie tylko strona!)
    const allCampaignStats = {
      total: await db.sendLog.count({
        where: { campaignId }
      }),
      sent: await db.sendLog.count({
        where: {
          campaignId,
          status: 'sent'
        }
      }),
      failed: await db.sendLog.count({
        where: {
          campaignId,
          status: 'error'
        }
      }),
      sentToBlocked: await db.sendLog.count({
        where: {
          campaignId,
          status: 'sent',
          lead: {
            OR: [
              { status: 'BLOCKED' },
              { isBlocked: true }
            ]
          }
        }
      })
    };

    // ✅ STATYSTYKI DZISIAJ (nawet jeśli była pauza)
    const todayStats = {
      total: await db.sendLog.count({
        where: {
          campaignId,
          createdAt: {
            gte: today,
            lte: endOfDay
          }
        }
      }),
      sent: await db.sendLog.count({
        where: {
          campaignId,
          status: 'sent',
          createdAt: {
            gte: today,
            lte: endOfDay
          }
        }
      }),
      failed: await db.sendLog.count({
        where: {
          campaignId,
          status: 'error',
          createdAt: {
            gte: today,
            lte: endOfDay
          }
        }
      })
    };

    // Pobierz wysyłki z paginacją
    const sendLogs = await db.sendLog.findMany({
      where: {
        campaignId
      },
      select: {
        id: true,
        status: true,
        error: true,
        createdAt: true,
        subject: true,
        content: true, // ✅ DODANO: Treść maila dla szczegółów
        toEmail: true, // NOWE: Dodaj toEmail dla maili testowych
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
      },
      skip: offset,
      take: limit
    });

    // Pobierz odpowiedzi dla tej kampanii i powiąż je z sendLogs
    const replies = await db.inboxReply.findMany({
      where: {
        campaignId
      },
      select: {
        id: true,
        leadId: true,
        classification: true,
        receivedAt: true,
        createdAt: true
      }
    });

    // Funkcja do znajdowania odpowiedzi dla leada
    const getReplyForLead = (leadId: number) => {
      return replies.find(reply => reply.leadId === leadId) || null;
    };

    // Dodaj informacje o odpowiedziach do każdego sendLog
    const sendLogsWithReplies = sendLogs.map(log => ({
      ...log,
      reply: getReplyForLead(log.lead?.id || 0)
    }));

    // ✅ Grupowanie po mailboxach (dla WSZYSTKICH maili z kampanii, nie tylko strona!)
    const allSendLogsForMailboxStats = await db.sendLog.findMany({
      where: { campaignId },
      select: {
        status: true,
        mailbox: {
          select: {
            email: true,
            displayName: true
          }
        }
      }
    });

    const mailboxStats = allSendLogsForMailboxStats.reduce((acc: any, log) => {
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
        sendLogs: sendLogsWithReplies,
        stats: allCampaignStats, // ✅ Wszystkie maile z kampanii (wszystkie dni)
        todayStats, // ✅ Maile wysłane dzisiaj (nawet jeśli była pauza)
        mailboxStats: Object.values(mailboxStats),
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit)
        }
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

