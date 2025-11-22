"use client";

import { CSSProperties } from "react";

const cardStyle: CSSProperties = {
  backgroundColor: "white",
  borderRadius: "0.75rem",
  border: "1px solid #E5E7EB",
  padding: "1.5rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

interface SelectionSaveSectionProps {
  selectionSaved: boolean;
  name: string;
  market: string;
  language: string;
  totalAfterExclusions: number;
  selectedSubSegmentsCount: number;
  onCreate: () => void;
  createLoading: boolean;
  canCreate: boolean;
}

/**
 * Sekcja zapisu selekcji z podsumowaniem i przyciskiem zapisu
 */
export function SelectionSaveSection({
  selectionSaved,
  name,
  market,
  language,
  totalAfterExclusions,
  selectedSubSegmentsCount,
  onCreate,
  createLoading,
  canCreate,
}: SelectionSaveSectionProps) {
  return (
    <section
      style={{
        ...cardStyle,
        backgroundColor: "#D1FAE5",
        border: "1px solid #34D399",
        padding: "0.6rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        {selectionSaved ? (
          <div style={{ color: "#064E3B", fontSize: "1rem", fontWeight: 700 }}>
            Selekcja zapisana
          </div>
        ) : (
          <button
            type="button"
            onClick={onCreate}
            disabled={!canCreate || createLoading}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: !canCreate || createLoading ? "#9CA3AF" : "#059669",
              color: "#FFFFFF",
              fontWeight: 700,
              cursor: !canCreate || createLoading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
            aria-label="Zapisz selekcję firm"
          >
            {createLoading ? "Tworzę..." : "Zapisz selekcję"}
          </button>
        )}
        <div style={{ height: "1.25rem", width: "1px", background: "#10B981" }} />
        <div
          style={{
            color: "#064E3B",
            fontSize: "0.9rem",
            display: "flex",
            gap: "1.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>
            <strong>Nazwa:</strong> {name || "—"}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>
            <strong>Rynek/Język:</strong> {market} • {language}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>
            <strong>Firm po wykl.:</strong> {totalAfterExclusions.toLocaleString("pl-PL")}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>
            <strong>Specjalizacje:</strong> {selectedSubSegmentsCount}
          </span>
        </div>
      </div>
    </section>
  );
}

