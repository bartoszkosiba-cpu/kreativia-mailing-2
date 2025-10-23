import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/admin/fix-mailboxes - Diagnoza błędnych przypisań skrzynek
 */
export async function GET(request: NextRequest) {
  try {
    // Pobierz wszystkich handlowców ze skrzynkami
    const salespeople = await db.virtualSalesperson.findMany({
      include: {
        mailboxes: true
      }
    });

    const report = salespeople.map(sp => ({
      id: sp.id,
      name: sp.name,
      email: sp.email,
      mailboxes: sp.mailboxes.map(mb => ({
        id: mb.id,
        email: mb.email,
        displayName: mb.displayName,
        virtualSalespersonId: mb.virtualSalespersonId,
        isCorrect: mb.virtualSalespersonId === sp.id
      }))
    }));

    // Znajdź problemy
    const problems = report.filter(sp => 
      sp.mailboxes.some(mb => !mb.isCorrect)
    );

    return NextResponse.json({
      success: true,
      data: {
        total: salespeople.length,
        problems: problems.length,
        report,
        issues: problems
      }
    });
  } catch (error) {
    console.error('Błąd podczas diagnozy:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas diagnozy' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/fix-mailboxes - Naprawa błędnych przypisań (usuwa skrzynki innych handlowców)
 * Body: { salespersonId: number, action: 'remove_incorrect' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { salespersonId, action } = body;

    if (action === 'remove_incorrect') {
      // Pobierz handlowca i jego skrzynki
      const salesperson = await db.virtualSalesperson.findUnique({
        where: { id: salespersonId },
        include: { mailboxes: true }
      });

      if (!salesperson) {
        return NextResponse.json(
          { success: false, error: 'Handlowiec nie istnieje' },
          { status: 404 }
        );
      }

      // Znajdź nieprawidłowe skrzynki (te które mają niewłaściwy virtualSalespersonId)
      const incorrectMailboxes = salesperson.mailboxes.filter(
        mb => mb.virtualSalespersonId !== salespersonId
      );

      if (incorrectMailboxes.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Brak nieprawidłowych skrzynek',
          removed: []
        });
      }

      // Usuń nieprawidłowe skrzynki
      const removed = [];
      for (const mb of incorrectMailboxes) {
        await db.mailbox.delete({
          where: { id: mb.id }
        });
        removed.push({
          id: mb.id,
          email: mb.email,
          wrongSalespersonId: mb.virtualSalespersonId
        });
      }

      return NextResponse.json({
        success: true,
        message: `Usunięto ${removed.length} nieprawidłowych skrzynek`,
        removed
      });
    }

    return NextResponse.json(
      { success: false, error: 'Nieprawidłowa akcja' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Błąd podczas naprawy:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas naprawy' },
      { status: 500 }
    );
  }
}

