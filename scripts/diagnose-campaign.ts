/**
 * SKRYPT DIAGNOSTYCZNY - Diagnozuje problemy z wysyłką kampanii
 * 
 * Użycie:
 * npx tsx scripts/diagnose-campaign.ts 4
 */

import { db } from '../src/lib/db';

async function diagnoseCampaign(campaignId: number) {
  console.log(`\n🔍 DIAGNOZA KAMPANII #${campaignId}\n`);
  console.log('='.repeat(60));

  try {
    // 1. Pobierz kampanię
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!campaign) {
      console.log(`❌ Kampania #${campaignId} nie istnieje!`);
      return;
    }

    console.log(`\n📋 PODSTAWOWE INFORMACJE:`);
    console.log(`   Nazwa: ${campaign.name}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   Handlowiec: ${campaign.virtualSalesperson?.name || 'BRAK'}`);
    console.log(`   ScheduledAt: ${campaign.scheduledAt || 'BRAK'}`);

    // 2. Sprawdź leady
    const campaignLeads = await db.campaignLead.findMany({
      where: { campaignId },
      include: {
        lead: {
          select: {
            id: true,
            email: true,
            status: true,
            isBlocked: true
          }
        }
      }
    });

    const leadsByStatus = campaignLeads.reduce((acc, cl) => {
      const status = cl.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(cl);
      return acc;
    }, {} as Record<string, typeof campaignLeads>);

    console.log(`\n📊 LEADY W KAMPANII:`);
    console.log(`   Łącznie: ${campaignLeads.length}`);
    Object.entries(leadsByStatus).forEach(([status, leads]) => {
      console.log(`   - ${status}: ${leads.length}`);
    });

    // 3. Sprawdź leady zablokowane
    const blockedLeads = campaignLeads.filter(
      cl => cl.lead.status === 'BLOCKED' || cl.lead.isBlocked
    );
    if (blockedLeads.length > 0) {
      console.log(`   ⚠️  Zablokowane leady: ${blockedLeads.length}`);
    }

    // 4. Sprawdź kolejkę CampaignEmailQueue
    const queueItems = await db.campaignEmailQueue.findMany({
      where: { campaignId },
      orderBy: { scheduledAt: 'asc' }
    });

    const queueByStatus = queueItems.reduce((acc, item) => {
      const status = item.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(item);
      return acc;
    }, {} as Record<string, typeof queueItems>);

    console.log(`\n📬 KOLEJKA CAMPAIGNEMAILQUEUE:`);
    console.log(`   Łącznie: ${queueItems.length}`);
    Object.entries(queueByStatus).forEach(([status, items]) => {
      console.log(`   - ${status}: ${items.length}`);
    });

    if (queueItems.length > 0) {
      const nextPending = queueItems.find(q => q.status === 'pending');
      if (nextPending) {
        const now = new Date();
        const scheduledAt = new Date(nextPending.scheduledAt);
        const diff = Math.floor((scheduledAt.getTime() - now.getTime()) / 1000);
        console.log(`   ⏰ Najbliższy mail: ${scheduledAt.toISOString()}`);
        if (diff > 0) {
          console.log(`   ⏱️  Za ${Math.floor(diff / 60)} minut (${diff} sekund)`);
        } else {
          console.log(`   ✅ Powinien być wysłany już (${Math.abs(diff)} sekund w przeszłości)`);
        }
      }
    }

    // 5. Sprawdź SendLog
    const sendLogs = await db.sendLog.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`\n📧 OSTATNIE WYSŁANE MAILE:`);
    if (sendLogs.length === 0) {
      console.log(`   ❌ Brak wysłanych maili!`);
    } else {
      sendLogs.forEach((log, i) => {
        const time = new Date(log.createdAt);
        const ago = Math.floor((Date.now() - time.getTime()) / 1000 / 60);
        console.log(`   ${i + 1}. ${log.status} - ${time.toISOString()} (${ago} min temu)`);
      });
    }

    // 6. Sprawdź czy są leady gotowe do wysłania
    const readyLeads = await db.campaignLead.findMany({
      where: {
        campaignId,
        status: { in: ['queued', 'planned'] },
        lead: {
          status: { not: 'BLOCKED' },
          isBlocked: false
        }
      },
      include: {
        lead: true,
        campaignEmailQueue: {
          where: {
            status: { in: ['pending', 'sending'] }
          }
        }
      }
    });

    console.log(`\n✅ LEADY GOTOWE DO WYSŁANIA:`);
    console.log(`   Łącznie: ${readyLeads.length}`);
    const withoutQueue = readyLeads.filter(cl => cl.campaignEmailQueue.length === 0);
    console.log(`   ⚠️  Bez wpisu w kolejce: ${withoutQueue.length}`);

    if (withoutQueue.length > 0 && campaign.status === 'IN_PROGRESS') {
      console.log(`\n🔧 PROBLEM: Kampania jest IN_PROGRESS, ale ${withoutQueue.length} leadów nie ma wpisów w kolejce!`);
      console.log(`   → Rozwiązanie: Wywołaj POST /api/campaigns/${campaignId}/reinit-queue`);
    }

    // 7. Sprawdź ustawienia kampanii
    console.log(`\n⚙️  USTAWIENIA KAMPANII:`);
    console.log(`   Delay między mailami: ${campaign.delayBetweenEmails}s`);
    console.log(`   Max maili/dzień: ${campaign.maxEmailsPerDay}`);
    console.log(`   Okno czasowe: ${campaign.startHour}:${campaign.startMinute || '00'} - ${campaign.endHour}:${campaign.endMinute || '00'}`);
    console.log(`   Dozwolone dni: ${campaign.allowedDays || 'BRAK'}`);

    // 8. Sprawdź czy teraz jest okno czasowe
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const startHour = campaign.startHour || 9;
    const startMinute = campaign.startMinute || 0;
    const endHour = campaign.endHour || 17;
    const endMinute = campaign.endMinute || 0;

    const isInTimeWindow = 
      (currentHour > startHour || (currentHour === startHour && currentMinute >= startMinute)) &&
      (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute));

    console.log(`\n🕐 OKNO CZASOWE:`);
    console.log(`   Teraz: ${currentHour}:${String(currentMinute).padStart(2, '0')}`);
    console.log(`   Okno: ${startHour}:${String(startMinute).padStart(2, '0')} - ${endHour}:${String(endMinute).padStart(2, '0')}`);
    console.log(`   ${isInTimeWindow ? '✅ W oknie czasowym' : '❌ Poza oknem czasowym'}`);

    // 9. PODSUMOWANIE I REKOMENDACJE
    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n💡 REKOMENDACJE:\n`);

    if (campaign.status !== 'IN_PROGRESS') {
      console.log(`   ❌ Kampania nie jest IN_PROGRESS (status: ${campaign.status})`);
      console.log(`   → Uruchom kampanię przez POST /api/campaigns/${campaignId}/start`);
    } else if (queueItems.length === 0 && readyLeads.length > 0) {
      console.log(`   ❌ Kolejka jest pusta, ale są leady gotowe do wysłania`);
      console.log(`   → Wywołaj POST /api/campaigns/${campaignId}/reinit-queue`);
    } else if (queueItems.length > 0) {
      const pendingCount = queueItems.filter(q => q.status === 'pending').length;
      if (pendingCount > 0) {
        console.log(`   ✅ Kolejka działa (${pendingCount} maili pending)`);
        console.log(`   → Sprawdź czy cron działa: [CRON] 📧 Sprawdzam kolejkę kampanii...`);
      } else {
        console.log(`   ⚠️  Kolejka ma wpisy, ale wszystkie są w statusie: ${Object.keys(queueByStatus).join(', ')}`);
      }
    } else if (readyLeads.length === 0) {
      console.log(`   ❌ Brak leadów gotowych do wysłania`);
      console.log(`   → Sprawdź statusy leadów w bazie`);
    }

    if (!isInTimeWindow && campaign.status === 'IN_PROGRESS') {
      console.log(`   ⚠️  Kampania jest IN_PROGRESS, ale jesteśmy poza oknem czasowym`);
      console.log(`   → Maile będą wysyłane gdy wrócimy do okna czasowego`);
    }

    console.log(`\n`);

  } catch (error: any) {
    console.error(`\n❌ BŁĄD: ${error.message}`);
    console.error(error.stack);
  } finally {
    await db.$disconnect();
  }
}

// Pobierz ID kampanii z argumentów
const campaignId = process.argv[2] ? parseInt(process.argv[2]) : null;

if (!campaignId || isNaN(campaignId)) {
  console.error('❌ Użycie: npx tsx scripts/diagnose-campaign.ts <campaignId>');
  console.error('   Przykład: npx tsx scripts/diagnose-campaign.ts 4');
  process.exit(1);
}

diagnoseCampaign(campaignId).catch(console.error);





