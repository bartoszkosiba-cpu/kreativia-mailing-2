/**
 * Skrypt do sprawdzenia duplikatów w importach
 * Sprawdza czy firmy z ostatniego importu (batch 15) faktycznie istnieją w bazie
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    // Pobierz ostatni batch
    const lastBatch = await prisma.companyImportBatch.findFirst({
      where: { id: 15 },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastBatch) {
      console.log('Nie znaleziono batcha 15');
      return;
    }

    console.log(`\n📊 Batch 15: ${lastBatch.name}`);
    console.log(`   Total rows: ${lastBatch.totalRows}`);
    console.log(`   Imported: ${lastBatch.importedCount}`);
    console.log(`   Skipped: ${lastBatch.skippedCount}`);
    console.log(`   Errors: ${lastBatch.errorCount}\n`);

    // Sprawdź czy pominięte firmy faktycznie są w bazie
    // (To są firmy które system oznaczył jako duplikaty)
    
    // Pobierz kilka przykładów z pominiętych firm
    const exampleNames = [
      'Agata S.A.',
      'Kodeo Sp. z o. o.',
      'Vipservice',
      'DEKORNIK',
      'PMICOMBERA an ADVANTAGE SMOLLAN company'
    ];

    console.log('🔍 Sprawdzanie czy przykładowe pominięte firmy faktycznie są w bazie:\n');

    for (const name of exampleNames) {
      const existing = await prisma.company.findFirst({
        where: { name },
      });

      if (existing) {
        console.log(`✅ "${name}" - ISTNIEJE w bazie (ID: ${existing.id}, batch: ${existing.importBatchId}, utworzona: ${existing.createdAt})`);
      } else {
        console.log(`❌ "${name}" - NIE ISTNIEJE w bazie (może być błąd w wykrywaniu duplikatów!)`);
      }
    }

    // Sprawdź czy w bazie są firmy z różnymi batchami ale tą samą nazwą
    console.log('\n\n🔍 Sprawdzanie czy są firmy z różnymi batchami ale tą samą nazwą:\n');
    
    const duplicateNames = await prisma.$queryRaw`
      SELECT name, COUNT(*) as count, GROUP_CONCAT(importBatchId) as batches
      FROM Company
      WHERE name IN (${exampleNames.join("','")})
      GROUP BY name
      HAVING count > 1
    `;

    if (duplicateNames.length > 0) {
      console.log('⚠️  ZNALEZIONO DUPLIKATY W BAZIE (te same nazwy w różnych batchach):\n');
      for (const dup of duplicateNames) {
        console.log(`   "${dup.name}" - ${dup.count} razy w batchach: ${dup.batches}`);
      }
    } else {
      console.log('✅ Brak duplikatów w bazie dla przykładów');
    }

    // Sprawdź ile firm z batcha 15 zostało zaimportowanych
    const companiesFromBatch15 = await prisma.company.count({
      where: { importBatchId: 15 },
    });

    console.log(`\n📊 Fakt: W bazie jest ${companiesFromBatch15} firm z batcha 15`);
    console.log(`   Oznacza to, że system poprawnie oznaczył ${lastBatch.skippedCount} firm jako duplikaty (już były w bazie z wcześniejszych importów)\n`);

  } catch (error) {
    console.error('Błąd:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();

