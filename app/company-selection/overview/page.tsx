"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { COMPANY_SPECIALIZATIONS } from "@/config/companySpecializations";

type AggregationItem = {
  value: string;
  count: number;
};

const PAGE_SIZE = 50;

const DESCRIPTION_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  lineHeight: 1.5,
  fontSize: "0.85rem",
  color: "#374151",
};

const NEEDS_REVIEW_OPTIONS = [
  { value: "", label: "Review: wszystkie" },
  { value: "true", label: "Tylko do sprawdzenia" },
  { value: "false", label: "Bez uwag" },
] as const;

const CLASS_LABELS: Record<string, string> = {
  PS: "PS – Pośrednik",
  WK: "WK – Wykonawca",
  WKK: "WKK – Wartościowy klient końcowy",
};

const SPECIALIZATION_MAP = (() => {
  const map = new Map<string, { label: string; class: string }>();
  for (const spec of COMPANY_SPECIALIZATIONS) {
    map.set(spec.code, { label: spec.label, class: spec.companyClass });
  }
  return map;
})();

const getSpecializationInfo = (code: string) => {
  if (SPECIALIZATION_MAP.has(code)) {
    return SPECIALIZATION_MAP.get(code)!;
  }
  return { label: code, class: "" };
};

const getMarketLabel = (market: string) => {
  const labels: Record<string, string> = {
    PL: "Rynek PL",
    DE: "Rynek DE",
    FR: "Rynek FR",
    EN: "Rynek EN / Global",
  };
  return labels[market] ?? market;
};

const getIndustryLabel = (industry: string) => industry;

interface SegmentSummary {
  class: string | null;
  subClass: string | null;
  count: number;
  needsReviewCount: number;
}

interface IndustrySummary {
  industry: string;
  count: number;
}

