"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Persona {
  id: number;
  name: string;
  description: string | null;
  companyCriteriaId: number | null;
  companyCriteria?: {
    id: number;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

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

export default function PersonasListPage() {
  const router = useRouter();
  const [personasList, setPersonasList] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/company-selection/personas");
      const data = await response.json();
      if (data.success && Array.isArray(data.personas)) {
        // Dane są już posortowane po stronie serwera - nie trzeba sortować ponownie
        setPersonasList(data.personas);
      }
    } catch (error) {
      console.error("Błąd ładowania person:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async () => {
    setCreating(true);
    try {
      // Utwórz nową pustą personę
      const response = await fetch("/api/company-selection/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nowe persony weryfikacji",
          description: "",
          positiveRoles: [],
          negativeRoles: [],
          conditionalRules: [],
          language: "pl",
        }),
      });

      const data = await response.json();
      if (data.success && data.persona) {
        router.push(`/company-selection/personas/${data.persona.id}`);
      } else {
        alert("Błąd: " + (data.error || "Nie udało się utworzyć person"));
      }
    } catch (error) {
      console.error("Błąd tworzenia person:", error);
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
        <div style={breadcrumbsStyle}>Ustawienia weryfikacji person</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={headingStyle}>Kryteria weryfikacji person</h1>
            <p style={introStyle}>
              Zarządzaj kryteriami weryfikacji person. Każde kryterium definiuje, które stanowiska i osoby są odpowiednie do kontaktu w zakwalifikowanych firmach.
              Możesz utworzyć wiele konfiguracji person i przypisać je do różnych selekcji podczas weryfikacji.
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
            {creating ? "Tworzenie..." : "+ Utwórz nowe persony"}
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
              <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB", width: "60px" }}>
                #
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Nazwa
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Opis
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Kryteria firm
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Utworzono
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>
                Zaktualizowano
              </th>
            </tr>
          </thead>
          <tbody>
            {personasList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
                  Brak person. Utwórz nowe persony, aby rozpocząć.
                </td>
              </tr>
            ) : (
              personasList.map((persona, index) => {
                // Numeracja narastająca - najnowszy ma najwyższy numer
                const rowNumber = personasList.length - index;
                return (
                <tr
                  key={persona.id}
                  onClick={() => router.push(`/company-selection/personas/${persona.id}`)}
                  style={{
                    backgroundColor: index % 2 === 0 ? "white" : "#F9FAFB",
                    borderBottom: "1px solid #E5E7EB",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#F3F4F6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = index % 2 === 0 ? "white" : "#F9FAFB";
                  }}
                >
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB", textAlign: "center", color: "#6B7280", fontWeight: 500 }}>
                    {rowNumber}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB" }}>
                    <span
                      style={{
                        color: "#2563EB",
                        fontWeight: 600,
                      }}
                    >
                      {persona.name}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB", color: "#4B5563" }}>
                    {persona.description || "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB" }}>
                    {persona.companyCriteria ? (
                      <span
                        style={{
                          padding: "0.25rem 0.75rem",
                          borderRadius: "0.25rem",
                          backgroundColor: "#E5E7EB",
                          color: "#374151",
                          fontSize: "0.75rem",
                        }}
                      >
                        {persona.companyCriteria.name}
                      </span>
                    ) : (
                      <span style={{ color: "#9CA3AF" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB", color: "#6B7280", fontSize: "0.875rem" }}>
                    {new Date(persona.createdAt).toLocaleDateString("pl-PL", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB", color: "#6B7280", fontSize: "0.875rem" }}>
                    {new Date(persona.updatedAt).toLocaleDateString("pl-PL", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

