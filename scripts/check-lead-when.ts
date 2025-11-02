import { PrismaClient } from '@prisma/client';
import { isValidSendTime, findNextAvailableSlot } from '../src/services/campaignScheduler';

const prisma = new PrismaClient();
const db = prisma;

async function checkLeadWhen() {
  const leadEmail = "hello@mint2print.pl";
  
  // Znajdź leada i kampanię
  const lead = await db.lead.findFirst({
    where: { email: leadEmail },
    include: {
      CampaignLead: {
        include: {
          campaign: true
        }
      }
    }
  });

  if (!lead || lead.CampaignLead.length === 0) {
    console.log(`❌ Lead nie znaleziony lub nie przypisany do kampanii`);
    await db.$disconnect();
    return;
  }

  const campaign = lead.CampaignLead[0].campaign;
  const now = new Date();
  
  console.log(`\n📧 Lead: ${leadEmail}`);
  console.log(`📋 Kampania: ${campaign.name} (ID: ${campaign.id})`);
  console.log(`📅 Aktualna data/czas: ${now.toLocaleString('pl-PL')}\n`);

  // Sprawdź czy mail został wysłany
  const sentLog = await db.sendLog.findFirst({
    where: {
      campaignId: campaign.id,
      leadId: lead.id,
      status: 'sent'
    }
  });

  if (sentLog) {
    console.log(`✅ Mail JUŻ WYSŁANY:`);
    console.log(`   Data: ${sentLog.createdAt.toLocaleString('pl-PL')}`);
    await db.$disconnect();
    return;
  }

  // Sprawdź czy jest w kolejce
  const queued = await db.sendLog.findFirst({
    where: {
      campaignId: campaign.id,
      leadId: lead.id,
      status: 'queued'
    }
  });

  if (queued) {
    console.log(`⏳ Mail W KOLEJCE`);
    console.log(`   Utworzony: ${queued.createdAt.toLocaleString('pl-PL')}`);
    await db.$disconnect();
    return;
  }

  console.log(`⏸️  Mail NIE WYSŁANY - oczekuje na wysyłkę\n`);

  // Sprawdź parametry kampanii
  const allowedDays = campaign.allowedDays?.split(',') || [];
  const startHour = campaign.startHour || 9;
  const startMinute = campaign.startMinute || 0;
  const endHour = campaign.endHour || 21;
  const endMinute = campaign.endMinute || 10;
  const respectHolidays = campaign.respectHolidays || false;
  const targetCountries = campaign.targetCountries?.split(',') || [];

  console.log(`⚙️  Ustawienia kampanii:`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Dni wysyłki: ${allowedDays.join(', ')}`);
  console.log(`   Okno czasowe: ${startHour}:${String(startMinute).padStart(2, '0')} - ${endHour}:${String(endMinute).padStart(2, '0')}`);
  console.log(`   Święta: ${respectHolidays ? 'Uwzględniane' : 'Ignorowane'}\n`);

  // Sprawdź czy TERAZ jest dobry moment
  const currentCheck = await isValidSendTime(
    now,
    allowedDays,
    startHour,
    startMinute,
    endHour,
    endMinute,
    respectHolidays,
    targetCountries
  );

  console.log(`🔍 Sprawdzenie aktualnego czasu:`);
  console.log(`   Czy można wysłać TERAZ: ${currentCheck.isValid ? '✅ TAK' : '❌ NIE'}`);
  if (!currentCheck.isValid) {
    console.log(`   Powód: ${currentCheck.reason}\n`);
  }

  // Znajdź następny dostępny slot
  const nextSlot = await findNextAvailableSlot(
    now,
    allowedDays,
    startHour,
    startMinute,
    endHour,
    endMinute,
    respectHolidays,
    targetCountries
  );

  console.log(`📅 NASTĘPNY DOSTĘPNY SLOT:`);
  console.log(`   Data/czas: ${nextSlot.toLocaleString('pl-PL')}`);
  console.log(`   Za ile: ${Math.round((nextSlot.getTime() - now.getTime()) / 1000 / 60)} minut (${Math.round((nextSlot.getTime() - now.getTime()) / 1000 / 60 / 60)} godzin)\n`);

  // Sprawdź inne powody dla których mail może nie być wysłany
  console.log(`🔍 Sprawdzenie innych czynników:\n`);

  // 1. Status kampanii
  if (campaign.status !== 'IN_PROGRESS' && campaign.status !== 'SCHEDULED') {
    console.log(`   ⚠️  Status kampanii: ${campaign.status}`);
    if (campaign.status === 'PAUSED') {
      console.log(`      → Kampania jest wstrzymana - mail nie zostanie wysłany dopóki nie zostanie wznowiona`);
    } else if (campaign.status === 'COMPLETED') {
      console.log(`      → Kampania zakończona - mail nie zostanie już wysłany`);
    }
  } else {
    console.log(`   ✅ Status kampanii: ${campaign.status} - OK`);
  }

  // 2. Czy lead jest zablokowany
  if (lead.isBlocked || lead.status === 'BLOCKED') {
    console.log(`   ⚠️  Lead jest ZABLOKOWANY - mail nie zostanie wysłany`);
  } else {
    console.log(`   ✅ Lead aktywny - OK`);
  }

  // 3. Sprawdź pozycję w kolejce
  const totalLeads = await db.campaignLead.count({
    where: {
      campaignId: campaign.id,
      lead: {
        status: { not: 'BLOCKED' },
        isBlocked: false
      }
    }
  });

  const sentLeads = await db.sendLog.count({
    where: {
      campaignId: campaign.id,
      status: 'sent',
      leadId: { not: null }
    }
  });

  const remainingLeads = totalLeads - sentLeads;

  console.log(`\n   📊 Pozycja w kolejce:`);
  console.log(`      Wszystkich leadów: ${totalLeads}`);
  console.log(`      Wysłanych: ${sentLeads}`);
  console.log(`      Pozostało: ${remainingLeads}`);

  // Sprawdź ile leadów jest przed tym
  const leadsBefore = await db.campaignLead.count({
    where: {
      campaignId: campaign.id,
      priority: { lt: lead.CampaignLead[0].priority || 999 }
    }
  });

  console.log(`      Leadów z wyższym priorytetem: ${leadsBefore}\n`);

  await db.$disconnect();
}

checkLeadWhen().catch(console.error);

