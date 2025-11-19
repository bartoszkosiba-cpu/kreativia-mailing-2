"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BlockedCompany {
  id: number;
  companyName: string | null;
  website: string | null;
  reason: string | null;
  blockType: string;
  companyId: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export default function BlockedCompaniesPage() {
  const [blockedCompanies, setBlockedCompanies] = useState<BlockedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [noWebsitePage, setNoWebsitePage] = useState(1);
  const itemsPerPage = 25;

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

  // Podziel firmy na dwie kategorie
  const manualBlocked = blockedCompanies.filter((bc) => bc.blockType === "MANUAL");
  const noWebsiteBlocked = blockedCompanies.filter((bc) => bc.blockType === "NO_WEBSITE");
  
  // Paginacja dla firm bez www
  const totalNoWebsitePages = Math.ceil(noWebsiteBlocked.length / itemsPerPage);
  const startIndex = (noWebsitePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedNoWebsite = noWebsiteBlocked.slice(startIndex, endIndex);

  const handleAdd = async () => {
    if (!newWebsite.trim()) {
      alert("Podaj adres www firmy");
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
          companyName: newCompanyName.trim() || null,
          website: newWebsite.trim(),
          reason: newReason.trim() || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setNewCompanyName("");
        setNewWebsite("");
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

  const handleDelete = async (id: number, website: string | null, companyName: string | null, blockType: string) => {
    const displayName = companyName || website || "Firma";
    
    // Firma bez www nie może być usunięta z blokady
    if (blockType === "NO_WEBSITE") {
      alert("Nie można usunąć firmy bez www z blokady. Najpierw dodaj adres www do firmy, a następnie odblokuj ją.");
      return;
    }
    
    if (!confirm(`Czy na pewno chcesz usunąć "${displayName}" z listy zablokowanych?`)) {
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
          Lista firm, które będą automatycznie blokowane podczas weryfikacji. Blokowanie działa po adresie www (dokładne dopasowanie) lub automatycznie dla firm bez www.
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
              Adres www *
            </label>
            <input
              type="text"
              value={newWebsite}
              onChange={(e) => setNewWebsite(e.target.value)}
              placeholder="np. http://www.example.com"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #D1D5DB",
                fontSize: "0.875rem",
              }}
            />
            <p style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.25rem" }}>
              Wszystkie firmy z tym adresem www zostaną zablokowane
            </p>
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
              Nazwa firmy (opcjonalnie)
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
            <p style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.25rem" }}>
              Tylko do wyświetlania, nie używane do blokowania
            </p>
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
            disabled={adding || !newWebsite.trim()}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: adding || !newWebsite.trim() ? "#9CA3AF" : "#EF4444",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: adding || !newWebsite.trim() ? "not-allowed" : "pointer",
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
            Firmy zablokowane ręcznie ({manualBlocked.length})
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>
            Firmy zablokowane po adresie www (dokładne dopasowanie)
          </p>
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
            Ładowanie...
          </div>
        ) : manualBlocked.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
            Brak ręcznie zablokowanych firm
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
                  Adres www
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
              {manualBlocked.map((company) => (
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
                      fontFamily: "monospace",
                    }}
                  >
                    {company.website}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      fontSize: "0.875rem",
                      color: "#6B7280",
                    }}
                  >
                    {company.companyName || "-"}
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
                      onClick={() => handleDelete(company.id, company.website, company.companyName, company.blockType)}
                      disabled={company.blockType === "NO_WEBSITE"}
                      style={{
                        padding: "0.25rem 0.75rem",
                        backgroundColor: company.blockType === "NO_WEBSITE" ? "#9CA3AF" : "#EF4444",
                        color: "white",
                        border: "none",
                        borderRadius: "0.25rem",
                        cursor: company.blockType === "NO_WEBSITE" ? "not-allowed" : "pointer",
                        fontSize: "0.75rem",
                        opacity: company.blockType === "NO_WEBSITE" ? 0.6 : 1,
                      }}
                      title={company.blockType === "NO_WEBSITE" ? "Nie można usunąć. Najpierw dodaj adres www do firmy." : ""}
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

      {/* Sekcja: Firmy bez www */}
      {noWebsiteBlocked.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "0.5rem",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
            marginTop: "2rem",
          }}
        >
          <div
            style={{
              padding: "1rem",
              borderBottom: "1px solid #E5E7EB",
              backgroundColor: "#FEF3C7",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: "600" }}>
              Firmy bez www ({noWebsiteBlocked.length})
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#92400E", marginTop: "0.25rem" }}>
              Firmy automatycznie zablokowane z powodu braku adresu strony www. Aby odblokować firmę, najpierw dodaj adres www do firmy.
            </p>
          </div>

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
              {paginatedNoWebsite.map((company) => (
                <tr
                  key={company.id}
                  style={{
                    borderBottom: "1px solid #E5E7EB",
                    backgroundColor: "#FFFBEB",
                  }}
                >
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      fontSize: "0.875rem",
                      color: "#374151",
                      fontWeight: "500",
                    }}
                  >
                    {company.companyName || "-"}
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
                      onClick={() => handleDelete(company.id, company.website, company.companyName, company.blockType)}
                      disabled={true}
                      style={{
                        padding: "0.25rem 0.75rem",
                        backgroundColor: "#9CA3AF",
                        color: "white",
                        border: "none",
                        borderRadius: "0.25rem",
                        cursor: "not-allowed",
                        fontSize: "0.75rem",
                        opacity: 0.6,
                      }}
                      title="Nie można usunąć. Najpierw dodaj adres www do firmy."
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Paginacja */}
          {totalNoWebsitePages > 1 && (
            <div
              style={{
                padding: "1rem",
                borderTop: "1px solid #E5E7EB",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#F9FAFB",
              }}
            >
              <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                Strona {noWebsitePage} z {totalNoWebsitePages} ({noWebsiteBlocked.length} firm)
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => setNoWebsitePage((p) => Math.max(1, p - 1))}
                  disabled={noWebsitePage === 1}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: noWebsitePage === 1 ? "#E5E7EB" : "#3B82F6",
                    color: noWebsitePage === 1 ? "#9CA3AF" : "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: noWebsitePage === 1 ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  Poprzednia
                </button>
                <button
                  onClick={() => setNoWebsitePage((p) => Math.min(totalNoWebsitePages, p + 1))}
                  disabled={noWebsitePage === totalNoWebsitePages}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: noWebsitePage === totalNoWebsitePages ? "#E5E7EB" : "#3B82F6",
                    color: noWebsitePage === totalNoWebsitePages ? "#9CA3AF" : "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: noWebsitePage === totalNoWebsitePages ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  Następna
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

