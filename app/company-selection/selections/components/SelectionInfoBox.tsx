"use client";

import { useState } from "react";

/**
 * Komponent informacyjny z możliwością zwijania/rozwijania
 */
export function SelectionInfoBox() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        padding: "1rem",
        backgroundColor: "#F0FDF4",
        borderRadius: "0.75rem",
        border: "1px solid #BBF7D0",
        marginBottom: "2rem",
        maxWidth: "900px",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "0",
          textAlign: "left",
        }}
        aria-expanded={expanded}
        aria-controls="selection-info-content"
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827", margin: 0 }}>
          Do czego służy ta strona? {expanded ? "▼" : "▶"}
        </h2>
      </button>

      {expanded && (
        <div id="selection-info-content" style={{ marginTop: "1rem" }}>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#374151", marginBottom: "1rem" }}>
            To jest <strong>kreator selekcji firm</strong> – wybierasz filtry, oglądasz podgląd firm, wykluczasz niechciane i zapisujesz selekcję do
            etapu weryfikacji person.
          </p>
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              backgroundColor: "#DBEAFE",
              borderRadius: "0.5rem",
              borderLeft: "3px solid #2563EB",
            }}
          >
            <strong style={{ fontSize: "0.85rem", color: "#1E40AF" }}>Ważne:</strong>
            <span style={{ fontSize: "0.85rem", color: "#4B5563", marginLeft: "0.5rem" }}>
              Firmy zablokowane są automatycznie wykluczane. Najpierw ustaw filtry, kliknij „Pokaż podgląd”, sprawdź wyniki i zapisz selekcję.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

