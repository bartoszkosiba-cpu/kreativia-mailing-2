/**
 * Skrypt migracji istniejących danych SMTP/IMAP z VirtualSalesperson do Mailbox
 * 
 * Uruchom: npx tsx scripts/migrate-to-mailboxes.ts
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function migrateToMailboxes() {
  console.log('🚀 Rozpoczynam migrację do systemu Mailbox...\n');

  try {
    // Pobierz wszystkich wirtualnych handlowców
    const salespeople = await db.virtualSalesperson.findMany();
    
    console.log(`📊 Znaleziono ${salespeople.length} wirtualnych handlowców\n`);

    for (const salesperson of salespeople) {
      console.log(`👤 Przetwarzam: ${salesperson.name} (${salesperson.email})`);
      
      // Sprawdź czy handlowiec ma skonfigurowane SMTP
      if (!salesperson.smtpHost || !salesperson.smtpUser) {
        console.log(`   ⚠️  Brak konfiguracji SMTP - pomijam`);
        continue;
      }

      // Sprawdź czy już ma Mailbox
      const existingMailbox = await db.mailbox.findFirst({
        where: { 
          virtualSalespersonId: salesperson.id,
          email: salesperson.email
        }
      });

      if (existingMailbox) {
        console.log(`   ℹ️  Mailbox już istnieje - pomijam`);
        continue;
      }

      // Utwórz Mailbox z istniejących danych
      const mailbox = await db.mailbox.create({
        data: {
          virtualSalespersonId: salesperson.id,
          email: salesperson.email,
          displayName: salesperson.name,
          description: "Skrzynka główna (zmigrowana)",
          
          // SMTP
          smtpHost: salesperson.smtpHost,
          smtpPort: salesperson.smtpPort || 587,
          smtpUser: salesperson.smtpUser,
          smtpPass: salesperson.smtpPass || '',
          smtpSecure: salesperson.smtpSecure,
          
          // IMAP
          imapHost: salesperson.imapHost || salesperson.smtpHost,
          imapPort: salesperson.imapPort || 993,
          imapUser: salesperson.imapUser || salesperson.smtpUser,
          imapPass: salesperson.imapPass || salesperson.smtpPass || '',
          imapSecure: salesperson.imapSecure,
          
          // Limity
          dailyEmailLimit: salesperson.dailyEmailLimit,
          currentDailySent: salesperson.currentDailySent,
          lastResetDate: salesperson.lastResetDate,
          isActive: salesperson.isActive,
          
          priority: 1 // Pierwsza skrzynka = najwyższy priorytet
        }
      });

      console.log(`   ✅ Utworzono Mailbox ID: ${mailbox.id} dla ${mailbox.email}`);
      
      // Aktualizuj istniejące SendLog aby wskazywały na nową skrzynkę
      const updateResult = await db.sendLog.updateMany({
        where: {
          campaign: {
            virtualSalespersonId: salesperson.id
          },
          mailboxId: null // Tylko te które jeszcze nie mają przypisanej skrzynki
        },
        data: {
          mailboxId: mailbox.id
        }
      });

      if (updateResult.count > 0) {
        console.log(`   📧 Zaktualizowano ${updateResult.count} rekordów SendLog`);
      }
    }

    console.log('\n✅ Migracja zakończona pomyślnie!');
    console.log('\n📝 Następne kroki:');
    console.log('   1. Sprawdź w Prisma Studio czy Mailbox zostały utworzone');
    console.log('   2. Dodaj dodatkowe skrzynki dla handlowców (jeśli potrzebne)');
    console.log('   3. Wyłącz stare pola SMTP/IMAP w VirtualSalesperson (są oznaczone jako DEPRECATED)\n');

  } catch (error) {
    console.error('❌ Błąd migracji:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Uruchom migrację
migrateToMailboxes()
  .then(() => {
    console.log('🎉 Gotowe!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Błąd krytyczny:', error);
    process.exit(1);
  });

