import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = parseInt(params.id);
    const { status, blockedReason } = await request.json();

    // Walidacja statusu
    const validStatuses = ['ACTIVE', 'BLOCKED', 'INACTIVE', 'TEST'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy status' },
        { status: 400 }
      );
    }

    // Aktualizuj lead
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: {
        status,
        blockedReason: status === 'BLOCKED' ? (blockedReason || 'MANUAL') : null,
        blockedAt: status === 'BLOCKED' ? new Date() : null,
        isBlocked: status === 'BLOCKED', // Zachowaj kompatybilność
      },
      include: {
        LeadTag: {
          include: {
            tag: true
          }
        },
        CampaignLead: true
      }
    });

    return NextResponse.json({
      message: 'Status leada zaktualizowany pomyślnie',
      lead: updatedLead
    });

  } catch (error) {
    console.error('Błąd aktualizacji statusu leada:', error);
    return NextResponse.json(
      { error: 'Błąd serwera podczas aktualizacji statusu' },
      { status: 500 }
    );
  }
}
