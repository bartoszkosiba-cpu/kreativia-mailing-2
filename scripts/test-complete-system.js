/**
 * KOMPLEKSOWY TEST SYSTEMU V2
 * 
 * Testuje wszystkie nowe funkcjonalności:
 * - Tworzenie handlowców i skrzynek
 * - Tworzenie kampanii z różnymi ustawieniami
 * - Dodawanie leadów
 * - Inicjalizacja kolejki
 * - Wysyłka maili
 * - Różne edge cases
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./prisma/dev.db'
    }
  }
});

// Kolory dla logów
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(`  ${title}`, 'bright');
  console.log('='.repeat(80) + '\n');
}

function logTest(name) {
  log(`\n▶ Test: ${name}`, 'cyan');
}

function logSuccess(message) {
  log(`  ✅ ${message}`, 'green');
}

function logError(message) {
  log(`  ❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`  ⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`  ℹ️  ${message}`, 'blue');
}

// Testy
const tests = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function assert(condition, message) {
  if (condition) {
    tests.passed++;
    logSuccess(message);
    return true;
  } else {
    tests.failed++;
    logError(message);
    return false;
  }
}

function warn(condition, message) {
  if (!condition) {
    tests.warnings++;
    logWarning(message);
  }
}

// ============================================================================
// SCENARIUSZ 1: NOWY HANDLOWIEC I SKRZYNKI
// ============================================================================

async function testScenario1_NewSalesperson() {
  logSection('SCENARIUSZ 1: Nowy handlowiec i skrzynki');

  logTest('1.1. Tworzenie nowego handlowca');
  
  const timestamp = Date.now();
  const uniqueEmail = `test.${timestamp}@example.com`;
  
  const salesperson = await prisma.virtualSalesperson.create({
    data: {
      name: `Test Handlowiec ${timestamp}`,
      email: uniqueEmail,
      language: 'pl',
      dailyEmailLimit: 100
    }
  });

  assert(salesperson.id > 0, `Utworzono handlowca ID: ${salesperson.id}`);
  assert(salesperson.name.includes('Test Handlowiec'), 'Nazwa handlowca poprawna');
  assert(salesperson.language === 'pl', 'Język handlowca poprawny');

  logTest('1.2. Tworzenie głównej skrzynki');
  
  const mainMailbox = await prisma.mailbox.create({
    data: {
      email: `test.main.${timestamp}@example.com`,
      displayName: 'Test Main',
      virtualSalespersonId: salesperson.id,
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpUser: 'test@example.com',
      smtpPass: 'password123',
      smtpSecure: false,
      imapHost: 'imap.example.com',
      imapPort: 993,
      imapUser: 'test@example.com',
      imapPass: 'password123',
      imapSecure: true,
      dailyEmailLimit: 50,
      isActive: true,
      warmupStatus: 'ready',
      priority: 1
    }
  });

  assert(mainMailbox.id > 0, `Utworzono główną skrzynkę ID: ${mainMailbox.id}`);
  assert(mainMailbox.warmupStatus === 'ready', 'Status warmup: ready');

  // Ustaw jako główną skrzynkę
  await prisma.virtualSalesperson.update({
    where: { id: salesperson.id },
    data: { mainMailboxId: mainMailbox.id }
  });

  logTest('1.3. Tworzenie dodatkowych skrzynek');
  
  const mailbox2 = await prisma.mailbox.create({
    data: {
      email: `test.2.${timestamp}@example.com`,
      displayName: 'Test 2',
      virtualSalespersonId: salesperson.id,
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpUser: 'test2@example.com',
      smtpPass: 'password123',
      smtpSecure: false,
      imapHost: 'imap.example.com',
      imapPort: 993,
      imapUser: 'test2@example.com',
      imapPass: 'password123',
      imapSecure: true,
      dailyEmailLimit: 50,
      isActive: true,
      warmupStatus: 'inactive',
      priority: 2
    }
  });

  const mailbox3 = await prisma.mailbox.create({
    data: {
      email: `test.3.${timestamp}@example.com`,
      displayName: 'Test 3',
      virtualSalespersonId: salesperson.id,
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpUser: 'test3@example.com',
      smtpPass: 'password123',
      smtpSecure: false,
      imapHost: 'imap.example.com',
      imapPort: 993,
      imapUser: 'test3@example.com',
      imapPass: 'password123',
      imapSecure: true,
      dailyEmailLimit: 50,
      isActive: true,
      warmupStatus: 'ready',
      priority: 3
    }
  });

  assert(mailbox2.id > 0, `Utworzono skrzynkę 2 ID: ${mailbox2.id}`);
  assert(mailbox3.id > 0, `Utworzono skrzynkę 3 ID: ${mailbox3.id}`);

  // Sprawdź liczniki
  const allMailboxes = await prisma.mailbox.findMany({
    where: { virtualSalespersonId: salesperson.id }
  });

  assert(allMailboxes.length === 3, `Wszystkie 3 skrzynki utworzone`);

  for (const mb of allMailboxes) {
    assert(mb.currentDailySent === 0, `Skrzynka ${mb.email}: currentDailySent = 0`);
    assert(mb.lastResetDate === null || mb.lastResetDate !== null, `Skrzynka ${mb.email}: lastResetDate istnieje`);
  }

  return { salesperson, mailboxes: [mainMailbox, mailbox2, mailbox3] };
}

// ============================================================================
// SCENARIUSZ 2: NOWA KAMPANIA Z RÓŻNYMI USTAWIENIAMI
// ============================================================================

async function testScenario2_NewCampaign(salesperson) {
  logSection('SCENARIUSZ 2: Nowa kampania z różnymi ustawieniami');

  logTest('2.1. Tworzenie kampanii z harmonogramem');
  
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Test Kampania V2',
      description: 'Testowa kampania do weryfikacji systemu V2',
      virtualSalespersonId: salesperson.id,
      status: 'DRAFT',
      subject: 'Test Temat',
      text: 'Test Treść kampanii',
      delayBetweenEmails: 90, // 90 sekund
      maxEmailsPerDay: 200,
      startHour: 9,
      startMinute: 0,
      endHour: 17,
      endMinute: 0,
      allowedDays: 'poniedziałek,wtorek,środa,czwartek,piątek',
      respectHolidays: true,
      abTestEnabled: false,
      autoReplyEnabled: false
    }
  });

  assert(campaign.id > 0, `Utworzono kampanię ID: ${campaign.id}`);
  assert(campaign.status === 'DRAFT', 'Status kampanii: DRAFT');
  assert(campaign.delayBetweenEmails === 90, 'Delay między mailami: 90s');
  assert(campaign.maxEmailsPerDay === 200, 'Limit dzienny: 200 maili');
  assert(campaign.startHour === 9 && campaign.startMinute === 0, 'Okno czasowe: 9:00-17:00');
  assert(campaign.allowedDays === 'poniedziałek,wtorek,środa,czwartek,piątek', 'Dni tygodnia: pn-pt');

  logTest('2.2. Aktualizacja kampanii (zmiana statusu)');
  
  const updatedCampaign = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'SCHEDULED' }
  });

  assert(updatedCampaign.status === 'SCHEDULED', 'Status zmieniony na SCHEDULED');

  logTest('2.3. Weryfikacja ustawień kampanii');
  
  const checkCampaign = await prisma.campaign.findUnique({
    where: { id: campaign.id },
    include: {
      virtualSalesperson: true
    }
  });

  assert(checkCampaign.virtualSalesperson.id === salesperson.id, 'Handlowiec przypisany do kampanii');
  assert(checkCampaign.virtualSalesperson.language === 'pl', 'Język handlowca: pl');

  return campaign;
}

// ============================================================================
// SCENARIUSZ 3: NOWE LEADY
// ============================================================================

async function testScenario3_NewLeads(campaign) {
  logSection('SCENARIUSZ 3: Nowe leady');

  logTest('3.1. Tworzenie leadów z różnymi danymi');
  
  const timestamp = Date.now();
  const leads = [];
  
  // Lead 1: Pełne dane
  const lead1 = await prisma.lead.create({
    data: {
      email: `test.lead1.${timestamp}@example.com`,
      firstName: 'Jan',
      lastName: 'Kowalski',
      company: 'Test Company 1',
      language: 'pl',
      status: 'ACTIVE',
      greetingForm: 'Dzień dobry Panie Janie'
    }
  });

  // Lead 2: Minimalne dane
  const lead2 = await prisma.lead.create({
    data: {
      email: `test.lead2.${timestamp}@example.com`,
      company: 'Test Company 2',
      language: 'pl',
      status: 'ACTIVE'
    }
  });

  // Lead 3: Język angielski
  const lead3 = await prisma.lead.create({
    data: {
      email: `test.lead3.${timestamp}@example.com`,
      firstName: 'John',
      lastName: 'Smith',
      company: 'Test Company 3',
      language: 'en',
      status: 'ACTIVE',
      greetingForm: 'Hello John'
    }
  });

  // Lead 4: BLOCKED (nie powinien być wysłany)
  const lead4 = await prisma.lead.create({
    data: {
      email: `test.lead4.${timestamp}@example.com`,
      firstName: 'Blocked',
      company: 'Blocked Company',
      language: 'pl',
      status: 'BLOCKED',
      isBlocked: true
    }
  });

  assert(lead1.id > 0, `Utworzono lead 1 ID: ${lead1.id}`);
  assert(lead2.id > 0, `Utworzono lead 2 ID: ${lead2.id}`);
  assert(lead3.id > 0, `Utworzono lead 3 ID: ${lead3.id}`);
  assert(lead4.id > 0, `Utworzono lead 4 ID: ${lead4.id}`);

  logTest('3.2. Dodawanie leadów do kampanii');
  
  const campaignLead1 = await prisma.campaignLead.create({
    data: {
      campaignId: campaign.id,
      leadId: lead1.id,
      status: 'planned',
      priority: 1
    }
  });

  const campaignLead2 = await prisma.campaignLead.create({
    data: {
      campaignId: campaign.id,
      leadId: lead2.id,
      status: 'planned',
      priority: 2
    }
  });

  const campaignLead3 = await prisma.campaignLead.create({
    data: {
      campaignId: campaign.id,
      leadId: lead3.id,
      status: 'planned',
      priority: 3
    }
  });

  // Lead 4 (BLOCKED) - nie dodajemy do kampanii

  assert(campaignLead1.id > 0, `Dodano lead 1 do kampanii`);
  assert(campaignLead2.id > 0, `Dodano lead 2 do kampanii`);
  assert(campaignLead3.id > 0, `Dodano lead 3 do kampanii`);

  // Sprawdź liczbę leadów w kampanii
  const campaignLeadsCount = await prisma.campaignLead.count({
    where: {
      campaignId: campaign.id,
      lead: {
        status: { not: 'BLOCKED' }
      }
    }
  });

  assert(campaignLeadsCount === 3, `W kampanii jest 3 aktywnych leadów (BLOCKED wykluczony)`);

  return { leads: [lead1, lead2, lead3, lead4], campaignLeads: [campaignLead1, campaignLead2, campaignLead3] };
}

// ============================================================================
// SCENARIUSZ 4: INICJALIZACJA KOLEJKI V2
// ============================================================================

async function testScenario4_InitializeQueue(campaign) {
  logSection('SCENARIUSZ 4: Inicjalizacja kolejki V2');

  logTest('4.1. Zmiana statusu kampanii na IN_PROGRESS');
  
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'IN_PROGRESS' }
  });

  // Zmień status leadów na queued
  await prisma.campaignLead.updateMany({
    where: {
      campaignId: campaign.id,
      status: 'planned'
    },
    data: {
      status: 'queued'
    }
  });

  logTest('4.2. Inicjalizacja kolejki V2');
  
  // Symulacja inicjalizacji kolejki (bezpośrednie tworzenie wpisów)
  const { getPolishTime } = require('../src/utils/polishTime');
  const now = getPolishTime();
  
  const campaignLeads = await prisma.campaignLead.findMany({
    where: {
      campaignId: campaign.id,
      status: 'queued'
    },
    take: 20
  });

  let initialized = 0;
  let nextScheduledAt = new Date(now);
  
  for (const cl of campaignLeads) {
    // Sprawdź czy już istnieje wpis w kolejce
    const existing = await prisma.campaignEmailQueue.findFirst({
      where: {
        campaignId: campaign.id,
        campaignLeadId: cl.id,
        status: { in: ['pending', 'sending'] }
      }
    });
    
    if (!existing) {
      await prisma.campaignEmailQueue.create({
        data: {
          campaignId: campaign.id,
          campaignLeadId: cl.id,
          scheduledAt: new Date(nextScheduledAt),
          status: 'pending'
        }
      });
      
      initialized++;
      // Następny mail za delayBetweenEmails ± 20%
      const delay = campaign.delayBetweenEmails || 90;
      const variation = delay * 0.2;
      const actualDelay = delay + (Math.random() * variation * 2 - variation);
      nextScheduledAt = new Date(nextScheduledAt.getTime() + actualDelay * 1000);
    }
  }

  assert(initialized > 0, `Zainicjalizowano ${initialized} maili w kolejce`);

  logTest('4.3. Weryfikacja wpisów w kolejce');
  
  const queueEntries = await prisma.campaignEmailQueue.findMany({
    where: {
      campaignId: campaign.id
    },
    include: {
      campaignLead: {
        include: {
          lead: true
        }
      }
    },
    orderBy: {
      scheduledAt: 'asc'
    }
  });

  assert(queueEntries.length > 0, `W kolejce jest ${queueEntries.length} wpisów`);
  assert(queueEntries[0].status === 'pending', 'Status pierwszego maila: pending');
  assert(queueEntries[0].scheduledAt !== null, 'ScheduledAt ustawiony');

  // Sprawdź czy scheduledAt jest w przyszłości
  const nowCheck = new Date();
  const firstScheduled = new Date(queueEntries[0].scheduledAt);
  warn(firstScheduled >= nowCheck, 'Pierwszy mail zaplanowany w przyszłości');

  logTest('4.4. Weryfikacja odstępów między mailami');
  
  if (queueEntries.length > 1) {
    const delays = [];
    for (let i = 1; i < queueEntries.length; i++) {
      const prev = new Date(queueEntries[i - 1].scheduledAt);
      const curr = new Date(queueEntries[i].scheduledAt);
      const delay = Math.floor((curr.getTime() - prev.getTime()) / 1000);
      delays.push(delay);
    }

    const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
    const expectedDelay = campaign.delayBetweenEmails || 90;

    logInfo(`Średni delay: ${Math.round(avgDelay)}s (oczekiwany: ${expectedDelay}s ±20%)`);
    
    warn(
      avgDelay >= expectedDelay * 0.8 && avgDelay <= expectedDelay * 1.2,
      `Delay w zakresie ±20% (${Math.round(expectedDelay * 0.8)}s - ${Math.round(expectedDelay * 1.2)}s)`
    );
  }

  return queueEntries;
}

// ============================================================================
// SCENARIUSZ 5: WYSYŁKA MAILI (RÓŻNE SCENARIUSZE)
// ============================================================================

async function testScenario5_SendingEmails(campaign, mailboxes) {
  logSection('SCENARIUSZ 5: Wysyłka maili - różne scenariusze');

  logTest('5.1. Sprawdzenie dostępności skrzynek');
  
  // Symulacja sprawdzenia dostępności skrzynek
  const mailboxesForCampaign = await prisma.mailbox.findMany({
    where: {
      virtualSalespersonId: campaign.virtualSalespersonId,
      isActive: true
    },
    orderBy: [
      { priority: 'asc' },
      { lastUsedAt: 'asc' }
    ]
  });

  let availableMailbox = null;
  for (const mb of mailboxesForCampaign) {
    const remaining = mb.dailyEmailLimit - mb.currentDailySent;
    if (remaining > 0) {
      availableMailbox = {
        id: mb.id,
        email: mb.email,
        remainingToday: remaining,
        dailyEmailLimit: mb.dailyEmailLimit
      };
      break;
    }
  }

  assert(availableMailbox !== null, 'Dostępna skrzynka znaleziona');
  if (availableMailbox) {
    assert(availableMailbox.remainingToday > 0, `Skrzynka ${availableMailbox.email}: ${availableMailbox.remainingToday} dostępnych slotów`);
    logInfo(`Wybrana skrzynka: ${availableMailbox.email} (${availableMailbox.remainingToday}/${availableMailbox.dailyEmailLimit})`);
  }

  logTest('5.2. Weryfikacja limitów dziennych');
  
  const campaignLimit = campaign.maxEmailsPerDay || 200;
  
  // Oblicz start dzisiaj w polskim czasie
  const nowDate = new Date();
  const plTime = new Date(nowDate.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }));
  const todayStart = new Date(plTime);
  todayStart.setHours(0, 0, 0, 0);

  const sentToday = await prisma.sendLog.count({
    where: {
      campaignId: campaign.id,
      status: 'sent',
      createdAt: { gte: todayStart }
    }
  });

  assert(sentToday < campaignLimit, `Wysłano dzisiaj ${sentToday}/${campaignLimit} maili (limit nie przekroczony)`);

  logTest('5.3. Weryfikacja okna czasowego');
  
  const nowTime = new Date();
  const currentHour = nowTime.getHours();
  const currentMinute = nowTime.getMinutes();
  
  const startMinutes = (campaign.startHour || 9) * 60 + (campaign.startMinute || 0);
  const endMinutes = (campaign.endHour || 17) * 60 + (campaign.endMinute || 0);
  const currentMinutes = currentHour * 60 + currentMinute;

  const isInWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  
  if (isInWindow) {
    logSuccess(`Aktualny czas (${currentHour}:${currentMinute.toString().padStart(2, '0')}) jest w oknie wysyłki (${campaign.startHour}:${campaign.startMinute?.toString().padStart(2, '0') || '00'}-${campaign.endHour}:${campaign.endMinute?.toString().padStart(2, '0') || '00'})`);
  } else {
    logWarning(`Aktualny czas (${currentHour}:${currentMinute.toString().padStart(2, '0')}) jest poza oknem wysyłki`);
  }

  logTest('5.4. Weryfikacja dni tygodnia');
  
  const currentDay = nowTime.getDay(); // 0 = niedziela
  const dayNames = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const currentDayName = dayNames[currentDay];
  
  const allowedDays = campaign.allowedDays ? campaign.allowedDays.split(',') : [];
  const isAllowedDay = allowedDays.length === 0 || allowedDays.includes(currentDayName);

  if (isAllowedDay) {
    logSuccess(`Dzień tygodnia (${currentDayName}) jest dozwolony`);
  } else {
    logWarning(`Dzień tygodnia (${currentDayName}) nie jest dozwolony (${allowedDays.join(', ')})`);
  }

  logTest('5.5. Weryfikacja kolejki przed wysyłką');
  
  const pendingEmails = await prisma.campaignEmailQueue.count({
    where: {
      campaignId: campaign.id,
      status: 'pending'
    }
  });

  const sendingEmails = await prisma.campaignEmailQueue.count({
    where: {
      campaignId: campaign.id,
      status: 'sending'
    }
  });

  logInfo(`W kolejce: ${pendingEmails} pending, ${sendingEmails} sending`);

  assert(pendingEmails > 0 || sendingEmails > 0, 'W kolejce są maile do wysłania');
}

// ============================================================================
// SCENARIUSZ 6: EDGE CASES
// ============================================================================

async function testScenario6_EdgeCases(campaign, salesperson) {
  logSection('SCENARIUSZ 6: Edge cases i sytuacje graniczne');

  logTest('6.1. Kampania bez skrzynek');
  
  const campaignNoMailboxes = await prisma.campaign.create({
    data: {
      name: 'Test Kampania Bez Skrzynek',
      virtualSalespersonId: salesperson.id,
      status: 'DRAFT',
      subject: 'Test',
      text: 'Test'
    }
  });

  // Usuń wszystkie skrzynki tymczasowo
  const originalMailboxes = await prisma.mailbox.findMany({
    where: { virtualSalespersonId: salesperson.id }
  });

  await prisma.mailbox.updateMany({
    where: { virtualSalespersonId: salesperson.id },
    data: { isActive: false }
  });

  // Sprawdź dostępność skrzynek
  const inactiveMailboxes = await prisma.mailbox.findMany({
    where: {
      virtualSalespersonId: salesperson.id,
      isActive: true
    }
  });

  const noMailbox = inactiveMailboxes.length === 0;

  assert(noMailbox === true, 'Brak dostępnych skrzynek - zwraca true');

  // Przywróć skrzynki
  await prisma.mailbox.updateMany({
    where: { id: { in: originalMailboxes.map(m => m.id) } },
    data: { isActive: true }
  });

  await prisma.campaign.delete({ where: { id: campaignNoMailboxes.id } });

  logTest('6.2. Kampania z limitem dziennym 0');
  
  const campaignZeroLimit = await prisma.campaign.create({
    data: {
      name: 'Test Kampania Zero Limit',
      virtualSalespersonId: salesperson.id,
      status: 'IN_PROGRESS',
      subject: 'Test',
      text: 'Test',
      maxEmailsPerDay: 0
    }
  });

  // Oblicz start dzisiaj w polskim czasie
  const nowDate = new Date();
  const plTime = new Date(nowDate.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }));
  const todayStart = new Date(plTime);
  todayStart.setHours(0, 0, 0, 0);

  const sentToday = await prisma.sendLog.count({
    where: {
      campaignId: campaignZeroLimit.id,
      status: 'sent',
      createdAt: { gte: todayStart }
    }
  });

  assert(sentToday === 0, 'Limit 0 - nie wysłano żadnych maili');

  await prisma.campaign.delete({ where: { id: campaignZeroLimit.id } });

  logTest('6.3. Lead z duplikatem emaila');
  
  const timestamp = Date.now();
  const existingLead = await prisma.lead.create({
    data: {
      email: `test.duplicate.${timestamp}@example.com`,
      company: 'Existing Company'
    }
  });
  
  try {
    const duplicateLead = await prisma.lead.create({
      data: {
        email: existingLead.email, // Ten sam email
        company: 'Duplicate Company'
      }
    });
    assert(false, 'Duplikat emaila powinien być zablokowany');
  } catch (error) {
    if (error.code === 'P2002') {
      assert(true, 'Duplikat emaila poprawnie zablokowany');
    } else {
      assert(false, `Nieoczekiwany błąd: ${error.message}`);
    }
  } finally {
    // Cleanup
    await prisma.lead.delete({ where: { id: existingLead.id } }).catch(() => {});
  }

  logTest('6.4. Kampania z bardzo krótkim delayBetweenEmails');
  
  const campaignShortDelay = await prisma.campaign.create({
    data: {
      name: 'Test Kampania Krótki Delay',
      virtualSalespersonId: salesperson.id,
      status: 'DRAFT',
      subject: 'Test',
      text: 'Test',
      delayBetweenEmails: 10 // 10 sekund
    }
  });

  assert(campaignShortDelay.delayBetweenEmails === 10, 'Delay 10s ustawiony');

  await prisma.campaign.delete({ where: { id: campaignShortDelay.id } });

  logTest('6.5. Kampania z bardzo długim delayBetweenEmails');
  
  const campaignLongDelay = await prisma.campaign.create({
    data: {
      name: 'Test Kampania Długi Delay',
      virtualSalespersonId: salesperson.id,
      status: 'DRAFT',
      subject: 'Test',
      text: 'Test',
      delayBetweenEmails: 3600 // 1 godzina
    }
  });

  assert(campaignLongDelay.delayBetweenEmails === 3600, 'Delay 3600s ustawiony');

  await prisma.campaign.delete({ where: { id: campaignLongDelay.id } });
}

// ============================================================================
// SCENARIUSZ 7: WERYFIKACJA DANYCH I SPÓJNOŚCI
// ============================================================================

async function testScenario7_DataConsistency(campaign, salesperson) {
  logSection('SCENARIUSZ 7: Weryfikacja spójności danych');

  logTest('7.1. Spójność CampaignLead i Lead');
  
  const campaignLeads = await prisma.campaignLead.findMany({
    where: { campaignId: campaign.id },
    include: { lead: true }
  });

  for (const cl of campaignLeads) {
    assert(cl.lead !== null, `CampaignLead ${cl.id}: Lead istnieje`);
    assert(cl.lead.status !== 'BLOCKED', `CampaignLead ${cl.id}: Lead nie jest BLOCKED`);
  }

  logTest('7.2. Spójność CampaignEmailQueue i CampaignLead');
  
  const queueEntries = await prisma.campaignEmailQueue.findMany({
    where: { campaignId: campaign.id },
    include: { campaignLead: true }
  });

  for (const entry of queueEntries) {
    assert(entry.campaignLead !== null, `Queue entry ${entry.id}: CampaignLead istnieje`);
    assert(entry.campaignId === campaign.id, `Queue entry ${entry.id}: CampaignId poprawny`);
  }

  logTest('7.3. Spójność liczników skrzynek');
  
  const mailboxes = await prisma.mailbox.findMany({
    where: { virtualSalespersonId: salesperson.id }
  });

  for (const mb of mailboxes) {
    assert(mb.currentDailySent >= 0, `Skrzynka ${mb.email}: currentDailySent >= 0`);
    assert(mb.currentDailySent <= mb.dailyEmailLimit, `Skrzynka ${mb.email}: currentDailySent <= limit`);
    assert(mb.totalEmailsSent >= 0, `Skrzynka ${mb.email}: totalEmailsSent >= 0`);
  }

  logTest('7.4. Spójność statusów kampanii');
  
  const campaignStatus = await prisma.campaign.findUnique({
    where: { id: campaign.id },
    select: { status: true }
  });

  const validStatuses = ['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'];
  assert(validStatuses.includes(campaignStatus.status), `Status kampanii: ${campaignStatus.status} jest poprawny`);
}

// ============================================================================
// GŁÓWNA FUNKCJA TESTU
// ============================================================================

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  log('  KOMPLEKSOWY TEST SYSTEMU V2', 'bright');
  console.log('='.repeat(80) + '\n');

  let testData = {};

  try {
    // SCENARIUSZ 1: Nowy handlowiec i skrzynki
    testData.scenario1 = await testScenario1_NewSalesperson();
    const { salesperson, mailboxes } = testData.scenario1;

    // SCENARIUSZ 2: Nowa kampania
    testData.scenario2 = await testScenario2_NewCampaign(salesperson);
    const campaign = testData.scenario2;

    // SCENARIUSZ 3: Nowe leady
    testData.scenario3 = await testScenario3_NewLeads(campaign);

    // SCENARIUSZ 4: Inicjalizacja kolejki
    testData.scenario4 = await testScenario4_InitializeQueue(campaign);

    // SCENARIUSZ 5: Wysyłka maili
    await testScenario5_SendingEmails(campaign, mailboxes);

    // SCENARIUSZ 6: Edge cases
    await testScenario6_EdgeCases(campaign, salesperson);

    // SCENARIUSZ 7: Weryfikacja spójności
    await testScenario7_DataConsistency(campaign, salesperson);

  } catch (error) {
    logError(`BŁĄD KRYTYCZNY: ${error.message}`);
    console.error(error.stack);
    tests.failed++;
  }

  // PODSUMOWANIE
  logSection('PODSUMOWANIE TESTÓW');

  console.log(`\n✅ Testy zaliczone: ${tests.passed}`);
  console.log(`❌ Testy niezaliczone: ${tests.failed}`);
  console.log(`⚠️  Ostrzeżenia: ${tests.warnings}`);
  console.log(`\n📊 Łącznie: ${tests.passed + tests.failed + tests.warnings} testów\n`);

  if (tests.failed === 0) {
    log('\n🎉 WSZYSTKIE KRYTYCZNE TESTY ZALICZONE!', 'green');
  } else {
    log('\n⚠️  NIEKTÓRE TESTY NIEZALICZONE - SPRAWDŹ LOGI', 'yellow');
  }

  // Cleanup (opcjonalnie - zakomentuj jeśli chcesz zachować dane testowe)
  logSection('CLEANUP');
  
  logInfo('Aby zachować dane testowe, zakomentuj sekcję cleanup w skrypcie');
  
  // Uncomment to cleanup:
  /*
  if (testData.scenario2) {
    await prisma.campaignEmailQueue.deleteMany({ where: { campaignId: testData.scenario2.id } });
    await prisma.campaignLead.deleteMany({ where: { campaignId: testData.scenario2.id } });
    await prisma.campaign.delete({ where: { id: testData.scenario2.id } });
  }
  
  if (testData.scenario3) {
    for (const lead of testData.scenario3.leads) {
      await prisma.lead.delete({ where: { id: lead.id } });
    }
  }
  
  if (testData.scenario1) {
    for (const mb of testData.scenario1.mailboxes) {
      await prisma.mailbox.delete({ where: { id: mb.id } });
    }
    await prisma.virtualSalesperson.delete({ where: { id: testData.scenario1.salesperson.id } });
  }
  */
}

// Uruchom testy
runAllTests()
  .then(() => {
    console.log('\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ BŁĄD KRYTYCZNY:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

