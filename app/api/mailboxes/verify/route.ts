import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSmtpTransport } from '@/integrations/smtp/client';
import { createImapConnection } from '@/integrations/imap/client';

/**
 * POST /api/mailboxes/verify
 * Weryfikuje połączenie SMTP i IMAP dla skrzynki
 */
export async function POST(req: NextRequest) {
  try {
    const { mailboxId } = await req.json();

    if (!mailboxId) {
      return NextResponse.json(
        { success: false, error: 'Brak ID skrzynki' },
        { status: 400 }
      );
    }

    // Pobierz skrzynkę
    const mailbox = await db.mailbox.findUnique({
      where: { id: mailboxId }
    });

    if (!mailbox) {
      return NextResponse.json(
        { success: false, error: 'Skrzynka nie istnieje' },
        { status: 404 }
      );
    }

    // Oznacz jako weryfikująca się
    await db.mailbox.update({
      where: { id: mailboxId },
      data: {
        verificationStatus: 'verifying',
        lastVerificationTest: new Date()
      }
    });

    const errors: string[] = [];
    let smtpSuccess = false;
    let imapSuccess = false;
    let messageId: string | null = null;

    // ========================================
    // TEST 1: SMTP (wysyłanie)
    // ========================================
    try {
      console.log(`[VERIFY] Testuję SMTP dla ${mailbox.email}...`);
      
      const smtpConfig = {
        smtpHost: mailbox.smtpHost,
        smtpPort: mailbox.smtpPort,
        smtpUser: mailbox.smtpUser,
        smtpPass: mailbox.smtpPass,
        smtpSecure: mailbox.smtpSecure
      };

      const transport = createSmtpTransport(smtpConfig);

      // Wyślij testowy mail NA SAMĄ SIEBIE
      const testSubject = `[TEST] Weryfikacja skrzynki - ${new Date().toISOString()}`;
      const testBody = `To jest automatyczny mail testowy weryfikujący skrzynkę ${mailbox.email}.\n\nWysłano: ${new Date().toLocaleString('pl-PL')}\n\nJeśli otrzymujesz ten mail, oznacza to że konfiguracja SMTP i IMAP działa prawidłowo.`;

      const result = await transport.sendMail({
        from: mailbox.email,
        to: mailbox.email, // Wyślij do siebie
        subject: testSubject,
        text: testBody
      });

      messageId = result.messageId;
      smtpSuccess = true;
      console.log(`[VERIFY] ✅ SMTP OK - Message ID: ${messageId}`);

      // NOWE: Zapisz test mail do SendLog (dla archiwum)
      // Maile testowe nie mają kampanii ani leada - campaignId i leadId są NULL
      try {
        await db.sendLog.create({
          data: {
            campaignId: null, // Mail testowy - brak kampanii
            leadId: null,     // Mail testowy - brak leada
            mailboxId: mailbox.id,
            subject: testSubject,
            content: testBody,
            status: "sent",
            messageId: messageId
          }
        });
        console.log(`[VERIFY] 📝 Test mail zapisany do archiwum (Mailbox ID: ${mailbox.id})`);
      } catch (dbError: any) {
        console.error(`[VERIFY] ❌ Błąd zapisu do SendLog:`, dbError);
        // Nie przerywamy procesu weryfikacji
      }

    } catch (smtpError: any) {
      console.error(`[VERIFY] ❌ SMTP FAILED:`, smtpError);
      errors.push(`SMTP: ${smtpError.message || String(smtpError)}`);
    }

    // ========================================
    // TEST 2: IMAP (odbieranie i sprawdzenie maila testowego)
    // ========================================
    if (smtpSuccess && messageId) {
      try {
        console.log(`[VERIFY] Testuję IMAP dla ${mailbox.email}...`);
        console.log(`[VERIFY] Szukam wiadomości z Message-ID: ${messageId}`);
        
        const imapConfig = {
          imapHost: mailbox.imapHost,
          imapPort: mailbox.imapPort,
          imapUser: mailbox.imapUser,
          imapPass: mailbox.imapPass,
          imapSecure: mailbox.imapSecure,
          createdAt: mailbox.createdAt // Pobierz tylko maile z dzisiaj (po utworzeniu skrzynki)
        };

        // Czekamy 15 sekund na dostarczenie maila (zamiast 5)
        console.log('[VERIFY] Czekam 15 sekund na dostarczenie maila...');
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Pobierz maile przez fetchUnreadEmails
        const { fetchUnreadEmails } = await import('@/integrations/imap/client');
        const emails = await fetchUnreadEmails(imapConfig);
        
        console.log(`[VERIFY] Pobrano ${emails.length} maili z IMAP`);
        
        // Sprawdź czy mail testowy został odebrany
        const testEmailFound = emails.some(email => email.messageId === messageId);
        
        if (testEmailFound) {
          console.log('[VERIFY] ✅ Mail testowy znaleziony w inbox!');
          imapSuccess = true;
        } else {
          console.log('[VERIFY] ⚠️ Mail testowy NIE został znaleziony w inbox');
          console.log('[VERIFY] Pobrane maile:', emails.map(e => `"${e.subject}" (${e.messageId})`).join(', '));
          imapSuccess = false;
          errors.push('IMAP: Mail testowy nie został odebrany w czasie 15 sekund');
        }

      } catch (imapError: any) {
        console.error(`[VERIFY] ❌ IMAP FAILED:`, imapError);
        errors.push(`IMAP: ${imapError.message || String(imapError)}`);
      }
    }

    // ========================================
    // WYNIK WERYFIKACJI
    // ========================================
    const isVerified = smtpSuccess && imapSuccess;
    const verificationStatus = isVerified ? 'verified' : 'failed';
    const verificationError = errors.length > 0 ? errors.join('; ') : null;

    // Zaktualizuj status skrzynki
    await db.mailbox.update({
      where: { id: mailboxId },
      data: {
        verificationStatus,
        verificationError,
        verificationDate: isVerified ? new Date() : null,
        isActive: isVerified // Aktywuj tylko jeśli zweryfikowana
      }
    });

    return NextResponse.json({
      success: isVerified,
      message: isVerified 
        ? 'Skrzynka zweryfikowana pomyślnie' 
        : 'Weryfikacja nie powiodła się',
      data: {
        smtpSuccess,
        imapSuccess,
        errors: errors.length > 0 ? errors : null
      }
    });

  } catch (error: any) {
    console.error('[VERIFY] Błąd podczas weryfikacji:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Błąd podczas weryfikacji skrzynki' },
      { status: 500 }
    );
  }
}

