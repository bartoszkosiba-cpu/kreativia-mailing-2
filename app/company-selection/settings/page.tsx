"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { COMPANY_SPECIALIZATIONS } from "@/config/companySpecializations";

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
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    loadRules();
    loadSuggestions();

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
        <h2 style={{ margin: 0 }}>Specjalizacje</h2>
        <p style={{ color: "#4B5563", maxWidth: "720px" }}>
          Zobacz katalog specjalizacji, którym przypisujemy branże. Każda specjalizacja
          wskazuje klasę (PS/WK/WKK) oraz opisuje typ klientów.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem",
          }}
        >
          {COMPANY_SPECIALIZATIONS.map((spec) => (
            <div
              key={spec.code}
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: "0.75rem",
                padding: "1rem",
                backgroundColor: "#F9FAFB",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#4338CA",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {spec.companyClass}
              </span>
              <h3 style={{ margin: 0 }}>{spec.label}</h3>
              <p style={{ margin: 0, color: "#4B5563", lineHeight: 1.5 }}>
                {spec.description}
              </p>
            </div>
          ))}
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
