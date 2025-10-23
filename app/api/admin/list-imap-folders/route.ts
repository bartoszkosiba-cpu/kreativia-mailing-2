import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listImapFolders } from '@/integrations/imap/listFolders';

export async function POST(request: NextRequest) {
  try {
    const { mailboxId } = await request.json();
    
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId }
    });
    
    if (!mailbox) {
      return NextResponse.json({ success: false, error: 'Skrzynka nie istnieje' }, { status: 404 });
    }
    
    console.log(`[LIST FOLDERS] Listuje foldery dla: ${mailbox.email}`);
    
    const imapConfig = {
      imapHost: mailbox.imapHost!,
      imapPort: mailbox.imapPort!,
      imapUser: mailbox.imapUser!,
      imapPass: mailbox.imapPass!,
      imapSecure: mailbox.imapSecure ?? true
    };
    
    const folders = await listImapFolders(imapConfig);
    
    console.log(`[LIST FOLDERS] Znaleziono ${folders.length} folderów`);
    
    return NextResponse.json({
      success: true,
      mailbox: mailbox.email,
      folders
    });
    
  } catch (error: any) {
    console.error('[LIST FOLDERS] Błąd:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
