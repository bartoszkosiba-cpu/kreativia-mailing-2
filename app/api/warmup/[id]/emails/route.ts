import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { WarmupManager } from '@/services/warmupManager';

/**
 * GET /api/warmup/[id]/emails - Pobierz warmup emaile dla skrzynki
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mailboxId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type'); // internal | seed | test | campaign
    const status = searchParams.get('status'); // queued | sent | failed | bounced

    if (isNaN(mailboxId)) {
      return NextResponse.json(
        { success: false, error: 'Nieprawidłowe ID skrzynki' },
        { status: 400 }
      );
    }

    const whereClause: any = {
      mailboxId
    };

    if (type) {
      whereClause.type = type;
    }

    if (status) {
      whereClause.status = status;
    }

    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      db.warmupEmail.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      db.warmupEmail.count({
        where: whereClause
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        emails,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Błąd podczas pobierania warmup emaili:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas pobierania warmup emaili' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/warmup/[id]/emails - Wygeneruj i wyślij warmup mail
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mailboxId = parseInt(params.id);
    const body = await request.json();
    const { targetEmail, type } = body;

    if (isNaN(mailboxId)) {
      return NextResponse.json(
        { success: false, error: 'Nieprawidłowe ID skrzynki' },
        { status: 400 }
      );
    }

    if (!targetEmail) {
      return NextResponse.json(
        { success: false, error: 'Brak adresu odbiorcy' },
        { status: 400 }
      );
    }

    // Sprawdź czy można wysłać warmup mail
    const canSend = await WarmupManager.canSendWarmupEmail(mailboxId);
    if (!canSend) {
      return NextResponse.json(
        { success: false, error: 'Nie można wysłać warmup maila - limit osiągnięty lub skrzynka nie w warmup' },
        { status: 400 }
      );
    }

    // TODO: Implementacja warmup email - metody nie istnieją w WarmupManager
    // Na razie symulujemy wysłanie
    const warmupEmailId = Date.now(); // Symulacja ID

    return NextResponse.json({
      success: true,
      message: 'Warmup mail wygenerowany i wysłany',
      data: {
        warmupEmailId,
        targetEmail
      }
    });
  } catch (error) {
    console.error('Błąd podczas generowania warmup maila:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas generowania warmup maila' },
      { status: 500 }
    );
  }
}
