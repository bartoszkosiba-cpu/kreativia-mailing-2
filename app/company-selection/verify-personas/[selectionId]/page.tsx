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

  const [companies, setCompanies] = useState<Company[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]); // Wszystkie pobrane firmy (przed filtrowaniem)
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionName, setSelectionName] = useState<string>("");
  const [selectedPersonaCriteriaId, setSelectedPersonaCriteriaId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [hideZeroPersonas, setHideZeroPersonas] = useState<boolean>(false);
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

  const selectedCount = selectedCompanies.length;

  // Funkcja pomocnicza do filtrowania firm lokalnie (zdefiniowana przed useEffect, który jej używa)
  const applyFiltersToCompaniesLocal = useCallback((
    companiesToFilter: Company[],
    status: string,
    hideZero: boolean
  ): Company[] => {
    let filtered = companiesToFilter;
    
    if (status !== "ALL" || hideZero) {
      filtered = companiesToFilter.filter((company) => {
        const hasPersonaVerification = company.personaVerification !== undefined && company.personaVerification !== null;
        const hasPersonas = company.personaVerification && company.personaVerification.totalCount > 0;
        const isVerified = company.personaVerification?.personaCriteriaId !== null;
        
        // Ukryj firmy z 0 personami, jeśli checkbox jest zaznaczony
        // Tylko firmy, które pobierały persony (mają PersonaVerificationResult) ale wynik był 0
        if (hideZero && hasPersonaVerification && !hasPersonas) {
          return false;
        }
        
        // Filtruj po wybranym statusie
        if (status !== "ALL") {
          switch (status) {
            case "NO_FETCHED":
              return !hasPersonas;
            case "NO_VERIFIED":
              return !isVerified;
            case "FETCHED":
              return hasPersonas;
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
      loadCompanies();
    }
  }, [selectionId]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedStatus, hideZeroPersonas]);

  // Pobierz dane z API tylko gdy zmienia się selectionId, searchQuery lub page
  useEffect(() => {
    if (selectionId) {
      loadCompanies();
    }
  }, [searchQuery, selectionId, page]);

  // Filtruj lokalnie już pobrane dane gdy zmienia się selectedStatus lub hideZeroPersonas
  useEffect(() => {
    if (allCompanies.length > 0) {
      const filtered = applyFiltersToCompaniesLocal(allCompanies, selectedStatus, hideZeroPersonas);
      setCompanies(filtered);
    }
  }, [selectedStatus, hideZeroPersonas, allCompanies, applyFiltersToCompaniesLocal]);

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

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/company-selection/personas/verify/progress?progressId=${progressId}`);
        if (!response.ok) {
          console.error("[Persona Verify] Błąd pobierania postępu:", response.status);
          return;
        }

        const data = await response.json();
        if (data.success && data.progress) {
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
            setVerifying(false);
            setSavingApolloBatch(false);
            setProgressId(null);
            // Przeładuj listę firm
            await loadCompanies();
          }
        }
      } catch (error) {
        console.error("[Persona Verify] Błąd pollingu postępu:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [progressId, progress?.status]);

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
        // Ustaw pierwsze kryteria jako domyślne, jeśli są dostępne
        if (data.personas.length > 0 && !selectedPersonaCriteriaId) {
          setSelectedPersonaCriteriaId(String(data.personas[0].id));
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
      const params = new URLSearchParams({
        selectionId: String(selectionId),
        limit: String(PAGE_SIZE),
        page: String(page),
        // Filtrujemy po statusie weryfikacji firm (PENDING = pozostałe do weryfikacji person)
        status: "PENDING",
      });

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      const response = await fetch(`/api/company-selection/list?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const companiesList = data.companies || [];
      
      // Pobierz weryfikacje person dla tych firm (tylko jeśli są firmy)
      let verificationData: any = null;
      if (companiesList.length > 0) {
        const companyIds = companiesList.map((c: Company) => c.id);
        try {
          const verificationResponse = await fetch(
            `/api/company-selection/personas/batch?companyIds=${companyIds.join(",")}`
          );
          
          if (verificationResponse.ok) {
            const verificationResult = await verificationResponse.json();
            if (verificationResult.success && verificationResult.data) {
              verificationData = verificationResult.data;
            }
          }
        } catch (verificationError) {
          console.error("Błąd pobierania weryfikacji person:", verificationError);
          // Kontynuuj bez weryfikacji - nie blokuj całego procesu
        }
      }
      
      // Przetwórz dane
      if (verificationData) {
        // Dodaj informacje o weryfikacjach person do firm
        const enrichedCompanies = companiesList.map((company: Company) => {
          const verification = verificationData[company.id];
          if (verification) {
            return {
              ...company,
              personaVerification: {
                personaCriteriaId: verification.personaCriteriaId,
                positiveCount: verification.positiveCount,
                negativeCount: verification.negativeCount,
                unknownCount: verification.unknownCount,
                totalCount: verification.totalCount,
                verifiedAt: verification.verifiedAt,
                apolloFetchedAt: verification.metadata?.apolloFetchedAt,
              },
            };
          }
          return company;
        });
        
        // Zapisz wszystkie firmy (przed filtrowaniem) do osobnego stanu
        setAllCompanies(enrichedCompanies);
        
        // Oblicz statystyki z wszystkich firm (przed filtrowaniem)
        const statsData: PersonaStats = {
          total: enrichedCompanies.length,
          withPersonas: enrichedCompanies.filter((c) => c.personaVerification && c.personaVerification.totalCount > 0).length,
          verified: enrichedCompanies.filter((c) => c.personaVerification?.personaCriteriaId !== null).length,
          noPersonas: enrichedCompanies.filter((c) => !c.personaVerification || c.personaVerification.totalCount === 0).length,
        };
        setStats(statsData);
        
        // Zastosuj filtry lokalnie
        const filtered = applyFiltersToCompaniesLocal(enrichedCompanies, selectedStatus, hideZeroPersonas);
        setCompanies(filtered);
      } else {
        // Brak weryfikacji - ustaw puste dane weryfikacji
        setAllCompanies(companiesList);
        
        setStats({
          total: companiesList.length,
          withPersonas: 0,
          verified: 0,
          noPersonas: companiesList.length,
        });
        
        // Zastosuj filtry lokalnie
        const filtered = applyFiltersToCompaniesLocal(companiesList, selectedStatus, hideZeroPersonas);
        setCompanies(filtered);
      }
      
      setTotal(data.pagination?.total || 0);
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
      
      // Debug: sprawdź status emaila dla Harleen Middha
      if (data.people) {
        const harleen = data.people.find((p: any) => p.name?.toLowerCase().includes("harleen"));
        if (harleen) {
          console.log("[DEBUG] Harleen Middha emailStatus:", harleen.emailStatus, "email_status:", harleen.email_status, "contact_email_status:", harleen.contact_email_status);
        }
      }
      
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
      const response = await fetch(`/api/company-selection/personas/company/${companyId}`);
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
          // NIE ustawiamy apolloFetchedAt na null, jeśli nie ma w metadanych - zachowujemy poprzednią wartość
          // (może być ustawione wcześniej, a w metadanych może nie być, jeśli weryfikacja AI nie zapisała tego)
        } else {
          setPersonaVerification(null);
          setApolloFetchedAt(null);
        }
      } else if (response.status === 404) {
        setPersonaVerification(null);
        setApolloFetchedAt(null);
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
    console.log("[DEBUG] handleVerifyPersonas called", { companyId, useApolloEmployees, selectedPersonaCriteriaId });
    
    if (!selectedPersonaCriteriaId) {
      alert("Wybierz kryteria weryfikacji person przed rozpoczęciem weryfikacji.");
      return;
    }

    try {
      setVerifying(true);
      console.log("[DEBUG] Starting verification...");
      
      // Jeśli mamy już pobrane persony z Apollo, przekaż je w body
      const requestBody: any = {
        companyId,
        personaCriteriaId: Number(selectedPersonaCriteriaId),
        force: true, // Wymuś nową weryfikację, nawet jeśli istnieje już weryfikacja
        useStoredEmployees: false,
      };
      
      if (useApolloEmployees && apolloEmployees && apolloEmployees.success) {
        console.log("[DEBUG] Using Apollo employees", { count: apolloEmployees.people?.length });
        requestBody.employees = apolloEmployees.people;
        requestBody.statistics = apolloEmployees.statistics;
        requestBody.uniqueTitles = apolloEmployees.uniqueTitles;
        requestBody.apolloOrganization = apolloEmployees.apolloOrganization;
      } else {
        // Jeśli nie ma person z Apollo, użyj zapisanych z bazy
        console.log("[DEBUG] Using stored employees from database");
        requestBody.useStoredEmployees = true;
      }
      
      console.log("[DEBUG] Sending request to /api/company-selection/personas/verify", requestBody);
      
      const response = await fetch("/api/company-selection/personas/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      console.log("[DEBUG] Response status:", response.status);
      
      const data = await response.json();
      console.log("[DEBUG] Response data:", data);
      
      if (data.success) {
        console.log("[DEBUG] Verification successful, reloading persona verification...");
        // Przeładuj weryfikację person dla tej firmy (to automatycznie przełączy widok na wyniki weryfikacji)
        await loadPersonaVerification(companyId);
        console.log("[DEBUG] Persona verification reloaded");
        // Aktualizuj dane lokalnie zamiast przeładowywać całą listę - zapobiega miganiu
        if (data.data) {
          setAllCompanies((prev) => {
            return prev.map((c) => {
              if (c.id === companyId) {
                return {
                  ...c,
                  personaVerification: {
                    personaCriteriaId: data.data.personaCriteriaId || null,
                    positiveCount: data.data.positiveCount || 0,
                    negativeCount: data.data.negativeCount || 0,
                    unknownCount: data.data.unknownCount || 0,
                    totalCount: (data.data.positiveCount || 0) + (data.data.negativeCount || 0) + (data.data.unknownCount || 0),
                    verifiedAt: data.data.verifiedAt || null,
                    apolloFetchedAt: data.data.metadata?.apolloFetchedAt || c.personaVerification?.apolloFetchedAt || null,
                  },
                };
              }
              return c;
            });
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
      console.log("[DEBUG] Verification finished");
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

    if (!confirm(`Czy na pewno chcesz zweryfikować persony dla ${selectedCompanies.length} firm?`)) {
      return;
    }

    try {
      setVerifying(true);
      
      // Utwórz postęp
      const progressResponse = await fetch("/api/company-selection/personas/verify/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total: selectedCompanies.length }),
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
        total: selectedCompanies.length,
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

      // Uruchom weryfikację w tle (PUT request do endpointu batch)
      const response = await fetch("/api/company-selection/personas/verify-batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyIds: selectedCompanies,
          progressId: newProgressId,
          personaCriteriaId: criteriaIdNum,
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
    if (selectedCompanies.length === companies.length) {
      setSelectedCompanies([]);
    } else {
      setSelectedCompanies(companies.map((c) => c.id));
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
          <select
            value={selectedPersonaCriteriaId}
            onChange={(e) => setSelectedPersonaCriteriaId(e.target.value)}
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            <input
              type="checkbox"
              id="hideZeroPersonas"
              checked={hideZeroPersonas}
              onChange={(e) => setHideZeroPersonas(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                cursor: "pointer",
              }}
            />
            <label
              htmlFor="hideZeroPersonas"
              style={{
                fontSize: "0.95rem",
                color: "#374151",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Ukryj firmy z pobranymi personami = 0
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginTop: "1rem" }}>
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
            disabled={verifying || !selectedPersonaCriteriaId || selectedCount === 0}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: verifying || !selectedPersonaCriteriaId || selectedCount === 0 ? "#9CA3AF" : "#2563EB",
              color: "white",
              border: "none",
              fontWeight: 600,
              cursor: verifying || !selectedPersonaCriteriaId || selectedCount === 0 ? "not-allowed" : "pointer",
            }}
            title={selectedCount === 0 ? "Zaznacz firmy, aby zweryfikować persony" : !selectedPersonaCriteriaId ? "Wybierz kryteria weryfikacji person" : ""}
          >
            {verifying ? "Weryfikowanie..." : selectedCount > 0 ? `Zweryfikuj wybrane (${selectedCount})` : "Zweryfikuj wybrane"}
          </button>
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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
                  <th style={{ padding: "0.75rem", textAlign: "left", width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={selectedCompanies.length === companies.length && companies.length > 0}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer" }}
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
                        {company.personaVerification?.personaCriteriaId ? (
                          <span
                            style={{
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              backgroundColor: "#D1FAE5",
                              color: "#047857",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            ✓ Tak
                          </span>
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
                        console.log("[DEBUG] Button clicked", { 
                          detailCompanyId: detailCompany?.id, 
                          selectedPersonaCriteriaId,
                          verifying,
                          hasApolloEmployees: !!apolloEmployees?.success 
                        });
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
                              {(() => {
                                // Debug: loguj status dla Harleen
                                if (person.name?.toLowerCase().includes("harleen")) {
                                  console.log("[DEBUG] Rendering Harleen - emailStatus:", person.emailStatus, "email:", person.email, "emailUnlocked:", person.emailUnlocked);
                                }
                                return null;
                              })()}
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
                {(apolloFetchedAt || personaVerification.metadata?.apolloFetchedAt) && (
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
                      <strong>✓ Persony pobrane z Apollo:</strong> {new Date(apolloFetchedAt || personaVerification.metadata?.apolloFetchedAt || "").toLocaleString("pl-PL", {
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

