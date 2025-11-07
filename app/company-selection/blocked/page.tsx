"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BlockedCompany {
  id: number;
  companyName: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export default function BlockedCompaniesPage() {
  const [blockedCompanies, setBlockedCompanies] = useState<BlockedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadBlockedCompanies();
  }, []);

  const loadBlockedCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/company-selection/blocked");
      const data = await response.json();
      if (data.success) {
        setBlockedCompanies(data.blockedCompanies || []);
      }
    } catch (error) {
      console.error("Błąd ładowania zablokowanych firm:", error);
      alert("Błąd ładowania listy zablokowanych firm");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newCompanyName.trim()) {
      alert("Podaj nazwę firmy");
      return;
    }

    try {
      setAdding(true);
      const response = await fetch("/api/company-selection/blocked", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: newCompanyName.trim(),
          reason: newReason.trim() || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setNewCompanyName("");
        setNewReason("");
        loadBlockedCompanies();
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert("Błąd dodawania firmy");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, companyName: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć "${companyName}" z listy zablokowanych?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/company-selection/blocked?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        loadBlockedCompanies();
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert("Błąd usuwania firmy");
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
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
          Zablokowane firmy
        </h1>
        <p style={{ color: "#6B7280", marginTop: "0.5rem" }}>
          Lista firm, które będą automatycznie blokowane podczas weryfikacji. Wyszukiwanie działa częściowo (jeśli nazwa firmy zawiera zablokowaną nazwę).
        </p>
      </div>

      {/* Formularz dodawania */}
      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "white",
          borderRadius: "0.5rem",
          border: "1px solid #E5E7EB",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
          Dodaj firmę do listy zablokowanych
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "500",
                marginBottom: "0.5rem",
                color: "#374151",
              }}
            >
              Nazwa firmy *
            </label>
            <input
              type="text"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="np. ABC Sp. z o.o."
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.875rem",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "500",
                marginBottom: "0.5rem",
                color: "#374151",
              }}
            >
              Powód blokady (opcjonalnie)
            </label>
            <textarea
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="np. Konkurencja"
              rows={3}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.875rem",
                resize: "vertical",
              }}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newCompanyName.trim()}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: adding || !newCompanyName.trim() ? "#9CA3AF" : "#EF4444",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: adding || !newCompanyName.trim() ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              fontWeight: "500",
              width: "fit-content",
            }}
          >
            {adding ? "Dodawanie..." : "Dodaj do listy zablokowanych"}
          </button>
        </div>
      </div>

      {/* Lista zablokowanych firm */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0.5rem",
          border: "1px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1rem",
            borderBottom: "1px solid #E5E7EB",
            backgroundColor: "#F9FAFB",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: "600" }}>
            Lista zablokowanych firm ({blockedCompanies.length})
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
            Ładowanie...
          </div>
        ) : blockedCompanies.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
            Brak zablokowanych firm
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#F9FAFB" }}>
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#374151",
                    borderBottom: "1px solid #E5E7EB",
                  }}
                >
                  Nazwa firmy
                </th>
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#374151",
                    borderBottom: "1px solid #E5E7EB",
                  }}
                >
                  Powód
                </th>
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#374151",
                    borderBottom: "1px solid #E5E7EB",
                  }}
                >
                  Data dodania
                </th>
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#374151",
                    borderBottom: "1px solid #E5E7EB",
                  }}
                >
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody>
              {blockedCompanies.map((company) => (
                <tr
                  key={company.id}
                  style={{
                    borderBottom: "1px solid #E5E7EB",
                  }}
                >
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      fontSize: "0.875rem",
                      color: "#374151",
                    }}
                  >
                    {company.companyName}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      fontSize: "0.875rem",
                      color: "#6B7280",
                    }}
                  >
                    {company.reason || "-"}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      fontSize: "0.875rem",
                      color: "#6B7280",
                    }}
                  >
                    {new Date(company.createdAt).toLocaleDateString("pl-PL")}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      textAlign: "right",
                    }}
                  >
                    <button
                      onClick={() => handleDelete(company.id, company.companyName)}
                      style={{
                        padding: "0.25rem 0.75rem",
                        backgroundColor: "#EF4444",
                        color: "white",
                        border: "none",
                        borderRadius: "0.25rem",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                      }}
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

