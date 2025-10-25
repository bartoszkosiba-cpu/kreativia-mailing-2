"use client";

import { LEAD_STATUS_CONFIGS } from "@/src/types/leadStatus";
import { useState } from "react";

export default function StatusLegend() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="card" style={{ marginBottom: "var(--spacing-lg)" }}>
      <div 
        className="flex-between" 
        style={{ cursor: "pointer", alignItems: "center" }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 style={{ color: "var(--primary)", margin: 0 }}>
          📋 Statusy leadów - co oznaczają?
        </h3>
        <span style={{ fontSize: "18px", color: "var(--gray-600)" }}>
          {isExpanded ? "▼" : "▶"}
        </span>
      </div>
      
      {isExpanded && (
        <div style={{ marginTop: "var(--spacing-md)" }}>
          {Object.entries(LEAD_STATUS_CONFIGS).map(([statusKey, configs]) => (
            <div key={statusKey} style={{ marginBottom: "var(--spacing-md)" }}>
              <h4 style={{ 
                color: "var(--gray-800)", 
                marginBottom: "var(--spacing-sm)",
                fontSize: "16px",
                fontWeight: "600"
              }}>
                {configs[0].label}
              </h4>
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
                gap: "var(--spacing-sm)" 
              }}>
                {configs.map((config, index) => (
                  <div 
                    key={index}
                    style={{
                      padding: "var(--spacing-sm)",
                      border: "1px solid var(--gray-300)",
                      borderRadius: "var(--radius)",
                      backgroundColor: "var(--gray-50)"
                    }}
                  >
                    <div className="flex" style={{ alignItems: "center", marginBottom: "var(--spacing-xs)" }}>
                      <span style={{ fontSize: "16px", marginRight: "var(--spacing-xs)" }}>
                        {config.icon}
                      </span>
                      <span 
                        style={{ 
                          fontWeight: "600",
                          color: config.color,
                          fontSize: "14px"
                        }}
                      >
                        {config.label}
                      </span>
                    </div>
                    
                    <div style={{ 
                      fontSize: "12px", 
                      color: "var(--gray-600)",
                      marginBottom: "var(--spacing-xs)"
                    }}>
                      {config.description}
                    </div>
                    
                    <div style={{ 
                      fontSize: "11px", 
                      color: "var(--gray-500)",
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "2px"
                    }}>
                      <div>
                        {config.canSendCampaigns ? "✅" : "❌"} Kampanie
                      </div>
                      <div>
                        {config.canSendNewCampaigns ? "✅" : "❌"} Nowe kampanie
                      </div>
                      <div>
                        {config.canSendFollowUps ? "✅" : "❌"} Follow-up
                      </div>
                      <div>
                        {config.requiresAction ? "⚠️" : "✅"} Wymaga akcji
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div style={{ 
            marginTop: "var(--spacing-md)",
            padding: "var(--spacing-sm)",
            backgroundColor: "var(--info-light)",
            borderRadius: "var(--radius)",
            fontSize: "12px",
            color: "var(--info-dark)"
          }}>
            💡 <strong>Wskazówka:</strong> Statusy są automatycznie przypisywane przez system AI na podstawie odpowiedzi leadów. 
            Możesz ręcznie zmienić status w szczegółach leada.
          </div>
        </div>
      )}
    </div>
  );
}
