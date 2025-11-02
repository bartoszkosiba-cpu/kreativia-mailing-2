import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma;

async function checkLimitsDetail() {
  const campaignName = "Podwieszenia targowe PL - 30.10.25";
  
  // Znajdź kampanię
  const campaign = await db.campaign.findFirst({
    where: {
      name: {
        contains: campaignName
      }
    },
    include: {
      virtualSalesperson: {
        include: {
          mailboxes: {
            where: {
              isActive: true,
              OR: [
                { email: 'anna.martin@kreativia.eu' },
                { email: 'anna.martin@mail.kreativia.eu' }
              ]
            }
          }
        }
      }
    }
  });

  if (!campaign) {
    console.log(`❌ Nie znaleziono kampanii`);
    await db.$disconnect();
    return;
  }

  // Pobierz wysyłki od 19:50
  const filterFromDate = new Date('2025-10-31T19:50:00');
  const sendLogs = await db.sendLog.findMany({
    where: {
      campaignId: campaign.id,
      createdAt: {
        gte: filterFromDate
      },
      lead: {
        isNot: null
      }
    },
    include: {
      mailbox: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  console.log(`\n🔍 SZCZEGÓŁOWA ANALIZA LIMITÓW I ROZDZIELENIA:\n`);

  const mailboxes = campaign.virtualSalesperson?.mailboxes || [];
  
  mailboxes.forEach((mb) => {
    const sends = sendLogs.filter(s => s.mailboxId === mb.id);
    
    console.log(`\n📮 ${mb.email}`);
    console.log(`   Priorytet: ${mb.priority}`);
    console.log(`   Status warmup: ${mb.warmupStatus || 'brak'}`);
    console.log(`   dailyEmailLimit: ${mb.dailyEmailLimit}`);
    console.log(`   warmupDailyLimit: ${mb.warmupDailyLimit || 0}`);
    console.log(`   currentDailySent (w momencie wysyłki): musimy sprawdzić historię`);
    
    // Sprawdź ile maili było wysłanych PRZED 19:50 tego dnia
    const before1950 = new Date('2025-10-31T19:50:00');
    const beforeSends = sendLogs.filter(s => 
      s.mailboxId === mb.id && 
      s.createdAt < before1950 &&
      s.status === 'sent'
    );
    
    const sendsAfter1950 = sends.filter(s => s.status === 'sent');
    
    console.log(`   Wysłano od 19:50: ${sendsAfter1950.length} maili`);
    
    // Oblicz jaki był faktyczny limit
    let effectiveLimit: number;
    if (mb.warmupStatus === 'inactive' || mb.warmupStatus === 'ready_to_warmup') {
      effectiveLimit = 10; // NOWA SKRZYNKA - stałe 10
    } else if (mb.warmupStatus === 'warming') {
      // W warmup - użyj najmniejszego z 3 limitów
      effectiveLimit = Math.min(
        mb.dailyEmailLimit,
        mb.warmupDailyLimit || 0,
        10 // campaign limit z ustawień (domyślnie)
      );
    } else {
      effectiveLimit = mb.dailyEmailLimit;
    }
    
    console.log(`   ⚙️  OBLICZONY LIMIT (effectiveLimit): ${effectiveLimit}`);
    console.log(`      Logika:`);
    if (mb.warmupStatus === 'inactive' || mb.warmupStatus === 'ready_to_warmup') {
      console.log(`      - Status: inactive → używa STAŁEGO limitu 10 maili/dzień`);
      console.log(`      - (Nawet jeśli dailyEmailLimit = ${mb.dailyEmailLimit})`);
    } else if (mb.warmupStatus === 'warming') {
      console.log(`      - Status: warming → min(${mb.dailyEmailLimit}, ${mb.warmupDailyLimit || 0}, 10)`);
    } else {
      console.log(`      - Status: ${mb.warmupStatus} → używa dailyEmailLimit = ${mb.dailyEmailLimit}`);
    }
  });

  console.log(`\n\n📊 PODSUMOWANIE ROZDZIELENIA:\n`);
  console.log(`Algorytm wyboru skrzynki (z mailboxManager.ts):\n`);
  console.log(`1. Sortowanie:`);
  console.log(`   - priority ASC (1 = najwyższy)`);
  console.log(`   - lastUsedAt ASC (najdawniej użyta = pierwsza)`);
  console.log(`   - Główna skrzynka zawsze na początku\n`);
  console.log(`2. Wybór:`);
  console.log(`   - Przechodzi przez listę od początku`);
  console.log(`   - Wybiera PIERWSZĄ która ma remaining > 0`);
  console.log(`   - Gdy skrzynka wyczerpana → następna w kolejności\n`);
  console.log(`3. W Twoim przypadku:`);
  console.log(`   - anna.martin@kreativia.eu (priorytet 1): limit 10 → użyto 8 → zostało 2`);
  console.log(`   - anna.martin@mail.kreativia.eu (priorytet 2): limit 10 → użyto 1 → zostało 9`);
  console.log(`   - Dlaczego tylko 1? Prawdopodobnie kampania się zakończyła lub był inny powód\n`);

  await db.$disconnect();
}

checkLimitsDetail().catch(console.error);

