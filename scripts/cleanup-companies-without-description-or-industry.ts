/**
 * Skrypt do czyszczenia bazy - usuwa firmy bez activityDescription lub industry
 * Zgodnie z logiką importu, takie firmy są teraz pomijane przy imporcie
 */

import { db } from "../src/lib/db";

async function cleanupCompanies() {
  try {
    console.log("🔍 Sprawdzanie bazy firm...");

    // Pobierz statystyki przed czyszczeniem
    const totalBefore = await db.company.count();
    const withoutDescription = await db.company.count({
      where: {
        OR: [
          { activityDescription: null },
          { activityDescription: "" },
        ],
      },
    });
    const withoutIndustry = await db.company.count({
      where: {
        OR: [
          { industry: null },
          { industry: "" },
        ],
      },
    });

    // Firma jest do usunięcia jeśli NIE MA activityDescription LUB NIE MA industry
    // (zgodnie z logiką importu - firmy są pomijane jeśli brakuje któregokolwiek z tych pól)
    const toDelete = await db.company.count({
      where: {
        OR: [
          {
            OR: [
              { activityDescription: null },
              { activityDescription: "" },
            ],
          },
          {
            OR: [
              { industry: null },
              { industry: "" },
            ],
          },
        ],
      },
    });

    console.log(`📊 Statystyki przed czyszczeniem:`);
    console.log(`   - Łącznie firm: ${totalBefore}`);
    console.log(`   - Bez activityDescription: ${withoutDescription}`);
    console.log(`   - Bez industry: ${withoutIndustry}`);
    console.log(`   - Do usunięcia (brak activityDescription LUB brak industry): ${toDelete}`);

    if (toDelete === 0) {
      console.log("✅ Nie ma firm do usunięcia - baza jest czysta!");
      return;
    }

    // Pokaż przykładowe firmy do usunięcia
    const examples = await db.company.findMany({
      where: {
        OR: [
          {
            OR: [
              { activityDescription: null },
              { activityDescription: "" },
            ],
          },
          {
            OR: [
              { industry: null },
              { industry: "" },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        industry: true,
        activityDescription: true,
      },
      take: 5,
    });

    console.log(`\n📋 Przykładowe firmy do usunięcia (pierwsze 5):`);
    examples.forEach((company) => {
      console.log(`   - ID: ${company.id}, Nazwa: ${company.name}`);
      console.log(`     Industry: ${company.industry || "BRAK"}`);
      console.log(`     ActivityDescription: ${company.activityDescription ? `${company.activityDescription.substring(0, 50)}...` : "BRAK"}`);
    });

    // Usuń firmy
    console.log(`\n🗑️  Usuwanie ${toDelete} firm...`);
    const result = await db.company.deleteMany({
      where: {
        OR: [
          {
            OR: [
              { activityDescription: null },
              { activityDescription: "" },
            ],
          },
          {
            OR: [
              { industry: null },
              { industry: "" },
            ],
          },
        ],
      },
    });

    // Sprawdź wynik
    const totalAfter = await db.company.count();
    console.log(`\n✅ Czyszczenie zakończone:`);
    console.log(`   - Usunięto: ${result.count} firm`);
    console.log(`   - Pozostało: ${totalAfter} firm`);
    console.log(`   - Oszczędność: ${totalBefore - totalAfter} firm`);

  } catch (error) {
    console.error("❌ Błąd podczas czyszczenia bazy:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// Uruchom skrypt
cleanupCompanies()
  .then(() => {
    console.log("\n✅ Skrypt zakończony pomyślnie");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Błąd:", error);
    process.exit(1);
  });

