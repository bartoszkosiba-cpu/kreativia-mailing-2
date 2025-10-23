import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { WarmupManager } from '@/services/warmupManager';

/**
 * GET /api/warmup/[id] - Pobierz szczegóły warmup dla skrzynki
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mailboxId = parseInt(params.id);

    if (isNaN(mailboxId)) {
      return NextResponse.json(
        { success: false, error: 'Nieprawidłowe ID skrzynki' },
        { status: 400 }
      );
    }

    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId },
      include: {
        virtualSalesperson: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        warmupEmails: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!mailbox) {
      return NextResponse.json(
        { success: false, error: 'Skrzynka nie istnieje' },
        { status: 404 }
      );
    }

    const stats = await WarmupManager.getWarmupStats(mailboxId);

    // Pobierz statystyki według dni - TYLKO DZISIEJSZE MAILE
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEmails = await db.warmupEmail.findMany({
      where: { 
        mailboxId: mailboxId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      select: {
        warmupDay: true,
        status: true
      }
    });
    
    const dailyStats: Record<number, { sent: number; failed: number; total: number }> = {};
    for (const email of todayEmails) {
      const day = email.warmupDay || 0;
      if (!dailyStats[day]) {
        dailyStats[day] = { sent: 0, failed: 0, total: 0 };
      }
      dailyStats[day].total++;
      if (email.status === 'sent') {
        dailyStats[day].sent++;
      } else {
        dailyStats[day].failed++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        mailbox: {
          ...mailbox,
          dailyStats
        },
        stats
      }
    });
  } catch (error) {
    console.error('Błąd podczas pobierania szczegółów warmup:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas pobierania szczegółów warmup' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/warmup/[id] - Rozpocznij/zatrzymaj warmup dla skrzynki
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mailboxId = parseInt(params.id);
    const body = await request.json();
    const { action } = body; // 'start' | 'stop' | 'check_dns'

    if (isNaN(mailboxId)) {
      return NextResponse.json(
        { success: false, error: 'Nieprawidłowe ID skrzynki' },
        { status: 400 }
      );
    }

    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId }
    });

    if (!mailbox) {
      return NextResponse.json(
        { success: false, error: 'Skrzynka nie istnieje' },
        { status: 404 }
      );
    }

    let result = false;
    let message = '';

    switch (action) {
      case 'start':
        result = await WarmupManager.startWarmup(mailboxId);
        message = result ? 'Warmup rozpoczęty pomyślnie' : 'Nie udało się rozpocząć warmup';
        break;

      case 'stop':
        result = await WarmupManager.stopWarmup(mailboxId);
        message = result ? 'Warmup zatrzymany pomyślnie' : 'Nie udało się zatrzymać warmup';
        break;

      case 'check_dns':
        result = await WarmupManager.checkDNSSetup(mailboxId);
        message = result ? 'DNS skonfigurowane prawidłowo' : 'Problemy z konfiguracją DNS';
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Nieprawidłowa akcja' },
          { status: 400 }
        );
    }

    // Pobierz zaktualizowane dane
    const updatedMailbox = await db.mailbox.findUnique({
      where: { id: mailboxId },
      include: {
        virtualSalesperson: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      success: result,
      message,
      data: updatedMailbox
    });
  } catch (error) {
    console.error('Błąd podczas wykonywania akcji warmup:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas wykonywania akcji warmup' },
      { status: 500 }
    );
  }
}
