"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type SelectionDetails = {
  id: number;
  name: string;
  description?: string | null;
  market: string;
  language?: string | null;
  totalCompanies: number;
  activeCompanies: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

type SelectionCompany = {
  id: number;
  companyId: number;
  status: string;
  score: number | null;
  reason: string | null;
  verifiedAt: string | null;
  updatedAt: string;
  notes: string | null;
  company: {
    id: number;
    name: string;
    industry: string | null;
    market: string | null;
    classificationClass: string | null;
    classificationSubClass: string | null;
    verificationStatus: string | null;
    verificationScore: number | null;
    importBatch: {
      id: number;
      name: string;
      language: string;
      market: string;
    } | null;
  };
};

type SelectionStatsItem = {
  status: string;
  count: number;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.75rem",
  border: "1px solid #D1D5DB",
  borderRadius: "0.5rem",
  fontSize: "0.9rem",
};

const statusBadgeStyle: Record<string, CSSProperties> = {
  QUALIFIED: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
  },
  REJECTED: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },
  PENDING: {
    backgroundColor: "#E0F2FE",
    color: "#1E3A8A",
  },
  NEEDS_REVIEW: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
};

const getStatusStyle = (status: string): CSSProperties => {
  return (
    statusBadgeStyle[status] ?? {
      backgroundColor: "#E5E7EB",
      color: "#1F2937",
    }
  );
};

