"use client";

import Link from "next/link";
import { CSSProperties } from "react";

const cardStyle: CSSProperties = {
  backgroundColor: "white",
  borderRadius: "0.75rem",
  border: "1px solid #E5E7EB",
  padding: "1.5rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 600,
  marginBottom: "1rem",
  color: "#111827",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.35rem 0.65rem",
  borderRadius: "9999px",
  backgroundColor: "#EFF6FF",
  color: "#1E40AF",
  fontSize: "0.75rem",
  fontWeight: 600,
};

interface SelectionListItem {
  id: number;
  name: string;
  market: string;
  language: string | null;
  filters?: string | null;
  description?: string | null;
  totalCompanies: number;
  activeCompanies: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  criteria?: Array<{
    id: number;
    name: string;
    isActive: boolean;
    updatedAt: string;
  }>;
}

interface SpecializationOption {
  code: string;
  label: string;
  companyClass: string;
}

interface SavedSelectionsListProps {
  selections: SelectionListItem[];
  specializations: SpecializationOption[];
  loading: boolean;
  onRefresh: () => void;
}

/**
 * Lista zapisanych selekcji firm
 */
export function SavedSelectionsList({
  selections,
  specializations,
  loading,
  onRefresh,
}: SavedSelectionsListProps) {
  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={sectionTitleStyle}>Zapisane selekcje</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #D1D5DB",
            backgroundColor: loading ? "#E5E7EB" : "#F9FAFB",
            color: loading ? "#9CA3AF" : "#374151",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
          aria-label="Odśwież listę selekcji"
        >
          {loading && (
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                border: "2px solid #9CA3AF",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
              }}
              aria-hidden="true"
            />
          )}
          {loading ? "Odświeżam..." : "Odśwież listę"}
        </button>
      </div>
      {loading && selections.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
          Ładowanie listy selekcji...
        </div>
      )}
      <div style={{ overflowX: "auto", borderRadius: "0.75rem", border: "1px solid #E5E7EB" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
          }}
          aria-label="Lista zapisanych selekcji firm"
        >
          <thead>
            <tr style={{ backgroundColor: "#F3F4F6" }}>
              <th style={{ padding: "0.65rem", textAlign: "left" }}>Nazwa</th>
              <th style={{ padding: "0.65rem", textAlign: "left" }}>Rynek</th>
              <th style={{ padding: "0.65rem", textAlign: "left" }}>Firmy</th>
              <th style={{ padding: "0.65rem", textAlign: "left" }}>Kryteria</th>
              <th style={{ padding: "0.65rem", textAlign: "left" }}>Utworzono</th>
              <th style={{ padding: "0.65rem", textAlign: "left" }}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {selections.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ padding: "1rem", textAlign: "center", color: "#6B7280" }}>
                  Brak zapisanych selekcji. Utwórz pierwszą bazę firm.
                </td>
              </tr>
            )}
            {selections.map((selection) => (
              <tr key={selection.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                <td style={{ padding: "0.75rem" }}>
                  <div style={{ fontWeight: 600 }}>{selection.name}</div>
                  {selection.description && (
                    <div style={{ color: "#6B7280", fontSize: "0.8rem" }}>{selection.description}</div>
                  )}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <span style={chipStyle}>
                    {selection.market}
                    {selection.language ? ` • ${selection.language}` : ""}
                  </span>
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <div style={{ fontWeight: 600 }}>{selection.totalCompanies}</div>
                  <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>
                    aktywnych: {selection.activeCompanies}
                  </div>
                </td>
                <td style={{ padding: "0.75rem" }}>
                  {(() => {
                    let specializationSummary: string | null = null;
                    try {
                      if (selection.filters) {
                        const parsed = JSON.parse(selection.filters || "{}") as {
                          specializationCodes?: string[];
                        };
                        const codes = Array.isArray(parsed.specializationCodes) ? parsed.specializationCodes : [];
                        if (codes.length > 0) {
                          const labelMap = new Map(specializations.map((s) => [s.code, s.label]));
                          const labels = codes.map((c) => labelMap.get(c) ?? c);
                          const shown = labels.slice(0, 3).join(", ");
                          const rest = labels.length > 3 ? ` +${labels.length - 3}` : "";
                          specializationSummary = `Specjalizacje: ${shown}${rest}`;
                        }
                      }
                    } catch {
                      // ignorable
                    }
                    if (specializationSummary) {
                      return <span style={{ fontSize: "0.8rem" }}>{specializationSummary}</span>;
                    }
                    if (selection.criteria && selection.criteria.length > 0) {
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          {selection.criteria.map((criterion) => (
                            <span key={criterion.id} style={{ fontSize: "0.8rem" }}>
                              {criterion.name} {criterion.isActive ? "" : "(nieaktywne)"}
                            </span>
                          ))}
                        </div>
                      );
                    }
                    return <span style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>Brak kryteriów</span>;
                  })()}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  {new Date(selection.createdAt).toLocaleString("pl-PL")}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <Link
                    href={`/company-selection/selections/${selection.id}`}
                    style={{
                      color: "#2563EB",
                      textDecoration: "underline",
                      fontWeight: 500,
                    }}
                    aria-label={`Zobacz szczegóły selekcji ${selection.name}`}
                  >
                    Szczegóły
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

