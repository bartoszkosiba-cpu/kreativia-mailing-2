/**
 * MIGRACJA KAMPANII 3 DO V2 (bez startowania)
 * 
 * Ten skrypt:
 * 1. Analizuje stan kampanii 3
 * 2. Naprawia niespójności statusów
 * 3. Inicjalizuje kolejkę V2
 * 4. NIE zmienia statusu kampanii (nie startuje)
 */

import { db } from '../src/lib/db';
import { analyzeCampaignState, fixCampaignStatuses, migrateCampaignToV2 } from '../src/services/campaignMigration';
import { initializeQueueV2 } from '../src/services/campaignEmailQueueV2';

async function migrateCampaign3() {
  const campaignId = 3;

  console.log(`\n🚀 MIGRACJA KAMPANII ${campaignId} DO V2\n`);
  console.log('='.repeat(60));

  try {
    // KROK 1: Sprawdź czy kampania istnieje
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        status: true,
        delayBetweenEmails: true,
        startHour: true,
        endHour: true,
        allowedDays: true
      }
    });

    if (!campaign) {
      console.error(`❌ Kampania ${campaignId} nie istnieje!`);
      process.exit(1);
    }

    console.log(`\n📋 Kampania: ${campaign.name} (ID: ${campaignId})`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Delay: ${campaign.delayBetweenEmails}s`);
    console.log(`   Okno: ${campaign.startHour || 9}:00 - ${campaign.endHour || 17}:00`);

    // KROK 2: Analizuj stan kampanii
    console.log(`\n📊 Analizuję stan kampanii...`);
    const state = await analyzeCampaignState(campaignId);
    console.log(`   Wysłane: ${state.sentCount}`);
    console.log(`   W kolejce (queued): ${state.queuedCount}`);
    console.log(`   Zaplanowane (planned): ${state.plannedCount}`);
    console.log(`   Wysyłanie (sending): ${state.sendingCount}`);
    console.log(`   W kolejce V2: ${state.queueCount}`);
    if (state.lastSentAt) {
      console.log(`   Ostatni wysłany: ${state.lastSentAt.toISOString()}`);
    }

    // KROK 3: Napraw niespójności statusów (opcjonalnie - pomijamy jeśli timeout)
    console.log(`\n🔧 Naprawiam niespójności statusów...`);
    try {
      const fixed = await fixCampaignStatuses(campaignId);
      console.log(`   Naprawiono sent: ${fixed.fixedSent}`);
      console.log(`   Naprawiono queued: ${fixed.fixedQueued}`);
    } catch (error: any) {
      console.log(`   ⚠️  Błąd naprawy statusów (pomijam): ${error.message}`);
      console.log(`   ⏭️  Kontynuuję migrację bez naprawy statusów`);
    }

    // KROK 4: Sprawdź czy już ma kolejkę V2
    const existingQueue = await db.campaignEmailQueue.count({
      where: {
        campaignId,
        status: { in: ['pending', 'sending'] }
      }
    });

    if (existingQueue > 0) {
      console.log(`\n⚠️  Kampania ${campaignId} już ma ${existingQueue} maili w kolejce V2`);
      console.log(`   Czy chcesz wyczyścić starą kolejkę i zainicjalizować ponownie? (y/n)`);
      
      // W trybie non-interactive: pomiń czyszczenie jeśli już jest kolejka
      console.log(`   ⏭️  Pomijam - kolejka już istnieje`);
    } else {
      // KROK 5: Inicjalizuj kolejkę V2 (nie czyścimy starej - może być dużo danych)
      // initializeQueueV2 sprawdza SendLog i nie dodaje duplikatów
      console.log(`\n🚀 Inicjalizuję kolejkę V2...`);
      console.log(`   ⚠️  Pomijam czyszczenie starej kolejki (może być dużo danych)`);
      console.log(`   ✅ initializeQueueV2 sprawdzi SendLog i nie doda duplikatów`);
      
      const queueAdded = await initializeQueueV2(campaignId, 20);
      console.log(`   ✅ Dodano ${queueAdded} maili do kolejki V2`);
    }

    // KROK 6: Weryfikacja - NIE zmieniaj statusu kampanii!
    console.log(`\n✅ Migracja zakończona!`);
    console.log(`   ⚠️  Status kampanii: ${campaign.status} (NIE ZMIENIONY)`);
    console.log(`   ⚠️  Kampania NIE ZOSTAŁA URUCHOMIONA - możesz to zrobić ręcznie`);

    // KROK 7: Finalna weryfikacja
    const finalState = await analyzeCampaignState(campaignId);
    console.log(`\n📊 Stan końcowy:`);
    console.log(`   Wysłane: ${finalState.sentCount}`);
    console.log(`   W kolejce V2: ${finalState.queueCount}`);
    console.log(`   W kolejce (queued): ${finalState.queuedCount}`);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ MIGRACJA ZAKOŃCZONA POMYŚLNIE\n`);

  } catch (error: any) {
    console.error(`\n❌ Błąd migracji:`, error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Uruchom migrację
migrateCampaign3();

