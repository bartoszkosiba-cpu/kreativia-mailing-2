/**
 * Sprawdza jak jest obliczany delay - symulacja
 */
import { db } from "../src/lib/db";

async function checkDelayCalculation() {
  try {
    // Znajdź kampanię
    const campaign = await db.campaign.findFirst({
      where: {
        name: {
          contains: "Podwieszenia targowe PL"
        }
      },
      include: {
        virtualSalesperson: {
          include: {
            mailboxes: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!campaign) {
      console.log("❌ Nie znaleziono kampanii");
      return;
    }

    console.log("\n" + "=".repeat(80));
    console.log("🔍 ANALIZA OBLICZANIA DELAY");
    console.log("=".repeat(80));

    // 1. Oblicz dostępność skrzynek
    const mailboxes = campaign.virtualSalesperson?.mailboxes || [];
    let totalCapacity = 0;
    
    console.log("\n📬 DOSTĘPNE SKRZYNKI:");
    mailboxes.forEach((mb, i) => {
      // Symulacja: nowa skrzynka = 10 maili dziennie
      const limit = mb.warmupStatus === 'inactive' || mb.warmupStatus === 'ready_to_warmup' 
        ? 10 
        : mb.dailyEmailLimit;
      const remaining = limit - (mb.currentDailySent || 0);
      totalCapacity += Math.max(0, remaining);
      console.log(`  ${i + 1}. ${mb.email}: ${remaining}/${limit} (warmup: ${mb.warmupStatus})`);
    });

    console.log(`\n✅ CAŁKOWITA DOSTĘPNOŚĆ DZISIAJ: ${totalCapacity} maili`);

    // 2. Oblicz okno czasowe
    const now = new Date();
    const endWindow = new Date(now);
    endWindow.setHours(campaign.endHour || 15, campaign.endMinute || 0, 0);
    endWindow.setMinutes(endWindow.getMinutes() - 60); // -1h margines
    
    const msRemaining = endWindow.getTime() - now.getTime();
    const secondsRemaining = Math.floor(msRemaining / 1000);
    const minutesRemaining = Math.floor(secondsRemaining / 60);
    const hoursRemaining = (minutesRemaining / 60).toFixed(1);

    console.log(`\n⏰ OKNO CZASOWE:`);
    console.log(`  Start: ${campaign.startHour || 9}:${String(campaign.startMinute || 0).padStart(2, '0')}`);
    console.log(`  Koniec: ${campaign.endHour || 15}:${String(campaign.endMinute || 0).padStart(2, '0')}`);
    console.log(`  Obecna godzina: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
    console.log(`  Pozostało czasu: ${hoursRemaining}h (${minutesRemaining} min = ${secondsRemaining} sekund)`);

    // 3. Oblicz optymalny delay (jak powinno być)
    let optimalDelay = campaign.delayBetweenEmails; // Bazowy: 90 sekund
    
    if (secondsRemaining > 0 && totalCapacity > 0) {
      optimalDelay = Math.floor(secondsRemaining / Math.max(1, totalCapacity));
      optimalDelay = Math.max(optimalDelay, campaign.delayBetweenEmails); // Nie mniej niż bazowy
    }

    console.log(`\n📊 OBLICZENIE DELAY (jak powinno być):`);
    console.log(`  Formuła: ${secondsRemaining}s ÷ ${totalCapacity} maili = ${Math.floor(secondsRemaining / totalCapacity)}s`);
    console.log(`  Optymalny delay: ${optimalDelay}s (${Math.floor(optimalDelay / 60)}min ${optimalDelay % 60}s)`);
    
    // Z ±20%
    const randomVariation = 0.2;
    const minDelay = optimalDelay * (1 - randomVariation);
    const maxDelay = optimalDelay * (1 + randomVariation);
    
    console.log(`  Z ±20%: ${Math.floor(minDelay)}s - ${Math.floor(maxDelay)}s`);
    console.log(`  Średnio: ~${Math.floor((minDelay + maxDelay) / 2)}s (${Math.floor((minDelay + maxDelay) / 2 / 60)}min)`);

    // 4. Sprawdź jak obecnie działa (oblicza na podstawie remainingInLoop)
    const CampaignLead = await db.campaignLead.findMany({
      where: {
        campaignId: campaign.id,
        status: 'queued'
      }
    });

    const remainingInLoop = CampaignLead.length;
    const currentDelayCalculation = Math.floor(secondsRemaining / Math.max(1, remainingInLoop));

    console.log(`\n⚠️  OBECNE OBLICZENIE (jak faktycznie działa):`);
    console.log(`  Pozostało leadów w kolejce: ${remainingInLoop}`);
    console.log(`  Formuła: ${secondsRemaining}s ÷ ${remainingInLoop} maili = ${currentDelayCalculation}s`);
    console.log(`  Obliczony delay: ${currentDelayCalculation}s (${Math.floor(currentDelayCalculation / 60)}min ${currentDelayCalculation % 60}s)`);

    // 5. Porównanie
    console.log(`\n📈 PORÓWNANIE:`);
    console.log(`  Jak powinno być (na podstawie skrzynek): ${optimalDelay}s (~${Math.floor(optimalDelay / 60)}min)`);
    console.log(`  Jak faktycznie działa (na podstawie leadów): ${currentDelayCalculation}s (~${Math.floor(currentDelayCalculation / 60)}min)`);
    
    const difference = Math.abs(optimalDelay - currentDelayCalculation);
    console.log(`  Różnica: ${difference}s (${Math.floor(difference / 60)}min)`);

    console.log("\n" + "=".repeat(80));
    console.log("✅ SPRAWDZENIE ZAKOŃCZONE");
    console.log("=".repeat(80) + "\n");

  } catch (error: any) {
    console.error("❌ Błąd:", error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

checkDelayCalculation();

