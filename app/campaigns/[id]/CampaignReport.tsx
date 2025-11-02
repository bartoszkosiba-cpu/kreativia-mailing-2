"use client";

import { useState, useEffect } from "react";
import ClassificationButtons from "./ClassificationButtons";

interface Stats {
  campaignId: number;
  campaignName: string;
  totalLeads: number;
  totalSent: number;
  totalErrors: number;
  sentPercentage: number;
  totalReplies: number;
  replyRate: number;
  interested: number;
  notInterested: number;
  unsubscribe: number;
  outOfOffice: number;
  redirect: number;
  bounce: number;
  other: number;
  newLeadsCreated: number;
  contactsBlocked: number;
  repliesForwarded: number;
  startDate: string | null;
  endDate: string | null;
  lastActivity: string | null;
}

export default function CampaignReport({ campaignId }: { campaignId: number }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [campaignId]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Błąd pobierania statystyk:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: 20 }}>Ładowanie statystyk...</div>;
  }

  if (!stats) {
    return <div style={{ padding: 20 }}>Brak danych statystycznych</div>;
  }

  return (
    <div style={{ marginBottom: 20, padding: 20, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
      <h2>Raport kampanii</h2>

      {/* Podstawowe statystyki */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard
          title="Wysłane"
          value={stats.totalSent}
          total={stats.totalLeads}
          color="#4caf50"
        />
        <StatCard
          title="Odpowiedzi"
          value={stats.totalReplies}
          total={stats.totalSent}
          color="#2196f3"
          subtitle={`${stats.replyRate}% wskaźnik odpowiedzi`}
        />
        <StatCard
          title="Zainteresowani"
          value={stats.interested}
          total={stats.totalReplies}
          color="#ff9800"
        />
        <StatCard
          title="Błędy"
          value={stats.totalErrors}
          total={stats.totalLeads}
          color="#f44336"
        />
      </div>

      {/* Klasyfikacja odpowiedzi */}
      <ClassificationButtons 
        stats={{
          interested: stats.interested,
          notInterested: stats.notInterested || 0,
          unsubscribe: stats.unsubscribe,
          outOfOffice: stats.outOfOffice,
          redirect: stats.redirect || 0,
          bounce: stats.bounce,
          other: stats.other
        }}
        campaignId={campaignId}
        onFilterChange={(filter) => {
          setActiveFilter(filter);
          if (filter) {
            // Mapuj klucze na wartości z bazy danych
            const filterMap: { [key: string]: string } = {
              'interested': 'INTERESTED',
              'notInterested': 'NOT_INTERESTED', 
              'unsubscribe': 'UNSUBSCRIBE',
              'outOfOffice': 'OOO',
              'redirect': 'REDIRECT',
              'bounce': 'BOUNCE',
              'other': 'OTHER'
            };
            const dbFilter = filterMap[filter] || filter;
            
            // Przekieruj do inboxa z filtrem
            const inboxUrl = `/campaigns/${campaignId}/inbox?filter=${dbFilter}`;
            window.open(inboxUrl, '_blank');
          }
        }}
      />

      {/* Akcje automatyczne */}
      <div style={{ marginBottom: 24, padding: 16, backgroundColor: "white", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Akcje automatyczne</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#4caf50" }}>{stats.newLeadsCreated}</div>
            <div style={{ fontSize: 14, color: "#666" }}>Nowe leady</div>
            <div style={{ fontSize: 12, color: "#999" }}>Z zainteresowanych odpowiedzi</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#2196f3" }}>{stats.repliesForwarded}</div>
            <div style={{ fontSize: 14, color: "#666" }}>Przekazane</div>
            <div style={{ fontSize: 12, color: "#999" }}>Wysłane na Twój email</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#f44336" }}>{stats.contactsBlocked}</div>
            <div style={{ fontSize: 14, color: "#666" }}>Zablokowani</div>
            <div style={{ fontSize: 12, color: "#999" }}>Unsubscribe + bounce</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {stats.startDate && (
        <div style={{ padding: 16, backgroundColor: "white", borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Timeline</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Rozpoczęcie</div>
              <div style={{ fontSize: 14, fontWeight: "bold" }}>
                {new Date(stats.startDate).toLocaleString("pl-PL")}
              </div>
            </div>
            {stats.endDate && (
              <div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Zakończenie</div>
                <div style={{ fontSize: 14, fontWeight: "bold" }}>
                  {new Date(stats.endDate).toLocaleString("pl-PL")}
                </div>
              </div>
            )}
            {stats.lastActivity && (
              <div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Ostatnia aktywność</div>
                <div style={{ fontSize: 14, fontWeight: "bold" }}>
                  {new Date(stats.lastActivity).toLocaleString("pl-PL")}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refresh button */}
      <button
        onClick={fetchStats}
        style={{
          marginTop: 16,
          padding: "8px 16px",
          backgroundColor: "#0066cc",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 14
        }}
      >
        Odśwież statystyki
      </button>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  total, 
  color, 
  icon = "", 
  subtitle 
}: { 
  title: string; 
  value: number; 
  total?: number; 
  color: string; 
  icon?: string;
  subtitle?: string;
}) {
  const percentage = total && total > 0 ? Math.round((value / total) * 100) : 0;
  
  return (
    <div style={{ 
      padding: 16, 
      backgroundColor: "white", 
      borderRadius: 8,
      border: `2px solid ${color}`
    }}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{icon ? `${icon} ` : ""}{title}</div>
      <div style={{ fontSize: 32, fontWeight: "bold", color }}>
        {value}
        {total && total > 0 && (
          <span style={{ fontSize: 16, color: "#999", marginLeft: 8 }}>/ {total}</span>
        )}
      </div>
      {total && total > 0 && (
        <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
          {percentage}%
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{subtitle}</div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ 
      padding: "8px 12px", 
      backgroundColor: color + "20",
      border: `1px solid ${color}`,
      borderRadius: 4,
      textAlign: "center"
    }}>
      <div style={{ fontSize: 20, fontWeight: "bold", color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
    </div>
  );
}

