import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSmtpTransport } from '@/integrations/smtp/client';
import { createImapConnection } from '@/integrations/imap/client';

/**
 * Funkcja weryfikująca pojedynczą skrzynkę
 */
async function verifyMailbox(mailboxId: number) {
  const mailbox = await db.mailbox.findUnique({
    where: { id: mailboxId }
  });

  if (!mailbox) {
    return { success: false, error: 'Skrzynka nie istnieje' };
  }

  await db.mailbox.update({
    where: { id: mailboxId },
    data: { verificationStatus: 'verifying', lastVerificationTest: new Date() }
  });

  const errors: string[] = [];
  let smtpSuccess = false;
  let imapSuccess = false;

  // TEST SMTP
  try {
    const transport = createSmtpTransport({
      smtpHost: mailbox.smtpHost,
      smtpPort: mailbox.smtpPort,
      smtpUser: mailbox.smtpUser,
      smtpPass: mailbox.smtpPass,
      smtpSecure: mailbox.smtpSecure
    });

    await transport.sendMail({
      from: mailbox.email,
      to: mailbox.email,
      subject: `[TEST] Weryfikacja - ${new Date().toISOString()}`,
      text: `Test weryfikacji skrzynki ${mailbox.email}`
    });

    smtpSuccess = true;
  } catch (smtpError: any) {
    errors.push(`SMTP: ${smtpError.message}`);
  }

  // TEST IMAP
  if (smtpSuccess) {
    try {
      await new Promise<boolean>((resolve, reject) => {
        const imap = createImapConnection({
          imapHost: mailbox.imapHost,
          imapPort: mailbox.imapPort,
          imapUser: mailbox.imapUser,
          imapPass: mailbox.imapPass,
          imapSecure: mailbox.imapSecure
        });

        const timeout = setTimeout(() => {
          imap.end();
          reject(new Error('Timeout IMAP'));
        }, 10000);

        imap.once('ready', () => {
          clearTimeout(timeout);
          imap.end();
          resolve(true);
        });

        imap.once('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });

        imap.connect();
      });

      imapSuccess = true;
    } catch (imapError: any) {
      errors.push(`IMAP: ${imapError.message}`);
    }
  }

  const isVerified = smtpSuccess && imapSuccess;

  await db.mailbox.update({
    where: { id: mailboxId },
    data: {
      verificationStatus: isVerified ? 'verified' : 'failed',
      verificationError: errors.length > 0 ? errors.join('; ') : null,
      verificationDate: isVerified ? new Date() : null,
      isActive: isVerified
    }
  });

  return { success: isVerified, errors: errors.length > 0 ? errors : null };
}

/**
 * POST /api/admin/verify-all-mailboxes
 */
export async function POST(req: NextRequest) {
  try {
    const mailboxes = await db.mailbox.findMany({
      select: { id: true, email: true }
    });

    const results = {
      total: mailboxes.length,
      verified: 0,
      failed: 0,
      errors: [] as any[]
    };

    for (const mailbox of mailboxes) {
      console.log(`[VERIFY ALL] Weryfikuję ${mailbox.email}...`);

      const result = await verifyMailbox(mailbox.id);

      if (result.success) {
        results.verified++;
        console.log(`[VERIFY ALL] ✅ ${mailbox.email}`);
      } else {
        results.failed++;
        results.errors.push({
          email: mailbox.email,
          errors: result.errors || ['Nieznany błąd']
        });
        console.log(`[VERIFY ALL] ❌ ${mailbox.email}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      message: `Zweryfikowano ${results.verified}/${results.total} skrzynek`,
      data: results
    });

  } catch (error: any) {
    console.error('[VERIFY ALL] Błąd:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
