"use client";

import { useState } from "react";

interface CampaignStartButtonProps {
  campaignId: number;
  currentStatus: string;
  leadsCount: number;
  delayBetweenEmails: number;
}

export default function CampaignStartButton({
  campaignId,
  currentStatus,
  leadsCount,
  delayBetweenEmails
}: CampaignStartButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "POST"
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage("Kampania została uruchomiona!");
        // Odśwież stronę po 2s aby pokazać nowy status
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(data.reason || data.error || "Błąd uruchamiania kampanii");
      }
    } catch (error: any) {
      setError(error.message || "Wystąpił błąd");
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async () => {
    if (!confirm("Czy na pewno chcesz zatrzymać kampanię?")) {
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" })
      });

      const data = await response.json();

      if (response.ok) {
        window.location.reload();
      } else {
        alert(`Błąd: ${data.reason || data.error}`);
      }
    } catch (error: any) {
      alert(`Błąd: ${error.message}`);
    }
  };

  const canStart = ["DRAFT", "SCHEDULED", "PAUSED"].includes(currentStatus);
  const canPause = currentStatus === "IN_PROGRESS";
  const isCompleted = currentStatus === "COMPLETED";

  // Oblicz szacowany czas (w minutach)
  const estimatedMinutes = Math.ceil((leadsCount * delayBetweenEmails) / 60);

  return (
    <div style={{ 
      marginBottom: 20, 
      padding: 20, 
      backgroundColor: "#f8f9fa", 
      borderRadius: 8,
      border: "1px solid #dee2e6"
    }}>
      <h3 style={{ marginTop: 0 }}>Uruchomienie według harmonogramu</h3>
      
      <div style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>
        {leadsCount > 0 ? (
          <>
            <strong>{leadsCount}</strong> leadów do wysłania
            <br />
            <span style={{ color: "#0066cc" }}>
              Szacowany czas: ~{estimatedMinutes} minut
              {estimatedMinutes > 60 && ` (${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}min)`}
            </span>
          </>
        ) : (
          "Brak leadów w kampanii"
        )}
      </div>

      {error && (
        <div style={{ 
          padding: 12, 
          backgroundColor: "#fee", 
          border: "1px solid #fcc", 
          borderRadius: 4, 
          marginBottom: 16,
          color: "#c00"
        }}>
          <strong>Błąd:</strong> {error}
        </div>
      )}

      {successMessage && (
        <div style={{ 
          padding: 12, 
          backgroundColor: "#d4edda", 
          border: "1px solid #c3e6cb", 
          borderRadius: 4, 
          marginBottom: 16,
          color: "#155724",
          fontWeight: "bold"
        }}>
          {successMessage}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        {canStart && (
          <button
            onClick={handleStart}
            disabled={isStarting || leadsCount === 0}
            style={{
              padding: "12px 24px",
              backgroundColor: leadsCount === 0 || isStarting ? "#ccc" : "#4caf50",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: (leadsCount === 0 || isStarting) ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: "bold"
            }}
          >
            {isStarting ? "Uruchamianie..." : "Uruchom według harmonogramu"}
          </button>
        )}

        {canPause && (
          <button
            onClick={handlePause}
            style={{
              padding: "12px 24px",
              backgroundColor: "#ff9800",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "bold"
            }}
          >
            Pauza
          </button>
        )}

        {isCompleted && (
          <div style={{
            padding: "12px 24px",
            backgroundColor: "#e8f5e9",
            borderRadius: 6,
            color: "#2e7d32",
            fontSize: 16,
            fontWeight: "bold"
          }}>
            Kampania zakończona
          </div>
        )}
      </div>

      {canStart && (
        <p style={{ 
          fontSize: 12, 
          color: "#666", 
          marginTop: 12,
          lineHeight: 1.5
        }}>
          Kampania uruchomi się <strong>OD RAZU</strong> z pełnym harmonogramem:
          okno czasowe, opóźnienia {delayBetweenEmails}s, rotacja skrzynek.
          <br />
          Maile będą wysyłane po jednym z opóźnieniem {delayBetweenEmails} sekund.
        </p>
      )}
    </div>
  );
}

