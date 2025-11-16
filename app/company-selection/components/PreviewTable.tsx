"use client";

import React, { useMemo, useState } from "react";

type SpecializationOption = {
  code: string;
  label: string;
  companyClass: string;
};

type PreviewCompany = {
  id: number;
  name: string;
  description?: string | null;
  activityDescription?: string | null;
  keywords?: string | null;
  industry?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  street?: string | null;
  postalCode?: string | null;
  verificationStatus?: string | null;
  importBatch?: { id: number; name: string; language: string; market: string } | null;
  classifications?: Array<{
    specializationCode: string;
    score: number;
    confidence: number | null;
    isPrimary: boolean;
    reason?: string | null;
  }>;
};

export function PreviewTable(props: {
  companies: PreviewCompany[];
  total: number;
  totalAfterExclusions: number;
  page: number;
  totalPages: number;
  pageSize: number;
  onChangePage: (page: number) => void;
  specializations: SpecializationOption[];
  excludeCompanyIds: Set<number>;
  onToggleExclude: (id: number) => void;
  showExcludeButtons?: boolean;
}) {
  const {
    companies,
    total,
    totalAfterExclusions,
    page,
    totalPages,
    pageSize,
    onChangePage,
    specializations,
    excludeCompanyIds,
    onToggleExclude,
    showExcludeButtons = true,
  } = props;

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const specLabelMap = useMemo(
    () => new Map(specializations.map((s) => [s.code, s.label])),
    [specializations]
  );

  const buildPageList = (totalNum: number, current: number): Array<number | string> => {
    const pages: Array<number | string> = [];
    if (!Number.isFinite(totalNum) || totalNum <= 0) return [1];
    if (totalNum <= 9) {
      for (let i = 1; i <= totalNum; i++) pages.push(i);
      return pages;
    }
    const add = (p: number | string) => pages.push(p);
    add(1);
    if (current > 4) add("…");
    const start = Math.max(2, current - 2);
    const end = Math.min(totalNum - 1, current + 2);
    for (let i = start; i <= end; i++) add(i);
    if (current < totalNum - 3) add("…");
    add(totalNum);
    return pages;
  };

  const formatVerificationStatus = (status: string | null | undefined): { label: string; color: string; bg: string } => {
    switch (status) {
      case "VERIFIED":
        return { label: "Zweryfikowana", color: "#065F46", bg: "#D1FAE5" };
      case "BLOCKED":
        return { label: "Zablokowana", color: "#991B1B", bg: "#FEE2E2" };
      case "PENDING":
      default:
        return { label: "Brak weryfikacji Perso", color: "#1D4ED8", bg: "#DBEAFE" };
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div style={{ color: "#6B7280", fontSize: "0.9rem" }}>
          Łącznie: {totalAfterExclusions.toLocaleString("pl-PL")} • Strona {page} z {totalPages} • {pageSize}/stronę
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => { if (page > 1) onChangePage(page - 1); }}
            disabled={page <= 1}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "0.5rem",
              border: "1px solid #D1D5DB",
              backgroundColor: page <= 1 ? "#F3F4F6" : "white",
              color: "#374151",
              cursor: page <= 1 ? "not-allowed" : "pointer",
            }}
          >
            ← Poprzednia
          </button>
          <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
            {buildPageList(totalPages, page).map((item, idx) =>
              typeof item === "number" ? (
                <button
                  key={`p-${item}-${idx}`}
                  type="button"
                  onClick={() => { if (item !== page) onChangePage(item); }}
                  style={{
                    padding: "0.35rem 0.6rem",
                    borderRadius: "0.4rem",
                    border: "1px solid #D1D5DB",
                    backgroundColor: item === page ? "#2563EB" : "white",
                    color: item === page ? "white" : "#374151",
                    cursor: "pointer",
                    minWidth: "2rem",
                  }}
                >
                  {item}
                </button>
              ) : (
                <span key={`dots-${idx}`} style={{ padding: "0 0.25rem", color: "#6B7280" }}>…</span>
              )
            )}
          </div>
          <button
            type="button"
            onClick={() => { if (page < totalPages) onChangePage(page + 1); }}
            disabled={page >= totalPages}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "0.5rem",
              border: "1px solid #D1D5DB",
              backgroundColor: page >= totalPages ? "#F3F4F6" : "white",
              color: "#374151",
              cursor: page >= totalPages ? "not-allowed" : "pointer",
            }}
          >
            Następna →
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto", borderRadius: "0.75rem", border: "1px solid #E5E7EB" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.875rem",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#F3F4F6" }}>
              <th style={{ padding: "0.65rem", textAlign: "center", width: "28px" }}></th>
              <th style={{ padding: "0.65rem", textAlign: "left", width: "55%" }}>Firma i opis</th>
              <th style={{ padding: "0.65rem", textAlign: "left", width: "20%" }}>Dopasowania AI</th>
              <th style={{ padding: "0.65rem", textAlign: "right", width: "120px" }}>Akcja</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company, index) => {
              const isExpanded = expanded.has(company.id);
              return (
                <React.Fragment key={`row-${company.id}`}>
                  <tr
                    key={company.id}
                    style={{
                      borderTop: "1px solid #E5E7EB",
                      backgroundColor: index % 2 === 0 ? "white" : "#F9FAFB",
                      height: "120px",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(company.id)) next.delete(company.id);
                        else next.add(company.id);
                        return next;
                      });
                    }}
                  >
                    <td style={{ padding: "0.65rem", textAlign: "center", verticalAlign: "top" }}>
                      <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                        {isExpanded ? "▼" : "▶"}
                      </span>
                    </td>
                    <td style={{ padding: "0.65rem", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 600, color: "#111827", display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                        <span>{company.name}</span>
                        <span style={{ color: "#9CA3AF" }}>•</span>
                        <span style={{ color: company.website ? "#2563EB" : "#9CA3AF", fontSize: "0.85rem" }}>
                          {company.website ? (
                            <a
                              href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#2563EB", textDecoration: "none" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {company.website}
                            </a>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "#4B5563",
                          lineHeight: "1.5",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: "vertical",
                          marginTop: "0.35rem",
                          maxHeight: "6rem",
                        }}
                      >
                        {company.activityDescription || company.description || "—"}
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: "0.5rem", color: "#374151" }}>
                          <div style={{ fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                            <strong>Pełny opis:</strong>{" "}
                            {company.activityDescription || company.description || "—"}
                          </div>
                          <div style={{ fontSize: "0.85rem" }}>
                            <strong>Branża:</strong> {company.industry ?? "—"}
                          </div>
                          <div style={{ fontSize: "0.85rem" }}>
                            <strong>WWW:</strong>{" "}
                            {company.website ? (
                              <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" style={{ color: "#2563EB" }}>
                                {company.website}
                              </a>
                            ) : (
                              "—"
                            )}
                          </div>
                          <div style={{ fontSize: "0.85rem" }}>
                            <strong>Adres:</strong>{" "}
                            {[company.street, company.postalCode, company.city, company.country].filter(Boolean).join(", ") || "—"}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.65rem" }}>
                      {company.classifications && company.classifications.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          {company.classifications
                            .filter((c) => c.isPrimary)
                            .map((c, idx) => (
                              <div key={`p-${company.id}-${idx}`} style={{ marginBottom: "0.5rem" }}>
                                <div style={{ fontWeight: 600 }}>
                                  {specLabelMap.get(c.specializationCode) ?? c.specializationCode}{" "}
                                  <span style={{ marginLeft: "0.35rem", color: "#2563EB", fontSize: "0.75rem" }}>
                                    Główna
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.85rem", color: "#6B7280", marginTop: "0.15rem" }}>
                                  / {c.score}
                                  {c.confidence != null ? ` / ${c.confidence.toFixed(2)}` : ""}
                                </div>
                              </div>
                            ))}
                          {company.classifications
                            .filter((c) => !c.isPrimary)
                            .map((c, idx) => (
                              <div key={`a-${company.id}-${idx}`} style={{ marginBottom: "0.5rem" }}>
                                <div style={{ color: "#374151" }}>
                                  {specLabelMap.get(c.specializationCode) ?? c.specializationCode}
                                </div>
                                <div style={{ fontSize: "0.85rem", color: "#6B7280", marginTop: "0.15rem" }}>
                                  / {c.score}
                                  {c.confidence != null ? ` / ${c.confidence.toFixed(2)}` : ""}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "0.65rem", textAlign: "right", verticalAlign: "top" }} onClick={(e) => e.stopPropagation()}>
                      {showExcludeButtons && (
                        <button
                          type="button"
                          onClick={() => onToggleExclude(company.id)}
                          title={excludeCompanyIds.has(company.id) ? "Anuluj wykluczenie" : "Wyklucz z selekcji"}
                          aria-label={excludeCompanyIds.has(company.id) ? "Anuluj wykluczenie" : "Wyklucz"}
                          style={{
                            border: "1px solid #FCA5A5",
                            backgroundColor: excludeCompanyIds.has(company.id) ? "#EF4444" : "#FFF1F2",
                            color: excludeCompanyIds.has(company.id) ? "white" : "#B91C1C",
                            borderRadius: "0.4rem",
                            padding: "0.3rem 0.6rem",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          {excludeCompanyIds.has(company.id) ? "Wykluczono" : "Wyklucz"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr
                      key={`${company.id}-expanded`}
                      style={{
                        backgroundColor: index % 2 === 0 ? "#F9FAFB" : "white",
                        borderTop: "1px solid #E5E7EB",
                      }}
                    >
                      <td colSpan={4} style={{ padding: "0.75rem 0.85rem" }}>
                        <div style={{ paddingLeft: "3.5rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                            {(() => {
                              const fmt = formatVerificationStatus(company.verificationStatus ?? null);
                              return (
                                <span style={{ display: "inline-block", padding: "0.1rem 0.4rem", borderRadius: "999px", background: fmt.bg, color: fmt.color, fontSize: "0.75rem", fontWeight: 600 }}>
                                  {fmt.label}
                                </span>
                              );
                            })()}
                            <span style={{ color: "#6B7280", fontSize: "0.85rem" }}>
                              {company.importBatch ? (
                                <>
                                  <strong>Import:</strong> {company.importBatch.name} <span style={{ color: "#9CA3AF" }}>({company.importBatch.language} • {company.importBatch.market})</span>
                                </>
                              ) : (
                                <>
                                  <strong>Import:</strong> —
                                </>
                              )}
                            </span>
                          </div>
                          {company.keywords && (
                            <div style={{ fontSize: "0.85rem", color: "#6B7280" }}>
                              <strong>Keywords:</strong> {company.keywords}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


