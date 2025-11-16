"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PreviewTable } from "../components/PreviewTable";

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

type SpecializationOption = {
  code: string;
  label: string;
  companyClass: string;
};

type PreviewCompany = {
  id: number;
  name: string;
  industry: string | null;
  market: string | null;
  description?: string | null;
  activityDescription?: string | null;
  keywords?: string | null;
  verificationStatus: string | null;
  importBatch?: {
    id: number;
    name: string;
    language: string;
    market: string;
  } | null;
  classifications?: Array<{
    specializationCode: string;
    score: number;
    confidence: number | null;
    isPrimary: boolean;
    reason?: string | null;
  }>;
};

type SelectionListItem = {
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
  PS: "PS – Pośrednicy",
  WK: "WK – Wykonawcy",
  WKK: "WKK – Wartościowi klienci końcowi",
};

const SUBCLASS_LABELS: Record<string, string> = {
  PS_AGENCY: "Agencja reklamowa",
  PS_LARGE_FORMAT_PRINT: "Drukarnia wielkoformatowa",
  PS_ONLINE_SELLER: "Sprzedawca internetowy",
  PS_AD_PRODUCER: "Producent reklam",
  PS_DISPLAY: "Display",
  PS_FOREIGN_BROKER: "Pośrednik zagraniczny",
  WK_TRADESHOW_BUILDER: "Wykonawca stoisk targowych",
  WK_EVENT_COMPANY: "Firma eventowa",
  WK_RETAIL_FITOUT: "Wykonawca Retail",
  WK_POS_PRODUCER: "Producent POS",
  WK_FURNITURE_PRODUCER: "Producent mebli",
  WK_RETAIL_EQUIPMENT: "Producent wyposażenia Retail",
  WK_BRANDING_STUDIO: "Firma projektowa / Branding",
  WK_ARCHITECTURE: "Architektura",
  WK_FITOUT_CONTRACTOR: "Firma wykończeniowa / Fit-out",
  WKK_RETAIL_CHAIN: "Sieci handlowe",
  WKK_CONSUMER_BRAND: "Marka konsumencka",
  WKK_SHOPPING_MALL: "Galerie handlowe",
  WKK_OFFICE_CORPORATE: "Biura i korporacje",
  WKK_HOSPITALITY: "Hotele i Restauracje",
  WKK_AUTO_DEALER: "Salony samochodowe",
  WKK_RETAIL_STORE: "Salony sprzedaży",
};

