"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HotLeadsWidget } from "@/components/HotLeadsList";

interface ActiveCampaign {
  id: number;
  name: string;
  status: string;
  scheduledAt: string | null;
  sendingStartedAt: string | null;
  virtualSalesperson: {
    name: string;
  } | null;
  _count: {
    CampaignLead: number;
    sendLogs: number;
  };
}

interface DashboardStats {
  activeCampaigns: number;
  activeCampaignsList: ActiveCampaign[];
  totalLeads: number;
  sentToday: number;
  repliesToday: number;
  interestedToday: number;
}

export default function HomePage() {
  const [cronStatus, setCronStatus] = useState<{ running: boolean; interval: string } | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    // Uruchom cron przy pierwszym ładowaniu strony
    fetch("/api/cron/status", { method: "POST" })
      .then(() => fetch("/api/cron/status"))
      .then((res) => res.json())
      .then((data) => setCronStatus(data))
      .catch((err) => console.error("Błąd pobierania statusu crona:", err));

    // Pobierz statystyki dashboardu
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error("Błąd pobierania statystyk:", err));
  }, []);

  return (
    <div className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--spacing-2xl)" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "var(--spacing-sm)" }}>
          Witaj w Kreativia Mailing! 👋
        </h1>
        <p style={{ fontSize: "1.1rem", color: "var(--gray-600)" }}>
          Profesjonalny system do zarządzania kampaniami email B2B
        </p>
      </div>

      {/* Status crona */}
      {cronStatus && (
        <div className={cronStatus.running ? "alert alert-success" : "alert alert-error"} style={{ marginBottom: "var(--spacing-xl)" }}>
          <strong>🤖 Automatyzacja:</strong>{" "}
          {cronStatus.running ? (
            <>✓ Działa ({cronStatus.interval} - email, kampanie, święta, raporty)</>
          ) : (
            <>✗ Zatrzymana</>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-4" style={{ marginBottom: "var(--spacing-2xl)" }}>
          <StatCard icon="📊" label="Aktywne kampanie" value={stats.activeCampaigns} color="var(--primary)" />
          <StatCard icon="👥" label="Leady w bazie" value={stats.totalLeads} color="var(--info)" />
          <StatCard icon="📧" label="Wysłane dzisiaj" value={stats.sentToday} color="var(--success)" />
          <StatCard icon="💬" label="Odpowiedzi dzisiaj" value={stats.repliesToday} color="var(--warning)" />
        </div>
      )}

      {/* Hot Leads Widget */}
      <div style={{ marginBottom: "var(--spacing-2xl)" }}>
        <HotLeadsWidget />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-3" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <ActionCard
          href="/campaigns/new"
          icon="➕"
          title="Nowa kampania"
          description="Utwórz i zaplanuj nową kampanię email"
          color="var(--success)"
        />
        <ActionCard
          href="/queue"
          icon="📋"
          title="Kolejka wysyłek"
          description="Zobacz harmonogram i zaplanowane kampanie"
          color="var(--primary)"
        />
        <ActionCard
          href="/inbox"
          icon="📬"
          title="Skrzynka odbiorcza"
          description="Odpowiedzi i automatyczna klasyfikacja AI"
          color="var(--warning)"
        />
      </div>

      {/* Live View - Aktywne kampanie */}
      {stats && stats.activeCampaignsList && stats.activeCampaignsList.length > 0 && (
        <div className="card" style={{ marginBottom: "var(--spacing-2xl)" }}>
          <h2 style={{ marginBottom: "var(--spacing-lg)" }}>🔴 Live - Aktywne kampanie</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
            {stats.activeCampaignsList.map((campaign) => {
              const total = campaign._count.CampaignLead;
              const sent = campaign._count.sendLogs;
              const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;
              
              return (
                <Link 
                  key={campaign.id} 
                  href={`/campaigns/${campaign.id}`}
                  style={{ 
                    textDecoration: "none", 
                    color: "inherit",
                    display: "block",
                    padding: "var(--spacing-md)",
                    border: "1px solid var(--gray-200)",
                    borderRadius: "8px",
                    transition: "all 0.2s ease",
                    backgroundColor: campaign.status === "IN_PROGRESS" ? "var(--warning-light)" : "white"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--gray-200)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-sm)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
                      <span style={{ fontSize: "1.2rem" }}>
                        {campaign.status === "IN_PROGRESS" ? "🟡" : "🔵"}
                      </span>
                      <strong style={{ fontSize: "1.1rem" }}>{campaign.name}</strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-md)" }}>
                      {campaign.virtualSalesperson && (
                        <span style={{ fontSize: "0.9rem", color: "var(--gray-600)" }}>
                          👤 {campaign.virtualSalesperson.name}
                        </span>
                      )}
                      <span style={{ 
                        fontSize: "0.85rem", 
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor: campaign.status === "IN_PROGRESS" ? "var(--warning)" : "var(--info)",
                        color: "white",
                        fontWeight: "600"
                      }}>
                        {campaign.status === "IN_PROGRESS" ? "Wysyła się" : "Zaplanowana"}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-md)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        width: "100%", 
                        height: "12px", 
                        backgroundColor: "var(--gray-200)", 
                        borderRadius: "6px",
                        overflow: "hidden"
                      }}>
                        <div style={{ 
                          width: `${percentage}%`, 
                          height: "100%", 
                          backgroundColor: percentage === 100 ? "var(--success)" : "var(--primary)",
                          transition: "width 0.5s ease"
                        }} />
                      </div>
                    </div>
                    <span style={{ fontSize: "0.9rem", color: "var(--gray-600)", minWidth: "80px", textAlign: "right" }}>
                      {sent}/{total} ({percentage}%)
                    </span>
                  </div>
                  
                  {campaign.scheduledAt && (
                    <div style={{ marginTop: "var(--spacing-xs)", fontSize: "0.85rem", color: "var(--gray-500)" }}>
                      📅 {new Date(campaign.scheduledAt).toLocaleString('pl-PL')}
                      {campaign.sendingStartedAt && (
                        <> • ▶️ Rozpoczęto: {new Date(campaign.sendingStartedAt).toLocaleString('pl-PL')}</>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
          <div style={{ marginTop: "var(--spacing-md)", textAlign: "center" }}>
            <Link href="/queue" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
              Zobacz wszystkie w kolejce →
            </Link>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <div className="card">
        <h2>🧭 Nawigacja</h2>
        <div className="grid grid-3">
          <NavLink href="/campaigns" icon="📊" label="Kampanie" desc="Zarządzaj kampaniami" />
          <NavLink href="/queue" icon="📋" label="Kolejka" desc="Harmonogram wysyłek" />
          <NavLink href="/reports" icon="📈" label="Raporty" desc="Statystyki i analizy" />
          <NavLink href="/inbox" icon="📬" label="Inbox" desc="Odpowiedzi email" />
          <NavLink href="/leads" icon="👥" label="Leady" desc="Baza kontaktów" />
          <NavLink href="/salespeople" icon="👤" label="Handlowcy" desc="Wirtualni handlowcy" />
          <NavLink href="/tags" icon="🏷️" label="Tagi" desc="Zarządzanie tagami" />
          <NavLink href="/import" icon="📥" label="Import" desc="Import CSV" />
          <NavLink href="/settings" icon="⚙️" label="Ustawienia" desc="Konfiguracja" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="card" style={{
      textAlign: "center",
      borderTop: `4px solid ${color}`,
      padding: "var(--spacing-lg)"
    }}>
      <div style={{ fontSize: "2rem", marginBottom: "var(--spacing-sm)" }}>{icon}</div>
      <div style={{ fontSize: "2rem", fontWeight: "700", color, marginBottom: "var(--spacing-xs)" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.875rem", color: "var(--gray-600)" }}>{label}</div>
    </div>
  );
}

function ActionCard({ href, icon, title, description, color }: { 
  href: string; 
  icon: string; 
  title: string; 
  description: string;
  color: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div className="card" style={{
        borderLeft: `4px solid ${color}`,
        transition: "var(--transition)",
        cursor: "pointer",
        height: "100%"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "var(--shadow-lg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow)";
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "var(--spacing-sm)" }}>{icon}</div>
        <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>{title}</h3>
        <p style={{ fontSize: "0.875rem", color: "var(--gray-600)", margin: 0 }}>{description}</p>
      </div>
    </Link>
  );
}

function NavLink({ href, icon, label, desc }: { href: string; icon: string; label: string; desc: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{
        padding: "var(--spacing-md)",
        borderRadius: "var(--radius)",
        transition: "var(--transition)",
        cursor: "pointer",
        border: "1px solid var(--gray-200)"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--gray-50)";
        e.currentTarget.style.borderColor = "var(--primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "var(--gray-200)";
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", marginBottom: "var(--spacing-xs)" }}>
          <span style={{ fontSize: "1.25rem" }}>{icon}</span>
          <span style={{ fontWeight: "600", color: "var(--gray-900)" }}>{label}</span>
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--gray-600)" }}>{desc}</div>
      </div>
    </Link>
  );
}


