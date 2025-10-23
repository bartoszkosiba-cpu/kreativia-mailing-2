/**
 * Seed dla Content Planner - pierwsza grupa "Podwieszenia Targowe"
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function seedContentPlanner() {
  console.log('🌱 Seedowanie Content Planner...\n');

  try {
    // Sprawdź czy grupa już istnieje
    const existing = await db.productGroup.findFirst({
      where: { name: "Podwieszenia Targowe" }
    });

    if (existing) {
      console.log('ℹ️  Grupa "Podwieszenia Targowe" już istnieje - pomijam\n');
      return existing;
    }

    // Utwórz pierwszą grupę produktową
    const group = await db.productGroup.create({
      data: {
        name: "Podwieszenia Targowe",
        description: "Systemy podwieszeń targowych - konstrukcje i grafika",
        targetAudience: "Wykonawcy stoisk targowych, firmy eventowe, agencje reklamowe, sieci retail",
        markets: "PL,DE,FR",
        iconEmoji: "🎪",
        isActive: true
      }
    });

    console.log(`✅ Utworzono grupę: "${group.name}" (ID: ${group.id})`);

    // Utwórz przykładowy temat (opcjonalnie)
    const theme = await db.campaignTheme.create({
      data: {
        productGroupId: group.id,
        name: "Szybki montaż - 15 minut zamiast 2 godzin",
        description: "Kampania skupiona na szybkości montażu podwieszeń",
        status: "draft"
      }
    });

    console.log(`✅ Utworzono przykładowy temat: "${theme.name}" (ID: ${theme.id})`);

    console.log('\n🎉 Seed zakończony pomyślnie!');
    console.log('\n📝 Następne kroki:');
    console.log('   1. Otwórz /content-planner');
    console.log('   2. Kliknij na grupę "Podwieszenia Targowe"');
    console.log('   3. Zacznij rozmowę z AI dla tematu\n');

    return group;

  } catch (error) {
    console.error('❌ Błąd seedowania:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Uruchom seed
seedContentPlanner()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Błąd krytyczny:', error);
    process.exit(1);
  });

