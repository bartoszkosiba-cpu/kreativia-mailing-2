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

    // Pobierz kampanię (potrzebna do sprawdzenia sendLogId)
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

    // Pobierz parametry paginacji z query string
    const searchParams = req.nextUrl.searchParams;
    const sendLogId = searchParams.get('sendLogId');
    const searchQuery = searchParams.get('search')?.trim() || null; // ✅ Parametr wyszukiwania
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const offset = (page - 1) * limit;
    
    // ✅ Jeśli jest sendLogId, zwróć tylko ten mail
    if (sendLogId) {
      const sendLog = await db.sendLog.findUnique({
        where: {
          id: parseInt(sendLogId),
          campaignId // ✅ Upewnij się że mail należy do tej kampanii
        },
        select: {
          id: true,
          status: true,
          error: true,
          createdAt: true,
          subject: true,
          content: true,
          toEmail: true,
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
        }
      });
      
      if (!sendLog) {
        return NextResponse.json(
          { success: false, error: 'Mail nie został znaleziony' },
          { status: 404 }
        );
      }
      
      // Pobierz odpowiedź dla tego maila
      const reply = await db.inboxReply.findFirst({
        where: {
          campaignId,
          leadId: sendLog.lead?.id || null
        },
        select: {
          id: true,
          leadId: true,
          classification: true,
          receivedAt: true,
          createdAt: true
        },
        orderBy: {
          receivedAt: 'desc'
        }
      });
      
      // Pobierz podstawowe statystyki (uproszczone dla sendLogId)
      const stats = {
        total: await db.sendLog.count({ where: { campaignId } }),
        sent: await db.sendLog.count({ where: { campaignId, status: 'sent' } }),
        failed: await db.sendLog.count({ where: { campaignId, status: 'error' } }),
        queued: 0,
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
      
      return NextResponse.json({
        success: true,
        data: {
          campaign: {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status
          },
          sendLogs: [{
            ...sendLog,
            reply: reply || null
          }],
          stats,
          todayStats: { total: 0, sent: 0, failed: 0 },
          mailboxStats: []
        },
        pagination: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1
        }
      });
    }

    // ✅ Data dzisiaj (dla statystyk dzisiejszych)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // ✅ Warunek wyszukiwania
    const searchWhere: any = {
      campaignId
    };
    
    // ✅ Jeśli jest zapytanie wyszukiwania, dodaj filtrowanie po leadzie
    if (searchQuery) {
      // SQLite w Prisma nie obsługuje zagnieżdżonych OR ani mode: 'insensitive'
      // Używamy prostego OR z contains (case-sensitive, ale działa dla większości przypadków)
      // Dla pełnego case-insensitive search w SQLite trzeba by użyć Prisma.$queryRaw z LIKE
      searchWhere.OR = [
        // Wyszukiwanie po emailu leada
        {
          lead: {
            email: {
              contains: searchQuery
            }
          }
        },
        // Wyszukiwanie po imieniu leada
        {
          lead: {
            firstName: {
              contains: searchQuery
            }
          }
        },
        // Wyszukiwanie po nazwisku leada
        {
          lead: {
            lastName: {
              contains: searchQuery
            }
          }
        },
        // Wyszukiwanie po toEmail (dla maili testowych)
        {
          toEmail: {
            contains: searchQuery
          }
        }
      ];
    }

    // Pobierz całkowitą liczbę wysyłek (dla paginacji) - z uwzględnieniem wyszukiwania
    const totalCount = await db.sendLog.count({
      where: searchWhere
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

    // Pobierz wysyłki z paginacją - z uwzględnieniem wyszukiwania
    const sendLogs = await db.sendLog.findMany({
      where: searchWhere,
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

    // ✅ Grupowanie po mailboxach - dla TEJ KAMPANII (z SendLog)
    // Policz maile z SendLog dla tej kampanii (wszystkie dni, nie tylko dzisiaj)
    const sentLogsForCampaign = await db.sendLog.findMany({
      where: {
        campaignId,
        status: 'sent',
        mailboxId: { not: null }
      },
      select: {
        mailboxId: true
      }
    });
    
    // Policz błędy z SendLog (wszystkie dla tej kampanii)
    const failedLogsForCampaign = await db.sendLog.findMany({
      where: {
        campaignId,
        status: 'error',
        mailboxId: { not: null }
      },
      select: {
        mailboxId: true
      }
    });
    
    // Policz maile i błędy per mailbox
    const sentPerMailbox: { [key: number]: number } = {};
    sentLogsForCampaign.forEach(log => {
      if (log.mailboxId) {
        sentPerMailbox[log.mailboxId] = (sentPerMailbox[log.mailboxId] || 0) + 1;
      }
    });
    
    const failedPerMailbox: { [key: number]: number } = {};
    failedLogsForCampaign.forEach(log => {
      if (log.mailboxId) {
        failedPerMailbox[log.mailboxId] = (failedPerMailbox[log.mailboxId] || 0) + 1;
      }
    });
    
    // Pobierz handlowca z skrzynkami (używamy już istniejącej zmiennej campaign)
    const campaignWithMailboxes = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { 
        virtualSalespersonId: true,
        virtualSalesperson: {
          select: {
            mailboxes: {
              where: { isActive: true },
              select: {
                id: true,
                email: true,
                displayName: true
              }
            }
          }
        }
      }
    });
    
    // Utwórz statystyki - tylko dla skrzynek które mają maile w tej kampanii
    const mailboxStats = campaignWithMailboxes?.virtualSalesperson?.mailboxes
      .filter(mb => sentPerMailbox[mb.id] > 0 || failedPerMailbox[mb.id] > 0) // Pokaż tylko te które mają maile
      .map(mb => ({
        email: mb.email,
        displayName: mb.displayName,
        sent: sentPerMailbox[mb.id] || 0, // ✅ Z SendLog dla TEJ kampanii
        failed: failedPerMailbox[mb.id] || 0 // Błędy z tej kampanii
      })) || [];

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

