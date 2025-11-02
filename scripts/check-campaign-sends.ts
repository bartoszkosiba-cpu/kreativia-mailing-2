import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma;

async function checkCampaignSends() {
  const campaignName = "Podwieszenia targowe PL - 30.10.25";
  
  // Znajdź kampanię
  const campaign = await db.campaign.findFirst({
    where: {
      name: {
        contains: campaignName
      }
    },
    select: {
      id: true,
      name: true,
      status: true
    }
  });

  if (!campaign) {
    console.log(`❌ Nie znaleziono kampanii: ${campaignName}`);
    return;
  }

  // Filtruj wysyłki od 19:50 (użytkownik chce sprawdzić od tej godziny)
  const filterFromDate = new Date('2025-10-31T19:50:00');
  
  console.log(`\n✅ Znaleziono kampanię: ${campaign.name} (ID: ${campaign.id}, Status: ${campaign.status})`);
  console.log(`📅 Filtruję wysyłki od: ${filterFromDate.toLocaleString('pl-PL')}\n`);
  
  // Pobierz wszystkie wysyłki
  const sendLogs = await db.sendLog.findMany({
    where: {
      campaignId: campaign.id,
      createdAt: {
        gte: filterFromDate
      }
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      subject: true,
      toEmail: true,
      lead: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true
        }
      },
      mailbox: {
        select: {
          id: true,
          email: true,
          displayName: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  console.log(`📊 Statystyki:`);
  console.log(`   - Wszystkich wysyłek: ${sendLogs.length}`);
  console.log(`   - Wysłanych: ${sendLogs.filter(s => s.status === 'sent').length}`);
  console.log(`   - Błędy: ${sendLogs.filter(s => s.status === 'error').length}`);
  console.log(`   - W kolejce: ${sendLogs.filter(s => s.status === 'queued').length}`);
  console.log(`   - Testowe: ${sendLogs.filter(s => !s.lead).length}\n`);

  // Grupowanie po skrzynkach
  const mailboxStats = sendLogs.reduce((acc: any, log) => {
    if (log.mailbox) {
      const key = log.mailbox.email;
      if (!acc[key]) {
        acc[key] = {
          email: log.mailbox.email,
          displayName: log.mailbox.displayName,
          sent: 0,
          failed: 0,
          logs: []
        };
      }
      if (log.status === 'sent') acc[key].sent++;
      if (log.status === 'error') acc[key].failed++;
      acc[key].logs.push(log);
    }
    return acc;
  }, {});

  console.log(`📮 Wysyłki według skrzynek:\n`);
  Object.values(mailboxStats).forEach((mb: any) => {
    console.log(`   📧 ${mb.email}${mb.displayName ? ` (${mb.displayName})` : ''}`);
    console.log(`      - Wysłano: ${mb.sent}, Błędy: ${mb.failed}`);
  });

  console.log(`\n📋 Szczegółowa lista wysyłek:\n`);
  console.log(`┌─────────────────────────────────────────────────────────────────────────────────────────────┐`);
  console.log(`│ Data                 │ Status  │ Skrzynka                          │ Do kogo                │`);
  console.log(`├─────────────────────────────────────────────────────────────────────────────────────────────┤`);
  
  sendLogs.forEach((log) => {
    const date = log.createdAt.toLocaleString('pl-PL');
    const status = log.status.padEnd(7);
    const mailbox = log.mailbox 
      ? `${log.mailbox.email.substring(0, 30)}${log.mailbox.email.length > 30 ? '...' : ''}`.padEnd(33)
      : 'BRAK'.padEnd(33);
    
    let recipient = '';
    if (log.lead) {
      recipient = `${log.lead.email}`;
      if (log.lead.firstName || log.lead.lastName) {
        recipient += ` (${(log.lead.firstName || '')} ${(log.lead.lastName || '')})`.trim();
      }
    } else if (log.toEmail) {
      recipient = `${log.toEmail} [TEST]`;
    } else {
      recipient = 'BRAK ODBIORCY';
    }
    recipient = recipient.substring(0, 25).padEnd(25);
    
    console.log(`│ ${date.padEnd(19)} │ ${status} │ ${mailbox} │ ${recipient} │`);
  });
  
  console.log(`└─────────────────────────────────────────────────────────────────────────────────────────────┘\n`);

  // Pokaż tylko wysłane (nie testowe)
  const realSends = sendLogs.filter(s => s.status === 'sent' && s.lead);
  console.log(`\n✅ Prawdziwe wysyłki (bez testowych): ${realSends.length}\n`);
  if (realSends.length > 0) {
    realSends.forEach((log, idx) => {
      const lead = log.lead!;
      const mailbox = log.mailbox!;
      console.log(`${idx + 1}. ${lead.email} (${lead.firstName || ''} ${lead.lastName || ''})`.trim());
      console.log(`   📧 Skrzynka: ${mailbox.email}${mailbox.displayName ? ` (${mailbox.displayName})` : ''}`);
      console.log(`   📅 Data: ${log.createdAt.toLocaleString('pl-PL')}`);
      console.log(`   📄 Temat: ${log.subject || 'Brak tematu'}\n`);
    });
  }

  await db.$disconnect();
}

checkCampaignSends().catch(console.error);

