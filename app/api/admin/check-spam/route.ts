import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkSpamFolder } from '@/integrations/imap/checkSpam';

export async function POST(request: NextRequest) {
  try {
    const { mailboxId } = await request.json();
    
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId }
    });
    
    if (!mailbox) {
      return NextResponse.json({ success: false, error: 'Skrzynka nie istnieje' }, { status: 404 });
    }
    
    console.log(`[CHECK SPAM] Sprawdzam SPAM dla: ${mailbox.email}`);
    
    const imapConfig = {
      imapHost: mailbox.imapHost!,
      imapPort: mailbox.imapPort!,
      imapUser: mailbox.imapUser!,
      imapPass: mailbox.imapPass!,
      imapSecure: mailbox.imapSecure ?? true
    };
    
    const spamEmails = await checkSpamFolder(imapConfig);
    
    console.log(`[CHECK SPAM] Znaleziono ${spamEmails.length} maili w SPAM`);
    
    return NextResponse.json({
      success: true,
      mailbox: mailbox.email,
      count: spamEmails.length,
      emails: spamEmails
    });
    
  } catch (error: any) {
    console.error('[CHECK SPAM] Błąd:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
