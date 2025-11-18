"use client";

import React, {
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

const CLASSIFICATION_SOURCE_OPTIONS = [
  { value: "", label: "Wszystkie firmy" },
  { value: "AI", label: "Mają klasyfikację AI" },
  { value: "NOT_AI", label: "Nie mają klasyfikacji AI" },
] as const;

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

interface CompanyItem {
  id: number;
  name: string;
  industry: string | null;
  market: string | null;
  country: string | null;
  city: string | null;
  description: string | null;
  activityDescription: string | null;
  keywords: string | null;
  classificationClass: string | null;
  classificationSubClass: string | null;
  classificationConfidence: number | null;
  classificationNeedsReview: boolean | null;
  classifications?: Array<{
    id: number;
    specializationCode: string;
    score: number;
    confidence: number | null;
    isPrimary: boolean;
    reason: string | null;
    source: string;
  }>;
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

interface ImportBatchListItem {
  id: number;
  name: string;
  language: string;
  market: string;
  totalRows: number;
  processedRows: number;
  createdAt: string;
}

export default function CompanyClassificationPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<number>>(new Set());
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<{
    total: number;
    classified: number;
    skipped: number;
    errors: number;
    message: string;
  } | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    total: number;
    processed: number;
    current: number;
    classified: number;
    skipped: number;
    errors: number;
    status: "processing" | "completed" | "error" | "cancelled";
    currentCompanyName?: string;
    percentage: number;
    elapsed: number;
    remainingTime: number | null;
    errorDetails?: Array<{
      companyId: number;
      companyName: string;
      error: string;
    }>;
    newSpecializations?: Array<{
      code: string;
      label: string;
      description: string;
      companyClass: string;
      companyId: number;
      companyName: string;
      reason: string;
    }>;
    retryQueueCount?: number; // Liczba firm w kolejce retry
    specializationStats?: Array<{
      code: string;
      label: string;
      count: number;
    }>; // Statystyki specjalizacji - ile firm trafiło do każdej
    skippedCompanies?: Array<{
      companyId: number;
      companyName: string;
      reason: string;
    }>; // Lista pominiętych firm i powody
  } | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [subClassFilter, setSubClassFilter] = useState<string[]>([]);
  const [dailyCosts, setDailyCosts] = useState<{ totalCostPLN: number; totalCostUSD: number; totalCalls: number } | null>(null);
  const [marketFilter, setMarketFilter] = useState<string[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [classificationSourceFilter, setClassificationSourceFilter] = useState("NOT_AI"); // Domyślnie pokazuj firmy bez klasyfikacji AI
  const [importBatchId, setImportBatchId] = useState<string>(""); // Filtr partii importu CSV
  const [importBatches, setImportBatches] = useState<ImportBatchListItem[]>([]);
  const [importBatchesLoading, setImportBatchesLoading] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<number>>(new Set()); // ID rozwiniętych firm
  const [marketAggregation, setMarketAggregation] = useState<AggregationItem[]>([]);
  const [industryAggregation, setIndustryAggregation] = useState<AggregationItem[]>([]);
  const [subClassAggregation, setSubClassAggregation] = useState<AggregationItem[]>([]);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [progressDismissed, setProgressDismissed] = useState(false);

  // Przywróć postęp z localStorage przy ładowaniu strony
  useEffect(() => {
    const savedProgressId = localStorage.getItem("classificationProgressId");
    
    if (savedProgressId) {
      setProgressId(savedProgressId);
      // Po odświeżeniu strony zawsze resetuj stan zamknięcia - pokazuj pełne okno
      setProgressDismissed(false);
      
      // Sprawdź status postępu
      fetch(`/api/company-selection/classify?progressId=${savedProgressId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.progress) {
            setProgress(data.progress);
            setIsClassifying(data.progress.status === "processing");
            
            // Jeśli proces zakończony, usuń z localStorage od razu (nie pokazuj przycisku "Pokaż postęp")
            if (data.progress.status === "completed" || data.progress.status === "error" || data.progress.status === "cancelled") {
              localStorage.removeItem("classificationProgressId");
              localStorage.removeItem("classificationProgressDismissed");
              setProgressId(null);
              setProgressDismissed(false);
            }
          } else {
            // Postęp nie istnieje - usuń z localStorage
            localStorage.removeItem("classificationProgressId");
            localStorage.removeItem("classificationProgressDismissed");
            setProgressId(null);
            setProgressDismissed(false);
          }
        })
        .catch((err) => {
          console.error("[Classify] Błąd przywracania postępu:", err);
          // W przypadku błędu też usuń z localStorage
          localStorage.removeItem("classificationProgressId");
          localStorage.removeItem("classificationProgressDismissed");
          setProgressId(null);
          setProgressDismissed(false);
        });
    }
  }, []);

  // Zapisz progressId do localStorage gdy się zmienia
  useEffect(() => {
    if (progressId) {
      localStorage.setItem("classificationProgressId", progressId);
    } else {
      localStorage.removeItem("classificationProgressId");
      localStorage.removeItem("classificationProgressDismissed");
    }
  }, [progressId]);

  // Zapisz stan zamknięcia okna
  useEffect(() => {
    if (progressId) {
      localStorage.setItem("classificationProgressDismissed", progressDismissed ? "true" : "false");
    }
  }, [progressDismissed, progressId]);

  useEffect(() => {
    async function loadCompanies() {
      try {
        setTableLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));
        if (searchValue.trim()) params.set("search", searchValue.trim());
        subClassFilter.forEach((value) => params.append("classificationSubClass", value));
        marketFilter.forEach((value) => params.append("market", value));
        industryFilter.forEach((value) => params.append("industry", value));
        if (classificationSourceFilter) params.set("classificationSource", classificationSourceFilter);
        if (importBatchId) params.set("importBatchId", importBatchId);

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
            keywords: company.keywords ?? null,
            classifications: Array.isArray(company.classifications) ? company.classifications : [],
          }))
        );
        setPagination(data.pagination ?? null);
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
        console.error("[Classify] Błąd ładowania firm", err);
        setError(err instanceof Error ? err.message : "Błąd ładowania danych");
      } finally {
        setTableLoading(false);
      }
    }

    loadCompanies();
  }, [page, searchValue, subClassFilter, marketFilter, industryFilter, classificationSourceFilter, importBatchId]);

  // Pobierz listę partii importu przy montowaniu komponentu
  useEffect(() => {
    async function loadImportBatches() {
      try {
        setImportBatchesLoading(true);
        const response = await fetch("/api/company-selection/imports?limit=200");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setImportBatches(
          (data.batches ?? []).map((batch: any) => ({
            id: batch.id,
            name: batch.name,
            language: batch.language,
            market: batch.market,
            totalRows: batch.totalRows ?? 0,
            processedRows: batch.processedRows ?? 0,
            createdAt: batch.createdAt,
          }))
        );
      } catch (error) {
        console.error("[Classify] Błąd ładowania partii importu:", error);
      } finally {
        setImportBatchesLoading(false);
      }
    }

    loadImportBatches();
  }, []);

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
      .sort((a, b) => {
        const countDiff = (b.count ?? 0) - (a.count ?? 0);
        return countDiff !== 0 ? countDiff : a.label.localeCompare(b.label);
      });
  }, [subClassAggregation, subClassFilter]);

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
    setSubClassFilter([]);
    setMarketFilter([]);
    setIndustryFilter([]);
    setClassificationSourceFilter("NOT_AI"); // Reset do domyślnej wartości
    setImportBatchId("");
    setSelectedCompanyIds(new Set());
    setPage(1);
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString("pl-PL", { year: "numeric", month: "short", day: "numeric" });
    } catch (error) {
      return value;
    }
  };

  const renderAIClassificationBadge = (company: CompanyItem) => {
    const classifications = company.classifications || [];
    
    if (classifications.length === 0) {
      return <span style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>Brak klasyfikacji AI</span>;
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {classifications.map((classification) => {
          const info = getSpecializationInfo(classification.specializationCode);
          return (
            <div
              key={classification.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                fontSize: "0.82rem",
                color: "#1F2937",
              }}
            >
              <span style={{ fontWeight: classification.isPrimary ? 600 : 500 }}>{info.label}</span>
              <span style={{ color: "#6B7280", fontSize: "0.75rem" }}>
                score {classification.score}
                {classification.confidence != null && (
                  <span style={{ marginLeft: "0.25rem" }}>
                    ({Math.round(classification.confidence * 100)}%)
                  </span>
                )}
              </span>
              {classification.isPrimary && (
                <span
                  style={{
                    padding: "0.15rem 0.4rem",
                    borderRadius: "9999px",
                    backgroundColor: "#DBEAFE",
                    color: "#1E40AF",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                  }}
                >
                  Główna
                </span>
              )}
            </div>
          );
        })}
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

  const toggleCompanySelection = (companyId: number) => {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const toggleCompanyExpansion = (companyId: number) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCompanyIds.size === companies.length && companies.length > 0) {
      setSelectedCompanyIds(new Set());
    } else {
      setSelectedCompanyIds(new Set(companies.map((c) => c.id)));
    }
  };

  const [selectingNext, setSelectingNext] = useState(false);
  const [selectCountInput, setSelectCountInput] = useState("");

  const handleSelectNextN = async () => {
    const count = parseInt(selectCountInput, 10);
    if (isNaN(count) || count <= 0) {
      setError("Podaj poprawną liczbę firm (większą od 0)");
      return;
    }

    setSelectingNext(true);
    try {
      // Zaznacz firmy zaczynając od bieżącej strony
      const allCompanyIds = new Set(selectedCompanyIds); // Zachowaj już zaznaczone
      let currentPage = page;
      let collected = 0;
      const targetCount = count;

      console.log(`[Classify] Zaznaczanie ${targetCount} kolejnych firm, zaczynając od strony ${currentPage}...`);

      while (collected < targetCount) {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", String(PAGE_SIZE));
        if (searchValue.trim()) params.set("search", searchValue.trim());
        subClassFilter.forEach((value) => params.append("classificationSubClass", value));
        marketFilter.forEach((value) => params.append("market", value));
        industryFilter.forEach((value) => params.append("industry", value));
        if (classificationSourceFilter) params.set("classificationSource", classificationSourceFilter);
        if (importBatchId) params.set("importBatchId", importBatchId);

        const url = `/api/company-selection/list?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Błąd pobierania firm");
        }

        const data = await response.json();
        const companiesOnPage = data.companies || [];
        
        if (companiesOnPage.length === 0) {
          // Nie ma więcej firm
          break;
        }

        // Dodaj firmy z tej strony (tylko tyle, ile potrzeba)
        const remaining = targetCount - collected;
        const toAdd = companiesOnPage.slice(0, remaining).map((c: any) => c.id);
        
        toAdd.forEach((id: number) => {
          if (id) allCompanyIds.add(id);
        });

        collected += toAdd.length;
        console.log(`[Classify] Zaznaczono ${collected}/${targetCount} firm (strona ${currentPage})`);

        if (collected >= targetCount || companiesOnPage.length < PAGE_SIZE) {
          // Osiągnięto cel lub to była ostatnia strona
          break;
        }

        currentPage++;
      }

      setSelectedCompanyIds(allCompanyIds);
      setSelectCountInput("");
      console.log(`[Classify] Zaznaczono łącznie ${allCompanyIds.size} firm (dodano ${collected} kolejnych)`);
    } catch (error) {
      console.error("[Classify] Błąd zaznaczania kolejnych firm:", error);
      setError("Nie udało się zaznaczyć firm");
    } finally {
      setSelectingNext(false);
    }
  };

  // Pobierz koszty dzienne
  useEffect(() => {
    const fetchDailyCosts = async () => {
      try {
        const response = await fetch("/api/company-selection/costs?period=today");
        if (response.ok) {
          const data = await response.json();
          // Filtruj tylko klasyfikacje firm
          const classificationCosts = data.usage?.filter((u: any) => u.operation === "company_classification") || [];
          const totalCostUSD = classificationCosts.reduce((sum: number, u: any) => sum + (u.estimatedCost || 0), 0);
          const totalCostPLN = totalCostUSD * 4.2; // USD_TO_PLN
          const totalCalls = classificationCosts.length;
          setDailyCosts({ totalCostPLN, totalCostUSD, totalCalls });
        }
      } catch (err) {
        console.error("[Classify] Błąd pobierania kosztów:", err);
      }
    };

    fetchDailyCosts();
    // Odśwież co 30 sekund
    const interval = setInterval(fetchDailyCosts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Polling postępu klasyfikacji (działa nawet gdy okno jest zamknięte)
  useEffect(() => {
    if (!progressId) {
      return;
    }
    
    // Kontynuuj polling tylko jeśli proces trwa (processing)
    // Jeśli proces zakończony, nie ma potrzeby pollingu
    const shouldPoll = isClassifying || progress?.status === "processing";
    if (!shouldPoll) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/company-selection/classify?progressId=${progressId}`);
        if (!response.ok) {
          if (response.status === 404) {
            // Postęp nie znaleziony (zakończony lub wygasły)
            setIsClassifying(false);
            setProgressId(null);
            // Odśwież listę firm
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("limit", String(PAGE_SIZE));
            if (searchValue.trim()) params.set("search", searchValue.trim());
            subClassFilter.forEach((value) => params.append("classificationSubClass", value));
            marketFilter.forEach((value) => params.append("market", value));
            industryFilter.forEach((value) => params.append("industry", value));
            if (classificationSourceFilter) params.set("classificationSource", classificationSourceFilter);
            if (importBatchId) params.set("importBatchId", importBatchId);

            const url = `/api/company-selection/list?${params.toString()}`;
            const refreshResponse = await fetch(url);
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              setCompanies(
                (refreshData.companies ?? []).map((company: any) => ({
                  ...company,
                  description: company.description ?? null,
                  activityDescription: company.activityDescription ?? null,
                  keywords: company.keywords ?? null,
                  classifications: Array.isArray(company.classifications) ? company.classifications : [],
                }))
              );
            }
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.progress) {
          setProgress(data.progress);
          
          // Debug: sprawdź czy statystyki specjalizacji są obecne
          if (data.progress.status === "completed") {
            console.log("[Classify] Status completed, specializationStats:", data.progress.specializationStats);
            console.log("[Classify] Pełny progress object:", JSON.stringify(data.progress, null, 2));
          }

          // Jeśli zakończone, ale nie mamy jeszcze statystyk - wykonaj jeszcze jedno zapytanie po chwili
          if (data.progress.status === "completed" || data.progress.status === "error" || data.progress.status === "cancelled") {
            // Jeśli anulowano - zatrzymaj od razu (nie odświeżaj listy, nie czyść zaznaczeń)
            if (data.progress.status === "cancelled") {
              setIsClassifying(false);
              setProgressId(null);
              return; // Nie wykonuj reszty kodu (odświeżanie itp.)
            }
            // Jeśli zakończone ale brak statystyk - poczekaj i pobierz jeszcze raz (max 3 próby)
            else if (data.progress.status === "completed" && (!data.progress.specializationStats || data.progress.specializationStats.length === 0)) {
              // Sprawdź ile już było prób retry (przechowuj w stanie)
              const retryCount = (data.progress as any).__retryCount || 0;
              if (retryCount < 3) {
                console.log(`[Classify] Status completed ale brak statystyk - próba ${retryCount + 1}/3, czekam 2s...`);
                setTimeout(async () => {
                  try {
                    const retryResponse = await fetch(`/api/company-selection/classify?progressId=${progressId}`);
                    if (retryResponse.ok) {
                      const retryData = await retryResponse.json();
                      if (retryData.success && retryData.progress) {
                        // Oznacz próbę retry
                        (retryData.progress as any).__retryCount = retryCount + 1;
                        setProgress(retryData.progress);
                        console.log("[Classify] Po retry - specializationStats:", retryData.progress.specializationStats);
                      }
                    }
                  } catch (error) {
                    console.error("[Classify] Błąd podczas retry:", error);
                  }
                }, 2000); // Zwiększone do 2s dla pewności
                return; // Nie zatrzymuj pollingu jeszcze
              } else {
                console.warn("[Classify] Osiągnięto limit prób retry dla statystyk specjalizacji");
              }
            }

            setIsClassifying(false);
            
            // Ustaw wynik
            setClassificationResult({
              total: data.progress.total,
              classified: data.progress.classified,
              skipped: data.progress.skipped,
              errors: data.progress.errors,
              message: `Zaklasyfikowano ${data.progress.classified} firm, pominięto ${data.progress.skipped}, błędów: ${data.progress.errors}`,
            });

            // Jeśli proces zakończony, usuń z localStorage (ale zachowaj progressId dla wyświetlenia wyniku)
            if (data.progress.status === "completed" || data.progress.status === "error" || data.progress.status === "cancelled") {
              // Usuń z localStorage po 5 minutach (daj czas na zobaczenie wyniku)
              setTimeout(() => {
                localStorage.removeItem("classificationProgressId");
                localStorage.removeItem("classificationProgressDismissed");
                setProgressId(null);
              }, 5 * 60 * 1000);
            }

            // Odśwież listę firm
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("limit", String(PAGE_SIZE));
            if (searchValue.trim()) params.set("search", searchValue.trim());
            subClassFilter.forEach((value) => params.append("classificationSubClass", value));
            marketFilter.forEach((value) => params.append("market", value));
            industryFilter.forEach((value) => params.append("industry", value));
            if (classificationSourceFilter) params.set("classificationSource", classificationSourceFilter);
            if (importBatchId) params.set("importBatchId", importBatchId);

            const url = `/api/company-selection/list?${params.toString()}`;
            const refreshResponse = await fetch(url);
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              setCompanies(
                (refreshData.companies ?? []).map((company: any) => ({
                  ...company,
                  description: company.description ?? null,
                  activityDescription: company.activityDescription ?? null,
                  keywords: company.keywords ?? null,
                  classifications: Array.isArray(company.classifications) ? company.classifications : [],
                }))
              );
            }

            // Wyczyść zaznaczenia
            setSelectedCompanyIds(new Set());
          }
        }
      } catch (err) {
        console.error("[Classify] Błąd pobierania postępu:", err);
      }
    }, 1000); // Polling co sekundę

    return () => clearInterval(interval);
  }, [progressId, isClassifying, progress?.status, page, searchValue, subClassFilter, marketFilter, industryFilter, classificationSourceFilter]);

  const handleCancelClassification = async () => {
    if (!progressId) {
      setError("Brak ID postępu do anulowania");
      return;
    }

    try {
      const response = await fetch(`/api/company-selection/classify?progressId=${progressId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Błąd anulowania klasyfikacji");
      }

      const data = await response.json();
      console.log("[Classify] Klasyfikacja anulowana:", data);
      
      // Zaktualizuj status na cancelled
      if (progress) {
        setProgress({
          ...progress,
          status: "cancelled",
        });
      }
      
      setIsClassifying(false);
      setProgressId(null);
    } catch (error) {
      console.error("[Classify] Błąd anulowania klasyfikacji:", error);
      setError(error instanceof Error ? error.message : "Nie udało się anulować klasyfikacji");
    }
  };

  const handleClassifySelected = async () => {
    if (selectedCompanyIds.size === 0) {
      setError("Wybierz firmy do klasyfikacji");
      return;
    }

    console.log("[Classify] Rozpoczynam klasyfikację dla", selectedCompanyIds.size, "firm");
    
    // Ustaw początkowy stan postępu od razu
    setProgress({
      total: selectedCompanyIds.size,
      processed: 0,
      current: 0,
      classified: 0,
      skipped: 0,
      errors: 0,
      status: "processing",
      percentage: 0,
      elapsed: 0,
      remainingTime: null,
    });
    
    setIsClassifying(true);
    setError(null);
    setClassificationResult(null);

    try {
      const response = await fetch("/api/company-selection/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyIds: Array.from(selectedCompanyIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Błąd klasyfikacji");
      }

      const data = await response.json();
      console.log("[Classify] Otrzymano odpowiedź:", data);
      
      // Zapisz progressId i rozpocznij polling
      if (data.progressId) {
        setProgressId(data.progressId);
        // Aktualizuj postęp z danymi z serwera
        setProgress({
          total: data.total,
          processed: 0,
          current: 0,
          classified: 0,
          skipped: 0,
          errors: 0,
          status: "processing",
          percentage: 0,
          elapsed: 0,
          remainingTime: null,
        });
      } else {
        // Fallback - stary sposób (bez postępu)
        setClassificationResult(data);
        setIsClassifying(false);
        setProgress(null);
      }
    } catch (err) {
      console.error("[Classify] Błąd klasyfikacji:", err);
      setError(err instanceof Error ? err.message : "Błąd klasyfikacji");
      setIsClassifying(false);
      setProgressId(null);
      setProgress(null);
    }
  };

  const PaginationControls = ({ position }: { position: "top" | "bottom" }) => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages: (number | string)[] = [];
      const maxVisible = 7;

      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);

        let startPage = Math.max(2, page - 2);
        let endPage = Math.min(totalPages - 1, page + 2);

        if (page <= 4) {
          endPage = Math.min(maxVisible - 1, totalPages - 1);
          startPage = 2;
        } else if (page >= totalPages - 3) {
          startPage = Math.max(2, totalPages - maxVisible + 2);
          endPage = totalPages - 1;
        }

        if (startPage > 2) {
          pages.push("...");
        }

        for (let i = startPage; i <= endPage; i++) {
          pages.push(i);
        }

        if (endPage < totalPages - 1) {
          pages.push("...");
        }

        pages.push(totalPages);
      }

      return pages;
    };

    const pageNumbers = getPageNumbers();

    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page === 1 || tableLoading}
          style={{
            padding: "0.45rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #D1D5DB",
            backgroundColor: page === 1 || tableLoading ? "#F3F4F6" : "white",
            color: "#374151",
            cursor: page === 1 || tableLoading ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          ←
        </button>

        {pageNumbers.map((pageNum, index) => {
          if (pageNum === "...") {
            return (
              <span key={`ellipsis-${index}`} style={{ padding: "0 0.5rem", color: "#6B7280", fontSize: "0.85rem" }}>
                ...
              </span>
            );
          }

          const pageNumber = pageNum as number;
          const isActive = pageNumber === page;

          return (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              disabled={tableLoading}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid",
                borderColor: isActive ? "#2563EB" : "#D1D5DB",
                backgroundColor: isActive ? "#2563EB" : "white",
                color: isActive ? "white" : "#374151",
                cursor: tableLoading ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
                fontWeight: isActive ? 600 : 500,
                minWidth: "2.5rem",
                textAlign: "center",
              }}
            >
              {pageNumber}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={page >= totalPages || tableLoading}
          style={{
            padding: "0.45rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #D1D5DB",
            backgroundColor: page >= totalPages || tableLoading ? "#F3F4F6" : "white",
            color: "#374151",
            cursor: page >= totalPages || tableLoading ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          →
        </button>
      </div>
    );
  };

  type FilterOption = {
    value: string;
    label: string;
    count?: number;
  };

  const FilterRow = ({
    title,
    description,
    options,
    selected,
    onToggle,
    isFirst = false,
  }: {
    title: string;
    description?: string;
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
            flex: "0 0 220px",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "#111827",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span>{title}</span>
          {description && (
            <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#6B7280" }}>
              {description}
            </span>
          )}
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
                  cursor: "pointer",
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
        <div style={{ fontSize: "0.85rem", color: "#6B7280", marginBottom: "0.35rem" }}>
          Proces 2 ▸ Klasyfikacja AI
        </div>
        <h1 style={{ fontSize: "1.9rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>
          Klasyfikacja AI Firm
        </h1>

        <div
          style={{
            padding: "1rem",
            backgroundColor: "#F9FAFB",
            borderRadius: "0.75rem",
            border: "1px solid #E5E7EB",
            marginBottom: "1rem",
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

          {infoExpanded && (
            <div style={{ marginTop: "1rem" }}>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#374151", marginBottom: "1rem" }}>
                To jest <strong>strona do automatycznej klasyfikacji firm przez AI</strong>. 
                AI analizuje <strong>Keywords</strong> i <strong>Short Description</strong> każdej firmy 
                i przypisuje im odpowiednie <strong>specjalizacje ze scoringiem 1-5</strong>.
              </p>

              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem", marginTop: "1rem" }}>
                Co możesz zrobić?
              </h3>
              <ul style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#4B5563", margin: 0, paddingLeft: "1.5rem", marginBottom: "1rem" }}>
                <li><strong>Filtrować firmy</strong> - zobacz które firmy mają klasyfikację AI, a które nie</li>
                <li><strong>Zaznaczać firmy</strong> - wybierz firmy, które chcesz sklasyfikować</li>
                <li><strong>Klasyfikować masowo</strong> - uruchom klasyfikację AI dla wybranych firm</li>
                <li><strong>Sprawdzać wyniki</strong> - zobacz przypisane specjalizacje ze scoringiem</li>
              </ul>

              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem",
                  backgroundColor: "#EEF2FF",
                  borderRadius: "0.5rem",
                  borderLeft: "3px solid #6366F1",
                }}
              >
                <strong style={{ fontSize: "0.85rem", color: "#4338CA" }}>Wskazówka:</strong>
                <span style={{ fontSize: "0.85rem", color: "#4B5563", marginLeft: "0.5rem" }}>
                  Firmy bez Keywords lub Short Description będą pominięte podczas klasyfikacji.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Komunikaty */}
      {error && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: "0.5rem",
            color: "#991B1B",
          }}
        >
          <strong>Błąd:</strong> {error}
        </div>
      )}


      {/* Filtry i tabela */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#111827" }}>
              Filtry i wyszukiwanie
            </h2>
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "#6B7280" }}>
              <span>
                Łącznie: <strong style={{ color: "#111827" }}>{tableLoading ? "…" : totalCount.toLocaleString("pl-PL")}</strong>
              </span>
              {selectedCompanyIds.size > 0 && (
                <span>
                  Zaznaczone: <strong style={{ color: "#2563EB" }}>{selectedCompanyIds.size}</strong>
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="number"
                  min="1"
                  placeholder="Liczba firm"
                  value={selectCountInput}
                  onChange={(e) => setSelectCountInput(e.target.value)}
                  disabled={selectingNext || tableLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && selectCountInput) {
                      handleSelectNextN();
                    }
                  }}
                  style={{
                    width: "100px",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #D1D5DB",
                    fontSize: "0.85rem",
                    textAlign: "center",
                  }}
                />
                <button
                  onClick={handleSelectNextN}
                  disabled={selectingNext || tableLoading || !selectCountInput}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #2563EB",
                    backgroundColor: selectingNext || tableLoading || !selectCountInput ? "#9CA3AF" : "white",
                    color: selectingNext || tableLoading || !selectCountInput ? "#6B7280" : "#2563EB",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: selectingNext || tableLoading || !selectCountInput ? "not-allowed" : "pointer",
                  }}
                  title="Zaznacz N kolejnych firm z listy (zaczynając od bieżącej strony)"
                >
                  {selectingNext ? "Zaznaczanie..." : "Zaznacz kolejne"}
                </button>
              </div>
              {selectedCompanyIds.size > 0 && (
                <button
                  onClick={() => setSelectedCompanyIds(new Set())}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #DC2626",
                    backgroundColor: "white",
                    color: "#DC2626",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Odznacz wszystkie
                </button>
              )}
            </div>
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
            {/* Panel statystyk Branże i Specjalizacje */}
            <div
              style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #E5E7EB",
                backgroundColor: "white",
              }}
            >
              <button
                onClick={() => setStatsExpanded(!statsExpanded)}
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
                <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#6B7280" }}>
                  Statystyki: Branże ({industryAggregation.length}), Specjalizacje ({specializationOptions.length}) {statsExpanded ? "▼" : "▶"}
                </span>
              </button>

              {statsExpanded && (
                <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Branże */}
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
                      Branże:
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                        fontSize: "0.75rem",
                      }}
                    >
                      {industryFilterOptions.slice(0, 20).map((option) => (
                        <span
                          key={option.value}
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            backgroundColor: "#F3F4F6",
                            color: "#4B5563",
                            border: "1px solid #E5E7EB",
                          }}
                        >
                          {option.label} <strong style={{ color: "#1F2937" }}>({option.count})</strong>
                        </span>
                      ))}
                      {industryFilterOptions.length > 20 && (
                        <span
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            backgroundColor: "#F3F4F6",
                            color: "#6B7280",
                            fontSize: "0.7rem",
                            fontStyle: "italic",
                          }}
                        >
                          +{industryFilterOptions.length - 20} więcej...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Specjalizacje */}
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.35rem" }}>
                      Specjalizacje:
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                        fontSize: "0.75rem",
                      }}
                    >
                      {specializationOptions.slice(0, 20).map((option) => (
                        <span
                          key={option.value}
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            backgroundColor: "#F3F4F6",
                            color: "#4B5563",
                            border: "1px solid #E5E7EB",
                          }}
                        >
                          {option.label} <strong style={{ color: "#1F2937" }}>({option.count})</strong>
                        </span>
                      ))}
                      {specializationOptions.length > 20 && (
                        <span
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            backgroundColor: "#F3F4F6",
                            color: "#6B7280",
                            fontSize: "0.7rem",
                            fontStyle: "italic",
                          }}
                        >
                          +{specializationOptions.length - 20} więcej...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <FilterRow
              title="Rynki"
              options={marketFilterOptions}
              selected={marketFilter}
              onToggle={(value) => toggleFilterValue(value, setMarketFilter)}
              isFirst
            />
            <FilterRow
              title="Specjalizacje"
              description="Zaznacz specjalizacje, aby filtrować firmy"
              options={specializationOptions.map((opt) => ({
                value: opt.value,
                label: opt.label,
                count: opt.count,
              }))}
              selected={subClassFilter}
              onToggle={(value) => toggleFilterValue(value, setSubClassFilter)}
            />
            <FilterRow
              title="Branże"
              options={industryFilterOptions}
              selected={industryFilter}
              onToggle={(value) => toggleFilterValue(value, setIndustryFilter)}
            />
          </div>

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
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {CLASSIFICATION_SOURCE_OPTIONS.map(({ value, label }) => {
                const isActive = classificationSourceFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setClassificationSourceFilter(value);
                      setPage(1);
                    }}
                    style={{
                      padding: "0.6rem 1rem",
                      borderRadius: "0.5rem",
                      border: "1px solid",
                      borderColor: isActive ? "#2563EB" : "#D1D5DB",
                      backgroundColor: isActive ? "#2563EB" : "white",
                      color: isActive ? "white" : "#1F2937",
                      fontSize: "0.9rem",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select
                value={importBatchId}
                onChange={(event) => {
                  setImportBatchId(event.target.value);
                  setPage(1);
                }}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #D1D5DB",
                  backgroundColor: "white",
                  color: "#1F2937",
                  fontSize: "0.9rem",
                  minWidth: "280px",
                  cursor: "pointer",
                }}
              >
                <option value="">Wszystkie partie importu</option>
                {importBatchesLoading && <option value="" disabled>Ładowanie...</option>}
                {!importBatchesLoading && importBatches.length === 0 && (
                  <option value="" disabled>Brak partii importu</option>
                )}
                {!importBatchesLoading && importBatches.map((batch) => (
                  <option key={batch.id} value={String(batch.id)}>
                    {batch.name} ({batch.language} • {batch.market}) - {batch.processedRows} firm
                  </option>
                ))}
              </select>
            </div>
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

        {/* Przycisk przywrócenia okna postępu */}
        {progressDismissed && (isClassifying || progress) && (
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: progress?.status === "completed" ? "#F0FDF4" : progress?.status === "error" ? "#FEF2F2" : progress?.status === "cancelled" ? "#FFFBEB" : "#EFF6FF",
              border: progress?.status === "completed" ? "1px solid #86EFAC" : progress?.status === "error" ? "1px solid #FCA5A5" : progress?.status === "cancelled" ? "1px solid #FCD34D" : "1px solid #93C5FD",
              borderRadius: "0.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.9rem", color: progress?.status === "completed" ? "#059669" : progress?.status === "error" ? "#DC2626" : progress?.status === "cancelled" ? "#F59E0B" : "#1E40AF", fontWeight: 500 }}>
              {progress?.status === "completed" 
                ? "Klasyfikacja zakończona" 
                : progress?.status === "error" 
                ? "Błąd klasyfikacji" 
                : progress?.status === "cancelled"
                ? "Klasyfikacja anulowana"
                : `Klasyfikacja w toku: ${progress?.current ?? 0} / ${progress?.total ?? 0} firm (${progress?.percentage ?? 0}%)`}
            </span>
            <button
              onClick={async () => {
                setProgressDismissed(false);
                // Odśwież postęp przy otwieraniu okna
                if (progressId) {
                  try {
                    const response = await fetch(`/api/company-selection/classify?progressId=${progressId}`);
                    if (response.ok) {
                      const data = await response.json();
                      if (data.success && data.progress) {
                        setProgress(data.progress);
                        setIsClassifying(data.progress.status === "processing");
                      }
                    }
                  } catch (err) {
                    console.error("[Classify] Błąd odświeżania postępu:", err);
                  }
                }
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: progress?.status === "completed" ? "1px solid #10B981" : progress?.status === "error" ? "1px solid #DC2626" : progress?.status === "cancelled" ? "1px solid #F59E0B" : "1px solid #2563EB",
                backgroundColor: progress?.status === "completed" ? "#10B981" : progress?.status === "error" ? "#DC2626" : progress?.status === "cancelled" ? "#F59E0B" : "#2563EB",
                color: "white",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Pokaż postęp
            </button>
          </div>
        )}

        {/* Akcje masowe */}
        {selectedCompanyIds.size > 0 && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#EFF6FF",
              border: "1px solid #93C5FD",
              borderRadius: "0.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.9rem", color: "#1E40AF", fontWeight: 600 }}>
              Zaznaczono {selectedCompanyIds.size} firm
            </span>
            <button
              onClick={handleClassifySelected}
              disabled={isClassifying}
              style={{
                padding: "0.65rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: isClassifying ? "#9CA3AF" : "#2563EB",
                color: "white",
                fontWeight: 600,
                cursor: isClassifying ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
              }}
            >
              {isClassifying ? "Klasyfikuję..." : `Klasyfikuj ${selectedCompanyIds.size} firm`}
            </button>
          </div>
        )}

        {/* Pasek postępu klasyfikacji */}
        {(isClassifying || progress) && !progressDismissed && (
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: progress?.status === "completed" ? "#F0FDF4" : progress?.status === "error" ? "#FEF2F2" : progress?.status === "cancelled" ? "#FFFBEB" : "#EFF6FF",
              border: progress?.status === "completed" ? "2px solid #86EFAC" : progress?.status === "error" ? "2px solid #FCA5A5" : progress?.status === "cancelled" ? "2px solid #FCD34D" : "2px solid #93C5FD",
              borderRadius: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                  <strong style={{ fontSize: "1.1rem", color: progress?.status === "completed" ? "#059669" : progress?.status === "error" ? "#DC2626" : progress?.status === "cancelled" ? "#F59E0B" : "#1E40AF" }}>
                    {progress?.status === "completed" ? "Klasyfikacja zakończona" : progress?.status === "error" ? "Błąd klasyfikacji" : progress?.status === "cancelled" ? "Klasyfikacja anulowana" : "Klasyfikacja AI w toku..."}
                  </strong>
                </div>
                {progress?.status === "cancelled" ? (
                  <div style={{ fontSize: "0.9rem", color: "#F59E0B", marginTop: "0.35rem", fontWeight: 600 }}>
                    Klasyfikacja została przerwana. Zaklasyfikowano {progress.classified} firm z {progress.total} ({progress.processed} przetworzono).
                  </div>
                ) : progress?.status === "completed" ? (
                  <div style={{ fontSize: "0.9rem", color: "#059669", marginTop: "0.35rem", fontWeight: 600 }}>
                    Zaklasyfikowano {progress.classified} firm, pominięto {progress.skipped}, błędów: {progress.errors}
                    {progress.specializationStats && progress.specializationStats.length > 0 && (
                      <div style={{ fontSize: "0.85rem", color: "#64748B", marginTop: "0.5rem", fontWeight: 500 }}>
                        Trafiły do {progress.specializationStats.length} {progress.specializationStats.length === 1 ? "specjalizacji" : "specjalizacji"}
                      </div>
                    )}
                    {progress.skipped > 0 && progress.skippedCompanies && progress.skippedCompanies.length > 0 && (
                      <div style={{ fontSize: "0.85rem", color: "#F59E0B", marginTop: "0.5rem", fontWeight: 500, cursor: "pointer" }} onClick={() => {
                        const skippedSection = document.getElementById("skipped-companies-section");
                        if (skippedSection) {
                          skippedSection.scrollIntoView({ behavior: "smooth" });
                        }
                      }}>
                        Kliknij, aby zobaczyć pominięte firmy ({progress.skipped})
                      </div>
                    )}
                  </div>
                ) : progress?.status === "error" ? (
                  <div style={{ fontSize: "0.9rem", color: "#DC2626", marginTop: "0.35rem", fontWeight: 500 }}>
                    Wystąpiły błędy podczas klasyfikacji
                  </div>
                ) : progress?.currentCompanyName ? (
                  <div style={{ fontSize: "0.9rem", color: "#475569", marginTop: "0.35rem", fontWeight: 500 }}>
                    Przetwarzam: <strong style={{ color: "#1E40AF" }}>{progress.currentCompanyName}</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.9rem", color: "#475569", marginTop: "0.35rem", fontWeight: 500 }}>
                    Inicjalizacja klasyfikacji...
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2563EB" }}>
                  {progress?.percentage ?? 0}%
                </div>
                <div style={{ fontSize: "0.85rem", color: "#64748B", marginTop: "0.35rem", fontWeight: 600 }}>
                  {progress?.current ?? 0} / {progress?.total ?? selectedCompanyIds.size} firm
                </div>
              </div>
            </div>

            {/* Pasek postępu */}
            <div
              style={{
                width: "100%",
                height: "1.25rem",
                backgroundColor: "#DBEAFE",
                borderRadius: "0.5rem",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: `${progress?.percentage ?? 0}%`,
                  height: "100%",
                  backgroundColor: "#2563EB",
                  transition: "width 0.3s ease",
                  borderRadius: "0.5rem",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: (progress?.percentage ?? 0) > 50 ? "white" : "#2563EB",
                  pointerEvents: "none",
                }}
              >
                {progress?.current ?? 0}/{progress?.total ?? selectedCompanyIds.size}
              </div>
            </div>

            {/* Statystyki */}
            {progress && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "0.75rem",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <span style={{ color: "#64748B" }}>Zaklasyfikowano:</span>{" "}
                  <strong style={{ color: "#059669" }}>{progress.classified}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748B" }}>Pominięto:</span>{" "}
                  <strong style={{ color: "#64748B" }}>{progress.skipped}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748B" }}>Błędy:</span>{" "}
                  <strong style={{ color: progress.errors > 0 ? "#DC2626" : "#64748B" }}>
                    {progress.errors}
                  </strong>
                </div>
                {progress.retryQueueCount && progress.retryQueueCount > 0 && (
                  <div>
                    <span style={{ color: "#F59E0B" }}>W kolejce retry:</span>{" "}
                    <strong style={{ color: "#F59E0B" }}>
                      {progress.retryQueueCount}
                    </strong>
                  </div>
                )}
                {progress.errorDetails && progress.errorDetails.length > 0 && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem",
                      backgroundColor: "#FEF2F2",
                      border: "1px solid #FCA5A5",
                      borderRadius: "0.5rem",
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#991B1B", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                      Szczegóły błędów ({progress.errorDetails.length}):
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {progress.errorDetails.map((error, idx) => (
                        <div
                          key={`${error.companyId}-${idx}`}
                          style={{
                            padding: "0.5rem",
                            backgroundColor: "white",
                            borderRadius: "0.375rem",
                            fontSize: "0.8rem",
                            border: "1px solid #FECACA",
                          }}
                        >
                          <div style={{ fontWeight: 600, color: "#7F1D1D" }}>
                            {error.companyName} (ID: {error.companyId})
                          </div>
                          <div style={{ color: "#991B1B", marginTop: "0.25rem" }}>{error.error}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {progress.remainingTime !== null && progress.remainingTime > 0 && (
                  <div>
                    <span style={{ color: "#64748B" }}>Pozostało:</span>{" "}
                    <strong style={{ color: "#2563EB" }}>
                      {Math.ceil(progress.remainingTime / 60)} min
                    </strong>
                  </div>
                )}
                <div>
                  <span style={{ color: "#64748B" }}>Czas:</span>{" "}
                  <strong style={{ color: "#64748B" }}>{Math.ceil(progress.elapsed)} s</strong>
                </div>
              </div>
            )}
            
            {/* Statystyki specjalizacji - wyświetlane po zakończeniu */}
            {progress?.status === "completed" && (
              <>
                {progress?.specializationStats && progress.specializationStats.length > 0 ? (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem",
                      backgroundColor: "#F0FDF4",
                      border: "1px solid #86EFAC",
                      borderRadius: "0.5rem",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#166534", marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                      Rozkład firm według specjalizacji:
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                        gap: "0.5rem",
                        maxHeight: "300px",
                        overflowY: "auto",
                      }}
                    >
                      {progress.specializationStats.map((stat) => (
                        <div
                          key={stat.code}
                          style={{
                            padding: "0.5rem 0.75rem",
                            backgroundColor: "white",
                            border: "1px solid #D1FAE5",
                            borderRadius: "0.375rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "0.8rem",
                          }}
                        >
                          <span style={{ color: "#166534", fontWeight: 500, flex: 1 }}>{stat.label}</span>
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              padding: "0.125rem 0.5rem",
                              borderRadius: "0.25rem",
                              backgroundColor: "#059669",
                              color: "white",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              minWidth: "32px",
                              textAlign: "center",
                            }}
                          >
                            {stat.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "0.5rem", fontSize: "0.85rem", color: "#92400E" }}>
                    Statystyki specjalizacji nie są jeszcze dostępne.
                  </div>
                )}
              </>
            )}
            
            {/* Pominięte firmy - wyświetlane po zakończeniu */}
            {progress?.status === "completed" && progress?.skipped > 0 && progress?.skippedCompanies && progress.skippedCompanies.length > 0 && (
              <div id="skipped-companies-section" style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "0.5rem" }}>
                <div style={{ fontWeight: 600, color: "#92400E", marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                  Pominięte firmy ({progress.skippedCompanies.length}):
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {progress.skippedCompanies.map((skipped) => (
                    <div
                      key={skipped.companyId}
                      style={{
                        padding: "0.5rem 0.75rem",
                        backgroundColor: "white",
                        border: "1px solid #FDE68A",
                        borderRadius: "0.375rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#78350F", marginBottom: "0.25rem" }}>
                        {skipped.companyName} (ID: {skipped.companyId})
                      </div>
                      <div style={{ color: "#92400E", fontSize: "0.8rem" }}>
                        Powód: {skipped.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {!progress && (
              <div style={{ fontSize: "0.85rem", color: "#64748B", textAlign: "center" }}>
                Czekam na rozpoczęcie klasyfikacji...
              </div>
            )}
            
            {/* Przyciski na dole okna */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(0, 0, 0, 0.1)" }}>
              {progress?.status === "processing" && (
                <button
                  onClick={handleCancelClassification}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #DC2626",
                    backgroundColor: "white",
                    color: "#DC2626",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Przerwij
                </button>
              )}
              <button
                onClick={() => setProgressDismissed(true)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #9CA3AF",
                  backgroundColor: "white",
                  color: "#6B7280",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                title="Zamknij okno postępu (możesz wrócić później)"
              >
                ✕ Zamknij
              </button>
            </div>
          </div>
        )}

        {/* Nowe specjalizacje utworzone podczas klasyfikacji */}
        {progress?.newSpecializations && progress.newSpecializations.length > 0 && !isClassifying && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#FEF3C7",
              border: "1px solid #FCD34D",
              borderRadius: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ fontWeight: 600, color: "#92400E", marginBottom: "0.5rem" }}>
              Utworzono {progress.newSpecializations.length} nową/nowych specjalizację/specjalizacje:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {progress.newSpecializations.map((spec, idx) => (
                <div
                  key={spec.code}
                  style={{
                    padding: "0.5rem",
                    backgroundColor: "white",
                    borderRadius: "0.375rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#78350F" }}>
                    {idx + 1}. {spec.label} ({spec.code})
                  </div>
                  <div style={{ color: "#92400E", marginTop: "0.25rem" }}>{spec.description}</div>
                  <div style={{ color: "#A16207", marginTop: "0.25rem", fontSize: "0.8rem" }}>
                    Utworzona przez firmę: <strong>{spec.companyName}</strong> (ID: {spec.companyId})
                  </div>
                  {spec.reason && (
                    <div style={{ color: "#78350F", marginTop: "0.25rem", fontStyle: "italic", fontSize: "0.8rem" }}>
                      Powód: {spec.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ borderRadius: "0.75rem", border: "1px solid #E5E7EB", overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.9rem 1.2rem",
              backgroundColor: "#F9FAFB",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>
                Łącznie rekordów: {totalCount?.toLocaleString("pl-PL")}
              </span>
              <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>
                Strona {page} z {totalPages}
              </span>
            </div>
            <PaginationControls position="top" />
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
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280", width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={selectedCompanyIds.size === companies.length && companies.length > 0}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280", width: "30px" }}></th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Firma</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Opis</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Klasyfikacja AI</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Branża</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.8rem", color: "#6B7280" }}>Import</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company, index) => {
                  const isExpanded = expandedCompanies.has(company.id);
                  const hasLongContent =
                    (company.activityDescription && company.activityDescription.length > 200) ||
                    (company.description && company.description.length > 200) ||
                    (company.keywords && company.keywords.length > 100);
                  
                  return (
                  <React.Fragment key={company.id}>
                  <tr
                    key={company.id}
                    style={{
                      backgroundColor: index % 2 === 0 ? "white" : "#F9FAFB",
                      borderTop: "1px solid #E5E7EB",
                      height: "120px", // Stała wysokość wiersza (5 linii)
                      cursor: hasLongContent ? "pointer" : "default",
                    }}
                    onClick={() => hasLongContent && toggleCompanyExpansion(company.id)}
                  >
                    <td style={{ padding: "0.85rem", verticalAlign: "top" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCompanyIds.has(company.id)}
                        onChange={() => toggleCompanySelection(company.id)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", textAlign: "center" }}>
                      {hasLongContent && (
                        <span style={{ fontSize: "0.875rem", color: "#6B7280", cursor: "pointer" }}>
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", width: "22%" }}>
                      <div style={{ fontWeight: 600, color: "#111827", marginBottom: "0.25rem", lineHeight: "1.4", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {company.name}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#6B7280", display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                        {company.market && <span>{getMarketLabel(company.market)}</span>}
                        {company.country && <span>{company.country}</span>}
                        {company.city && <span>{company.city}</span>}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: "0.35rem" }}>
                        {formatDate(company.createdAt)}
                      </div>
                    </td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", width: "28%" }}>
                      {company.activityDescription || company.description ? (
                        <>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "#4B5563",
                              lineHeight: "1.5",
                              overflow: isExpanded ? "visible" : "hidden",
                              textOverflow: isExpanded ? "clip" : "ellipsis",
                              display: isExpanded ? "block" : "-webkit-box",
                              WebkitLineClamp: isExpanded ? undefined : 5,
                              WebkitBoxOrient: isExpanded ? undefined : ("vertical" as any),
                              maxHeight: isExpanded ? "none" : "7.5rem", // ~5 linii
                            }}
                          >
                            {[company.activityDescription, company.description]
                              .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
                              .join(" \n")}
                          </div>
                          {!isExpanded && hasLongContent && (
                            <div style={{ fontSize: "0.75rem", color: "#2563EB", marginTop: "0.25rem", cursor: "pointer" }}>
                              Kliknij, aby rozwinąć...
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>Brak opisu</span>
                      )}
                      {isExpanded && company.keywords && (
                        <div style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.5rem" }}>
                          <strong>Keywords:</strong> {company.keywords}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", width: "22%" }}>
                      {renderAIClassificationBadge(company)}
                    </td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", color: "#1F2937", width: "14%" }}>
                      {company.industry ? (
                        getIndustryLabel(company.industry)
                      ) : (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem", verticalAlign: "top", width: "14%" }}>
                      {company.importBatch ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            fontSize: "0.85rem",
                            color: "#374151",
                          }}
                        >
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
                  {isExpanded && hasLongContent && (
                    <tr
                      key={`${company.id}-expanded`}
                      style={{
                        backgroundColor: index % 2 === 0 ? "#F9FAFB" : "white",
                        borderTop: "1px solid #E5E7EB",
                      }}
                    >
                      <td colSpan={7} style={{ padding: "0.75rem 0.85rem", backgroundColor: index % 2 === 0 ? "#F9FAFB" : "white" }}>
                        <div style={{ paddingLeft: "2.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {company.keywords && (
                            <div>
                              <strong style={{ fontSize: "0.85rem", color: "#374151" }}>Keywords:</strong>
                              <div style={{ marginTop: "0.25rem", color: "#4B5563", fontSize: "0.85rem" }}>
                                {company.keywords}
                              </div>
                            </div>
                          )}
                          {(company.website || company.street || company.buildingNumber) && (
                            <div>
                              <strong style={{ fontSize: "0.85rem", color: "#374151" }}>Szczegóły:</strong>
                              <div style={{ marginTop: "0.25rem", color: "#4B5563", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                                {company.website && <div>WWW: {company.website}</div>}
                                {(company.street || company.buildingNumber) && (
                                  <div>
                                    {company.street} {company.buildingNumber}
                                    {company.postalCode && `, ${company.postalCode}`} {company.city && company.city}
                                  </div>
                                )}
                              </div>
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
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>
            Wyświetlono {companies.length} z {totalCount?.toLocaleString("pl-PL")}
          </span>
          <PaginationControls position="bottom" />
        </div>
      </section>
    </div>
  );
}