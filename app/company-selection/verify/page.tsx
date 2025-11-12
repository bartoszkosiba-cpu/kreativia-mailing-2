"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

const STATUS_OPTIONS = [
  { value: "ALL", label: "Wszystkie statusy" },
  { value: "PENDING", label: "Do weryfikacji" },
  { value: "QUALIFIED", label: "Zakwalifikowane" },
  { value: "REJECTED", label: "Odrzucone" },
  { value: "NEEDS_REVIEW", label: "Wymagają przeglądu" },
  { value: "BLOCKED", label: "Zablokowane" },
];

const LANGUAGE_OPTIONS = [
  { value: "", label: "Wszystkie języki" },
  { value: "PL", label: "Polski" },
  { value: "EN", label: "English" },
  { value: "DE", label: "Deutsch" },
  { value: "FR", label: "Français" },
];

const CLASSIFICATION_OPTIONS = [
  { value: "", label: "Wszystkie segmenty" },
  { value: "PS", label: "PS – Pośrednik" },
  { value: "WK", label: "WK – Wykonawca" },
  { value: "WKK", label: "WKK – Wartościowy klient końcowy" },
];

const PAGE_SIZE = 50;

const detailModalStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(15, 23, 42, 0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "2rem",
  zIndex: 250,
};

const detailCardStyle: CSSProperties = {
  maxWidth: "860px",
  maxHeight: "80vh",
  width: "100%",
  overflowY: "auto",
  backgroundColor: "white",
  borderRadius: "0.75rem",
  border: "1px solid #E5E7EB",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
  padding: "2rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

interface Company {
  id: number;
  name: string;
  industry: string | null;
  market: string | null;
  city: string | null;
  country: string | null;
  verificationStatus: string;
  verificationReason: string | null;
  description: string | null;
  activityDescription: string | null;
  descriptionPl: string | null;
  activityDescriptionPl: string | null;
  detectedLanguage: string | null;
  website?: string | null;
  importBatch?: {
    id: number;
    name: string;
    language: string;
    market: string;
    totalRows?: number | null;
    processedRows?: number | null;
    createdAt: string;
  } | null;
  classificationClass: string | null;
  classificationSubClass: string | null;
  classificationConfidence: number | null;
  classificationSource: string | null;
  classificationSignals: string[];
  classificationNeedsReview: boolean | null;
}

interface CompanyStats {
  pending: number;
  qualified: number;
  rejected: number;
  needsReview: number;
  blocked: number;
  total: number;
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

interface VerificationProgress {
  total: number;
  processed: number;
  percentage: number;
  qualified: number;
  rejected: number;
  needsReview: number;
  errors: number;
  status: "processing" | "completed" | "error";
  currentCompanyName?: string;
  estimatedTimeRemaining?: number;
}

export default function CompanyVerifyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (detailCompany) {
      console.log("[Verify] Otwieram podgląd firmy", detailCompany.id);
    }
  }, [detailCompany]);
  const [selectedStatus, setSelectedStatus] = useState<string>("QUALIFIED");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [progress, setProgress] = useState<VerificationProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [batchLanguageFilter, setBatchLanguageFilter] = useState("");
  const [batchNameFilter, setBatchNameFilter] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [classificationFilter, setClassificationFilter] = useState<string>("");
  const [importBatches, setImportBatches] = useState<ImportBatchListItem[]>([]);
  const [importBatchesLoading, setImportBatchesLoading] = useState(false);
  const [stats, setStats] = useState<CompanyStats>({
    pending: 0,
    qualified: 0,
    rejected: 0,
    needsReview: 0,
    blocked: 0,
    total: 0,
  });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  const filteredBatchOptions = useMemo(() => {
    const query = batchNameFilter.trim().toLowerCase();
    return importBatches.filter((batch) => {
      const matchesLanguage = batchLanguageFilter
        ? batch.language === batchLanguageFilter
        : true;
      const matchesName = query ? batch.name.toLowerCase().includes(query) : true;
      return matchesLanguage && matchesName;
    });
  }, [importBatches, batchLanguageFilter, batchNameFilter]);

  const selectedCount = selectedCompanies.length;
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        searchQuery.trim() ||
          industryFilter.trim() ||
          countryFilter.trim() ||
          batchLanguageFilter ||
          batchNameFilter.trim() ||
      selectedBatchId ||
      classificationFilter
      ),
    [
      searchQuery,
      industryFilter,
      countryFilter,
      batchLanguageFilter,
      batchNameFilter,
    selectedBatchId,
    classificationFilter,
    ]
  );

  useEffect(() => {
    loadStats();
    loadImportBatches();
    loadCompanies();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    selectedStatus,
    searchQuery,
    industryFilter,
    countryFilter,
    batchLanguageFilter,
    batchNameFilter,
    selectedBatchId,
    classificationFilter,
  ]);

  useEffect(() => {
    loadCompanies();
  }, [
    selectedStatus,
    searchQuery,
    industryFilter,
    countryFilter,
    batchLanguageFilter,
    batchNameFilter,
    selectedBatchId,
    classificationFilter,
    page,
  ]);

  useEffect(() => {
    if (!progressId) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/company-selection/verify/progress?progressId=${progressId}`
        );
        const data = await response.json();
        
        if (data.error) {
          console.error("[Verify] Błąd pobierania postępu:", data.error);
          return;
        }

        setProgress({
          total: data.total,
          processed: data.processed,
          percentage: data.percentage,
          qualified: data.qualified,
          rejected: data.rejected,
          needsReview: data.needsReview,
          errors: data.errors,
          status: data.status,
          currentCompanyName: data.currentCompanyName,
          estimatedTimeRemaining: data.estimatedTimeRemaining,
        });

        if (data.status === "completed" || data.status === "error") {
          clearInterval(interval);
          setVerifying(false);
          setProgressId(null);
          setSelectedCompanies([]);
          loadStats();
          loadCompanies();
          
          if (data.status === "completed") {
            alert(
              `Weryfikacja zakończona:\n- Zakwalifikowane: ${data.qualified}\n- Odrzucone: ${data.rejected}\n- Wymagają przeglądu: ${data.needsReview}\n- Błędy: ${data.errors}`
            );
          } else {
            alert("Weryfikacja zakończona z błędami. Sprawdź logi.");
          }
        }
      } catch (error) {
        console.error("[Verify] Błąd pollingu postępu:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [progressId]);

  const loadStats = async () => {
    try {
      const [pendingRes, qualifiedRes, rejectedRes, needsReviewRes, blockedRes, totalRes] =
        await Promise.all([
          fetch("/api/company-selection/list?status=PENDING&limit=1"),
          fetch("/api/company-selection/list?status=QUALIFIED&limit=1"),
          fetch("/api/company-selection/list?status=REJECTED&limit=1"),
          fetch("/api/company-selection/list?status=NEEDS_REVIEW&limit=1"),
          fetch("/api/company-selection/list?status=BLOCKED&limit=1"),
          fetch("/api/company-selection/list?limit=1"),
        ]);

      const [pending, qualified, rejected, needsReview, blocked, total] = await Promise.all([
          pendingRes.json(),
          qualifiedRes.json(),
          rejectedRes.json(),
          needsReviewRes.json(),
          blockedRes.json(),
          totalRes.json(),
        ]);

      setStats({
        pending: pending.pagination?.total || 0,
        qualified: qualified.pagination?.total || 0,
        rejected: rejected.pagination?.total || 0,
        needsReview: needsReview.pagination?.total || 0,
        blocked: blocked.pagination?.total || 0,
        total: total.pagination?.total || 0,
      });
    } catch (error) {
      console.error("Błąd ładowania statystyk:", error);
    }
  };

  const loadImportBatches = async () => {
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
      console.error("Błąd ładowania partii importu:", error);
    } finally {
      setImportBatchesLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      setLoading(true);
      let url = `/api/company-selection/list?page=${page}&limit=${PAGE_SIZE}`;
      
      if (selectedStatus !== "ALL") {
        url += `&status=${selectedStatus}`;
      }
      
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      
      if (industryFilter.trim()) {
        url += `&industry=${encodeURIComponent(industryFilter.trim())}`;
      }

      if (countryFilter.trim()) {
        url += `&country=${encodeURIComponent(countryFilter.trim())}`;
      }

      if (batchLanguageFilter) {
        url += `&batchLanguage=${encodeURIComponent(batchLanguageFilter)}`;
      }

      if (selectedBatchId) {
        url += `&importBatchId=${encodeURIComponent(selectedBatchId)}`;
      } else if (batchNameFilter.trim()) {
        url += `&batchName=${encodeURIComponent(batchNameFilter.trim())}`;
      }

      if (classificationFilter) {
        url += `&classificationClass=${encodeURIComponent(classificationFilter)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const normalizedCompanies: Company[] = (data.companies || []).map((company: any) => ({
        id: company.id,
        name: company.name,
        industry: company.industry ?? null,
        market: company.market ?? company.importBatch?.market ?? null,
        city: company.city ?? null,
        country: company.country ?? null,
        verificationStatus: company.verificationStatus,
        verificationReason: company.verificationReason ?? company.verificationComment ?? null,
        description: company.description ?? null,
        activityDescription: company.activityDescription ?? null,
        descriptionPl: company.descriptionPl ?? null,
        activityDescriptionPl: company.activityDescriptionPl ?? null,
        detectedLanguage: company.detectedLanguage ?? null,
        website:
          typeof company?.website === "string"
            ? company.website.trim()
            : company?.website ?? null,
        importBatch: company.importBatch
          ? {
              id: company.importBatch.id,
              name: company.importBatch.name,
              language: company.importBatch.language,
              market: company.importBatch.market,
              totalRows: company.importBatch.totalRows ?? null,
              processedRows: company.importBatch.processedRows ?? null,
              createdAt: company.importBatch.createdAt,
            }
          : null,
        classificationClass: company.classificationClass ?? null,
        classificationSubClass: company.classificationSubClass ?? null,
        classificationConfidence:
          typeof company.classificationConfidence === "number"
            ? company.classificationConfidence
            : company.classificationConfidence
            ? Number(company.classificationConfidence)
            : null,
        classificationSource: company.classificationSource ?? null,
        classificationSignals: Array.isArray(company.classificationSignals)
          ? company.classificationSignals
          : [],
        classificationNeedsReview:
          typeof company.classificationNeedsReview === "boolean"
            ? company.classificationNeedsReview
            : company.classificationNeedsReview == null
            ? null
            : Boolean(company.classificationNeedsReview),
      }));

      setCompanies(normalizedCompanies);
      setTotal(data.pagination?.total || 0);
      setSelectedCompanies((prev) =>
        prev.filter((id) => normalizedCompanies.some((company) => company.id === id))
      );
    } catch (error) {
      console.error("Błąd ładowania firm:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasCompanyWebsite = (company?: Company | null) => {
    if (!company) return false;
    const website = (company.website ?? "").trim();
    if (!website) return false;
    return website.startsWith("http://") || website.startsWith("https://");
  };

  const toggleCompanySelection = (companyId: number) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const toggleSelectAll = () => {
    const selectableIds = companies
      .filter((company) => hasCompanyWebsite(company))
      .map((company) => company.id);

    if (selectableIds.length === 0) {
      alert("Brak firm z uzupełnioną stroną www do zaznaczenia.");
      return;
    }

    if (selectedCompanies.length === selectableIds.length) {
      setSelectedCompanies([]);
    } else {
      setSelectedCompanies(selectableIds);
    }
  };

  const handleChangeStatus = async (companyId: number, currentStatus: string) => {
    let newStatus: string;
    if (currentStatus === "QUALIFIED") {
      newStatus = "REJECTED";
    } else if (currentStatus === "REJECTED") {
      newStatus = "QUALIFIED";
    } else {
      const action = confirm(
        `Firma ma status: ${getStatusLabel(currentStatus)}\n\n` +
          `Wybierz nowy status:\n` +
          `OK = QUALIFIED\n` +
          `Anuluj = REJECTED`
      );
      newStatus = action ? "QUALIFIED" : "REJECTED";
    }

    if (!confirm(`Czy na pewno chcesz zmienić status na: ${getStatusLabel(newStatus)}?`)) {
      return;
    }

    try {
      const response = await fetch("/api/company-selection/update-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          status: newStatus,
        }),
      });

      const data = await response.json();
      if (data.success) {
        loadStats();
        loadCompanies();
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(
        "Błąd zmiany statusu: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const handleVerifySingle = async (companyId: number) => {
    const company = companies.find((item) => item.id === companyId);
      if (!hasCompanyWebsite(company)) {
        alert("Ta firma nie ma uzupełnionej strony www. Uzupełnij ją przed weryfikacją.");
        return;
      }

    try {
      setVerifying(true);
      const response = await fetch("/api/company-selection/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Firma zweryfikowana: ${data.result.status} (score: ${data.result.score})`);
        loadStats();
        loadCompanies();
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert("Błąd weryfikacji" + (error instanceof Error ? `: ${error.message}` : ""));
    } finally {
      setVerifying(false);
    }
  };

  const handleBlockCompany = async (companyId: number, companyName: string) => {
    if (
      !confirm(
        `Czy na pewno chcesz zablokować firmę "${companyName}"?\n\n` +
          "Firma zostanie dodana do listy zablokowanych i oznaczona jako BLOKOWANA."
      )
    ) {
      return;
    }

    try {
      const addResponse = await fetch("/api/company-selection/blocked", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          reason: "Zablokowane z widoku weryfikacji",
        }),
      });

      const addData = await addResponse.json();
      if (!addData.success && !String(addData.error || "").includes("już jest")) {
        alert(`Błąd dodawania do listy zablokowanych: ${addData.error}`);
        return;
      }

      const statusResponse = await fetch("/api/company-selection/update-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          status: "BLOCKED",
          reason: `Firma zablokowana: ${companyName}`,
        }),
      });

      const statusData = await statusResponse.json();
      if (statusData.success) {
        loadStats();
        loadCompanies();
      } else {
        alert(`Błąd: ${statusData.error}`);
      }
    } catch (error) {
        alert(
        "Błąd blokowania firmy: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const handleVerifyBatch = async () => {
    if (selectedCompanies.length === 0) {
      alert("Zaznacz firmy do weryfikacji");
      return;
    }

      const selectableIds = selectedCompanies.filter((companyId) => {
        const company = companies.find((c) => c.id === companyId);
        return hasCompanyWebsite(company);
      });

      if (selectableIds.length === 0) {
        alert("Żadna z zaznaczonych firm nie ma uzupełnionej strony www. Uzupełnij dane przed weryfikacją.");
        return;
      }

      if (selectableIds.length !== selectedCompanies.length) {
        alert("Pominięto firmy bez adresu www.");
        setSelectedCompanies(selectableIds);
      }

    try {
      setVerifying(true);
      const progressResponse = await fetch("/api/company-selection/verify/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ total: selectableIds.length }),
      });

      const progressData = await progressResponse.json();
      if (!progressResponse.ok || !progressData.success || !progressData.progressId) {
        alert(`Nie udało się utworzyć postępu weryfikacji: ${progressData.error || "brak szczegółów"}`);
        setVerifying(false);
        return;
      }

      const newProgressId = progressData.progressId as string;
      setProgressId(newProgressId);

      const response = await fetch("/api/company-selection/verify", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          companyIds: selectableIds,
          progressId: newProgressId,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        setVerifying(false);
        setProgressId(null);
        setProgress(null);
      }
    } catch (error) {
      alert("Błąd weryfikacji: " + (error instanceof Error ? error.message : String(error)));
      setVerifying(false);
      setProgressId(null);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setIndustryFilter("");
    setCountryFilter("");
    setBatchLanguageFilter("");
    setBatchNameFilter("");
    setSelectedBatchId("");
    setClassificationFilter("");
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Weryfikacja firm</h1>
          <p style={{ color: "#4B5563", maxWidth: "640px" }}>
            Przeglądaj i kwalifikuj firmy z importów. Filtruj po statusie, segmencie, branży, kraju, języku oraz partii importu, aby szybciej znaleźć właściwe rekordy.
          </p>
        </div>
        <Link
          href="/company-selection"
          style={{
            padding: "0.75rem 1.5rem",
              backgroundColor: "#3B82F6",
              color: "white",
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
          ← Powrót do modułu wyboru leadów
          </Link>
        </div>

      <StatsOverview
        stats={stats}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
      />

        <div
          style={{
          backgroundColor: "white",
                borderRadius: "0.75rem",
          border: "1px solid #E5E7EB",
          padding: "1.5rem",
            marginBottom: "1.5rem",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            display: "grid",
          gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            marginBottom: "1rem",
        }}
      >
          <input
            type="text"
            placeholder="Szukaj po nazwie firmy..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Filtr branży"
            value={industryFilter}
            onChange={(event) => setIndustryFilter(event.target.value)}
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Filtr kraju"
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
            style={inputStyle}
          />

        <select
          value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
            style={inputStyle}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>

          <select
            value={batchLanguageFilter}
            onChange={(event) => setBatchLanguageFilter(event.target.value)}
            style={inputStyle}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={selectedBatchId}
            onChange={(event) => setSelectedBatchId(event.target.value)}
            style={inputStyle}
          >
            <option value="">Wszystkie bazy importu</option>
            {importBatchesLoading && <option value="" disabled>Ładowanie...</option>}
            {!importBatchesLoading && filteredBatchOptions.length === 0 && (
              <option value="" disabled>
                Brak dopasowanych baz
              </option>
            )}
            {filteredBatchOptions.map((batch) => (
              <option key={batch.id} value={String(batch.id)}>
                {batch.name} ({batch.language} • {batch.market})
              </option>
            ))}
          </select>

          <select
            value={classificationFilter}
            onChange={(event) => setClassificationFilter(event.target.value)}
            style={inputStyle}
          >
            {CLASSIFICATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Szukaj po nazwie importu"
            value={batchNameFilter}
            onChange={(event) => setBatchNameFilter(event.target.value)}
            style={inputStyle}
            disabled={Boolean(selectedBatchId)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ fontSize: "0.875rem", color: "#4B5563" }}>
            Zaznaczono firm: <strong>{selectedCount}</strong> / {companies.length}
            {batchLanguageFilter && (
              <span style={{ marginLeft: "0.5rem", color: "#2563EB" }}>
                Język: {batchLanguageFilter}
              </span>
            )}
            {selectedBatchId && (
              <span style={{ marginLeft: "0.5rem", color: "#2563EB" }}>
                Import: #{selectedBatchId}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleVerifyBatch}
              disabled={verifying || selectedCount === 0}
            style={{
                padding: "0.6rem 1.2rem",
                backgroundColor: verifying || selectedCount === 0 ? "#CBD5F5" : "#3B82F6",
              color: "white",
              borderRadius: "0.5rem",
                border: "none",
                cursor: verifying || selectedCount === 0 ? "not-allowed" : "pointer",
                fontWeight: 600,
            }}
          >
              {verifying ? "Weryfikuję..." : "Zweryfikuj zaznaczone"}
          </button>
            <button
              type="button"
              onClick={toggleSelectAll}
          style={{
                padding: "0.6rem 1rem",
            backgroundColor: "#F3F4F6",
                color: "#374151",
            borderRadius: "0.5rem",
            border: "1px solid #D1D5DB",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {selectedCompanies.length === companies.filter((company) => hasCompanyWebsite(company)).length
                ? "Odznacz wszystkie"
                : "Zaznacz firmy ze stroną www"}
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
            style={{
                padding: "0.6rem 1rem",
                backgroundColor: hasActiveFilters ? "#FEE2E2" : "#F3F4F6",
                color: hasActiveFilters ? "#B91C1C" : "#6B7280",
              borderRadius: "0.5rem",
                border: "1px solid #FECACA",
                cursor: hasActiveFilters ? "pointer" : "not-allowed",
                fontWeight: 500,
              }}
            >
              Wyczyść filtry
            </button>
              </div>
            </div>
          </div>

      {progress && (
            <div
              style={{
            marginBottom: "1.5rem",
            padding: "1.25rem",
            borderRadius: "0.75rem",
            backgroundColor: "#EEF2FF",
            border: "1px solid #C7D2FE",
            color: "#1E3A8A",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
            Postęp weryfikacji ({progress.processed}/{progress.total}) – {progress.percentage}%
            </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.875rem" }}>
            <span>✅ Zakwalifikowane: {progress.qualified}</span>
            <span>❌ Odrzucone: {progress.rejected}</span>
            <span>⚖️ Wymagają przeglądu: {progress.needsReview}</span>
            <span>⚠️ Błędy: {progress.errors}</span>
            {progress.currentCompanyName && (
              <span>Aktualnie: {progress.currentCompanyName}</span>
            )}
            {typeof progress.estimatedTimeRemaining === "number" && (
              <span>
                ETA: ~{Math.max(0, Math.round(progress.estimatedTimeRemaining / 1000))}s
              </span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>Ładowanie...</div>
      ) : companies.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            backgroundColor: "#F3F4F6",
            borderRadius: "0.5rem",
          }}
        >
          Brak firm do wyświetlenia
        </div>
      ) : (
          <div
            style={{
              backgroundColor: "white",
            borderRadius: "0.75rem",
              border: "1px solid #E5E7EB",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
              <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                <th style={headerCellStyle}>
                    <input
                      type="checkbox"
                      checked={
                        companies.length > 0 &&
                      selectedCompanies.length ===
                        companies.filter((company) => hasCompanyWebsite(company)).length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                <th style={{ ...headerCellStyle, width: "32%" }}>Firma</th>
                <th style={{ ...headerCellStyle, width: "18%" }}>Status</th>
                <th style={{ ...headerCellStyle, width: "26%" }}>Powód / Komentarz</th>
                <th style={{ ...headerCellStyle, width: "14%" }}>Import</th>
                <th style={{ ...headerCellStyle, width: "10%" }}>Szczegóły</th>
                <th style={{ ...headerCellStyle, width: "14%" }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company, index) => {
                  const isSelected = selectedCompanies.includes(company.id);
                const segmentLabel = company.classificationClass
                  ? `${company.classificationClass}${company.classificationSubClass ? ` / ${company.classificationSubClass}` : ""}`
                  : null;
                const companyActivity =
                  company.activityDescriptionPl ||
                  company.descriptionPl ||
                  company.activityDescription ||
                  company.description ||
                  "Brak opisu działalności";
                const companyHasWebsite = hasCompanyWebsite(company);
                  
                  return (
                    <tr
                      key={company.id}
                      style={{
                      backgroundColor: isSelected
                        ? "#EFF6FF"
                        : index % 2 === 0
                        ? "white"
                        : "#F9FAFB",
                        borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <td style={cellCenteredStyle}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompanySelection(company.id)}
                          disabled={!companyHasWebsite}
                          title={
                            companyHasWebsite
                              ? undefined
                              : "Brak strony www – uzupełnij, aby móc zaznaczyć firmę"
                          }
                        />
                      </td>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 600, marginBottom: "0.15rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        {company.name}
                        {segmentLabel && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              padding: "0.1rem 0.45rem",
                              borderRadius: "0.35rem",
                              backgroundColor: "#EEF2FF",
                              color: "#4338CA",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.02em",
                            }}
                            title={`Segment: ${segmentLabel}${company.classificationNeedsReview ? " • do weryfikacji" : ""}`}
                          >
                            {segmentLabel}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "#6B7280", marginBottom: "0.25rem", lineHeight: 1.45 }}>
                        {companyActivity.length > 160 ? `${companyActivity.substring(0, 160)}...` : companyActivity}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          fontSize: "0.75rem",
                          color: "#9CA3AF",
                          flexWrap: "wrap",
                        }}
                      >
                        {company.industry && <span>{company.industry}</span>}
                        {company.city && <span>• {company.city}</span>}
                        {company.country && <span>• {company.country}</span>}
                      </div>
                      {!companyHasWebsite && (
                        <div style={{ fontSize: "0.75rem", color: "#B91C1C", marginTop: "0.35rem" }}>
                          Brak adresu www – uzupełnij, aby zweryfikować
                        </div>
                      )}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span
                              style={{
                                padding: "0.25rem 0.5rem",
                              borderRadius: "0.35rem",
                                backgroundColor: getStatusColor(company.verificationStatus),
                                color: "white",
                                fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                            >
                              {getStatusLabel(company.verificationStatus)}
                            </span>
                            <button
                              type="button"
                            onClick={() => handleChangeStatus(company.id, company.verificationStatus)}
                            style={secondaryActionStyle}
                          >
                            Zmień status
                            </button>
                          </div>
                        <div style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                          ID: {company.id}
                        </div>
                        </div>
                      </td>
                    <td style={cellStyle}>
                        {company.verificationReason ? (
                        <span>{company.verificationReason}</span>
                      ) : (
                        <span style={{ color: "#9CA3AF" }}>Brak komentarza</span>
                        )}
                      </td>
                    <td style={cellStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                         <span style={{ fontWeight: 600 }}>Import {company.importBatch?.name ?? "?"}</span>
                         <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                            Język: {company.importBatch?.language ?? "?"}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                            Dodano: {company.importBatch?.createdAt ? new Date(company.importBatch.createdAt).toLocaleString("pl-PL") : "?"}
                          </span>
                        </div>
                      </td>
                    <td style={cellCenteredStyle}>
                      <button
                        type="button"
                        onClick={() => {
                          console.log("[Verify] Klik przycisku Podgląd", company.id);
                          setDetailCompany(company);
                        }}
                        style={{
                          border: "1px solid #C4B5FD",
                          backgroundColor: "#EEF2FF",
                          color: "#4338CA",
                          borderRadius: "0.5rem",
                          padding: "0.35rem 0.75rem",
                          cursor: "pointer",
                          fontWeight: 500,
                          fontSize: "0.8rem",
                        }}
                      >
                        Podgląd
                      </button>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <button
                          type="button"
                          onClick={() => handleVerifySingle(company.id)}
                          disabled={verifying || !companyHasWebsite}
                style={{
                            ...primaryActionStyle,
                            backgroundColor: verifying || !companyHasWebsite ? "#9CA3AF" : "#10B981",
                          }}
                        >
                          Zweryfikuj
              </button>
              <button
                          type="button"
                          onClick={() => handleBlockCompany(company.id, company.name)}
                style={{
                            ...secondaryActionStyle,
                            color: "#B91C1C",
                            borderColor: "#FECACA",
                            backgroundColor: "#FEF2F2",
                          }}
                        >
                          Zablokuj
              </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ fontSize: "0.875rem", color: "#4B5563" }}>
          Strona {page} z {totalPages} • Łącznie rekordów: {total}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            style={{
              ...secondaryActionStyle,
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.6 : 1,
            }}
          >
            Poprzednia
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            style={{
              ...secondaryActionStyle,
              cursor: page >= totalPages ? "not-allowed" : "pointer",
              opacity: page >= totalPages ? 0.6 : 1,
            }}
          >
            Następna
          </button>
        </div>
      </div>

      {detailCompany && (
        <div style={detailModalStyle}>
          <div style={detailCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>{detailCompany.name}</h3>
                <p style={{ color: "#4B5563", margin: "0.25rem 0" }}>
                  {detailCompany.industry || "—"}
                  {detailCompany.country ? ` • ${detailCompany.country}` : ""}
                  {detailCompany.city ? ` • ${detailCompany.city}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailCompany(null)}
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  color: "#6B7280",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                }}
                aria-label="Zamknij podgląd firmy"
              >
                ✕
              </button>
            </div>

            <section>
              <h4 style={{ marginBottom: "0.5rem", color: "#111827" }}>Segmentacja</h4>
              <div style={{ color: "#1F2937" }}>
                {detailCompany.classificationClass || "—"}
                {detailCompany.classificationSubClass ? ` / ${detailCompany.classificationSubClass}` : ""}
                {typeof detailCompany.classificationConfidence === "number"
                  ? ` (score: ${detailCompany.classificationConfidence.toFixed(1)})`
                  : ""}
              </div>
              {detailCompany.classificationSignals.length > 0 && (
                <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {detailCompany.classificationSignals.map((signal, idx) => (
                    <span
                      key={`signal-${idx}`}
                      style={{
                        backgroundColor: "#F3F4F6",
                        borderRadius: "9999px",
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.75rem",
                        color: "#4B5563",
                      }}
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4 style={{ marginBottom: "0.5rem", color: "#111827" }}>Opis firmy</h4>
              <p style={{ color: "#1F2937", lineHeight: 1.6 }}>
                {detailCompany.description || "Brak opisu"}
              </p>
            </section>

            <section>
              <h4 style={{ marginBottom: "0.5rem", color: "#111827" }}>Opis działalności</h4>
              <p style={{ color: "#1F2937", lineHeight: 1.6 }}>
                {detailCompany.activityDescription || "Brak danych"}
              </p>
            </section>

            {detailCompany.website && (
              <section>
                <h4 style={{ marginBottom: "0.5rem", color: "#111827" }}>Strona www</h4>
                <a
                  href={detailCompany.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563EB", textDecoration: "underline" }}
                >
                  {detailCompany.website}
                </a>
              </section>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function StatsOverview({
  stats,
  selectedStatus,
  onSelectStatus,
}: {
  stats: CompanyStats;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
}) {
  const cards = [
    {
      status: "PENDING",
      label: "Do weryfikacji",
      value: stats.pending,
      bg: "#DBEAFE",
      border: "#BFDBFE",
      textColor: "#1D4ED8",
    },
    {
      status: "QUALIFIED",
      label: "Zakwalifikowane",
      value: stats.qualified,
      bg: "#D1FAE5",
      border: "#A7F3D0",
      textColor: "#047857",
    },
    {
      status: "REJECTED",
      label: "Odrzucone",
      value: stats.rejected,
      bg: "#FEE2E2",
      border: "#FECACA",
      textColor: "#B91C1C",
    },
    {
      status: "NEEDS_REVIEW",
      label: "Wymagają przeglądu",
      value: stats.needsReview,
      bg: "#FEF3C7",
      border: "#FDE68A",
      textColor: "#B45309",
    },
    {
      status: "BLOCKED",
      label: "Zablokowane",
      value: stats.blocked,
      bg: "#F3E8FF",
      border: "#E9D5FF",
      textColor: "#7C3AED",
    },
    {
      status: "ALL",
      label: "Łącznie",
      value: stats.total,
      bg: "#E5E7EB",
      border: "#D1D5DB",
      textColor: "#111827",
    },
  ];

  return (
                <div
                  style={{
                    display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      {cards.map((card) => {
        const isActive = selectedStatus === card.status;
        return (
          <button
            key={card.status}
            type="button"
            onClick={() => onSelectStatus(card.status)}
                      style={{
                        display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.25rem",
              padding: "1.25rem",
              backgroundColor: card.bg,
              borderRadius: "0.75rem",
              border: `2px solid ${isActive ? card.textColor : card.border}`,
              boxShadow: isActive ? "0 6px 12px rgba(59,130,246,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
                        cursor: "pointer",
              color: card.textColor,
              transition: "all 0.2s ease-in-out",
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{card.label}</span>
            <span style={{ fontSize: "1.75rem", fontWeight: 700 }}>{card.value}</span>
            <span style={{ fontSize: "0.75rem" }}>
              {card.status === "ALL"
                ? "Kliknij, aby zobaczyć wszystkie firmy"
                : `Filtruj status: ${card.label.toLowerCase()}`}
            </span>
                    </button>
                        );
                      })}
                  </div>
                    );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid #D1D5DB",
  fontSize: "0.875rem",
  backgroundColor: "white",
};

const headerCellStyle: CSSProperties = {
  padding: "0.65rem 0.75rem",
  textAlign: "left",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#374151",
};

const cellStyle: CSSProperties = {
  padding: "0.75rem",
  verticalAlign: "top",
  fontSize: "0.875rem",
  color: "#1F2937",
  borderBottom: "1px solid #E5E7EB",
};

const cellCenteredStyle: CSSProperties = {
  ...cellStyle,
  textAlign: "center",
};

const primaryActionStyle: CSSProperties = {
  padding: "0.45rem 0.75rem",
  borderRadius: "0.5rem",
  border: "none",
  color: "white",
  backgroundColor: "#10B981",
  cursor: "pointer",
  fontSize: "0.8125rem",
  fontWeight: 600,
};

const secondaryActionStyle: CSSProperties = {
  padding: "0.4rem 0.75rem",
  borderRadius: "0.5rem",
  border: "1px solid #D1D5DB",
  backgroundColor: "white",
  color: "#374151",
  cursor: "pointer",
  fontSize: "0.75rem",
  fontWeight: 500,
};

function getStatusColor(status: string) {
  switch (status) {
    case "QUALIFIED":
      return "#10B981";
    case "REJECTED":
      return "#EF4444";
    case "NEEDS_REVIEW":
      return "#F59E0B";
    case "BLOCKED":
      return "#7C3AED";
    case "PENDING":
    default:
      return "#3B82F6";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "QUALIFIED":
      return "Zakwalifikowana";
    case "REJECTED":
      return "Odrzucona";
    case "NEEDS_REVIEW":
      return "Do przeglądu";
    case "BLOCKED":
      return "Zablokowana";
    case "PENDING":
      return "Do weryfikacji";
    default:
      return status;
  }
}

