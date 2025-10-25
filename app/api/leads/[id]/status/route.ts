import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = parseInt(params.id);
    const { status, subStatus, blockedReason } = await request.json();

    // Walidacja statusu - używamy polskich statusów
    const validStatuses = ['AKTYWNY', 'BLOKADA', 'CZEKAJ', 'TEST', 'ZAINTERESOWANY'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy status' },
        { status: 400 }
      );
    }

    // Pobierz aktualny lead żeby zapisać historię
    const currentLead = await db.lead.findUnique({
      where: { id: leadId },
      select: { status: true, subStatus: true }
    });

    if (!currentLead) {
      return NextResponse.json(
        { error: 'Lead nie znaleziony' },
        { status: 404 }
      );
    }

    // Aktualizuj lead
    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: {
        status,
        subStatus: subStatus || null,
        blockedReason: status === 'BLOKADA' ? (blockedReason || 'MANUAL') : null,
        blockedAt: status === 'BLOKADA' ? new Date() : null,
        isBlocked: status === 'BLOKADA', // Zachowaj kompatybilność
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

    // Zapisz historię zmiany statusu (tylko jeśli status się zmienił)
    if (currentLead.status !== status || currentLead.subStatus !== subStatus) {
      await db.leadStatusHistory.create({
        data: {
          leadId,
          oldStatus: currentLead.status,
          oldSubStatus: currentLead.subStatus,
          newStatus: status,
          newSubStatus: subStatus || null,
          reason: 'MANUAL',
          changedBy: 'USER',
          notes: blockedReason ? `Powód: ${blockedReason}` : null
        }
      });
    }

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
