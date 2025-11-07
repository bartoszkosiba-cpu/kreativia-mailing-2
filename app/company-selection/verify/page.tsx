"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Company {
  id: number;
  name: string;
  industry: string | null;
  city: string | null;
  country: string | null;
  verificationStatus: string;
  verificationScore: number | null;
  verificationReason: string | null;
  description: string | null;
  activityDescription: string | null;
}

interface CompanyStats {
  pending: number;
  qualified: number;
  rejected: number;
  needsReview: number;
  blocked: number;
  total: number;
}

export default function CompanyVerifyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [stats, setStats] = useState<CompanyStats>({
    pending: 0,
    qualified: 0,
    rejected: 0,
    needsReview: 0,
    blocked: 0,
    total: 0,
  });
  const [progress, setProgress] = useState<{
    total: number;
    processed: number;
    percentage: number;
    qualified: number;
    rejected: number;
    needsReview: number;
    errors: number;
    status: 'processing' | 'completed' | 'error';
    currentCompanyName?: string;
    estimatedTimeRemaining?: number;
  } | null>(null);
  const [selectedCompanyForApollo, setSelectedCompanyForApollo] = useState<number | null>(null);
  const [apolloEmployees, setApolloEmployees] = useState<any>(null);
  const [loadingApollo, setLoadingApollo] = useState(false);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);

  useEffect(() => {
    loadStats();
    loadCompanies();
  }, []);

  useEffect(() => {
    loadCompanies();
    // Resetuj stronę do 1 przy zmianie filtra lub wyszukiwania
    setPage(1);
  }, [selectedStatus, searchQuery]);

  useEffect(() => {
    loadCompanies();
  }, [page]);

  // Polling postępu weryfikacji
  useEffect(() => {
    console.log(`[Progress] useEffect polling - progressId: ${progressId}`);
    if (!progressId) {
      console.log(`[Progress] Brak progressId - pomijam polling`);
      return;
    }

    console.log(`[Progress] Uruchamiam polling dla: ${progressId}`);
    const interval = setInterval(async () => {
      try {
        console.log(`[Progress] Polling progress dla: ${progressId}`);
        const response = await fetch(`/api/company-selection/verify/progress?progressId=${progressId}`);
        const data = await response.json();
        
        if (data.error) {
          console.error("[Progress] Błąd pobierania postępu:", data.error);
          return;
        }

        console.log(`[Progress] Otrzymano dane:`, {
          processed: data.processed,
          total: data.total,
          percentage: data.percentage,
          status: data.status,
          current: data.current,
        });

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

        // Jeśli zakończono, zatrzymaj polling i odśwież listę
        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(interval);
          setVerifying(false);
          setProgressId(null);
          setSelectedCompanies([]); // Wyczyść wybrane firmy
          
          // Odśwież statystyki i listę firm
          loadStats();
          loadCompanies();
          
          if (data.status === 'completed') {
            alert(
              `Weryfikacja zakończona:\n- Zakwalifikowane: ${data.qualified}\n- Odrzucone: ${data.rejected}\n- Wymagają przeglądu: ${data.needsReview}\n- Błędy: ${data.errors}`
            );
          } else if (data.status === 'error') {
            alert("Weryfikacja zakończona z błędami. Sprawdź logi.");
          }
        }
      } catch (error) {
        console.error("Błąd pobierania postępu:", error);
      }
    }, 1000); // Polling co 1 sekundę dla lepszej widoczności

    return () => clearInterval(interval);
  }, [progressId, selectedStatus, page]);

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

      const [pending, qualified, rejected, needsReview, blocked, total] =
        await Promise.all([
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

  const loadCompanies = async () => {
    try {
      setLoading(true);
      let url = `/api/company-selection/list?page=${page}&limit=50`;
      
      if (selectedStatus !== "ALL") {
        url += `&status=${selectedStatus}`;
      }
      
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      
      console.log("[Verify] Ładuję firmy z URL:", url);
      const response = await fetch(url);
      const data = await response.json();
      console.log("[Verify] Otrzymane dane:", { companies: data.companies?.length, total: data.pagination?.total });
      setCompanies(data.companies || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error("Błąd ładowania firm:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySingle = async (companyId: number) => {
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
      alert("Błąd weryfikacji");
    } finally {
      setVerifying(false);
    }
  };

  const handleBlockCompany = async (companyId: number, companyName: string) => {
    if (!confirm(`Czy na pewno chcesz zablokować firmę "${companyName}"?\n\nFirma zostanie dodana do listy zablokowanych i automatycznie oznaczona jako BLOKOWANA.`)) {
      return;
    }

    try {
      // Najpierw dodaj do listy zablokowanych
      const addResponse = await fetch("/api/company-selection/blocked", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: companyName,
          reason: "Zablokowane z widoku weryfikacji",
        }),
      });

      const addData = await addResponse.json();
      if (!addData.success && !addData.error?.includes("już jest")) {
        alert(`Błąd dodawania do listy zablokowanych: ${addData.error}`);
        return;
      }

      // Następnie zmień status na BLOCKED
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
      alert("Błąd blokowania firmy: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleCheckApolloEmployees = async (companyId: number, companyName: string) => {
    try {
      setLoadingApollo(true);
      setSelectedCompanyForApollo(companyId);
      setApolloEmployees(null);
      setSelectedTitles([]);

      const response = await fetch(`/api/company-selection/apollo/employees?companyId=${companyId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      // Zawsze pokazuj modal, nawet jeśli nie znaleziono pracowników
      // (data.success może być true, ale z pustą listą pracowników)
      setApolloEmployees(data);
      
      if (!data.success) {
        // Jeśli to błąd, pokaż alert
        const errorMessage = data.error || data.details || "Nie udało się pobrać danych z Apollo";
        console.error("Apollo API error:", data);
        // Nie pokazuj alertu - modal i tak się wyświetli z komunikatem błędu
      }
    } catch (error) {
      alert("Błąd pobierania danych z Apollo: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoadingApollo(false);
    }
  };

  const handleEnrichSelectedPeople = async (personIds: string[]) => {
    if (personIds.length === 0) {
      alert("Wybierz osoby do pobrania emaili");
      return;
    }

    const confirmMessage = `Czy na pewno chcesz pobrać emaile dla ${personIds.length} osób?\n\nTo zużyje ${personIds.length} kredytów Apollo.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setLoadingApollo(true);
      const response = await fetch("/api/company-selection/apollo/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Aktualizuj dane w modalu - zamień osoby na wzbogacone
        if (apolloEmployees && apolloEmployees.people) {
          const updatedPeople = apolloEmployees.people.map((person: any) => {
            const enriched = data.people.find((p: any) => p.id === person.id);
            return enriched || person;
          });
          setApolloEmployees({
            ...apolloEmployees,
            people: updatedPeople,
          });
        }
        alert(`Pobrano emaile dla ${data.people.length} osób.\nZużyto ${data.creditsUsed} kredytów Apollo.`);
      } else {
        alert(`Błąd: ${data.error || "Nie udało się pobrać emaili"}`);
      }
    } catch (error) {
      alert("Błąd pobierania emaili: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoadingApollo(false);
    }
  };

  const handleChangeStatus = async (companyId: number, currentStatus: string) => {
    // Określ nowy status - zamiana QUALIFIED ↔ REJECTED
    let newStatus: string;
    if (currentStatus === "QUALIFIED") {
      newStatus = "REJECTED";
    } else if (currentStatus === "REJECTED") {
      newStatus = "QUALIFIED";
    } else {
      // Dla innych statusów zapytaj użytkownika
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
        // Odśwież listę firm i statystyki
        loadStats();
        loadCompanies();
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert("Błąd zmiany statusu: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleVerifyBatch = async () => {
    if (selectedCompanies.length === 0) {
      alert("Wybierz firmy do weryfikacji");
      return;
    }

    if (
      !confirm(
        `Czy na pewno chcesz zweryfikować ${selectedCompanies.length} firm?`
      )
    ) {
      return;
    }

    try {
      setVerifying(true);
      setProgress(null);

      // Utwórz progressId
      const progressResponse = await fetch("/api/company-selection/verify/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ total: selectedCompanies.length }),
      });

      const progressData = await progressResponse.json();
      if (!progressData.success || !progressData.progressId) {
        alert("Błąd tworzenia postępu weryfikacji");
        setVerifying(false);
        return;
      }

      const newProgressId = progressData.progressId;
      console.log(`[Progress] Utworzono progressId: ${newProgressId}`);
      setProgressId(newProgressId);
      console.log(`[Progress] Ustawiono progressId w state: ${newProgressId}`);

      // Ustaw początkowy progress, aby był widoczny od razu
      setProgress({
        total: selectedCompanies.length,
        processed: 0,
        percentage: 0,
        qualified: 0,
        rejected: 0,
        needsReview: 0,
        errors: 0,
        status: 'processing',
        currentCompanyName: undefined,
        estimatedTimeRemaining: undefined,
      });

      // Rozpocznij weryfikację
      const response = await fetch("/api/company-selection/verify", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          companyIds: selectedCompanies,
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
      // Postęp będzie śledzony przez useEffect polling
    } catch (error) {
      alert("Błąd weryfikacji: " + (error instanceof Error ? error.message : String(error)));
      setVerifying(false);
      setProgressId(null);
    }
  };

  const toggleCompanySelection = (companyId: number) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCompanies.length === companies.length) {
      setSelectedCompanies([]);
    } else {
      setSelectedCompanies(companies.map((c) => c.id));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "QUALIFIED":
        return "#10B981";
      case "REJECTED":
        return "#EF4444";
      case "NEEDS_REVIEW":
        return "#F59E0B";
      case "BLOCKED":
        return "#DC2626";
      case "PENDING":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "QUALIFIED":
        return "Zakwalifikowana";
      case "REJECTED":
        return "Odrzucona";
      case "NEEDS_REVIEW":
        return "Wymaga przeglądu";
      case "BLOCKED":
        return "Zablokowana";
      case "PENDING":
        return "Do weryfikacji";
      default:
        return status;
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link
          href="/company-selection"
          style={{
            color: "#3B82F6",
            textDecoration: "none",
            marginBottom: "1rem",
            display: "inline-block",
          }}
        >
          ← Powrót do modułu wyboru leadów
        </Link>
        <h1 style={{ fontSize: "2rem", marginTop: "1rem" }}>
          Weryfikacja firm
        </h1>
      </div>

      {/* Statystyki */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            padding: "1rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem" }}>
            Do weryfikacji
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#6B7280" }}>
            {stats.pending}
          </div>
        </div>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem" }}>
            Zakwalifikowane
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#10B981" }}>
            {stats.qualified}
          </div>
        </div>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem" }}>
            Odrzucone
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#EF4444" }}>
            {stats.rejected}
          </div>
        </div>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem" }}>
            Wymagają przeglądu
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#F59E0B" }}>
            {stats.needsReview}
          </div>
        </div>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem" }}>
            Zablokowane
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#DC2626" }}>
            {stats.blocked}
          </div>
        </div>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem" }}>
            Łącznie
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#374151" }}>
            {stats.total}
          </div>
        </div>
      </div>

      {/* Wyszukiwanie i filtry */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Pole wyszukiwania */}
        <div style={{ flex: "1", minWidth: "250px" }}>
          <input
            type="text"
            placeholder="Szukaj po nazwie firmy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid #D1D5DB",
              fontSize: "0.875rem",
            }}
          />
        </div>

        {/* Filtr statusu */}
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #D1D5DB",
            fontSize: "0.875rem",
            backgroundColor: "white",
          }}
        >
          <option value="ALL">Wszystkie statusy</option>
          <option value="PENDING">Do weryfikacji</option>
          <option value="QUALIFIED">Zakwalifikowane</option>
          <option value="REJECTED">Odrzucone</option>
          <option value="NEEDS_REVIEW">Wymagają przeglądu</option>
          <option value="BLOCKED">Zablokowane</option>
        </select>

        {/* Przycisk odświeżania statystyk */}
        <button
          onClick={() => {
            loadStats();
            loadCompanies();
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#F3F4F6",
            color: "#374151",
            border: "1px solid #D1D5DB",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Odśwież
        </button>
      </div>

      {/* Akcje batch */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "2rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >

        {selectedCompanies.length > 0 && (
          <button
            onClick={handleVerifyBatch}
            disabled={verifying}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: verifying ? "#9CA3AF" : "#10B981",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: verifying ? "not-allowed" : "pointer",
              fontSize: "1rem",
            }}
          >
            {verifying
              ? "Weryfikowanie..."
              : `Weryfikuj wybrane (${selectedCompanies.length})`}
          </button>
        )}

        <div style={{ marginLeft: "auto", color: "#6B7280" }}>
          Łącznie: {total} firm
        </div>
      </div>

      {/* Progress bar weryfikacji */}
      {(progress || verifying) && (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#F3F4F6",
            borderRadius: "0.5rem",
            marginBottom: "2rem",
            border: "1px solid #D1D5DB",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div>
              <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                {progress?.status === 'processing' || verifying ? 'Weryfikacja w toku...' : 'Weryfikacja zakończona'}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                {progress?.currentCompanyName ? (
                  <>Aktualnie: {progress.currentCompanyName}</>
                ) : (
                  <>Przygotowywanie weryfikacji...</>
                )}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: "600", fontSize: "1.25rem" }}>
                {progress?.percentage || 0}%
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                {progress?.processed || 0} / {progress?.total || 0}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: "100%",
              height: "1rem",
              backgroundColor: "#E5E7EB",
              borderRadius: "0.5rem",
              overflow: "hidden",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                width: `${progress?.percentage || 0}%`,
                height: "100%",
                backgroundColor: progress?.status === 'error' ? "#EF4444" : "#10B981",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Statystyki */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1rem",
              fontSize: "0.875rem",
            }}
          >
            <div>
              <div style={{ color: "#6B7280" }}>Zakwalifikowane</div>
              <div style={{ fontWeight: "600", color: "#10B981" }}>
                {progress?.qualified || 0}
              </div>
            </div>
            <div>
              <div style={{ color: "#6B7280" }}>Odrzucone</div>
              <div style={{ fontWeight: "600", color: "#EF4444" }}>
                {progress?.rejected || 0}
              </div>
            </div>
            <div>
              <div style={{ color: "#6B7280" }}>Wymagają przeglądu</div>
              <div style={{ fontWeight: "600", color: "#F59E0B" }}>
                {progress?.needsReview || 0}
              </div>
            </div>
            <div>
              <div style={{ color: "#6B7280" }}>Błędy</div>
              <div style={{ fontWeight: "600", color: "#6B7280" }}>
                {progress?.errors || 0}
              </div>
            </div>
          </div>

          {/* Szacowany czas */}
          {progress?.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                backgroundColor: "white",
                borderRadius: "0.25rem",
                fontSize: "0.875rem",
                color: "#6B7280",
              }}
            >
              Szacowany czas pozostały:{" "}
              {progress.estimatedTimeRemaining > 60
                ? `${Math.round(progress.estimatedTimeRemaining / 60)} min`
                : `${progress.estimatedTimeRemaining} sek`}
            </div>
          )}
        </div>
      )}

      {/* Lista firm */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>
          Ładowanie...
        </div>
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
        <>
          {/* Checkbox do zaznaczenia wszystkich */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={
                  companies.length > 0 &&
                  selectedCompanies.length === companies.length
                }
                onChange={toggleSelectAll}
              />
              <span>Zaznacz wszystkie</span>
            </label>
          </div>

          {/* Tabela firm */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "0.5rem",
              overflow: "hidden",
              border: "1px solid #E5E7EB",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
                  <th
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "left",
                      fontSize: "0.8125rem",
                      fontWeight: "600",
                      color: "#374151",
                      width: "40px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        companies.length > 0 &&
                        selectedCompanies.length === companies.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "left",
                      fontSize: "0.8125rem",
                      fontWeight: "600",
                      color: "#374151",
                      width: "40%",
                    }}
                  >
                    Firma i działalność
                  </th>
                  <th
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "left",
                      fontSize: "0.8125rem",
                      fontWeight: "600",
                      color: "#374151",
                      width: "15%",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "left",
                      fontSize: "0.8125rem",
                      fontWeight: "600",
                      color: "#374151",
                      width: "45%",
                    }}
                  >
                    Powód decyzji
                  </th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company, index) => {
                  const companyActivity = company.activityDescription || company.description || "Brak opisu działalności";
                  const isSelected = selectedCompanies.includes(company.id);
                  
                  return (
                    <tr
                      key={company.id}
                      style={{
                        backgroundColor: isSelected ? "#EFF6FF" : index % 2 === 0 ? "white" : "#F9FAFB",
                        borderBottom: "1px solid #E5E7EB",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#F3F4F6";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = index % 2 === 0 ? "white" : "#F9FAFB";
                        }
                      }}
                      onClick={() => toggleCompanySelection(company.id)}
                    >
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "center",
                          verticalAlign: "top",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCompanySelection(company.id)}
                          style={{ marginTop: "0.25rem" }}
                        />
                      </td>
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          verticalAlign: "top",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "0.9375rem",
                              marginBottom: "0.25rem",
                              color: "#111827",
                              lineHeight: "1.3",
                            }}
                          >
                            {company.name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.8125rem",
                              color: "#6B7280",
                              lineHeight: "1.4",
                              marginBottom: "0.25rem",
                            }}
                          >
                            {companyActivity.length > 150
                              ? `${companyActivity.substring(0, 150)}...`
                              : companyActivity}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              fontSize: "0.6875rem",
                              color: "#9CA3AF",
                              flexWrap: "wrap",
                            }}
                          >
                            {company.industry && (
                              <span>{company.industry}</span>
                            )}
                            {company.city && <span>• {company.city}</span>}
                            {company.country && (
                              <span>• {company.country}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          verticalAlign: "top",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                padding: "0.25rem 0.5rem",
                                borderRadius: "0.25rem",
                                backgroundColor: getStatusColor(company.verificationStatus),
                                color: "white",
                                fontSize: "0.75rem",
                                fontWeight: "500",
                                display: "inline-block",
                                cursor: (company.verificationStatus === "QUALIFIED" || company.verificationStatus === "REJECTED") ? "pointer" : "default",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (company.verificationStatus === "QUALIFIED" || company.verificationStatus === "REJECTED") {
                                  handleChangeStatus(company.id, company.verificationStatus);
                                }
                              }}
                              title={
                                company.verificationStatus === "QUALIFIED" || company.verificationStatus === "REJECTED"
                                  ? "Kliknij, aby zmienić status"
                                  : undefined
                              }
                            >
                              {getStatusLabel(company.verificationStatus)}
                            </span>
                            {(company.verificationStatus === "QUALIFIED" || company.verificationStatus === "REJECTED") && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleChangeStatus(company.id, company.verificationStatus);
                                }}
                                style={{
                                  padding: "0.125rem 0.375rem",
                                  backgroundColor: "#F3F4F6",
                                  color: "#6B7280",
                                  border: "1px solid #D1D5DB",
                                  borderRadius: "0.25rem",
                                  cursor: "pointer",
                                  fontSize: "0.625rem",
                                  fontWeight: "500",
                                  lineHeight: "1",
                                }}
                                title={`Zmień na ${company.verificationStatus === "QUALIFIED" ? "REJECTED" : "QUALIFIED"}`}
                              >
                                {company.verificationStatus === "QUALIFIED" ? "→ Odrzuć" : "→ Zatwierdź"}
                              </button>
                            )}
                            {company.verificationStatus !== "BLOCKED" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBlockCompany(company.id, company.name);
                                }}
                                style={{
                                  padding: "0.125rem 0.375rem",
                                  backgroundColor: "#DC2626",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "0.25rem",
                                  cursor: "pointer",
                                  fontSize: "0.625rem",
                                  fontWeight: "500",
                                  lineHeight: "1",
                                }}
                                title="Zablokuj firmę"
                              >
                                Zablokuj
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheckApolloEmployees(company.id, company.name);
                              }}
                              disabled={loadingApollo}
                              style={{
                                padding: "0.125rem 0.375rem",
                                backgroundColor: loadingApollo ? "#9CA3AF" : "#3B82F6",
                                color: "white",
                                border: "none",
                                borderRadius: "0.25rem",
                                cursor: loadingApollo ? "not-allowed" : "pointer",
                                fontSize: "0.625rem",
                                fontWeight: "500",
                                lineHeight: "1",
                              }}
                              title="Sprawdź pracowników w Apollo"
                            >
                              {loadingApollo ? "..." : "Apollo"}
                            </button>
                          </div>
                          {company.verificationScore !== null && (
                            <span
                              style={{
                                padding: "0.125rem 0.375rem",
                                borderRadius: "0.25rem",
                                backgroundColor: "#F3F4F6",
                                fontSize: "0.6875rem",
                                color: "#6B7280",
                                display: "inline-block",
                                width: "fit-content",
                              }}
                            >
                              {company.verificationScore.toFixed(2)}
                            </span>
                          )}
                          {company.verificationStatus === "PENDING" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVerifySingle(company.id);
                              }}
                              disabled={verifying}
                              style={{
                                padding: "0.25rem 0.5rem",
                                backgroundColor: "#3B82F6",
                                color: "white",
                                border: "none",
                                borderRadius: "0.25rem",
                                cursor: verifying ? "not-allowed" : "pointer",
                                fontSize: "0.6875rem",
                                width: "100%",
                                marginTop: "0.125rem",
                              }}
                            >
                              Weryfikuj
                            </button>
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          verticalAlign: "top",
                        }}
                      >
                        {company.verificationReason ? (
                          <div
                            style={{
                              fontSize: "0.8125rem",
                              lineHeight: "1.5",
                              color: "#374151",
                            }}
                          >
                            {company.verificationReason}
                          </div>
                        ) : company.verificationStatus === "PENDING" ? (
                          <div
                            style={{
                              fontSize: "0.8125rem",
                              color: "#9CA3AF",
                              fontStyle: "italic",
                            }}
                          >
                            Oczekuje na weryfikację
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: "0.8125rem",
                              color: "#9CA3AF",
                              fontStyle: "italic",
                            }}
                          >
                            Brak uzasadnienia
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginacja */}
          {total > 50 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "1rem",
                marginTop: "2rem",
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: page === 1 ? "#E5E7EB" : "#3B82F6",
                  color: page === 1 ? "#9CA3AF" : "white",
                  border: "none",
                  borderRadius: "0.25rem",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                }}
              >
                Poprzednia
              </button>
              <span style={{ padding: "0.5rem 1rem", alignSelf: "center" }}>
                Strona {page} z {Math.ceil(total / 50)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 50)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor:
                    page >= Math.ceil(total / 50) ? "#E5E7EB" : "#3B82F6",
                  color: page >= Math.ceil(total / 50) ? "#9CA3AF" : "white",
                  border: "none",
                  borderRadius: "0.25rem",
                  cursor:
                    page >= Math.ceil(total / 50) ? "not-allowed" : "pointer",
                }}
              >
                Następna
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal z wynikami Apollo */}
      {apolloEmployees && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
          onClick={() => {
      setApolloEmployees(null);
      setSelectedCompanyForApollo(null);
      setSelectedTitles([]);
      setSelectedPeopleIds([]);
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "0.5rem",
              padding: "2rem",
              maxWidth: "900px",
              maxHeight: "80vh",
              overflow: "auto",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "600" }}>
                Pracownicy w Apollo: {apolloEmployees.company?.name}
              </h2>
              <button
                onClick={() => {
      setApolloEmployees(null);
      setSelectedCompanyForApollo(null);
      setSelectedTitles([]);
      setSelectedPeopleIds([]);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#F3F4F6",
                  border: "none",
                  borderRadius: "0.25rem",
                  cursor: "pointer",
                }}
              >
                Zamknij
              </button>
            </div>

            {apolloEmployees.apolloOrganization && (
              <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#F9FAFB", borderRadius: "0.5rem" }}>
                <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                  Firma w Apollo: {apolloEmployees.apolloOrganization.name}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                  {apolloEmployees.apolloOrganization.domain && `Domena: ${apolloEmployees.apolloOrganization.domain} • `}
                  {apolloEmployees.apolloOrganization.employees &&
                    `Szacowana liczba pracowników: ${apolloEmployees.apolloOrganization.employees.toLocaleString()}`}
                </div>
              </div>
            )}

            {apolloEmployees.creditsInfo && (
              <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#EFF6FF", borderRadius: "0.5rem", border: "1px solid #BFDBFE" }}>
                <div style={{ fontSize: "0.875rem", color: "#1E40AF", fontWeight: "600", marginBottom: "0.25rem" }}>
                  Informacja o kredytach Apollo
                </div>
                <div style={{ fontSize: "0.75rem", color: "#1E3A8A" }}>
                  {apolloEmployees.creditsInfo.message}
                  {apolloEmployees.creditsInfo.searchCreditsUsed !== undefined && (
                    <span> • Zużyto kredytów za wyszukiwanie: {apolloEmployees.creditsInfo.searchCreditsUsed}</span>
                  )}
                </div>
              </div>
            )}

            {apolloEmployees.statistics && (
              <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#F9FAFB", borderRadius: "0.5rem" }}>
                <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Statystyki:</div>
                <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                  Znaleziono pracowników: {apolloEmployees.statistics.total} • Z emailem:{" "}
                  {apolloEmployees.statistics.withEmails} • Unikalne stanowiska: {apolloEmployees.statistics.uniqueTitlesCount}
                </div>
              </div>
            )}

            {apolloEmployees.uniqueTitles && apolloEmployees.uniqueTitles.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: "600", marginBottom: "0.75rem" }}>Wybierz odpowiednie stanowiska:</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                    gap: "0.5rem",
                    maxHeight: "200px",
                    overflowY: "auto",
                    padding: "0.5rem",
                    border: "1px solid #E5E7EB",
                    borderRadius: "0.25rem",
                  }}
                >
                  {apolloEmployees.uniqueTitles.map((title: string) => (
                    <label
                      key={title}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem",
                        cursor: "pointer",
                        borderRadius: "0.25rem",
                        backgroundColor: selectedTitles.includes(title) ? "#DBEAFE" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTitles.includes(title)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTitles([...selectedTitles, title]);
                          } else {
                            setSelectedTitles(selectedTitles.filter((t) => t !== title));
                          }
                        }}
                      />
                      <span style={{ fontSize: "0.875rem" }}>{title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {apolloEmployees.people && apolloEmployees.people.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: "600" }}>
                    Lista pracowników ({apolloEmployees.people.length}):
                  </div>
                  {selectedPeopleIds.length > 0 && (
                    <button
                      onClick={() => handleEnrichSelectedPeople(selectedPeopleIds)}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#3B82F6",
                        color: "white",
                        border: "none",
                        borderRadius: "0.25rem",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        fontWeight: "600",
                      }}
                    >
                      Pobierz emaile ({selectedPeopleIds.length} osób - {selectedPeopleIds.length} kredytów)
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                        <th style={{ padding: "0.5rem", textAlign: "left", width: "40px" }}>
                          <input
                            type="checkbox"
                            checked={selectedPeopleIds.length === apolloEmployees.people.length && apolloEmployees.people.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPeopleIds(apolloEmployees.people.map((p: any) => p.id).filter((id: string) => !!id));
                              } else {
                                setSelectedPeopleIds([]);
                              }
                            }}
                          />
                        </th>
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>Imię i nazwisko</th>
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>Stanowisko</th>
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>Email</th>
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>Status</th>
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>LinkedIn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apolloEmployees.people.map((person: any, index: number) => {
                        const hasEmail = person.email && person.email !== "email_not_unlocked@domain.com";
                        const emailUnlocked = person.emailUnlocked !== false;
                        const emailStatus = person.emailStatus || person.email_status || "unknown";
                        const isSelected = selectedPeopleIds.includes(person.id);
                        
                        return (
                          <tr key={person.id || index} style={{ borderBottom: "1px solid #E5E7EB", backgroundColor: isSelected ? "#EFF6FF" : "transparent" }}>
                            <td style={{ padding: "0.5rem" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPeopleIds([...selectedPeopleIds, person.id]);
                                  } else {
                                    setSelectedPeopleIds(selectedPeopleIds.filter((id) => id !== person.id));
                                  }
                                }}
                              />
                            </td>
                            <td style={{ padding: "0.5rem" }}>{person.name}</td>
                            <td style={{ padding: "0.5rem" }}>{person.title || "-"}</td>
                            <td style={{ padding: "0.5rem" }}>
                              {hasEmail ? (
                                <span style={{ color: "#10B981", fontWeight: "500" }}>{person.email}</span>
                              ) : (
                                <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>Wymaga pobrania</span>
                              )}
                            </td>
                            <td style={{ padding: "0.5rem" }}>
                              {hasEmail ? (
                                <span style={{ color: "#10B981", fontSize: "0.75rem" }}>✓ Odblokowany</span>
                              ) : (
                                <span style={{ color: "#F59E0B", fontSize: "0.75rem" }}>🔒 Zablokowany</span>
                              )}
                            </td>
                            <td style={{ padding: "0.5rem" }}>
                              {person.linkedin_url ? (
                                <a
                                  href={person.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: "#3B82F6", textDecoration: "none" }}
                                >
                                  Link
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {selectedPeopleIds.length > 0 && (
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "#FEF3C7", borderRadius: "0.25rem", fontSize: "0.875rem", color: "#92400E" }}>
                    Wybrano {selectedPeopleIds.length} osób. Pobranie emaili zużyje {selectedPeopleIds.length} kredytów Apollo.
                  </div>
                )}
              </div>
            )}

            {apolloEmployees.people && apolloEmployees.people.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <div style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.5rem", color: "#374151" }}>
                  Nie znaleziono pracowników w Apollo
                </div>
                <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "1rem" }}>
                  {apolloEmployees.message || "Firma może nie mieć pracowników w bazie Apollo lub dane nie są dostępne dla tej firmy."}
                </div>
                {apolloEmployees.company?.website && (
                  <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                    Website: {apolloEmployees.company.website}
                  </div>
                )}
                {!apolloEmployees.apolloOrganization && (
                  <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#FEF3C7", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#92400E" }}>
                    Wskazówka: Nie znaleziono dokładnego dopasowania firmy w Apollo. Możliwe przyczyny:
                    <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                      <li>Nazwa firmy w Twojej bazie różni się od nazwy w Apollo</li>
                      <li>Firma nie jest w bazie Apollo</li>
                      <li>Firma ma inną nazwę w Apollo (np. z formą prawną)</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {selectedTitles.length > 0 && (
              <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #E5E7EB" }}>
                <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                  Wybrane stanowiska ({selectedTitles.length}):
                </div>
                <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "1rem" }}>
                  {selectedTitles.join(", ")}
                </div>
                <button
                  onClick={() => {
                    // Tutaj można zapisać wybrane stanowiska (np. do bazy danych lub stanu)
                    alert(`Wybrano ${selectedTitles.length} stanowisk:\n\n${selectedTitles.join("\n")}\n\n(Funkcjonalność zapisywania zostanie dodana później)`);
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#10B981",
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  Zapisz wybrane stanowiska
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