interface CompanyItem {
  id: number;
  name: string;
  industry: string | null;
  market: string | null;
  country: string | null;
  city: string | null;
  description: string | null;
  activityDescription: string | null;
  classificationClass: string | null;
  classificationSubClass: string | null;
  classificationConfidence: number | null;
  classificationNeedsReview: boolean | null;
  classificationSignals: string[];
  verificationStatus: string;
  importBatch?: {
    id: number;
    name: string;
    language: string;
    market: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CompanyOverviewPage() {
  const [segmentsSummary, setSegmentsSummary] = useState<SegmentSummary[]>([]);
  const [industriesSummary, setIndustriesSummary] = useState<IndustrySummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [subClassFilter, setSubClassFilter] = useState<string[]>([]);
  const [marketFilter, setMarketFilter] = useState<string[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [needsReviewFilter, setNeedsReviewFilter] = useState("");
  const [marketAggregation, setMarketAggregation] = useState<AggregationItem[]>([]);
  const [industryAggregation, setIndustryAggregation] = useState<AggregationItem[]>([]);
  const [classAggregation, setClassAggregation] = useState<AggregationItem[]>([]);
  const [subClassAggregation, setSubClassAggregation] = useState<AggregationItem[]>([]);

  useEffect(() => {
    async function loadSummary() {
      try {
        setSummaryLoading(true);
        const response = await fetch("/api/company-selection/segments-summary");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setSegmentsSummary(data.segments ?? []);
        setIndustriesSummary(data.industries ?? []);
        setMarketAggregation(
          Array.isArray(data.aggregations?.market)
            ? data.aggregations.market.map((item: any) => ({
                value: String(item.value),
                count: Number(item.count) || 0,
              }))
            : []
        );
        setIndustryAggregation(
          Array.isArray(data.aggregations?.industry)
            ? data.aggregations.industry.map((item: any) => ({
                value: String(item.value),
                count: Number(item.count) || 0,
              }))
            : []
        );
      } catch (err) {
        console.error("[Overview] Błąd podsumowania", err);
      } finally {
        setSummaryLoading(false);
      }
    }

    loadSummary();
  }, []);

  useEffect(() => {
    async function loadCompanies() {
      try {
        setTableLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));
        if (searchValue.trim()) params.set("search", searchValue.trim());
        classFilter.forEach((value) => params.append("classificationClass", value));
        subClassFilter.forEach((value) => params.append("classificationSubClass", value));
        marketFilter.forEach((value) => params.append("market", value));
        industryFilter.forEach((value) => params.append("industry", value));
        if (needsReviewFilter) params.set("needsReview", needsReviewFilter);

        const url = `/api/company-selection/list?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setCompanies(
          (data.companies ?? []).map((company: any) => ({
            ...company,
            description: company.description ?? null,
            activityDescription: company.activityDescription ?? null,
            classificationSignals: Array.isArray(company.classificationSignals)
              ? company.classificationSignals
              : [],
          }))
        );
        setPagination(data.pagination ?? null);
        setClassAggregation(
          Array.isArray(data.aggregations?.class)
            ? data.aggregations.class.map((item: any) => ({
                value: String(item.value),
                count: Number(item.count) || 0,
              }))
            : []
        );
        setSubClassAggregation(
          Array.isArray(data.aggregations?.subClass)
            ? data.aggregations.subClass.map((item: any) => ({
                value: String(item.value),
                count: Number(item.count) || 0,
              }))
            : []
        );
        setMarketAggregation(
          Array.isArray(data.aggregations?.market)
            ? data.aggregations.market.map((item: any) => ({
                value: String(item.value),
                count: Number(item.count) || 0,
              }))
            : []
        );
        setIndustryAggregation(
          Array.isArray(data.aggregations?.industry)
            ? data.aggregations.industry.map((item: any) => ({
                value: String(item.value),
                count: Number(item.count) || 0,
              }))
            : []
        );
      } catch (err) {
        console.error("[Overview] Błąd pobierania firm", err);
        setError(err instanceof Error ? err.message : String(err));
        setClassAggregation([]);
        setSubClassAggregation([]);
        setMarketAggregation([]);
        setIndustryAggregation([]);
      } finally {
        setTableLoading(false);
      }
    }

    loadCompanies();
  }, [page, searchValue, classFilter, subClassFilter, marketFilter, industryFilter, needsReviewFilter]);

  useEffect(() => {
    setSubClassFilter((prev) =>
      prev.filter((code) => {
        const info = getSpecializationInfo(code);
        if (classFilter.length > 0 && info.class && !classFilter.includes(info.class)) {
          return false;
        }
        return true;
      })
    );
  }, [classFilter]);

  const classStats = useMemo(() => {
    const map = new Map<string, { count: number; review: number }>();
    for (const entry of segmentsSummary) {
      if (!entry.class) continue;
      const current = map.get(entry.class) ?? { count: 0, review: 0 };
      current.count += entry.count;
      current.review += entry.needsReviewCount;
      map.set(entry.class, current);
    }
    return Array.from(map.entries()).map(([classCode, value]) => ({
      classCode,
      label: CLASS_LABELS[classCode] ?? classCode,
      count: value.count,
      review: value.review,
    }));
  }, [segmentsSummary]);

  const classFilterOptions = useMemo(() => {
    const counts = new Map(classAggregation.map((item) => [item.value, item.count]));
    return (["PS", "WK", "WKK"] as const).map((value) => ({
      value,
      label: CLASS_LABELS[value],
      count: counts.get(value) ?? 0,
    }));
  }, [classAggregation]);

  const specializationOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; classCode: string; count: number }> = [];
    const seen = new Set<string>();

    for (const item of subClassAggregation) {
      if (!item.value) continue;
      const info = getSpecializationInfo(item.value);
      options.push({
        value: item.value,
        label: info.label,
        classCode: info.class,
        count: item.count,
      });
      seen.add(item.value);
    }

    for (const selected of subClassFilter) {
      if (!seen.has(selected)) {
        const info = getSpecializationInfo(selected);
        options.push({
          value: selected,
          label: info.label,
          classCode: info.class,
          count: 0,
        });
        seen.add(selected);
      }
    }

    return options
      .filter((option) =>
        classFilter.length === 0 ? true : option.classCode && classFilter.includes(option.classCode)
      )
      .sort((a, b) => {
        const countDiff = (b.count ?? 0) - (a.count ?? 0);
        return countDiff !== 0 ? countDiff : a.label.localeCompare(b.label);
      });
  }, [subClassAggregation, subClassFilter, classFilter]);

  const marketFilterOptions = useMemo(() => {
    const options: FilterOption[] = [];
    const counts = new Map(marketAggregation.map((item) => [item.value, item.count]));
    const seen = new Set<string>();

    for (const [code, label] of Object.entries({ PL: "Rynek PL", DE: "Rynek DE", FR: "Rynek FR", EN: "Rynek EN / Global" })) {
      options.push({ value: code, label, count: counts.get(code) ?? 0 });
      seen.add(code);
    }

    for (const item of marketAggregation) {
      if (!item.value || seen.has(item.value)) continue;
      options.push({ value: item.value, label: getMarketLabel(item.value), count: item.count });
      seen.add(item.value);
    }

    for (const selected of marketFilter) {
      if (!seen.has(selected)) {
        options.push({ value: selected, label: getMarketLabel(selected), count: 0 });
        seen.add(selected);
      }
    }

    return options.sort((a, b) => {
      const countDiff = (b.count ?? 0) - (a.count ?? 0);
      return countDiff !== 0 ? countDiff : a.label.localeCompare(b.label);
    });
  }, [marketAggregation, marketFilter]);

  const industryFilterOptions = useMemo(() => {
    const counts = new Map(industryAggregation.map((item) => [item.value, item.count]));
    const options: FilterOption[] = [];

    for (const item of industryAggregation) {
      if (!item.value) continue;
      options.push({ value: item.value, label: getIndustryLabel(item.value), count: item.count });
    }

    for (const selected of industryFilter) {
      if (!counts.has(selected)) {
        options.push({ value: selected, label: getIndustryLabel(selected), count: 0 });
      }
    }

    return options.sort((a, b) => {
      const countDiff = (b.count ?? 0) - (a.count ?? 0);
      return countDiff !== 0 ? countDiff : a.label.localeCompare(b.label);
    });
  }, [industryAggregation, industryFilter]);

  const topIndustries = useMemo(() => industriesSummary.slice(0, 6), [industriesSummary]);

  const totalPages = pagination?.totalPages ?? 1;
  const totalCount = pagination?.total ?? companies.length;

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchValue(searchInput);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchValue("");
    setClassFilter([]);
    setSubClassFilter([]);
    setMarketFilter([]);
    setIndustryFilter([]);
    setNeedsReviewFilter("");
    setPage(1);
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString("pl-PL", { year: "numeric", month: "short", day: "numeric" });
    } catch (error) {
      return value;
    }
  };

  const renderClassificationBadge = (company: CompanyItem) => {
    const classLabel = company.classificationClass
      ? CLASS_LABELS[company.classificationClass] ?? company.classificationClass
      : null;
    const hasReviewFlag = Boolean(company.classificationNeedsReview);
    const confidence =
      typeof company.classificationConfidence === "number"
        ? Number.isFinite(company.classificationConfidence)
          ? company.classificationConfidence
          : null
        : null;

    let matches = company.classificationSignals
      .map((signal) => {
        const [source, code, rawScore] = signal.split(":");
        if (source !== "industry-rule" || !code) {
          return null;
        }
        const score = Number(rawScore);
        const info = getSpecializationInfo(code);
        return {
          code,
          label: info.label,
          score: Number.isFinite(score) ? score : 0,
          isPrimary: company.classificationSubClass === code,
          meetsThreshold: Number.isFinite(score) && score >= 3,
        };
      })
      .filter(
        (item): item is {
          code: string;
          label: string;
          score: number;
          isPrimary: boolean;
          meetsThreshold: boolean;
        } => Boolean(item)
      )
      .sort((a, b) => b.score - a.score);

    if (matches.length === 0 && company.classificationSubClass) {
      const info = getSpecializationInfo(company.classificationSubClass);
      matches = [
        {
          code: company.classificationSubClass,
          label: info.label,
          score:
            typeof company.classificationConfidence === "number" && Number.isFinite(company.classificationConfidence)
              ? company.classificationConfidence
              : 0,
          isPrimary: true,
          meetsThreshold: true,
        },
      ];
    }

    if (!classLabel && matches.length === 0) {
      return <span style={{ color: "#9CA3AF" }}>Brak oznaczeń</span>;
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {classLabel && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "9999px",
              backgroundColor: "#EEF2FF",
              color: "#4338CA",
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {classLabel}
            {confidence != null && (
              <span style={{ color: "#6B7280", fontSize: "0.7rem", fontWeight: 500 }}>
                score {confidence.toFixed(1)}
              </span>
            )}
            {hasReviewFlag && (
              <span style={{ color: "#B91C1C", fontSize: "0.7rem", fontWeight: 700 }}>• Review</span>
            )}
          </span>
        )}

        {matches.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {matches.map((match) => (
              <div
                key={`${company.id}-${match.code}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  fontSize: "0.82rem",
                  color: match.isPrimary ? "#111827" : match.meetsThreshold ? "#1F2937" : "#6B7280",
                }}
              >
                <span style={{ fontWeight: match.isPrimary ? 600 : 500 }}>{match.label}</span>
                <span style={{ color: "#6B7280", fontSize: "0.75rem" }}>score {match.score}</span>
                {match.isPrimary ? (
                  <span
                    style={{
                      padding: "0.15rem 0.45rem",
                      borderRadius: "9999px",
                      backgroundColor: "#DCFCE7",
                      color: "#047857",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                    }}
                  >
                    główna
                  </span>
                ) : match.meetsThreshold ? (
                  <span
                    style={{
                      padding: "0.15rem 0.45rem",
                      borderRadius: "9999px",
                      backgroundColor: "#DBEAFE",
                      color: "#1D4ED8",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                    }}
                  >
                    aktywna
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <span style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>Brak dopasowań z reguł</span>
        )}
      </div>
    );
  };

  const toggleFilterValue = (
    value: string,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    setter((prev) => {
      const exists = prev.includes(value);
      const next = exists ? prev.filter((item) => item !== value) : [...prev, value];
      return next;
    });
    setPage(1);
  };

  type FilterOption = {
    value: string;
    label: string;
    count?: number;
  };

  type FilterOption = {
    value: string;
    label: string;
    count?: number;
  };

  const FilterRow = ({
    title,
    options,
    selected,
    onToggle,
    isFirst = false,
  }: {
    title: string;
    options: FilterOption[];
    selected: string[];
    onToggle: (value: string) => void;
    isFirst?: boolean;
  }) => {
    if (options.length === 0 && selected.length === 0) {
      return null;
    }

    return (
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          padding: "0.95rem 1.1rem",
          borderTop: isFirst ? "none" : "1px solid #E5E7EB",
          backgroundColor: "white",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            flex: "0 0 180px",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          {title}
        </div>
        <div
          style={{
            flex: "1 1 auto",
            display: "flex",
            gap: "0.5rem",
            overflowX: "auto",
            paddingBottom: "0.35rem",
          }}
        >
          {options.map((option) => {
            const isActive = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggle(option.value)}
                style={{
                  padding: "0.45rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid",
                  borderColor: isActive ? "#2563EB" : "#D1D5DB",
                  backgroundColor: isActive ? "#2563EB" : "white",
                  color: isActive ? "white" : "#1F2937",
                  fontSize: "0.84rem",
                  fontWeight: 500,
                  cursor: isActive ? "pointer" : "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {option.label}
                {typeof option.count === "number" && (
                  <span style={{ marginLeft: "0.35rem", fontWeight: 600 }}>({option.count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <div style={{ fontSize: "0.85rem", color: "#6B7280", marginBottom: "0.35rem" }}>Proces 1 ▸ Przegląd bazy</div>
        <h1 style={{ fontSize: "1.9rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>Przegląd bazy firm</h1>
        <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "#374151", maxWidth: "760px" }}>
          To jest centralne miejsce do monitorowania jakości danych. Skorzystaj z filtrów, aby wyszukać konkretne firmy,
          skontrolować oznaczenia segmentów, uzupełnić braki lub przygotować listę rekordów do dalszej pracy.
        </p>
      </div>

      <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div
          style={{
            borderRadius: "0.75rem",
            border: "1px solid #E5E7EB",
            backgroundColor: "white",
            padding: "1.4rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
          }}
        >
          <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>Łącznie firm</span>
          <span style={{ fontSize: "2rem", fontWeight: 700, color: "#111827" }}>
            {summaryLoading ? "…" : totalCount.toLocaleString("pl-PL")}
          </span>
          <span style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>Na podstawie segmentacji w systemie</span>
        </div>

        {classStats.map((entry) => (
          <div
            key={entry.classCode}
            style={{
              borderRadius: "0.75rem",
              border: "1px solid #E5E7EB",
              backgroundColor: "white",
              padding: "1.4rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>{entry.label}</span>
            <span style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111827" }}>
              {summaryLoading ? "…" : entry.count.toLocaleString("pl-PL")}
            </span>
            {entry.review > 0 && (
              <span style={{ fontSize: "0.8rem", color: "#B91C1C" }}>
                Review: {entry.review.toLocaleString("pl-PL")}
              </span>
            )}
          </div>
        ))}
      </section>

      {topIndustries.length > 0 && (
        <section
          style={{
            borderRadius: "0.75rem",
            border: "1px solid #E5E7EB",
            backgroundColor: "white",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827", marginBottom: "0.75rem" }}>
            Najliczniejsze branże
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {topIndustries.map((industry) => (
              <span
                key={industry.industry}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "0.65rem",
                  backgroundColor: "#F3F4F6",
                  color: "#374151",
                  fontSize: "0.85rem",
                }}
              >
                {industry.industry}
                <span style={{ fontWeight: 600, color: "#1F2937" }}>{industry.count}</span>
              </span>
            ))}
            {industriesSummary.length > topIndustries.length && (
              <Link
                href="/company-selection/processes/import"
                style={{
                  textDecoration: "underline",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "#2563EB",
                  alignSelf: "center",
                }}
              >
                Pełna lista w ustawieniach klasyfikacji
              </Link>
            )}
          </div>
        </section>
      )}

      <section
        style={{
          borderRadius: "0.75rem",
          border: "1px solid #E5E7EB",
          backgroundColor: "white",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.2rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#111827" }}>Filtry i wyszukiwanie</h2>
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Szukaj po nazwie, opisie, działalności"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              style={{
                flex: "1 1 240px",
                minWidth: "240px",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.9rem",
              }}
            />
            <select
              value={needsReviewFilter}
              onChange={(event) => {
                setNeedsReviewFilter(event.target.value);
                setPage(1);
              }}
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.9rem",
                minWidth: "180px",
              }}
            >
              {NEEDS_REVIEW_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              style={{
                padding: "0.65rem 1.1rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "#2563EB",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Szukaj
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                padding: "0.65rem 1.1rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                backgroundColor: "white",
                color: "#374151",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Wyczyść
            </button>
          </form>
        </div>

        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "0.75rem",
            overflow: "hidden",
            backgroundColor: "white",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <FilterRow
            title="Klasy"
            options={classFilterOptions}
            selected={classFilter}
            onToggle={(value) => toggleFilterValue(value, setClassFilter)}
            isFirst
          />
          <FilterRow
            title="Specjalizacje"
            options={specializationOptions.map(({ value, label, count }) => ({
              value,
              label,
              count,
            }))}
            selected={subClassFilter}
            onToggle={(value) => toggleFilterValue(value, setSubClassFilter)}
          />
          <FilterRow
            title="Rynki"
            options={marketFilterOptions}
            selected={marketFilter}
            onToggle={(value) => toggleFilterValue(value, setMarketFilter)}
          />
          <FilterRow
            title="Branże"
            options={industryFilterOptions}
            selected={industryFilter}
            onToggle={(value) => toggleFilterValue(value, setIndustryFilter)}
          />
        </div>

        <div style={{ borderRadius: "0.75rem", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.9rem 1.2rem", backgroundColor: "#F9FAFB" }}>
              <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>
                Łącznie rekordów: {totalCount?.toLocaleString("pl-PL")}
              </span>
              <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>
                Strona {page} z {totalPages}
              </span>
            </div>

          {tableLoading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>Ładowanie danych…</div>
          ) : error ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#B91C1C" }}>
              Błąd pobierania danych: {error}
            </div>
          ) : companies.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
              Brak firm spełniających kryteria filtrów
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ backgroundColor: "#F9FAFB" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Firma</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Opis</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Segment / Specjalizacja</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Branża</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Import</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company, index) => (
                  <tr
                    key={company.id}
                    style={{
                      backgroundColor: index % 2 === 0 ? "white" : "#F9FAFB",
                      borderTop: "1px solid #E5E7EB",
                    }}
                  >
                    <td style={{ padding: "0.85rem", verticalAlign: "top", width: "22%" }}>
                      <div style={{ fontWeight: 600, color: "#111827", marginBottom: "0.25rem" }}>{company.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "#6B7280", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {company.market && <span>{getMarketLabel(company.market)}</span>}
                        {company.country && <span>{company.country}</span>}
                        {company.city && <span>{company.city}</span>}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: "0.35rem" }}>
                        Dodano: {formatDate(company.createdAt)} • Aktualizacja: {formatDate(company.updatedAt)}
                      </div>
                    </td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", width: "28%" }}>
                      {company.activityDescription || company.description ? (
                        <div style={{ ...DESCRIPTION_STYLE, WebkitLineClamp: 5 as any }}>
                          {[
                            company.activityDescription,
                            company.description,
                          ]
                            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
                            .join(" \n")}
                        </div>
                      ) : (
                        <span style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>Brak opisu</span>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", width: "22%" }}>{renderClassificationBadge(company)}</td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", color: "#1F2937", width: "14%" }}>
                      {company.industry ? getIndustryLabel(company.industry) : <span style={{ color: "#9CA3AF" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", width: "14%" }}>
                      {company.importBatch ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", color: "#374151" }}>
                          <span>{company.importBatch.name}</span>
                          <span style={{ color: "#6B7280", fontSize: "0.75rem" }}>
                            {company.importBatch.language} • {company.importBatch.market}
                          </span>
                          <span style={{ color: "#9CA3AF", fontSize: "0.75rem" }}>
                            {formatDate(company.importBatch.createdAt)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>
            Wyświetlono {companies.length} z {totalCount?.toLocaleString("pl-PL")}
          </span>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1 || tableLoading}
              style={{
                padding: "0.55rem 0.9rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                backgroundColor: page === 1 || tableLoading ? "#F3F4F6" : "white",
                color: "#374151",
                cursor: page === 1 || tableLoading ? "not-allowed" : "pointer",
              }}
            >
              Poprzednia
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || tableLoading}
              style={{
                padding: "0.55rem 0.9rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                backgroundColor: page >= totalPages || tableLoading ? "#F3F4F6" : "white",
                color: "#374151",
                cursor: page >= totalPages || tableLoading ? "not-allowed" : "pointer",
              }}
            >
              Następna
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
