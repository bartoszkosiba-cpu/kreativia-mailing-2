"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PersonaRole = {
  label: string;
  matchType?: string;
  keywords?: string[];
  departments?: string[];
  minSeniority?: string;
  confidence?: number;
};

type PersonaConditionalRule = {
  rule: "include" | "exclude";
  whenAll?: string[];
  whenAny?: string[];
  unless?: string[];
  notes?: string;
};

type PersonaCriteriaInfo = {
  id: number;
  companyCriteriaId: number;
  name: string;
  description?: string | null;
  language?: string | null;
  positiveRoles: PersonaRole[];
  negativeRoles: PersonaRole[];
  conditionalRules: PersonaConditionalRule[];
};

type Company = {
  id: number;
  name: string;
  industry?: string | null;
  country?: string | null;
  verificationStatus?: string;
  city?: string | null;
};

type Recommendation = {
  id: number;
  campaignId: number;
  companyId: number;
  fullName: string;
  title: string;
  email?: string | null;
  status: string;
  confidence?: number | null;
  reasoning?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "all" | "suggested" | "approved" | "email_fetched" | "rejected";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Wszystkie",
  suggested: "Sugestie",
  approved: "Zatwierdzone",
  email_fetched: "Email pobrany",
  rejected: "Odrzucone",
};

interface CampaignAgendaTabProps {
  campaignId: number;
  personaCriteria: PersonaCriteriaInfo | null;
}

const formatConfidence = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
};

const parseMetadata = (raw: unknown): Record<string, unknown> | null => {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
};

