"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface QueueItem {
  id: number;
  name: string;
  status: string;
  queuePriority: number;
  scheduledAt: string | null;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  leadsCount: number;
  sentCount: number;
  percentage: number;
  salesperson: {
    id: number;
    name: string;
    dailyEmailLimit: number;
    currentDailySent: number;
  } | null;
}

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const response = await fetch("/api/queue");
      if (response.ok) {
        const data = await response.json();
        setQueue(data);
      }
    } catch (error) {
      console.error("Błąd pobierania kolejki:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
      DRAFT: { color: "#666", bg: "#f0f0f0", label: "Szkic", emoji: "📝" },
      SCHEDULED: { color: "#0066cc", bg: "#e3f2fd", label: "Zaplanowana", emoji: "🔵" },
      IN_PROGRESS: { color: "#ff9800", bg: "#fff3e0", label: "Wysyła się", emoji: "🟡" },
      COMPLETED: { color: "#4caf50", bg: "#e8f5e9", label: "Zakończona", emoji: "🟢" },
      CANCELLED: { color: "#f44336", bg: "#ffebee", label: "Anulowana", emoji: "🔴" },
      PAUSED: { color: "#9c27b0", bg: "#f3e5f5", label: "Wstrzymana", emoji: "⏸️" }
    };

    const badge = badges[status] || badges.DRAFT;

    return (
      <span style={{
        padding: "4px 12px",
        borderRadius: 16,
        fontSize: 12,
        fontWeight: "bold",
        color: badge.color,
        backgroundColor: badge.bg,
        display: "inline-flex",
        alignItems: "center",
        gap: 4
      }}>
        {badge.emoji} {badge.label}
      </span>
    );
  };

  if (isLoading) {
    return <main><h1>Ładowanie kolejki...</h1></main>;
  }

  // Grupuj po handlowcach
  const groupedBySalesperson: Record<string, QueueItem[]> = {};
  
  queue.forEach(item => {
    const key = item.salesperson ? `${item.salesperson.id}` : "no-salesperson";
    if (!groupedBySalesperson[key]) {
      groupedBySalesperson[key] = [];
    }
    groupedBySalesperson[key].push(item);
  });

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <h1>📊 Kolejka Kampanii</h1>
      <p>
        <Link href="/">← Wróć do strony głównej</Link>
      </p>

      <div style={{ marginBottom: 20, padding: 16, backgroundColor: "#e3f2fd", borderRadius: 8 }}>
        <h3 style={{ margin: "0 0 8px 0" }}>ℹ️ Jak działa kolejka?</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Każdy handlowiec ma swoją kolejkę kampanii</li>
          <li>Kampanie wysyłane są po kolei (według priorytetu)</li>
          <li>System automatycznie zaczyna następną kampanię po zakończeniu poprzedniej</li>
          <li>Uwzględniane są limity dzienne, godziny pracy i święta</li>
        </ul>
      </div>

      {Object.entries(groupedBySalesperson).map(([salespersonKey, campaigns]) => {
        const salesperson = campaigns[0].salesperson;
        
        return (
          <div key={salespersonKey} style={{ marginBottom: 32, padding: 20, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "2px solid #ddd" }}>
              <h2 style={{ margin: "0 0 8px 0" }}>
                {salesperson ? `👤 ${salesperson.name}` : "⚠️ Bez handlowca"}
              </h2>
              {salesperson && (
                <div style={{ display: "flex", gap: 24, fontSize: 14, color: "#666" }}>
                  <span>
                    📧 Limit dzienny: <strong>{salesperson.dailyEmailLimit}</strong>
                  </span>
                  <span>
                    ✓ Wysłano dzisiaj: <strong>{salesperson.currentDailySent}</strong>
                  </span>
                  <span>
                    🔋 Pozostało: <strong>{salesperson.dailyEmailLimit - salesperson.currentDailySent}</strong>
                  </span>
                </div>
              )}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#fff" }}>
                  <th style={{ padding: 10, textAlign: "left", border: "1px solid #ddd" }}>#</th>
                  <th style={{ padding: 10, textAlign: "left", border: "1px solid #ddd" }}>Kampania</th>
                  <th style={{ padding: 10, textAlign: "left", border: "1px solid #ddd" }}>Status</th>
                  <th style={{ padding: 10, textAlign: "left", border: "1px solid #ddd" }}>Postęp</th>
                  <th style={{ padding: 10, textAlign: "left", border: "1px solid #ddd" }}>Leadów</th>
                  <th style={{ padding: 10, textAlign: "left", border: "1px solid #ddd" }}>Zaplanowane</th>
                  <th style={{ padding: 10, textAlign: "left", border: "1px solid #ddd" }}>Start</th>
                  <th style={{ padding: 10, textAlign: "left", border: "1px solid #ddd" }}>Koniec</th>
                  <th style={{ padding: 10, textAlign: "left", border: "1px solid #ddd" }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign, index) => (
                  <tr key={campaign.id} style={{ backgroundColor: campaign.status === "IN_PROGRESS" ? "#fff3e0" : "white" }}>
                    <td style={{ padding: 10, border: "1px solid #ddd", fontWeight: "bold" }}>
                      {campaign.queuePriority}
                    </td>
                    <td style={{ padding: 10, border: "1px solid #ddd" }}>
                      <Link href={`/campaigns/${campaign.id}`} style={{ color: "#0066cc", fontWeight: "bold" }}>
                        {campaign.name}
                      </Link>
                    </td>
                    <td style={{ padding: 10, border: "1px solid #ddd" }}>
                      {getStatusBadge(campaign.status)}
                    </td>
                    <td style={{ padding: 10, border: "1px solid #ddd" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ 
                          width: 120, 
                          height: 10, 
                          backgroundColor: "#e0e0e0", 
                          borderRadius: 5,
                          overflow: "hidden"
                        }}>
                          <div style={{ 
                            width: `${campaign.percentage}%`, 
                            height: "100%", 
                            backgroundColor: campaign.percentage === 100 ? "#4caf50" : "#0066cc",
                            transition: "width 0.3s ease"
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#666", minWidth: 70 }}>
                          {campaign.sentCount}/{campaign.leadsCount} ({campaign.percentage}%)
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: 10, border: "1px solid #ddd" }}>
                      {campaign.leadsCount}
                    </td>
                    <td style={{ padding: 10, border: "1px solid #ddd", fontSize: 13 }}>
                      {campaign.scheduledAt 
                        ? new Date(campaign.scheduledAt).toLocaleString("pl-PL")
                        : "-"
                      }
                    </td>
                    <td style={{ padding: 10, border: "1px solid #ddd", fontSize: 13 }}>
                      {campaign.estimatedStartDate 
                        ? new Date(campaign.estimatedStartDate).toLocaleDateString("pl-PL")
                        : "-"
                      }
                    </td>
                    <td style={{ padding: 10, border: "1px solid #ddd", fontSize: 13 }}>
                      {campaign.estimatedEndDate 
                        ? new Date(campaign.estimatedEndDate).toLocaleDateString("pl-PL")
                        : "-"
                      }
                    </td>
                    <td style={{ padding: 10, border: "1px solid #ddd" }}>
                      <Link href={`/campaigns/${campaign.id}`}>
                        <button style={{
                          padding: "6px 12px",
                          backgroundColor: "#0066cc",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12
                        }}>
                          Szczegóły
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {queue.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", backgroundColor: "#f8f9fa", borderRadius: 8 }}>
          <p style={{ margin: 0, color: "#666" }}>Brak kampanii w kolejce</p>
        </div>
      )}
    </main>
  );
}

