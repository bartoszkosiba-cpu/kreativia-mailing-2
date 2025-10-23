/**
 * Skrypt migracji - ustawia mainMailboxId dla istniejących handlowców
 * 
 * Uruchom: npx tsx scripts/migrate-main-mailbox.ts
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function migrateMainMailbox() {
  console.log('🚀 Rozpoczynam migrację mainMailboxId...\n');

  try {
    // Pobierz wszystkich handlowców
    const salespeople = await db.virtualSalesperson.findMany({
      include: {
        mailboxes: {
          where: { isActive: true },
          orderBy: { priority: 'asc' }
        }
      }
    });
    
    console.log(`📊 Znaleziono ${salespeople.length} handlowców\n`);

    for (const salesperson of salespeople) {
      console.log(`👤 Przetwarzam: ${salesperson.name} (${salesperson.email})`);
      
      if (salesperson.mailboxes.length === 0) {
        console.log(`   ⚠️  Brak aktywnych skrzynek - pomijam`);
        continue;
      }

      // Znajdź skrzynkę z najwyższym priorytetem (najniższa liczba)
      const mainMailbox = salesperson.mailboxes[0];
      
      console.log(`   📧 Główna skrzynka: ${mainMailbox.email} (ID: ${mainMailbox.id}, priority: ${mainMailbox.priority})`);

      // Ustaw mainMailboxId
      await db.virtualSalesperson.update({
        where: { id: salesperson.id },
        data: { mainMailboxId: mainMailbox.id }
      });

      console.log(`   ✅ Ustawiono mainMailboxId: ${mainMailbox.id}`);
    }

    console.log('\n✅ Migracja zakończona pomyślnie!');
    console.log('\n📝 Następne kroki:');
    console.log('   1. Sprawdź w Prisma Studio czy mainMailboxId zostały ustawione');
    console.log('   2. Przetestuj nowy round-robin logic');
    console.log('   3. Zaktualizuj UI do wyboru głównej skrzynki\n');

  } catch (error) {
    console.error('❌ Błąd migracji:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Uruchom migrację
migrateMainMailbox()
  .then(() => {
    console.log('🎉 Gotowe!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Błąd krytyczny:', error);
    process.exit(1);
  });
