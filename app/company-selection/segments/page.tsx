"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SegmentEntry = {
  class: string | null;
  subClass: string | null;
  count: number;
  needsReviewCount: number;
};

type IndustryEntry = {
  industry: string;
  count: number;
};

type SummaryResponse = {
  success: boolean;
  segments: SegmentEntry[];
  industries: IndustryEntry[];
  error?: string;
};

const CLASS_LABELS: Record<string, string> = {
  PS: "PS – Pośrednicy",
  WK: "WK – Wykonawcy",
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

function formatSegmentLabel(entry: SegmentEntry): string {
  const base = entry.class ? CLASS_LABELS[entry.class] ?? entry.class : "Brak klasy";
  if (!entry.subClass) {
    return base;
  }
  const sub = SUBCLASS_LABELS[entry.subClass] ?? entry.subClass;
  return `${base} → ${sub}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pl-PL").format(value);
}

export default function SegmentsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentEntry[]>([]);
  const [industries, setIndustries] = useState<IndustryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/company-selection/segments-summary");
        const data: SummaryResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data?.error || "Nie udało się pobrać danych");
        }

        if (!cancelled) {
          setSegments(data.segments);
          setIndustries(data.industries);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalCompanies = useMemo(
    () => segments.reduce((sum, entry) => sum + entry.count, 0),
    [segments]
  );

  const segmentsSorted = useMemo(() => {
    const priority: Record<string, number> = {
      PS: 4,
      WK: 3,
      WKK: 2,
      KK: 1,
    };

    return [...segments].sort((a, b) => {
      const priorityA = priority[a.class ?? ""] ?? 0;
      const priorityB = priority[b.class ?? ""] ?? 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      if ((a.subClass ?? "") < (b.subClass ?? "")) return -1;
      if ((a.subClass ?? "") > (b.subClass ?? "")) return 1;
      return 0;
    });
  }, [segments]);

  const industriesSorted = useMemo(
    () => [...industries].sort((a, b) => b.count - a.count),
    [industries]
  );

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem" }}>Segmenty i branże</h1>
        <Link
          href="/company-selection"
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #D1D5DB",
            color: "#1F2937",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          ← Powrót do modułu
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <SummaryCard title="Firmy z przypisanym segmentem" value={formatNumber(totalCompanies)} accent="#2563EB" />
        <SummaryCard title="Unikalne segmenty" value={formatNumber(segments.length)} accent="#10B981" />
        <SummaryCard title="Unikalne branże" value={formatNumber(industries.length)} accent="#8B5CF6" />
      </div>

      {error && (
        <div
          style={{
            padding: "1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#FEE2E2",
            border: "1px solid #FCA5A5",
            color: "#B91C1C",
            marginBottom: "2rem",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "#6B7280",
            backgroundColor: "white",
            borderRadius: "0.75rem",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
          }}
        >
          Ładuję dane segmentów...
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <section
            style={{
              backgroundColor: "white",
              borderRadius: "0.75rem",
              border: "1px solid #E5E7EB",
              padding: "1.5rem",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#111827" }}>
              Segmenty (łącznie: {formatNumber(totalCompanies)})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {segmentsSorted.length === 0 ? (
                <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>
                  Brak firm z przypisanymi segmentami. Zaimportuj dane lub uruchom klasyfikację.
                </p>
              ) : (
                segmentsSorted.map((entry) => {
                  const needsReviewShare =
                    entry.count > 0
                      ? Math.round((entry.needsReviewCount / entry.count) * 100)
                      : 0;
                  return (
                    <div
                      key={`${entry.class ?? "null"}::${entry.subClass ?? "null"}`}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "0.75rem",
                        padding: "1rem",
                        backgroundColor: "#F9FAFB",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "#111827" }}>
                          {formatSegmentLabel(entry)}
                        </span>
                        <span style={{ color: "#2563EB", fontWeight: 600 }}>
                          {formatNumber(entry.count)}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                        Do weryfikacji: {formatNumber(entry.needsReviewCount)} (
                        {needsReviewShare}%)
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section
            style={{
              backgroundColor: "white",
              borderRadius: "0.75rem",
              border: "1px solid #E5E7EB",
              padding: "1.5rem",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#111827" }}>
              Branże (unikalne: {formatNumber(industriesSorted.length)})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {industriesSorted.length === 0 ? (
                <p style={{ color: "#6B7280", fontSize: "0.875rem" }}>
                  Brak danych o branżach. Upewnij się, że w CSV znajduje się kolumna „Industry”.
                </p>
              ) : (
                industriesSorted.map((entry) => (
                  <div
                    key={entry.industry}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: "0.75rem",
                      padding: "0.75rem 1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}
                  >
                    <span style={{ color: "#111827", fontWeight: 500 }}>
                      {entry.industry}
                    </span>
                    <span style={{ color: "#10B981", fontWeight: 600 }}>
                      {formatNumber(entry.count)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard(props: { title: string; value: string; accent: string }) {
  const { title, value, accent } = props;
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "0.75rem",
        border: "1px solid #E5E7EB",
        padding: "1.25rem",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
      }}
    >
      <span style={{ color: "#6B7280", fontSize: "0.875rem" }}>{title}</span>
      <span style={{ fontSize: "1.75rem", fontWeight: 700, color: accent }}>{value}</span>
    </div>
  );
}


