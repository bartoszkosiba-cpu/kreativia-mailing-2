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
      setIsLoading(true);
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        if (data.warmupPerformanceSettings) {
          const parsed = JSON.parse(data.warmupPerformanceSettings);
          // Sortuj według tygodnia i upewnij się że są wszystkie tygodnie
          const sorted = parsed.sort((a: PerformanceWeek, b: PerformanceWeek) => a.week - b.week);
          setWeeks(sorted);
          console.log('[PERFORMANCE] Załadowano ustawienia:', sorted);
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
      console.log('[PERFORMANCE] Zapisuję:', weeks);
      
      // Walidacja przed zapisem
      const validWeeks = weeks.filter(w => w.week >= 1 && w.week <= 5);
      if (validWeeks.length !== 5) {
        alert("Błąd: Musisz mieć ustawione wszystkie 5 tygodni");
        setIsSaving(false);
        return;
      }

      const response = await fetch("/api/settings/performance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks: validWeeks })
      });

      const data = await response.json();
      console.log('[PERFORMANCE] Odpowiedź z API:', data);

      if (response.ok && data.success) {
        // PO ZAPISIE - użyj danych zwróconych z API (z bazy)
        if (data.weeks && Array.isArray(data.weeks)) {
          const sorted = data.weeks.sort((a: PerformanceWeek, b: PerformanceWeek) => a.week - b.week);
          setWeeks(sorted);
          console.log('[PERFORMANCE] Zaktualizowano stan z danych z API:', sorted);
        } else {
          // Fallback - pobierz z serwera
          await fetchSettings();
        }
        alert("Ustawienia wydajności zapisane pomyślnie!");
      } else {
        alert(`Błąd zapisywania ustawień: ${data.error || 'Nieznany błąd'}`);
      }
    } catch (error: any) {
      console.error('[PERFORMANCE] Błąd zapisywania:', error);
      alert(`Błąd zapisywania ustawień: ${error.message || 'Nieznany błąd'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWeekChange = (weekNum: number, field: 'warmup' | 'campaign', value: string) => {
    // Jeśli pusty string, ustaw 0 (nie pozwalaj na pustą wartość)
    const numValue = value === '' ? 0 : parseInt(value, 10);
    
    // Walidacja - tylko liczby całkowite >= 0
    if (isNaN(numValue) || numValue < 0) {
      return;
    }

    // Utwórz GŁĘBOKĄ kopię tablicy (nie mutuj istniejącej!)
    const newWeeks = weeks.map(w => {
      if (w.week === weekNum) {
        return { ...w, [field]: numValue };
      }
      return { ...w }; // Kopiuj obiekt tygodnia
    });

    console.log('[PERFORMANCE] Zmiana:', { weekNum, field, value, numValue });
    console.log('[PERFORMANCE] Nowy stan:', newWeeks);
    setWeeks(newWeeks);
  };

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--spacing-lg)" }}>
        <div>
          <h1>Ustawienia wydajności warmup</h1>
          <p style={{ color: "var(--gray-600)", marginTop: "var(--spacing-sm)" }}>
            Limity maili dla skrzynek W WARMPIE (5 tygodni)
          </p>
        </div>
        <Link href="/settings" style={{ color: "var(--gray-600)", textDecoration: "none" }}>
          ← Wróć
        </Link>
      </div>

      <div className="card" style={{ marginBottom: "var(--spacing-xl)" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Limity warmup i kampanii</h2>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn"
            style={{
              backgroundColor: isSaving ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "4px",
              cursor: isSaving ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            {isSaving ? "Zapisuję..." : "Zapisz zmiany"}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--gray-200)" }}>
                <th style={{ padding: "var(--spacing-md)", textAlign: "left", fontWeight: "600", minWidth: "120px" }}>Tydzień</th>
                <th style={{ padding: "var(--spacing-md)", textAlign: "left", fontWeight: "600", minWidth: "150px" }}>Dni warmup</th>
                <th style={{ padding: "var(--spacing-md)", textAlign: "center", fontWeight: "600", minWidth: "180px" }}>Maile warmup dziennie</th>
                <th style={{ padding: "var(--spacing-md)", textAlign: "center", fontWeight: "600", minWidth: "180px" }}>Maile kampanii dziennie</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, index) => (
                <tr key={week.week} style={{ borderBottom: index < weeks.length - 1 ? "1px solid var(--gray-100)" : "none" }}>
                  <td style={{ padding: "var(--spacing-md)", fontWeight: "600" }}>
                    Tydzień {week.week}
                  </td>
                  <td style={{ padding: "var(--spacing-md)", color: "var(--gray-600)", fontSize: "14px" }}>
                    Dni {(week.week - 1) * 7 + 1}-{week.week * 7}
                  </td>
                  <td style={{ padding: "var(--spacing-md)", textAlign: "center" }}>
                    <input
                      type="number"
                      value={week.warmup}
                      onChange={(e) => handleWeekChange(week.week, 'warmup', e.target.value)}
                      min="0"
                      style={{
                        width: "100px",
                        padding: "8px 12px",
                        border: "1px solid var(--gray-300)",
                        borderRadius: "4px",
                        fontSize: "14px",
                        textAlign: "center"
                      }}
                    />
                  </td>
                  <td style={{ padding: "var(--spacing-md)", textAlign: "center" }}>
                    <input
                      type="number"
                      value={week.campaign}
                      onChange={(e) => handleWeekChange(week.week, 'campaign', e.target.value)}
                      min="0"
                      style={{
                        width: "100px",
                        padding: "8px 12px",
                        border: "1px solid var(--gray-300)",
                        borderRadius: "4px",
                        fontSize: "14px",
                        textAlign: "center"
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ backgroundColor: "#e8f4fd", padding: "var(--spacing-lg)", borderRadius: "8px" }}>
        <h3 style={{ marginTop: 0 }}>Jak to działa?</h3>
        <ul style={{ lineHeight: "1.8", marginBottom: 0 }}>
          <li><strong>Maile warmup</strong> - liczba maili dziennie między naszymi skrzynkami systemowymi</li>
          <li><strong>Maile kampanii</strong> - liczba maili z kampanii dziennie podczas warmup</li>
          <li><strong>System automatycznie wybiera tydzień</strong> na podstawie dnia warmup (np. dzień 10 = tydzień 2)</li>
          <li><strong>Uwaga:</strong> Te limity dotyczą TYLKO skrzynek W WARMPIE. Skrzynki nie w warmup mają:
            <ul style={{ marginTop: "8px", marginLeft: "20px" }}>
              <li>Nowa skrzynka: stałe <strong>10 maili dziennie</strong></li>
              <li>Gotowa skrzynka: limit z ustawień skrzynki</li>
            </ul>
          </li>
        </ul>
      </div>
    </main>
  );
}