export default function SelectionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const selectionId = useMemo(() => {
    const raw = params?.id;
    if (!raw) return null;
    const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionDetails | null>(null);
  const [companies, setCompanies] = useState<SelectionCompany[]>([]);
  const [stats, setStats] = useState<SelectionStatsItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!selectionId) {
      setError("Niepoprawne ID selekcji");
      return;
    }
    loadSelection(selectionId, pagination.page, statusFilter, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionId, pagination.page, statusFilter]);

  const loadSelection = async (
    id: number,
    page: number,
    status: string,
    search: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const url = new URL(window.location.origin + `/api/company-selection/selections/${id}`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(pagination.limit));
      if (status && status !== "ALL") {
        url.searchParams.set("status", status);
      }
      if (search.trim()) {
        url.searchParams.set("search", search.trim());
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Błąd pobierania selekcji");
      }

      setSelection(data.selection ?? null);
      setCompanies(data.companies ?? []);
      setStats(data.stats ?? []);
      setPagination(data.pagination ?? pagination);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Błąd pobierania selekcji");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectionId) return;
    setPagination((prev) => ({ ...prev, page: 1 }));
    await loadSelection(selectionId, 1, statusFilter, searchQuery);
  };

  const handleRemoveCompany = async (companyId: number) => {
    if (!selectionId) return;
    const confirmed = window.confirm(
      "Czy na pewno chcesz usunąć tę firmę z selekcji? Operacja jest nieodwracalna."
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/company-selection/selections/${selectionId}/companies/${companyId}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Nie udało się usunąć firmy");
      }
      await loadSelection(selectionId, pagination.page, statusFilter, searchQuery);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Błąd usuwania firmy");
    }
  };

  const goToPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  if (!selectionId) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Niepoprawny identyfikator selekcji.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1280px", margin: "0 auto" }}>
      <Link
        href="/company-selection/selections"
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

      {error && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            backgroundColor: "#FEE2E2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
          }}
        >
          {error}
        </div>
      )}

      {selection && (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "0.75rem",
            border: "1px solid #E5E7EB",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                {selection.name}
              </h1>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.35rem 0.6rem",
                    borderRadius: "9999px",
                    backgroundColor: "#EFF6FF",
                    color: "#1E40AF",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                  }}
                >
                  {selection.market}
                  {selection.language ? ` • ${selection.language}` : ""}
                </span>
                <span style={{ color: "#6B7280", fontSize: "0.85rem" }}>
                  Utworzono: {new Date(selection.createdAt).toLocaleString("pl-PL")}
                </span>
                <span style={{ color: "#6B7280", fontSize: "0.85rem" }}>
                  Aktualizacja: {new Date(selection.updatedAt).toLocaleString("pl-PL")}
                </span>
              </div>
              {selection.description && (
                <p style={{ marginTop: "0.75rem", color: "#4B5563", maxWidth: "780px" }}>
                  {selection.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push(`/company-selection/criteria?id=${selection.id}`)}
              style={{
                padding: "0.65rem 1rem",
                borderRadius: "0.75rem",
                border: "1px solid #2563EB",
                color: "#2563EB",
                backgroundColor: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Przejdź do kryteriów AI
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              marginTop: "1.5rem",
            }}
          >
            <div
              style={{
                flex: "1 1 220px",
                backgroundColor: "#EFF6FF",
                borderRadius: "0.75rem",
                padding: "1rem",
              }}
            >
              <div style={{ color: "#1D4ED8", fontSize: "0.85rem", fontWeight: 600 }}>
                Firmy w selekcji
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1E40AF" }}>
                {selection.totalCompanies}
              </div>
              <div style={{ color: "#1D4ED8", fontSize: "0.85rem" }}>
                aktywnych: {selection.activeCompanies}
              </div>
            </div>

            {stats.map((item) => (
              <div
                key={item.status}
                style={{
                  flex: "1 1 180px",
                  backgroundColor: "white",
                  borderRadius: "0.75rem",
                  padding: "1rem",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div style={{ color: "#4B5563", fontSize: "0.85rem", fontWeight: 600 }}>
                  {item.status}
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{item.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #E5E7EB",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.25rem",
            alignItems: "center",
          }}
        >
          <form
            onSubmit={handleSearch}
            style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexGrow: 1 }}
          >
            <input
              type="text"
              placeholder="Szukaj po nazwie lub branży"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={inputStyle}
            />
            <button
              type="submit"
              style={{
                padding: "0.55rem 1rem",
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
          </form>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ ...inputStyle, maxWidth: "200px" }}
          >
            <option value="ALL">Wszystkie statusy</option>
            <option value="PENDING">PENDING</option>
            <option value="QUALIFIED">QUALIFIED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
            Ładuję firmy z selekcji...
          </div>
        ) : (
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
                  <th style={{ padding: "0.65rem", textAlign: "left" }}>Firma</th>
                  <th style={{ padding: "0.65rem", textAlign: "left" }}>Branża</th>
                  <th style={{ padding: "0.65rem", textAlign: "left" }}>Segment</th>
                  <th style={{ padding: "0.65rem", textAlign: "left" }}>Status</th>
                  <th style={{ padding: "0.65rem", textAlign: "left" }}>Import</th>
                  <th style={{ padding: "0.65rem", textAlign: "left" }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "1rem", textAlign: "center", color: "#6B7280" }}>
                      Brak firm spełniających kryteria.
                    </td>
                  </tr>
                )}
                {companies.map((membership) => (
                  <tr key={membership.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                    <td style={{ padding: "0.75rem" }}>
                      <div style={{ fontWeight: 600 }}>{membership.company.name}</div>
                      <div style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                        Rynek: {membership.company.market ?? "—"}
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem" }}>{membership.company.industry ?? "—"}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <div>{membership.company.classificationClass ?? "—"}</div>
                      {membership.company.classificationSubClass && (
                        <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>
                          {membership.company.classificationSubClass}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "9999px",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          ...getStatusStyle(membership.status),
                        }}
                      >
                        {membership.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      {membership.company.importBatch ? (
                        <div>
                          <div>{membership.company.importBatch.name}</div>
                          <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>
                            {membership.company.importBatch.language} • {membership.company.importBatch.market}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompany(membership.companyId)}
                        style={{
                          padding: "0.4rem 0.75rem",
                          borderRadius: "0.5rem",
                          border: "1px solid #DC2626",
                          backgroundColor: "white",
                          color: "#B91C1C",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Usuń z selekcji
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div
            style={{
              marginTop: "1.25rem",
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => goToPage(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                backgroundColor: "white",
                cursor: pagination.page === 1 ? "not-allowed" : "pointer",
              }}
            >
              Poprzednia
            </button>
            <span style={{ color: "#4B5563", fontSize: "0.9rem" }}>
              Strona {pagination.page} z {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(Math.min(pagination.totalPages, pagination.page + 1))}
              disabled={pagination.page >= pagination.totalPages}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                backgroundColor: "white",
                cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
              }}
            >
              Następna
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


