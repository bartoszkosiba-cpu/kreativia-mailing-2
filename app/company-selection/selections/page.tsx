"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

type MarketOption = "PL" | "DE" | "FR" | "EN";
type LanguageOption = "PL" | "EN" | "DE" | "FR";

type SegmentSummary = {
  class: string | null;
  subClass: string | null;
  count: number;
  needsReviewCount: number;
};

type IndustrySummary = {
  industry: string;
  count: number;
};

type ImportBatchOption = {
  id: number;
  name: string;
  language: string;
  market: string;
  totalRows?: number;
  processedRows?: number;
  createdAt: string;
};

type PreviewCompany = {
  id: number;
  name: string;
  industry: string | null;
  market: string | null;
  classificationClass: string | null;
  classificationSubClass: string | null;
  verificationStatus: string | null;
  importBatch?: {
    id: number;
    name: string;
    language: string;
    market: string;
  } | null;
};

type SelectionListItem = {
  id: number;
  name: string;
  market: string;
  language: string | null;
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
};

const MARKET_OPTIONS: Array<{ value: MarketOption; label: string }> = [
  { value: "PL", label: "Rynek PL" },
  { value: "DE", label: "Rynek DE" },
  { value: "FR", label: "Rynek FR" },
  { value: "EN", label: "Rynek EN / Global" },
];

const LANGUAGE_OPTIONS: Array<{ value: LanguageOption; label: string }> = [
  { value: "PL", label: "Polski" },
  { value: "EN", label: "English" },
  { value: "DE", label: "Deutsch" },
  { value: "FR", label: "Français" },
];

const CLASS_LABELS: Record<string, string> = {
  PS: "PS – Pośrednik",
  WK: "WK – Wykonawca",
  WKK: "WKK – Wartościowi klienci",
  KK: "KK – Klienci końcowi",
};

const SUBCLASS_LABELS: Record<string, string> = {
  PS_AGENCY: "Agencje marketingowe / PR",
  PS_PRINT: "Drukarnie / poligrafia",
  PS_ECOMMERCE: "E-commerce / resellerzy",
  PS_FOREIGN: "Pośrednicy zagraniczni",
  PS_SPECIALIZED: "Specjalistyczni dostawcy",
  WK_TRADESHOW: "Projektanci stoisk targowych",
  WK_EVENT: "Obsługa wydarzeń i eventów",
  WK_PRODUCTION: "Produkcja / montaż",
  WK_DESIGN: "Projektowanie / koncepcje",
  WKK_RETAIL: "Sieci retail / franczyzy",
  WKK_BRAND: "Duże marki / zespoły marketingowe",
  KK_MODULARICO: "Klienci Modularico",
  KK_GENERAL: "Klienci końcowi – inne",
};

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

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "0.35rem",
  fontWeight: 600,
  color: "#1F2937",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  border: "1px solid #D1D5DB",
  borderRadius: "0.5rem",
  fontSize: "0.95rem",
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

