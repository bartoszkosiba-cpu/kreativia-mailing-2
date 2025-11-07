"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ModuleInfo {
  name: string;
  description: string;
  icon: string;
  color: string;
}

const moduleDescriptions: Record<string, ModuleInfo> = {
  "company-verify": {
    name: "Weryfikacja firm",
    description: "Logi weryfikacji firm (batch i pojedyncze)",
    icon: "✓",
    color: "#10B981",
  },
  "company-import": {
    name: "Import CSV",
    description: "Logi importu firm z plików CSV",
    icon: "📥",
    color: "#3B82F6",
  },
  "company-verification-ai": {
    name: "AI Weryfikacja",
    description: "Logi z procesu weryfikacji AI (analiza firm)",
    icon: "🤖",
    color: "#8B5CF6",
  },
  "company-criteria-chat": {
    name: "Czat z agentem",
    description: "Logi z czatu z agentem AI (definiowanie kryteriów)",
    icon: "💬",
    color: "#F59E0B",
  },
  "progress": {
    name: "Progress tracking",
    description: "Logi z endpoint progress (śledzenie postępu weryfikacji)",
    icon: "📊",
    color: "#EF4444",
  },
  "apollo": {
    name: "Apollo API",
    description: "Logi integracji z Apollo.io (wyszukiwanie firm i pracowników)",
    icon: "🔍",
    color: "#06B6D4",
  },
};

export default function LogsIndexPage() {
  const [modules, setModules] = useState<string[]>([]);
  const [moduleLogs, setModuleLogs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModules();
  }, []);

  useEffect(() => {
    if (modules.length > 0) {
      loadAllLogs();
    }
  }, [modules]);

  const loadModules = async () => {
    try {
      const response = await fetch("/api/company-selection/logs?limit=1");
      const data = await response.json();
      if (data.success && data.modules) {
        setModules(data.modules);
      }
    } catch (error) {
      console.error("Błąd ładowania modułów:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllLogs = async () => {
    const logs: Record<string, string> = {};
    for (const module of modules) {
      try {
        const response = await fetch(`/api/company-selection/logs?module=${module}&limit=10`);
        const data = await response.json();
        if (data.success && data.logs) {
          // Pobierz ostatnie 5 linii
          const lines = data.logs.split("\n").filter((line: string) => line.trim());
          logs[module] = lines.slice(-5).join("\n");
        }
      } catch (error) {
        console.error(`Błąd ładowania logów dla ${module}:`, error);
      }
    }
    setModuleLogs(logs);
  };

  const getModuleInfo = (module: string): ModuleInfo => {
    return (
      moduleDescriptions[module] || {
        name: module,
        description: "Logi modułu",
        icon: "📄",
        color: "#6B7280",
      }
    );
  };

  const getLogPreview = (module: string): string => {
    const logs = moduleLogs[module];
    if (!logs || logs.trim() === "") {
      return "Brak logów";
    }
    return logs;
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
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
          Logi modułu wyboru leadów
        </h1>
        <p style={{ color: "#6B7280", marginTop: "0.5rem" }}>
          Wybierz moduł, aby zobaczyć szczegółowe logi
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>
          Ładowanie modułów...
        </div>
      ) : modules.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "#F3F4F6",
            borderRadius: "0.5rem",
            textAlign: "center",
            color: "#6B7280",
          }}
        >
          Brak dostępnych modułów logów
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {modules.map((module) => {
            const info = getModuleInfo(module);
            const preview = getLogPreview(module);
            const hasLogs = preview !== "Brak logów";

            return (
              <Link
                key={module}
                href={`/company-selection/logs/view?module=${module}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    padding: "1.5rem",
                    backgroundColor: "white",
                    borderRadius: "0.5rem",
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    transition: "all 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div
                      style={{
                        width: "3rem",
                        height: "3rem",
                        borderRadius: "0.5rem",
                        backgroundColor: `${info.color}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.5rem",
                      }}
                    >
                      {info.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: "600",
                          margin: 0,
                          marginBottom: "0.25rem",
                        }}
                      >
                        {info.name}
                      </h3>
                      <p
                        style={{
                          fontSize: "0.875rem",
                          color: "#6B7280",
                          margin: 0,
                        }}
                      >
                        {info.description}
                      </p>
                    </div>
                  </div>

                  {/* Module name */}
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#9CA3AF",
                      marginBottom: "1rem",
                      fontFamily: "monospace",
                    }}
                  >
                    {module}
                  </div>

                  {/* Log preview */}
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: "#1F2937",
                      color: "#F9FAFB",
                      borderRadius: "0.25rem",
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      maxHeight: "150px",
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      marginBottom: "1rem",
                    }}
                  >
                    {hasLogs ? (
                      preview
                    ) : (
                      <span style={{ color: "#6B7280" }}>Brak logów</span>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.875rem",
                      color: "#6B7280",
                    }}
                  >
                    <span>
                      {hasLogs ? "Kliknij, aby zobaczyć więcej →" : "Brak aktywności"}
                    </span>
                    <span
                      style={{
                        color: info.color,
                        fontWeight: "600",
                      }}
                    >
                      Zobacz logi →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1.5rem",
          backgroundColor: "#F3F4F6",
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          color: "#6B7280",
        }}
      >
        <strong>Informacja:</strong> Kliknij na kartę modułu, aby zobaczyć szczegółowe logi.
        Logi są zapisywane w czasie rzeczywistym i można je odświeżać automatycznie.
      </div>
    </div>
  );
}
