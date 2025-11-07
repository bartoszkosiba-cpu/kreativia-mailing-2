"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CompanySelectionLogsViewPage() {
  const [logs, setLogs] = useState<string>("");
  const [modules, setModules] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("company-verify");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    // Sprawdź, czy w URL jest parametr module
    const params = new URLSearchParams(window.location.search);
    const moduleParam = params.get("module");
    if (moduleParam) {
      setSelectedModule(moduleParam);
    }
  }, []);

  useEffect(() => {
    loadModules();
  }, []);

  useEffect(() => {
    if (selectedModule) {
      loadLogs();
    }
  }, [selectedModule]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedModule]);

  const loadModules = async () => {
    try {
      const response = await fetch("/api/company-selection/logs?limit=1");
      const data = await response.json();
      if (data.success && data.modules) {
        setModules(data.modules);
        // Jeśli nie ma wybranego modułu w URL, użyj pierwszego dostępnego
        const params = new URLSearchParams(window.location.search);
        const moduleParam = params.get("module");
        if (!moduleParam && data.modules.length > 0) {
          setSelectedModule(data.modules[0]);
        }
      }
    } catch (error) {
      console.error("Błąd ładowania modułów:", error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/company-selection/logs?module=${selectedModule}&limit=1000`);
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs || "Brak logów");
      }
    } catch (error) {
      console.error("Błąd ładowania logów:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm(`Czy na pewno chcesz wyczyścić logi modułu "${selectedModule}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/company-selection/logs?module=${selectedModule}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        alert("Logi zostały wyczyszczone");
        loadLogs();
      }
    } catch (error) {
      console.error("Błąd czyszczenia logów:", error);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
          <Link
            href="/company-selection"
            style={{
              color: "#3B82F6",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            ← Powrót do modułu wyboru leadów
          </Link>
          <span style={{ color: "#9CA3AF" }}>|</span>
          <Link
            href="/company-selection/logs"
            style={{
              color: "#3B82F6",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            ← Wszystkie moduły logów
          </Link>
        </div>
        <h1 style={{ fontSize: "2rem", marginTop: "1rem" }}>
          Logi: {selectedModule}
        </h1>
      </div>

      {/* Kontrolki */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <select
          value={selectedModule}
          onChange={(e) => {
            setSelectedModule(e.target.value);
            // Zaktualizuj URL bez przeładowania strony
            const url = new URL(window.location.href);
            url.searchParams.set("module", e.target.value);
            window.history.pushState({}, "", url);
          }}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #D1D5DB",
            fontSize: "1rem",
          }}
        >
          {modules.map((module) => (
            <option key={module} value={module}>
              {module}
            </option>
          ))}
        </select>

        <button
          onClick={loadLogs}
          disabled={loading}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: loading ? "#9CA3AF" : "#3B82F6",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Ładowanie..." : "Odśwież"}
        </button>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span>Auto-odświeżanie (co 2s)</span>
        </label>

        <button
          onClick={clearLogs}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#EF4444",
            color: "white",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
          }}
        >
          Wyczyść logi
        </button>
      </div>

      {/* Logi */}
      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "#1F2937",
          color: "#F9FAFB",
          borderRadius: "0.5rem",
          fontFamily: "monospace",
          fontSize: "0.875rem",
          maxHeight: "70vh",
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {loading ? (
          "Ładowanie logów..."
        ) : logs ? (
          logs
        ) : (
          "Brak logów - jeszcze nie było aktywności w tym module"
        )}
      </div>

      {/* Informacje */}
      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          backgroundColor: "#F3F4F6",
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          color: "#6B7280",
        }}
      >
        <strong>Dostępne moduły:</strong> {modules.join(", ") || "Brak"}
        <br />
        <strong>Wybrany moduł:</strong> {selectedModule}
        <br />
        <strong>Lokalizacja logów:</strong> <code>logs/{selectedModule}.log</code>
      </div>
    </div>
  );
}

