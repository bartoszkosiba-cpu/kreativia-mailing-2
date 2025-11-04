/**
 * CAMPAIGN EMAIL QUEUE - Zarządzanie kolejką zaplanowanych maili kampanii
 * 
 * Funkcjonalności:
 * - Dodawanie maili do kolejki z precyzyjnym czasem (scheduledAt)
 * - Dynamiczne dodawanie następnych maili po wysłaniu
 * - Cleanup starych rekordów
 */

import { db } from "@/lib/db";

/**
 * Oblicza czas następnego maila na podstawie ostatniego wysłanego
 */
export function calculateNextEmailTime(
  lastSentTime: Date,
  delayBetweenEmails: number
): Date {
  // Delay = delayBetweenEmails ± 20%
  const randomVariation = 0.2;
  const minDelay = Math.floor(delayBetweenEmails * (1 - randomVariation)); // 80%
  const maxDelay = Math.floor(delayBetweenEmails * (1 + randomVariation)); // 120%
  
  // Losowy delay w zakresie [minDelay, maxDelay]
  const actualDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
  // Czas następnego maila
  const nextTime = new Date(lastSentTime.getTime() + (actualDelay * 1000));
  
  return nextTime;
}

/**
 * Dodaje następny mail do kolejki (po wysłaniu poprzedniego)
 */
export async function scheduleNextEmail(
  campaignId: number,
  lastSentTime: Date,
  delayBetweenEmails: number
): Promise<number | null> {
  try {
    // Pobierz następny lead z CampaignLead (status = queued)
    const nextCampaignLead = await db.campaignLead.findFirst({
      where: {
        campaignId,
        status: "queued",
        lead: {
          status: { not: "BLOCKED" },
          isBlocked: false
        }
      },
      include: {
        lead: true
      },
      orderBy: {
        createdAt: "asc" // Najstarszy pierwszy
      }
    });

    if (!nextCampaignLead || !nextCampaignLead.lead) {
      console.log(`[CAMPAIGN QUEUE] ❌ Brak kolejnych leadów dla kampanii ${campaignId}`);
      return null;
    }

    // Oblicz czas następnego maila
    const scheduledAt = calculateNextEmailTime(lastSentTime, delayBetweenEmails);

    // Sprawdź czy już istnieje wpis w kolejce dla tego leada
    const existing = await db.campaignEmailQueue.findFirst({
      where: {
        campaignId,
        campaignLeadId: nextCampaignLead.id,
        status: { in: ["pending", "sending"] }
      }
    });

    if (existing) {
      console.log(`[CAMPAIGN QUEUE] ⚠️ Lead ${nextCampaignLead.lead.email} już jest w kolejce (ID: ${existing.id})`);
      return existing.id;
    }

    // Dodaj do kolejki
    const queueEntry = await db.campaignEmailQueue.create({
      data: {
        campaignId,
        campaignLeadId: nextCampaignLead.id,
        scheduledAt,
        status: "pending",
        metadata: JSON.stringify({
          leadEmail: nextCampaignLead.lead.email,
          leadId: nextCampaignLead.lead.id,
          calculatedDelay: Math.floor((scheduledAt.getTime() - lastSentTime.getTime()) / 1000)
        })
      }
    });

    console.log(`[CAMPAIGN QUEUE] ✅ Zaplanowano mail dla ${nextCampaignLead.lead.email} na ${scheduledAt.toISOString()}`);

    return queueEntry.id;
  } catch (error: any) {
    console.error(`[CAMPAIGN QUEUE] ❌ Błąd dodawania do kolejki:`, error.message);
    return null;
  }
}

/**
 * Inicjalizuje kolejkę dla kampanii - dodaje pierwsze maile (bufor)
 */
