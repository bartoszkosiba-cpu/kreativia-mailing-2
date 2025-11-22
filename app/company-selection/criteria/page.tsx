"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Criteria {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  selection?: {
    id: number;
    name: string;
  } | null;
}

const cardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.75rem",
  padding: "1.5rem",
  borderRadius: "0.75rem",
  border: "1px solid #E5E7EB",
  backgroundColor: "white",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
  minHeight: "180px",
};

const titlePrimaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
  padding: "0.7rem 1.1rem",
  borderRadius: "0.65rem",
  backgroundColor: "#2563EB",
  color: "white",
  fontWeight: 700,
  fontSize: "1.05rem",
  textDecoration: "none",
};

const titleSecondaryLinkStyle = {
  ...titlePrimaryLinkStyle,
  backgroundColor: "#4B5563",
};

const gridStyle = {
  display: "grid",
  gap: "1.25rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const breadcrumbsStyle = {
  fontSize: "0.85rem",
  color: "#6B7280",
  marginBottom: "0.5rem",
};

const headingStyle = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#111827",
  marginBottom: "0.75rem",
};

const introStyle = {
  fontSize: "1rem",
  lineHeight: 1.6,
  color: "#374151",
  marginBottom: "1.75rem",
  maxWidth: "720px",
};

export default function CriteriaListPage() {
  const router = useRouter();
  const [criteriaList, setCriteriaList] = useState<Criteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCriteria();
  }, []);

  const loadCriteria = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/company-selection/criteria");
      const data = await response.json();
      if (data.success && Array.isArray(data.criteria)) {
        setCriteriaList(data.criteria);
      }
    } catch (error) {
      console.error("Błąd ładowania kryteriów:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async () => {
    setCreating(true);
    try {
      // Sprawdź czy domyślna nazwa już istnieje
      const checkResponse = await fetch("/api/company-selection/criteria");
      const checkData = await checkResponse.json();
      let newName = "Nowe kryteria weryfikacji";
      if (checkData.success && Array.isArray(checkData.criteria)) {
        let counter = 1;
        while (checkData.criteria.some((c: { name: string }) => c.name === newName)) {
          newName = `Nowe kryteria weryfikacji ${counter}`;
          counter++;
        }
      }

      // Utwórz nowe puste kryterium
      const response = await fetch("/api/company-selection/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: "",
          criteriaText: "Wpisz kryteria weryfikacji firm...",
          qualifiedThreshold: 0.8,
          rejectedThreshold: 0.3,
          isActive: true,
          isDefault: false,
        }),
      });

      const data = await response.json();
      if (data.success && data.criteria) {
        router.push(`/company-selection/criteria/${data.criteria.id}`);
      } else {
        alert("Błąd: " + (data.error || "Nie udało się utworzyć kryteriów"));
      }
    } catch (error) {
      console.error("Błąd tworzenia kryteriów:", error);
      alert("Błąd połączenia z serwerem");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div>Ładowanie...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
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
      <div>
        <div style={breadcrumbsStyle}>Ustawienia weryfikacji firm</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={headingStyle}>Kryteria weryfikacji firm</h1>
            <p style={introStyle}>
              Zarządzaj kryteriami weryfikacji firm. Każde kryterium definiuje, które firmy są odpowiednie do kampanii.
              Możesz utworzyć wiele kryteriów i przypisać je do różnych selekcji.
            </p>
          </div>
        <button
            onClick={handleCreateNew}
            disabled={creating}
          style={{
              padding: "0.7rem 1.1rem",
              borderRadius: "0.65rem",
              backgroundColor: "#4B5563",
              color: "white",
              fontWeight: 700,
              fontSize: "1.05rem",
            border: "none",
              cursor: creating ? "not-allowed" : "pointer",
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? "Tworzenie..." : "+ Utwórz nowe kryteria"}
        </button>
        </div>
      </div>

      <div
          style={{
          backgroundColor: "white",
          borderRadius: "0.75rem",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#F3F4F6" }}>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Nazwa
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Opis
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Selekcja
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Zaktualizowano
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Akcje
              </th>
            </tr>
          </thead>
          <tbody>
            {criteriaList.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
                  Brak kryteriów. Utwórz nowe kryteria, aby rozpocząć.
                </td>
              </tr>
            ) : (
              criteriaList.map((criteria, index) => (
                <tr
                  key={criteria.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? "white" : "#F9FAFB",
                    borderBottom: "1px solid #E5E7EB",
                  }}
                >
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB" }}>
                    <Link
                      href={`/company-selection/criteria/${criteria.id}`}
                      style={{
                        color: "#2563EB",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      {criteria.name}
                    </Link>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB", color: "#4B5563" }}>
                    {criteria.description || "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB" }}>
                    {criteria.selection ? (
                      <span
                        style={{
                          padding: "0.25rem 0.75rem",
                          borderRadius: "0.25rem",
                          backgroundColor: "#E5E7EB",
                          color: "#374151",
                          fontSize: "0.75rem",
                          whiteSpace: "nowrap",
                          display: "inline-block",
                        }}
                        title={criteria.selection.name}
                      >
                        {criteria.selection.name}
                      </span>
                    ) : (
                      <span style={{ color: "#9CA3AF" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB", color: "#6B7280", fontSize: "0.875rem" }}>
                    {new Date(criteria.updatedAt).toLocaleDateString("pl-PL", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB", textAlign: "right" }}>
                    <Link
                      href={`/company-selection/criteria/${criteria.id}`}
                        style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#2563EB",
                          color: "white",
                        borderRadius: "0.5rem",
                        textDecoration: "none",
                          fontSize: "0.875rem",
                        fontWeight: 500,
                        display: "inline-block",
                      }}
                    >
                      Otwórz
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
    </div>
  );
}
