"use client";

import { useEffect, useMemo, useState, useCallback, type CSSProperties, memo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Wszystkie" },
  { value: "NO_FETCHED", label: "Bez pobranych person" },
  { value: "NO_VERIFIED", label: "Bez weryfikowanych person" },
  { value: "FETCHED", label: "Pobrane persony" },
  { value: "VERIFIED", label: "Zweryfikowane persony" },
];

interface PersonaVerificationProgress {
  total: number;
  processed: number;
  percentage: number;
  withPersonas: number;
  verified: number;
  errors: number;
  status: "processing" | "completed" | "error";
  currentCompanyName?: string;
  estimatedTimeRemaining?: number;
}

interface PersonaStats {
  total: number;
  withPersonas: number;
  verified: number;
  noPersonas: number;
}

const detailModalStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(15, 23, 42, 0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "2rem",
  zIndex: 250,
  // Optymalizacje renderowania - zapobiega miganiu
  willChange: "opacity",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

const detailCardStyle: CSSProperties = {
  maxWidth: "960px",
  maxHeight: "85vh",
  width: "100%",
  overflowY: "auto",
  backgroundColor: "white",
  borderRadius: "0.75rem",
  border: "1px solid #E5E7EB",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
  padding: "2rem",
  display: "flex",
  // Optymalizacje renderowania - zapobiega miganiu
  willChange: "transform",
  transform: "translateZ(0)", // Wymusza akcelerację sprzętową
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
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
  website?: string | null;
  personaVerification?: {
    personaCriteriaId: number | null;
    positiveCount: number;
    negativeCount: number;
    unknownCount: number;
    totalCount: number;
    availableEmailCount?: number; // Liczba person z dostępnym e-mailem
    verifiedAt: string;
    apolloFetchedAt?: string;
  } | null;
}

interface ApolloEmployeesData {
  success: boolean;
  company?: {
    id: number;
    name: string;
    website: string | null;
  };
  apolloOrganization?: {
    id?: string | null;
    name?: string | null;
    domain?: string | null;
    employees?: number | null;
  } | null;
  people: Array<{
    id?: string;
    name?: string;
    title?: string;
    email?: string | null;
    emailStatus?: string;
    emailUnlocked?: boolean;
    departments?: string[];
    seniority?: string | null;
    linkedin_url?: string;
    photo_url?: string;
  }>;
  statistics?: {
    total: number;
    withTitles: number;
    withEmails: number;
    uniqueTitlesCount: number;
  };
  uniqueTitles?: string[];
  creditsInfo?: {
    searchCreditsUsed: number;
    message: string;
  };
  message?: string;
  companyNotFound?: boolean;
  apiAccessError?: boolean;
}

interface PersonaVerificationResult {
  companyId: number;
  personaCriteriaId: number | null;
  positiveCount: number;
  negativeCount: number;
  unknownCount: number;
  verifiedAt: string;
  employees: Array<{
    id?: string;
    name?: string;
    title?: string;
    email?: string | null;
    emailStatus?: string;
    emailUnlocked?: boolean;
    personaMatchStatus: "positive" | "negative" | "conditional";
    personaMatchScore: number | null;
    personaMatchReason: string;
    aiDecision?: string;
    aiScore?: number | null;
    aiReason?: string;
    personaMatchOverridden?: boolean;
  }>;
  metadata?: {
    statistics?: {
      total: number;
      withTitles: number;
      withEmails: number;
      uniqueTitlesCount: number;
    };
    uniqueTitles?: string[];
    apolloOrganization?: {
      id?: string;
      name?: string;
      domain?: string;
      employees?: number;
    } | null;
    creditsInfo?: {
      searchCreditsUsed: number;
      message: string;
    };
    personaBrief?: any;
  } | null;
}

export default function PersonaVerifyPage() {
  const params = useParams();
  const selectionId = useMemo(() => {
    const raw = params?.selectionId;
    if (!raw) return null;
    const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params]);

  const [companies, setCompanies] = useState<Company[]>([]); // Filtrowane firmy z aktualnej strony (po paginacji)
  const [allCompanies, setAllCompanies] = useState<Company[]>([]); // Wszystkie pobrane firmy (przed filtrowaniem i paginacją)
  const [filteredAllCompanies, setFilteredAllCompanies] = useState<Company[]>([]); // Wszystkie firmy po filtrowaniu (przed paginacją)
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [forceRefreshCache, setForceRefreshCache] = useState(false); // Wymuś ponowną weryfikację (wyłącz cache)
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);
  const [showModal, setShowModal] = useState(false); // Kontrola widoczności modala - opóźnione renderowanie
  const [selectedRowCompanyId, setSelectedRowCompanyId] = useState<number | null>(null); // ID firmy, której wiersz jest zaznaczony
  const [personaVerification, setPersonaVerification] = useState<PersonaVerificationResult | null>(null);
  const [loadingPersonaVerification, setLoadingPersonaVerification] = useState(false);
  const [apolloEmployees, setApolloEmployees] = useState<ApolloEmployeesData | null>(null);
  const [loadingApolloEmployees, setLoadingApolloEmployees] = useState(false);
  const [savingApolloEmployees, setSavingApolloEmployees] = useState(false);
  const [apolloFetchedAt, setApolloFetchedAt] = useState<string | null>(null);
  const [savingApolloBatch, setSavingApolloBatch] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [allQualifiedCompanyIds, setAllQualifiedCompanyIds] = useState<number[]>([]); // Wszystkie ID firm QUALIFIED z www
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionName, setSelectionName] = useState<string>("");
  
  // Zapamiętaj wybór kryteriów person w localStorage (per selekcja)
  const getStoredPersonaCriteriaId = useCallback((): string => {
    if (typeof window === "undefined" || !selectionId) return "";
    try {
      const stored = localStorage.getItem(`personaCriteriaId_${selectionId}`);
      return stored || "";
    } catch {
      return "";
    }
  }, [selectionId]);

  const [selectedPersonaCriteriaId, setSelectedPersonaCriteriaId] = useState<string>("");
  const [verificationModel, setVerificationModel] = useState<"gpt-4o-mini" | "gpt-4o">("gpt-4o-mini");
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [cacheModalData, setCacheModalData] = useState<Array<{
    id: number;
    titleNormalized: string;
    titleEnglish: string | null;
    departments: string[] | null;
    seniority: string | null;
    decision: string;
    score: number | null;
    reason: string | null;
    useCount: number;
    verifiedAt: string;
    lastUsedAt: string;
  }>>([]);
  const [loadingCacheModal, setLoadingCacheModal] = useState(false);
  const [cacheModalTab, setCacheModalTab] = useState<"positive" | "negative">("positive");
  const [cacheModalPage, setCacheModalPage] = useState<{ positive: number; negative: number }>({ positive: 1, negative: 1 });
  const cacheModalItemsPerPage = 10;
  const [cacheCount, setCacheCount] = useState<{ positive: number; negative: number; total: number }>({ positive: 0, negative: 0, total: 0 });
  const [loadingCacheCount, setLoadingCacheCount] = useState(false);
  
  // Załaduj zapisany wybór z localStorage po załadowaniu selectionId
  useEffect(() => {
    if (selectionId) {
      const stored = getStoredPersonaCriteriaId();
      if (stored) {
        setSelectedPersonaCriteriaId(stored);
      }
    }
  }, [selectionId, getStoredPersonaCriteriaId]);
  
  // Zapisz wybór do localStorage gdy się zmienia
  const handlePersonaCriteriaChange = useCallback((value: string) => {
    setSelectedPersonaCriteriaId(value);
    if (typeof window !== "undefined" && selectionId) {
      try {
        if (value) {
          localStorage.setItem(`personaCriteriaId_${selectionId}`, value);
        } else {
          localStorage.removeItem(`personaCriteriaId_${selectionId}`);
        }
      } catch (error) {
        console.error("Błąd zapisu do localStorage:", error);
      }
    }
    // Reset cache count gdy zmienia się wybór
    setCacheCount({ positive: 0, negative: 0, total: 0 });
  }, [selectionId]);

  // Pobierz liczbę zapisanych decyzji dla wybranych kryteriów
  const loadCacheCount = useCallback(async (personaCriteriaId: string) => {
    if (!personaCriteriaId) {
      setCacheCount({ positive: 0, negative: 0, total: 0 });
      return;
    }
    setLoadingCacheCount(true);
    try {
      const response = await fetch(`/api/company-selection/personas/${personaCriteriaId}/verification-cache`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const positive = data.data.filter((item: any) => item.decision === "positive").length;
          const negative = data.data.filter((item: any) => item.decision === "negative").length;
          setCacheCount({ positive, negative, total: data.data.length });
        } else {
          setCacheCount({ positive: 0, negative: 0, total: 0 });
        }
      } else {
        setCacheCount({ positive: 0, negative: 0, total: 0 });
      }
    } catch (error) {
      console.error("Błąd ładowania liczby cache:", error);
      setCacheCount({ positive: 0, negative: 0, total: 0 });
    } finally {
      setLoadingCacheCount(false);
    }
  }, []);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [hideZeroPersonas, setHideZeroPersonas] = useState<boolean>(false);
  const [hideZeroEmails, setHideZeroEmails] = useState<boolean>(false);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [progress, setProgress] = useState<PersonaVerificationProgress | null>(null);
  const [stats, setStats] = useState<PersonaStats>({
    total: 0,
    withPersonas: 0,
    verified: 0,
    noPersonas: 0,
  });
  const [personaCriteriaList, setPersonaCriteriaList] = useState<Array<{ id: number; name: string; description: string | null }>>([]);
  const [personaCriteriaLoading, setPersonaCriteriaLoading] = useState(false);

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

  // Policz ile zaznaczonych firm ma pobrane persony (do weryfikacji)
  const [selectedWithPersonasCount, setSelectedWithPersonasCount] = useState(0);
  
  // Pobierz dane o weryfikacjach person dla wszystkich zaznaczonych firm (również z innych stron)
  useEffect(() => {
    const fetchSelectedWithPersonas = async () => {
      if (selectedCompanies.length === 0) {
        setSelectedWithPersonasCount(0);
        return;
      }

      try {
        // WAŻNE: Zawsze sprawdzaj dane z Apollo (personaCriteriaId=null), aby wiedzieć, czy firma ma pobrane persony
        // z dostępnym e-mailem. To jest wymagane do weryfikacji AI, niezależnie od tego, czy istnieje już weryfikacja AI.
        // Weryfikacja AI jest potrzebna tylko do wyświetlania wyników, ale nie do określenia, czy firma może być zweryfikowana.
        const url = `/api/company-selection/personas/batch?companyIds=${selectedCompanies.join(",")}&personaCriteriaId=null`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Policz ile firm ma pobrane persony z dostępnym e-mailem (totalCount > 0 I availableEmailCount > 0)
            // Bo tylko takie mogą być weryfikowane przez AI
            const withPersonas = Object.values(data.data).filter((v: any) => 
              v && v.totalCount > 0 && (v.availableEmailCount || 0) > 0
            ).length;
            setSelectedWithPersonasCount(withPersonas);
          } else {
            setSelectedWithPersonasCount(0);
          }
        } else {
          setSelectedWithPersonasCount(0);
        }
      } catch (error) {
        console.error("Błąd pobierania danych o personach dla zaznaczonych firm:", error);
        setSelectedWithPersonasCount(0);
      }
    };

    fetchSelectedWithPersonas();
  }, [selectedCompanies]); // Usunięto selectedPersonaCriteriaId z zależności, bo zawsze sprawdzamy Apollo

  // Funkcja pomocnicza do filtrowania firm lokalnie (zdefiniowana przed useEffect, który jej używa)
  const applyFiltersToCompaniesLocal = useCallback((
    companiesToFilter: Company[],
    status: string,
    hideZero: boolean,
    hideZeroEmails: boolean,
    searchQuery: string
  ): Company[] => {
    let filtered = companiesToFilter;
    
    // Najpierw filtruj po wyszukiwarce (jeśli jest wpisane)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((company) => {
        const name = company.name?.toLowerCase() || "";
        return name.includes(query);
      });
    }
    
    // Następnie filtruj po statusie i checkboxach
    if (status !== "ALL" || hideZero || hideZeroEmails) {
      filtered = filtered.filter((company) => {
        const hasPersonaVerification = company.personaVerification !== undefined && company.personaVerification !== null;
        const hasPersonas = company.personaVerification && company.personaVerification.totalCount > 0;
        const hasAvailableEmails = company.personaVerification && (company.personaVerification.availableEmailCount || 0) > 0;
        const isVerified = company.personaVerification?.personaCriteriaId !== null;
        // Sprawdź czy było pobranie person z Apollo (czy istnieje apolloFetchedAt)
        const wasFetched = company.personaVerification?.apolloFetchedAt !== undefined && company.personaVerification?.apolloFetchedAt !== null;
        
        // Ukryj firmy z 0 personami, jeśli checkbox jest zaznaczony
        // Tylko firmy, które pobierały persony (mają apolloFetchedAt) ale wynik był 0
        if (hideZero && wasFetched && !hasPersonas) {
          return false;
        }
        
        // Ukryj firmy z 0 dostępnymi e-mailami, jeśli checkbox jest zaznaczony
        // Tylko firmy, które mają persony, ale żadna nie ma dostępnego e-maila
        if (hideZeroEmails && hasPersonas && !hasAvailableEmails) {
          return false;
        }
        
        // Filtruj po wybranym statusie
        if (status !== "ALL") {
          switch (status) {
            case "NO_FETCHED":
              // Pokazuj firmy gdzie NIE było pobrania (brak apolloFetchedAt)
              // NIE pokazuj firm gdzie pobranie było ale wynik = 0
              return !wasFetched;
            case "NO_VERIFIED":
              return !isVerified;
            case "FETCHED":
              // Pokazuj firmy gdzie było pobranie (ma apolloFetchedAt), niezależnie od wyniku
              return wasFetched;
            case "VERIFIED":
              return isVerified;
            default:
              return true;
          }
        }
        
        return true;
      });
    }
    
    return filtered;
  }, []);

  useEffect(() => {
    if (selectionId) {
      loadSelectionInfo();
      loadPersonaCriteria();
    }
  }, [selectionId]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedStatus, hideZeroPersonas, hideZeroEmails]);

  // Pobierz dane z API gdy zmienia się selectionId lub selectedPersonaCriteriaId
  // Użyj useRef aby śledzić czy selectedPersonaCriteriaId się zmienił i wymusić przeładowanie
  useEffect(() => {
    if (selectionId) {
      loadCompanies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionId, selectedPersonaCriteriaId]); // selectedPersonaCriteriaId jest używane w loadCompanies przez closure

  // Pobierz liczbę zapisanych decyzji gdy zmienia się selectedPersonaCriteriaId
  useEffect(() => {
    if (selectedPersonaCriteriaId) {
      loadCacheCount(selectedPersonaCriteriaId);
      // Pobierz zapisany model z localStorage dla tego kryterium
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(`persona-verification-model-${selectedPersonaCriteriaId}`);
        if (saved === "gpt-4o" || saved === "gpt-4o-mini") {
          setVerificationModel(saved);
        } else {
          setVerificationModel("gpt-4o-mini"); // Domyślnie
        }
      }
    } else {
      setCacheCount({ positive: 0, negative: 0, total: 0 });
      setVerificationModel("gpt-4o-mini"); // Reset do domyślnego
    }
  }, [selectedPersonaCriteriaId, loadCacheCount]);

  // Filtruj lokalnie wszystkie pobrane dane gdy zmienia się selectedStatus, hideZeroPersonas, hideZeroEmails lub searchQuery
  useEffect(() => {
    if (allCompanies.length > 0) {
      const filtered = applyFiltersToCompaniesLocal(allCompanies, selectedStatus, hideZeroPersonas, hideZeroEmails, searchQuery);
      setFilteredAllCompanies(filtered);
      setTotal(filtered.length);
      
      // Oblicz statystyki na podstawie przefiltrowanych firm (z uwzględnieniem hideZeroPersonas)
      // Ale tylko jeśli selectedStatus === "ALL" (bo wtedy pokazujemy wszystkie kategorie)
      if (selectedStatus === "ALL") {
        const statsData: PersonaStats = {
          total: filtered.length,
          // withPersonas = firmy gdzie było pobranie (apolloFetchedAt istnieje), niezależnie od wyniku
          withPersonas: filtered.filter((c: Company) => 
            c.personaVerification?.apolloFetchedAt !== undefined && c.personaVerification?.apolloFetchedAt !== null
          ).length,
          verified: filtered.filter((c: Company) => c.personaVerification?.personaCriteriaId !== null).length,
          // noPersonas = firmy gdzie NIE było pobrania (brak apolloFetchedAt), NIE liczymy firm gdzie pobranie było ale wynik = 0
          noPersonas: filtered.filter((c: Company) => 
            !c.personaVerification || 
            (c.personaVerification.apolloFetchedAt === undefined || c.personaVerification.apolloFetchedAt === null)
          ).length,
        };
        setStats(statsData);
      }
      
      // Zresetuj stronę do 1 po zmianie filtra
      setPage(1);
    }
  }, [selectedStatus, hideZeroPersonas, hideZeroEmails, searchQuery, allCompanies, applyFiltersToCompaniesLocal]);

  // Paginuj przefiltrowane firmy
  useEffect(() => {
    if (filteredAllCompanies.length > 0) {
      const startIndex = (page - 1) * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const paginated = filteredAllCompanies.slice(startIndex, endIndex);
      setCompanies(paginated);
    } else {
      setCompanies([]);
    }
  }, [filteredAllCompanies, page]);

      // Opóźnij pokazanie modala o jeden frame, aby tabela najpierw się wyrenderowała
      useEffect(() => {
        if (detailCompany) {
          // Najpierw pokaż modal (ale bez danych)
          const frameId = requestAnimationFrame(() => {
            setShowModal(true);
            // Następnie załaduj dane w następnym frame
            requestAnimationFrame(() => {
              loadPersonaVerification(detailCompany.id);
            });
          });
          return () => cancelAnimationFrame(frameId);
        } else {
          setShowModal(false);
          setApolloEmployees(null);
          setPersonaVerification(null);
          setApolloFetchedAt(null);
          // NIE odświeżamy listy firm po zamknięciu okna - dane są już aktualizowane lokalnie
          // To zapobiega miganiu tabeli przy otwieraniu/zamykaniu okna
        }
      }, [detailCompany]);

  // Polling postępu weryfikacji person
  useEffect(() => {
    if (!progressId) {
      return;
    }

    const shouldPoll = progress?.status === "processing";
    if (!shouldPoll) {
      return;
    }

    // Dynamiczny interwał polling - częściej dla małych batchy, rzadziej dla dużych
    // Dla 100+ rekordów nie potrzebujemy aktualizacji co sekundę
    let currentInterval = 1000; // Domyślnie 1 sekunda
    let intervalId: NodeJS.Timeout | null = null;

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/company-selection/personas/verify/progress?progressId=${progressId}`);
        if (!response.ok) {
          console.error("[Persona Verify] Błąd pobierania postępu:", response.status);
          return;
        }

        const data = await response.json();
        if (data.success && data.progress) {
          // Aktualizuj interwał na podstawie liczby rekordów
          const total = data.progress.total || 0;
          const newInterval = total > 50 ? 2000 : total > 20 ? 1500 : 1000;
          
          // Jeśli interwał się zmienił, zrestartuj polling z nowym interwałem
          if (newInterval !== currentInterval && intervalId) {
            clearInterval(intervalId);
            currentInterval = newInterval;
            intervalId = setInterval(pollProgress, currentInterval);
          } else if (!intervalId) {
            currentInterval = newInterval;
            intervalId = setInterval(pollProgress, currentInterval);
          }

          setProgress({
            total: data.progress.total,
            processed: data.progress.processed,
            percentage: data.progress.percentage,
            withPersonas: data.progress.withPersonas || 0,
            verified: data.progress.verified || 0,
            errors: data.progress.errors || 0,
            status: data.progress.status,
            currentCompanyName: data.progress.currentCompanyName,
            estimatedTimeRemaining: data.progress.estimatedTimeRemaining,
          });

          if (data.progress.status === "completed" || data.progress.status === "error") {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            setVerifying(false);
            setSavingApolloBatch(false);
            setProgressId(null);
            // Krótkie opóźnienie (500ms) aby upewnić się, że dane są zapisane w bazie
            // Dla większych batchy (100+ rekordów) dane są już zapisane, więc nie potrzebujemy długiego czekania
            await new Promise((resolve) => setTimeout(resolve, 500));
            // Przeładuj listę firm - wymuś odświeżenie danych
            // Wywołaj loadCompanies bezpośrednio, aby użyć aktualnej wartości selectedPersonaCriteriaId z closure
            try {
              await loadCompanies();
              // Po przeładowaniu, odznacz wszystkie zaznaczone firmy, aby użytkownik widział zmiany
              setSelectedCompanies([]);
            } catch (error) {
              console.error("[Persona Verify] Błąd przeładowania danych po zakończeniu:", error);
            }
          }
        }
      } catch (error) {
        console.error("[Persona Verify] Błąd pollingu postępu:", error);
      }
    };

    // Pierwsze wywołanie natychmiast
    pollProgress();
    
    // Rozpocznij polling z domyślnym interwałem (zostanie zaktualizowany po pierwszej odpowiedzi)
    intervalId = setInterval(pollProgress, currentInterval);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [progressId, progress?.status, selectedPersonaCriteriaId]);

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

  const loadPersonaCriteria = async () => {
    try {
      setPersonaCriteriaLoading(true);
      const response = await fetch("/api/company-selection/personas");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.personas)) {
        setPersonaCriteriaList(
          data.personas.map((persona: any) => ({
            id: persona.id,
            name: persona.name,
            description: persona.description,
          }))
        );
        // Ustaw pierwsze kryteria jako domyślne TYLKO jeśli:
        // 1. Są dostępne kryteria
        // 2. NIE ma zapisanego wyboru w localStorage
        // 3. NIE ma aktualnie wybranych kryteriów w state
        // WAŻNE: Nie nadpisuj wyboru użytkownika - jeśli już coś wybrał, zostaw to
        const storedId = getStoredPersonaCriteriaId();
        const currentId = selectedPersonaCriteriaId || storedId;
        
        if (data.personas.length > 0 && !currentId) {
          // Tylko jeśli NIE MA żadnego wyboru (ani w state, ani w localStorage), ustaw pierwsze dostępne
          handlePersonaCriteriaChange(String(data.personas[0].id));
        } else if (storedId && !selectedPersonaCriteriaId) {
          // Jeśli jest zapisany wybór w localStorage, ale state nie jest ustawiony, przywróć go
          setSelectedPersonaCriteriaId(storedId);
        }
      }
    } catch (error) {
      console.error("Błąd ładowania kryteriów person:", error);
    } finally {
      setPersonaCriteriaLoading(false);
    }
  };

  const loadCompanies = async () => {
    if (!selectionId) return;

    try {
      setLoading(true);
      
      // Pobierz WSZYSTKIE firmy (bez paginacji) - filtrowanie i paginacja będą lokalne
      const statsParams = new URLSearchParams({
        selectionId: String(selectionId),
        limit: "10000", // Duża liczba, aby pobrać wszystkie
        page: "1",
        status: "QUALIFIED",
      });
      
      if (searchQuery.trim()) {
        statsParams.append("search", searchQuery.trim());
      }
      
      const statsResponse = await fetch(`/api/company-selection/list?${statsParams.toString()}`);
      let allCompaniesForStats: Company[] = [];
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        allCompaniesForStats = statsData.companies || [];
        
        // Zapisz ID wszystkich firm QUALIFIED z www do stanu (dla przycisku "Zaznacz wszystkie")
        const companiesWithWebsite = allCompaniesForStats.filter((c: Company) => {
          const website = c.website?.trim();
          return website && (website.startsWith("http://") || website.startsWith("https://"));
        });
        setAllQualifiedCompanyIds(companiesWithWebsite.map((c: Company) => c.id));
      }
      
      // Pobierz weryfikacje person dla WSZYSTKICH firm (do statystyk)
      // ZAWSZE pobieramy dane z personaCriteriaId=null (dane z Apollo) dla statystyk "Pobrane persony"
      // oraz dane dla wybranych kryteriów (jeśli są wybrane) dla weryfikacji AI
      let allVerificationDataApollo: any = null; // Dane z Apollo (personaCriteriaId=null)
      let allVerificationDataAI: any = null; // Dane z weryfikacji AI (jeśli są wybrane kryteria)
      
      if (allCompaniesForStats.length > 0) {
        const allCompanyIds = allCompaniesForStats.map((c: Company) => c.id);
        try {
          // Zawsze pobierz dane z Apollo (personaCriteriaId=null)
          const apolloUrl = `/api/company-selection/personas/batch?companyIds=${allCompanyIds.join(",")}&personaCriteriaId=null`;
          const apolloResponse = await fetch(apolloUrl);
          
          if (apolloResponse.ok) {
            const apolloResult = await apolloResponse.json();
            if (apolloResult.success && apolloResult.data) {
              allVerificationDataApollo = apolloResult.data;
            }
          }
          
          // Jeśli są wybrane kryteria, pobierz też dane z weryfikacji AI
          if (selectedPersonaCriteriaId) {
            const aiUrl = `/api/company-selection/personas/batch?companyIds=${allCompanyIds.join(",")}&personaCriteriaId=${selectedPersonaCriteriaId}`;
            const aiResponse = await fetch(aiUrl);
            
            if (aiResponse.ok) {
              const aiResult = await aiResponse.json();
              if (aiResult.success && aiResult.data) {
                allVerificationDataAI = aiResult.data;
              }
            } else {
              console.error("[loadCompanies] Błąd pobierania danych AI:", aiResponse.status);
            }
          }
        } catch (verificationError) {
          console.error("Błąd pobierania weryfikacji person dla statystyk:", verificationError);
        }
      }
      
      // Połącz dane: jeśli są wybrane kryteria, PRIORYTET ma weryfikacja AI (nie Apollo)
      // Jeśli nie ma wybranych kryteriów, użyj danych Apollo
      let allVerificationData: any = {};
      
      if (selectedPersonaCriteriaId && allVerificationDataAI && Object.keys(allVerificationDataAI).length > 0) {
        // Jeśli są wybrane kryteria i są dane AI, zacznij od danych AI (to są dane dla wybranych kryteriów)
        allVerificationData = { ...allVerificationDataAI };
        
        // WAŻNE: Dodaj WSZYSTKIE firmy z danych Apollo (nawet jeśli nie mają weryfikacji AI)
        // Dla firm z weryfikacją AI: zachowaj dane AI, ale dodaj apolloFetchedAt z Apollo
        // Dla firm bez weryfikacji AI: użyj danych Apollo
        if (allVerificationDataApollo) {
          Object.keys(allVerificationDataApollo).forEach((companyId) => {
            const apolloData = allVerificationDataApollo[companyId];
            const aiData = allVerificationData[companyId];
            
            if (aiData) {
              // Firma ma weryfikację AI - zachowaj dane AI, ale dodaj apolloFetchedAt z Apollo
              allVerificationData[companyId] = {
                ...aiData,
                metadata: {
                  ...aiData.metadata,
                  apolloFetchedAt: apolloData.metadata?.apolloFetchedAt || aiData.metadata?.apolloFetchedAt,
                },
              };
            } else {
              // Firma NIE MA weryfikacji AI - użyj danych Apollo
              allVerificationData[companyId] = apolloData;
            }
          });
        }
      } else {
        // Jeśli nie ma wybranych kryteriów LUB nie ma danych AI, użyj danych Apollo
        // (to obejmuje przypadek, gdy są wybrane kryteria, ale nie ma weryfikacji AI dla żadnej firmy)
        allVerificationData = allVerificationDataApollo || {};
      }
      
      // Jeśli pobieramy dane z Apollo (nie ma wybranych kryteriów), sprawdź, czy firmy mają weryfikację AI
      // API już zwraca personaCriteriaId=-1 dla firm z weryfikacją AI, więc nie musimy nic dodatkowego robić
      
      // Oblicz statystyki z WSZYSTKICH firm
      if (allVerificationData && allCompaniesForStats.length > 0) {
        const enrichedAllCompanies = allCompaniesForStats.map((company: Company) => {
          const verification = allVerificationData[company.id];
          if (verification) {
            return {
              ...company,
              personaVerification: {
                personaCriteriaId: verification.personaCriteriaId,
                positiveCount: verification.positiveCount,
                negativeCount: verification.negativeCount,
                unknownCount: verification.unknownCount,
                totalCount: verification.totalCount,
                availableEmailCount: verification.availableEmailCount,
                verifiedAt: verification.verifiedAt,
                apolloFetchedAt: verification.metadata?.apolloFetchedAt,
              },
            };
          }
          return company;
        });
        
        // Oblicz statystyki na podstawie wszystkich firm, ale z uwzględnieniem hideZeroPersonas
        // (jeśli hideZeroPersonas jest zaznaczone, wykluczamy firmy z pobranymi personami = 0)
        let companiesForStats = enrichedAllCompanies;
        if (hideZeroPersonas) {
          companiesForStats = enrichedAllCompanies.filter((company) => {
            const wasFetched = company.personaVerification?.apolloFetchedAt !== undefined && company.personaVerification?.apolloFetchedAt !== null;
            const hasPersonas = company.personaVerification && company.personaVerification.totalCount > 0;
            // Wyklucz firmy, które pobierały persony (mają apolloFetchedAt) ale wynik był 0
            return !(wasFetched && !hasPersonas);
          });
        }
        
        const statsData: PersonaStats = {
          total: companiesForStats.length,
          // withPersonas = firmy gdzie było pobranie (apolloFetchedAt istnieje), niezależnie od wyniku
          withPersonas: companiesForStats.filter((c: Company) => 
            c.personaVerification?.apolloFetchedAt !== undefined && c.personaVerification?.apolloFetchedAt !== null
          ).length,
          verified: companiesForStats.filter((c: Company) => c.personaVerification?.personaCriteriaId !== null).length,
          // noPersonas = firmy gdzie NIE było pobrania (brak apolloFetchedAt), NIE liczymy firm gdzie pobranie było ale wynik = 0
          noPersonas: companiesForStats.filter((c: Company) => 
            !c.personaVerification || 
            (c.personaVerification.apolloFetchedAt === undefined || c.personaVerification.apolloFetchedAt === null)
          ).length,
        };
        setStats(statsData);
      } else {
        setStats({
          total: allCompaniesForStats.length,
          withPersonas: 0,
          verified: 0,
          noPersonas: allCompaniesForStats.length,
        });
      }
      
      // Przetwórz dane dla WSZYSTKICH firm (używamy allCompaniesForStats i allVerificationData)
      if (allVerificationData && allCompaniesForStats.length > 0) {
        // Dodaj informacje o weryfikacjach person do wszystkich firm
        const enrichedAllCompanies = allCompaniesForStats.map((company: Company) => {
          const verification = allVerificationData[company.id];
          if (verification) {
            return {
              ...company,
              personaVerification: {
                personaCriteriaId: verification.personaCriteriaId,
                positiveCount: verification.positiveCount,
                negativeCount: verification.negativeCount,
                unknownCount: verification.unknownCount,
                totalCount: verification.totalCount,
                availableEmailCount: verification.availableEmailCount,
                verifiedAt: verification.verifiedAt,
                apolloFetchedAt: verification.metadata?.apolloFetchedAt,
              },
            };
          }
          return company;
        });
        
        // Zapisz wszystkie firmy (przed filtrowaniem) do stanu
        setAllCompanies(enrichedAllCompanies);
      } else {
        // Brak weryfikacji - ustaw puste dane weryfikacji dla wszystkich firm
        setAllCompanies(allCompaniesForStats);
      }
      
      // Total będzie ustawiony przez useEffect, który filtruje allCompanies
    } catch (error) {
      console.error("Błąd ładowania firm:", error);
      // W przypadku błędu, ustaw puste dane zamiast pozostawić stare
      setAllCompanies([]);
      setCompanies([]);
      setStats({
        total: 0,
        withPersonas: 0,
        verified: 0,
        noPersonas: 0,
      });
    } finally {
      setLoading(false);
    }
  };


  const loadApolloEmployees = async (companyId: number) => {
    try {
      setLoadingApolloEmployees(true);
      const response = await fetch(`/api/company-selection/apollo/employees?companyId=${companyId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      
      setApolloEmployees(data);
      
      // Po pobraniu danych z Apollo, zapisz je do bazy, aby były dostępne przy następnym otwarciu
      if (data.success && data.people && data.people.length > 0) {
        try {
          const saveResponse = await fetch("/api/company-selection/personas/save-apollo-batch", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyIds: [companyId],
              progressId: `single-${companyId}-${Date.now()}`, // Unikalny ID dla pojedynczego zapisu
            }),
          });
          
          if (saveResponse.ok) {
            // Po zapisaniu, odśwież dane z bazy
            await loadPersonaVerification(companyId);
          }
        } catch (saveError) {
          console.error("Błąd zapisywania danych do bazy:", saveError);
          // Nie pokazujemy błędu użytkownikowi, bo dane są już wyświetlane
        }
      }
    } catch (error) {
      console.error("Błąd ładowania person z Apollo:", error);
      alert("Błąd pobierania person z Apollo: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoadingApolloEmployees(false);
    }
  };

  const loadPersonaVerification = async (companyId: number) => {
    try {
      setLoadingPersonaVerification(true);
      
      // Jeśli selectedPersonaCriteriaId jest ustawione, najpierw spróbuj pobrać weryfikację dla tych kryteriów
      // Jeśli nie ma, spróbuj pobrać dane z Apollo (personaCriteriaId=null)
      if (selectedPersonaCriteriaId) {
        const aiUrl = `/api/company-selection/personas/company/${companyId}?personaCriteriaId=${selectedPersonaCriteriaId}`;
        const aiResponse = await fetch(aiUrl);
        
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          // Sprawdź, czy są dane (data !== null) - jeśli null, to znaczy, że nie ma weryfikacji AI
          if (aiData.success && aiData.data !== null && aiData.data !== undefined) {
            const metadata = aiData.data.metadata || {};
            setPersonaVerification({
              companyId: aiData.data.companyId,
              personaCriteriaId: aiData.data.personaCriteriaId,
              positiveCount: aiData.data.positiveCount,
              negativeCount: aiData.data.negativeCount,
              unknownCount: aiData.data.unknownCount,
              verifiedAt: aiData.data.verifiedAt,
              employees: aiData.data.employees || [],
              metadata: metadata,
            });
            
            // Ustaw apolloFetchedAt jeśli jest w metadanych
            if (metadata.apolloFetchedAt) {
              setApolloFetchedAt(metadata.apolloFetchedAt);
            } else {
              setApolloFetchedAt(null);
            }
            // Resetuj apolloEmployees gdy mamy weryfikację AI (persony są w personaVerification.employees)
            setApolloEmployees(null);
            return; // Mamy weryfikację AI, nie trzeba sprawdzać Apollo
          }
          // Jeśli aiData.success === true ale data === null, to znaczy, że nie ma weryfikacji AI - sprawdź Apollo
        } else {
          // Błąd HTTP - loguj, ale kontynuuj sprawdzanie Apollo
          console.error(`[DEBUG loadPersonaVerification] Błąd pobierania weryfikacji AI: ${aiResponse.status}`);
        }
        
        // Jeśli nie ma weryfikacji AI (data === null lub inny błąd), sprawdź dane z Apollo
        const apolloUrl = `/api/company-selection/personas/company/${companyId}?personaCriteriaId=null`;
        const apolloResponse = await fetch(apolloUrl);
        
        if (apolloResponse.ok) {
          const apolloData = await apolloResponse.json();
          if (apolloData.success && apolloData.data) {
            const metadata = apolloData.data.metadata || {};
            setPersonaVerification(null); // Brak weryfikacji AI
            setApolloFetchedAt(metadata.apolloFetchedAt || null);
            
            // Załaduj persony z bazy jako apolloEmployees (nawet jeśli lista jest pusta)
            setApolloEmployees({
              success: true,
              company: { id: companyId, name: detailCompany?.name || "", website: detailCompany?.website || null },
              apolloOrganization: metadata.apolloOrganization || null,
              people: apolloData.data.employees || [],
              statistics: metadata.statistics || null,
              uniqueTitles: metadata.uniqueTitles || [],
              creditsInfo: metadata.creditsInfo || null,
            });
            return;
          }
        }
        
        // Jeśli nie ma ani weryfikacji AI, ani danych z Apollo
        setPersonaVerification(null);
        setApolloEmployees(null);
        setApolloFetchedAt(null);
      } else {
        // Jeśli nie ma selectedPersonaCriteriaId, pobierz dane z Apollo (personaCriteriaId=null)
        const url = `/api/company-selection/personas/company/${companyId}?personaCriteriaId=null`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const metadata = data.data.metadata || {};
            setPersonaVerification({
              companyId: data.data.companyId,
              personaCriteriaId: data.data.personaCriteriaId,
              positiveCount: data.data.positiveCount,
              negativeCount: data.data.negativeCount,
              unknownCount: data.data.unknownCount,
              verifiedAt: data.data.verifiedAt,
              employees: data.data.employees || [],
              metadata: metadata,
            });
            
            // Sprawdź, czy persony zostały pobrane z Apollo - zawsze ustaw jeśli jest w metadanych
            if (metadata.apolloFetchedAt) {
              setApolloFetchedAt(metadata.apolloFetchedAt);
              // Jeśli nie ma weryfikacji AI, załaduj persony z bazy jako apolloEmployees
              if (!data.data.personaCriteriaId && data.data.employees && data.data.employees.length > 0) {
                setApolloEmployees({
                  success: true,
                  company: { id: companyId, name: detailCompany?.name || "", website: detailCompany?.website || null },
                  apolloOrganization: metadata.apolloOrganization || null,
                  people: data.data.employees,
                  statistics: metadata.statistics || null,
                  uniqueTitles: metadata.uniqueTitles || [],
                  creditsInfo: metadata.creditsInfo || null,
                });
              }
            }
          } else {
            setPersonaVerification(null);
            setApolloFetchedAt(null);
          }
        } else if (response.status === 404) {
          // 404 oznacza brak weryfikacji - to nie jest błąd, tylko normalny stan
          setPersonaVerification(null);
          setApolloFetchedAt(null);
        } else {
          // Inny błąd (500, etc.) - loguj, ale nie resetuj stanu
          console.error("Błąd pobierania weryfikacji person:", response.status, response.statusText);
        }
      }
    } catch (error) {
      console.error("Błąd ładowania weryfikacji person:", error);
      setPersonaVerification(null);
      setApolloFetchedAt(null);
    } finally {
      setLoadingPersonaVerification(false);
    }
  };

  const handleSaveApolloEmployees = async (companyId: number) => {
    try {
      setSavingApolloEmployees(true);
      const response = await fetch("/api/company-selection/personas/save-apollo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();
      if (data.success) {
        // Przeładuj weryfikację person (teraz będzie zawierać persony z Apollo)
        await loadPersonaVerification(companyId);
        // Pobierz też świeże dane z Apollo do wyświetlenia
        await loadApolloEmployees(companyId);
        alert(`Persony z Apollo zostały zapisane (${data.data.employeesCount} person)`);
      } else {
        alert("Błąd: " + (data.error || "Nie udało się zapisać person z Apollo"));
      }
    } catch (error) {
      console.error("Błąd zapisywania person z Apollo:", error);
      alert("Błąd połączenia z serwerem");
    } finally {
      setSavingApolloEmployees(false);
    }
  };

  const handleSaveApolloBatch = async () => {
    if (selectedCompanies.length === 0) {
      alert("Wybierz przynajmniej jedną firmę do pobrania person z Apollo.");
      return;
    }

    if (!confirm(`Czy na pewno chcesz pobrać i zapisać persony z Apollo dla ${selectedCompanies.length} firm?`)) {
      return;
    }

    try {
      setSavingApolloBatch(true);
      
      // Utwórz postęp
      const progressResponse = await fetch("/api/company-selection/personas/verify/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total: selectedCompanies.length }),
      });

      const progressData = await progressResponse.json();
      if (!progressResponse.ok || !progressData.success || !progressData.progressId) {
        alert(`Nie udało się utworzyć postępu: ${progressData.error || "brak szczegółów"}`);
        setSavingApolloBatch(false);
        return;
      }

      const newProgressId = progressData.progressId as string;
      setProgressId(newProgressId);
      setProgress({
        total: selectedCompanies.length,
        processed: 0,
        percentage: 0,
        withPersonas: 0,
        verified: 0,
        errors: 0,
        status: "processing",
      });

      // Uruchom pobieranie w tle (PUT request do endpointu batch)
      const response = await fetch("/api/company-selection/personas/save-apollo-batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyIds: selectedCompanies,
          progressId: newProgressId,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        console.error("[Persona Apollo] Błąd pobierania:", data);
        setSavingApolloBatch(false);
        setProgressId(null);
        setProgress(null);
        alert(`Błąd: ${data.error || "Nieznany błąd"}`);
      }
      // Postęp będzie aktualizowany przez polling
    } catch (error) {
      alert("Błąd pobierania person: " + (error instanceof Error ? error.message : String(error)));
      setSavingApolloBatch(false);
      setProgressId(null);
      setProgress(null);
    }
  };

  const handleVerifyPersonas = async (companyId: number, useApolloEmployees: boolean = false) => {
    if (!selectedPersonaCriteriaId) {
      alert("Wybierz kryteria weryfikacji person przed rozpoczęciem weryfikacji.");
      return;
    }

    try {
      setVerifying(true);
      
      // Jeśli mamy już pobrane persony z Apollo, przekaż je w body
      const requestBody: any = {
        companyId,
        personaCriteriaId: Number(selectedPersonaCriteriaId),
        force: true, // Wymuś nową weryfikację, nawet jeśli istnieje już weryfikacja
        useStoredEmployees: false,
      };
      
      if (useApolloEmployees && apolloEmployees && apolloEmployees.success) {
        requestBody.employees = apolloEmployees.people;
        requestBody.statistics = apolloEmployees.statistics;
        requestBody.uniqueTitles = apolloEmployees.uniqueTitles;
        requestBody.apolloOrganization = apolloEmployees.apolloOrganization;
      } else {
        // Jeśli nie ma person z Apollo, użyj zapisanych z bazy
        requestBody.useStoredEmployees = true;
      }
      
      const response = await fetch("/api/company-selection/personas/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Przeładuj weryfikację person dla tej firmy (to automatycznie przełączy widok na wyniki weryfikacji)
        await loadPersonaVerification(companyId);
        // Aktualizuj dane lokalnie zamiast przeładowywać całą listę - zapobiega miganiu
        if (data.data) {
          // Użyj personaCriteriaId z odpowiedzi API, lub jeśli nie ma, użyj selectedPersonaCriteriaId
          const personaCriteriaId = data.data.personaCriteriaId !== undefined && data.data.personaCriteriaId !== null
            ? data.data.personaCriteriaId
            : (selectedPersonaCriteriaId ? Number(selectedPersonaCriteriaId) : null);
          
          // Oblicz availableEmailCount z employees, jeśli nie jest w odpowiedzi
          let availableEmailCount = data.data.availableEmailCount;
          if (availableEmailCount === undefined && data.data.employees && Array.isArray(data.data.employees)) {
            const hasAvailableEmail = (person: any): boolean => {
              if (person.email) return true;
              if (person.emailUnlocked) return true;
              const status = (person.emailStatus || person.email_status || person.contact_email_status)?.toLowerCase();
              return status === "verified" || status === "guessed" || status === "unverified" || status === "extrapolated";
            };
            availableEmailCount = data.data.employees.filter(hasAvailableEmail).length;
          }
          
          const updatedVerification = {
            personaCriteriaId: personaCriteriaId,
            positiveCount: data.data.positiveCount || 0,
            negativeCount: data.data.negativeCount || 0,
            unknownCount: data.data.unknownCount || 0,
            totalCount: (data.data.positiveCount || 0) + (data.data.negativeCount || 0) + (data.data.unknownCount || 0),
            availableEmailCount: availableEmailCount || 0,
            verifiedAt: data.data.verifiedAt || new Date().toISOString(),
            apolloFetchedAt: data.data.metadata?.apolloFetchedAt || null,
          };
          
          setAllCompanies((prev) => {
            const updated = prev.map((c) => {
              if (c.id === companyId) {
                return {
                  ...c,
                  personaVerification: updatedVerification,
                };
              }
              return c;
            });
            // Wywołaj ponowne filtrowanie po aktualizacji
            // Użyj setTimeout aby uniknąć aktualizacji stanu podczas renderowania
            setTimeout(() => {
              const filtered = applyFiltersToCompaniesLocal(updated, selectedStatus, hideZeroPersonas, hideZeroEmails, searchQuery);
              setFilteredAllCompanies(filtered);
              setTotal(filtered.length);
            }, 0);
            return updated;
          });
        }
        // Nie pokazuj alertu - wyniki będą widoczne w modalu
      } else {
        console.error("[DEBUG] Verification failed:", data.error);
        alert("Błąd: " + (data.error || "Nie udało się przeprowadzić weryfikacji person"));
      }
    } catch (error) {
      console.error("[DEBUG] Error in handleVerifyPersonas:", error);
      alert("Błąd połączenia z serwerem: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifySelected = async () => {
    if (selectedCompanies.length === 0) {
      alert("Wybierz przynajmniej jedną firmę do weryfikacji person.");
      return;
    }

    if (!selectedPersonaCriteriaId) {
      alert("Wybierz kryteria weryfikacji person przed rozpoczęciem weryfikacji.");
      return;
    }

    // Pobierz dane o weryfikacjach person dla wszystkich zaznaczonych firm
    // WAŻNE: Zawsze sprawdzaj dane z Apollo (personaCriteriaId=null), aby wiedzieć, czy firma ma pobrane persony
    // z dostępnym e-mailem. To jest wymagane do weryfikacji AI, niezależnie od tego, czy istnieje już weryfikacja AI.
    let companiesWithPersonas: number[] = [];
    try {
      const url = `/api/company-selection/personas/batch?companyIds=${selectedCompanies.join(",")}&personaCriteriaId=null`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Filtruj tylko firmy z pobranymi personami, które mają przynajmniej jedną personę z dostępnym e-mailem
          // (bo tylko takie mogą być weryfikowane przez AI)
          companiesWithPersonas = selectedCompanies.filter((companyId) => {
            const verification = data.data[companyId];
            // Firma musi mieć persony (totalCount > 0) I przynajmniej jedną z dostępnym e-mailem (availableEmailCount > 0)
            return verification && verification.totalCount > 0 && (verification.availableEmailCount || 0) > 0;
          });
        }
      }
    } catch (error) {
      console.error("Błąd pobierania danych o personach:", error);
      alert("Błąd podczas sprawdzania, które firmy mają pobrane persony.");
      return;
    }

    if (companiesWithPersonas.length === 0) {
      alert("Żadna z zaznaczonych firm nie ma pobranych person z Apollo. Najpierw pobierz persony, a następnie przeprowadź weryfikację.");
      return;
    }

    if (!confirm(`Czy na pewno chcesz zweryfikować stanowiska dla ${companiesWithPersonas.length} firm z pobranymi personami?`)) {
      return;
    }

    try {
      setVerifying(true);
      
      // Utwórz postęp
      const progressResponse = await fetch("/api/company-selection/personas/verify/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total: companiesWithPersonas.length }),
      });

      const progressData = await progressResponse.json();
      if (!progressResponse.ok || !progressData.success || !progressData.progressId) {
        alert(`Nie udało się utworzyć postępu: ${progressData.error || "brak szczegółów"}`);
        setVerifying(false);
        return;
      }

      const newProgressId = progressData.progressId as string;
      setProgressId(newProgressId);
      setProgress({
        total: companiesWithPersonas.length,
        processed: 0,
        percentage: 0,
        withPersonas: 0,
        verified: 0,
        errors: 0,
        status: "processing",
      });

      const criteriaIdNum = Number(selectedPersonaCriteriaId);
      if (!Number.isFinite(criteriaIdNum) || criteriaIdNum <= 0) {
        alert("Błąd: Niepoprawne ID kryteriów. Wybierz kryteria weryfikacji w dropdownie.");
        setVerifying(false);
        setProgressId(null);
        setProgress(null);
        return;
      }

      // Uruchom weryfikację w tle (PUT request do endpointu batch) - tylko dla firm z pobranymi personami
      // forceRefresh: jeśli true, wyłącza cache i wymusza ponowną weryfikację przez AI (przydatne do wypełnienia cache)
      const response = await fetch("/api/company-selection/personas/verify-batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyIds: companiesWithPersonas, // Tylko firmy z pobranymi personami
          progressId: newProgressId,
          personaCriteriaId: criteriaIdNum,
          forceRefresh: forceRefreshCache, // Jeśli true, wyłącza cache i wymusza ponowną weryfikację (przydatne do wypełnienia cache)
          model: verificationModel, // Model AI do użycia
        }),
      });

      const data = await response.json();
      if (!data.success) {
        console.error("[Persona Verify] Błąd weryfikacji:", data);
        setVerifying(false);
        setProgressId(null);
        setProgress(null);
        alert(`Błąd: ${data.error || "Nieznany błąd"}`);
      }
      // Postęp będzie aktualizowany przez polling
    } catch (error) {
      alert("Błąd weryfikacji: " + (error instanceof Error ? error.message : String(error)));
      setVerifying(false);
      setProgressId(null);
      setProgress(null);
    }
  };

  const toggleCompanySelection = (companyId: number) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  };

  const toggleSelectAll = () => {
    // Zaznacza/odznacza tylko firmy z aktualnej strony
    if (selectedCompanies.length === companies.length && companies.every((c) => selectedCompanies.includes(c.id))) {
      // Jeśli wszystkie firmy z aktualnej strony są zaznaczone, odznacz je
      setSelectedCompanies((prev) => prev.filter((id) => !companies.some((c) => c.id === id)));
    } else {
      // Zaznacz wszystkie firmy z aktualnej strony (dodaj do istniejących)
      const currentPageIds = companies.map((c) => c.id);
      setSelectedCompanies((prev) => {
        const newIds = currentPageIds.filter((id) => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  };

  const handleSelectAllQualified = async () => {
    if (!selectionId) return;

    try {
      // Pobierz wszystkie firmy QUALIFIED z selekcji
      const response = await fetch(
        `/api/company-selection/list?selectionId=${selectionId}&status=QUALIFIED&limit=10000`
      );
      
      if (!response.ok) {
        throw new Error("Błąd pobierania firm");
      }

      const data = await response.json();
      const allQualifiedCompanies = data.companies || [];
      
      // Filtruj tylko firmy z adresem www (bo tylko dla nich można pobrać persony)
      const companiesWithWebsite = allQualifiedCompanies.filter((c: Company) => {
        const website = c.website?.trim();
        return website && (website.startsWith("http://") || website.startsWith("https://"));
      });

      if (companiesWithWebsite.length === 0) {
        alert("Brak firm QUALIFIED z uzupełnioną stroną www w tej selekcji.");
        return;
      }

      const allCompanyIds = companiesWithWebsite.map((c: Company) => c.id);
      setAllQualifiedCompanyIds(allCompanyIds); // Zapisz listę wszystkich firm dla późniejszego użycia
      
      // Sprawdź czy wszystkie firmy są już zaznaczone
      const allSelected = allCompanyIds.length > 0 && allCompanyIds.every((id: number) => selectedCompanies.includes(id));
      
      if (allSelected) {
        // Odznacz wszystkie firmy
        setSelectedCompanies([]);
      } else {
        // Zaznacz wszystkie firmy
        setSelectedCompanies(allCompanyIds);
      }
    } catch (error) {
      console.error("Błąd zaznaczania/odznaczania wszystkich firm:", error);
      alert("Błąd podczas zaznaczania/odznaczania wszystkich firm: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "positive":
        return { bg: "#D1FAE5", color: "#047857", label: "Pozytywna" };
      case "negative":
        return { bg: "#FEE2E2", color: "#B91C1C", label: "Negatywna" };
      case "conditional":
        return { bg: "#FEF3C7", color: "#B45309", label: "Warunkowa" };
      default:
        return { bg: "#E5E7EB", color: "#4B7280", label: "Nieznana" };
    }
  };

  const getCompanyVerificationStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return { bg: "#FEF3C7", color: "#B45309", label: "Oczekuje" };
      case "QUALIFIED":
        return { bg: "#D1FAE5", color: "#047857", label: "Zakwalifikowana" };
      case "REJECTED":
        return { bg: "#FEE2E2", color: "#B91C1C", label: "Odrzucona" };
      case "NEEDS_REVIEW":
        return { bg: "#DBEAFE", color: "#1E40AF", label: "Wymaga przeglądu" };
      case "BLOCKED":
        return { bg: "#F3F4F6", color: "#374151", label: "Zablokowana" };
      case "VERIFYING":
        return { bg: "#EFF6FF", color: "#2563EB", label: "Weryfikacja..." };
      case "ERROR":
        return { bg: "#FEE2E2", color: "#DC2626", label: "Błąd" };
      default:
        return { bg: "#E5E7EB", color: "#6B7280", label: "Nieznana" };
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <Link
        href="/company-selection/verify-personas"
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
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
          Weryfikacja person - {selectionName || "Selekcja"}
        </h1>
        <p style={{ color: "#4B5563", maxWidth: "640px" }}>
          Wybierz firmy i przeprowadź weryfikację person (kontaktów) z Apollo. System pobierze listę pracowników i zweryfikuje ich zgodność z kryteriami person.
        </p>
      </div>

      {/* Wybór kryteriów person */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0.75rem",
          border: "1px solid #E5E7EB",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.95rem" }}>
          Kryteria weryfikacji person:
        </label>
        {personaCriteriaLoading ? (
          <div style={{ color: "#6B7280" }}>Ładowanie kryteriów...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <select
                value={selectedPersonaCriteriaId}
                onChange={(e) => handlePersonaCriteriaChange(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "500px",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #D1D5DB",
                  fontSize: "0.95rem",
                }}
              >
                <option value="">-- Wybierz kryteria --</option>
                {personaCriteriaList.map((persona) => (
                  <option key={persona.id} value={String(persona.id)}>
                    {persona.name}
                  </option>
                ))}
              </select>
              {selectedPersonaCriteriaId && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <button
                  onClick={async () => {
                    setShowCacheModal(true);
                    setLoadingCacheModal(true);
                    try {
                      const response = await fetch(`/api/company-selection/personas/${selectedPersonaCriteriaId}/verification-cache`);
                      if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.data) {
                          setCacheModalData(data.data.map((item: any) => ({
                            ...item,
                            verifiedAt: item.verifiedAt ? new Date(item.verifiedAt).toISOString() : "",
                            lastUsedAt: item.lastUsedAt ? new Date(item.lastUsedAt).toISOString() : "",
                          })));
                          // Ustaw domyślną kartę na podstawie dostępnych danych
                          const positiveCount = data.data.filter((item: any) => item.decision === "positive").length;
                          const negativeCount = data.data.filter((item: any) => item.decision === "negative").length;
                          if (positiveCount > 0) {
                            setCacheModalTab("positive");
                          } else if (negativeCount > 0) {
                            setCacheModalTab("negative");
                          }
                          setCacheModalPage({ positive: 1, negative: 1 });
                          // Zaktualizuj cache count
                          setCacheCount({ positive: positiveCount, negative: negativeCount, total: data.data.length });
                        }
                      }
                    } catch (error) {
                      console.error("Błąd ładowania cache:", error);
                    } finally {
                      setLoadingCacheModal(false);
                    }
                  }}
                  disabled={cacheCount.total === 0}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: cacheCount.total === 0 ? "#D1D5DB" : "#3B82F6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: cacheCount.total === 0 ? "not-allowed" : "pointer",
                    fontSize: "0.9rem",
                    whiteSpace: "nowrap",
                    opacity: cacheCount.total === 0 ? 0.6 : 1,
                  }}
                >
                  Znalezione stanowiska
                </button>
                {loadingCacheCount ? (
                  <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>Ładowanie...</span>
                ) : cacheCount.total > 0 ? (
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.85rem", color: "#6B7280" }}>
                    <span>
                      <span style={{ color: "#065F46", fontWeight: 600 }}>{cacheCount.positive}</span> pozytywnych
                    </span>
                    <span>•</span>
                    <span>
                      <span style={{ color: "#991B1B", fontWeight: 600 }}>{cacheCount.negative}</span> negatywnych
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: "0.85rem", color: "#9CA3AF" }}>Brak zapisanych stanowisk</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Statystyki */}
      {selectedPersonaCriteriaId && (
        <PersonaStatsOverview
          stats={stats}
          selectedStatus={selectedStatus}
          onSelectStatus={setSelectedStatus}
        />
      )}

      {/* Wyszukiwanie i akcje */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0.75rem",
          border: "1px solid #E5E7EB",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <input
            type="text"
            placeholder="Szukaj firm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid #D1D5DB",
              fontSize: "0.95rem",
            }}
          />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid #D1D5DB",
              fontSize: "0.95rem",
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                id="hideZeroPersonas"
                checked={hideZeroPersonas}
                onChange={(e) => setHideZeroPersonas(e.target.checked)}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer",
                }}
              />
              <label
                htmlFor="hideZeroPersonas"
                style={{
                  fontSize: "0.85rem",
                  color: "#374151",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Ukryj firmy z pobranymi personami = 0
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                id="hideZeroEmails"
                checked={hideZeroEmails}
                onChange={(e) => setHideZeroEmails(e.target.checked)}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer",
                }}
              />
              <label
                htmlFor="hideZeroEmails"
                style={{
                  fontSize: "0.85rem",
                  color: "#374151",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Ukryj firmy z dostępnym adresem e-mail = 0
              </label>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginTop: "1rem" }}>
          <button
            onClick={handleSelectAllQualified}
            disabled={loading}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: loading ? "#E5E7EB" : "#6B7280",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            title={
              allQualifiedCompanyIds.length > 0 && allQualifiedCompanyIds.every((id: number) => selectedCompanies.includes(id))
                ? "Odznacz wszystkie zaznaczone firmy"
                : "Zaznacz wszystkie firmy QUALIFIED z adresem www ze wszystkich stron"
            }
          >
            {(() => {
              // Sprawdź czy wszystkie firmy są zaznaczone
              const allSelected = allQualifiedCompanyIds.length > 0 && allQualifiedCompanyIds.every((id: number) => selectedCompanies.includes(id));
              const count = allQualifiedCompanyIds.length > 0 ? allQualifiedCompanyIds.length : total;
              return allSelected ? `Odznacz wszystkie (${selectedCompanies.length})` : `Zaznacz wszystkie (${count})`;
            })()}
          </button>
          <button
            onClick={handleSaveApolloBatch}
            disabled={savingApolloBatch || selectedCount === 0}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: savingApolloBatch || selectedCount === 0 ? "#9CA3AF" : "#10B981",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: savingApolloBatch || selectedCount === 0 ? "not-allowed" : "pointer",
            }}
            title={selectedCount === 0 ? "Zaznacz firmy, aby pobrać persony z Apollo" : ""}
          >
            {savingApolloBatch ? "Pobieranie..." : selectedCount > 0 ? `Pobierz persony z Apollo (${selectedCount})` : "Pobierz persony z Apollo"}
          </button>
          <button
            onClick={handleVerifySelected}
            disabled={verifying || !selectedPersonaCriteriaId || selectedWithPersonasCount === 0}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: verifying || !selectedPersonaCriteriaId || selectedWithPersonasCount === 0 ? "#9CA3AF" : "#2563EB",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: verifying || !selectedPersonaCriteriaId || selectedWithPersonasCount === 0 ? "not-allowed" : "pointer",
            }}
            title={
              !selectedPersonaCriteriaId 
                ? "Wybierz kryteria weryfikacji person w dropdownie powyżej" 
                : selectedWithPersonasCount === 0 
                ? "Zaznacz firmy z pobranymi personami (które mają przynajmniej jedną personę z dostępnym e-mailem), aby zweryfikować stanowiska" 
                : ""
            }
          >
            {verifying 
              ? "Weryfikowanie..." 
              : selectedWithPersonasCount > 0 
              ? `Zweryfikuj stanowiska (${selectedWithPersonasCount})` 
              : "Zweryfikuj stanowiska"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              type="checkbox"
              id="forceRefreshCache"
              checked={forceRefreshCache}
              onChange={(e) => setForceRefreshCache(e.target.checked)}
              style={{
                width: "16px",
                height: "16px",
                cursor: "pointer",
              }}
            />
            <label
              htmlFor="forceRefreshCache"
              style={{
                fontSize: "0.85rem",
                color: "#374151",
                cursor: "pointer",
              }}
              title="Wymuś ponowną weryfikację przez AI (wyłącz cache). Przydatne do wypełnienia cache dla już zweryfikowanych firm."
            >
              Wymuś ponowną weryfikację (wypełnij cache)
            </label>
          </div>
        </div>
      </div>

      {/* Pasek postępu */}
      {progress && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1.25rem",
            borderRadius: "0.75rem",
            backgroundColor: progress.status === "completed" ? "#D1FAE5" : progress.status === "error" ? "#FEE2E2" : "#EEF2FF",
            border: `1px solid ${progress.status === "completed" ? "#A7F3D0" : progress.status === "error" ? "#FECACA" : "#C7D2FE"}`,
            color: progress.status === "completed" ? "#047857" : progress.status === "error" ? "#B91C1C" : "#1E3A8A",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
            Postęp {progress.status === "completed" ? "zakończony" : progress.status === "error" ? "błąd" : "weryfikacji"} ({progress.processed}/{progress.total}) – {progress.percentage}%
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.875rem" }}>
            <span>Z personami: {progress.withPersonas}</span>
            <span>Zweryfikowane: {progress.verified}</span>
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

      {/* Lista firm */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0.75rem",
          border: "1px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
            Ładowanie firm...
          </div>
        ) : companies.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
            Brak firm do weryfikacji person.
          </div>
        ) : (
          <>
            {/* Paginacja na górze */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", padding: "1rem", borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>
                  Łącznie rekordów: {total?.toLocaleString("pl-PL")}
                </span>
                <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>
                  Strona {page} z {totalPages}
                </span>
              </div>
              <PaginationControls position="top" />
            </div>
            
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
                  <th style={{ padding: "0.75rem", textAlign: "left", width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={companies.length > 0 && companies.every((c) => selectedCompanies.includes(c.id))}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer" }}
                      title="Zaznacz/odznacz wszystkie firmy z aktualnej strony"
                    />
                  </th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Firma</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Persony z Apollo</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Weryfikacja AI</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Zaakceptowane</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const isSelected = selectedRowCompanyId === company.id;
                  return (
                    <tr
                      key={company.id}
                      style={{
                        borderBottom: "1px solid #E5E7EB",
                        cursor: "pointer",
                        backgroundColor: isSelected ? "#EFF6FF" : "white",
                        borderLeft: isSelected ? "3px solid #2563EB" : "none",
                      }}
                      onClick={() => {
                        setDetailCompany(company);
                        setSelectedRowCompanyId(company.id); // Zaznacz wiersz
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#F9FAFB";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "white";
                        } else {
                          e.currentTarget.style.backgroundColor = "#EFF6FF";
                        }
                      }}
                    >
                      <td
                        style={{ padding: "0.75rem" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompanySelection(company.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCompanies.includes(company.id)}
                          onChange={() => toggleCompanySelection(company.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ padding: "0.75rem", fontWeight: 500 }}>{company.name}</td>
                      <td style={{ padding: "0.75rem", color: "#6B7280", fontSize: "0.875rem" }}>
                        {company.personaVerification ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div>
                              <strong>{company.personaVerification.totalCount}</strong> person
                              {company.personaVerification.availableEmailCount !== undefined && (
                                <span style={{ color: "#6B7280", fontSize: "0.875rem", marginLeft: "0.5rem" }}>
                                  ({company.personaVerification.availableEmailCount} z e-mailem)
                                </span>
                              )}
                            </div>
                            {company.personaVerification.apolloFetchedAt && (
                              <div style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
                                {new Date(company.personaVerification.apolloFetchedAt).toLocaleDateString("pl-PL", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", color: "#6B7280", fontSize: "0.875rem" }}>
                        {company.personaVerification?.personaCriteriaId && company.personaVerification.personaCriteriaId !== null && company.personaVerification.personaCriteriaId !== -1 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <span
                              style={{
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                backgroundColor: "#D1FAE5",
                                color: "#047857",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                display: "inline-block",
                                width: "fit-content",
                              }}
                            >
                              ✓ Tak
                            </span>
                            {company.personaVerification.verifiedAt && (
                              <div style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
                                {new Date(company.personaVerification.verifiedAt).toLocaleDateString("pl-PL", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}
                            {company.personaVerification.positiveCount !== undefined && (
                              <div style={{ fontSize: "0.75rem", color: "#047857", fontWeight: 500 }}>
                                {company.personaVerification.positiveCount} pozytywnych
                              </div>
                            )}
                          </div>
                        ) : company.personaVerification?.personaCriteriaId === -1 ? (
                          // Firma ma weryfikację AI, ale nie dla wybranych kryteriów
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <span
                              style={{
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                backgroundColor: "#FEF3C7",
                                color: "#B45309",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                display: "inline-block",
                                width: "fit-content",
                              }}
                              title="Firma ma weryfikację AI, ale dla innych kryteriów"
                            >
                              ✓ Tak (Nieaktualne)
                            </span>
                            {company.personaVerification.verifiedAt && (
                              <div style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
                                {new Date(company.personaVerification.verifiedAt).toLocaleDateString("pl-PL", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}
                            {company.personaVerification.positiveCount !== undefined && (
                              <div style={{ fontSize: "0.75rem", color: "#047857", fontWeight: 500 }}>
                                {company.personaVerification.positiveCount} pozytywnych
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", color: "#6B7280", fontSize: "0.875rem" }}>
                        {company.personaVerification?.positiveCount !== undefined ? (
                          <div>
                            <strong style={{ color: "#047857", fontSize: "1rem" }}>
                              {company.personaVerification.positiveCount}
                            </strong>
                            {company.personaVerification.totalCount > 0 && (
                              <span style={{ fontSize: "0.75rem", color: "#9CA3AF", marginLeft: "0.25rem" }}>
                                / {company.personaVerification.totalCount}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {/* Paginacja na dole */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", padding: "1rem", borderTop: "1px solid #E5E7EB" }}>
              <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>
                Wyświetlono {companies.length} z {total?.toLocaleString("pl-PL")}
              </span>
              <PaginationControls position="bottom" />
            </div>
          </>
        )}
      </div>

      {/* Modal z wynikami weryfikacji person */}
      {detailCompany && showModal && (
        <div style={detailModalStyle} onClick={() => setDetailCompany(null)}>
          <div style={detailCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{detailCompany.name}</h2>
                <p style={{ color: "#6B7280", marginBottom: "1rem" }}>
                  {detailCompany.website && (
                    <a
                      href={detailCompany.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#2563EB", textDecoration: "none" }}
                    >
                      {detailCompany.website}
                    </a>
                  )}
                </p>
                {/* Lista wszystkich stanowisk */}
                {(() => {
                  const allTitles: string[] = [];
                  
                  // Pobierz stanowiska z apolloEmployees
                  if (apolloEmployees?.people) {
                    apolloEmployees.people.forEach((person: any) => {
                      if (person.title && !allTitles.includes(person.title)) {
                        allTitles.push(person.title);
                      }
                    });
                  }
                  
                  // Pobierz stanowiska z personaVerification
                  if (personaVerification?.employees) {
                    personaVerification.employees.forEach((person: any) => {
                      if (person.title && !allTitles.includes(person.title)) {
                        allTitles.push(person.title);
                      }
                    });
                  }
                  
                  // Użyj uniqueTitles jeśli dostępne
                  const uniqueTitles = apolloEmployees?.uniqueTitles || 
                                      (personaVerification?.metadata && typeof personaVerification.metadata === 'object' && 'uniqueTitles' in personaVerification.metadata 
                                        ? (personaVerification.metadata as any).uniqueTitles 
                                        : null) ||
                                      allTitles;
                  
                  // Funkcja pomocnicza do sprawdzania, czy email jest dostępny
                  const hasAvailableEmail = (person: any): boolean => {
                    // Email jest dostępny jeśli:
                    // 1. Ma faktyczny adres email
                    // 2. Lub emailUnlocked === true
                    // 3. Lub emailStatus jest w: "verified", "guessed", "unverified", "extrapolated"
                    if (person.email) return true;
                    if (person.emailUnlocked) return true;
                    const status = person.emailStatus?.toLowerCase();
                    return status === "verified" || status === "guessed" || status === "unverified" || status === "extrapolated";
                  };
                  
                  // Utwórz mapę stanowisk z informacją, czy mają pozytywne persony
                  const titleStatusMap = new Map<string, boolean>();
                  // Utwórz mapę stanowisk z informacją, czy mają przynajmniej jedną personę z dostępnym e-mailem
                  const titleHasAvailableEmailMap = new Map<string, boolean>();
                  
                  if (personaVerification?.employees && Array.isArray(personaVerification.employees)) {
                    for (const employee of personaVerification.employees) {
                      if (employee.title) {
                        // Sprawdź, czy stanowisko ma pozytywne persony
                        if (employee.personaMatchStatus === "positive") {
                          titleStatusMap.set(employee.title, true);
                        }
                        // Sprawdź, czy stanowisko ma przynajmniej jedną personę z dostępnym e-mailem
                        if (hasAvailableEmail(employee)) {
                          titleHasAvailableEmailMap.set(employee.title, true);
                        }
                      }
                    }
                  } else if (apolloEmployees?.people && Array.isArray(apolloEmployees.people)) {
                    // Jeśli nie ma weryfikacji AI, sprawdź w danych z Apollo
                    for (const person of apolloEmployees.people) {
                      if (person.title && hasAvailableEmail(person)) {
                        titleHasAvailableEmailMap.set(person.title, true);
                      }
                    }
                  }
                  
                  // Filtruj stanowiska - pokazuj tylko te, które mają przynajmniej jedną personę z dostępnym e-mailem
                  const filteredTitles = uniqueTitles.filter((title: string) => titleHasAvailableEmailMap.has(title));
                  
                  if (filteredTitles && Array.isArray(filteredTitles) && filteredTitles.length > 0) {
                    return (
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem", fontWeight: 500 }}>
                          Stanowiska z dostępnym e-mailem ({filteredTitles.length}):
                        </div>
                        <div style={{ 
                          display: "flex", 
                          flexWrap: "wrap", 
                          gap: "0.5rem",
                          padding: "0.75rem",
                          backgroundColor: "#F9FAFB",
                          borderRadius: "0.5rem",
                          border: "1px solid #E5E7EB"
                        }}>
                          {filteredTitles.map((title: string, idx: number) => {
                            const isPositive = titleStatusMap.has(title);
                            return (
                              <span
                                key={idx}
                                style={{
                                  padding: "0.25rem 0.5rem",
                                  backgroundColor: isPositive ? "#D1FAE5" : "white",
                                  borderRadius: "0.25rem",
                                  fontSize: "0.75rem",
                                  color: isPositive ? "#047857" : "#374151",
                                  border: isPositive ? "1px solid #86EFAC" : "1px solid #D1D5DB",
                                  fontWeight: isPositive ? 600 : 400,
                                }}
                              >
                                {title}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <button
                onClick={() => setDetailCompany(null)}
                style={{
                  padding: "0.5rem",
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  fontSize: "1.5rem",
                  color: "#6B7280",
                  marginLeft: "1rem",
                }}
              >
                ×
              </button>
            </div>

            {loadingPersonaVerification || loadingApolloEmployees || savingApolloEmployees ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
                {savingApolloEmployees ? "Zapisywanie person z Apollo..." : loadingApolloEmployees ? "Pobieranie person z Apollo..." : "Ładowanie weryfikacji person..."}
              </div>
            ) : !apolloFetchedAt && !apolloEmployees && !personaVerification ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: "#6B7280", marginBottom: "1.5rem" }}>
                  Pobierz i zapisz persony z Apollo dla tej firmy. Po zapisaniu będziesz mógł przeprowadzić weryfikację AI.
                </p>
                <button
                  onClick={() => handleSaveApolloEmployees(detailCompany.id)}
                  disabled={savingApolloEmployees || loadingApolloEmployees}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "0.5rem",
                    backgroundColor: savingApolloEmployees || loadingApolloEmployees ? "#9CA3AF" : "#2563EB",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: savingApolloEmployees || loadingApolloEmployees ? "not-allowed" : "pointer",
                    marginBottom: "0.5rem",
                  }}
                >
                  {savingApolloEmployees ? "Zapisywanie..." : loadingApolloEmployees ? "Pobieranie..." : "Pobierz i zapisz persony z Apollo"}
                </button>
              </div>
            ) : apolloEmployees && !apolloEmployees.success ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: "#DC2626", marginBottom: "1rem", fontWeight: 500 }}>
                  Błąd pobierania person z Apollo
                </p>
                <p style={{ color: "#6B7280", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                  {apolloEmployees.message || "Nie udało się pobrać person z Apollo"}
                </p>
                <button
                  onClick={() => loadApolloEmployees(detailCompany.id)}
                  disabled={loadingApolloEmployees}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "0.5rem",
                    backgroundColor: loadingApolloEmployees ? "#9CA3AF" : "#2563EB",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: loadingApolloEmployees ? "not-allowed" : "pointer",
                  }}
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : (apolloEmployees && apolloEmployees.success && !personaVerification?.personaCriteriaId) || (apolloFetchedAt && !personaVerification?.personaCriteriaId) ? (
              <>
                {/* Informacja o dacie pobrania */}
                {apolloFetchedAt && (
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      backgroundColor: "#D1FAE5",
                      border: "1px solid #86EFAC",
                      borderRadius: "0.5rem",
                      marginBottom: "1rem",
                      color: "#047857",
                      fontSize: "0.875rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <span>
                      <strong>✓ Persony pobrane z Apollo:</strong> {new Date(apolloFetchedAt).toLocaleString("pl-PL", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => detailCompany && loadApolloEmployees(detailCompany.id)}
                      disabled={loadingApolloEmployees}
                      style={{
                        padding: "0.375rem 0.75rem",
                        backgroundColor: loadingApolloEmployees ? "#9CA3AF" : "#047857",
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        cursor: loadingApolloEmployees ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {loadingApolloEmployees ? "Pobieranie..." : "Pobierz ponownie"}
                    </button>
                  </div>
                )}

                {/* Statystyki Apollo */}
                {apolloEmployees?.statistics && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "1rem",
                      padding: "1rem",
                      backgroundColor: "#EFF6FF",
                      borderRadius: "0.5rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>
                        Łącznie person
                      </div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1E40AF" }}>
                        {apolloEmployees.statistics.total}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>
                        Ze stanowiskami
                      </div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1E40AF" }}>
                        {apolloEmployees.statistics.withTitles}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>
                        Z emailami
                      </div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1E40AF" }}>
                        {apolloEmployees.statistics.withEmails}
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista person z Apollo */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>
                      Persony z Apollo ({(apolloEmployees?.people || personaVerification?.employees || []).length})
                    </h3>
                    <button
                      onClick={() => {
                        if (detailCompany) {
                          handleVerifyPersonas(detailCompany.id, true);
                        }
                      }}
                      disabled={verifying || !selectedPersonaCriteriaId}
                      style={{
                        padding: "0.5rem 1rem",
                        borderRadius: "0.5rem",
                        backgroundColor: verifying || !selectedPersonaCriteriaId ? "#9CA3AF" : "#10B981",
                        color: "white",
                        border: "none",
                        fontWeight: 600,
                        cursor: verifying || !selectedPersonaCriteriaId ? "not-allowed" : "pointer",
                        fontSize: "0.875rem",
                      }}
                      title={!selectedPersonaCriteriaId ? "Wybierz kryteria weryfikacji person" : ""}
                    >
                      {verifying ? "Weryfikowanie..." : "Przeprowadź weryfikację AI"}
                    </button>
                  </div>
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ position: "sticky", top: 0, backgroundColor: "white", zIndex: 10 }}>
                        <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                          <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Imię i nazwisko</th>
                          <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Stanowisko</th>
                          <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(apolloEmployees?.people || personaVerification?.employees || []).map((person: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #E5E7EB" }}>
                            <td style={{ padding: "0.75rem" }}>{person.name || "—"}</td>
                            <td style={{ padding: "0.75rem", color: "#6B7280" }}>{person.title || "—"}</td>
                            <td style={{ padding: "0.75rem" }}>
                              {person.email ? (
                                // Jeśli jest email, pokazujemy go
                                <span style={{ color: "#047857", fontWeight: 500 }}>{person.email}</span>
                              ) : person.emailUnlocked ? (
                                // Email dostępny (odblokowany)
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "50%",
                                    backgroundColor: "#10B981",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}>
                                    <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>✓</span>
                                  </div>
                                  <span style={{ color: "#047857", fontSize: "0.875rem" }}>Dostępny</span>
                                </div>
                              ) : person.emailStatus === "verified" || person.emailStatus === "guessed" ? (
                                // Email dostępny (wymaga kredytów)
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "50%",
                                    backgroundColor: "#10B981",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}>
                                    <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>✓</span>
                                  </div>
                                  <span style={{ color: "#047857", fontSize: "0.875rem" }}>Dostępny</span>
                                </div>
                              ) : person.emailStatus === "unverified" || person.emailStatus === "extrapolated" ? (
                                // Email dostępny - niezweryfikowany (unverified lub extrapolated)
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "50%",
                                    backgroundColor: "#10B981",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}>
                                    <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>✓</span>
                                  </div>
                                  <span style={{ color: "#047857", fontSize: "0.875rem" }}>Dostępny - niezweryfikowany</span>
                                </div>
                              ) : person.emailStatus === "unavailable" ? (
                                // Email niedostępny
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "50%",
                                    backgroundColor: "#EF4444",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}>
                                    <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>✕</span>
                                  </div>
                                  <span style={{ color: "#DC2626", fontSize: "0.875rem" }}>Niedostępny</span>
                                </div>
                              ) : person.emailStatus === "unknown" ? (
                                // Status unknown - traktujemy jako brak informacji
                                <span style={{ color: "#6B7280" }}>—</span>
                              ) : (
                                <span style={{ color: "#6B7280" }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : personaVerification ? (
              <>
                {/* Informacja o pobraniu person z Apollo */}
                {(apolloFetchedAt || (personaVerification.metadata as any)?.apolloFetchedAt) && (
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      backgroundColor: "#DBEAFE",
                      border: "1px solid #93C5FD",
                      borderRadius: "0.5rem",
                      marginBottom: "1rem",
                      color: "#1E40AF",
                      fontSize: "0.875rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <span>
                      <strong>✓ Persony pobrane z Apollo:</strong> {new Date(apolloFetchedAt || (personaVerification.metadata as any)?.apolloFetchedAt || "").toLocaleString("pl-PL", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => detailCompany && loadApolloEmployees(detailCompany.id)}
                      disabled={loadingApolloEmployees}
                      style={{
                        padding: "0.375rem 0.75rem",
                        backgroundColor: loadingApolloEmployees ? "#9CA3AF" : "#2563EB",
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        cursor: loadingApolloEmployees ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {loadingApolloEmployees ? "Pobieranie..." : "Pobierz ponownie"}
                    </button>
                  </div>
                )}

                {/* Informacja o weryfikacji AI */}
                {personaVerification.verifiedAt && (
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      backgroundColor: "#D1FAE5",
                      border: "1px solid #86EFAC",
                      borderRadius: "0.5rem",
                      marginBottom: "1rem",
                      color: "#047857",
                      fontSize: "0.875rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <span>
                      <strong>✓ Weryfikacja AI przeprowadzona:</strong> {new Date(personaVerification.verifiedAt).toLocaleString("pl-PL", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => detailCompany && handleVerifyPersonas(detailCompany.id, true)}
                      disabled={verifying || !selectedPersonaCriteriaId}
                      style={{
                        padding: "0.375rem 0.75rem",
                        backgroundColor: verifying || !selectedPersonaCriteriaId ? "#9CA3AF" : "#047857",
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        cursor: verifying || !selectedPersonaCriteriaId ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {verifying ? "Weryfikowanie..." : "Weryfikuj ponownie"}
                    </button>
                  </div>
                )}

                {/* Statystyki */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "1rem",
                    padding: "1rem",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "0.5rem",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>
                      Pozytywne
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#047857" }}>
                      {personaVerification.positiveCount}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>
                      Negatywne
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#B91C1C" }}>
                      {personaVerification.negativeCount}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>
                      Nieznane
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#B45309" }}>
                      {personaVerification.unknownCount}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>
                      Łącznie
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827" }}>
                      {personaVerification.employees.length}
                    </div>
                  </div>
                </div>

                {/* Lista person */}
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
                    Persony ({personaVerification.employees.length})
                  </h3>
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ position: "sticky", top: 0, backgroundColor: "white", zIndex: 10 }}>
                        <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                          <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Imię i nazwisko</th>
                          <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Stanowisko</th>
                          <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Email</th>
                          <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Status</th>
                          <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Uzasadnienie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {personaVerification.employees.map((employee, idx) => {
                          const statusBadge = getStatusBadgeColor(employee.personaMatchStatus);
                          return (
                            <tr key={idx} style={{ borderBottom: "1px solid #E5E7EB" }}>
                              <td style={{ padding: "0.75rem" }}>{employee.name || "—"}</td>
                              <td style={{ padding: "0.75rem", color: "#6B7280" }}>{employee.title || "—"}</td>
                              <td style={{ padding: "0.75rem" }}>
                                {employee.email ? (
                                  // Jeśli jest email, pokazujemy go
                                  <span style={{ color: "#047857", fontWeight: 500 }}>{employee.email}</span>
                                ) : employee.emailUnlocked ? (
                                  // Email dostępny (odblokowany)
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <div style={{
                                      width: "20px",
                                      height: "20px",
                                      borderRadius: "50%",
                                      backgroundColor: "#10B981",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}>
                                      <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>✓</span>
                                    </div>
                                    <span style={{ color: "#047857", fontSize: "0.875rem" }}>Dostępny</span>
                                  </div>
                                ) : employee.emailStatus === "verified" || employee.emailStatus === "guessed" ? (
                                  // Email dostępny (wymaga kredytów)
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <div style={{
                                      width: "20px",
                                      height: "20px",
                                      borderRadius: "50%",
                                      backgroundColor: "#10B981",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}>
                                      <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>✓</span>
                                    </div>
                                    <span style={{ color: "#047857", fontSize: "0.875rem" }}>Dostępny</span>
                                  </div>
                                ) : employee.emailStatus === "unverified" || employee.emailStatus === "extrapolated" ? (
                                  // Email dostępny - niezweryfikowany (unverified lub extrapolated)
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <div style={{
                                      width: "20px",
                                      height: "20px",
                                      borderRadius: "50%",
                                      backgroundColor: "#10B981",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}>
                                      <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>✓</span>
                                    </div>
                                    <span style={{ color: "#047857", fontSize: "0.875rem" }}>Dostępny - niezweryfikowany</span>
                                  </div>
                                ) : employee.emailStatus === "unavailable" ? (
                                  // Email niedostępny
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <div style={{
                                      width: "20px",
                                      height: "20px",
                                      borderRadius: "50%",
                                      backgroundColor: "#EF4444",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}>
                                      <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>✕</span>
                                    </div>
                                    <span style={{ color: "#DC2626", fontSize: "0.875rem" }}>Niedostępny</span>
                                  </div>
                                ) : employee.emailStatus === "unknown" ? (
                                  // Status unknown - traktujemy jako brak informacji
                                  <span style={{ color: "#6B7280" }}>—</span>
                                ) : (
                                  <span style={{ color: "#6B7280" }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: "0.75rem" }}>
                                <span
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "0.25rem",
                                    backgroundColor: statusBadge.bg,
                                    color: statusBadge.color,
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                  }}
                                >
                                  {statusBadge.label}
                                </span>
                              </td>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#6B7280" }}>
                                {employee.personaMatchReason || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal z zapisanymi decyzjami */}
      {showCacheModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "2rem",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCacheModal(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "0.75rem",
              boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
              padding: "2rem",
              maxWidth: "1200px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111827", marginBottom: "0.5rem" }}>
                  Zapisane decyzje weryfikacji stanowisk
                </h2>
                <p style={{ fontSize: "0.95rem", color: "#6B7280" }}>
                  System zapisuje decyzje AI dla stanowisk, aby przyspieszyć weryfikację dla powtarzających się stanowisk w różnych firmach.
                </p>
              </div>
              <button
                onClick={() => setShowCacheModal(false)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#EF4444",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Zamknij
              </button>
            </div>

            {loadingCacheModal ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#6B7280" }}>Ładowanie...</div>
            ) : cacheModalData.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem",
                  backgroundColor: "#F9FAFB",
                  borderRadius: "0.5rem",
                  color: "#6B7280",
                }}
              >
                <p style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Brak zapisanych decyzji</p>
                <p style={{ fontSize: "0.9rem" }}>
                  Decyzje będą zapisywane automatycznie podczas weryfikacji person przez AI.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Podsumowanie */}
                <div
                  style={{
                    padding: "1rem 1.5rem",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "0.5rem",
                    border: "1px solid #E5E7EB",
                    display: "flex",
                    gap: "2rem",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>Pozytywne:</span>
                    <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "#065F46" }}>
                      {cacheModalData.filter((item) => item.decision === "positive").length}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.9rem", color: "#6B7280" }}>Negatywne:</span>
                    <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "#991B1B" }}>
                      {cacheModalData.filter((item) => item.decision === "negative").length}
                    </span>
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: "0.9rem", color: "#6B7280" }}>
                    Razem: {cacheModalData.length}
                  </div>
                </div>

                {/* Podkarty */}
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #E5E7EB", marginBottom: "1.5rem" }}>
                    <button
                      onClick={() => {
                        setCacheModalTab("positive");
                        setCacheModalPage((prev) => ({ ...prev, positive: 1 }));
                      }}
                      style={{
                        padding: "0.75rem 1.5rem",
                        border: "none",
                        backgroundColor: "transparent",
                        color: cacheModalTab === "positive" ? "#065F46" : "#6B7280",
                        fontWeight: cacheModalTab === "positive" ? 600 : 400,
                        borderBottom: cacheModalTab === "positive" ? "2px solid #065F46" : "2px solid transparent",
                        cursor: "pointer",
                        marginBottom: "-2px",
                      }}
                    >
                      Pozytywne ({cacheModalData.filter((item) => item.decision === "positive").length})
                    </button>
                    <button
                      onClick={() => {
                        setCacheModalTab("negative");
                        setCacheModalPage((prev) => ({ ...prev, negative: 1 }));
                      }}
                      style={{
                        padding: "0.75rem 1.5rem",
                        border: "none",
                        backgroundColor: "transparent",
                        color: cacheModalTab === "negative" ? "#991B1B" : "#6B7280",
                        fontWeight: cacheModalTab === "negative" ? 600 : 400,
                        borderBottom: cacheModalTab === "negative" ? "2px solid #991B1B" : "2px solid transparent",
                        cursor: "pointer",
                        marginBottom: "-2px",
                      }}
                    >
                      Negatywne ({cacheModalData.filter((item) => item.decision === "negative").length})
                    </button>
                  </div>

                  {/* Zawartość karty */}
                  {(() => {
                    const filteredItems = cacheModalData.filter((item) => item.decision === cacheModalTab);
                    const currentPage = cacheModalPage[cacheModalTab];
                    const totalPages = Math.ceil(filteredItems.length / cacheModalItemsPerPage);
                    const startIndex = (currentPage - 1) * cacheModalItemsPerPage;
                    const endIndex = startIndex + cacheModalItemsPerPage;
                    const paginatedItems = filteredItems.slice(startIndex, endIndex);

                    if (filteredItems.length === 0) {
                      return (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "3rem",
                            backgroundColor: "#F9FAFB",
                            borderRadius: "0.5rem",
                            color: "#6B7280",
                          }}
                        >
                          <p style={{ fontSize: "1rem" }}>
                            Brak {cacheModalTab === "positive" ? "pozytywnych" : "negatywnych"} decyzji
                          </p>
                        </div>
                      );
                    }

                    return (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                          {paginatedItems.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                padding: "1.25rem",
                                backgroundColor: cacheModalTab === "positive" ? "#F0FDF4" : "#FEF2F2",
                                borderRadius: "0.5rem",
                                border: cacheModalTab === "positive" ? "1px solid #D1FAE5" : "1px solid #FEE2E2",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                                    <h4 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111827" }}>
                                      {item.titleNormalized}
                                    </h4>
                                    <span
                                      style={{
                                        padding: "0.25rem 0.75rem",
                                        borderRadius: "0.375rem",
                                        fontSize: "0.85rem",
                                        fontWeight: 500,
                                        backgroundColor: cacheModalTab === "positive" ? "#D1FAE5" : "#FEE2E2",
                                        color: cacheModalTab === "positive" ? "#065F46" : "#991B1B",
                                      }}
                                    >
                                      {cacheModalTab === "positive" ? "Pozytywne" : "Negatywne"}
                                    </span>
                                    <span style={{ fontSize: "0.9rem", color: "#6B7280", fontWeight: 500 }}>
                                      Score: {item.score !== null ? `${(item.score * 100).toFixed(0)}%` : "brak"}
                                    </span>
                                  </div>
                                  {item.titleEnglish && item.titleEnglish !== item.titleNormalized && (
                                    <p style={{ fontSize: "0.9rem", color: "#6B7280", marginBottom: "0.25rem" }}>
                                      EN: {item.titleEnglish}
                                    </p>
                                  )}
                                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "#6B7280", marginBottom: "0.5rem" }}>
                                    {item.departments && item.departments.length > 0 && (
                                      <span>Działy: {item.departments.join(", ")}</span>
                                    )}
                                    {item.seniority && <span>Seniority: {item.seniority}</span>}
                                  </div>
                                  {item.reason && (
                                    <p style={{ fontSize: "0.9rem", color: "#374151", marginTop: "0.5rem", lineHeight: 1.5 }}>
                                      {item.reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.8rem", color: "#9CA3AF", marginTop: "0.75rem" }}>
                                <span>Użyto: {item.useCount} {item.useCount === 1 ? "raz" : "razy"}</span>
                                <span>
                                  Zweryfikowano: {new Date(item.verifiedAt).toLocaleString("pl-PL")}
                                </span>
                                <span>
                                  Ostatnie użycie: {new Date(item.lastUsedAt).toLocaleString("pl-PL")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Paginacja */}
                        {totalPages > 1 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              gap: "0.5rem",
                              marginTop: "1.5rem",
                              paddingTop: "1rem",
                              borderTop: "1px solid #E5E7EB",
                            }}
                          >
                            <button
                              onClick={() => setCacheModalPage((prev) => ({ ...prev, [cacheModalTab]: Math.max(1, currentPage - 1) }))}
                              disabled={currentPage === 1}
                              style={{
                                padding: "0.5rem 1rem",
                                backgroundColor: currentPage === 1 ? "#F3F4F6" : "white",
                                color: currentPage === 1 ? "#9CA3AF" : "#374151",
                                border: "1px solid #D1D5DB",
                                borderRadius: "0.375rem",
                                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                fontSize: "0.9rem",
                              }}
                            >
                              Poprzednia
                            </button>
                            <span style={{ fontSize: "0.9rem", color: "#6B7280", padding: "0 1rem" }}>
                              Strona {currentPage} z {totalPages}
                            </span>
                            <button
                              onClick={() => setCacheModalPage((prev) => ({ ...prev, [cacheModalTab]: Math.min(totalPages, currentPage + 1) }))}
                              disabled={currentPage === totalPages}
                              style={{
                                padding: "0.5rem 1rem",
                                backgroundColor: currentPage === totalPages ? "#F3F4F6" : "white",
                                color: currentPage === totalPages ? "#9CA3AF" : "#374151",
                                border: "1px solid #D1D5DB",
                                borderRadius: "0.375rem",
                                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                                fontSize: "0.9rem",
                              }}
                            >
                              Następna
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PersonaStatsOverview({
  stats,
  selectedStatus,
  onSelectStatus,
}: {
  stats: PersonaStats;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
}) {
  const cards = [
    {
      status: "ALL",
      label: "Wszystkie",
      value: stats.total,
      bg: "#E5E7EB",
      border: "#D1D5DB",
      textColor: "#111827",
    },
    {
      status: "NO_FETCHED",
      label: "Bez pobranych person",
      value: stats.noPersonas,
      bg: "#FEE2E2",
      border: "#FECACA",
      textColor: "#B91C1C",
    },
    {
      status: "NO_VERIFIED",
      label: "Bez weryfikowanych person",
      value: stats.total - stats.verified,
      bg: "#FEF3C7",
      border: "#FDE68A",
      textColor: "#B45309",
    },
    {
      status: "FETCHED",
      label: "Pobrane persony",
      value: stats.withPersonas,
      bg: "#DBEAFE",
      border: "#BFDBFE",
      textColor: "#1D4ED8",
    },
    {
      status: "VERIFIED",
      label: "Zweryfikowane persony",
      value: stats.verified,
      bg: "#D1FAE5",
      border: "#A7F3D0",
      textColor: "#047857",
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
              borderRadius: "0.75rem",
              border: `2px solid ${isActive ? card.border : "#E5E7EB"}`,
              backgroundColor: isActive ? card.bg : "white",
              cursor: "pointer",
              transition: "all 0.2s",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = card.border;
                e.currentTarget.style.backgroundColor = card.bg;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.backgroundColor = "white";
              }
            }}
          >
            <div style={{ fontSize: "0.875rem", color: "#6B7280", fontWeight: 500 }}>
              {card.label}
            </div>
            <div
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                color: card.textColor,
              }}
            >
              {card.value}
            </div>
          </button>
        );
      })}
    </div>
  );
}