const SUBCLASS_CLASS_MAP: Record<string, string> = {
  PS_AGENCY: "PS",
  PS_LARGE_FORMAT_PRINT: "PS",
  PS_ONLINE_SELLER: "PS",
  PS_AD_PRODUCER: "PS",
  PS_DISPLAY: "PS",
  PS_FOREIGN_BROKER: "PS",
  WK_TRADESHOW_BUILDER: "WK",
  WK_EVENT_COMPANY: "WK",
  WK_RETAIL_FITOUT: "WK",
  WK_POS_PRODUCER: "WK",
  WK_FURNITURE_PRODUCER: "WK",
  WK_RETAIL_EQUIPMENT: "WK",
  WK_BRANDING_STUDIO: "WK",
  WK_ARCHITECTURE: "WK",
  WK_FITOUT_CONTRACTOR: "WK",
  WKK_RETAIL_CHAIN: "WKK",
  WKK_CONSUMER_BRAND: "WKK",
  WKK_SHOPPING_MALL: "WKK",
  WKK_OFFICE_CORPORATE: "WKK",
  WKK_HOSPITALITY: "WKK",
  WKK_AUTO_DEALER: "WKK",
  WKK_RETAIL_STORE: "WKK",
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
  const searchParams = useSearchParams();
  const isCreateMode = (searchParams.get("create") ?? "") === "1";
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [industries, setIndustries] = useState<IndustrySummary[]>([]);
  const [initialIndustries, setInitialIndustries] = useState<IndustrySummary[]>([]);
  const [batches, setBatches] = useState<ImportBatchOption[]>([]);
  const [specializations, setSpecializations] = useState<SpecializationOption[]>([]);
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
  // NOWE FILTRY AI - wartości domyślne z ustaleń
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageOption[]>([]);
  const [onlyPrimary, setOnlyPrimary] = useState(true);
  const [minScore, setMinScore] = useState<number>(3);
  const [minConfidence, setMinConfidence] = useState<number>(0.6);
  const [countLoading, setCountLoading] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [previewCompanies, setPreviewCompanies] = useState<PreviewCompany[]>([]);
  const [previewTotals, setPreviewTotals] = useState<{ total: number; afterExclusions: number }>({
    total: 0,
    afterExclusions: 0,
  });
  const [specCounts, setSpecCounts] = useState<Record<string, number>>({});
  const [previewPage, setPreviewPage] = useState(1);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const PREVIEW_PAGE_SIZE = 50;
  const [expandedPreview, setExpandedPreview] = useState<Set<number>>(new Set());
  const [excludeCompanyIds, setExcludeCompanyIds] = useState<Set<number>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [selectionSaved, setSelectionSaved] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);

  // Grupowanie specjalizacji: PS / WK / WKK (z podgrupą Retail dla WKK)
  type GroupKey = "PS" | "WK" | "WKK_RETAIL" | "WKK_OTHER";
  const [collapsedGroups, setCollapsedGroups] = useState<Record<GroupKey, boolean>>({
    PS: false,
    WK: false,
    WKK_RETAIL: false,
    WKK_OTHER: false,
  });

  const groupedSpecializations = useMemo(() => {
    const groups: Record<GroupKey, SpecializationOption[]> = {
      PS: [],
      WK: [],
      WKK_RETAIL: [],
      WKK_OTHER: [],
    };
    for (const s of specializations) {
      if (s.companyClass === "PS") {
        groups.PS.push(s);
      } else if (s.companyClass === "WK") {
        groups.WK.push(s);
      } else if (s.companyClass === "WKK") {
        if (s.code.startsWith("WKK_RETAIL_")) {
          groups.WKK_RETAIL.push(s);
        } else {
          groups.WKK_OTHER.push(s);
        }
      }
    }
    // Sortuj alfabetycznie w grupach
    (Object.keys(groups) as GroupKey[]).forEach((k) => {
      groups[k] = groups[k].slice().sort((a, b) => a.label.localeCompare(b.label, "pl"));
    });
    return groups;
  }, [specializations]);

  const toggleGroupCollapse = (key: GroupKey) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const selectGroup = (key: GroupKey) => {
    const codes = new Set(selectedSubSegments);
    groupedSpecializations[key].forEach((s) => codes.add(s.code));
    setSelectedSubSegments(Array.from(codes));
  };
  const clearGroup = (key: GroupKey) => {
    const codesToRemove = new Set(groupedSpecializations[key].map((s) => s.code));
    setSelectedSubSegments((prev) => prev.filter((c) => !codesToRemove.has(c)));
  };

  // Buduje listę stron z elipsami (np. 1 … 5 6 7 … 20)
  const buildPageList = (total: number, current: number): Array<number | string> => {
    const pages: Array<number | string> = [];
    if (!Number.isFinite(total) || total <= 0) return [1];
    if (total <= 9) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }
    const add = (p: number | string) => pages.push(p);
    add(1);
    if (current > 4) add("…");
    const start = Math.max(2, current - 2);
    const end = Math.min(total - 1, current + 2);
    for (let i = start; i <= end; i++) add(i);
    if (current < total - 3) add("…");
    add(total);
    return pages;
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [summaryResponse, batchesResponse, specsResponse] = await Promise.all([
          fetch("/api/company-selection/segments-summary"),
          fetch("/api/company-selection/imports?limit=500"),
          fetch("/api/company-selection/specializations"),
        ]);

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setSegments(summaryData.segments ?? []);
          setIndustries(summaryData.industries ?? []);
          setInitialIndustries(summaryData.industries ?? []);
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
        if (specsResponse.ok) {
          const specsData = await specsResponse.json();
          const list: SpecializationOption[] = Array.isArray(specsData?.specializations)
            ? specsData.specializations.map((s: any) => ({
                code: s.code,
                label: s.label,
                companyClass: s.companyClass,
              }))
            : [];
          setSpecializations(list);
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

  useEffect(() => {
    if (loading) {
      return;
    }

    const controller = new AbortController();

    async function refreshCounts() {
      try {
        setCountLoading(true);
        setCountError(null);

        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "1");

        if (market) {
          params.append("market", market);
        }

        selectedSegments.forEach((value) => {
          params.append("classificationClass", value);
        });

        selectedSubSegments.forEach((value) => {
          params.append("classificationSubClass", value);
        });

        selectedIndustries.forEach((value) => {
          params.append("industry", value);
        });

        if (selectedBatchIds.length === 1) {
          params.append("importBatchId", String(selectedBatchIds[0]));
        }

        if (onlyNeedsReview) {
          params.set("needsReview", "true");
        }

        const response = await fetch(`/api/company-selection/list?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        const subClassAggregation = Array.isArray(data?.aggregations?.subClass)
          ? data.aggregations.subClass
          : [];

        const nextSegments: SegmentSummary[] = subClassAggregation
          .map((entry: any) => {
            if (!entry?.value) return null;
            const code = String(entry.value);
            return {
              class: SUBCLASS_CLASS_MAP[code] ?? null,
              subClass: code,
              count: Number(entry.count ?? 0),
              needsReviewCount: 0,
            } as SegmentSummary;
          })
          .filter((item): item is SegmentSummary => Boolean(item));

        const knownSpecializations = new Set(
          nextSegments.map((item) => item.subClass).filter((value): value is string => Boolean(value))
        );
        Object.keys(SUBCLASS_LABELS).forEach((code) => {
          if (!knownSpecializations.has(code)) {
            nextSegments.push({
              class: SUBCLASS_CLASS_MAP[code] ?? null,
              subClass: code,
              count: 0,
              needsReviewCount: 0,
            });
          }
        });

        const classesPresent = new Set(
          nextSegments.map((item) => item.class).filter((value): value is string => Boolean(value))
        );

        Object.keys(CLASS_LABELS).forEach((classCode) => {
          if (!classesPresent.has(classCode)) {
            nextSegments.push({
              class: classCode,
              subClass: null,
              count: 0,
              needsReviewCount: 0,
            });
          }
        });

        setSegments(nextSegments);

        const industryAggregation = Array.isArray(data?.aggregations?.industry)
          ? data.aggregations.industry
          : [];

        const industryCountMap = new Map<string, number>();
        initialIndustries.forEach((item) => {
          industryCountMap.set(item.industry, 0);
        });

        industryAggregation.forEach((entry: any) => {
          if (!entry?.value) return;
          const key = String(entry.value);
          industryCountMap.set(key, Number(entry.count ?? 0));
        });

        const nextIndustries: IndustrySummary[] = Array.from(industryCountMap.entries())
          .map(([industry, count]) => ({ industry, count }))
          .sort((a, b) => b.count - a.count || a.industry.localeCompare(b.industry));

        setIndustries(nextIndustries);
      } catch (error) {
        if ((error as any)?.name === "AbortError") {
          return;
        }
        setCountError(error instanceof Error ? error.message : String(error));
      } finally {
        setCountLoading(false);
      }
    }

    refreshCounts();

    return () => {
      controller.abort();
    };
  }, [
    loading,
    market,
    selectedSegments,
    selectedSubSegments,
    selectedIndustries,
    selectedBatchIds,
    onlyNeedsReview,
    initialIndustries,
  ]);

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
          page: previewPage,
          pageSize: PREVIEW_PAGE_SIZE,
          filters: {
            specializationCodes: selectedSubSegments,
            onlyPrimary,
            minScore,
            minConfidence,
            languages: selectedLanguages,
            importBatchIds: selectedBatchIds,
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
      setPreviewTotalPages(data.totalPages ?? 1);
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
            specializationCodes: selectedSubSegments,
            onlyPrimary,
            minScore,
            minConfidence,
            languages: selectedLanguages,
            importBatchIds: selectedBatchIds,
          },
          excludeCompanyIds: Array.from(excludeCompanyIds),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.details || "Błąd tworzenia selekcji");
      }

      setFormSuccess(`Selekcja "${data.selection?.name}" została utworzona.`);
      setSelectionSaved(true);
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

  // Reset selectionSaved gdy użytkownik zmienia dane
  useEffect(() => {
    if (selectionSaved) {
      setSelectionSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, market, language, selectedSubSegments, selectedLanguages, selectedBatchIds, onlyPrimary, minScore, minConfidence, excludeCompanyIds.size]);

  // Live-podgląd: automatycznie odświeżaj przy zmianie progów/filtrów (z debouncem)
  useEffect(() => {
    if (loading) return;
    const debounce = setTimeout(() => {
      setPreviewPage(1);
      void handlePreview();
    }, 350);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubSegments, selectedLanguages, selectedBatchIds, onlyPrimary, minScore, minConfidence, market]);

  // Liczniki per specjalizacja (dla aktualnych filtrów, bez wymogu wybranej specjalizacji)
  useEffect(() => {
    if (loading) return;
    const controller = new AbortController();
    const run = async () => {
      try {
        const response = await fetch("/api/company-selection/selections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            mode: "specCounts",
            market,
            filters: {
              // Nie przekazujemy specializationCodes – backend liczy globalnie dla filtrów
              onlyPrimary,
              minScore,
              minConfidence,
              languages: selectedLanguages,
              importBatchIds: selectedBatchIds,
            },
          }),
        });
        const data = await response.json();
        if (response.ok && data?.success) {
          setSpecCounts(data.counts ?? {});
        }
      } catch {
        // cicho ignorujemy błędy liczników
      }
    };
    run();
    return () => controller.abort();
  }, [loading, market, selectedLanguages, selectedBatchIds, onlyPrimary, minScore, minConfidence]);

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
    // Czyść tylko progi AI i przełącznik "Tylko główna"
    setMinScore(3);
    setMinConfidence(0.6);
    setOnlyPrimary(true);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1280px", margin: "0 auto" }}>
      <Link
        href="/company-selection/processes/selections"
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
        ← Powrót do procesu selekcji
      </Link>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        {isCreateMode ? "Nowa baza firm" : "Zapisane selekcje"}
      </h1>

      {isCreateMode ? (
        <>
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
          onClick={() => setInfoExpanded(!infoExpanded)}
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
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827", margin: 0 }}>
            Do czego służy ta strona? {infoExpanded ? "▼" : "▶"}
          </h2>
        </button>

        {infoExpanded ? (
          <div style={{ marginTop: "1rem" }}>
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
        ) : null}
      </div>

      <div style={{ display: "grid", gap: "1.5rem" }}>
        {/* Sekcja danych selekcji – przeniesiona powyżej Parametrów selekcji */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Dane selekcji</h2>
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
              <label style={labelStyle}>
                Rynek *
                <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#6B7280", marginLeft: "0.5rem" }}>
                  Kraj lub region (PL, DE, FR, EN)
                </span>
              </label>
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
        </section>

        {/* Nowa sekcja: Zapis selekcji (przeniesiona pod Dane selekcji) */}
        <section
            style={{
            ...cardStyle,
            backgroundColor: "#D1FAE5", // ciemniejsza zieleń niż wcześniej
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
              onClick={handleCreateSelection}
                disabled={createLoading || loading || !name.trim() || selectedSubSegments.length === 0}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                  backgroundColor: createLoading || !name.trim() || selectedSubSegments.length === 0 ? "#9CA3AF" : "#059669", // szary gdy disabled, zielony gdy aktywny
                color: "#FFFFFF",
                fontWeight: 700,
                  cursor: createLoading || !name.trim() || selectedSubSegments.length === 0 ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {createLoading ? "Tworzę..." : "Zapisz selekcję"}
            </button>
            )}
            <div style={{ height: "1.25rem", width: "1px", background: "#10B981" }} />
            <div style={{ color: "#064E3B", fontSize: "0.9rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ whiteSpace: "nowrap" }}><strong>Nazwa:</strong> {name || "—"}</span>
              <span style={{ whiteSpace: "nowrap" }}><strong>Rynek/Język:</strong> {market} • {language}</span>
              <span style={{ whiteSpace: "nowrap" }}><strong>Firm po wykl.:</strong> {previewTotals.afterExclusions.toLocaleString("pl-PL")}</span>
              <span style={{ whiteSpace: "nowrap" }}><strong>Specjalizacje:</strong> {selectedSubSegments.length}</span>
              </div>
            </div>
        </section>

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

          {/* 3. linia: Języki (multi) i Partie importu (multi) */}
          <div
            style={{
              marginTop: "0.75rem",
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "repeat(2, minmax(260px, 1fr))",
            }}
          >
            <div>
              <label style={labelStyle}>
                Języki (multi)
              </label>
              <div style={{ maxHeight: "220px", overflowY: "auto", paddingRight: "0.5rem" }}>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
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
                      checked={selectedLanguages.includes(opt.value)}
                      onChange={() =>
                        setSelectedLanguages((state) =>
                          state.includes(opt.value)
                            ? (state.filter((v) => v !== opt.value) as LanguageOption[])
                            : ([...state, opt.value] as LanguageOption[])
                        )
                      }
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>
                Partie importu
                <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#6B7280", marginLeft: "0.5rem" }}>
                  Z jakiego pliku CSV pochodzi firma
                </span>
              </label>
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

          <hr style={{ margin: "1.5rem 0", borderTop: "1px solid #E5E7EB" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h3 style={{ ...sectionTitleStyle, fontSize: "1.1rem", marginBottom: 0 }}>Filtry AI</h3>
            {countLoading && (<span style={{ fontSize: "0.8rem", color: "#6B7280" }}>Aktualizuję liczniki…</span>)}
          </div>

          {/* 1. linia: Specjalizacje, Języki, Partie importu */}
          <div
                    style={{
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            <div>
              <label style={labelStyle}>Specjalizacje (multi)</label>
              {/* 3-4 kolumny z grupami */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(280px, 1fr))", gap: "0.75rem" }}>
                {/* PS */}
                <div style={{ border: "1px solid #E5E7EB", borderRadius: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    <strong>PS – Pośrednicy</strong>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button type="button" onClick={() => clearGroup("PS")} style={{ border: "1px solid #D1D5DB", background: "white", borderRadius: "0.35rem", padding: "0.2rem 0.45rem", fontSize: "0.75rem", cursor: "pointer" }}>Wyczyść</button>
                    </div>
                  </div>
                  {!collapsedGroups.PS && (
                    <div style={{ maxHeight: "220px", overflowY: "auto", padding: "0.5rem 0.75rem" }}>
                      {groupedSpecializations.PS.map((s) => (
                        <label key={s.code} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer" }}>
                          <input type="checkbox" checked={selectedSubSegments.includes(s.code)} onChange={() => setSelectedSubSegments((state) => toggleSelection(state, s.code))} />
                          <span>{s.label}{typeof specCounts[s.code] === "number" ? ` (${specCounts[s.code]})` : ""}</span>
                  </label>
                ))}
              </div>
                  )}
            </div>
                {/* WK */}
                <div style={{ border: "1px solid #E5E7EB", borderRadius: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    <strong>WK – Wykonawcy</strong>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button type="button" onClick={() => clearGroup("WK")} style={{ border: "1px solid #D1D5DB", background: "white", borderRadius: "0.35rem", padding: "0.2rem 0.45rem", fontSize: "0.75rem", cursor: "pointer" }}>Wyczyść</button>
                    </div>
                  </div>
                  {!collapsedGroups.WK && (
                    <div style={{ maxHeight: "220px", overflowY: "auto", padding: "0.5rem 0.75rem" }}>
                      {groupedSpecializations.WK.map((s) => (
                        <label key={s.code} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer" }}>
                          <input type="checkbox" checked={selectedSubSegments.includes(s.code)} onChange={() => setSelectedSubSegments((state) => toggleSelection(state, s.code))} />
                          <span>{s.label}{typeof specCounts[s.code] === "number" ? ` (${specCounts[s.code]})` : ""}</span>
                  </label>
                ))}
                    </div>
                  )}
                </div>
                {/* WKK */}
                <div style={{ border: "1px solid #E5E7EB", borderRadius: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    <strong>WKK – Sieci detaliczne</strong>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          clearGroup("WKK_RETAIL");
                          clearGroup("WKK_OTHER");
                        }}
                        style={{ border: "1px solid #D1D5DB", background: "white", borderRadius: "0.35rem", padding: "0.2rem 0.45rem", fontSize: "0.75rem", cursor: "pointer" }}
                      >
                        Wyczyść
                      </button>
                    </div>
                  </div>
                  <div style={{ maxHeight: "220px", overflowY: "auto", padding: "0.5rem 0.75rem" }}>
                    {/* Retail */}
                    {!collapsedGroups.WKK_RETAIL && (
                      <div style={{ marginBottom: "0.5rem" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: "0.35rem" }}>
                          Retail
                        </div>
                        {groupedSpecializations.WKK_RETAIL.map((s) => (
                          <label key={s.code} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer" }}>
                            <input type="checkbox" checked={selectedSubSegments.includes(s.code)} onChange={() => setSelectedSubSegments((state) => toggleSelection(state, s.code))} />
                            <span>{s.label}{typeof specCounts[s.code] === "number" ? ` (${specCounts[s.code]})` : ""}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {/* Pozostałe */}
                    {!collapsedGroups.WKK_OTHER && (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: "0.35rem" }}>
                          Pozostałe
                        </div>
                        {groupedSpecializations.WKK_OTHER.map((s) => (
                          <label key={s.code} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer" }}>
                            <input type="checkbox" checked={selectedSubSegments.includes(s.code)} onChange={() => setSelectedSubSegments((state) => toggleSelection(state, s.code))} />
                            <span>{s.label}{typeof specCounts[s.code] === "number" ? ` (${specCounts[s.code]})` : ""}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Pasek wybranych – przeniesiony poniżej listy specjalizacji i jako separator nad sekcją progów */}
              {selectedSubSegments.length > 0 && (
                <div style={{ marginTop: "0.75rem", paddingTop: "0.6rem", borderTop: "1px solid #E5E7EB", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  {selectedSubSegments.map((code) => {
                    const spec = specializations.find((s) => s.code === code);
                    return (
                      <span key={code} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.25rem 0.5rem", borderRadius: "999px", background: "#EEF2FF", color: "#1E40AF", fontSize: "0.8rem" }}>
                        {spec?.label ?? code}
                        <button
                          type="button"
                          onClick={() => setSelectedSubSegments((prev) => prev.filter((c) => c !== code))}
                          style={{ border: "none", background: "transparent", color: "#1E40AF", cursor: "pointer" }}
                          aria-label={`Usuń ${code}`}
                          title="Usuń"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setSelectedSubSegments([])}
                    style={{ marginLeft: "0.25rem", border: "1px solid #D1D5DB", background: "white", color: "#374151", borderRadius: "0.4rem", padding: "0.25rem 0.5rem", fontSize: "0.8rem", cursor: "pointer" }}
                  >
                    Wyczyść
                  </button>
                </div>
              )}
            </div>

            
          </div>

          {/* 2. linia: Minimalny wynik, Minimalna pewność, Tylko główna */}
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid #E5E7EB",
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "repeat(3, minmax(220px, 1fr))",
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelStyle}>Minimalny wynik (1–5)</label>
              <div style={{ fontSize: "0.8rem", color: "#6B7280", marginBottom: "0.35rem" }}>
                Filtruje firmy na podstawie oceny dopasowania AI do wybranych specjalizacji. Pokażemy tylko te firmy,
                dla których przynajmniej jedna klasyfikacja spełnia próg (score ≥ wartość suwaka).
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={minScore}
                  onChange={(e) => setMinScore(Math.max(1, Math.min(5, Number(e.target.value) || 0)))}
                  style={{ width: "100%" }}
                />
                <span style={{ width: "2rem", textAlign: "right", color: "#111827" }}>{minScore}</span>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Minimalna pewność (0.0–1.0)</label>
              <div style={{ fontSize: "0.8rem", color: "#6B7280", marginBottom: "0.35rem" }}>
                Filtruje firmy wg pewności klasyfikacji AI. Pokażemy tylko te dopasowania, których confidence jest
                nie mniejsze niż ustawiona wartość (confidence ≥ wartość suwaka).
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Math.max(0, Math.min(1, Number(e.target.value) || 0)))}
                  style={{ width: "100%" }}
                />
                <span style={{ width: "3rem", textAlign: "right", color: "#111827" }}>
                  {minConfidence.toFixed(2)}
                      </span>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Tylko główna</label>
              <div style={{ fontSize: "0.8rem", color: "#6B7280", marginBottom: "0.35rem" }}>
                Włącz, aby uwzględniać wyłącznie główną specjalizację nadaną przez AI (isPrimary = true).
                Alternatywne klasyfikacje będą ukryte.
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" checked={onlyPrimary} onChange={(e) => setOnlyPrimary(e.target.checked)} />
                <span>Uwzględnij wyłącznie główne specjalizacje</span>
            </label>
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
            {/* Przycisk zapisu przeniesiony do sekcji "Zapis selekcji" niżej */}
          </div>
          {/* Informacja o liczbie wyników – na końcu sekcji Parametry selekcji */}
          <div style={{ marginTop: "1rem", color: "#374151", fontSize: "0.95rem" }}>
            Wyselekcjonowano: <strong>{previewTotals.afterExclusions.toLocaleString("pl-PL")}</strong> firm
          </div>
        </section>

      {countError && (
        <section
          style={{
            borderRadius: "0.75rem",
            border: "1px solid #FCA5A5",
            backgroundColor: "#FEE2E2",
            padding: "0.75rem",
            color: "#B91C1C",
          }}
        >
          <strong>Błąd odświeżania liczników:</strong> {countError}
        </section>
      )}

        {previewCompanies.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div style={{ color: "#6B7280", fontSize: "0.9rem" }}>
              Łącznie: {previewTotals.afterExclusions.toLocaleString("pl-PL")} • Strona {previewPage} z {previewTotalPages} • {PREVIEW_PAGE_SIZE}/stronę
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
                onClick={() => { if (previewPage > 1) { setPreviewPage(previewPage - 1); void handlePreview(); } }}
                disabled={previewLoading || previewPage <= 1}
              style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #D1D5DB",
                  backgroundColor: previewPage <= 1 ? "#F3F4F6" : "white",
                  color: "#374151",
                  cursor: previewPage <= 1 ? "not-allowed" : "pointer",
                }}
              >
                ← Poprzednia
            </button>
              <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                {buildPageList(previewTotalPages, previewPage).map((item, idx) =>
                  typeof item === "number" ? (
            <button
                      key={`top-${item}-${idx}`}
              type="button"
                      onClick={() => { if (item !== previewPage) { setPreviewPage(item); void handlePreview(); } }}
                      disabled={previewLoading}
              style={{
                        padding: "0.35rem 0.6rem",
                        borderRadius: "0.4rem",
                        border: "1px solid #D1D5DB",
                        backgroundColor: item === previewPage ? "#2563EB" : "white",
                        color: item === previewPage ? "white" : "#374151",
                        cursor: previewLoading ? "not-allowed" : "pointer",
                        minWidth: "2rem",
                      }}
                    >
                      {item}
            </button>
                  ) : (
                    <span key={`dots-top-${idx}`} style={{ padding: "0 0.25rem", color: "#6B7280" }}>…</span>
                  )
                )}
          </div>
              <button
                type="button"
                onClick={() => { if (previewPage < previewTotalPages) { setPreviewPage(previewPage + 1); void handlePreview(); } }}
                disabled={previewLoading || previewPage >= previewTotalPages}
          style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #D1D5DB",
                  backgroundColor: previewPage >= previewTotalPages ? "#F3F4F6" : "white",
                  color: "#374151",
                  cursor: previewPage >= previewTotalPages ? "not-allowed" : "pointer",
                }}
              >
                Następna →
              </button>
            </div>
          </div>
      )}

        {previewCompanies.length > 0 && (
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Podgląd firm ({previewTotals.afterExclusions}/{previewTotals.total})</h2>
            <p style={{ marginBottom: "1rem", color: "#4B5563", fontSize: "0.9rem" }}>
              Zaznacz firmy, które chcesz wykluczyć przed zapisaniem selekcji.
            </p>
            <PreviewTable
              companies={previewCompanies as any}
              total={previewTotals.total}
              totalAfterExclusions={previewTotals.afterExclusions}
              page={previewPage}
              totalPages={previewTotalPages}
              pageSize={PREVIEW_PAGE_SIZE}
              onChangePage={(p) => { setPreviewPage(p); void handlePreview(); }}
              specializations={specializations}
              excludeCompanyIds={excludeCompanyIds}
              onToggleExclude={toggleExclude}
            />
          </section>
        )}

        {previewCompanies.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#6B7280", fontSize: "0.9rem" }}>
              Łącznie: {previewTotals.afterExclusions.toLocaleString("pl-PL")} • Strona {previewPage} z {previewTotalPages} • {PREVIEW_PAGE_SIZE}/stronę
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => { if (previewPage > 1) { setPreviewPage(previewPage - 1); void handlePreview(); } }}
                disabled={previewLoading || previewPage <= 1}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #D1D5DB",
                  backgroundColor: previewPage <= 1 ? "#F3F4F6" : "white",
                  color: "#374151",
                  cursor: previewPage <= 1 ? "not-allowed" : "pointer",
                }}
              >
                ← Poprzednia
              </button>
              <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                {buildPageList(previewTotalPages, previewPage).map((item, idx) =>
                  typeof item === "number" ? (
                    <button
                      key={`bot-${item}-${idx}`}
                      type="button"
                      onClick={() => { if (item !== previewPage) { setPreviewPage(item); void handlePreview(); } }}
                      disabled={previewLoading}
                      style={{
                        padding: "0.35rem 0.6rem",
                        borderRadius: "0.4rem",
                        border: "1px solid #D1D5DB",
                        backgroundColor: item === previewPage ? "#2563EB" : "white",
                        color: item === previewPage ? "white" : "#374151",
                        cursor: previewLoading ? "not-allowed" : "pointer",
                        minWidth: "2rem",
                      }}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={`dots-bottom-${idx}`} style={{ padding: "0 0.25rem", color: "#6B7280" }}>…</span>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => { if (previewPage < previewTotalPages) { setPreviewPage(previewPage + 1); void handlePreview(); } }}
                disabled={previewLoading || previewPage >= previewTotalPages}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #D1D5DB",
                  backgroundColor: previewPage >= previewTotalPages ? "#F3F4F6" : "white",
                  color: "#374151",
                  cursor: previewPage >= previewTotalPages ? "not-allowed" : "pointer",
                }}
              >
                Następna →
              </button>
            </div>
          </div>
        )}

        </div>
        </>
      ) : null}
        
      <div style={{ display: "grid", gap: "1.5rem" }}>
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
                      {(() => {
                        // 1) Pokaż wybrane specjalizacje z filters.specializationCodes (jeśli są)
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
                        // 2) Jeśli brak specjalizacji, pokaż ewentualne kryteria (jak dotychczas)
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
                        // 3) W przeciwnym razie pokaż placeholder
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


