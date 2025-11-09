"use client";

import { useState, useEffect, useMemo } from "react";
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
  website?: string | null;
}

interface CompanyStats {
  pending: number;
  qualified: number;
  rejected: number;
  needsReview: number;
  blocked: number;
  total: number;
}

const PERSONA_SENIORITY_ORDER = [
  "intern",
  "entry",
  "junior",
  "mid",
  "senior",
  "manager",
  "director",
  "vp",
  "c_suite",
  "founder",
  "owner",
  "partner",
  "principal",
  "executive",
];

export default function CompanyVerifyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("QUALIFIED");
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
  const [personaVerification, setPersonaVerification] = useState<any>(null);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [savingTitles, setSavingTitles] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [verifiedCompanies, setVerifiedCompanies] = useState<Array<{
    id: number;
    companyId: number;
    company: { id: number; name: string; website: string | null; industry: string | null };
    positiveCount: number;
    negativeCount: number;
    unknownCount: number;
    totalCount: number;
    verifiedAt: string;
  }>>([]);
  const [personaCriteria, setPersonaCriteria] = useState<any>(null);

  const verifiedLookup = useMemo(() => {
    const map = new Map<number, (typeof verifiedCompanies)[number]>();
    verifiedCompanies.forEach((item) => map.set(item.companyId, item));
    return map;
  }, [verifiedCompanies]);

  const globalTitlesSet = useMemo(() => {
    const titles = new Set<string>();

    (personaCriteria?.positiveRoles ?? []).forEach((rule: any) => {
      if (rule?.label) titles.add(rule.label.toLowerCase());
      (rule?.keywords ?? []).forEach((kw: string) => titles.add(kw.toLowerCase()));
    });
    (personaCriteria?.negativeRoles ?? []).forEach((rule: any) => {
      if (rule?.label) titles.add(rule.label.toLowerCase());
      (rule?.keywords ?? []).forEach((kw: string) => titles.add(kw.toLowerCase()));
    });

    return titles;
  }, [personaCriteria]);

  const totalQualifiedPersonas = useMemo(() => {
    if (!companies.length) {
      return 0;
    }

    return companies.reduce((sum, company) => {
      const stats = verifiedLookup.get(company.id);
      return sum + (stats?.positiveCount ?? 0);
    }, 0);
  }, [companies, verifiedLookup]);

  useEffect(() => {
    loadStats();
    loadCompanies();
    loadVerifiedCompanies();
    loadPersonas();
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
      const normalizedCompanies = (data.companies || []).map((company: any) => ({
        ...company,
        website:
          typeof company?.website === "string"
            ? company.website.trim()
            : company?.website ?? null,
      }));
      setCompanies(normalizedCompanies);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error("Błąd ładowania firm:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVerifiedCompanies = async () => {
    try {
      const response = await fetch("/api/company-selection/persona-verification?limit=200");
      const data = await response.json();
      if (data.success) {
        setVerifiedCompanies(data.data || []);
      }
    } catch (error) {
      console.error("Błąd ładowania weryfikacji person:", error);
    }
  };

  const handleVerifySingle = async (companyId: number) => {
    try {
      const company = companies.find((c) => c.id === companyId);
      if (!hasCompanyWebsite(company)) {
        alert("Ta firma nie ma uzupełnionej strony www. Uzupełnij ją przed weryfikacją.");
        return;
      }

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

  type PersonaVerificationAction = "reuse" | "refresh" | "reverify";

  const handlePersonaVerification = async (
    companyId: number,
    action: PersonaVerificationAction = "reuse"
  ) => {
    try {
      const companyRecord =
        companies.find((c) => c.id === companyId) ??
        verifiedCompanies.find((item) => item.companyId === companyId)?.company;
      if (!hasCompanyWebsite(companyRecord)) {
        alert("Ta firma nie ma uzupełnionej strony www. Dodaj ją, aby pobrać pracowników z Apollo.");
        return;
      }

      setPersonaLoading(true);
      setPersonaError(null);
      setSelectedCompanyForApollo(companyId);

      const response = await fetch("/api/company-selection/persona-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, action }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Nie udało się przeprowadzić weryfikacji person");
      }

      const detail = data.data || {};
      const people = detail.people || [];

      const positiveIds = Array.from(
        new Set<string>(
          people
            .filter((person: any) => person.personaMatchStatus === "positive" && person.id)
            .map((person: any) => String(person.id))
        )
      );

      const positiveTitles = Array.from(
        new Set<string>(
          people
            .filter((person: any) => person.personaMatchStatus === "positive")
            .map((person: any) => (person.title || "").trim())
            .filter((title: string) => title.length > 0)
        )
      );

      setSelectedPeopleIds(positiveIds);
      setSelectedTitles(positiveTitles);

      setPersonaVerification({
        companyId,
        fromCache: data.fromCache,
        verificationId: data.verificationId,
        counts: data.counts,
        verifiedAt: data.verifiedAt,
        warning: data.warning,
        summary: detail.summary
          ? {
              positive: detail.summary.positiveCount ?? 0,
              negative: detail.summary.negativeCount ?? 0,
              unknown: detail.summary.unknownCount ?? 0,
            }
          : {
              positive: data.counts?.positive ?? 0,
              negative: data.counts?.negative ?? 0,
              unknown: data.counts?.unknown ?? 0,
            },
      });

      setApolloEmployees({
        company: detail.company ?? detail.metadata?.company ?? null,
        apolloOrganization: detail.apolloOrganization ?? detail.metadata?.apolloOrganization ?? null,
        statistics: detail.statistics ?? detail.metadata?.statistics ?? null,
        uniqueTitles: detail.uniqueTitles ?? [],
        creditsInfo: detail.creditsInfo ?? detail.metadata?.creditsInfo ?? null,
        people,
      });

      setVerifiedCompanies((prev) => {
        const sanitizedId = Number.isFinite(data.verificationId) ? data.verificationId : Date.now();
        const companyInfo = detail.company ?? company ?? { id: companyId, name: company?.name ?? "", website: company?.website ?? null, industry: null };
        const nextEntry = {
          id: sanitizedId,
          companyId,
          company: companyInfo,
          positiveCount: data.counts?.positive ?? 0,
          negativeCount: data.counts?.negative ?? 0,
          unknownCount: data.counts?.unknown ?? 0,
          totalCount: data.counts?.total ?? 0,
          verifiedAt: data.verifiedAt ?? new Date().toISOString(),
        };

        const filtered = prev.filter((item) => item.companyId !== companyId);
        return [nextEntry, ...filtered].slice(0, 200);
      });

      await loadVerifiedCompanies();
      loadStats();
    } catch (err) {
      setPersonaError(err instanceof Error ? err.message : String(err));
    } finally {
      setPersonaLoading(false);
    }
  };

  const handleReevaluatePersonVerification = async (companyId: number) => {
    await handlePersonaVerification(companyId, "reverify");
    alert("Ponowna weryfikacja person została wykonana na podstawie aktualnych reguł.");
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
      const targetPeople =
        apolloEmployees?.people?.filter((person: any) =>
          personIds.includes(String(person.id ?? ""))
        ) ?? [];

      const lockedCount = targetPeople.filter(
        (person: any) => !person.emailUnlocked
      ).length;

      const confirmMessage =
        lockedCount > 0
          ? `Wybrano ${personIds.length} osób. Maile trzeba odblokować dla ${lockedCount}, co może zużyć maksymalnie ${lockedCount} kredytów Apollo.\n\nCzy kontynuować pobieranie?`
          : `Wybrano ${personIds.length} osób. Wszystkie mają już odblokowane adresy – ponowne pobranie nie zużyje kredytów.\n\nCzy chcesz odświeżyć dane?`;

      if (!confirm(confirmMessage)) {
        return;
      }

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
        alert(
          `Pobrano emaile dla ${data.people.length} osób.\nZużyto ${data.creditsUsed} kredytów Apollo.`
        );
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
      alert("Zaznacz firmy do weryfikacji");
      return;
    }

    try {
      setVerifying(true);

      const selectableIds = selectedCompanies.filter((companyId) => {
        const company = companies.find((c) => c.id === companyId);
        return hasCompanyWebsite(company);
      });

      if (selectableIds.length === 0) {
        alert("Żadna z zaznaczonych firm nie ma uzupełnionej strony www. Uzupełnij dane przed weryfikacją.");
        setVerifying(false);
        return;
      }

      if (selectableIds.length !== selectedCompanies.length) {
        alert("Pominięto firmy bez adresu www.");
        setSelectedCompanies(selectableIds);
      }

      // Utwórz nowe ID postępu
      const newProgressId = `progress-${Date.now()}`;
      setProgressId(newProgressId);

      // Uruchom weryfikację batch
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
      // Postęp będzie śledzony przez useEffect polling
    } catch (error) {
      alert("Błąd weryfikacji: " + (error instanceof Error ? error.message : String(error)));
      setVerifying(false);
      setProgressId(null);
    }
  };

  const toggleCompanySelection = (companyId: number) => {
    const company = companies.find((c) => c.id === companyId);
    if (!hasCompanyWebsite(company)) {
      alert("Firma nie ma uzupełnionego adresu www. Dodaj stronę, aby móc ją zweryfikować.");
      return;
    }

    setSelectedCompanies((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const toggleSelectAll = () => {
    const selectableIds = companies.filter((c) => hasCompanyWebsite(c)).map((c) => c.id);

    if (selectableIds.length === 0) {
      alert("Brak firm ze zdefiniowaną stroną www. Uzupełnij dane, aby móc rozpocząć weryfikację.");
      setSelectedCompanies([]);
      return;
    }

    if (selectedCompanies.length === selectableIds.length) {
      setSelectedCompanies([]);
    } else {
      if (selectableIds.length < companies.length) {
        alert("Pominięto firmy bez adresu www.");
      }
      setSelectedCompanies(selectableIds);
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

  const hasCompanyWebsite = (company?: any) => {
    const website = company?.website;
    return typeof website === "string" && website.trim().length > 0;
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const loadPersonas = async () => {
    try {
      const criteriaRes = await fetch("/api/company-selection/criteria");
      if (!criteriaRes.ok) {
        setPersonaCriteria(null);
        return;
      }

      const criteriaJson = await criteriaRes.json();
      const criteriaId = criteriaJson?.criteria?.id;

      if (!criteriaId) {
        setPersonaCriteria(null);
        return;
      }

      const personaRes = await fetch(`/api/company-selection/criteria/${criteriaId}/personas`);
      if (!personaRes.ok) {
        setPersonaCriteria(null);
        return;
      }

      const personaJson = await personaRes.json();
      if (personaJson.success && personaJson.data) {
        setPersonaCriteria(personaJson.data);
      } else {
        setPersonaCriteria(null);
      }
    } catch (err) {
      console.error("[Verify] Błąd ładowania kryteriów person", err);
      setPersonaCriteria(null);
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

      <div
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            flex: "1 1 240px",
            minWidth: "220px",
            padding: "1rem 1.25rem",
            backgroundColor: "#F9FAFB",
            border: "1px solid #E5E7EB",
            borderRadius: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1F2937" }}>Kryteria firm</div>
          <div style={{ fontSize: "0.8rem", color: "#6B7280" }}>
            Zdefiniuj zasady oceny firm i pola wymagane przed wysyłką.
          </div>
          <Link
            href="/company-selection/criteria"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
              padding: "0.5rem 0.75rem",
              backgroundColor: "#3B82F6",
              color: "white",
              borderRadius: "0.5rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              textDecoration: "none",
              transition: "background-color 0.2s ease",
            }}
          >
            Otwórz kryteria firm
          </Link>
        </div>
        <div
          style={{
            flex: "1 1 240px",
            minWidth: "220px",
            padding: "1rem 1.25rem",
            backgroundColor: "#F9FAFB",
            border: "1px solid #E5E7EB",
            borderRadius: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1F2937" }}>Kryteria person (AI)</div>
          <div style={{ fontSize: "0.8rem", color: "#6B7280" }}>
            Zarządzaj stanowiskami i briefem, który prowadzi weryfikację kontaktów.
          </div>
          <Link
            href="/company-selection/personas"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
              padding: "0.5rem 0.75rem",
              backgroundColor: "#10B981",
              color: "white",
              borderRadius: "0.5rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              textDecoration: "none",
              transition: "background-color 0.2s ease",
            }}
          >
            Otwórz kryteria person
          </Link>
          </div>
        </div>

      {/* Statystyki */}
      {(() => {
        const cards = [
          {
            status: "PENDING",
            label: "Do weryfikacji",
            value: stats.pending,
            bg: "#E0F2FE",
            border: "#BAE6FD",
            textColor: "#0369A1",
          },
          {
            status: "QUALIFIED",
            label: "Zakwalifikowane",
            value: stats.qualified,
            bg: "#DCFCE7",
            border: "#BBF7D0",
            textColor: "#15803D",
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
          marginBottom: "2rem",
        }}
      >
        {cards.map((card) => {
          const isActive = selectedStatus === card.status;
          const activeStyles = isActive
            ? {
                boxShadow: "0 6px 12px rgba(59,130,246,0.25)",
                transform: "translateY(-2px)",
                border: `2px solid ${card.textColor}`,
              }
            : {};

          return (
            <button
              type="button"
              key={card.status}
              onClick={() => handleStatusFilterChange(card.status)}
          style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.35rem",
                padding: "1.25rem",
                backgroundColor: card.bg,
                borderRadius: "0.75rem",
                border: `1px solid ${card.border}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                cursor: "pointer",
                transition: "all 0.2s ease-in-out",
                color: card.textColor,
                outline: "none",
                ...activeStyles,
              }}
            >
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{card.label}</span>
              <span style={{ fontSize: "1.75rem", fontWeight: 700 }}>{card.value}</span>
              <span style={{ fontSize: "0.75rem", color: isActive ? card.textColor : "#4B5563" }}>
                {card.status === "ALL"
                  ? "Kliknij, aby zobaczyć wszystkie firmy"
                  : `Filtruj status: ${card.label.toLowerCase()}`}
              </span>
            </button>
          );
        })}
          </div>
        );
      })()}

      {personaVerification?.summary && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            backgroundColor: "#ECFDF5",
            border: "1px solid #BBF7D0",
            color: "#166534",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Weryfikacja person (AI)</div>
          <div style={{ fontSize: "0.9rem" }}>
            Pasuje: <strong>{personaVerification.summary.positive}</strong> • Odrzucone:{" "}
            <strong>{personaVerification.summary.negative}</strong> • Niepewne:{" "}
            <strong>{personaVerification.summary.unknown}</strong>
          </div>
          <div style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
            W tabeli poniżej osoby dopasowane oznaczone są zielonym tłem, a odrzucone – czerwonym. Zaznaczenia checkboxów wstępnie obejmują tylko dopasowane osoby.
          </div>
          {personaVerification.warning && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#92400E" }}>
              {personaVerification.warning}
        </div>
          )}
          </div>
      )}

      {personaError && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            backgroundColor: "#FEF3C7",
            border: "1px solid #FDE68A",
            color: "#92400E",
            fontSize: "0.85rem",
          }}
        >
          {personaError}
          </div>
      )}

      {verifiedCompanies.length > 0 && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            backgroundColor: "#F9FAFB",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.75rem", color: "#1F2937" }}>
            Ostatnie weryfikacje person
          </div>
          <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto" }}>
            {verifiedCompanies.slice(0, 8).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePersonaVerification(item.companyId, "reuse")}
          style={{
                  minWidth: "220px",
                  padding: "0.75rem",
                  borderRadius: "0.6rem",
                  border: "1px solid #D1D5DB",
                  backgroundColor:
                    personaVerification?.companyId === item.companyId ? "#EFF6FF" : "white",
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ fontWeight: 600, color: "#1F2937", marginBottom: "0.35rem" }}>
                  {item.company.name}
          </div>
                <div style={{ fontSize: "0.8rem", color: "#4B5563" }}>
                  Pasuje: <strong>{item.positiveCount}</strong> / {item.totalCount}
        </div>
                <div style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                  Warunkowo: <strong>{item.unknownCount}</strong>
      </div>
                <div style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: "0.35rem" }}>
                  {new Date(item.verifiedAt).toLocaleString("pl-PL")}
        </div>
              </button>
            ))}
      </div>
        </div>
      )}

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
          onChange={(e) => handleStatusFilterChange(e.target.value)}
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
        <div style={{ flexBasis: "100%", textAlign: "center", fontWeight: 600, color: "#1F2937", fontSize: "1rem" }}>
          Zakwalifikowane persony (bieżąca lista): <span style={{ color: "#10B981" }}>{totalQualifiedPersonas}</span>
        </div>

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
                  <th
                    style={{
                      padding: "0.5rem 0.75rem",
                      textAlign: "left",
                      fontSize: "0.8125rem",
                      fontWeight: "600",
                      color: "#374151",
                      width: "10%",
                    }}
                  >
                    Persony (AI)
                  </th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company, index) => {
                  const companyActivity = company.activityDescription || company.description || "Brak opisu działalności";
                  const companyHasWebsite = hasCompanyWebsite(company);
                  const personaButtonDisabled =
                    !companyHasWebsite || (personaLoading && selectedCompanyForApollo === company.id);
                  const isSelected = selectedCompanies.includes(company.id);
                  
                  return (
                    <tr
                      key={company.id}
                      style={{
                        backgroundColor: isSelected ? "#EFF6FF" : index % 2 === 0 ? "white" : "#F9FAFB",
                        borderBottom: "1px solid #E5E7EB",
                        cursor: companyHasWebsite ? "pointer" : "not-allowed",
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
                      onClick={() => {
                        if (!companyHasWebsite) {
                          alert("Firma nie ma uzupełnionej strony www. Uzupełnij ją przed weryfikacją.");
                          return;
                        }
                        toggleCompanySelection(company.id);
                      }}
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
                          disabled={!companyHasWebsite}
                          title={
                            companyHasWebsite
                              ? undefined
                              : "Brak strony www – uzupełnij, aby móc zaznaczyć firmę"
                          }
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
                          {!companyHasWebsite && (
                            <div
                              style={{
                                marginTop: "0.35rem",
                                fontSize: "0.75rem",
                                color: "#B91C1C",
                                fontWeight: 600,
                              }}
                            >
                              Brak adresu www – uzupełnij, aby zweryfikować
                            </div>
                          )}
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
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePersonaVerification(company.id, "reuse");
                              }}
                              disabled={personaButtonDisabled}
                              style={{
                                padding: "0.125rem 0.5rem",
                                backgroundColor:
                                  personaButtonDisabled
                                    ? "#9CA3AF"
                                    : verifiedLookup.has(company.id)
                                    ? "#10B981"
                                    : "#3B82F6",
                                color: "white",
                                border: "none",
                                borderRadius: "0.35rem",
                                cursor:
                                  personaButtonDisabled
                                     ? "not-allowed"
                                     : "pointer",
                                fontSize: "0.625rem",
                                fontWeight: "600",
                                lineHeight: "1",
                                boxShadow: verifiedLookup.has(company.id)
                                  ? "0 2px 6px rgba(16,185,129,0.35)"
                                  : "none",
                                transition: "transform 0.15s ease",
                              }}
                              title={
                                !companyHasWebsite
                                  ? "Brak strony www – uzupełnij, aby pobrać pracowników z Apollo"
                                  : verifiedLookup.has(company.id)
                                  ? "Weryfikacja już wykonana – kliknij, aby otworzyć wyniki"
                                  : "Weryfikacja person (pobierz pracowników z Apollo)"
                              }
                            >
                              {personaLoading && selectedCompanyForApollo === company.id
                                ? "Weryfikuję..."
                                : "Weryfikacja person"}
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
                              disabled={verifying || !companyHasWebsite}
                              style={{
                                padding: "0.25rem 0.5rem",
                                backgroundColor: !companyHasWebsite ? "#9CA3AF" : "#3B82F6",
                                color: "white",
                                border: "none",
                                borderRadius: "0.25rem",
                                cursor: verifying || !companyHasWebsite ? "not-allowed" : "pointer",
                                fontSize: "0.6875rem",
                                width: "100%",
                                marginTop: "0.125rem",
                              }}
                              title={
                                !companyHasWebsite
                                  ? "Brak strony www – uzupełnij, aby rozpocząć weryfikację"
                                  : undefined
                              }
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
                      <td
                        style={{
                          padding: "0.5rem 0.75rem",
                          verticalAlign: "top",
                          fontSize: "0.8125rem",
                          color: "#1F2937",
                        }}
                      >
                        {(() => {
                          const personaStats = verifiedLookup.get(company.id);
                          if (!personaStats) {
                            return (
                              <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>
                                brak danych
                              </span>
                            );
                          }

                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <span>
                                <strong>{personaStats.positiveCount}</strong> / {personaStats.totalCount}
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                                Warunkowo: {personaStats.unknownCount}
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                                Weryfikowano: {new Date(personaStats.verifiedAt).toLocaleString("pl-PL")}
                              </span>
                            </div>
                          );
                        })()}
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

            {selectedCompanyForApollo && verifiedLookup.has(selectedCompanyForApollo) && (
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                <button
                  type="button"
                  onClick={() =>
                    handlePersonaVerification(selectedCompanyForApollo, "refresh")
                  }
                  disabled={loadingApollo}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: loadingApollo ? "#9CA3AF" : "#2563EB",
                    color: "white",
                    border: "none",
                    borderRadius: "0.35rem",
                    cursor: loadingApollo ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                  }}
                >
                  {loadingApollo ? "..." : "Ponowne wyszukiwanie person"}
                </button>
                <button
                  type="button"
                  onClick={() => handleReevaluatePersonVerification(selectedCompanyForApollo)}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#10B981",
                    color: "white",
                    border: "none",
                    borderRadius: "0.35rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                  }}
                >
                  Ponowna weryfikacja
                </button>
              </div>
            )}

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
                        <th style={{ padding: "0.5rem", textAlign: "left" }}>Dopasowanie person</th>
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
                        const personaStatusRaw = (person.personaMatchStatus || "unknown").toString().toLowerCase();
                        const personaStatus = ["positive", "negative", "conditional"].includes(personaStatusRaw)
                          ? personaStatusRaw
                          : "unknown";
                        const personaReason = person.personaMatchReason;
                        const aiReason = person.aiReason;
                        const aiDecision = person.aiDecision;
                        const aiScore = typeof person.aiScore === "number" ? person.aiScore : null;
                        const wasOverridden = Boolean(person.personaMatchOverridden);

                        let rowBackground = "transparent";
                        if (personaStatus === "positive") {
                          rowBackground = "#ECFDF5";
                        } else if (personaStatus === "negative") {
                          rowBackground = "#FEE2E2";
                        } else if (personaStatus === "conditional") {
                          rowBackground = "#FEF9C3";
                        }
                        if (isSelected) {
                          rowBackground = "#EFF6FF";
                        }

                        const personaBadge =
                          personaStatus === "positive"
                            ? { label: "Pasuje", bg: "#DCFCE7", color: "#15803D" }
                            : personaStatus === "negative"
                            ? { label: "Odrzucone", bg: "#FEE2E2", color: "#B91C1C" }
                            : personaStatus === "conditional"
                            ? { label: "Warunkowo", bg: "#FEF3C7", color: "#92400E" }
                            : { label: "Brak danych", bg: "#E5E7EB", color: "#374151" };
                        
                        return (
                          <tr key={person.id || index} style={{ borderBottom: "1px solid #E5E7EB", backgroundColor: rowBackground }}>
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
                            <td style={{ padding: "0.5rem", verticalAlign: "top" }}>
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                  padding: "0.2rem 0.6rem",
                                  borderRadius: "9999px",
                                  backgroundColor: personaBadge.bg,
                                  color: personaBadge.color,
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                }}
                              >
                                {personaBadge.label}
                              </div>
                              <div style={{ marginTop: "0.45rem", fontSize: "0.74rem", color: "#4B5563", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                <div>
                                  <strong>AI:</strong> {aiDecision ? aiDecision.toUpperCase() : "BRAK"}
                                  {aiScore !== null && ` • Ocena: ${(aiScore * 100).toFixed(0)}%`}
                                </div>
                                <div>
                                  <strong>Notatka AI:</strong> {aiReason || "AI nie podał szczegółowego uzasadnienia."}
                                </div>
                                <div>
                                  <strong>Decyzja końcowa:</strong> {personaBadge.label}
                                </div>
                                <div>
                                  {personaReason ? (
                                    <span>{personaReason}</span>
                                  ) : (
                                    <span style={{ fontStyle: "italic", color: "#9CA3AF" }}>Brak dodatkowych uwag.</span>
                                  )}
                                </div>
                                {wasOverridden && (
                                  <div style={{ color: "#166534" }}>
                                    (Dostosowane przez reguły person.)
                                  </div>
                                )}
                              </div>
                            </td>
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
                  (() => {
                    const lockedCount = apolloEmployees.people.filter(
                      (p: any) => selectedPeopleIds.includes(p.id) && !(p.email && p.email !== "email_not_unlocked@domain.com")
                    ).length;
                    return (
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "#FEF3C7", borderRadius: "0.25rem", fontSize: "0.875rem", color: "#92400E" }}>
                        Wybrano {selectedPeopleIds.length} osób. Pobranie może zużyć do {lockedCount} kredytów Apollo (tylko dla osób bez odblokowanych adresów).
                  </div>
                    );
                  })()
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
                {(() => {
                  const newSelectedTitlesCount = selectedTitles.filter((title) => !globalTitlesSet.has(title.toLowerCase())).length;
                  return (
                    <div style={{ fontSize: "0.8rem", color: "#4B5563", marginBottom: "0.5rem" }}>
                      Łącznie zaznaczone: <strong>{selectedTitles.length}</strong> • Już zapisane w regułach: <strong>{selectedTitles.length - newSelectedTitlesCount}</strong> • Nowe do dodania: <strong>{newSelectedTitlesCount}</strong>
                    </div>
                  );
                })()}
                <div
                  style={{
                    backgroundColor: "#ECFDF5",
                    border: "1px solid #BBF7D0",
                    borderRadius: "0.75rem",
                    padding: "0.85rem 1rem",
                    marginBottom: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.45rem",
                    fontSize: "0.82rem",
                    color: "#065F46",
                  }}
                >
                  <strong style={{ fontSize: "0.9rem" }}>Po co zapisywać tytuły?</strong>
                  <span>
                    Kliknięcie poniżej doda wybrane stanowiska do globalnej listy reguł. Od tej chwili każda nowa weryfikacja potraktuje je automatycznie (zanim zapytamy AI).
                  </span>
                  <span>
                    Warto zapisywać częste role decyzyjne: sprzedażowe ("sales", "account", "business development"), C-level ("CEO", "COO", "CMO"), dyrektorów ("director", "head") lub osoby odpowiedzialne za projekty ("project manager", "creative director").
                  </span>
                  <span>
                    Jeśli widzisz tu nowe stanowiska, które system jeszcze nie rozpoznaje, dodanie ich oszczędzi czas przy kolejnych firmach. Zapisane reguły znajdziesz w zakładce „Kryteria person (AI)”.
                  </span>
                </div>
                <button
                  onClick={async () => {
                    if (savingTitles) {
                      return;
                    }

                    const titlesToSave = selectedTitles.map((title) => title.trim()).filter(Boolean);
                    if (!titlesToSave.length) {
                      alert("Brak stanowisk do zapisania.");
                      return;
                    }

                    try {
                      setSavingTitles(true);
                      const response = await fetch(
                        "/api/company-selection/persona-verification/save-titles",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ titles: titlesToSave }),
                        }
                      );

                      const data = await response.json();
                      if (!response.ok || !data.success) {
                        throw new Error(data.error || "Nie udało się zapisać stanowisk.");
                      }

                      if (data.added?.length) {
                        alert(
                          `Zapisano ${data.added.length} nowych stanowisk:\n\n${data.added.join("\n")}`
                        );
                        setPersonaCriteria((prev: any) => {
                          if (!prev) {
                            return prev;
                          }
                          const existing = new Set(
                            (prev.positiveRoles ?? [])
                              .map((role: any) => (role?.label ? role.label.toLowerCase() : null))
                              .filter(Boolean)
                          );
                          const updatedRoles = [...(prev.positiveRoles ?? [])];
                          data.added.forEach((label: string) => {
                            const normalized = label.toLowerCase();
                            if (!existing.has(normalized)) {
                              updatedRoles.push({
                                label,
                                matchType: "contains",
                                keywords: [label],
                                departments: [],
                                confidence: 0.8,
                              });
                            }
                          });
                          return {
                            ...prev,
                            positiveRoles: updatedRoles,
                          };
                        });
                       } else {
                         alert("Wszystkie wybrane stanowiska były już zapisane.");
                       }

                       await loadPersonas();
                    } catch (error) {
                      alert(
                        "Błąd zapisywania stanowisk: " +
                          (error instanceof Error ? error.message : String(error))
                      );
                    } finally {
                      setSavingTitles(false);
                    }
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: savingTitles ? "#6EE7B7" : "#10B981",
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: savingTitles ? "not-allowed" : "pointer",
                    fontWeight: "500",
                  }}
                  disabled={savingTitles}
                >
                  {savingTitles ? "Zapisuję..." : "Zapisz wybrane stanowiska"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

