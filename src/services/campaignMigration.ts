/**
 * CAMPAIGN MIGRATION - Migracja istniejących kampanii do V2
 * 
 * Funkcjonalności:
 * - Analiza stanu kampanii
 * - Naprawa niespójności statusów
 * - Inicjalizacja kolejki dla istniejącej kampanii
 */

import { db } from "@/lib/db";
import { initializeQueueV2 } from "./campaignEmailQueueV2";

/**
 * Analizuje stan kampanii przed migracją
 */
export interface CampaignState {
  campaignId: number;
  lastSentAt: Date | null;
  sentCount: number;
  pendingCount: number;
  queuedCount: number;
  plannedCount: number;
  sendingCount: number;
  queueCount: number;
}

export async function analyzeCampaignState(
  campaignId: number
): Promise<CampaignState> {
  // Ostatni wysłany mail
  const lastSentLog = await db.sendLog.findFirst({
    where: {
      campaignId,
      status: 'sent'
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Leady które już otrzymały mail
  const sentLeadIds = await db.sendLog.findMany({
    where: {
      campaignId,
      status: 'sent'
    },
    select: { leadId: true }
  }).then(logs => new Set(logs.map(l => l.leadId)));

  // Statystyki CampaignLead
  const campaignLeads = await db.campaignLead.findMany({
    where: { campaignId }
  });

  const statusCounts = campaignLeads.reduce((acc, cl) => {
    acc[cl.status] = (acc[cl.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Liczba maili w kolejce
  const queueCount = await db.campaignEmailQueue.count({
    where: {
      campaignId,
      status: { in: ['pending', 'sending'] }
    }
  });

  return {
    campaignId,
    lastSentAt: lastSentLog?.createdAt || null,
    sentCount: sentLeadIds.size,
    pendingCount: 0, // TODO: jeśli potrzebne
    queuedCount: statusCounts['queued'] || 0,
    plannedCount: statusCounts['planned'] || 0,
    sendingCount: statusCounts['sending'] || 0,
    queueCount
  };
}

/**
 * Naprawia niespójności statusów w kampanii
 */
export async function fixCampaignStatuses(
  campaignId: number
): Promise<{
  fixedSent: number;
  fixedQueued: number;
}> {
  // Leady które mają mail w SendLog
  const sentLeadIds = await db.sendLog.findMany({
    where: {
      campaignId,
      status: 'sent',
      leadId: { not: null }
    },
    select: { leadId: true }
  }).then(logs => new Set(logs.map(l => l.leadId).filter((id): id is number => id !== null)));

  // Napraw: CampaignLead.status != 'sent' ale jest w SendLog
  const sentLeadIdsArray = Array.from(sentLeadIds);
  let fixedSent = { count: 0 };
  
  if (sentLeadIdsArray.length > 0) {
    fixedSent = await db.campaignLead.updateMany({
      where: {
        campaignId,
        leadId: { in: sentLeadIdsArray },
        status: { not: 'sent' }
      },
      data: { status: 'sent' }
    });
  }

  // Napraw: CampaignLead.status = 'sending' ale nie ma maila w SendLog
  let fixedQueued = { count: 0 };
  
  if (sentLeadIdsArray.length > 0) {
    fixedQueued = await db.campaignLead.updateMany({
      where: {
        campaignId,
        status: 'sending',
        lead: {
          id: { notIn: sentLeadIdsArray }
        }
      },
      data: { status: 'queued' }
    });
  } else {
    // Jeśli nie ma żadnych wysłanych maili, wszystkie 'sending' → 'queued'
    fixedQueued = await db.campaignLead.updateMany({
      where: {
        campaignId,
        status: 'sending'
      },
      data: { status: 'queued' }
    });
  }

  if (fixedSent.count > 0 || fixedQueued.count > 0) {
    console.log(`[MIGRATION] ✅ Naprawiono statusy dla kampanii ${campaignId}: ${fixedSent.count} → 'sent', ${fixedQueued.count} → 'queued'`);
  }

  return {
    fixedSent: fixedSent.count,
    fixedQueued: fixedQueued.count
  };
}

/**
 * Pełna migracja kampanii do V2
 */
export async function migrateCampaignToV2(
  campaignId: number,
  bufferSize: number = 20
): Promise<{
  success: boolean;
  state?: CampaignState;
  queueAdded?: number;
  error?: string;
}> {
  try {
    console.log(`[MIGRATION] 🚀 Rozpoczynam migrację kampanii ${campaignId}`);

    // KROK 1: Sprawdź czy kampania istnieje
    const campaignExists = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true }
    });

    if (!campaignExists) {
      return {
        success: false,
        error: `Kampania ${campaignId} nie istnieje`
      };
    }

    // KROK 2: Analiza stanu
    const state = await analyzeCampaignState(campaignId);
    console.log(`[MIGRATION] 📊 Stan kampanii ${campaignId}:`, {
      sent: state.sentCount,
      queued: state.queuedCount,
      planned: state.plannedCount,
      sending: state.sendingCount,
      queue: state.queueCount,
      lastSent: state.lastSentAt?.toISOString() || 'brak'
    });

    // KROK 3: Naprawa statusów
    await fixCampaignStatuses(campaignId);

    // KROK 4: Sprawdź czy już jest kolejka
    if (state.queueCount > 0) {
      console.log(`[MIGRATION] ℹ️  Kampania ${campaignId} już ma ${state.queueCount} maili w kolejce - pomijam inicjalizację`);
      return {
        success: true,
        state,
        queueAdded: 0
      };
    }

    // KROK 5: Sprawdź czy są leady do wysłania
    if (state.queuedCount === 0 && state.plannedCount === 0) {
      console.log(`[MIGRATION] ℹ️  Kampania ${campaignId} nie ma leadów do wysłania (queued: ${state.queuedCount}, planned: ${state.plannedCount})`);
      return {
        success: true,
        state,
        queueAdded: 0
      };
    }

    // KROK 6: Inicjalizacja kolejki
    console.log(`[MIGRATION] 📝 Inicjalizuję kolejkę dla kampanii ${campaignId} (buffer: ${bufferSize})`);
    const queueAdded = await initializeQueueV2(campaignId, bufferSize);

    console.log(`[MIGRATION] ✅ Migracja kampanii ${campaignId} zakończona (dodano ${queueAdded} maili do kolejki)`);

    return {
      success: true,
      state,
      queueAdded
    };
  } catch (error: any) {
    console.error(`[MIGRATION] ❌ Błąd migracji kampanii ${campaignId}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Migracja wszystkich kampanii IN_PROGRESS które nie mają kolejki
 */
export async function migrateAllCampaignsToV2(): Promise<{
  total: number;
  migrated: number;
  errors: number;
}> {
  try {
    const campaigns = await db.campaign.findMany({
      where: {
        status: 'IN_PROGRESS'
      }
    });

    let migrated = 0;
    let errors = 0;

    for (const campaign of campaigns) {
      const result = await migrateCampaignToV2(campaign.id);

      if (result.success && (result.queueAdded || 0) > 0) {
        migrated++;
      } else if (!result.success) {
        errors++;
      }
    }

    console.log(`[MIGRATION] ✅ Migracja wszystkich kampanii: ${migrated} zmigrowano, ${errors} błędów (z ${campaigns.length} total)`);

    return {
      total: campaigns.length,
      migrated,
      errors
    };
  } catch (error: any) {
    console.error(`[MIGRATION] ❌ Błąd migracji wszystkich kampanii:`, error.message);
    return {
      total: 0,
      migrated: 0,
      errors: 1
    };
  }
}

