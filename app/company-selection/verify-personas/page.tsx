"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SelectionItem {
  id: number;
  name: string;
  totalCompanies: number;
  createdAt: string;
  updatedAt: string;
  verificationStats?: {
    pending: number;
    qualified: number;
    rejected: number;
    needsReview: number;
    blocked: number;
    total: number;
  };
  lastVerificationAt?: string | null;
}

export default function VerifyPersonasSelectionsPage() {
  const router = useRouter();
  const [selections, setSelections] = useState<SelectionItem[]>([]);
  const [selectionsLoading, setSelectionsLoading] = useState(false);

  useEffect(() => {
    loadSelections();
  }, []);

  const loadSelections = async () => {
    try {
      setSelectionsLoading(true);
      // Pobierz informacje z statystykami weryfikacji (bez kryteriów) - szybsze
      const response = await fetch("/api/company-selection/selections?limit=200&includeCriteria=false");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.selections) {
        setSelections(
          data.selections.map((sel: any) => ({
            id: sel.id,
            name: sel.name,
            totalCompanies: sel.totalCompanies || 0,
            createdAt: sel.createdAt,
            updatedAt: sel.updatedAt,
            verificationStats: sel.verificationStats,
            lastVerificationAt: sel.lastVerificationAt,
        }))
      );
      }
    } catch (error) {
      console.error("Błąd ładowania selekcji:", error);
    } finally {
      setSelectionsLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("pl-PL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <Link
        href="/company-selection/processes/verification"
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
        ← Powrót do procesu weryfikacji
      </Link>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Weryfikacja person</h1>
            <p style={{ color: "#4B5563", maxWidth: "640px" }}>
              Wybierz selekcję do weryfikacji person. Poniżej wyświetlane są firmy pozostałe do weryfikacji person (status PENDING) lub wszystkie firmy, jeśli weryfikacja firm nie została jeszcze przeprowadzona.
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
        {selectionsLoading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
            Ładowanie selekcji...
          </div>
        ) : selections.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
            Brak dostępnych selekcji. Utwórz nową selekcję, aby rozpocząć weryfikację person.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "0.5rem",
            }}
          >
            {selections.map((sel) => {
              const stats = sel.verificationStats;
              const hasVerification = stats && (stats.qualified > 0 || stats.rejected > 0 || stats.needsReview > 0);
              // Filtrujemy po "Pozostało" - jeśli była weryfikacja, to PENDING, jeśli nie, to wszystkie
              const remainingForPersonas = stats ? stats.pending : sel.totalCompanies;
              
              return (
                <button
                  key={sel.id}
                  type="button"
                  onClick={() => router.push(`/company-selection/verify-personas/${sel.id}`)}
                  style={{
                    width: "100%",
                    height: "80px",
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    border: "none",
                    borderBottom: "1px solid #E5E7EB",
                    backgroundColor: "white",
                    color: "#111827",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: 400,
                    transition: "background-color 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#F9FAFB";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "white";
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sel.name}
                      </div>
                      <div style={{ 
                        padding: "0.2rem 0.5rem", 
                        borderRadius: "0.25rem",
                        backgroundColor: hasVerification ? "#D1FAE5" : "#DBEAFE",
                        color: hasVerification ? "#047857" : "#1D4ED8",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}>
                        {hasVerification ? "Zweryfikowana" : "Do weryfikacji"}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#6B7280", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <span>Utworzono: {formatDate(sel.createdAt)}</span>
                      {hasVerification && sel.lastVerificationAt && (
                        <span>• Ostatnia weryfikacja: {formatDate(sel.lastVerificationAt)}</span>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexShrink: 0, fontSize: "0.8rem" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "#6B7280", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Łącznie</div>
                      <div style={{ fontWeight: 700, color: "#111827", fontSize: "0.95rem" }}>{sel.totalCompanies}</div>
                    </div>
                    {stats ? (
                      <>
                        <div style={{ width: "1px", height: "40px", backgroundColor: "#E5E7EB" }} />
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#6B7280", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Zakwal.</div>
                          <div style={{ fontWeight: 700, color: "#047857", fontSize: "0.95rem" }}>{stats.qualified}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#6B7280", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Odrzucone</div>
                          <div style={{ fontWeight: 700, color: "#B91C1C", fontSize: "0.95rem" }}>{stats.rejected}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#6B7280", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Przegląd</div>
                          <div style={{ fontWeight: 700, color: "#B45309", fontSize: "0.95rem" }}>{stats.needsReview}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#6B7280", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Do weryfikacji person</div>
                          <div style={{ fontWeight: 700, color: "#1D4ED8", fontSize: "0.95rem" }}>{remainingForPersonas}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ width: "1px", height: "40px", backgroundColor: "#E5E7EB" }} />
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#6B7280", fontSize: "0.7rem", marginBottom: "0.15rem" }}>Do weryfikacji person</div>
                          <div style={{ fontWeight: 700, color: "#1D4ED8", fontSize: "0.95rem" }}>{remainingForPersonas}</div>
                        </div>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

