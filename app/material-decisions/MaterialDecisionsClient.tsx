"use client";

import { useState, useEffect } from "react";

interface Decision {
  id: number;
  lead: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
    company: string | null;
  };
  campaign: {
    id: number;
    name: string;
  };
  reply: {
    id: number;
    fromEmail: string;
    subject: string | null;
    content: string;
    createdAt: Date;
  };
  aiConfidence: number;
  aiReasoning: string;
  leadResponse: string;
  suggestedAction: string;
  status: string;
  createdAt: Date;
}

interface Props {
  initialDecisions: any[];
}

export default function MaterialDecisionsClient({ initialDecisions }: Props) {
  const [decisions, setDecisions] = useState<Decision[]>(initialDecisions);
  const [processing, setProcessing] = useState<number | null>(null);
  const [decisionNote, setDecisionNote] = useState<{ [key: number]: string }>({});

  const handleDecision = async (decisionId: number, status: "APPROVED" | "REJECTED") => {
    setProcessing(decisionId);

    try {
      const response = await fetch(`/api/material-decisions/${decisionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          decisionNote: decisionNote[decisionId]?.trim() || null,
          decidedBy: "Administrator" // TODO: Pobierz z sesji
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      // Usuń decyzję z listy (lub odśwież)
      setDecisions(decisions.filter(d => d.id !== decisionId));
      delete decisionNote[decisionId];
    } catch (error: any) {
      alert(`Błąd: ${error.message}`);
    } finally {
      setProcessing(null);
    }
  };

  if (decisions.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", backgroundColor: "white", borderRadius: "8px" }}>
        <p style={{ fontSize: "18px", color: "#666" }}>
          Brak oczekujących decyzji!
        </p>
        <p style={{ marginTop: "10px", color: "#999" }}>
          Wszystkie prośby o materiały zostały przetworzone.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {decisions.map((decision) => (
        <div
          key={decision.id}
          style={{
            padding: "20px",
            backgroundColor: "white",
            borderRadius: "8px",
            border: "1px solid #ddd"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
            <div>
              <h3 style={{ margin: 0, marginBottom: "8px" }}>
                {decision.lead.firstName} {decision.lead.lastName} ({decision.lead.email})
              </h3>
              <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
                Kampania: <strong>{decision.campaign.name}</strong>
                {decision.lead.company && ` • ${decision.lead.company}`}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{
                padding: "6px 12px",
                backgroundColor: decision.aiConfidence >= 0.8 ? "#4caf50" : decision.aiConfidence >= 0.6 ? "#ff9800" : "#f44336",
                color: "white",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 600,
                display: "inline-block"
              }}>
                Pewność AI: {(decision.aiConfidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "15px", padding: "12px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
            <strong style={{ display: "block", marginBottom: "6px" }}>Odpowiedź leada:</strong>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "14px" }}>{decision.leadResponse}</p>
          </div>

          <div style={{ marginBottom: "15px", padding: "12px", backgroundColor: "#e3f2fd", borderRadius: "4px" }}>
            <strong style={{ display: "block", marginBottom: "6px" }}>Uzasadnienie AI:</strong>
            <p style={{ margin: 0, fontSize: "13px", color: "#555" }}>{decision.aiReasoning}</p>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "14px" }}>
              Notatka (opcjonalnie):
            </label>
            <textarea
              value={decisionNote[decision.id] || ""}
              onChange={(e) => setDecisionNote({ ...decisionNote, [decision.id]: e.target.value })}
              placeholder="Dodaj notatkę do tej decyzji..."
              style={{
                width: "100%",
                minHeight: "60px",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
                fontFamily: "inherit"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => handleDecision(decision.id, "APPROVED")}
              disabled={processing === decision.id}
              style={{
                padding: "10px 20px",
                backgroundColor: processing === decision.id ? "#ccc" : "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: processing === decision.id ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "14px"
              }}
            >
              {processing === decision.id ? "Przetwarzanie..." : "Zatwierdź - Wyślij materiały"}
            </button>
            <button
              onClick={() => handleDecision(decision.id, "REJECTED")}
              disabled={processing === decision.id}
              style={{
                padding: "10px 20px",
                backgroundColor: processing === decision.id ? "#ccc" : "#f44336",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: processing === decision.id ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "14px"
              }}
            >
              {processing === decision.id ? "Przetwarzanie..." : "Odrzuć"}
            </button>
          </div>

          <div style={{ marginTop: "10px", fontSize: "12px", color: "#999" }}>
            Data odpowiedzi: {new Date(decision.reply.createdAt).toLocaleString('pl-PL')} • 
            Data decyzji: {new Date(decision.createdAt).toLocaleString('pl-PL')}
          </div>
        </div>
      ))}
    </div>
  );
}

