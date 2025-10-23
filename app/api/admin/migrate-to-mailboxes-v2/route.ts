import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/admin/migrate-to-mailboxes-v2 - Migracja danych z VirtualSalesperson do Mailbox
 * 
 * Dla każdego handlowca który ma stare ustawienia SMTP/IMAP (deprecated),
 * tworzy nową skrzynkę Mailbox
 */
export async function POST(request: NextRequest) {
  try {
    // Pobierz wszystkich handlowców ze starymi ustawieniami
    const salespeople = await db.virtualSalesperson.findMany({
      where: {
        smtpHost: { not: null }
      },
      include: {
        mailboxes: true
      }
    });

    const results = [];

    for (const sp of salespeople) {
      // Sprawdź czy już ma skrzynkę mailbox
      if (sp.mailboxes.length > 0) {
        results.push({
          salespersonId: sp.id,
          name: sp.name,
          status: 'skipped',
          reason: `Już ma ${sp.mailboxes.length} skrzynkę/skrzynek`
        });
        continue;
      }

      // Sprawdź czy ma kompletne dane SMTP/IMAP
      if (!sp.smtpHost || !sp.smtpUser || !sp.smtpPass) {
        results.push({
          salespersonId: sp.id,
          name: sp.name,
          status: 'skipped',
          reason: 'Brak kompletnych danych SMTP'
        });
        continue;
      }

      // Utwórz nową skrzynkę mailbox
      try {
        const mailbox = await db.mailbox.create({
          data: {
            virtualSalespersonId: sp.id,
            email: sp.email,
            displayName: sp.name,
            description: "Skrzynka główna (zmigrowana)",
            
            // SMTP
            smtpHost: sp.smtpHost,
            smtpPort: sp.smtpPort || 587,
            smtpUser: sp.smtpUser,
            smtpPass: sp.smtpPass,
            smtpSecure: sp.smtpSecure,
            
            // IMAP
            imapHost: sp.imapHost || sp.smtpHost, // Jeśli brak IMAP, użyj SMTP
            imapPort: sp.imapPort || 993,
            imapUser: sp.imapUser || sp.smtpUser, // Jeśli brak IMAP user, użyj SMTP
            imapPass: sp.imapPass || sp.smtpPass, // Jeśli brak IMAP pass, użyj SMTP
            imapSecure: sp.imapSecure,
            
            // Limity
            dailyEmailLimit: sp.dailyEmailLimit,
            currentDailySent: sp.currentDailySent,
            lastResetDate: sp.lastResetDate,
            isActive: sp.isActive,
            priority: 1 // Pierwsza skrzynka = najwyższy priorytet
          }
        });

        results.push({
          salespersonId: sp.id,
          name: sp.name,
          status: 'migrated',
          mailboxId: mailbox.id,
          email: mailbox.email
        });
      } catch (error: any) {
        results.push({
          salespersonId: sp.id,
          name: sp.name,
          status: 'error',
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Zmigrowano ${results.filter(r => r.status === 'migrated').length} handlowców`,
      results
    });
  } catch (error) {
    console.error('Błąd podczas migracji:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas migracji' },
      { status: 500 }
    );
  }
}

/**
 * GET - Podgląd co zostanie zmigrowane
 */
export async function GET(request: NextRequest) {
  try {
    const salespeople = await db.virtualSalesperson.findMany({
      where: {
        smtpHost: { not: null }
      },
      include: {
        mailboxes: true
      }
    });

    const preview = salespeople.map(sp => ({
      id: sp.id,
      name: sp.name,
      email: sp.email,
      hasOldSettings: !!(sp.smtpHost && sp.smtpUser),
      existingMailboxes: sp.mailboxes.length,
      willBeMigrated: sp.mailboxes.length === 0 && !!(sp.smtpHost && sp.smtpUser)
    }));

    return NextResponse.json({
      success: true,
      total: salespeople.length,
      toMigrate: preview.filter(p => p.willBeMigrated).length,
      preview
    });
  } catch (error) {
    console.error('Błąd podczas podglądu:', error);
    return NextResponse.json(
      { success: false, error: 'Błąd podczas podglądu' },
      { status: 500 }
    );
  }
}

