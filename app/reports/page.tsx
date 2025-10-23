"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DailyReport {
  date: string;
  salespeople: Array<{
    salespersonId: number;
    salespersonName: string;
    dailyLimit: number;
    sentToday: number;
    remaining: number;
    repliesToday: number;
    interestedToday: number;
    activeCampaigns: number;
  }>;
  totalSent: number;
  totalReplies: number;
  totalInterested: number;
  replyRate: number;
  interestRate: number;
}

export default function ReportsPage() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [selectedDate]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/daily?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error("Błąd pobierania raportu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendReportEmail = async () => {
    if (!confirm("Wysłać raport na email?")) return;
    
    try {
      const response = await fetch(`/api/reports/send?date=${selectedDate}`, {
        method: "POST"
      });
      
      if (response.ok) {
        alert("✅ Raport wysłany!");
      } else {
        alert("❌ Błąd wysyłki raportu");
      }
    } catch (error) {
      alert("❌ Błąd wysyłki raportu");
    }
  };

  if (isLoading) {
    return <main><h1>Ładowanie raportu...</h1></main>;
  }

  if (!report) {
    return <main><h1>Brak danych</h1></main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <h1>📊 Raport dzienny</h1>
      <p>
        <Link href="/">← Wróć do strony głównej</Link>
      </p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "center" }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
            📅 Wybierz datę:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
          />
        </div>
        
        <button
          onClick={sendReportEmail}
          style={{
            marginTop: 24,
            padding: "10px 20px",
            backgroundColor: "#4caf50",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer"
          }}
        >
          📧 Wyślij raport emailem
        </button>
      </div>

      {/* Podsumowanie */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
        gap: 16, 
        marginBottom: 24 
      }}>
        <SummaryCard title="Wysłane" value={report.totalSent} color="#4caf50" icon="📧" />
        <SummaryCard 
          title="Odpowiedzi" 
          value={report.totalReplies} 
          color="#2196f3" 
          icon="💬"
          subtitle={`${report.replyRate}% wskaźnik`}
        />
        <SummaryCard 
          title="Zainteresowani" 
          value={report.totalInterested} 
          color="#ff9800" 
          icon="😊"
          subtitle={`${report.interestRate}% konwersja`}
        />
      </div>

      {/* Per handlowiec */}
      <h2>👥 Statystyki handlowców</h2>
      
      {report.salespeople.map(sp => (
        <div 
          key={sp.salespersonId} 
          style={{ 
            marginBottom: 16, 
            padding: 20, 
            backgroundColor: "#f8f9fa", 
            borderRadius: 8 
          }}
        >
          <h3 style={{ marginTop: 0 }}>{sp.salespersonName}</h3>
          
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
            gap: 12 
          }}>
            <StatBox label="Wysłane" value={`${sp.sentToday} / ${sp.dailyLimit}`} />
            <StatBox label="Pozostało" value={sp.remaining} />
            <StatBox label="Odpowiedzi" value={sp.repliesToday} />
            <StatBox label="Zainteresowani" value={sp.interestedToday} />
            <StatBox label="Aktywne kampanie" value={sp.activeCampaigns} />
          </div>
          
          {/* Pasek postępu */}
          <div style={{ marginTop: 12 }}>
            <div style={{ 
              height: 8, 
              backgroundColor: "#e0e0e0", 
              borderRadius: 4,
              overflow: "hidden"
            }}>
              <div style={{ 
                height: "100%", 
                width: `${Math.min(100, (sp.sentToday / sp.dailyLimit) * 100)}%`,
                backgroundColor: sp.sentToday >= sp.dailyLimit ? "#f44336" : "#4caf50",
                transition: "width 0.3s"
              }} />
            </div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
              {Math.round((sp.sentToday / sp.dailyLimit) * 100)}% dziennego limitu
            </div>
          </div>
        </div>
      ))}

      {report.salespeople.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", backgroundColor: "#f8f9fa", borderRadius: 8 }}>
          <p style={{ margin: 0, color: "#666" }}>Brak aktywności w tym dniu</p>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ 
  title, 
  value, 
  color, 
  icon, 
  subtitle 
}: { 
  title: string; 
  value: number; 
  color: string; 
  icon: string;
  subtitle?: string;
}) {
  return (
    <div style={{ 
      padding: 20, 
      backgroundColor: "white", 
      borderRadius: 8,
      border: `2px solid ${color}`,
      textAlign: "center"
    }}>
      <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>{icon} {title}</div>
      <div style={{ fontSize: 36, fontWeight: "bold", color }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ 
      padding: 12, 
      backgroundColor: "white", 
      borderRadius: 4,
      border: "1px solid #ddd"
    }}>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}

