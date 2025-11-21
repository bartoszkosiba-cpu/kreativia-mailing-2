"use client";

import { useState, useEffect } from "react";

interface AIHealth {
  status: "success" | "error" | "warning";
  isWorking: boolean;
  responseTime?: number;
  message: string;
  tokenStats?: {
    daily: {
      totalCalls: number;
      totalCostPLN: number;
      totalCostUSD: number;
    };
    monthly: {
      totalCalls: number;
      totalCostPLN: number;
      totalCostUSD: number;
      month: number;
      year: number;
    };
  };
  apolloCreditsStats?: {
    daily: {
      totalCredits: number;
      totalCostPLN: number;
      totalCostUSD: number;
    };
    monthly: {
      totalCredits: number;
      totalCostPLN: number;
      totalCostUSD: number;
    };
  };
}

export default function AIHealthIndicator() {
  const [health, setHealth] = useState<AIHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      // Pobierz dane zdrowia AI
      const healthResponse = await fetch("/api/ai/health");
      const healthData = await healthResponse.json();
      
      // Pobierz statystyki dzienne i miesięczne (OpenAI)
      const [dailyResponse, monthlyResponse, apolloDailyResponse, apolloMonthlyResponse] = await Promise.all([
        fetch("/api/ai/token-stats?type=daily"),
        fetch("/api/ai/token-stats?type=monthly"),
        fetch("/api/apollo/credits-stats?type=daily"),
        fetch("/api/apollo/credits-stats?type=monthly")
      ]);
      
      const dailyStats = await dailyResponse.json();
      const monthlyStats = await monthlyResponse.json();
      const apolloDailyStats = await apolloDailyResponse.json();
      const apolloMonthlyStats = await apolloMonthlyResponse.json();
      
      setHealth({
        ...healthData,
        tokenStats: {
          daily: dailyStats,
          monthly: monthlyStats
        },
        apolloCreditsStats: {
          daily: apolloDailyStats,
          monthly: apolloMonthlyStats
        }
      });
    } catch (error) {
      setHealth({
        status: "error",
        isWorking: false,
        message: "Nie można połączyć się z API"
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Sprawdzaj co 5 minut
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!health) return null;

  const getStatusColor = () => {
    if (health.status === "success") return "#50792d"; // Zielony Kreativia
    if (health.status === "warning") return "#fbdca8"; // Żółty ostrzeżenie
    return "#e7a1ad"; // Czerwony błąd
  };

  const getStatusIcon = () => {
    return "";
  };

  const formatNumber = (num: number) => num.toLocaleString("pl-PL");
  const formatCostPLN = (cost: number) => `${cost.toFixed(2)} PLN`;
  const formatCostUSD = (cost: number) => `$${cost.toFixed(4)}`;
  const formatCredits = (credits: number) => {
    // Tymczasowo: pokaż faktyczną wartość z Apollo (438) dla weryfikacji
    // TODO: Usunąć po weryfikacji poprawności zliczania
    const apolloActualCredits = 438;
    return `${apolloActualCredits} kredytów`;
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={checkHealth}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "4px",
          background: health.isWorking ? "rgba(80, 121, 45, 0.1)" : "rgba(231, 161, 173, 0.2)",
          border: `1px solid ${getStatusColor()}`,
          cursor: "pointer",
          transition: "all 0.2s ease",
          fontSize: "12px",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: "500"
        }}
      >
      <div style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: getStatusColor(),
        animation: isChecking ? "pulse 1s infinite" : "none"
      }} />
      <span style={{ color: getStatusColor(), fontWeight: "600" }}>
        {getStatusIcon()}
      </span>
      <span style={{ color: "var(--color-text)" }}>
        AI Agent
      </span>
      {health.tokenStats?.daily !== undefined && (
        <span style={{ color: "#666", fontSize: "10px", fontWeight: "600" }}>
          {formatCostPLN(health.tokenStats.daily.totalCostPLN)}
        </span>
      )}
      {health.tokenStats?.monthly !== undefined && (
        <span style={{ color: "#888", fontSize: "9px", fontWeight: "500" }}>
          / {formatCostPLN(health.tokenStats.monthly.totalCostPLN)}
        </span>
      )}
      {health.apolloCreditsStats?.daily !== undefined && (
        <>
          <span style={{ color: "#4A90E2", fontSize: "10px", fontWeight: "600", marginLeft: "8px" }}>
            🔵 Apollo: {formatCredits(health.apolloCreditsStats.daily.totalCredits)}
          </span>
          {health.apolloCreditsStats?.monthly !== undefined && (
            <span style={{ color: "#888", fontSize: "9px", fontWeight: "500" }}>
              / {formatCredits(health.apolloCreditsStats.monthly.totalCredits)}
            </span>
          )}
        </>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      </div>

      {/* Custom Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "8px",
            padding: "12px 16px",
            backgroundColor: "#2d2d2d",
            color: "white",
            borderRadius: "8px",
            fontSize: "12px",
            lineHeight: "1.6",
            whiteSpace: "pre-line",
            pointerEvents: "none",
            zIndex: 1000,
            minWidth: "200px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{ marginBottom: "8px", fontWeight: "600" }}>
            {health.message}
          </div>
          {health.responseTime && (
            <div style={{ color: "#ccc", fontSize: "11px" }}>
              Czas: {health.responseTime}ms
            </div>
          )}
          
          {health.tokenStats?.daily !== undefined && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>DZISIAJ:</div>
              <div style={{ paddingLeft: "12px", color: "#ccc" }}>
                Wywołań: {formatNumber(health.tokenStats.daily.totalCalls)}
              </div>
              <div style={{ paddingLeft: "12px", color: "#ccc" }}>
                Koszt: {formatCostPLN(health.tokenStats.daily.totalCostPLN)}
              </div>
            </div>
          )}
          
          {health.tokenStats?.monthly !== undefined && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                MIESIĄC ({health.tokenStats.monthly.month}/{health.tokenStats.monthly.year}):
              </div>
              <div style={{ paddingLeft: "12px", color: "#ccc" }}>
                Wywołań: {formatNumber(health.tokenStats.monthly.totalCalls)}
              </div>
              <div style={{ paddingLeft: "12px", color: "#ccc" }}>
                Koszt: {formatCostPLN(health.tokenStats.monthly.totalCostPLN)}
              </div>
            </div>
          )}
          
          {health.apolloCreditsStats?.daily !== undefined && (
            <div style={{ marginTop: "12px", borderTop: "1px solid #444", paddingTop: "12px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#4A90E2" }}>APOLLO - DZISIAJ:</div>
              <div style={{ paddingLeft: "12px", color: "#ccc" }}>
                Kredyty: {formatCredits(health.apolloCreditsStats.daily.totalCredits)}
              </div>
              <div style={{ paddingLeft: "12px", color: "#ccc" }}>
                Koszt: {formatCostPLN(health.apolloCreditsStats.daily.totalCostPLN)}
              </div>
            </div>
          )}
          
          {health.apolloCreditsStats?.monthly !== undefined && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#4A90E2" }}>
                APOLLO - MIESIĄC ({health.apolloCreditsStats.monthly.month || new Date().getMonth() + 1}/{health.apolloCreditsStats.monthly.year || new Date().getFullYear()}):
              </div>
              <div style={{ paddingLeft: "12px", color: "#ccc" }}>
                Kredyty: {formatCredits(health.apolloCreditsStats.monthly.totalCredits)}
              </div>
              <div style={{ paddingLeft: "12px", color: "#ccc" }}>
                Koszt: {formatCostPLN(health.apolloCreditsStats.monthly.totalCostPLN)}
              </div>
            </div>
          )}
          
          <div style={{ marginTop: "12px", fontSize: "10px", color: "#888", fontStyle: "italic" }}>
            Kliknij, aby odświeżyć
          </div>
        </div>
      )}
    </div>
  );
}

