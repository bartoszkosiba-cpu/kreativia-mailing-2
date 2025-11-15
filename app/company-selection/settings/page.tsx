"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { COMPANY_SPECIALIZATIONS } from "@/config/companySpecializations";

interface SpecializationFromDB {
  id: number;
  code: string;
  label: string;
  description: string;
  companyClass: string;
  createdBy: string;
  createdAt: string;
  firstCompanyId: number | null;
  firstCompanyName: string | null;
  firstCompanyReason: string | null;
  aiConfidence: number | null;
  companyCount?: number; // Liczba firm z tą specjalizacją
  firstCompany: {
    id: number;
    name: string;
  } | null;
}

interface IndustryRule {
  industry: string;
  specializationCode: string;
  specializationLabel: string;
  companyClass: string;
  score: number;
  source: string;
  updatedAt?: string | null;
}

interface IndustrySuggestion {
  id: number;
  industry: string;
  specializationCode: string;
  specializationLabel: string;
  score: number;
  explanation?: string | null;
  status: string;
  createdAt: string;
}

export default function CompanySelectionSettingsPage() {
  const [rules, setRules] = useState<IndustryRule[]>([]);
  const [suggestions, setSuggestions] = useState<IndustrySuggestion[]>([]);
  const [specializations, setSpecializations] = useState<SpecializationFromDB[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingSpecializations, setLoadingSpecializations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());
  const [filterClass, setFilterClass] = useState<string>("");
  const [filterCreatedBy, setFilterCreatedBy] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function loadRules() {
      setLoadingRules(true);
      try {
        const response = await fetch("/api/industry/rules");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setRules(data.rules ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Nie udało się pobrać reguł"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRules(false);
        }
      }
    }

    async function loadSuggestions() {
      setLoadingSuggestions(true);
      try {
        const response = await fetch("/api/industry/suggestions");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setSuggestions(data.suggestions ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Nie udało się pobrać propozycji mapowania"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggestions(false);
        }
      }
    }

    async function loadSpecializations() {
      setLoadingSpecializations(true);
      try {
        const response = await fetch("/api/company-selection/specializations");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled && data.success) {
          setSpecializations(data.specializations ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Błąd pobierania specjalizacji:", err);
        }
      } finally {
        if (!cancelled) {
          setLoadingSpecializations(false);
        }
      }
    }

    loadRules();
    loadSuggestions();
    loadSpecializations();

    return () => {
      cancelled = true;
    };
  }, []);

  const groupedRules = useMemo(() => {
    const map = new Map<string, IndustryRule[]>();
    for (const rule of rules) {
      const bucket = map.get(rule.industry) ?? [];
      bucket.push(rule);
      map.set(rule.industry, bucket);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rules]);

  const filteredSpecializations = useMemo(() => {
    return specializations.filter((spec) => {
      if (filterClass && spec.companyClass !== filterClass) return false;
      if (filterCreatedBy && spec.createdBy !== filterCreatedBy) return false;
      return true;
    });
  }, [specializations, filterClass, filterCreatedBy]);

  const toggleSpec = (code: string) => {
    const newExpanded = new Set(expandedSpecs);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedSpecs(newExpanded);
  };

  const toggleAll = () => {
    if (expandedSpecs.size === filteredSpecializations.length) {
      setExpandedSpecs(new Set());
    } else {
      setExpandedSpecs(new Set(filteredSpecializations.map((s) => s.code)));
    }
  };

  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: "2rem" }}>Ustawienia selekcji firm</h1>
        <Link
          href="/company-selection/verify"
          style={{ color: "#2563EB", textDecoration: "underline" }}
        >
          ← Wróć do weryfikacji
        </Link>
      </div>

      {error && (
        <div
          style={{
            padding: "1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#FEE2E2",
            color: "#B91C1C",
            border: "1px solid #FCA5A5",
          }}
        >
          {error}
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 400px" }}>
            <h2 style={{ margin: 0 }}>Specjalizacje</h2>
            <p style={{ color: "#4B5563", maxWidth: "720px", marginTop: "0.5rem" }}>
              Katalog specjalizacji - każda wskazuje klasę (PS/WK/WKK) i opisuje typ klientów. 
              Specjalizacje utworzone przez AI oznaczone są kolorem żółtym.
            </p>
          </div>
          {!loadingSpecializations && (
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              {/* Podsumowanie firm sklasyfikowanych przez AI */}
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#EFF6FF",
                  border: "1px solid #93C5FD",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "#475569", fontWeight: 500 }}>
                  Firmy sklasyfikowane przez AI
                </span>
                <span style={{ fontSize: "1.25rem", color: "#1E40AF", fontWeight: 700 }}>
                  {filteredSpecializations.reduce((sum, spec) => sum + (spec.companyCount || 0), 0)}
                </span>
              </div>
              {filteredSpecializations.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button
                    onClick={toggleAll}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #D1D5DB",
                      backgroundColor: "white",
                      color: "#374151",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {expandedSpecs.size === filteredSpecializations.length ? "Zwiń wszystkie" : "Rozwiń wszystkie"}
                  </button>
                  <span style={{ color: "#6B7280", fontSize: "0.875rem" }}>
                    {filteredSpecializations.length} specjalizacji
                  </span>
                  <span style={{ color: "#6B7280", fontSize: "0.875rem" }}>
                    ({filteredSpecializations.filter((s) => (s.companyCount || 0) > 0).length} z firmami)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtry */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.875rem", color: "#374151", fontWeight: 500 }}>Klasa:</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.875rem",
              }}
            >
              <option value="">Wszystkie</option>
              <option value="PS">PS</option>
              <option value="WK">WK</option>
              <option value="WKK">WKK</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.875rem", color: "#374151", fontWeight: 500 }}>Typ:</label>
            <select
              value={filterCreatedBy}
              onChange={(e) => setFilterCreatedBy(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.875rem",
              }}
            >
              <option value="">Wszystkie</option>
              <option value="MANUAL">Manualne</option>
              <option value="AI">Utworzone przez AI</option>
            </select>
          </div>
          {(filterClass || filterCreatedBy) && (
            <button
              onClick={() => {
                setFilterClass("");
                setFilterCreatedBy("");
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                backgroundColor: "white",
                color: "#374151",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Wyczyść filtry
            </button>
          )}
        </div>

        {/* Tabela specjalizacji */}
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "0.75rem",
            overflow: "hidden",
            backgroundColor: "white",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ backgroundColor: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
              <tr>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", width: "50px" }}></th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", width: "80px" }}>Klasa</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Kod</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Nazwa</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", width: "100px" }}>Firmy</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", width: "120px" }}>Typ</th>
              </tr>
            </thead>
            <tbody>
              {loadingSpecializations && filteredSpecializations.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
                    Ładowanie specjalizacji...
                  </td>
                </tr>
              )}
              {!loadingSpecializations && filteredSpecializations.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
                    Brak specjalizacji
                  </td>
                </tr>
              )}
              {filteredSpecializations.map((spec, index) => {
                const isAICreated = spec.createdBy === "AI";
                const isExpanded = expandedSpecs.has(spec.code);
                return (
                  <>
                    <tr
                      key={spec.code}
                      style={{
                        backgroundColor: isAICreated ? "#FFFBEB" : index % 2 === 0 ? "white" : "#F9FAFB",
                        borderBottom: "1px solid #E5E7EB",
                        cursor: "pointer",
                      }}
                      onClick={() => toggleSpec(spec.code)}
                    >
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <span
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            backgroundColor: spec.companyClass === "PS" ? "#DBEAFE" : spec.companyClass === "WK" ? "#D1FAE5" : "#FCE7F3",
                            color: spec.companyClass === "PS" ? "#1E40AF" : spec.companyClass === "WK" ? "#065F46" : "#9F1239",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                          }}
                        >
                          {spec.companyClass}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.875rem", color: "#1F2937" }}>
                        {spec.code}
                      </td>
                      <td style={{ padding: "0.75rem", fontWeight: 500, color: "#111827" }}>
                        {spec.label}
                        {isAICreated && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              padding: "0.125rem 0.375rem",
                              borderRadius: "0.25rem",
                              backgroundColor: "#FCD34D",
                              color: "#92400E",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            AI
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            backgroundColor: (spec.companyCount || 0) > 0 ? "#D1FAE5" : "#F3F4F6",
                            color: (spec.companyCount || 0) > 0 ? "#065F46" : "#6B7280",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            minWidth: "40px",
                            display: "inline-block",
                            textAlign: "center",
                          }}
                        >
                          {spec.companyCount || 0}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#6B7280" }}>
                        {spec.createdBy === "AI" ? "AI" : "Manualna"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr
                        style={{
                          backgroundColor: isAICreated ? "#FFFBEB" : index % 2 === 0 ? "white" : "#F9FAFB",
                          borderBottom: "1px solid #E5E7EB",
                        }}
                      >
                        <td colSpan={6} style={{ padding: "0 0.75rem 0.75rem 0.75rem" }}>
                          <div style={{ paddingLeft: "2.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <div>
                              <strong style={{ fontSize: "0.875rem", color: "#374151" }}>Opis:</strong>
                              <p style={{ margin: "0.25rem 0 0 0", color: "#4B5563", fontSize: "0.875rem", lineHeight: 1.6 }}>
                                {spec.description}
                              </p>
                            </div>
                            {isAICreated && (
                              <div
                                style={{
                                  padding: "0.75rem",
                                  borderRadius: "0.5rem",
                                  backgroundColor: "#FEF3C7",
                                  border: "1px solid #FCD34D",
                                  fontSize: "0.875rem",
                                }}
                              >
                                <div style={{ fontWeight: 600, color: "#92400E", marginBottom: "0.5rem" }}>
                                  Informacje o utworzeniu przez AI:
                                </div>
                                <div style={{ color: "#78350F", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                  <div>
                                    <strong>Utworzona:</strong> {new Date(spec.createdAt).toLocaleString("pl-PL")}
                                  </div>
                                  {spec.firstCompanyName && (
                                    <div>
                                      <strong>Przez firmę:</strong> {spec.firstCompanyName}
                                      {spec.firstCompanyId && (
                                        <span style={{ color: "#6B7280", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                                          (ID: {spec.firstCompanyId})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {spec.firstCompanyReason && (
                                    <div style={{ marginTop: "0.25rem", fontStyle: "italic" }}>
                                      <strong>Powód:</strong> {spec.firstCompanyReason}
                                    </div>
                                  )}
                                  {spec.aiConfidence !== null && (
                                    <div>
                                      <strong>Confidence AI:</strong> {Math.round(spec.aiConfidence * 100)}%
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Reguły mapowania industry</h2>
          {loadingRules && <span style={{ color: "#6B7280" }}>Ładuję…</span>}
        </div>
        <p style={{ color: "#4B5563", maxWidth: "720px" }}>
          Każda branża (`industry`) może mieć przypisane jedną lub kilka specjalizacji z wagą 1–5.
          Wagi decydują o głównym przypisaniu w klasyfikacji firm.
        </p>
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "0.75rem",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead style={{ backgroundColor: "#F3F4F6" }}>
              <tr>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Industry</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Specjalizacje i wagi</th>
              </tr>
            </thead>
            <tbody>
              {groupedRules.length === 0 && !loadingRules && (
                <tr>
                  <td colSpan={2} style={{ padding: "1rem", textAlign: "center", color: "#6B7280" }}>
                    Brak zdefiniowanych reguł.
                  </td>
                </tr>
              )}
              {groupedRules.map(([industry, list]) => (
                <tr key={industry} style={{ borderTop: "1px solid #E5E7EB" }}>
                  <td style={{ padding: "0.75rem", verticalAlign: "top", fontWeight: 600 }}>
                    {industry}
                  </td>
                  <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {list
                        .slice()
                        .sort((a, b) => b.score - a.score)
                        .map((item) => (
                          <div
                            key={`${industry}-${item.specializationCode}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                padding: "0.25rem 0.6rem",
                                borderRadius: "9999px",
                                backgroundColor: "#EEF2FF",
                                color: "#4338CA",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              {item.specializationLabel}
                            </span>
                            <span style={{ color: "#4B5563" }}>score: {item.score}</span>
                            <span style={{ color: "#9CA3AF" }}>
                              ({item.companyClass})
                            </span>
                            <span style={{ color: "#9CA3AF" }}>{item.source}</span>
                          </div>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Nowe propozycje (AI)</h2>
          {loadingSuggestions && <span style={{ color: "#6B7280" }}>Ładuję…</span>}
        </div>
        <p style={{ color: "#4B5563", maxWidth: "720px" }}>
          Agent AI będzie sugerował mapowanie nowych branż. Tutaj zobaczysz wszystkie oczekujące propozycje.
        </p>
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "0.75rem",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead style={{ backgroundColor: "#F3F4F6" }}>
              <tr>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Industry</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Propozycja</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Status</th>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Wysłano</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.length === 0 && !loadingSuggestions && (
                <tr>
                  <td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "#6B7280" }}>
                    Brak oczekujących propozycji.
                  </td>
                </tr>
              )}
              {suggestions.map((item) => (
                <tr key={item.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                  <td style={{ padding: "0.75rem", verticalAlign: "top" }}>{item.industry}</td>
                  <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          style={{
                            padding: "0.25rem 0.6rem",
                            borderRadius: "9999px",
                            backgroundColor: "#DBEAFE",
                            color: "#1D4ED8",
                            fontWeight: 600,
                            fontSize: "0.8rem",
                          }}
                        >
                          {item.specializationLabel}
                        </span>
                        <span style={{ color: "#4B5563" }}>score: {item.score}</span>
                      </div>
                      {item.explanation && (
                        <p style={{ margin: 0, color: "#6B7280" }}>{item.explanation}</p>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem", verticalAlign: "top", color: "#6B7280" }}>
                    {item.status}
                  </td>
                  <td style={{ padding: "0.75rem", verticalAlign: "top", color: "#6B7280" }}>
                    {new Date(item.createdAt).toLocaleString("pl-PL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
