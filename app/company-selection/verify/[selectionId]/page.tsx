"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "ALL", label: "Wszystkie statusy" },
  { value: "PENDING", label: "Do weryfikacji" },
  { value: "QUALIFIED", label: "Zakwalifikowane" },
  { value: "REJECTED", label: "Odrzucone" },
  { value: "NEEDS_REVIEW", label: "Wymagają przeglądu" },
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
  classificationUpdatedAt?: string | null;
}

interface CompanyStats {
  pending: number;
  qualified: number;
  rejected: number;
  needsReview: number;
  total: number;
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
  const params = useParams();
  const selectionId = useMemo(() => {
    const raw = params?.selectionId;
    if (!raw) return null;
    const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params]);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    oldStatus: string;
    newStatus: string;
    changed: boolean;
  } | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [progress, setProgress] = useState<VerificationProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCriteriaId, setSelectedCriteriaId] = useState<string>("");
  const [criteriaList, setCriteriaList] = useState<Array<{ id: number; name: string; description: string | null }>>([]);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [selectionName, setSelectionName] = useState<string>("");
  const [criteriaDetails, setCriteriaDetails] = useState<{
    criteriaText?: string;
    qualifiedThreshold?: number;
    rejectedThreshold?: number;
  } | null>(null);
  const [verificationModel, setVerificationModel] = useState<string>("gpt-4o");
  const [isCriteriaLocked, setIsCriteriaLocked] = useState(false);
  const [stats, setStats] = useState<CompanyStats>({
    pending: 0,
    qualified: 0,
    rejected: 0,
    needsReview: 0,
    total: 0,
  });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  // Komponent paginacji z numerami stron (jak na stronie classify)
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
          disabled={page === 1 || loading}
          style={{
            padding: "0.45rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #D1D5DB",
            backgroundColor: page === 1 || loading ? "#F3F4F6" : "white",
            color: "#374151",
            cursor: page === 1 || loading ? "not-allowed" : "pointer",
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
              disabled={loading}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid",
                borderColor: isActive ? "#2563EB" : "#D1D5DB",
                backgroundColor: isActive ? "#2563EB" : "white",
                color: isActive ? "white" : "#374151",
                cursor: loading ? "not-allowed" : "pointer",
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
          disabled={page >= totalPages || loading}
          style={{
            padding: "0.45rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #D1D5DB",
            backgroundColor: page >= totalPages || loading ? "#F3F4F6" : "white",
            color: "#374151",
            cursor: page >= totalPages || loading ? "not-allowed" : "pointer",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          →
        </button>
      </div>
    );
  };

  const selectedCount = selectedCompanies.length;
  const hasActiveFilters = useMemo(
    () => Boolean(searchQuery.trim()),
    [searchQuery]
  );

  useEffect(() => {
    if (detailCompany) {
      console.log("[Verify] Otwieram podgląd firmy", detailCompany.id);
      setVerificationResult(null);
    }
  }, [detailCompany]);

  useEffect(() => {
    if (selectionId) {
      loadSelectionInfo();
      loadCriteria();
      loadStats();
      loadCompanies();
      loadSelectionCriteria();
    }
  }, [selectionId]);

  // Załaduj szczegóły kryteriów gdy zmienia się selectedCriteriaId
  useEffect(() => {
    if (selectedCriteriaId) {
      // Pobierz model z localStorage (domyślnie gpt-4o)
      const savedModel = typeof window !== "undefined" 
        ? localStorage.getItem(`criteria-verification-model-${selectedCriteriaId}`) || "gpt-4o"
        : "gpt-4o";
      setVerificationModel(savedModel === "gpt-4o" ? "gpt-4o" : "gpt-4o-mini");
      
      fetch(`/api/company-selection/criteria?id=${selectedCriteriaId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.criteria) {
            setCriteriaDetails({
              criteriaText: data.criteria.criteriaText,
              qualifiedThreshold: data.criteria.qualifiedThreshold,
              rejectedThreshold: data.criteria.rejectedThreshold,
            });
          } else {
            setCriteriaDetails(null);
          }
        })
        .catch(err => {
          console.error("Błąd pobierania szczegółów kryteriów:", err);
          setCriteriaDetails(null);
        });
    } else {
      setCriteriaDetails(null);
      setVerificationModel("gpt-4o");
    }
  }, [selectedCriteriaId]);

  useEffect(() => {
    setPage(1);
  }, [selectedStatus, searchQuery]);

  useEffect(() => {
    if (selectionId) {
      loadCompanies();
    }
  }, [selectedStatus, searchQuery, selectionId, page]);

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
  }, [progressId, selectionId]);

  const loadSelectionInfo = async () => {
    if (!selectionId) return;
    try {
      const response = await fetch(`/api/company-selection/selections/${selectionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.selection) {
          setSelectionName(data.selection.name || "");
        }
      }
    } catch (error) {
      console.error("Błąd ładowania informacji o selekcji:", error);
    }
  };

  const loadCriteria = async () => {
    try {
      setCriteriaLoading(true);
      const response = await fetch("/api/company-selection/criteria");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.criteria)) {
        setCriteriaList(
          data.criteria.map((crit: any) => ({
            id: crit.id,
            name: crit.name,
            description: crit.description,
          }))
        );
      }
    } catch (error) {
      console.error("Błąd ładowania kryteriów:", error);
    } finally {
      setCriteriaLoading(false);
    }
  };

  const loadSelectionCriteria = async () => {
    if (!selectionId) {
      setSelectedCriteriaId("");
      setIsCriteriaLocked(false);
      return;
    }

    try {
      // Najpierw sprawdź, czy selekcja ma przypisane kryteria
      const response = await fetch(`/api/company-selection/criteria?selectionId=${selectionId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.success && Array.isArray(data.criteria) && data.criteria.length > 0) {
        // Selekcja ma przypisane kryteria - użyj ich
        setSelectedCriteriaId(String(data.criteria[0].id));
        
        // Sprawdź, czy są już zweryfikowane firmy - jeśli tak, zablokuj zmianę kryteriów
        const baseUrl = `/api/company-selection/list?selectionId=${selectionId}&limit=1`;
        const [qualifiedRes, rejectedRes, needsReviewRes] = await Promise.all([
          fetch(`${baseUrl}&status=QUALIFIED`),
          fetch(`${baseUrl}&status=REJECTED`),
          fetch(`${baseUrl}&status=NEEDS_REVIEW`),
        ]);

        const [qualifiedData, rejectedData, needsReviewData] = await Promise.all([
          qualifiedRes.json(),
          rejectedRes.json(),
          needsReviewRes.json(),
        ]);

        const hasVerifiedCompanies = 
          (qualifiedData.pagination?.total || 0) > 0 ||
          (rejectedData.pagination?.total || 0) > 0 ||
          (needsReviewData.pagination?.total || 0) > 0;
        
        setIsCriteriaLocked(hasVerifiedCompanies);
      } else {
        // Selekcja nie ma przypisanych kryteriów
        setSelectedCriteriaId("");
        setIsCriteriaLocked(false);
      }
    } catch (error) {
      console.error("Błąd ładowania kryteriów selekcji:", error);
      setSelectedCriteriaId("");
      setIsCriteriaLocked(false);
    }
  };

  const handleCriteriaChange = async (criteriaId: string) => {
    if (!selectionId) {
      setSelectedCriteriaId(criteriaId);
      return;
    }

    // Sprawdź, czy kryteria są zablokowane (selekcja ma już zweryfikowane firmy)
    if (isCriteriaLocked) {
      alert("Nie można zmienić kryteriów weryfikacji, ponieważ selekcja zawiera już zweryfikowane firmy. Aby zmienić kryteria, najpierw usuń wszystkie weryfikacje z tej selekcji.");
      return;
    }

    if (!criteriaId) {
      if (selectedCriteriaId) {
        setSavingCriteria(true);
        try {
          const response = await fetch("/api/company-selection/criteria", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: Number(selectedCriteriaId),
              selectionId: null,
            }),
          });

          const data = await response.json();
          if (data.success) {
            setSelectedCriteriaId("");
          } else {
            alert("Błąd: " + (data.error || "Nie udało się odpiąć kryteriów od selekcji"));
          }
        } catch (error) {
          console.error("Błąd odpinania kryteriów:", error);
          alert("Błąd połączenia z serwerem");
        } finally {
          setSavingCriteria(false);
        }
      } else {
        setSelectedCriteriaId("");
      }
      return;
    }

    setSavingCriteria(true);
    try {
      if (selectedCriteriaId && selectedCriteriaId !== criteriaId) {
        await fetch("/api/company-selection/criteria", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: Number(selectedCriteriaId),
            selectionId: null,
          }),
        });
      }

      const response = await fetch("/api/company-selection/criteria", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(criteriaId),
          selectionId: Number(selectionId),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSelectedCriteriaId(criteriaId);
      } else {
        alert("Błąd: " + (data.error || "Nie udało się przypisać kryteriów do selekcji"));
      }
    } catch (error) {
      console.error("Błąd przypisywania kryteriów:", error);
      alert("Błąd połączenia z serwerem");
    } finally {
      setSavingCriteria(false);
    }
  };

  const loadStats = async () => {
    if (!selectionId) {
      setStats({
        pending: 0,
        qualified: 0,
        rejected: 0,
        needsReview: 0,
        total: 0,
      });
      return;
    }

    try {
      const baseUrl = `/api/company-selection/list?selectionId=${selectionId}&limit=1`;
      const [pendingRes, qualifiedRes, rejectedRes, needsReviewRes, totalRes] =
        await Promise.all([
          fetch(`${baseUrl}&status=PENDING`),
          fetch(`${baseUrl}&status=QUALIFIED`),
          fetch(`${baseUrl}&status=REJECTED`),
          fetch(`${baseUrl}&status=NEEDS_REVIEW`),
          fetch(baseUrl),
        ]);

      const [pending, qualified, rejected, needsReview, total] = await Promise.all([
          pendingRes.json(),
          qualifiedRes.json(),
          rejectedRes.json(),
          needsReviewRes.json(),
          totalRes.json(),
        ]);

      setStats({
        pending: pending.pagination?.total || 0,
        qualified: qualified.pagination?.total || 0,
        rejected: rejected.pagination?.total || 0,
        needsReview: needsReview.pagination?.total || 0,
        total: total.pagination?.total || 0,
      });
    } catch (error) {
      console.error("Błąd ładowania statystyk:", error);
    }
  };

  const loadCompanies = async () => {
    if (!selectionId) {
      setCompanies([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let url = `/api/company-selection/list?page=${page}&limit=${PAGE_SIZE}&selectionId=${selectionId}`;
      
      if (selectedStatus !== "ALL") {
        url += `&status=${selectedStatus}`;
      }
      
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
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
        classificationUpdatedAt: company.classificationUpdatedAt ?? null,
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

  const handleSelectAllPending = async () => {
    if (!selectionId) return;

    try {
      // Pobierz wszystkie firmy ze statusem PENDING z selekcji
      const response = await fetch(
        `/api/company-selection/list?selectionId=${selectionId}&status=PENDING&limit=10000`
      );
      
      if (!response.ok) {
        throw new Error("Błąd pobierania firm");
      }

      const data = await response.json();
      const pendingCompanies = data.companies || [];

      // Filtruj tylko te z uzupełnioną stroną www
      const selectableIds = pendingCompanies
        .filter((company: Company) => hasCompanyWebsite(company))
        .map((company: Company) => company.id);

      if (selectableIds.length === 0) {
        alert("Brak firm 'Do weryfikacji' z uzupełnioną stroną www w tej selekcji.");
        return;
      }

      // Dodaj wszystkie do zaznaczonych (bez duplikatów)
      setSelectedCompanies((prev) => {
        const combined = [...new Set([...prev, ...selectableIds])];
        return combined;
      });

      alert(`Zaznaczono ${selectableIds.length} firm 'Do weryfikacji' z uzupełnioną stroną www.`);
    } catch (error) {
      console.error("Błąd zaznaczania wszystkich firm Do weryfikacji:", error);
      alert("Nie udało się zaznaczyć wszystkich firm. Spróbuj ponownie.");
    }
  };

  const handleVerifySingle = async (companyId: number) => {
    if (!selectedCriteriaId) {
      alert("Wybierz kryteria weryfikacji przed weryfikacją firm.");
      return;
    }

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
        body: JSON.stringify({ 
          companyId,
          criteriaId: selectedCriteriaId,
          selectionId: selectionId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        const newStatus = data.result.status;
        const oldStatus = company?.verificationStatus || "PENDING";
        
        // Aktualizuj lokalny stan firmy w tabeli NATYCHMIAST
        let shouldRemoveFromView = false;
        setCompanies((prevCompanies) => {
          const updated = prevCompanies.map((c) =>
            c.id === companyId
              ? {
                  ...c,
                  verificationStatus: newStatus,
                  verificationReason: data.result.reason || c.verificationReason,
                }
              : c
          );
          
          // Jeśli status się zmienił i firma nie pasuje do aktualnego filtra, usuń ją z listy
          if (oldStatus !== newStatus && selectedStatus !== "ALL" && selectedStatus !== newStatus) {
            shouldRemoveFromView = true;
            return updated.filter((c) => c.id !== companyId);
          }
          
          return updated;
        });
        
        // Jeśli modal jest otwarty dla tej firmy, zaktualizuj również modal
        if (detailCompany && detailCompany.id === companyId) {
          setDetailCompany({
            ...detailCompany,
            verificationStatus: newStatus,
            verificationReason: data.result.reason || detailCompany.verificationReason,
          });
        }
        
        // Odśwież statystyki
        await loadStats();
        
        // NIE odświeżaj listy firm, jeśli firma została już zaktualizowana lokalnie
        // loadCompanies() nadpisze lokalną aktualizację danymi z API (które mogą być stare lub z filtrem)
        // Jeśli firma zmieniła status i nie pasuje do filtra, już ją usunęliśmy z widoku
        // Jeśli firma nadal pasuje do filtra, lokalna aktualizacja jest wystarczająca
        
        const statusChanged = oldStatus !== newStatus;
        const message = statusChanged 
          ? `Firma zweryfikowana: ${getStatusLabel(newStatus)} (było: ${getStatusLabel(oldStatus)}, score: ${data.result.score})`
          : `Firma zweryfikowana: ${getStatusLabel(newStatus)} (status bez zmian, score: ${data.result.score})`;
        alert(message);
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert("Błąd weryfikacji" + (error instanceof Error ? `: ${error.message}` : ""));
    } finally {
      setVerifying(false);
    }
  };

  const handleReverifyInModal = async () => {
    if (!detailCompany) return;
    
    if (!selectedCriteriaId) {
      alert("Wybierz kryteria weryfikacji przed weryfikacją firm.");
      return;
    }

    if (!hasCompanyWebsite(detailCompany)) {
      alert("Ta firma nie ma uzupełnionej strony www. Uzupełnij ją przed weryfikacją.");
      return;
    }

    const oldStatus = detailCompany.verificationStatus;

    try {
      setReverifying(true);
      setVerificationResult(null);
      
      const response = await fetch("/api/company-selection/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          companyId: detailCompany.id,
          criteriaId: selectedCriteriaId,
          selectionId: selectionId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        const newStatus = data.result.status;
        const changed = oldStatus !== newStatus;
        
        setVerificationResult({
          oldStatus,
          newStatus,
          changed,
        });

        setDetailCompany({
          ...detailCompany,
          verificationStatus: newStatus,
          verificationReason: data.result.reason || detailCompany.verificationReason,
        });

        // Aktualizuj lokalny stan firmy w tabeli
        // Jeśli firma zmieniła status i nie pasuje do aktualnego filtra, usuń ją z widoku
        setCompanies((prevCompanies) => {
          const updated = prevCompanies.map((c) =>
            c.id === detailCompany.id
              ? {
                  ...c,
                  verificationStatus: newStatus,
                  verificationReason: data.result.reason || c.verificationReason,
                }
              : c
          );
          
          // Jeśli status się zmienił i firma nie pasuje do aktualnego filtra, usuń ją z listy
          if (oldStatus !== newStatus && selectedStatus !== "ALL" && selectedStatus !== newStatus) {
            return updated.filter((c) => c.id !== detailCompany.id);
          }
          
          return updated;
        });

        // Odśwież statystyki i listę firm (z małym opóźnieniem, aby baza zdążyła się zaktualizować)
        await loadStats();
        await new Promise(resolve => setTimeout(resolve, 300));
        await loadCompanies();
        
        // Po odświeżeniu listy, zaktualizuj modal z najnowszymi danymi
        // Użyj setTimeout, aby poczekać na zaktualizowanie companies state
        setTimeout(() => {
          if (detailCompany) {
            setCompanies((prevCompanies) => {
              const updatedCompany = prevCompanies.find((c) => c.id === detailCompany.id);
              if (updatedCompany) {
                setDetailCompany(updatedCompany);
              }
              return prevCompanies;
            });
          }
        }, 100);
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert("Błąd weryfikacji" + (error instanceof Error ? `: ${error.message}` : ""));
    } finally {
      setReverifying(false);
    }
  };

  const handleChangeStatusInList = async (companyId: number, newStatus: string) => {
    if (!selectedCriteriaId || !selectionId) {
      alert("Wybierz kryteria weryfikacji przed zmianą statusu");
      return;
    }

    setChangingStatus(true);
    try {
      const response = await fetch("/api/company-selection/update-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          status: newStatus,
          selectionId: selectionId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Aktualizuj lokalny stan firmy w tabeli
        const oldStatus = companies.find(c => c.id === companyId)?.verificationStatus || "PENDING";
        let shouldRemoveFromView = false;
        
        setCompanies((prevCompanies) => {
          const updated = prevCompanies.map((c) =>
            c.id === companyId
              ? {
                  ...c,
                  verificationStatus: newStatus,
                }
              : c
          );
          
          // Jeśli status się zmienił i firma nie pasuje do aktualnego filtra, usuń ją z listy
          if (oldStatus !== newStatus && selectedStatus !== "ALL" && selectedStatus !== newStatus) {
            shouldRemoveFromView = true;
            return updated.filter((c) => c.id !== companyId);
          }
          
          return updated;
        });
        
        // Jeśli modal jest otwarty dla tej firmy, zaktualizuj również modal
        if (detailCompany && detailCompany.id === companyId) {
          setDetailCompany({
            ...detailCompany,
            verificationStatus: newStatus,
          });
        }
        
        // Odśwież statystyki
        await loadStats();
      } else {
        alert("Błąd: " + (data.error || "Nie udało się zmienić statusu"));
      }
    } catch (error) {
      console.error("Błąd zmiany statusu:", error);
      alert("Błąd połączenia z serwerem");
    } finally {
      setChangingStatus(false);
    }
  };

  const handleChangeStatusInModal = async (newStatus: string) => {
    if (!detailCompany) return;

    if (!confirm(`Czy na pewno chcesz zmienić status na: ${getStatusLabel(newStatus)}?`)) {
      return;
    }

    try {
      setChangingStatus(true);
      const response = await fetch("/api/company-selection/update-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: detailCompany.id,
          status: newStatus,
          selectionId: selectionId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setDetailCompany({
          ...detailCompany,
          verificationStatus: newStatus,
        });
        
        await loadCompanies();
        await loadStats();
        
        setVerificationResult(null);
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert("Błąd zmiany statusu" + (error instanceof Error ? `: ${error.message}` : ""));
    } finally {
      setChangingStatus(false);
    }
  };

  const handleBlockCompany = async (companyId: number, companyName: string, companyWebsite: string | null | undefined) => {
    if (!companyWebsite) {
      alert("Nie można zablokować firmy bez adresu www. Blokowanie działa tylko po adresie www.");
      return;
    }

    if (
      !confirm(
        `Czy na pewno chcesz zablokować firmę "${companyName}"?\n\n` +
          `Adres www: ${companyWebsite}\n\n` +
          "Firma zostanie dodana do globalnej listy zablokowanych i automatycznie oznaczona jako BLOKOWANA we wszystkich selekcjach."
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
          website: companyWebsite,
          reason: "Zablokowane z widoku weryfikacji",
        }),
      });

      const addData = await addResponse.json();
      if (!addData.success && !String(addData.error || "").includes("już jest")) {
        alert(`Błąd dodawania do listy zablokowanych: ${addData.error}`);
        return;
      }

      // Endpoint /api/company-selection/blocked automatycznie ustawia status BLOCKED we wszystkich selekcjach
      // Odświeżamy dane
      loadStats();
      loadCompanies();
      if (detailCompany?.id === companyId) {
        setDetailCompany(null);
      }
      alert(`Firma "${companyName}" została zablokowana globalnie i usunięta z tej selekcji.`);
    } catch (error) {
      alert("Błąd blokowania firmy: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleVerifyBatch = async () => {
    if (!selectedCriteriaId || selectedCriteriaId.trim() === "") {
      alert("Wybierz kryteria weryfikacji przed weryfikacją firm.\n\nUpewnij się, że wybrałeś kryteria w dropdownie.");
      return;
    }

    if (selectedCompanies.length === 0) {
      alert("Zaznacz firmy do weryfikacji");
      return;
    }

    // Sprawdź, które zaznaczone firmy są na aktualnej stronie
    const companiesOnPage = selectedCompanies.filter((companyId) =>
      companies.some((c) => c.id === companyId)
    );

    // Jeśli są firmy poza aktualną stroną, pobierz ich dane z API
    let allSelectedCompaniesData: Company[] = [];
    
    if (companiesOnPage.length < selectedCompanies.length) {
      // Pobierz dane o wszystkich zaznaczonych firmach z API
      try {
        const response = await fetch(
          `/api/company-selection/list?selectionId=${selectionId}&limit=10000`
        );
        if (!response.ok) {
          throw new Error("Błąd pobierania firm");
        }
        const data = await response.json();
        allSelectedCompaniesData = (data.companies || []).filter((c: Company) =>
          selectedCompanies.includes(c.id)
        );
      } catch (error) {
        console.error("Błąd pobierania danych firm:", error);
        alert("Nie udało się pobrać danych o zaznaczonych firmach. Spróbuj ponownie.");
        return;
      }
    } else {
      // Wszystkie zaznaczone firmy są na aktualnej stronie
      allSelectedCompaniesData = companies.filter((c) =>
        selectedCompanies.includes(c.id)
      );
    }

    // Filtruj tylko te z uzupełnioną stroną www
    const selectableIds = allSelectedCompaniesData
      .filter((company) => hasCompanyWebsite(company))
      .map((company) => company.id);

    if (selectableIds.length === 0) {
      alert("Żadna z zaznaczonych firm nie ma uzupełnionej strony www. Uzupełnij dane przed weryfikacją.");
      return;
    }

    if (selectableIds.length !== selectedCompanies.length) {
      alert(`Pominięto ${selectedCompanies.length - selectableIds.length} firm bez adresu www.`);
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

      const criteriaIdNum = Number(selectedCriteriaId);
      if (!Number.isFinite(criteriaIdNum) || criteriaIdNum <= 0) {
        alert("Błąd: Niepoprawne ID kryteriów. Wybierz kryteria weryfikacji w dropdownie.");
        setVerifying(false);
        setProgressId(null);
        return;
      }

      const response = await fetch("/api/company-selection/verify", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          companyIds: selectableIds,
          progressId: newProgressId,
          criteriaId: criteriaIdNum,
          selectionId: selectionId,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        console.error("[Verify] Błąd weryfikacji:", data);
        alert(`Błąd: ${data.error || "Nieznany błąd"}`);
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
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  if (!selectionId) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <p>Brak ID selekcji w URL</p>
        <Link href="/company-selection/verify">← Powrót do listy selekcji</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <Link
        href="/company-selection/verify"
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
        ← Powrót do listy selekcji
      </Link>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Weryfikacja firm</h1>
            <p style={{ color: "#4B5563", maxWidth: "640px" }}>
              {selectionName && <strong>Selekcja: {selectionName}</strong>}
              <br />
              Weryfikuj firmy z wybranej bazy. Przeglądaj statusy weryfikacji, kwalifikuj firmy i przygotuj je do kampanii.
            </p>
          </div>
        </div>
      </div>

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
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#111827" }}>
            Wybierz kryteria weryfikacji *
          </label>
          <select
            value={selectedCriteriaId}
            onChange={(event) => handleCriteriaChange(event.target.value)}
            disabled={criteriaLoading || savingCriteria || isCriteriaLocked}
            style={{
              width: "100%",
              padding: "0.65rem",
              borderRadius: "0.5rem",
              border: "1px solid #D1D5DB",
              fontSize: "0.95rem",
              backgroundColor: criteriaLoading || savingCriteria || isCriteriaLocked ? "#F3F4F6" : "white",
              cursor: criteriaLoading || savingCriteria || isCriteriaLocked ? "not-allowed" : "pointer",
            }}
          >
            <option value="">-- Wybierz kryteria --</option>
            {criteriaLoading && <option value="" disabled>Ładowanie...</option>}
            {!criteriaLoading && criteriaList.length === 0 && (
              <option value="" disabled>Brak dostępnych kryteriów</option>
            )}
            {criteriaList.map((crit) => (
              <option key={crit.id} value={String(crit.id)}>
                {crit.name}
              </option>
            ))}
          </select>
          {savingCriteria && (
            <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.5rem" }}>
              Zapisuję wybór...
            </div>
          )}
          {isCriteriaLocked && (
            <div style={{ fontSize: "0.875rem", color: "#B91C1C", marginTop: "0.5rem", fontWeight: 500 }}>
              ⚠️ Wybór kryteriów jest zablokowany, ponieważ selekcja zawiera już zweryfikowane firmy. Aby zmienić kryteria, najpierw usuń wszystkie weryfikacje z tej selekcji.
            </div>
          )}
        </div>
      </div>

      {selectedCriteriaId && (
        <>
          {/* Wyświetl informacje o kryteriach weryfikacji */}
          {(() => {
            const currentCriteria = criteriaList.find(c => String(c.id) === selectedCriteriaId);
            if (!currentCriteria) return null;
            
            return (
              <div
                style={{
                  backgroundColor: "#F0F9FF",
                  borderRadius: "0.75rem",
                  border: "1px solid #BAE6FD",
                  padding: "1.25rem",
                  marginBottom: "1.5rem",
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.75rem", color: "#0C4A6E", fontSize: "1rem" }}>
                  Używane kryteria weryfikacji: {currentCriteria.name}
                </div>
                {currentCriteria.description && (
                  <div style={{ marginBottom: "0.75rem", color: "#075985", fontSize: "0.875rem" }}>
                    {currentCriteria.description}
                  </div>
                )}
                {criteriaDetails && (
                  <details style={{ marginTop: "0.75rem" }}>
                    <summary style={{ cursor: "pointer", color: "#0369A1", fontWeight: 500, fontSize: "0.875rem" }}>
                      Pokaż szczegóły kryteriów
                    </summary>
                    <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "white", borderRadius: "0.5rem", border: "1px solid #BAE6FD" }}>
                      <div style={{ marginBottom: "0.5rem", fontSize: "0.875rem", color: "#1F2937", whiteSpace: "pre-wrap" }}>
                        {criteriaDetails.criteriaText}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "#6B7280", marginTop: "0.5rem" }}>
                        <div>Próg kwalifikacji: ≥ {criteriaDetails.qualifiedThreshold}</div>
                        <div>Próg odrzucenia: ≤ {criteriaDetails.rejectedThreshold}</div>
                        <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #E5E7EB" }}>
                          Model AI: <strong>{verificationModel === "gpt-4o" ? "GPT-4o" : "GPT-4o Mini"}</strong>
                        </div>
                      </div>
                    </div>
                  </details>
                )}
              </div>
            );
          })()}
          
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
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.875rem", color: "#4B5563" }}>
                  Zaznaczono firm: <strong>{selectedCount}</strong> / {companies.length}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>
                    Łącznie rekordów: {total?.toLocaleString("pl-PL")}
                  </span>
                  <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>
                    Strona {page} z {totalPages}
                  </span>
                </div>
              </div>
              <PaginationControls position="top" />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleSelectAllPending}
                disabled={verifying || stats.pending === 0}
                style={{
                  padding: "0.6rem 1.2rem",
                  backgroundColor: verifying || stats.pending === 0 ? "#E5E7EB" : "#10B981",
                  color: "white",
                  borderRadius: "0.5rem",
                  border: "none",
                  cursor: verifying || stats.pending === 0 ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
                title={stats.pending === 0 ? "Brak firm 'Do weryfikacji' w tej selekcji" : ""}
              >
                Zaznacz wszystkie Do weryfikacji
              </button>
              <button
                type="button"
                onClick={handleVerifyBatch}
                disabled={verifying || selectedCount === 0 || !selectedCriteriaId}
                style={{
                  padding: "0.6rem 1.2rem",
                  backgroundColor: verifying || selectedCount === 0 || !selectedCriteriaId ? "#CBD5F5" : "#3B82F6",
                  color: "white",
                  borderRadius: "0.5rem",
                  border: "none",
                  cursor: verifying || selectedCount === 0 || !selectedCriteriaId ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {verifying ? "Weryfikuję..." : "Zweryfikuj zaznaczone"}
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
        </>
      )}

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
            <span>Zakwalifikowane: {progress.qualified}</span>
            <span>Odrzucone: {progress.rejected}</span>
            <span>Wymagają przeglądu: {progress.needsReview}</span>
            <span>Błędy: {progress.errors}</span>
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
                <th style={{ ...headerCellStyle, width: "40%" }}>Firma</th>
                <th style={{ ...headerCellStyle, width: "22%" }}>Status</th>
                <th style={{ ...headerCellStyle, width: "34%" }}>Powód / Komentarz</th>
                <th style={{ ...headerCellStyle, width: "14%" }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company, index) => {
                  const isSelected = selectedCompanies.includes(company.id);
                const segmentLabel = company.classificationSubClass || null;
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
                      onClick={() => {
                        console.log("[Verify] Klik wiersza - otwieram podgląd", company.id);
                        setDetailCompany(company);
                      }}
                      style={{
                      backgroundColor: isSelected
                        ? "#EFF6FF"
                        : index % 2 === 0
                        ? "white"
                        : "#F9FAFB",
                        borderBottom: "1px solid #E5E7EB",
                        cursor: "pointer",
                    }}
                    >
                    <td style={cellCenteredStyle} onClick={(e) => e.stopPropagation()}>
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
                    <td style={cellStyle} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <select
                          value={company.verificationStatus}
                          onChange={(e) => handleChangeStatusInList(company.id, e.target.value)}
                          disabled={changingStatus}
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.35rem",
                            backgroundColor: getStatusColor(company.verificationStatus),
                            color: "white",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            border: "none",
                            cursor: changingStatus ? "not-allowed" : "pointer",
                            width: "fit-content",
                            minWidth: "140px",
                            appearance: "none",
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='white' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 0.5rem center",
                            paddingRight: "2rem",
                          }}
                        >
                          <option value="QUALIFIED" style={{ backgroundColor: "#10B981", color: "white" }}>
                            Zakwalifikowane
                          </option>
                          <option value="REJECTED" style={{ backgroundColor: "#EF4444", color: "white" }}>
                            Odrzucone
                          </option>
                          <option value="NEEDS_REVIEW" style={{ backgroundColor: "#F59E0B", color: "white" }}>
                            Do przeglądu
                          </option>
                        </select>
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
                    <td style={cellStyle} onClick={(e) => e.stopPropagation()}>
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginTop: "1.5rem" }}>
        <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>
          Wyświetlono {companies.length} z {total?.toLocaleString("pl-PL")}
        </span>
        <PaginationControls position="bottom" />
      </div>

      {detailCompany && (
        <div style={detailModalStyle}>
          <div style={detailCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>{detailCompany.name}</h3>
                <p style={{ color: "#4B5563", margin: "0.25rem 0" }}>
                  {detailCompany.country || ""}
                  {detailCompany.country && detailCompany.city ? ` • ` : ""}
                  {detailCompany.city || ""}
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
              <div style={{ color: "#1F2937", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {detailCompany.industry && (
                  <div>
                    <strong>Branża:</strong> {detailCompany.industry}
                  </div>
                )}
                <div>
                  <strong>Specjalizacja:</strong> {detailCompany.classificationSubClass || "—"}
                  {typeof detailCompany.classificationConfidence === "number"
                    ? ` (score: ${detailCompany.classificationConfidence.toFixed(1)})`
                    : ""}
                </div>
              </div>
              
              {(() => {
                const industryRuleSignals = detailCompany.classificationSignals.filter((signal) =>
                  signal.startsWith("industry-rule:")
                );
                
                if (industryRuleSignals.length > 0) {
                  return (
                    <div style={{ marginTop: "0.5rem" }}>
                      <div style={{ fontSize: "0.75rem", color: "#6B7280", marginBottom: "0.25rem" }}>
                        <strong>Dopasowania branżowe:</strong>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {industryRuleSignals.map((signal, idx) => {
                          const parts = signal.split(":");
                          const specCode = parts[1] || "";
                          const score = parts[2] || "";
                          
                          return (
                            <span
                              key={`signal-${idx}`}
                              style={{
                                backgroundColor: "#EEF2FF",
                                borderRadius: "9999px",
                                padding: "0.25rem 0.6rem",
                                fontSize: "0.75rem",
                                color: "#4338CA",
                                fontWeight: 500,
                              }}
                              title={`Dopasowanie do specjalizacji ${specCode} z wynikiem ${score}`}
                            >
                              {specCode} (score: {score})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </section>

            {detailCompany.importBatch && (
              <section>
                <div style={{ color: "#1F2937", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>
                    <strong>Import:</strong> {detailCompany.importBatch.name}
                  </div>
                  <div>
                    <strong>Język:</strong> {detailCompany.importBatch.language}
                    {detailCompany.importBatch.market && (
                      <>, <strong>Rynek:</strong> {detailCompany.importBatch.market}</>
                    )}
                  </div>
                  {detailCompany.importBatch.createdAt && (
                    <div>
                      <strong>Dodano:</strong> {new Date(detailCompany.importBatch.createdAt).toLocaleString("pl-PL")}
                    </div>
                  )}
                </div>
              </section>
            )}

            <section>
              <h4 style={{ marginBottom: "0.5rem", color: "#111827" }}>Opis firmy</h4>
              <p style={{ color: "#1F2937", lineHeight: 1.6 }}>
                {detailCompany.description || "Brak opisu"}
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

            <section>
              <h4 style={{ marginBottom: "0.5rem", color: "#111827" }}>Status weryfikacji</h4>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.5rem",
                    backgroundColor: getStatusColor(detailCompany.verificationStatus),
                    color: "white",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  {getStatusLabel(detailCompany.verificationStatus)}
                </span>
                {detailCompany.verificationReason && (
                  <span style={{ color: "#6B7280", fontSize: "0.875rem" }}>
                    {detailCompany.verificationReason}
                  </span>
                )}
              </div>

              {verificationResult && (
                <div
                  style={{
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    backgroundColor: verificationResult.changed ? "#FEF3C7" : "#D1FAE5",
                    border: `1px solid ${verificationResult.changed ? "#FCD34D" : "#86EFAC"}`,
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: verificationResult.changed ? "#92400E" : "#065F46" }}>
                    {verificationResult.changed ? "Status się zmienił" : "Status pozostał bez zmian"}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: verificationResult.changed ? "#78350F" : "#047857" }}>
                    <div>Poprzedni status: <strong>{getStatusLabel(verificationResult.oldStatus)}</strong></div>
                    <div>Nowy status: <strong>{getStatusLabel(verificationResult.newStatus)}</strong></div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <select
                  value={detailCompany.verificationStatus}
                  onChange={(e) => handleChangeStatusInModal(e.target.value)}
                  disabled={changingStatus}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #D1D5DB",
                    backgroundColor: changingStatus ? "#F3F4F6" : "white",
                    color: "#111827",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: changingStatus ? "not-allowed" : "pointer",
                    flex: "1",
                    minWidth: "200px",
                  }}
                >
                  {STATUS_OPTIONS.filter(opt => opt.value !== "ALL" && opt.value !== "BLOCKED").map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleReverifyInModal}
                  disabled={reverifying || !selectedCriteriaId || !hasCompanyWebsite(detailCompany)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    backgroundColor: reverifying || !selectedCriteriaId || !hasCompanyWebsite(detailCompany) ? "#9CA3AF" : "#10B981",
                    color: "white",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: reverifying || !selectedCriteriaId || !hasCompanyWebsite(detailCompany) ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {reverifying ? "Weryfikuję..." : "Wykonaj ponowną weryfikację"}
                </button>
                <button
                  type="button"
                  onClick={() => detailCompany && handleBlockCompany(detailCompany.id, detailCompany.name, detailCompany.website)}
                  disabled={!detailCompany?.website}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    backgroundColor: !detailCompany?.website ? "#9CA3AF" : "#EF4444",
                    color: "white",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: !detailCompany?.website ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                  title={!detailCompany?.website ? "Firma musi mieć adres www, aby można było ją zablokować" : ""}
                >
                  Blokuj firmę
                </button>
                <button
                  type="button"
                  onClick={() => setDetailCompany(null)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #D1D5DB",
                    backgroundColor: "white",
                    color: "#374151",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Zamknij
                </button>
              </div>
            </section>
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
      return "#EF4444";
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

