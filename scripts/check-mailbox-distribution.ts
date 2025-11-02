import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma;

async function checkMailboxDistribution() {
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
              isActive: true
            },
            orderBy: [
              { priority: "asc" },
              { lastUsedAt: "asc" }
            ]
          }
        }
      }
    }
  });

  if (!campaign) {
    console.log(`❌ Nie znaleziono kampanii: ${campaignName}`);
    await db.$disconnect();
    return;
  }

  console.log(`\n✅ Kampania: ${campaign.name}`);
  console.log(`👤 Handlowiec: ${campaign.virtualSalesperson?.name || 'Brak'} (ID: ${campaign.virtualSalespersonId})\n`);

  // Pobierz wysyłki od 19:50
  const filterFromDate = new Date('2025-10-31T19:50:00');
  const sendLogs = await db.sendLog.findMany({
    where: {
      campaignId: campaign.id,
      createdAt: {
        gte: filterFromDate
      },
      lead: {
        isNot: null // Tylko prawdziwe wysyłki (nie testowe)
      }
    },
    include: {
      lead: {
        select: {
          email: true,
          firstName: true,
          lastName: true
        }
      },
      mailbox: {
        select: {
          id: true,
          email: true,
          displayName: true,
          priority: true,
          dailyEmailLimit: true,
          warmupStatus: true,
          warmupDay: true,
          warmupDailyLimit: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  console.log(`📊 Wysyłki od 19:50: ${sendLogs.length} maili do leadów\n`);

  // Podsumowanie skrzynek
  const mailboxUsage = new Map<string, {
    email: string;
    displayName: string | null;
    count: number;
    priority: number;
    limits: any;
    sends: any[];
  }>();

  sendLogs.forEach(log => {
    if (!log.mailbox) return;
    
    const key = log.mailbox.email;
    if (!mailboxUsage.has(key)) {
      mailboxUsage.set(key, {
        email: log.mailbox.email,
        displayName: log.mailbox.displayName,
        count: 0,
        priority: log.mailbox.priority,
        limits: {
          dailyEmailLimit: log.mailbox.dailyEmailLimit,
          warmupStatus: log.mailbox.warmupStatus,
          warmupDay: log.mailbox.warmupDay,
          warmupDailyLimit: log.mailbox.warmupDailyLimit
        },
        sends: []
      });
    }
    
    const usage = mailboxUsage.get(key)!;
    usage.count++;
    usage.sends.push({
      time: log.createdAt.toLocaleTimeString('pl-PL'),
      lead: log.lead?.email || 'Unknown'
    });
  });

  console.log(`📮 Użyte skrzynki (${mailboxUsage.size}):\n`);
  
  // Sortuj po priorytecie i ilości użyć
  const sortedMailboxes = Array.from(mailboxUsage.values())
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.count - b.count;
    });

  sortedMailboxes.forEach((mb, idx) => {
    console.log(`${idx + 1}. ${mb.email}${mb.displayName ? ` (${mb.displayName})` : ''}`);
    console.log(`   📧 Priorytet: ${mb.priority}`);
    console.log(`   📊 Użyć: ${mb.count} maili`);
    console.log(`   ⚙️  Limity:`);
    console.log(`      - dailyEmailLimit: ${mb.limits.dailyEmailLimit}`);
    console.log(`      - warmupStatus: ${mb.limits.warmupStatus || 'brak'}`);
    if (mb.limits.warmupStatus === 'warming') {
      console.log(`      - warmupDay: ${mb.limits.warmupDay || 0}`);
      console.log(`      - warmupDailyLimit: ${mb.limits.warmupDailyLimit || 0}`);
    }
    console.log(`   📅 Wysyłki:`);
    mb.sends.forEach(send => {
      console.log(`      ${send.time} → ${send.lead}`);
    });
    console.log('');
  });

  // Sprawdź wszystkie dostępne skrzynki dla handlowca
  const allMailboxes = campaign.virtualSalesperson?.mailboxes || [];
  console.log(`\n📋 Wszystkie aktywne skrzynki dla handlowca (${allMailboxes.length}):\n`);
  
  allMailboxes.forEach((mb, idx) => {
    const wasUsed = mailboxUsage.has(mb.email);
    const usage = wasUsed ? mailboxUsage.get(mb.email)! : null;
    
    console.log(`${idx + 1}. ${mb.email}${mb.displayName ? ` (${mb.displayName})` : ''}`);
    console.log(`   📧 Priorytet: ${mb.priority}`);
    console.log(`   ✅ Status: ${mb.isActive ? 'Aktywna' : 'Nieaktywna'}`);
    console.log(`   ⚙️  dailyEmailLimit: ${mb.dailyEmailLimit}`);
    console.log(`   🔥 warmupStatus: ${mb.warmupStatus || 'brak'}`);
    if (mb.warmupStatus === 'warming') {
      console.log(`   📅 warmupDay: ${mb.warmupDay || 0}`);
      console.log(`   📊 warmupDailyLimit: ${mb.warmupDailyLimit || 0}`);
    }
    if (usage) {
      console.log(`   ✅ Użyta: ${usage.count} maili`);
    } else {
      console.log(`   ⏭️  Nie użyta w tej sesji (od 19:50)`);
    }
    console.log('');
  });

  // Analiza algorytmu
  console.log(`\n🔍 ANALIZA ALGORYTMU WYBORU SKRZYNEK:\n`);
  console.log(`System używa algorytmu "greedy first-fit" z priorytetami:\n`);
  console.log(`1. Sortowanie skrzynek:`);
  console.log(`   - Najpierw po PRIORYTECIE (priority ASC - niższa liczba = wyższy priorytet)`);
  console.log(`   - Potem po DATIE OSTATNIEGO UŻYCIA (lastUsedAt ASC - najdawniej użyta = pierwsza)`);
  console.log(`   - Główna skrzynka (mainMailboxId) jest zawsze pierwsza\n`);
  console.log(`2. Wybór skrzynki:`);
  console.log(`   - Przechodzi przez posortowane skrzynki`);
  console.log(`   - Wybiera PIERWSZĄ która ma wolne miejsce (remaining > 0)`);
  console.log(`   - Jeśli skrzynka wyczerpana → przechodzi do następnej\n`);
  console.log(`3. Limity dla skrzynek:`);
  console.log(`   - NOWA (inactive/ready_to_warmup): stałe 10 maili/dzień`);
  console.log(`   - W WARΜUP (warming): min(dailyEmailLimit, warmupDailyLimit, campaign z ustawień)`);
  console.log(`   - GOTOWA (warmed_up): dailyEmailLimit\n`);

  // Sprawdź dlaczego druga skrzynka otrzymała tylko 1 mail
  if (sortedMailboxes.length >= 2) {
    const first = sortedMailboxes[0];
    const second = sortedMailboxes[1];
    
    console.log(`\n💡 DLACZEGO ${second.email} DOSTAŁA TYLKO 1 MAIL?\n`);
    console.log(`Najprawdopodobniej:`);
    console.log(`- ${first.email} miała priorytet ${first.priority}, ${second.email} miała priorytet ${second.priority}`);
    console.log(`- ${first.email} została użyta ${first.count} razy, więc wyczerpała swój limit`);
    console.log(`- System przeszedł do ${second.email} (następna w kolejności)`);
    console.log(`- ${second.email} wysłała 1 mail, potem również wyczerpała limit lub kampania się skończyła\n`);
  }

  await db.$disconnect();
}

checkMailboxDistribution().catch(console.error);

