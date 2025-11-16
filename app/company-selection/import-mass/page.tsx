"use client";

import { type CSSProperties, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";

const CHUNK_SIZE = 500;

const LANGUAGE_OPTIONS = [
  { value: "PL", label: "Polski" },
  { value: "EN", label: "English" },
  { value: "DE", label: "Deutsch" },
  { value: "FR", label: "Français" },
] as const;

const MARKET_OPTIONS = [
  { value: "PL", label: "Rynek PL" },
  { value: "DE", label: "Rynek DE" },
  { value: "FR", label: "Rynek FR" },
  { value: "EN", label: "Rynek EN/Global" },
] as const;

interface ImportError {
  row: number;
  error: string;
  data?: Record<string, unknown>;
}

interface ImportChunkResult {
  imported?: number;
  skipped?: number;
  errorCount?: number;
  errors?: ImportError[];
  total?: number;
  batchId?: number;
  skippedDetails?: Record<string, { count?: number; examples?: string[] }>;
}

interface AggregatedResult {
  imported: number;
  skipped: number;
  errorCount: number;
  processedRows: number;
  skippedDetails: Record<string, { count: number; examples: string[] }>;
}

const createDefaultBatchName = () =>
  `Import ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

export default function CompanyMassImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [processedRows, setProcessedRows] = useState(0);
  const [aggregatedResult, setAggregatedResult] = useState<AggregatedResult | null>(null);
  const [chunkDetails, setChunkDetails] = useState<
    Array<{ chunk: number; rows: number; result: ImportChunkResult }>
  >([]);
  const [currentBatchId, setCurrentBatchId] = useState<number | null>(null);
  const [batchName, setBatchName] = useState<string>(createDefaultBatchName);
  const [batchLanguage, setBatchLanguage] = useState<
    (typeof LANGUAGE_OPTIONS)[number]["value"]
  >("PL");
  const [batchMarket, setBatchMarket] = useState<
    (typeof MARKET_OPTIONS)[number]["value"]
  >("PL");

  const progressPercent = useMemo(() => {
    if (totalRows === 0) return 0;
    return Math.min(100, Math.round((processedRows / totalRows) * 100));
  }, [processedRows, totalRows]);

  const importCompleted =
    !isImporting && totalRows > 0 && processedRows >= totalRows && aggregatedResult !== null;

  const resetState = useCallback(() => {
    setPreview([]);
    setError(null);
    setTotalRows(0);
    setProcessedRows(0);
    setAggregatedResult(null);
    setChunkDetails([]);
    setCurrentBatchId(null);
  }, []);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setBatchName(createDefaultBatchName());
    resetState();

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      delimiter: "",
      complete: (parseResult) => {
        if (parseResult.errors && parseResult.errors.length > 0) {
          console.warn("[Mass Import] Błędy parsowania:", parseResult.errors);
        }
        setPreview(parseResult.data.slice(0, 5));
        setTotalRows(parseResult.data.length);
      },
      error: (parseError) => {
        console.error("[Mass Import] Błąd parsowania CSV:", parseError);
        setError(`Błąd parsowania pliku: ${parseError.message}`);
      },
    });
  };

  const runImport = async (rows: any[]) => {
    setIsImporting(true);
    setError(null);
    setAggregatedResult(null);
    setChunkDetails([]);
    setProcessedRows(0);
    setCurrentBatchId(null);

    const total = rows.length;
    setTotalRows(total);

    const aggregated: AggregatedResult = {
      imported: 0,
      skipped: 0,
      errorCount: 0,
      processedRows: 0,
      skippedDetails: {},
    };

    try {
      let batchId: number | null = null;

      for (let index = 0; index < total; index += CHUNK_SIZE) {
        const chunk = rows.slice(index, index + CHUNK_SIZE);
        const chunkNumber = Math.floor(index / CHUNK_SIZE) + 1;

        const payload: Record<string, unknown> = {
          companies: chunk,
        };

        if (batchId) {
          payload.batchId = batchId;
          payload.batchLanguage = batchLanguage;
          payload.batchMarket = batchMarket;
        } else {
          payload.batchName = batchName.trim();
          payload.batchLanguage = batchLanguage;
          payload.batchMarket = batchMarket;
          payload.totalRows = total;
        }

        const response = await fetch("/api/company-selection/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data: ImportChunkResult = await response.json();

        if (!response.ok) {
          throw new Error(
            data && typeof data === "object" && "error" in data
              ? String((data as any).error)
              : `Błąd importu (paczka ${chunkNumber})`
          );
        }

        if (!batchId && data.batchId) {
          batchId = data.batchId;
          setCurrentBatchId(data.batchId);
        }

        aggregated.imported += data.imported ?? 0;
        aggregated.skipped += data.skipped ?? 0;
        aggregated.errorCount += data.errorCount ?? 0;
        aggregated.processedRows += chunk.length;
        if (data.skippedDetails) {
          for (const [reason, info] of Object.entries(data.skippedDetails as Record<string, { count?: number; examples?: string[] }>)) {
            const current = aggregated.skippedDetails[reason] ?? { count: 0, examples: [] };
            current.count += info.count ?? 0;
            if (Array.isArray(info.examples) && info.examples.length > 0) {
              const merged = [...current.examples, ...info.examples];
              current.examples = merged.slice(0, 5);
            }
            aggregated.skippedDetails[reason] = current;
          }
        }

        setChunkDetails((prev) => [
          ...prev,
          {
            chunk: chunkNumber,
            rows: chunk.length,
            result: data,
          },
        ]);

        setProcessedRows(aggregated.processedRows);
        setAggregatedResult({ ...aggregated });
      }
    } catch (importError) {
      console.error("[Mass Import] Błąd importu:", importError);
      setError(importError instanceof Error ? importError.message : "Błąd importu");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError("Wybierz plik CSV");
      return;
    }

    if (!batchName.trim()) {
      setError("Podaj nazwę importu");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: "",
      worker: true,
      complete: async (parseResult) => {
        try {
          if (!parseResult.data || parseResult.data.length === 0) {
            throw new Error("Plik CSV jest pusty lub nie zawiera danych");
          }
          await runImport(parseResult.data as any[]);
        } catch (parseError) {
          console.error("[Mass Import] Błąd parsowania CSV:", parseError);
          setError(parseError instanceof Error ? parseError.message : "Błąd importu");
        }
      },
      error: (parseError) => {
        console.error("[Mass Import] Błąd parsowania CSV:", parseError);
        setError(`Błąd parsowania pliku: ${parseError.message}`);
      },
    });
  };

  const formatReasonLabel = (reason: string) => {
    switch (reason) {
      case "missing_name":
        return "Brak nazwy";
      case "missing_activity_description":
        return "Brak opisu działalności";
      case "missing_industry":
        return "Brak branży";
      case "duplicate":
        return "Duplikat nazwy (pominięty)";
      case "error":
        return "Inny błąd";
      default:
        return reason;
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link
          href="/company-selection/processes/import"
          style={{
            color: "#3B82F6",
            textDecoration: "none",
            marginBottom: "1rem",
            display: "inline-block",
          }}
        >
          ← Powrót do procesu importu
        </Link>
        <h1 style={{ fontSize: "2rem", marginTop: "1rem" }}>
          Masowy import firm z CSV
        </h1>
        <p style={{ marginTop: "0.5rem", color: "#4B5563", maxWidth: "720px" }}>
          Ten tryb wysyła plik w paczkach po {CHUNK_SIZE} rekordów, dzięki czemu import dużych baz
          odbywa się bez zacięć i z widocznym paskiem postępu.
        </p>
      </div>

      <div
        style={{
          padding: "2rem",
          backgroundColor: "white",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ flex: "1 1 280px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "bold",
              }}
            >
              Nazwa importu *
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(event) => setBatchName(event.target.value)}
              placeholder="Np. Expo PL 2025-11-10"
              disabled={isImporting}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
              }}
            />
          </div>
          <div style={{ width: "180px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "bold",
              }}
            >
              Język rekordów *
            </label>
            <select
              value={batchLanguage}
              onChange={(event) =>
                setBatchLanguage(event.target.value as (typeof LANGUAGE_OPTIONS)[number]["value"])
              }
              disabled={isImporting}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
              }}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ width: "200px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "bold",
              }}
            >
              Rynek bazowy *
            </label>
            <select
              value={batchMarket}
              onChange={(event) =>
                setBatchMarket(event.target.value as (typeof MARKET_OPTIONS)[number]["value"])
              }
              disabled={isImporting}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
              }}
            >
              {MARKET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

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
          disabled={isImporting}
          style={{
            padding: "0.5rem",
            border: "1px solid #D1D5DB",
            borderRadius: "0.25rem",
            width: "100%",
            marginBottom: "1rem",
          }}
        />

        {currentBatchId && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              backgroundColor: "#EEF2FF",
              border: "1px solid #C7D2FE",
              borderRadius: "0.5rem",
              color: "#3730A3",
              fontSize: "0.95rem",
            }}
          >
            Import: <strong>{batchName}</strong> ({batchLanguage} • {batchMarket}) • ID partii:{" "}
            <strong>{currentBatchId}</strong>
          </div>
        )}

        {totalRows > 0 && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              backgroundColor: "#ECFDF5",
              border: "1px solid #A7F3D0",
              borderRadius: "0.5rem",
              color: "#047857",
              fontSize: "0.95rem",
              fontWeight: 500,
            }}
          >
            W pliku znaleziono {totalRows} rekordów do importu.
          </div>
        )}

        {preview.length > 0 && (
          <div
            style={{
              marginTop: "1.5rem",
              backgroundColor: "#F9FAFB",
              borderRadius: "0.5rem",
              padding: "1.5rem",
            }}
          >
            <h2 style={{ fontSize: "1.125rem", marginBottom: "0.75rem" }}>
              Podgląd danych ({preview.length} pierwszych wierszy)
            </h2>
            <div
              style={{
                overflowX: "auto",
                border: "1px solid #E5E7EB",
                borderRadius: "0.5rem",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.875rem",
                }}
              >
                <thead style={{ backgroundColor: "#F3F4F6" }}>
                  <tr>
                    {Object.keys(preview[0] || {}).map((header) => (
                      <th
                        key={header}
                        style={{
                          padding: "0.5rem",
                          textAlign: "left",
                          borderBottom: "1px solid #E5E7EB",
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {Object.values(row).map((value, colIndex) => {
                        const stringValue =
                          typeof value === "string" || typeof value === "number"
                            ? String(value)
                            : value === null || value === undefined
                              ? ""
                              : JSON.stringify(value);
                        return (
                          <td
                            key={`${rowIndex}-${colIndex}`}
                            style={{
                              padding: "0.5rem",
                              borderBottom: "1px solid #E5E7EB",
                              maxWidth: "220px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={stringValue}
                          >
                            {stringValue.length > 60
                              ? `${stringValue.substring(0, 60)}…`
                              : stringValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || isImporting || !batchName.trim()}
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1.5rem",
            backgroundColor:
              !file || isImporting || !batchName.trim() ? "#9CA3AF" : "#3B82F6",
            color: "white",
            borderRadius: "0.5rem",
            border: "none",
            cursor:
              !file || isImporting || !batchName.trim() ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {isImporting ? "Importuję..." : "Rozpocznij masowy import"}
        </button>
      </div>

      {(isImporting || aggregatedResult) && (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
            Postęp importu
          </h2>

          <div style={{ marginBottom: "1rem", color: "#4B5563" }}>
            Przetworzono {processedRows} z {totalRows} wierszy ({progressPercent}%)
          </div>

          <div
            style={{
              width: "100%",
              height: "16px",
              backgroundColor: "#E5E7EB",
              borderRadius: "999px",
              overflow: "hidden",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                backgroundColor: "#3B82F6",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {aggregatedResult && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                <SummaryCard label="Zaimportowane (łącznie)" value={aggregatedResult.imported} color="#10B981" />
                <SummaryCard label="Pominięte (łącznie)" value={aggregatedResult.skipped} color="#6B7280" />
                <SummaryCard label="Błędy (łącznie)" value={aggregatedResult.errorCount} color="#EF4444" />
              </div>

              {importCompleted && aggregatedResult && (
                <div
                  style={{
                    padding: "1.5rem",
                    backgroundColor: "#ECFDF5",
                    borderRadius: "0.75rem",
                    border: "1px solid #A7F3D0",
                    color: "#065F46",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    marginBottom: "2rem",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
                    <span>Wyszło z pliku: {totalRows.toLocaleString("pl-PL")} rekordów</span>
                    <span>Zaimportowano: {aggregatedResult.imported.toLocaleString("pl-PL")}</span>
                    <span>Pominięto: {aggregatedResult.skipped.toLocaleString("pl-PL")}</span>
                    <span>ID partii: {currentBatchId}</span>
                  </div>

                  {aggregatedResult.skipped > 0 && (
                    <div
                      style={{
                        backgroundColor: "white",
                        borderRadius: "0.65rem",
                        padding: "1rem",
                        border: "1px solid #D1FAE5",
                        color: "#047857",
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: "1rem" }}>Powody pominięcia</h3>
                      <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                        {Object.entries(aggregatedResult.skippedDetails).map(([reason, info]) => (
                          <div
                            key={reason}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.25rem",
                              backgroundColor: "#F0FDF4",
                              borderRadius: "0.5rem",
                              padding: "0.75rem",
                              border: "1px solid #BBF7D0",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{formatReasonLabel(reason)}</span>
                            <span>Liczba: {info.count.toLocaleString("pl-PL")}</span>
                            {info.examples.length > 0 && (
                              <span style={{ color: "#047857", fontSize: "0.85rem" }}>
                                Przykłady: {info.examples.join(", ")}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#059669" }}>
                        Duplikaty (oznaczone jako pominięte) nie nadpisują istniejących firm – rekord zostaje całkowicie pominięty.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {chunkDetails.length > 0 && (
            <div>
              <h3 style={{ fontSize: "1.125rem", marginBottom: "0.75rem" }}>
                Szczegóły paczek
              </h3>
              <div
                style={{
                  maxHeight: "320px",
                  overflowY: "auto",
                  border: "1px solid #E5E7EB",
                  borderRadius: "0.5rem",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.875rem",
                  }}
                >
                  <thead style={{ backgroundColor: "#F3F4F6" }}>
                    <tr>
                      <th style={headerCellStyle}>Paczka</th>
                      <th style={headerCellStyle}>Wiersze</th>
                      <th style={headerCellStyle}>Zaimportowane</th>
                      <th style={headerCellStyle}>Pominięte</th>
                      <th style={headerCellStyle}>Błędy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunkDetails.map(({ chunk, rows, result }) => (
                      <tr key={chunk}>
                        <td style={rowCellStyle}>#{chunk}</td>
                        <td style={rowCellStyle}>{rows}</td>
                        <td style={rowCellStyle}>{result.imported ?? 0}</td>
                        <td style={rowCellStyle}>{result.skipped ?? 0}</td>
                        <td style={rowCellStyle}>{result.errorCount ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "1rem 1.5rem",
            backgroundColor: "#FEE2E2",
            borderRadius: "0.5rem",
            color: "#B91C1C",
            marginBottom: "2rem",
          }}
        >
          {error}
        </div>
      )}

      {aggregatedResult && aggregatedResult.errorCount > 0 && chunkDetails.length > 0 && (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>Podsumowanie błędów</h3>
          <p style={{ marginBottom: "1rem", color: "#4B5563" }}>
            Łącznie błędów: {aggregatedResult.errorCount}. Szczegóły znajdziesz w logach importu —
            pierwsze wpisy z każdej paczki są zapisywane automatycznie.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "0.5rem",
        border: "1px solid #E5E7EB",
        backgroundColor: "#F9FAFB",
      }}
    >
      <div style={{ color: "#6B7280", marginBottom: "0.5rem" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const headerCellStyle: CSSProperties = {
  padding: "0.5rem",
  textAlign: "left",
  borderBottom: "1px solid #E5E7EB",
  position: "sticky",
  top: 0,
  background: "#F3F4F6",
  zIndex: 1,
};

const rowCellStyle: CSSProperties = {
  padding: "0.5rem",
  borderBottom: "1px solid #F3F4F6",
};

