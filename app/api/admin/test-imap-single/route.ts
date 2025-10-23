import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { mailboxId } = await request.json();
    
    console.log(`[TEST IMAP] Testuje IMAP dla skrzynki ID: ${mailboxId}`);
    
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId },
      include: { virtualSalesperson: true }
    });
    
    if (!mailbox) {
      return NextResponse.json({ success: false, error: 'Skrzynka nie istnieje' }, { status: 404 });
    }
    
    console.log(`[TEST IMAP] Skrzynka: ${mailbox.email}`);
    
    // Dynamiczny import IMAP
    const { fetchUnreadEmails } = await import('@/integrations/imap/client');
    
    const imapConfig = {
      imapHost: mailbox.imapHost!,
      imapPort: mailbox.imapPort!,
      imapUser: mailbox.imapUser!,
      imapPass: mailbox.imapPass!,
      imapSecure: mailbox.imapSecure ?? true
    };
    
    console.log(`[TEST IMAP] Łączę z ${imapConfig.imapHost}:${imapConfig.imapPort}...`);
    
    const emails = await fetchUnreadEmails(imapConfig);
    
    console.log(`[TEST IMAP] Znaleziono ${emails.length} maili`);
    
    return NextResponse.json({
      success: true,
      mailbox: {
        id: mailbox.id,
        email: mailbox.email
      },
      imap: {
        host: imapConfig.imapHost,
        port: imapConfig.imapPort,
        user: imapConfig.imapUser,
        secure: imapConfig.imapSecure
      },
      emails: {
        count: emails.length,
        list: emails.map(e => ({
          from: e.from,
          subject: e.subject,
          date: e.date,
          messageId: e.messageId
        }))
      }
    });
    
  } catch (error: any) {
    console.error('[TEST IMAP] Błąd:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
