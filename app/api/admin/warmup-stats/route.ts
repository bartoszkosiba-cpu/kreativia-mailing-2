import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Pobierz wszystkie skrzynki w warmup
    const mailboxes = await db.mailbox.findMany({
      where: {
        warmupStatus: 'warming'
      },
      select: {
        id: true,
        email: true,
        warmupDay: true,
        warmupStartDate: true
      }
    });

    const stats = [];

    for (const mailbox of mailboxes) {
      // Pobierz wszystkie warmup maile dla tej skrzynki
      const allEmails = await db.warmupEmail.findMany({
        where: {
          mailboxId: mailbox.id
        },
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          warmupDay: true,
          status: true,
          createdAt: true
        }
      });

      // Grupuj według dnia
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

      stats.push({
        email: mailbox.email,
        currentDay: mailbox.warmupDay,
        startDate: mailbox.warmupStartDate,
        totalEmails: allEmails.length,
        byDay: byDay
      });
    }

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Błąd podczas pobierania statystyk warmup:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas pobierania statystyk warmup' },
      { status: 500 }
    );
  }
}

