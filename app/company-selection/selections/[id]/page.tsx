"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PreviewTable } from "../../components/PreviewTable";

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

  // EDIT MODE (reuse creator filters)
  type LanguageOption = "PL" | "EN" | "DE" | "FR";
  const [selectedSubSegments, setSelectedSubSegments] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageOption[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [onlyPrimary, setOnlyPrimary] = useState(true);
  const [minScore, setMinScore] = useState<number>(3);
  const [minConfidence, setMinConfidence] = useState<number>(0.6);
  const [previewCompanies, setPreviewCompanies] = useState<any[]>([]);
  const [previewTotals, setPreviewTotals] = useState<{ total: number; afterExclusions: number }>({ total: 0, afterExclusions: 0 });
  const [previewPage, setPreviewPage] = useState(1);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const PREVIEW_PAGE_SIZE = 50;
  const [saving, setSaving] = useState(false);
  const [specializations, setSpecializations] = useState<Array<{ code: string; label: string; companyClass: string }>>([]);
  const [excludeCompanyIds, setExcludeCompanyIds] = useState<Set<number>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"saved" | "filter">("saved"); // "saved" = zapisane firmy, "filter" = podgląd na podstawie filtrów
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPreviewInEdit, setShowPreviewInEdit] = useState(false);
  const [originalFilters, setOriginalFilters] = useState<{
    selectedSubSegments: string[];
    selectedLanguages: LanguageOption[];
    selectedBatchIds: number[];
    onlyPrimary: boolean;
    minScore: number;
    minConfidence: number;
  } | null>(null);

  useEffect(() => {
    async function loadSpecializations() {
      try {
        const response = await fetch("/api/company-selection/specializations");
        if (response.ok) {
          const data = await response.json();
          const list: Array<{ code: string; label: string; companyClass: string }> = Array.isArray(data?.specializations)
            ? data.specializations.map((s: any) => ({
                code: s.code,
                label: s.label,
                companyClass: s.companyClass,
              }))
            : [];
          setSpecializations(list);
        }
      } catch (error) {
        console.error("Błąd ładowania specjalizacji", error);
      }
    }
    loadSpecializations();
  }, []);

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

      const sel = data.selection ?? null;
      setSelection(sel);
      // Initialize edit filters from saved selection.filters if available
      try {
        const parsed = sel?.filters ? JSON.parse(sel.filters) : {};
        setSelectedSubSegments(Array.isArray(parsed?.specializationCodes) ? parsed.specializationCodes : []);
        setOnlyPrimary(Boolean(parsed?.onlyPrimary ?? true));
        if (typeof parsed?.minScore === "number") setMinScore(parsed.minScore);
        if (typeof parsed?.minConfidence === "number") setMinConfidence(parsed.minConfidence);
        setSelectedLanguages(
          Array.isArray(parsed?.languages)
            ? (parsed.languages.filter((l: any) => typeof l === "string") as LanguageOption[])
            : []
        );
        setSelectedBatchIds(
          Array.isArray(parsed?.importBatchIds)
            ? parsed.importBatchIds.filter((n: any) => Number.isFinite(Number(n))).map((n: any) => Number(n))
            : []
        );
        // Save original filter values for comparison
        setOriginalFilters({
          selectedSubSegments: Array.isArray(parsed?.specializationCodes) ? parsed.specializationCodes : [],
          selectedLanguages: Array.isArray(parsed?.languages)
            ? (parsed.languages.filter((l: any) => typeof l === "string") as LanguageOption[])
            : [],
          selectedBatchIds: Array.isArray(parsed?.importBatchIds)
            ? parsed.importBatchIds.filter((n: any) => Number.isFinite(Number(n))).map((n: any) => Number(n))
            : [],
          onlyPrimary: Boolean(parsed?.onlyPrimary ?? true),
          minScore: typeof parsed?.minScore === "number" ? parsed.minScore : 3,
          minConfidence: typeof parsed?.minConfidence === "number" ? parsed.minConfidence : 0.6,
        });
        // Load saved companies (not preview based on filters)
        if (sel) {
          await loadSavedCompanies(1);
        }
      } catch {
        // ignore parse errors, but still try to load saved companies if selection exists
        if (sel) {
          await loadSavedCompanies(1);
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Błąd pobierania selekcji");
    } finally {
      setLoading(false);
    }
  };

  const loadSavedCompanies = async (page = previewPage) => {
    if (!selectionId) return;
    try {
      setPreviewLoading(true);
      const url = new URL(window.location.origin + `/api/company-selection/selections/${selectionId}`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(PREVIEW_PAGE_SIZE));
      const response = await fetch(url.toString());
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.details || "Błąd pobierania firm");
      }
      const total = data.pagination?.total ?? 0;
      setPreviewTotals({ total, afterExclusions: total });
      setPreviewCompanies(data.preview ?? []);
      setPreviewTotalPages(data.pagination?.totalPages ?? 1);
      setPreviewPage(page);
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreview = async (page = previewPage, selOverride?: SelectionDetails | null) => {
    const sel = selOverride ?? selection;
    if (!sel) return;
    try {
      setPreviewLoading(true);
      const response = await fetch("/api/company-selection/selections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sel.name,
          language: sel.language,
          market: sel.market,
          dryRun: true,
          page,
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
      setPreviewTotals({ total: data.totalMatches ?? 0, afterExclusions: data.totalAfterExclusions ?? 0 });
      setPreviewCompanies(data.preview ?? []);
      setPreviewTotalPages(data.totalPages ?? 1);
      setPreviewPage(page);
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
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

  // Auto-refresh disabled - show saved companies by default, use "Odśwież podgląd" button for filter-based preview

  const hasChanges = (): boolean => {
    return excludeCompanyIds.size > 0;
  };

  const handleSave = async () => {
    if (!selection) return;
    try {
      setSaving(true);
      // Parse current filters to keep them unchanged
      const parsed = selection.filters ? JSON.parse(selection.filters) : {};
      const response = await fetch(`/api/company-selection/selections/${selection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: selection.market,
          language: selection.language,
          filters: {
            specializationCodes: Array.isArray(parsed?.specializationCodes) ? parsed.specializationCodes : [],
            onlyPrimary: Boolean(parsed?.onlyPrimary ?? true),
            minScore: typeof parsed?.minScore === "number" ? parsed.minScore : 3,
            minConfidence: typeof parsed?.minConfidence === "number" ? parsed.minConfidence : 0.6,
            languages: Array.isArray(parsed?.languages) ? parsed.languages : [],
            importBatchIds: Array.isArray(parsed?.importBatchIds) ? parsed.importBatchIds : [],
          },
          excludeCompanyIds: Array.from(excludeCompanyIds),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.details || "Błąd zapisu selekcji");
      }
      setExcludeCompanyIds(new Set());
      setIsEditMode(false);
      await loadSelection(selection.id, pagination.page, statusFilter, searchQuery);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selection) return;
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć selekcję "${selection.name}"? Ta operacja jest nieodwracalna i usunie wszystkie powiązane dane.`
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/company-selection/selections/${selection.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.details || "Nie udało się usunąć selekcji");
      }
      router.push("/company-selection/selections");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd usuwania selekcji");
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
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
                onClick={handleDelete}
                style={{
                  padding: "0.65rem 1rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #DC2626",
                  color: "#FFFFFF",
                  backgroundColor: "#DC2626",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Usuń selekcję
              </button>
            </div>
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

      {/* Edit mode: only exclude companies */}
      {!isEditMode ? (
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => {
              setIsEditMode(true);
              setExcludeCompanyIds(new Set());
            }}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #2563EB",
              backgroundColor: "white",
              color: "#2563EB",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Edytuj
          </button>
        </div>
      ) : (
        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => {
              setIsEditMode(false);
              setExcludeCompanyIds(new Set());
            }}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #D1D5DB",
              backgroundColor: "white",
              color: "#374151",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Anuluj
          </button>
          {excludeCompanyIds.size > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selection}
              style={{
                padding: "0.55rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: saving ? "#6EE7B7" : "#10B981",
                color: "white",
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Zapisuję..." : "Zapisz"}
            </button>
          )}
        </div>
      )}

      {previewCompanies.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem", color: "#111827" }}>
            Zapisane firmy ({previewTotals.afterExclusions})
          </h2>
          {isEditMode && (
            <p style={{ marginBottom: "1rem", color: "#4B5563", fontSize: "0.9rem" }}>
              Zaznacz firmy, które chcesz wykluczyć z selekcji, a następnie kliknij "Zapisz".
            </p>
          )}
          <PreviewTable
            companies={previewCompanies as any}
            total={previewTotals.total}
            totalAfterExclusions={previewTotals.afterExclusions}
            page={previewPage}
            totalPages={previewTotalPages}
            pageSize={PREVIEW_PAGE_SIZE}
            onChangePage={async (p) => {
              await loadSavedCompanies(p);
            }}
            specializations={specializations}
            excludeCompanyIds={excludeCompanyIds}
            onToggleExclude={toggleExclude}
            showExcludeButtons={isEditMode}
          />
        </div>
      )}
    </div>
  );
}