export default function CampaignAgendaTab({ campaignId, personaCriteria }: CampaignAgendaTabProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [generationLimit, setGenerationLimit] = useState(25);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("suggested");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  useEffect(() => {
    setCompaniesLoading(true);
    fetch(`/api/company-selection/list?status=QUALIFIED&limit=200`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data.companies) ? data.companies : [];
        setCompanies(list);
        if (list.length > 0) {
          setSelectedCompanyId((current) => current ?? list[0].id);
        }
      })
      .catch((err) => {
        console.error("[Agenda] Błąd pobierania firm", err);
        setError("Nie udało się pobrać listy firm");
      })
      .finally(() => setCompaniesLoading(false));
  }, []);

  useEffect(() => {
    loadRecommendations(statusFilter);
  }, [campaignId, statusFilter]);

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return companies;
    return companies.filter((company) => company.name.toLowerCase().includes(query));
  }, [companies, companySearch]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const loadRecommendations = async (status: StatusFilter) => {
    try {
      setRecommendationsLoading(true);
      setError(null);

      const query = new URLSearchParams({ campaignId: String(campaignId) });
      if (status !== "all") {
        query.set("status", status);
      }

      const response = await fetch(`/api/agenda/recommendations?${query.toString()}`);
      const data = await response.json();

      if (!data.success) {
        setRecommendations([]);
        setError(data.error || "Nie udało się pobrać rekomendacji");
        return;
      }

      const list: Recommendation[] = (data.data ?? []).map((item: any) => ({
        id: item.id,
        campaignId: item.campaignId,
        companyId: item.companyId,
        fullName: item.fullName,
        title: item.title,
        email: item.email ?? null,
        status: item.status,
        confidence: item.confidence ?? null,
        reasoning: item.reasoning ?? null,
        sourceUrl: item.sourceUrl ?? null,
        metadata: parseMetadata(item.metadata ?? null),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));

      setRecommendations(list);
    } catch (err) {
      console.error("[Agenda] Błąd pobierania rekomendacji", err);
      setError("Nie udało się pobrać rekomendacji");
      setRecommendations([]);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!personaCriteria) {
      alert("Najpierw skonfiguruj persony w module Company Selection → Persony (Agenda AI).");
      return;
    }

    if (!selectedCompanyId) {
      alert("Wybierz firmę, dla której chcesz otrzymać rekomendacje osób.");
      return;
    }

    setGenerationLoading(true);
    try {
      const payload = {
        campaignId,
        companyId: selectedCompanyId,
        personaCriteriaId: personaCriteria.companyCriteriaId,
        limit: Number.isFinite(generationLimit) ? generationLimit : 25,
      };

      const response = await fetch(`/api/agenda/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || "Nie udało się wygenerować rekomendacji");
        return;
      }

      await loadRecommendations(statusFilter);
      alert(
        `Dodano ${data.data?.created ?? 0} nowych rekomendacji. ${data.data?.existing ?? 0} już istniało, pominięto ${data.data?.skipped ?? 0}.`
      );
    } catch (err) {
      console.error("[Agenda] Błąd generowania", err);
      alert("Wystąpił błąd podczas generowania rekomendacji");
    } finally {
      setGenerationLoading(false);
    }
  };

  const handleDecision = async (id: number, status: "approved" | "rejected") => {
    setActionLoadingId(id);
    try {
      const response = await fetch(`/api/agenda/recommendations/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || "Nie udało się zaktualizować statusu");
        return;
      }

      await loadRecommendations(statusFilter);
    } catch (err) {
      console.error("[Agenda] Błąd aktualizacji", err);
      alert("Wystąpił błąd podczas aktualizacji rekomendacji");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleFetchEmail = async (id: number) => {
    setActionLoadingId(id);
    try {
      const response = await fetch(`/api/agenda/recommendations/${id}/fetch-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedBy: "admin" }),
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || "Nie udało się pobrać adresu email");
        return;
      }

      await loadRecommendations(statusFilter);
      if (data.data?.email) {
        alert(`Adres email: ${data.data.email}`);
      }
    } catch (err) {
      console.error("[Agenda] Błąd pobierania emaila", err);
      alert("Wystąpił błąd podczas pobierania emaila");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!personaCriteria) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "white",
          borderRadius: "0.75rem",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Brak zdefiniowanych person</h2>
        <p style={{ color: "#6B7280", marginBottom: "1.5rem" }}>
          Aby korzystać z Agenda AI, najpierw skonfiguruj persony w module Company Selection.
        </p>
        <Link
          href="/company-selection/personas"
          target="_blank"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#1D4ED8",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
          }}
        >
          Otwórz konfigurację person
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section
        style={{
          padding: "1.75rem",
          backgroundColor: "white",
          borderRadius: "0.75rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{personaCriteria.name}</h2>
            {personaCriteria.description && (
              <p style={{ color: "#6B7280", marginBottom: "0.75rem", maxWidth: "560px" }}>{personaCriteria.description}</p>
            )}
            <div style={{ display: "flex", gap: "1.5rem", color: "#4B5563", fontSize: "0.95rem" }}>
              <span><strong>Pozytywne:</strong> {personaCriteria.positiveRoles.length}</span>
              <span><strong>Negatywne:</strong> {personaCriteria.negativeRoles.length}</span>
              {personaCriteria.language && <span><strong>Język:</strong> {personaCriteria.language}</span>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Link
              href="/company-selection/personas"
              target="_blank"
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#3B82F6",
                color: "white",
                borderRadius: "0.5rem",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Edytuj persony
            </Link>
            <span style={{ fontSize: "0.8rem", color: "#6B7280", textAlign: "center", maxWidth: "180px" }}>
              Otwiera nową kartę z modułem Company Selection
            </span>
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "1.75rem",
          backgroundColor: "white",
          borderRadius: "0.75rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontWeight: 600 }}>Wybierz firmę</label>
            <input
              type="text"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Szukaj firmy po nazwie"
              style={{ padding: "0.6rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
            />
            <select
              value={selectedCompanyId ?? ""}
              onChange={(e) => setSelectedCompanyId(Number(e.target.value) || null)}
              disabled={companiesLoading}
              style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
            >
              {filteredCompanies.length === 0 && <option value="">Brak firm</option>}
              {filteredCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontWeight: 600 }}>Liczba rekomendacji</label>
            <input
              type="number"
              min={1}
              max={200}
              value={generationLimit}
              onChange={(e) => setGenerationLimit(Number(e.target.value) || 25)}
              style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
            />
            <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>Domyślnie 25 propozycji</span>
          </div>

          {selectedCompany && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                fontSize: "0.9rem",
              }}
            >
              <div><strong>{selectedCompany.name}</strong></div>
              {selectedCompany.industry && <div>Branża: {selectedCompany.industry}</div>}
              {selectedCompany.country && <div>Kraj: {selectedCompany.country}</div>}
              {selectedCompany.city && <div>Miasto: {selectedCompany.city}</div>}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={handleGenerate}
            disabled={generationLoading || companiesLoading}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: generationLoading ? "#9CA3AF" : "#10B981",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: generationLoading ? "not-allowed" : "pointer",
              fontSize: "1rem",
            }}
          >
            {generationLoading ? "Generowanie..." : "Generuj rekomendacje"}
          </button>
        </div>
      </section>

      <section
        style={{
          padding: "1.75rem",
          backgroundColor: "white",
          borderRadius: "0.75rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <h3 style={{ fontSize: "1.25rem", margin: 0 }}>Rekomendacje osób</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: "9999px",
                  border: statusFilter === status ? "1px solid transparent" : "1px solid #E5E7EB",
                  backgroundColor: statusFilter === status ? "#3B82F6" : "#F9FAFB",
                  color: statusFilter === status ? "white" : "#374151",
                  cursor: "pointer",
                }}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ padding: "1rem", borderRadius: "0.5rem", backgroundColor: "#FEF2F2", color: "#B91C1C" }}>{error}</div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", backgroundColor: "#F3F4F6" }}>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Osoba</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Stanowisko</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Firma</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Status</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Pewność</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB", minWidth: "180px" }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {recommendationsLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "1.5rem", textAlign: "center", color: "#6B7280" }}>
                    Ładowanie rekomendacji...
                  </td>
                </tr>
              ) : recommendations.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "1.5rem", textAlign: "center", color: "#6B7280" }}>
                    Brak rekomendacji dla wybranego filtra.
                  </td>
                </tr>
              ) : (
                recommendations.map((rec) => {
                  const company = companies.find((company) => company.id === rec.companyId);
                  return (
                    <tr key={rec.id} style={{ borderBottom: "1px solid #E5E7EB" }}>
                      <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>{rec.fullName}</div>
                        {rec.email && <div style={{ fontSize: "0.9rem", color: "#2563EB" }}>{rec.email}</div>}
                        {rec.sourceUrl && (
                          <div style={{ marginTop: "0.25rem" }}>
                            <a href={rec.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", color: "#3B82F6" }}>
                              Profil źródłowy
                            </a>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                        <div>{rec.title}</div>
                        {rec.reasoning && <div style={{ fontSize: "0.85rem", color: "#6B7280", marginTop: "0.4rem" }}>{rec.reasoning}</div>}
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                        <div>{company ? company.name : `ID ${rec.companyId}`}</div>
                        {company?.industry && <div style={{ fontSize: "0.85rem", color: "#6B7280" }}>{company.industry}</div>}
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.6rem",
                            borderRadius: "9999px",
                            backgroundColor:
                              rec.status === "approved"
                                ? "#DCFCE7"
                                : rec.status === "rejected"
                                ? "#FEE2E2"
                                : rec.status === "email_fetched"
                                ? "#DBEAFE"
                                : "#F5F3FF",
                            color:
                              rec.status === "approved"
                                ? "#15803D"
                                : rec.status === "rejected"
                                ? "#B91C1C"
                                : rec.status === "email_fetched"
                                ? "#1D4ED8"
                                : "#6C2BD9",
                            fontSize: "0.8rem",
                          }}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "top" }}>{formatConfidence(rec.confidence)}</td>
                      <td style={{ padding: "0.75rem", verticalAlign: "top" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          <button
                            onClick={() => handleDecision(rec.id, "approved")}
                            disabled={actionLoadingId === rec.id}
                            style={{
                              padding: "0.45rem 0.75rem",
                              backgroundColor: "#10B981",
                              color: "white",
                              border: "none",
                              borderRadius: "0.35rem",
                              cursor: actionLoadingId === rec.id ? "not-allowed" : "pointer",
                              fontSize: "0.85rem",
                            }}
                          >
                            Zatwierdź
                          </button>
                          <button
                            onClick={() => handleDecision(rec.id, "rejected")}
                            disabled={actionLoadingId === rec.id}
                            style={{
                              padding: "0.45rem 0.75rem",
                              backgroundColor: "#EF4444",
                              color: "white",
                              border: "none",
                              borderRadius: "0.35rem",
                              cursor: actionLoadingId === rec.id ? "not-allowed" : "pointer",
                              fontSize: "0.85rem",
                            }}
                          >
                            Odrzuć
                          </button>
                          <button
                            onClick={() => handleFetchEmail(rec.id)}
                            disabled={actionLoadingId === rec.id || rec.status !== "approved"}
                            style={{
                              padding: "0.45rem 0.75rem",
                              backgroundColor: actionLoadingId === rec.id || rec.status !== "approved" ? "#9CA3AF" : "#2563EB",
                              color: "white",
                              border: "none",
                              borderRadius: "0.35rem",
                              cursor:
                                actionLoadingId === rec.id || rec.status !== "approved"
                                  ? "not-allowed"
                                  : "pointer",
                              fontSize: "0.85rem",
                            }}
                          >
                            Pobierz email
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