export default function CompanySelectionsPage() {
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [industries, setIndustries] = useState<IndustrySummary[]>([]);
  const [batches, setBatches] = useState<ImportBatchOption[]>([]);
  const [selections, setSelections] = useState<SelectionListItem[]>([]);
  const [selectionsLoading, setSelectionsLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [market, setMarket] = useState<MarketOption>("PL");
  const [language, setLanguage] = useState<LanguageOption>("PL");
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [selectedSubSegments, setSelectedSubSegments] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [previewCompanies, setPreviewCompanies] = useState<PreviewCompany[]>([]);
  const [previewTotals, setPreviewTotals] = useState<{ total: number; afterExclusions: number }>({
    total: 0,
    afterExclusions: 0,
  });
  const [excludeCompanyIds, setExcludeCompanyIds] = useState<Set<number>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [summaryResponse, batchesResponse] = await Promise.all([
          fetch("/api/company-selection/segments-summary"),
          fetch("/api/company-selection/imports?limit=500"),
        ]);

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setSegments(summaryData.segments ?? []);
          setIndustries(summaryData.industries ?? []);
        } else {
          console.warn("Nie udało się pobrać segmentów");
        }

        if (batchesResponse.ok) {
          const batchesData = await batchesResponse.json();
          setBatches(
            (batchesData.batches ?? []).map((batch: any) => ({
              id: batch.id,
              name: batch.name,
              language: batch.language,
              market: batch.market,
              totalRows: batch.totalRows ?? 0,
              processedRows: batch.processedRows ?? 0,
              createdAt: batch.createdAt,
            }))
          );
        }
      } catch (error) {
        console.error("Błąd ładowania danych początkowych", error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    loadSelectionsList();
  }, []);

  const loadSelectionsList = async () => {
    try {
      setSelectionsLoading(true);
      const response = await fetch("/api/company-selection/selections?limit=100");
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      setSelections(data.selections ?? []);
    } catch (error) {
      console.error("Błąd ładowania selekcji", error);
    } finally {
      setSelectionsLoading(false);
    }
  };

  const uniqueSegments = useMemo(() => {
    const unique = new Map<string, { code: string; label: string; count: number }>();
    segments.forEach((item) => {
      if (!item.class) return;
      const existing = unique.get(item.class) ?? {
        code: item.class,
        label: CLASS_LABELS[item.class] ?? item.class,
        count: 0,
      };
      existing.count += item.count;
      unique.set(item.class, existing);
    });
    return Array.from(unique.values()).sort((a, b) => b.count - a.count);
  }, [segments]);

  const uniqueSubSegments = useMemo(() => {
    const unique = new Map<string, { code: string; parent: string | null; count: number }>();
    segments.forEach((item) => {
      if (!item.subClass) return;
      const existing = unique.get(item.subClass) ?? {
        code: item.subClass,
        parent: item.class,
        count: 0,
      };
      existing.count += item.count;
      unique.set(item.subClass, existing);
    });
    return Array.from(unique.values()).sort((a, b) => b.count - a.count);
  }, [segments]);

  const toggleSelection = (state: string[], value: string): string[] => {
    if (state.includes(value)) {
      return state.filter((item) => item !== value);
    }
    return [...state, value];
  };

  const toggleBatchSelection = (id: number) => {
    setSelectedBatchIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handlePreview = async () => {
    try {
      setFormError(null);
      setFormSuccess(null);
      setPreviewLoading(true);

      const response = await fetch("/api/company-selection/selections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name || `Selekcja ${new Date().toISOString()}`,
          description,
          language,
          market,
          dryRun: true,
          filters: {
            industries: selectedIndustries,
            segments: selectedSegments,
            subSegments: selectedSubSegments,
            importBatchIds: selectedBatchIds,
            onlyNeedsReview,
          },
          excludeCompanyIds: Array.from(excludeCompanyIds),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.details || "Błąd generowania podglądu");
      }

      setPreviewTotals({
        total: data.totalMatches ?? 0,
        afterExclusions: data.totalAfterExclusions ?? 0,
      });
      setPreviewCompanies(data.preview ?? []);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Błąd generowania podglądu");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateSelection = async () => {
    try {
      setFormError(null);
      setFormSuccess(null);
      setCreateLoading(true);

      if (!name.trim()) {
        throw new Error("Podaj nazwę selekcji");
      }

      const response = await fetch("/api/company-selection/selections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          language,
          market,
          dryRun: false,
          filters: {
            industries: selectedIndustries,
            segments: selectedSegments,
            subSegments: selectedSubSegments,
            importBatchIds: selectedBatchIds,
            onlyNeedsReview,
          },
          excludeCompanyIds: Array.from(excludeCompanyIds),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.details || "Błąd tworzenia selekcji");
      }

      setFormSuccess(`Selekcja "${data.selection?.name}" została utworzona.`);
      setPreviewCompanies([]);
      setPreviewTotals({ total: 0, afterExclusions: 0 });
      setExcludeCompanyIds(new Set());
      await loadSelectionsList();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Błąd tworzenia selekcji");
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleExclude = (companyId: number) => {
    setExcludeCompanyIds((current) => {
      const newSet = new Set(current);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setSelectedSegments([]);
    setSelectedSubSegments([]);
    setSelectedIndustries([]);
    setSelectedBatchIds([]);
    setOnlyNeedsReview(false);
    setExcludeCompanyIds(new Set());
    setPreviewCompanies([]);
    setPreviewTotals({ total: 0, afterExclusions: 0 });
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1280px", margin: "0 auto" }}>
      <Link
        href="/company-selection"
        style={{
          color: "#2563EB",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          fontWeight: 500,
        }}
      >
        ← Powrót do modułu
      </Link>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        Nowa baza firm
      </h1>
      <p style={{ color: "#4B5563", marginBottom: "2rem", maxWidth: "820px", lineHeight: 1.5 }}>
        Stwórz własną selekcję firm na podstawie segmentów, branż i rynku. Możesz przygotować
        podgląd, wykluczyć pojedyncze firmy i zapisać selekcję do dalszej pracy (kryteria AI,
        weryfikacja, persony).
      </p>

      <div style={{ display: "grid", gap: "1.5rem" }}>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Parametry selekcji</h2>
          {formError && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                backgroundColor: "#FEE2E2",
                border: "1px solid #FCA5A5",
                color: "#B91C1C",
                borderRadius: "0.5rem",
              }}
            >
              {formError}
            </div>
          )}
          {formSuccess && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                backgroundColor: "#ECFDF5",
                border: "1px solid #6EE7B7",
                color: "#047857",
                borderRadius: "0.5rem",
              }}
            >
              {formSuccess}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <label style={labelStyle}>Nazwa selekcji *</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Np. Wykonawcy stoisk targowych PL"
                style={inputStyle}
                disabled={createLoading}
              />
            </div>
            <div>
              <label style={labelStyle}>Rynek *</label>
              <select
                value={market}
                onChange={(event) => setMarket(event.target.value as MarketOption)}
                style={inputStyle}
                disabled={createLoading}
              >
                {MARKET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Preferowany język</label>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as LanguageOption)}
                style={inputStyle}
                disabled={createLoading}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label style={labelStyle}>Opis selekcji (opcjonalnie)</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Krótko opisz, kogo zawiera baza i do czego będzie używana."
            style={{ ...inputStyle, minHeight: "90px" }}
            disabled={createLoading}
          />

          <hr style={{ margin: "1.5rem 0", borderTop: "1px solid #E5E7EB" }} />

          <h3 style={{ ...sectionTitleStyle, fontSize: "1.1rem" }}>Filtry</h3>

          <div
            style={{
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            <div>
              <label style={labelStyle}>Segmenty</label>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {uniqueSegments.map((segment) => (
                  <label
                    key={segment.code}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSegments.includes(segment.code)}
                      onChange={() => setSelectedSegments((state) => toggleSelection(state, segment.code))}
                    />
                    <span>
                      {segment.label}{" "}
                      <span style={{ color: "#6B7280", fontSize: "0.75rem" }}>({segment.count})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Subsegmenty</label>
              <div style={{ maxHeight: "220px", overflowY: "auto", paddingRight: "0.5rem" }}>
                {uniqueSubSegments.map((segment) => (
                  <label
                    key={segment.code}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.35rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubSegments.includes(segment.code)}
                      onChange={() =>
                        setSelectedSubSegments((state) => toggleSelection(state, segment.code))
                      }
                    />
                    <span>
                      {SUBCLASS_LABELS[segment.code] ?? segment.code}
                      <span style={{ color: "#6B7280", fontSize: "0.75rem", marginLeft: "0.35rem" }}>
                        ({segment.count})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Branże</label>
              <div style={{ maxHeight: "220px", overflowY: "auto", paddingRight: "0.5rem" }}>
                {industries.map((industry) => (
                  <label
                    key={industry.industry}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.35rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIndustries.includes(industry.industry)}
                      onChange={() =>
                        setSelectedIndustries((state) => toggleSelection(state, industry.industry))
                      }
                    />
                    <span>
                      {industry.industry}
                      <span style={{ color: "#6B7280", fontSize: "0.75rem", marginLeft: "0.35rem" }}>
                        ({industry.count})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Partie importu</label>
              <div style={{ maxHeight: "220px", overflowY: "auto", paddingRight: "0.5rem" }}>
                {batches.map((batch) => (
                  <label
                    key={batch.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.35rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBatchIds.includes(batch.id)}
                      onChange={() => toggleBatchSelection(batch.id)}
                    />
                    <span>
                      {batch.name}
                      <span style={{ color: "#6B7280", fontSize: "0.75rem", marginLeft: "0.35rem" }}>
                        ({batch.language} • {batch.market})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={onlyNeedsReview}
                onChange={(event) => setOnlyNeedsReview(event.target.checked)}
              />
              Uwzględnij tylko firmy wymagające ręcznej klasyfikacji
            </label>
            <button
              type="button"
              onClick={clearFilters}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                backgroundColor: "#F9FAFB",
                color: "#374151",
                cursor: "pointer",
              }}
            >
              Wyczyść filtry
            </button>
          </div>

          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || createLoading || loading}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.75rem",
                border: "none",
                backgroundColor: previewLoading ? "#93C5FD" : "#2563EB",
                color: "white",
                fontWeight: 600,
                cursor: previewLoading ? "not-allowed" : "pointer",
              }}
            >
              {previewLoading ? "Generuję podgląd..." : "Pokaż podgląd"}
            </button>
            <button
              type="button"
              onClick={handleCreateSelection}
              disabled={createLoading || loading}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.75rem",
                border: "none",
                backgroundColor: createLoading ? "#FBBF24" : "#F59E0B",
                color: "#1F2937",
                fontWeight: 600,
                cursor: createLoading ? "not-allowed" : "pointer",
              }}
            >
              {createLoading ? "Tworzę selekcję..." : "Zapisz selekcję"}
            </button>
          </div>
        </section>

        {previewCompanies.length > 0 && (
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Podgląd firm ({previewTotals.afterExclusions}/{previewTotals.total})</h2>
            <p style={{ marginBottom: "1rem", color: "#4B5563", fontSize: "0.9rem" }}>
              Zaznacz firmy, które chcesz wykluczyć przed zapisaniem selekcji.
            </p>
            <div style={{ overflowX: "auto", borderRadius: "0.75rem", border: "1px solid #E5E7EB" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.875rem",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#F3F4F6" }}>
                    <th style={{ padding: "0.65rem", textAlign: "left" }}>Wyklucz</th>
                    <th style={{ padding: "0.65rem", textAlign: "left" }}>Nazwa firmy</th>
                    <th style={{ padding: "0.65rem", textAlign: "left" }}>Branża</th>
                    <th style={{ padding: "0.65rem", textAlign: "left" }}>Segment</th>
                    <th style={{ padding: "0.65rem", textAlign: "left" }}>Status</th>
                    <th style={{ padding: "0.65rem", textAlign: "left" }}>Import</th>
                  </tr>
                </thead>
                <tbody>
                  {previewCompanies.map((company) => {
                    const segmentLabel = company.classificationClass
                      ? CLASS_LABELS[company.classificationClass] ?? company.classificationClass
                      : "—";
                    const subSegmentLabel = company.classificationSubClass
                      ? SUBCLASS_LABELS[company.classificationSubClass] ?? company.classificationSubClass
                      : null;
                    return (
                      <tr key={company.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td style={{ padding: "0.65rem" }}>
                          <input
                            type="checkbox"
                            checked={excludeCompanyIds.has(company.id)}
                            onChange={() => toggleExclude(company.id)}
                          />
                        </td>
                        <td style={{ padding: "0.65rem" }}>
                          <div style={{ fontWeight: 600 }}>{company.name}</div>
                          <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>
                            Rynek: {company.market ?? "—"}
                          </div>
                        </td>
                        <td style={{ padding: "0.65rem" }}>{company.industry ?? "—"}</td>
                        <td style={{ padding: "0.65rem" }}>
                          <div>{segmentLabel}</div>
                          {subSegmentLabel && (
                            <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>{subSegmentLabel}</div>
                          )}
                        </td>
                        <td style={{ padding: "0.65rem" }}>
                          {company.verificationStatus ?? "—"}
                        </td>
                        <td style={{ padding: "0.65rem" }}>
                          {company.importBatch ? (
                            <div>
                              <div>{company.importBatch.name}</div>
                              <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>
                                {company.importBatch.language} • {company.importBatch.market}
                              </div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={sectionTitleStyle}>Zapisane selekcje</h2>
            <button
              type="button"
              onClick={loadSelectionsList}
              disabled={selectionsLoading}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                backgroundColor: "#F9FAFB",
                color: "#374151",
                cursor: selectionsLoading ? "not-allowed" : "pointer",
              }}
            >
              {selectionsLoading ? "Odświeżam..." : "Odśwież listę"}
            </button>
          </div>
          <div style={{ overflowX: "auto", borderRadius: "0.75rem", border: "1px solid #E5E7EB" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
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
                {selections.length === 0 && (
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
                      <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>aktywnych: {selection.activeCompanies}</div>
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      {selection.criteria && selection.criteria.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          {selection.criteria.map((criterion) => (
                            <span key={criterion.id} style={{ fontSize: "0.8rem" }}>
                              {criterion.name} {criterion.isActive ? "" : "(nieaktywne)"}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>Brak kryteriów</span>
                      )}
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
      </div>
    </div>
  );
}


