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
}

export default function AIHealthIndicator() {
  const [health, setHealth] = useState<AIHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      // Pobierz dane zdrowia AI
      const healthResponse = await fetch("/api/ai/health");
      const healthData = await healthResponse.json();
      
      // Pobierz statystyki dzienne i miesięczne
      const [dailyResponse, monthlyResponse] = await Promise.all([
        fetch("/api/ai/token-stats?type=daily"),
        fetch("/api/ai/token-stats?type=monthly")
      ]);
      
      const dailyStats = await dailyResponse.json();
      const monthlyStats = await monthlyResponse.json();
      
      setHealth({
        ...healthData,
        tokenStats: {
          daily: dailyStats,
          monthly: monthlyStats
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
    if (health.status === "success") return "✓";
    if (health.status === "warning") return "⚠";
    return "✕";
  };

  const formatNumber = (num: number) => num.toLocaleString("pl-PL");
  const formatCostPLN = (cost: number) => `${cost.toFixed(2)} PLN`;
  const formatCostUSD = (cost: number) => `$${cost.toFixed(4)}`;

  const tooltipText = [
    health.message,
    health.responseTime ? `Czas odpowiedzi: ${health.responseTime}ms` : "",
    "",
    health.tokenStats?.daily ? "📊 DZISIAJ (24h):" : "",
    health.tokenStats?.daily ? `Wywołań: ${formatNumber(health.tokenStats.daily.totalCalls)}` : "",
    health.tokenStats?.daily ? `Koszt: ${formatCostPLN(health.tokenStats.daily.totalCostPLN)}` : "",
    "",
    health.tokenStats?.monthly ? `📅 MIESIĄC (${health.tokenStats.monthly.month}/${health.tokenStats.monthly.year}):` : "",
    health.tokenStats?.monthly ? `Wywołań: ${formatNumber(health.tokenStats.monthly.totalCalls)}` : "",
    health.tokenStats?.monthly ? `Koszt: ${formatCostPLN(health.tokenStats.monthly.totalCostPLN)}` : "",
    "",
    "Kliknij, aby odświeżyć"
  ].filter(Boolean).join("\n");

  return (
    <div
      onClick={checkHealth}
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
      title={tooltipText}
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
      {health.tokenStats?.daily && health.tokenStats.daily.totalCalls > 0 && (
        <span style={{ color: "#666", fontSize: "10px", fontWeight: "600" }}>
          {formatCostPLN(health.tokenStats.daily.totalCostPLN)}
        </span>
      )}
      {health.tokenStats?.monthly && health.tokenStats.monthly.totalCalls > 0 && (
        <span style={{ color: "#888", fontSize: "9px", fontWeight: "500" }}>
          / {formatCostPLN(health.tokenStats.monthly.totalCostPLN)}
        </span>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