export async function initializeCampaignQueue(
  campaignId: number,
  delayBetweenEmails: number,
  bufferSize: number = 10
): Promise<number> {
  try {
    console.log(`[CAMPAIGN QUEUE] 🚀 Inicjalizacja kolejki dla kampanii ${campaignId} (buffer: ${bufferSize})`);

    // Pobierz kampanię
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        virtualSalesperson: true
      }
    });

    if (!campaign) {
      console.error(`[CAMPAIGN QUEUE] ❌ Kampania ${campaignId} nie istnieje`);
      return 0;
    }

    // Pobierz ostatni wysłany mail (jeśli istnieje)
    const lastSentLog = await db.sendLog.findFirst({
      where: {
        campaignId,
        status: "sent"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    // Określ startowy czas
    const now = new Date();
    let currentTime: Date;
    
    if (lastSentLog) {
      const lastSentTime = new Date(lastSentLog.createdAt);
      const timeSinceLastMail = Math.floor((now.getTime() - lastSentTime.getTime()) / 1000); // sekundy
      
      // ✅ Jeśli ostatni mail był wysłany więcej niż 10 minut temu - użyj aktualnego czasu
      // (inaczej maile byłyby zaplanowane w przeszłości)
      if (timeSinceLastMail > 600) { // 10 minut
        console.log(`[CAMPAIGN QUEUE] ⚠️ Ostatni mail był ${Math.floor(timeSinceLastMail / 60)} minut temu - używam aktualnego czasu jako bazy`);
        currentTime = now;
      } else {
        currentTime = lastSentTime;
      }
    } else {
      // Pierwszy mail - użyj aktualnego czasu lub scheduledAt kampanii
      currentTime = campaign.scheduledAt && new Date(campaign.scheduledAt) <= now
        ? now
        : (campaign.scheduledAt ? new Date(campaign.scheduledAt) : now);
    }
    
    // ✅ Upewnij się, że pierwszy mail nie jest w przeszłości
    if (currentTime < now) {
      console.log(`[CAMPAIGN QUEUE] ⚠️ Obliczony czas bazowy jest w przeszłości - używam aktualnego czasu`);
      currentTime = now;
    }

    // ✅ NOWE: Najpierw zmień status "planned" → "queued" (dla spójności)
    await db.campaignLead.updateMany({
      where: {
        campaignId,
        status: "planned",
        lead: {
          status: { not: "BLOCKED" },
          isBlocked: false
        }
      },
      data: {
        status: "queued"
      }
    });

    // Pobierz leady do zaplanowania
    // ✅ UPROSZCZENIE: Pobierz wszystkie queued leady, a potem odfiltruj te które już są w kolejce
    const allCandidateLeads = await db.campaignLead.findMany({
      where: {
        campaignId,
        status: "queued", // ✅ UPROSZCZENIE: Tylko "queued" (już zmienione z "planned")
        lead: {
          status: { not: "BLOCKED" },
          isBlocked: false
        }
      },
      include: {
        lead: true,
        campaignEmailQueue: {
          where: {
            status: { in: ["pending", "sending"] }
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      take: bufferSize * 2 // Pobierz więcej, żeby po filtracji mieć wystarczająco
    });

    // Odfiltruj te które już mają wpisy w kolejce
    const campaignLeads = allCandidateLeads.filter(cl => cl.campaignEmailQueue.length === 0).slice(0, bufferSize);

    if (campaignLeads.length === 0) {
      console.log(`[CAMPAIGN QUEUE] ⚠️ Brak leadów do zaplanowania dla kampanii ${campaignId}`);
      return 0;
    }

    // Dodaj do kolejki z obliczonymi czasami
    let lastTime = currentTime;
    const queueItems = [];

    for (const campaignLead of campaignLeads) {
      if (!campaignLead.lead) continue;

      // Oblicz czas dla tego maila
      const scheduledAt = calculateNextEmailTime(lastTime, delayBetweenEmails);
      lastTime = scheduledAt;

      queueItems.push({
        campaignId,
        campaignLeadId: campaignLead.id,
        scheduledAt,
        status: "pending" as const,
        metadata: JSON.stringify({
          leadEmail: campaignLead.lead.email,
          leadId: campaignLead.lead.id,
          initializedAt: new Date().toISOString()
        })
      });
    }

    // Bulk insert
    if (queueItems.length > 0) {
      await db.campaignEmailQueue.createMany({
        data: queueItems
      });

      console.log(`[CAMPAIGN QUEUE] ✅ Dodano ${queueItems.length} maili do kolejki dla kampanii ${campaignId}`);
    }

    return queueItems.length;
  } catch (error: any) {
    console.error(`[CAMPAIGN QUEUE] ❌ Błąd inicjalizacji kolejki:`, error.message);
    return 0;
  }
}

/**
 * Cleanup - usuwa stare wpisy z kolejki (sent/failed starsze niż 24h)
 */
export async function cleanupCampaignQueue(): Promise<number> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const result = await db.campaignEmailQueue.deleteMany({
      where: {
        status: { in: ["sent", "failed"] },
        sentAt: {
          lt: yesterday
        }
      }
    });

    if (result.count > 0) {
      console.log(`[CAMPAIGN QUEUE] 🗑️  Usunięto ${result.count} starych wpisów z kolejki`);
    }

    return result.count;
  } catch (error: any) {
    console.error(`[CAMPAIGN QUEUE] ❌ Błąd cleanup:`, error.message);
    return 0;
  }
}

/**
 * Anuluje wszystkie pending/sending wpisy dla kampanii (np. przy pauzie)
 */
export async function cancelCampaignQueue(campaignId: number): Promise<number> {
  try {
    const result = await db.campaignEmailQueue.updateMany({
      where: {
        campaignId,
        status: { in: ["pending", "sending"] }
      },
      data: {
        status: "cancelled"
      }
    });

    if (result.count > 0) {
      console.log(`[CAMPAIGN QUEUE] ⏸️  Anulowano ${result.count} wpisów dla kampanii ${campaignId}`);
    }

    return result.count;
  } catch (error: any) {
    console.error(`[CAMPAIGN QUEUE] ❌ Błąd anulowania kolejki:`, error.message);
    return 0;
  }
}

