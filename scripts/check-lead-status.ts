import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma;

async function checkLeadStatus() {
  const leadEmail = "hello@mint2print.pl";
  
  // Znajdź leada
  const lead = await db.lead.findFirst({
    where: {
      email: leadEmail
    },
    include: {
      CampaignLead: {
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
              scheduledAt: true,
              allowedDays: true,
              startHour: true,
              startMinute: true,
              endHour: true,
              endMinute: true,
              delayBetweenEmails: true,
              maxEmailsPerDay: true
            }
          }
        }
      }
    }
  });

  if (!lead) {
    console.log(`❌ Nie znaleziono leada: ${leadEmail}`);
    await db.$disconnect();
    return;
  }

  console.log(`\n✅ Lead: ${lead.email}`);
  console.log(`   Imię: ${lead.firstName || 'brak'}`);
  console.log(`   Nazwisko: ${lead.lastName || 'brak'}`);
  console.log(`   Firma: ${lead.company || 'brak'}`);
  console.log(`   Status: ${lead.status}`);
  console.log(`   Zablokowany: ${lead.isBlocked ? 'TAK' : 'NIE'}\n`);

  // Sprawdź kampanie
  const campaigns = lead.CampaignLead.map(cl => cl.campaign);
  
  if (campaigns.length === 0) {
    console.log(`❌ Lead nie jest przypisany do żadnej kampanii`);
    await db.$disconnect();
    return;
  }

  console.log(`📧 Kampanie (${campaigns.length}):\n`);
  
  for (const campaign of campaigns) {
    console.log(`\n📋 Kampania: ${campaign.name} (ID: ${campaign.id})`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Zaplanowana na: ${campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString('pl-PL') : 'Brak'}`);
    console.log(`   Okno czasowe: ${campaign.startHour || 0}:${String(campaign.startMinute || 0).padStart(2, '0')} - ${campaign.endHour || 0}:${String(campaign.endMinute || 0).padStart(2, '0')}`);
    console.log(`   Dni wysyłki: ${campaign.allowedDays || 'Brak'}`);
    console.log(`   Delay między mailami: ${campaign.delayBetweenEmails || 0}s`);
    console.log(`   Max maili/dzień: ${campaign.maxEmailsPerDay || 0}\n`);

    // Sprawdź czy mail został wysłany
    const sendLog = await db.sendLog.findFirst({
      where: {
        campaignId: campaign.id,
        leadId: lead.id,
        status: 'sent'
      },
      include: {
        mailbox: {
          select: {
            email: true,
            displayName: true
          }
        }
      }
    });

    if (sendLog) {
      console.log(`   ✅ Mail WYSŁANY:`);
      console.log(`      Data: ${sendLog.createdAt.toLocaleString('pl-PL')}`);
      console.log(`      Skrzynka: ${sendLog.mailbox?.email || 'Brak'}`);
      console.log(`      Temat: ${sendLog.subject || 'Brak'}`);
    } else {
      // Sprawdź czy jest w kolejce
      const queued = await db.sendLog.findFirst({
        where: {
          campaignId: campaign.id,
          leadId: lead.id,
          status: 'queued'
        }
      });

      if (queued) {
        console.log(`   ⏳ Mail W KOLEJCE (queued)`);
        console.log(`      Data utworzenia: ${queued.createdAt.toLocaleString('pl-PL')}`);
      } else {
        console.log(`   ⏸️  Mail NIE WYSŁANY - oczekuje na wysyłkę`);
        
        // Sprawdź kiedy może zostać wysłany
        if (campaign.status === 'SCHEDULED' && campaign.scheduledAt) {
          const scheduledDate = new Date(campaign.scheduledAt);
          console.log(`      📅 Zaplanowana wysyłka: ${scheduledDate.toLocaleString('pl-PL')}`);
        } else if (campaign.status === 'IN_PROGRESS') {
          console.log(`      🚀 Kampania w trakcie - mail zostanie wysłany:`);
          console.log(`         - W oknie czasowym: ${campaign.startHour || 0}:${String(campaign.startMinute || 0).padStart(2, '0')} - ${campaign.endHour || 0}:${String(campaign.endMinute || 0).padStart(2, '0')}`);
          console.log(`         - W dozwolonych dniach: ${campaign.allowedDays || 'Wszystkie'}`);
          console.log(`         - Z uwzględnieniem limitu dziennego: ${campaign.maxEmailsPerDay || 'Brak limitu'}`);
          
          // Sprawdź kiedy będzie następne okno czasowe
          const now = new Date();
          const today = new Date();
          today.setHours(campaign.startHour || 9, campaign.startMinute || 0, 0, 0);
          
          if (now < today) {
            console.log(`         - Dzisiaj o ${today.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`);
          } else {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            console.log(`         - Jutro o ${tomorrow.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`);
          }
        } else if (campaign.status === 'PAUSED') {
          console.log(`      ⏸️  Kampania WSTRZYMANA - mail nie zostanie wysłany dopóki kampania nie zostanie wznowiona`);
        } else if (campaign.status === 'COMPLETED') {
          console.log(`      ✅ Kampania ZAKOŃCZONA - mail nie zostanie już wysłany`);
        }
      }
    }

    // Sprawdź błędy
    const errors = await db.sendLog.findMany({
      where: {
        campaignId: campaign.id,
        leadId: lead.id,
        status: 'error'
      }
    });

    if (errors.length > 0) {
      console.log(`\n   ⚠️  Błędy wysyłki (${errors.length}):`);
      errors.forEach(err => {
        console.log(`      - ${err.createdAt.toLocaleString('pl-PL')}: ${err.error || 'Nieznany błąd'}`);
      });
    }
  }

  await db.$disconnect();
}

checkLeadStatus().catch(console.error);

