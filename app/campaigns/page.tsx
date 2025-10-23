import { db } from "@/lib/db";
import CampaignsList from "./CampaignsList";
import Link from "next/link";

// Funkcja do obliczania progresu (tylko aktywne leady)
async function getCampaignProgress(campaignId: number) {
  const total = await db.campaignLead.count({
    where: { 
      campaignId,
      lead: {
        status: {
          not: "BLOCKED" // Licz tylko aktywne leady
        }
      }
    }
  });
  
  const sent = await db.sendLog.count({
    where: {
      campaignId,
      status: "sent"
    }
  });
  
  return { sent, total, percentage: total > 0 ? Math.round((sent / total) * 100) : 0 };
}

export default async function CampaignsPage() {
  // Pobierz wszystkie kampanie z informacją o follow-upach
  const campaigns = await db.campaign.findMany({ 
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      scheduledAt: true,
      sendingStartedAt: true,
      sendingCompletedAt: true,
      parentCampaignId: true,
      followUpSequence: true
    }
  });
  
  // Pobierz progress dla każdej kampanii
  const progressData = await Promise.all(
    campaigns.map(c => getCampaignProgress(c.id))
  );

  // Konwertuj daty na stringi dla client component
  const campaignsForClient = campaigns.map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    scheduledAt: c.scheduledAt ? c.scheduledAt.toISOString() : null,
    sendingStartedAt: c.sendingStartedAt ? c.sendingStartedAt.toISOString() : null,
    sendingCompletedAt: c.sendingCompletedAt ? c.sendingCompletedAt.toISOString() : null
  }));

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div className="flex-between" style={{ marginBottom: "var(--spacing-lg)" }}>
        <div>
          <h1>Kampanie</h1>
          <p style={{ color: "var(--gray-600)" }}>
            Wszystkie kampanie ({campaigns.length} rekordów)
          </p>
        </div>
        <div className="flex gap-sm">
          <Link 
            href="/campaigns/new" 
            className="btn btn-success"
          >
            ➕ Nowa kampania
          </Link>
        </div>
      </div>
      <CampaignsList 
        initialCampaigns={campaignsForClient}
        initialProgress={progressData}
      />
    </main>
  );
}

