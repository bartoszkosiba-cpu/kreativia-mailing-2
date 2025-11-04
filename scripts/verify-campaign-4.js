const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCampaign4() {
  try {
    // 1. Pobierz kampanię 4
    const campaign = await prisma.campaign.findUnique({
      where: { id: 4 },
      include: {
        virtualSalesperson: {
          include: {
            mailboxes: {
              where: { isActive: true },
              orderBy: [{ priority: 'asc' }, { lastUsedAt: 'asc' }]
            }
          }
        },
        CampaignLead: {
          where: { status: { in: ['queued', 'sent'] } },
          take: 5
        }
      }
    });

    if (!campaign) {
      console.log('❌ Kampania 4 nie istnieje');
      return;
    }

    console.log('=== KAMPANIA 4 - WERYFIKACJA ===\n');
    console.log('📋 PODSTAWOWE DANE:');
    console.log('  ID:', campaign.id);
    console.log('  Nazwa:', campaign.name);
    console.log('  Status:', campaign.status);
    console.log('  Jest follow-up:', campaign.isFollowUp);
    console.log('  Data utworzenia:', campaign.createdAt);
    console.log('  Data aktualizacji:', campaign.updatedAt);
    
    // 2. Sprawdź V2 queue
    const queueCount = await prisma.campaignEmailQueue.count({
      where: { campaignId: 4 }
    });
    console.log('\n📦 V2 QUEUE:');
    console.log('  Wierszy w kolejce:', queueCount);
    
    if (queueCount > 0) {
      const queueStatus = await prisma.campaignEmailQueue.groupBy({
        by: ['status'],
        where: { campaignId: 4 },
        _count: { id: true }
      });
      console.log('  Statusy:', JSON.stringify(queueStatus, null, 2));
      
      // Pobierz przykładowe wiersze
      const sampleQueue = await prisma.campaignEmailQueue.findMany({
        where: { campaignId: 4 },
        take: 5,
        include: {
          campaignLead: {
            include: {
              lead: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        },
        orderBy: { scheduledAt: 'asc' }
      });
      console.log('\n  Przykładowe wiersze (pierwsze 5):');
      sampleQueue.forEach((q, i) => {
        console.log(`    ${i + 1}. Status: ${q.status}, Scheduled: ${q.scheduledAt}, Lead: ${q.campaignLead?.lead?.email || 'N/A'}`);
      });
    }
    
    // 3. Sprawdź handlowca
    console.log('\n👤 HANDLOWIEC:');
    if (campaign.virtualSalesperson) {
      console.log('  ID:', campaign.virtualSalesperson.id);
      console.log('  Nazwa:', campaign.virtualSalesperson.name);
      console.log('  Email:', campaign.virtualSalesperson.email);
      console.log('  Język:', campaign.virtualSalesperson.language);
      console.log('  Aktywne skrzynki:', campaign.virtualSalesperson.mailboxes.length);
      
      if (campaign.virtualSalesperson.mailboxes.length > 0) {
        console.log('\n  📧 Szczegóły skrzynek:');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (const mailbox of campaign.virtualSalesperson.mailboxes) {
          const sentToday = await prisma.sendLog.count({
            where: {
              mailboxId: mailbox.id,
              createdAt: {
                gte: today
              }
            }
          });
          console.log('    -', mailbox.email);
          console.log('      Limit dzienny:', mailbox.dailyEmailLimit || 'BRAK (undefined)');
          console.log('      Wysłano dziś:', sentToday);
          console.log('      Dostępne dziś:', mailbox.dailyEmailLimit ? Math.max(0, mailbox.dailyEmailLimit - sentToday) : 'N/A');
          console.log('      Priority:', mailbox.priority);
          console.log('      Last used:', mailbox.lastUsedAt);
          console.log('      Is active:', mailbox.isActive);
        }
      } else {
        console.log('  ⚠️  BRAK AKTYWNYCH SKRZYNEK!');
      }
    } else {
      console.log('  ❌ BRAK HANDLOWCA!');
    }
    
    // 4. Sprawdź leadów
    const totalLeads = await prisma.campaignLead.count({
      where: { campaignId: 4 }
    });
    const queuedLeads = await prisma.campaignLead.count({
      where: { campaignId: 4, status: 'queued' }
    });
    const sentLeads = await prisma.campaignLead.count({
      where: { campaignId: 4, status: 'sent' }
    });
    const plannedLeads = await prisma.campaignLead.count({
      where: { campaignId: 4, status: 'planned' }
    });
    console.log('\n👥 LEADY:');
    console.log('  Wszystkich:', totalLeads);
    console.log('  W kolejce (queued):', queuedLeads);
    console.log('  Zaplanowanych (planned):', plannedLeads);
    console.log('  Wysłanych (sent):', sentLeads);
    
    // 5. Sprawdź harmonogram
    console.log('\n📅 HARMONOGRAM:');
    console.log('  Dozwolone dni:', campaign.allowedDays || 'BRAK');
    console.log('  Godziny:', campaign.startHour + ':' + String(campaign.startMinute).padStart(2, '0') + ' - ' + campaign.endHour + ':' + String(campaign.endMinute).padStart(2, '0'));
    console.log('  Opóźnienie między emailami:', campaign.delayBetweenEmails, 'sekund');
    console.log('  Max emaili dziennie:', campaign.maxEmailsPerDay);
    
    // 6. Sprawdź treść
    console.log('\n📝 TREŚĆ:');
    console.log('  Temat:', campaign.subject || 'BRAK');
    console.log('  Treść emaila:', campaign.text ? campaign.text.substring(0, 50) + '...' : 'BRAK');
    
    // 7. Sprawdź czy kampania jest zablokowana przez inne kampanie (mailbox lock)
    const mailboxIds = campaign.virtualSalesperson?.mailboxes.map(m => m.id) || [];
    let activeCampaigns = [];
    if (mailboxIds.length > 0) {
      activeCampaigns = await prisma.campaign.findMany({
        where: {
          status: 'IN_PROGRESS',
          id: { not: 4 },
          virtualSalesperson: {
            mailboxes: {
              some: {
                id: { in: mailboxIds }
              }
            }
          }
        },
        select: { id: true, name: true }
      });
    }
    
    console.log('\n🔒 BLOKADY SKRZYNEK:');
    if (activeCampaigns.length > 0) {
      console.log('  ⚠️  Te kampanie używają tych samych skrzynek:');
      activeCampaigns.forEach(c => console.log('    - Kampania', c.id + ':', c.name));
    } else {
      console.log('  ✅ Brak konfliktów - skrzynki dostępne');
    }
    
    // 8. Sprawdź wysłane emaile z tej kampanii
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sentToday = await prisma.sendLog.count({
      where: {
        campaignId: 4,
        status: 'sent',
        createdAt: { gte: today }
      }
    });
    console.log('\n📧 WYSŁANE DZISIAJ:');
    console.log('  Liczba:', sentToday);
    
    // 9. Podsumowanie gotowości
    console.log('\n✅ GOTOWOŚĆ DO WYSYŁKI:');
    const issues = [];
    if (campaign.status !== 'IN_PROGRESS') issues.push('Status nie jest IN_PROGRESS (aktualny: ' + campaign.status + ')');
    if (!campaign.virtualSalesperson) issues.push('Brak handlowca');
    if (!campaign.virtualSalesperson?.mailboxes || campaign.virtualSalesperson.mailboxes.length === 0) issues.push('Brak aktywnych skrzynek');
    if (!campaign.subject) issues.push('Brak tematu');
    if (!campaign.text) issues.push('Brak treści');
    if (queuedLeads === 0 && sentLeads === 0 && plannedLeads === 0) issues.push('Brak leadów do wysyłki');
    if (!campaign.allowedDays) issues.push('Brak harmonogramu (allowedDays)');
    if (queueCount === 0 && campaign.status === 'IN_PROGRESS') issues.push('V2 queue jest pusta (potrzebna inicjalizacja)');
    
    // Sprawdź czy wszystkie skrzynki mają limit > 0
    if (campaign.virtualSalesperson?.mailboxes) {
      const mailboxesWithoutLimit = campaign.virtualSalesperson.mailboxes.filter(m => !m.dailyEmailLimit || m.dailyEmailLimit === 0);
      if (mailboxesWithoutLimit.length > 0) {
        issues.push(`${mailboxesWithoutLimit.length} skrzynek ma limit dzienny = 0 lub undefined`);
      }
    }
    
    if (issues.length === 0) {
      console.log('  ✅ Kampania jest gotowa do wysyłki!');
    } else {
      console.log('  ❌ Problemy:');
      issues.forEach(issue => console.log('    -', issue));
    }
    
    // 10. Sprawdź czy kampania używa V2 (czy ma wiersze w CampaignEmailQueue)
    console.log('\n🔍 UŻYWA V2?');
    if (queueCount > 0) {
      console.log('  ✅ TAK - kampania ma wiersze w CampaignEmailQueue');
    } else {
      console.log('  ⚠️  NIE - kampania nie ma wierszy w CampaignEmailQueue');
      if (campaign.status === 'IN_PROGRESS') {
        console.log('  ⚠️  Kampania jest IN_PROGRESS, ale kolejka jest pusta - potrzebna inicjalizacja');
      }
    }
    
  } catch (error) {
    console.error('Błąd:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkCampaign4();

