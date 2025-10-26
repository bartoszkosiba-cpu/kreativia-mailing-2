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

  // Statystyki
  const stats = {
    total: campaigns.length,
    inProgress: campaigns.filter(c => c.status === "IN_PROGRESS").length,
    completed: campaigns.filter(c => c.status === "COMPLETED").length,
    scheduled: campaigns.filter(c => c.status === "SCHEDULED").length
  };

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: "var(--spacing-2xl)" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "var(--spacing-sm)" }}>
          Kampanie
        </h1>
        <p style={{ fontSize: "1.1rem", color: "var(--gray-600)" }}>
          Zarządzaj kampaniami email - tworzenie, wysyłka i monitoring
        </p>
      </div>

      {/* Statystyki */}
      <div className="grid grid-4" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Wszystkie</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--primary)" }}>
            {stats.total}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Wysyła się</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--warning)" }}>
            {stats.inProgress}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Zakończone</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--success)" }}>
            {stats.completed}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Zaplanowane</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--info)" }}>
            {stats.scheduled}
          </div>
        </div>
      </div>

      {/* Header z przyciskiem */}
      <div className="flex-between" style={{ marginBottom: "var(--spacing-lg)" }}>
        <h2>Lista kampanii</h2>
        <Link 
          href="/campaigns/new" 
          className="btn btn-success"
        >
          Nowa kampania
        </Link>
      </div>

      {/* Lista kampanii w card */}
      <div className="card">
        <CampaignsList 
          initialCampaigns={campaignsForClient}
          initialProgress={progressData}
        />
      </div>
    </main>
  );
}

