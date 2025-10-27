"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PerformanceWeek {
  week: number;
  warmup: number;
  campaign: number;
}

export default function PerformanceSettingsPage() {
  const [weeks, setWeeks] = useState<PerformanceWeek[]>([
    { week: 1, warmup: 15, campaign: 10 },
    { week: 2, warmup: 20, campaign: 15 },
    { week: 3, warmup: 25, campaign: 20 },
    { week: 4, warmup: 35, campaign: 30 },
    { week: 5, warmup: 40, campaign: 40 }
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        if (data.warmupPerformanceSettings) {
          const parsed = JSON.parse(data.warmupPerformanceSettings);
          setWeeks(parsed);
        }
      }
    } catch (error) {
      console.error("Błąd pobierania ustawień:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/performance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks })
      });

      if (response.ok) {
        alert("Ustawienia wydajności zapisane pomyślnie!");
      } else {
        alert("Błąd zapisywania ustawień");
      }
    } catch (error) {
      alert("Błąd zapisywania ustawień");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWeekChange = (weekNum: number, field: 'warmup' | 'campaign', value: number) => {
    setWeeks(weeks.map(w => 
      w.week === weekNum ? { ...w, [field]: value } : w
    ));
  };

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <h1>⚡ Ustawienia wydajności skrzynek</h1>

      <div style={{ marginBottom: 20 }}>
        <Link href="/settings">← Wróć do ustawień</Link>
      </div>

      <div style={{ backgroundColor: "#f8f9fa", padding: 20, borderRadius: 8, marginBottom: 20 }}>
        
        {weeks.map((week, index) => (
          <div key={week.week} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: index < weeks.length - 1 ? "1px solid #ddd" : "none" }}>
            <h3>📅 Tydzień {week.week} (Dni {(week.week - 1) * 7 + 1}-{week.week * 7})</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
                  Maile warmup dziennie:
                </label>
                <input
                  type="number"
                  value={week.warmup}
                  onChange={(e) => handleWeekChange(week.week, 'warmup', parseInt(e.target.value) || 0)}
                  min="0"
                  style={{
                    width: "100%",
                    padding: 12,
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    fontSize: "16px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
                  Maile kampanii dziennie:
                </label>
                <input
                  type="number"
                  value={week.campaign}
                  onChange={(e) => handleWeekChange(week.week, 'campaign', parseInt(e.target.value) || 0)}
                  min="0"
                  style={{
                    width: "100%",
                    padding: 12,
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    fontSize: "16px"
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        <div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "12px 24px",
              backgroundColor: isSaving ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: isSaving ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "bold"
            }}
          >
            {isSaving ? "Zapisuję..." : "💾 Zapisz ustawienia wydajności"}
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: "#e8f4fd", padding: 16, borderRadius: 8 }}>
        <h3>ℹ️ Jak to działa?</h3>
        <ul>
          <li><strong>Maile warmup</strong> - liczba maili przeznaczona na rozgrzewanie skrzynki (między naszymi skrzynkami)</li>
          <li><strong>Maile kampanii</strong> - liczba maili z kampanii które skrzynka może wysłać w danym tygodniu warmup</li>
          <li><strong>Tydzień 1</strong> - użyj jeśli skrzynka NIE ma włączonego warmup</li>
          <li><strong>Limity globalne</strong> - te same limity dla WSZYSTKICH skrzynek</li>
          <li><strong>System wybiera najmniejszy limit</strong> - skrzynka będzie mogła wysłać tyle maili ile wynosi NAJNIŻSZY z trzech limitów (dailyEmailLimit, warmupDailyLimit, campaignLimit)</li>
        </ul>
      </div>
    </main>
  );
}

