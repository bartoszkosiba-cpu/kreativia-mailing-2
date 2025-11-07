"use client";

import { useState } from "react";
import Papa from "papaparse";
import Link from "next/link";

export default function CompanyImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview([]);
      setResult(null);
      setError(null);

      // Parse CSV
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        delimiter: "", // Auto-detect
        complete: (result) => {
          if (result.errors && result.errors.length > 0) {
            console.warn("Błędy parsowania:", result.errors);
          }
          setPreview(result.data.slice(0, 5)); // Pokaż pierwsze 5 wierszy
        },
      });
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError("Wybierz plik CSV");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Parse CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: "", // Auto-detect
        complete: async (parseResult) => {
          try {
            console.log("[Import] Parsowanie zakończone:", {
              totalRows: parseResult.data.length,
              firstRow: parseResult.data[0],
              errors: parseResult.errors,
            });

            if (parseResult.errors && parseResult.errors.length > 0) {
              console.warn("[Import] Błędy parsowania:", parseResult.errors);
            }

            if (!parseResult.data || parseResult.data.length === 0) {
              throw new Error("Plik CSV jest pusty lub nie zawiera danych");
            }

            // Najpierw wyślij do debug endpointu
            try {
              await fetch("/api/company-selection/debug-import", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  companies: parseResult.data,
                }),
              });
            } catch (debugError) {
              console.warn("[Import] Błąd debug endpointu:", debugError);
            }

            const response = await fetch("/api/company-selection/import", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                companies: parseResult.data,
              }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || data.details || "Błąd importu");
            }

            console.log("[Import] Wynik importu:", data);
            setResult(data);
          } catch (err) {
            console.error("[Import] Błąd:", err);
            setError(err instanceof Error ? err.message : "Błąd importu");
          } finally {
            setLoading(false);
          }
        },
        error: (error) => {
          console.error("[Import] Błąd parsowania CSV:", error);
          setError(`Błąd parsowania pliku: ${error.message}`);
          setLoading(false);
        },
      });
    } catch (err) {
      console.error("[Import] Błąd:", err);
      setError(err instanceof Error ? err.message : "Błąd parsowania pliku");
      setLoading(false);
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
          Import firm z CSV
        </h1>
      </div>

      {/* Upload */}
      <div
        style={{
          padding: "2rem",
          backgroundColor: "white",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: "2rem",
        }}
      >
        <label
          style={{
            display: "block",
            marginBottom: "1rem",
            fontWeight: "bold",
          }}
        >
          Wybierz plik CSV
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{
            padding: "0.5rem",
            border: "1px solid #D1D5DB",
            borderRadius: "0.25rem",
            width: "100%",
            marginBottom: "1rem",
          }}
        />

        {preview.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>
              Podgląd danych ({preview.length} pierwszych wierszy):
            </h3>
            <div
              style={{
                overflowX: "auto",
                border: "1px solid #E5E7EB",
                borderRadius: "0.25rem",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.875rem",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#F3F4F6" }}>
                    {Object.keys(preview[0] || {}).map((key) => (
                      <th
                        key={key}
                        style={{
                          padding: "0.5rem",
                          textAlign: "left",
                          borderBottom: "1px solid #E5E7EB",
                        }}
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((value: any, valIdx) => (
                        <td
                          key={valIdx}
                          style={{
                            padding: "0.5rem",
                            borderBottom: "1px solid #E5E7EB",
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={String(value)}
                        >
                          {String(value).substring(0, 50)}
                          {String(value).length > 50 ? "..." : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || loading}
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1.5rem",
            backgroundColor: loading ? "#9CA3AF" : "#3B82F6",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "1rem",
          }}
        >
          {loading ? "Importowanie..." : "Importuj firmy"}
        </button>
      </div>

      {/* Wyniki */}
      {result && (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: result.errorCount > 0 ? "#FEF3C7" : "#10B981",
            color: result.errorCount > 0 ? "#92400E" : "white",
            borderRadius: "0.5rem",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ marginBottom: "1rem" }}>
            {result.errorCount > 0 ? "⚠️ Import zakończony z błędami" : "✅ Import zakończony!"}
          </h2>
          <div style={{ lineHeight: "1.8" }}>
            <div>✅ Zaimportowanych: {result.imported}</div>
            <div>🔄 Zaktualizowanych: {result.updated}</div>
            <div>⏭️ Pominiętych: {result.skipped}</div>
            <div>📊 Łącznie: {result.total}</div>
            {result.totalInDb !== undefined && (
              <div>💾 Firm w bazie: {result.totalInDb}</div>
            )}
            {result.errorCount > 0 && (
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: "0.25rem" }}>
                <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
                  ⚠️ Błędy: {result.errorCount}
                </div>
                {result.errors && result.errors.length > 0 && (
                  <div style={{ fontSize: "0.875rem", maxHeight: "200px", overflowY: "auto" }}>
                    {result.errors.map((err: any, idx: number) => (
                      <div key={idx} style={{ marginBottom: "0.5rem", padding: "0.5rem", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: "0.25rem" }}>
                        <div><strong>Wiersz {err.row}:</strong> {err.error}</div>
                        {err.data && err.data["Nazwa"] && (
                          <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                            Firma: {err.data["Nazwa"] || err.data.name || "Brak nazwy"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {result.imported > 0 && (
            <Link
              href="/company-selection/verify"
              style={{
                display: "inline-block",
                marginTop: "1rem",
                padding: "0.5rem 1rem",
                backgroundColor: result.errorCount > 0 ? "#92400E" : "white",
                color: result.errorCount > 0 ? "#FEF3C7" : "#10B981",
                borderRadius: "0.25rem",
                textDecoration: "none",
              }}
            >
              Przejdź do weryfikacji →
            </Link>
          )}
        </div>
      )}

      {/* Błąd */}
      {error && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#FEE2E2",
            color: "#991B1B",
            borderRadius: "0.5rem",
            marginBottom: "2rem",
          }}
        >
          <strong>Błąd:</strong> {error}
        </div>
      )}

      {/* Informacje */}
      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "#F3F4F6",
          borderRadius: "0.5rem",
        }}
      >
        <h2 style={{ marginBottom: "1rem" }}>Wymagane kolumny w CSV:</h2>
        <ul style={{ lineHeight: "1.8", marginLeft: "1.5rem" }}>
          <li>
            <strong>Nazwa</strong> - Nazwa firmy (wymagane)
          </li>
          <li>
            <strong>Branża</strong> - Branża firmy
          </li>
          <li>
            <strong>Strona www</strong> - URL strony internetowej
          </li>
          <li>
            <strong>Opis</strong> - Długi opis firmy (używany do weryfikacji AI)
          </li>
          <li>
            <strong>Opis działalności</strong> - Krótki opis działalności
          </li>
          <li>
            <strong>Kraj, Miasto</strong> - Lokalizacja firmy
          </li>
          <li>
            <strong>Komentarz weryfikacji</strong> - Jeśli istnieje, zostanie
            użyty do automatycznej kwalifikacji
          </li>
        </ul>
      </div>
    </div>
  );
}

