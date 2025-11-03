"use client";

import { useEffect, useRef, useState } from "react";

interface PlanningInfo {
  campaign: {
    id: number;
    name: string;
    status: string;
  };
  timeWindow: {
    isValid: boolean;
    reason?: string;
    minutesRemaining: number;
    endHour: number;
    endMinute: number;
    endWindow: string;
  };
  emails: {
    total: number;
    sent: number;
    remaining: number;
    estimatedToday: number;
    maxPerDay: number;
  };
  delay: {
    base: number;
    optimal: number;
    min: number;
    max: number;
  };
  nextEmailTime: string | null;
  warnings: {
    isApproachingDailyLimit: boolean;
    isApproachingTimeLimit: boolean;
    isInSafetyMargin: boolean;
    canFitAllEmails: boolean;
  };
}

interface CampaignPlanningInfoProps {
  campaignId: number;
  autoRefresh?: boolean;
}

export default function CampaignPlanningInfo({ campaignId, autoRefresh = true }: CampaignPlanningInfoProps) {
  const [info, setInfo] = useState<PlanningInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshMs, setRefreshMs] = useState(30000); // auto-refresh cadence with backoff
  const intervalRef = useRef<NodeJS.Timer | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPlanningInfo = async () => {
    try {
      setIsLoading(true);
      // Abort any in-flight request before starting a new one
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch(`/api/campaigns/${campaignId}/planning-info`, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error("Błąd pobierania informacji");
      }
      
      const data = await response.json();
      setInfo(data);
      setError(null);
      // Reset backoff on success
      if (refreshMs !== 30000) setRefreshMs(30000);
    } catch (err: any) {
      console.error("[PLANNING INFO] Błąd:", err);
      if (err?.name === 'AbortError') {
        // Swallow aborts (switching tabs/visibility)
        return;
      }
      setError(err.message || "Nie udało się pobrać informacji");
      // Exponential backoff up to 5 min
      setRefreshMs(prev => Math.min(prev * 2, 300000));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const start = () => {
      if (!autoRefresh) return;
      if (intervalRef.current) clearInterval(intervalRef.current as any);
      intervalRef.current = setInterval(() => {
        if (!document.hidden) {
          fetchPlanningInfo();
        }
      }, refreshMs);
    };

    // initial fetch
    fetchPlanningInfo();
    start();

    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current as any);
        // Abort in-flight request when tab goes hidden
        if (abortRef.current) abortRef.current.abort();
      } else {
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current as any);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [campaignId, autoRefresh, refreshMs]);

  if (isLoading) {
    return (
      <div className="card" style={{ padding: "var(--spacing-lg)" }}>
        <div style={{ textAlign: "center", color: "var(--gray-600)" }}>
          Ładowanie informacji o planowaniu...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: "var(--spacing-lg)" }}>
        <div style={{ textAlign: "center", color: "var(--danger)" }}>
          Błąd: {error}
        </div>
      </div>
    );
  }

  if (!info) {
    return null;
  }

  const { timeWindow, emails, delay, warnings } = info;

  return (
    <div className="card" style={{ padding: "var(--spacing-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-md)" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Planowanie wysyłki</h2>
        <div style={{ fontSize: 12, color: "var(--gray-600)" }}>Auto-odświeżanie: co {Math.round(refreshMs/1000)}s</div>
      </div>

      {/* CZAS */}
      <div style={{ 
        padding: "var(--spacing-md)", 
        backgroundColor: timeWindow.isValid ? "#f0fdf4" : "#fef2f2",
        borderRadius: "6px",
        marginBottom: "var(--spacing-md)",
        border: `1px solid ${timeWindow.isValid ? "#bbf7d0" : "#fecaca"}`
      }}>
        <strong style={{ color: timeWindow.isValid ? "#166534" : "#991b1b" }}>
          Okno czasowe: {timeWindow.isValid ? "AKTYWNE" : "NIEAKTYWNE"}
        </strong>
        <div style={{ marginTop: "8px", fontSize: "14px" }}>
          {timeWindow.isValid ? (
            <>
              <span style={{ color: "var(--gray-700)" }}>
                Pozostało: <strong>{timeWindow.minutesRemaining} minut</strong>
              </span>
              <br />
              <span style={{ color: "var(--gray-600)", fontSize: "12px" }}>
                Koniec okna: {new Date(timeWindow.endWindow).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </>
          ) : (
            <span style={{ color: "var(--gray-600)" }}>{timeWindow.reason}</span>
          )}
        </div>
      </div>

      {/* MAILE */}
      <div style={{ 
        padding: "var(--spacing-md)", 
        backgroundColor: "#eff6ff",
        borderRadius: "6px",
        marginBottom: "var(--spacing-md)",
        border: "1px solid #bfdbfe"
      }}>
        <strong style={{ color: "#1e40af" }}>Status wysyłki</strong>
        <div style={{ marginTop: "8px", fontSize: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <span style={{ color: "var(--gray-600)" }}>Wysłano dzisiaj:</span>
            <br />
            <span style={{ fontSize: "20px", fontWeight: "bold", color: "#059669" }}>
              {emails.sent}
            </span>
            <span style={{ color: "var(--gray-600)", fontSize: "12px" }}> / {emails.maxPerDay}</span>
          </div>
          <div>
            <span style={{ color: "var(--gray-600)" }}>Pozostało:</span>
            <br />
            <span style={{ fontSize: "20px", fontWeight: "bold", color: "#dc2626" }}>
              {emails.remaining}
            </span>
            <span style={{ color: "var(--gray-600)", fontSize: "12px" }}> / {emails.total}</span>
          </div>
        </div>
        
        {emails.remaining > 0 && (
          <div style={{ marginTop: "12px", padding: "8px", backgroundColor: "#dbeafe", borderRadius: "4px" }}>
            <span style={{ fontSize: "13px", color: "#1e40af" }}>
              Szacunkowo wyśle dziś: <strong>{Math.min(emails.estimatedToday, emails.remaining)} maili</strong>
              {emails.estimatedToday < emails.remaining && " (nie wszystkie zmieszczą się w oknie!)"}
            </span>
          </div>
        )}
      </div>

      {/* DELAY */}
      <div style={{ 
        padding: "var(--spacing-md)", 
        backgroundColor: "#fffbeb",
        borderRadius: "6px",
        marginBottom: "var(--spacing-md)",
        border: "1px solid #fde68a"
      }}>
        <strong style={{ color: "#92400e" }}>Opóźnienie między mailami</strong>
        <div style={{ marginTop: "8px", fontSize: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "var(--gray-600)" }}>Bazowy:</span>
            <strong>{delay.base}s</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ color: "var(--gray-600)" }}>Zakres:</span>
            <span style={{ fontSize: "13px", color: "var(--gray-600)" }}>
              {delay.min}-{delay.max}s (±20%)
            </span>
          </div>
          {info.nextEmailTime && (
            <div style={{ marginTop: "12px", padding: "8px", backgroundColor: "#fef3c7", borderRadius: "4px", border: "1px solid #fbbf24" }}>
              <span style={{ fontSize: "13px", color: "#92400e" }}>
                <strong>Następny mail zaplanowany na:</strong> {info.nextEmailTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* OSTRZEŻENIA */}
      {(warnings.isApproachingDailyLimit || warnings.isApproachingTimeLimit || warnings.isInSafetyMargin) && (
        <div style={{ 
          padding: "var(--spacing-md)", 
          backgroundColor: "#fef2f2",
          borderRadius: "6px",
          border: "1px solid #fecaca"
        }}>
          <strong style={{ color: "#991b1b" }}>Ostrzeżenia</strong>
          <ul style={{ marginTop: "8px", marginBottom: 0, paddingLeft: "20px", fontSize: "14px", color: "#991b1b" }}>
            {warnings.isInSafetyMargin && (
              <li>Okno czasowe wygasło - używany bazowy delay</li>
            )}
            {warnings.isApproachingTimeLimit && (
              <li>Zbliża się koniec okna czasowego (≤5 minut)</li>
            )}
            {warnings.isApproachingDailyLimit && (
              <li>Zbliża się dzienny limit maili (≤10 pozostało)</li>
            )}
            {!warnings.canFitAllEmails && emails.remaining > 0 && (
              <li>Nie wszystkie maile zmieszczą się w oknie czasowym - kontynuacja jutro</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

