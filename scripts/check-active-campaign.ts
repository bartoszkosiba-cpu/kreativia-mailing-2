/**
 * Sprawdza status aktywnej kampanii - tylko do odczytu
 */
import { db } from "../src/lib/db";

async function checkActiveCampaign() {
  try {
    // Znajdź kampanię "Podwieszenia targowe PL - 03.11.25"
    const allCampaigns = await db.campaign.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'IN_PROGRESS']
        }
      },
      include: {
        virtualSalesperson: {
          select: {
            name: true,
            language: true,
            dailyEmailLimit: true,
            currentDailySent: true
          }
        },
        CampaignLead: {
          include: {
            lead: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
                status: true
              }
            }
          },
          orderBy: {
            id: 'asc'
          }
        },
        sendLogs: {
          where: {
            status: 'sent'
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5 // Najnowsze 5 kampanii
    });

    // Znajdź kampanię z "Podwieszenia" w nazwie
    const campaign = allCampaigns.find(c => 
      c.name.toLowerCase().includes('podwieszenia') || 
      c.name.toLowerCase().includes('03.11.25')
    ) || allCampaigns[0]; // Lub najnowszą aktywną

    if (!campaign) {
      console.log("❌ Nie znaleziono aktywnej kampanii");
      return;
    }

    if (!campaign) {
      console.log("❌ Nie znaleziono kampanii");
      return;
    }

    console.log("\n" + "=".repeat(80));
    console.log(`📧 KAMPANIA: ${campaign.name}`);
    console.log("=".repeat(80));
    console.log(`ID: ${campaign.id}`);
    console.log(`Status: ${campaign.status}`);
    console.log(`Handlowiec: ${campaign.virtualSalesperson?.name || 'Brak'}`);
    console.log(`Język: ${campaign.virtualSalesperson?.language || 'pl'}`);
    console.log(`Limit dzienny: ${campaign.virtualSalesperson?.dailyEmailLimit || 0}`);
    console.log(`Wysłano dzisiaj (handlowiec): ${campaign.virtualSalesperson?.currentDailySent || 0}`);
    
    // Harmonogram
    console.log("\n📅 HARMONOGRAM:");
    console.log(`  Zaplanowana data: ${campaign.scheduledAt?.toLocaleString('pl-PL') || 'Brak'}`);
    console.log(`  Start: ${campaign.startHour || 9}:${String(campaign.startMinute || 0).padStart(2, '0')}`);
    console.log(`  Koniec: ${campaign.endHour || 17}:${String(campaign.endMinute || 0).padStart(2, '0')}`);
    console.log(`  Opóźnienie między mailami: ${campaign.delayBetweenEmails || 60} sekund`);
    console.log(`  Max dziennie: ${campaign.maxEmailsPerDay || 50}`);
    console.log(`  Dni tygodnia: ${campaign.allowedDays || 'Wszystkie'}`);

    // Statystyki CampaignLead
    const totalLeads = campaign.CampaignLead.length;
    const planned = campaign.CampaignLead.filter(cl => cl.status === 'planned').length;
    const queued = campaign.CampaignLead.filter(cl => cl.status === 'queued').length;
    const sent = campaign.CampaignLead.filter(cl => cl.status === 'sent').length;
    const failed = campaign.CampaignLead.filter(cl => cl.status === 'failed').length;

    console.log("\n📊 STATYSTYKI LEADÓW:");
    console.log(`  Wszystkich leadów: ${totalLeads}`);
    console.log(`  ✅ Wysłano (status=sent): ${sent}`);
    console.log(`  ⏳ W kolejce (status=queued): ${queued}`);
    console.log(`  📝 Zaplanowanych (status=planned): ${planned}`);
    console.log(`  ❌ Błędy (status=failed): ${failed}`);

    // Wysłane maile (SendLog)
    const sentLogs = campaign.sendLogs;
    console.log(`\n📬 WYSŁANE MAILE (SendLog - ostatnie 10):`);
    console.log(`  Wszystkich wysłanych: ${sentLogs.length}`);
    
    if (sentLogs.length > 0) {
      console.log("\n  Ostatnie wysyłki:");
      sentLogs.forEach((log, index) => {
        const leadEmail = campaign.CampaignLead.find(cl => cl.leadId === log.leadId)?.lead?.email || 'Nieznany';
        const timeAgo = Math.round((Date.now() - log.createdAt.getTime()) / 1000 / 60);
        console.log(`    ${index + 1}. ${leadEmail} - ${timeAgo} min temu (${log.createdAt.toLocaleTimeString('pl-PL')})`);
      });
    }

    // Następne leady w kolejce
    const nextQueued = campaign.CampaignLead
      .filter(cl => cl.status === 'queued')
      .slice(0, 5);

    if (nextQueued.length > 0) {
      console.log("\n⏭️  NASTĘPNE W KOLEJCE (top 5):");
      nextQueued.forEach((cl, index) => {
        const lead = cl.lead;
        console.log(`    ${index + 1}. ${lead.email} (${lead.firstName || ''} ${lead.lastName || ''}) - status: ${lead.status}`);
      });
    }

    // Leady które jeszcze nie zostały wysłane
    const notSent = campaign.CampaignLead.filter(cl => cl.status !== 'sent');
    if (notSent.length > 0) {
      console.log(`\n📋 POZOSTAŁO DO WYSŁANIA: ${notSent.length} leadów`);
    }

    // Sprawdź czy cron działa
    console.log("\n⏰ SPRAWDŹ CRON:");
    console.log("  Cron powinien uruchamiać się co minutę (sprawdź logi serwera)");
    console.log("  Następna wysyłka powinna nastąpić za około ~60 sekund (delayBetweenEmails)");

    console.log("\n" + "=".repeat(80));
    console.log("✅ SPRAWDZENIE ZAKOŃCZONE - tylko odczyt, brak zmian w bazie");
    console.log("=".repeat(80) + "\n");

  } catch (error: any) {
    console.error("❌ Błąd:", error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

checkActiveCampaign();

