import { NextRequest, NextResponse } from 'next/server';
import { fetchUnreadEmails } from '@/integrations/imap/client';
import { processReply } from '@/integrations/inbox/processor';
import { db } from '@/lib/db';

/**
 * POST /api/admin/test-inbox - Test pobierania maili ze wszystkich mailboxów
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[ADMIN] Test inbox - pobieranie maili ze wszystkich mailboxów...');

    // Pobierz wszystkie aktywne mailboxy
    const mailboxes = await db.mailbox.findMany({
      where: {
        isActive: true,
        imapHost: { not: undefined },
        imapUser: { not: undefined },
        imapPass: { not: undefined }
      },
      include: {
        virtualSalesperson: true
      }
    });

    console.log(`[ADMIN] Znaleziono ${mailboxes.length} aktywnych skrzynek z IMAP`);

    const results = [];

    // Iteruj po każdym mailbox i pobierz maile
    for (const mailbox of mailboxes) {
      console.log(`[ADMIN] Sprawdzam skrzynkę: ${mailbox.email}...`);
      
      try {
        // Konfiguracja IMAP dla tego mailbox
        const imapConfig = {
          imapHost: mailbox.imapHost!,
          imapPort: mailbox.imapPort!,
          imapUser: mailbox.imapUser!,
          imapPass: mailbox.imapPass!,
          imapSecure: mailbox.imapSecure ?? true
        };

        // Pobierz nowe maile z tego mailbox
        const emails = await fetchUnreadEmails(imapConfig);
        console.log(`[ADMIN] ✓ Pobrano ${emails.length} maili z ${mailbox.email}`);
        
        results.push({
          mailbox: mailbox.email,
          emailCount: emails.length,
          emails: emails.map(e => ({
            from: e.from,
            subject: e.subject,
            date: e.date
          }))
        });

        // Przetwórz każdy mail (opcjonalnie - tylko dla testu)
        // for (const email of emails) {
        //   await processReply(email);
        // }
      } catch (error: any) {
        console.error(`[ADMIN] ✗ Błąd pobierania maili z ${mailbox.email}:`, error.message);
        results.push({
          mailbox: mailbox.email,
          error: error.message
        });
      }
    }

    console.log('[ADMIN] ✅ Test inbox zakończony');

    return NextResponse.json({
      success: true,
      message: 'Test inbox zakończony',
      mailboxCount: mailboxes.length,
      results
    });

  } catch (error) {
    console.error('[ADMIN] Błąd podczas testu inbox:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas testu inbox' },
      { status: 500 }
    );
  }
}
