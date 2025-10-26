"use client";

import { useState } from "react";

interface ClassificationStats {
  interested: number;
  notInterested: number;
  unsubscribe: number;
  outOfOffice: number;
  redirect: number;
  bounce: number;
  other: number;
}

interface ClassificationButtonsProps {
  stats: ClassificationStats;
  campaignId: number;
  onFilterChange?: (filter: string | null) => void;
}

export default function ClassificationButtons({ 
  stats, 
  campaignId, 
  onFilterChange 
}: ClassificationButtonsProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const classifications = [
    {
      key: "interested",
      label: "Zainteresowani",
      icon: "",
      color: "#4caf50",
      bgColor: "#e8f5e8",
      borderColor: "#4caf50",
      description: "Osoby zainteresowane ofertą"
    },
    {
      key: "notInterested", 
      label: "Niezainteresowani",
      icon: "",
      color: "#ff9800",
      bgColor: "#fff3e0",
      borderColor: "#ff9800",
      description: "Osoby niechętne ofercie"
    },
    {
      key: "unsubscribe",
      label: "Wypisani", 
      icon: "",
      color: "#f44336",
      bgColor: "#ffebee",
      borderColor: "#f44336",
      description: "Osoby proszące o wypisanie"
    },
    {
      key: "outOfOffice",
      label: "Poza biurem",
      icon: "",
      color: "#ff9800", 
      bgColor: "#fff3e0",
      borderColor: "#ff9800",
      description: "Automatyczne odpowiedzi OOO"
    },
    {
      key: "redirect",
      label: "Przekierowania",
      icon: "",
      color: "#9c27b0",
      bgColor: "#f3e5f5", 
      borderColor: "#9c27b0",
      description: "Przekierowania do innych osób"
    },
    {
      key: "bounce",
      label: "Odbite",
      icon: "",
      color: "#9c27b0",
      bgColor: "#f3e5f5",
      borderColor: "#9c27b0", 
      description: "Maile które się odbiły"
    },
    {
      key: "other",
      label: "Inne",
      icon: "",
      color: "#607d8b",
      bgColor: "#eceff1",
      borderColor: "#607d8b",
      description: "Inne odpowiedzi do ręcznej obsługi"
    }
  ];

  const handleFilterClick = (key: string) => {
    if (activeFilter === key) {
      // Jeśli już aktywny, usuń filtr
      setActiveFilter(null);
      onFilterChange?.(null);
    } else {
      // Ustaw nowy filtr
      setActiveFilter(key);
      onFilterChange?.(key);
    }
  };

  const totalReplies = Object.values(stats).reduce((sum, count) => sum + count, 0);

  return (
    <div style={{ marginBottom: 24, padding: 16, backgroundColor: "white", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, marginRight: 12 }}>Klasyfikacja odpowiedzi</h3>
        <span style={{ 
          fontSize: "12px", 
          color: "#666", 
          backgroundColor: "#f0f0f0", 
          padding: "4px 8px", 
          borderRadius: 12 
        }}>
          Razem: {totalReplies}
        </span>
      </div>
      
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
        gap: 12 
      }}>
        {classifications.map((classification) => {
          const count = stats[classification.key as keyof ClassificationStats] || 0;
          const isActive = activeFilter === classification.key;
          
          return (
            <button
              key={classification.key}
              onClick={() => handleFilterClick(classification.key)}
              disabled={count === 0}
              style={{
                padding: "12px 8px",
                backgroundColor: isActive ? classification.color : classification.bgColor,
                border: `2px solid ${isActive ? classification.color : classification.borderColor}`,
                borderRadius: 8,
                cursor: count > 0 ? "pointer" : "not-allowed",
                textAlign: "center",
                transition: "all 0.2s ease",
                opacity: count === 0 ? 0.5 : 1,
                transform: isActive ? "scale(1.05)" : "scale(1)",
                boxShadow: isActive ? `0 4px 12px ${classification.color}40` : "0 2px 4px rgba(0,0,0,0.1)",
                position: "relative"
              }}
              title={count === 0 ? "Brak odpowiedzi" : `${classification.description} - kliknij aby filtrować inbox`}
              onMouseEnter={(e) => {
                if (count > 0 && !isActive) {
                  e.currentTarget.style.transform = "scale(1.02)";
                  e.currentTarget.style.boxShadow = `0 4px 8px ${classification.color}30`;
                }
              }}
              onMouseLeave={(e) => {
                if (count > 0 && !isActive) {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                }
              }}
            >
              <div style={{ 
                fontSize: "24px", 
                fontWeight: "bold", 
                color: isActive ? "white" : classification.color,
                marginBottom: 4
              }}>
                {count}
              </div>
              <div style={{ 
                fontSize: "11px", 
                color: isActive ? "white" : "#666",
                fontWeight: "600",
                lineHeight: 1.2
              }}>
                {classification.icon}{" "}{classification.label}
              </div>
              
              {/* Wskaźnik aktywności */}
              {isActive && (
                <div style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  backgroundColor: "white",
                  borderRadius: "50%",
                  border: `2px solid ${classification.color}`
                }} />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Aktywne filtry */}
      {activeFilter && (
        <div style={{ 
          marginTop: 12, 
          padding: 8, 
          backgroundColor: "#e3f2fd", 
          borderRadius: 4,
          fontSize: "12px",
          color: "#1976d2",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <span>Aktywny filtr:</span>
          <span style={{ fontWeight: "bold" }}>
            {classifications.find(c => c.key === activeFilter)?.label} 
            ({stats[activeFilter as keyof ClassificationStats] || 0})
          </span>
          <button
            onClick={() => {
              setActiveFilter(null);
              onFilterChange?.(null);
            }}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "#1976d2",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            × Usuń filtr
          </button>
        </div>
      )}
      
      {/* Szybkie akcje */}
      {stats.other > 0 && (
        <div style={{ 
          marginTop: 12, 
          padding: 8, 
          backgroundColor: "#fff3e0", 
          borderRadius: 4,
          fontSize: "12px",
          color: "#f57c00"
        }}>
          Masz {stats.other} odpowiedzi do ręcznej obsługi. 
          <button
            onClick={() => handleFilterClick("other")}
            style={{
              marginLeft: 8,
              background: "none",
              border: "none", 
              color: "#f57c00",
              cursor: "pointer",
              textDecoration: "underline",
              fontWeight: "bold"
            }}
          >
            Przejrzyj je teraz
          </button>
        </div>
      )}
    </div>
  );
}
