"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh co 5 sekund
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [router, autoRefresh]);

  const handleManualRefresh = () => {
    router.refresh();
  };

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: "var(--spacing-md)",
      padding: "var(--spacing-md)",
      backgroundColor: "var(--gray-50)",
      borderRadius: "6px",
      border: "1px solid var(--gray-200)",
      marginBottom: "var(--spacing-lg)"
    }}>
      <button
        onClick={handleManualRefresh}
        className="btn btn-secondary"
        style={{ padding: "8px 16px", fontSize: "14px" }}
        title="Odśwież dane kampanii"
      >
        🔄 Odśwież
      </button>
      
      <label style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "8px",
        cursor: "pointer",
        fontSize: "14px",
        color: "var(--gray-700)"
      }}>
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
          style={{ cursor: "pointer" }}
        />
        Automatyczne odświeżanie co 5s
      </label>

      <span style={{ 
        fontSize: "12px", 
        color: "var(--gray-600)",
        marginLeft: "auto"
      }}>
        ℹ️ Dane odświeżają się automatycznie, aby pokazać zmiany z bazy kontaktów
      </span>
    </div>
  );
}

