"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCompanyStats } from "@/hooks/useCompanyStats";
import { CompanyPreview } from "@/types/company-selection";

export default function CompanySelectionPage() {
  const { stats, loading, error: statsError, refetch: refetchStats } = useCompanyStats();
  const [costs, setCosts] = useState<{
    module: {
      summary: {
        totalCalls: number;
        totalCostPLN: number;
        totalCostUSD: number;
      };
    };
    application: {
      totalCostPLN: number;
      totalCostUSD: number;
      modulePercentage: number;
    };
  } | null>(null);
  const [costsPeriod, setCostsPeriod] = useState<"today" | "week" | "month" | "all">("today");

  useEffect(() => {
    loadCosts();
  }, [costsPeriod]);

  const loadCosts = async () => {
    try {
      const response = await fetch(`/api/company-selection/costs?period=${costsPeriod}`);
      const data = await response.json();
      if (data.module && data.application) {
        setCosts(data);
      }
    } catch (error) {
      console.error("Błąd ładowania kosztów:", error);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "2rem" }}>
        Moduł Wyboru Leadów
      </h1>

      {/* Błąd ładowania statystyk */}
      {statsError && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#FEE2E2",
            border: "1px solid #FCA5A5",
            color: "#B91C1C",
            borderRadius: "0.5rem",
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{statsError}</span>
          <button
            onClick={refetchStats}
            style={{
              marginLeft: "1rem",
              padding: "0.5rem 1rem",
              backgroundColor: "#EF4444",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {/* Statystyki */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard
          title="Do weryfikacji"
          value={stats.pending}
          color="#3B82F6"
          loading={loading}
        />
        <StatCard
          title="Zakwalifikowane"
          value={stats.qualified}
          color="#10B981"
          loading={loading}
        />
        <StatCard
          title="Odrzucone"
          value={stats.rejected}
          color="#EF4444"
          loading={loading}
        />
        <StatCard
          title="Wymagają przeglądu"
          value={stats.needsReview}
          color="#F59E0B"
          loading={loading}
        />
        <StatCard
          title="Wszystkie"
          value={stats.total}
          color="#6B7280"
          loading={loading}
        />
      </div>

      {/* Akcje */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/company-selection/import"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#2563EB",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Import CSV
        </Link>
        <Link
          href="/company-selection/import-mass"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#2563EB",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Masowy import CSV
        </Link>
        <Link
          href="/company-selection/classify"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#F59E0B",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Klasyfikacja AI
        </Link>
        <Link
          href="/company-selection/verify"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#10B981",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Weryfikacja ({stats.total} firm)
        </Link>
        <Link
          href="/company-selection/criteria"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#8B5CF6",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Kryteria weryfikacji
        </Link>
        <Link
          href="/company-selection/personas"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#1D4ED8",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Persony (Agenda AI)
        </Link>
        <Link
          href="/company-selection/logs"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#6B7280",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Logi
        </Link>
      </div>

      {/* Koszty AI */}
      {costs && (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            marginBottom: "2rem",
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
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Koszty AI</h2>
            <select
              value={costsPeriod}
              onChange={(e) =>
                setCostsPeriod(
                  e.target.value as "today" | "week" | "month" | "all"
                )
              }
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.875rem",
              }}
            >
              <option value="today">Dzisiaj</option>
              <option value="week">Ostatnie 7 dni</option>
              <option value="month">Ten miesiąc</option>
              <option value="all">Wszystkie</option>
            </select>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#F3F4F6",
                borderRadius: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "#6B7280",
                  marginBottom: "0.5rem",
                }}
              >
                Koszt modułu
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#3B82F6",
                }}
              >
                {costs.module.summary.totalCostPLN.toFixed(2)} PLN
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#6B7280",
                  marginTop: "0.25rem",
                }}
              >
                ${costs.module.summary.totalCostUSD.toFixed(4)} USD
              </div>
            </div>

            <div
              style={{
                padding: "1rem",
                backgroundColor: "#F3F4F6",
                borderRadius: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "#6B7280",
                  marginBottom: "0.5rem",
                }}
              >
                Wywołań AI
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#6B7280",
                }}
              >
                {costs.module.summary.totalCalls}
              </div>
            </div>

            <div
              style={{
                padding: "1rem",
                backgroundColor: "#F3F4F6",
                borderRadius: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "#6B7280",
                  marginBottom: "0.5rem",
                }}
              >
                Koszt całej aplikacji
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#10B981",
                }}
              >
                {costs.application.totalCostPLN.toFixed(2)} PLN
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#6B7280",
                  marginTop: "0.25rem",
                }}
              >
                Moduł: {costs.application.modulePercentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista firm - szybki podgląd */}
      {stats.total > 0 && (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
            Ostatnie zaimportowane firmy
          </h2>
          <CompanyListPreview />
        </div>
      )}

      {/* Informacja o konfiguracji */}
      <div
        style={{
          padding: "1rem",
          backgroundColor: "#F3F4F6",
          borderRadius: "0.5rem",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
          Jak zacząć?
        </h2>
        <ol style={{ marginLeft: "1.5rem", lineHeight: "1.8" }}>
          <li>
            <strong>Utwórz kryteria weryfikacji</strong> - Użyj czatu z agentem
            AI, aby określić, jakich firm szukasz
          </li>
          <li>
            <strong>Importuj CSV</strong> - Załaduj listę firm z pliku CSV
          </li>
          <li>
            <strong>Weryfikuj</strong> - Uruchom weryfikację AI dla zaimportowanych firm
          </li>
          <li>
            <strong>Przeglądaj wyniki</strong> - Sprawdź zakwalifikowane firmy
            i te wymagające przeglądu
          </li>
        </ol>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
  loading,
}: {
  title: string;
  value: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div
      style={{
        padding: "1.5rem",
        backgroundColor: "white",
        borderRadius: "0.5rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.5rem" }}>
        {title}
      </div>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: "bold",
          color: color,
        }}
      >
        {loading ? "..." : value.toLocaleString()}
      </div>
    </div>
  );
}

function CompanyListPreview() {
  const [companies, setCompanies] = useState<CompanyPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await fetch("/api/company-selection/list?limit=10");
        const data = await response.json();
        setCompanies(data.companies || []);
      } catch (error) {
        console.error("Błąd ładowania firm:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCompanies();
  }, []);

  if (loading) {
    return <div>Ładowanie...</div>;
  }

  if (companies.length === 0) {
    return <div style={{ color: "#6B7280" }}>Brak firm w bazie</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "QUALIFIED":
        return "#10B981";
      case "REJECTED":
        return "#EF4444";
      case "NEEDS_REVIEW":
        return "#F59E0B";
      case "PENDING":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  return (
    <div>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {companies.map((company) => (
          <div
            key={company.id}
            style={{
              padding: "0.75rem",
              backgroundColor: "#F9FAFB",
              borderRadius: "0.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: "500" }}>{company.name}</div>
              {company.industry && (
                <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                  {company.industry}
                </div>
              )}
            </div>
            <span
              style={{
                padding: "0.25rem 0.75rem",
                borderRadius: "0.25rem",
                backgroundColor: getStatusColor(company.verificationStatus),
                color: "white",
                fontSize: "0.75rem",
                fontWeight: "500",
              }}
            >
              {company.verificationStatus}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/company-selection/verify"
        style={{
          display: "inline-block",
          marginTop: "1rem",
          color: "#3B82F6",
          textDecoration: "none",
          fontSize: "0.875rem",
        }}
      >
        Zobacz wszystkie firmy →
      </Link>
    </div>
  );
}

