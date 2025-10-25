import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = parseInt(params.id);
    
    if (isNaN(leadId)) {
      return NextResponse.json(
        { error: 'Nieprawidłowe ID leada' },
        { status: 400 }
      );
    }

    // Pobierz historię statusów dla leada
    const history = await db.leadStatusHistory.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 50 // Ostatnie 50 zmian
    });

    return NextResponse.json({
      history
    });

  } catch (error) {
    console.error('Błąd pobierania historii statusów:', error);
    return NextResponse.json(
      { error: 'Błąd serwera podczas pobierania historii' },
      { status: 500 }
    );
  }
}
