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

interface MaterialResponse {
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
    subject: string | null;
    content: string;
    receivedAt: Date;
  } | null; // ✅ Może być null
  status: string;
  subject: string | null;
  responseText: string | null;
  sentAt: Date | null;
  createdAt: Date;
  aiConfidence: number | null;
}

interface PreviewData {
  subject: string;
  content: string;
  materials: Array<{
    id: number;
    name: string;
    type: string;
    url?: string | null;
    fileName?: string | null;
  }>;
}

interface Props {
  initialDecisions: any[];
  sentMaterialResponses?: MaterialResponse[];
}

export default function MaterialDecisionsClient({ initialDecisions, sentMaterialResponses = [] }: Props) {
  const [decisions, setDecisions] = useState<Decision[]>(initialDecisions);
  const [processing, setProcessing] = useState<number | null>(null);
  const [decisionNote, setDecisionNote] = useState<{ [key: number]: string }>({});
  const [showHistory, setShowHistory] = useState(false);
  
  // Modal state dla historii wysłanych
  const [selectedResponse, setSelectedResponse] = useState<MaterialResponse | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Modal state dla podglądu decyzji przed akceptacją
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [decisionPreviewData, setDecisionPreviewData] = useState<PreviewData | null>(null);
  const [loadingDecisionPreview, setLoadingDecisionPreview] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const handleShowPreview = async (decision: Decision) => {
    setSelectedDecision(decision);
    setDecisionPreviewData(null);
    setLoadingDecisionPreview(true);

    try {
      const response = await fetch(`/api/material-decisions/${decision.id}/preview`);
      const data = await response.json();
      
      if (data.success) {
        setDecisionPreviewData(data.data);
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error: any) {
      console.error("Błąd pobierania podglądu:", error);
      alert(`Błąd pobierania podglądu: ${error.message}`);
    } finally {
      setLoadingDecisionPreview(false);
    }
  };

  const handleRefreshPreview = async () => {
    if (!selectedDecision) return;
    
    setRefreshingPreview(true);
    try {
      const response = await fetch(`/api/material-decisions/${selectedDecision.id}/refresh`, {
        method: "POST"
      });
      const data = await response.json();
      
      if (data.success) {
        setDecisionPreviewData(data.data);
        alert("✓ Odpowiedź została odświeżona z aktualnymi ustawieniami kampanii");
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error: any) {
      console.error("Błąd odświeżania podglądu:", error);
      alert(`Błąd odświeżania podglądu: ${error.message}`);
    } finally {
      setRefreshingPreview(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedDecision) return;
    
    if (!confirm("Czy na pewno chcesz wysłać testowy email na adres bartosz.kosiba@kreativia.pl?")) {
      return;
    }
    
    setSendingTest(true);
    try {
      const response = await fetch(`/api/material-decisions/${selectedDecision.id}/send-test`, {
        method: "POST"
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`✓ Testowy email został wysłany na adres bartosz.kosiba@kreativia.pl`);
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error: any) {
      console.error("Błąd wysyłki testowej:", error);
      alert(`Błąd wysyłki testowej: ${error.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  const handleCloseDecisionPreview = () => {
    setSelectedDecision(null);
    setDecisionPreviewData(null);
  };

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

  const handleResponseClick = async (response: MaterialResponse) => {
    setSelectedResponse(response);
    setPreviewData(null);
    setLoadingPreview(true);

    try {
      // Pobierz wszystkie materiały z kampanii
      const materialsResponse = await fetch(`/api/campaigns/${response.campaign.id}/materials`);
      const materialsData = await materialsResponse.json();
      
      const materials = materialsData.success && materialsData.data 
        ? materialsData.data.filter((m: any) => m.isActive).map((m: any) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            url: m.url || null,
            fileName: m.fileName || null
          }))
        : [];
      
      setPreviewData({
        subject: response.subject || 'Brak tematu',
        content: response.responseText || 'Brak treści',
        materials
      });
    } catch (error: any) {
      console.error("Błąd pobierania podglądu:", error);
      alert(`Błąd pobierania podglądu: ${error.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedResponse(null);
    setPreviewData(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Tabs: Oczekujące / Historia */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #ddd" }}>
        <button
          onClick={() => setShowHistory(false)}
          style={{
            padding: "12px 24px",
            backgroundColor: showHistory ? "transparent" : "#2196f3",
            color: showHistory ? "#666" : "white",
            border: "none",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            borderBottom: showHistory ? "none" : "2px solid #2196f3",
            marginBottom: "-2px"
          }}
        >
          Oczekujące decyzje ({decisions.length})
        </button>
        <button
          onClick={() => setShowHistory(true)}
          style={{
            padding: "12px 24px",
            backgroundColor: showHistory ? "#2196f3" : "transparent",
            color: showHistory ? "white" : "#666",
            border: "none",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            borderBottom: showHistory ? "2px solid #2196f3" : "none",
            marginBottom: "-2px"
          }}
        >
          Historia wysłanych ({sentMaterialResponses.length})
        </button>
      </div>

      {/* Zawartość zakładek */}
      {!showHistory ? (
        // ZAKŁADKA: Oczekujące decyzje
        decisions.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", backgroundColor: "white", borderRadius: "8px" }}>
            <p style={{ fontSize: "18px", color: "#666" }}>
              Brak oczekujących decyzji!
            </p>
            <p style={{ marginTop: "10px", color: "#999" }}>
              Wszystkie prośby o materiały zostały przetworzone.
            </p>
          </div>
        ) : (
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

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => handleShowPreview(decision)}
              style={{
                padding: "10px 20px",
                backgroundColor: "#2196f3",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "14px"
              }}
            >
              Pokaż podgląd odpowiedzi
            </button>
            <button
              onClick={async () => {
                if (!confirm("Czy na pewno chcesz wysłać testowy email na adres bartosz.kosiba@kreativia.pl?")) {
                  return;
                }
                setSendingTest(true);
                try {
                  const response = await fetch(`/api/material-decisions/${decision.id}/send-test`, {
                    method: "POST"
                  });
                  const data = await response.json();
                  
                  if (data.success) {
                    alert(`✓ Testowy email został wysłany na adres bartosz.kosiba@kreativia.pl`);
                  } else {
                    alert(`Błąd: ${data.error}`);
                  }
                } catch (error: any) {
                  console.error("Błąd wysyłki testowej:", error);
                  alert(`Błąd wysyłki testowej: ${error.message}`);
                } finally {
                  setSendingTest(false);
                }
              }}
              disabled={sendingTest}
              style={{
                padding: "10px 20px",
                backgroundColor: sendingTest ? "#ccc" : "#2196f3",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: sendingTest ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "14px",
                boxShadow: sendingTest ? "none" : "0 2px 4px rgba(33, 150, 243, 0.3)"
              }}
            >
              {sendingTest ? "Wysyłanie..." : "📧 Wyślij testowy email"}
            </button>
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
        )
      ) : (
        // ZAKŁADKA: Historia wysłanych
        sentMaterialResponses.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", backgroundColor: "white", borderRadius: "8px" }}>
            <p style={{ fontSize: "18px", color: "#666" }}>
              Brak wysłanych odpowiedzi!
            </p>
            <p style={{ marginTop: "10px", color: "#999" }}>
              Historia wysłanych automatycznych odpowiedzi pojawi się tutaj.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {sentMaterialResponses.map((response) => (
              <div
                key={response.id}
                onClick={() => handleResponseClick(response)}
                style={{
                  padding: "20px",
                  backgroundColor: "white",
                  borderRadius: "8px",
                  border: "1px solid #4caf50",
                  cursor: "pointer",
                  transition: "box-shadow 0.2s, transform 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: "8px" }}>
                      {response.lead.firstName} {response.lead.lastName} ({response.lead.email})
                    </h3>
                    <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
                      Kampania: <strong>{response.campaign.name}</strong>
                      {response.lead.company && ` • ${response.lead.company}`}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      padding: "6px 12px",
                      backgroundColor: "#4caf50",
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-block"
                    }}>
                      Wysłano
                    </div>
                  </div>
                </div>

                {response.subject && (
                  <div style={{ marginBottom: "15px", padding: "12px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                    <strong style={{ display: "block", marginBottom: "6px" }}>Temat:</strong>
                    <p style={{ margin: 0, fontSize: "14px" }}>{response.subject}</p>
                  </div>
                )}

                {response.responseText && (
                  <div style={{ marginBottom: "15px", padding: "12px", backgroundColor: "#e8f5e9", borderRadius: "4px" }}>
                    <strong style={{ display: "block", marginBottom: "6px" }}>Treść odpowiedzi:</strong>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "14px" }}>{response.responseText.substring(0, 200)}{response.responseText.length > 200 ? '...' : ''}</p>
                  </div>
                )}

                <div style={{ marginTop: "10px", fontSize: "12px", color: "#999" }}>
                  Data odpowiedzi leada: {response.reply ? new Date(response.reply.receivedAt).toLocaleString('pl-PL') : 'N/A'} • 
                  Data wysyłki: {response.sentAt ? new Date(response.sentAt).toLocaleString('pl-PL') : 'N/A'}
                </div>

                <div style={{ marginTop: "10px" }}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/campaigns/${response.campaign.id}`;
                    }}
                    style={{
                      color: "#2196f3",
                      textDecoration: "none",
                      fontSize: "14px",
                      cursor: "pointer"
                    }}
                  >
                    → Zobacz szczegóły w kampanii
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal z podglądem decyzji przed akceptacją */}
      {selectedDecision && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
          onClick={handleCloseDecisionPreview}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "30px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>
                Podgląd odpowiedzi - {selectedDecision.lead.firstName} {selectedDecision.lead.lastName}
              </h2>
              <button
                onClick={handleCloseDecisionPreview}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#666",
                  padding: "0",
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ×
              </button>
            </div>

            {loadingDecisionPreview ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>Ładowanie podglądu...</p>
              </div>
            ) : decisionPreviewData ? (
              <>
                {/* Informacja o możliwości odświeżenia */}
                <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>ℹ️</span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: "block", marginBottom: "4px" }}>Uwaga:</strong>
                      <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                        Ta odpowiedź została wygenerowana na podstawie aktualnych ustawień kampanii. Jeśli wprowadziłeś zmiany w ustawieniach automatycznych odpowiedzi, kliknij <strong>"Odśwież odpowiedź"</strong> poniżej, aby zastosować nowe ustawienia.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informacje o leadzie */}
                <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                  <div style={{ marginBottom: "10px" }}>
                    <strong>Email leada:</strong> {selectedDecision.lead.email}
                  </div>
                  {selectedDecision.lead.company && (
                    <div style={{ marginBottom: "10px" }}>
                      <strong>Firma:</strong> {selectedDecision.lead.company}
                    </div>
                  )}
                  <div style={{ marginBottom: "10px" }}>
                    <strong>Kampania:</strong> {selectedDecision.campaign.name}
                  </div>
                  <div style={{ marginTop: "10px" }}>
                    <strong>Odpowiedź leada:</strong>
                    <div style={{ marginTop: "5px", padding: "10px", backgroundColor: "white", borderRadius: "4px", whiteSpace: "pre-wrap", fontSize: "14px" }}>
                      {selectedDecision.leadResponse}
                    </div>
                  </div>
                </div>

                {/* Podgląd odpowiedzi */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Temat:</label>
                  <div style={{ padding: "12px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                    {decisionPreviewData.subject}
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Treść odpowiedzi:</label>
                  <div style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa", whiteSpace: "pre-wrap", minHeight: "100px" }}>
                    {decisionPreviewData.content}
                  </div>
                </div>

                {/* Materiały */}
                {decisionPreviewData.materials.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Materiały:</label>
                    <div style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                      {decisionPreviewData.materials.map((mat, idx) => (
                        <div key={idx} style={{ marginBottom: "10px", padding: "10px", backgroundColor: "white", borderRadius: "4px" }}>
                          <strong>{mat.name}</strong> ({mat.type === "LINK" ? "Link" : "Załącznik"})
                          {mat.type === "LINK" && mat.url && (
                            <div style={{ marginTop: "5px" }}>
                              <a href={mat.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2196f3" }}>
                                {mat.url}
                              </a>
                            </div>
                          )}
                          {mat.type === "ATTACHMENT" && mat.fileName && (
                            <div style={{ marginTop: "5px", fontSize: "13px", color: "#666" }}>
                              Plik: {mat.fileName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={handleRefreshPreview}
                    disabled={refreshingPreview}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: refreshingPreview ? "#ccc" : "#ff9800",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: refreshingPreview ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "14px",
                      boxShadow: refreshingPreview ? "none" : "0 2px 4px rgba(255, 152, 0, 0.3)"
                    }}
                  >
                    {refreshingPreview ? "Odświeżanie..." : "🔄 Odśwież odpowiedź"}
                  </button>
                  <button
                    onClick={handleSendTest}
                    disabled={sendingTest}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: sendingTest ? "#ccc" : "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: sendingTest ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "14px",
                      boxShadow: sendingTest ? "none" : "0 2px 4px rgba(33, 150, 243, 0.3)"
                    }}
                  >
                    {sendingTest ? "Wysyłanie..." : "📧 Wyślij testowy email"}
                  </button>
                  <button
                    onClick={() => {
                      handleCloseDecisionPreview();
                      handleDecision(selectedDecision.id, "APPROVED");
                    }}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#4caf50",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "14px"
                    }}
                  >
                    Zatwierdź i wyślij
                  </button>
                  <button
                    onClick={handleCloseDecisionPreview}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#666",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "14px"
                    }}
                  >
                    Zamknij
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>Nie można załadować podglądu.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal z podglądem szczegółów wysłanej odpowiedzi */}
      {selectedResponse && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "30px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>
                Szczegóły wysłanej odpowiedzi - {selectedResponse.lead.firstName} {selectedResponse.lead.lastName}
              </h2>
              <button
                onClick={handleCloseModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#666",
                  padding: "0",
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ×
              </button>
            </div>

            {loadingPreview ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>Ładowanie szczegółów...</p>
              </div>
            ) : previewData ? (
              <>
                {/* Informacje o leadzie */}
                <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                  <div style={{ marginBottom: "10px" }}>
                    <strong>Email leada:</strong> {selectedResponse.lead.email}
                  </div>
                  {selectedResponse.lead.company && (
                    <div style={{ marginBottom: "10px" }}>
                      <strong>Firma:</strong> {selectedResponse.lead.company}
                    </div>
                  )}
                  <div style={{ marginBottom: "10px" }}>
                    <strong>Kampania:</strong> {selectedResponse.campaign.name}
                  </div>
                  {selectedResponse.reply && (
                    <div style={{ marginTop: "10px" }}>
                      <strong>Odpowiedź leada:</strong>
                      <div style={{ marginTop: "5px", padding: "10px", backgroundColor: "white", borderRadius: "4px", whiteSpace: "pre-wrap", fontSize: "14px" }}>
                        {selectedResponse.reply.content}
                      </div>
                    </div>
                  )}
                  {selectedResponse.sentAt && (
                    <div style={{ marginTop: "10px", fontSize: "13px", color: "#666" }}>
                      <strong>Data wysyłki:</strong> {new Date(selectedResponse.sentAt).toLocaleString('pl-PL')}
                    </div>
                  )}
                </div>

                {/* Podgląd odpowiedzi */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Temat:</label>
                  <div style={{ padding: "12px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                    {previewData.subject}
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Treść odpowiedzi:</label>
                  <div style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa", whiteSpace: "pre-wrap", minHeight: "100px" }}>
                    {previewData.content}
                  </div>
                </div>

                {/* Materiały */}
                {previewData.materials.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Materiały:</label>
                    <div style={{ padding: "15px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                      {previewData.materials.map((mat, idx) => (
                        <div key={idx} style={{ marginBottom: "10px", padding: "10px", backgroundColor: "white", borderRadius: "4px" }}>
                          <strong>{mat.name}</strong> ({mat.type === "LINK" ? "Link" : "Załącznik"})
                          {mat.type === "LINK" && mat.url && (
                            <div style={{ marginTop: "5px" }}>
                              <a href={mat.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2196f3" }}>
                                {mat.url}
                              </a>
                            </div>
                          )}
                          {mat.type === "ATTACHMENT" && mat.fileName && (
                            <div style={{ marginTop: "5px", fontSize: "13px", color: "#666" }}>
                              Plik: {mat.fileName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => window.location.href = `/campaigns/${selectedResponse.campaign.id}`}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "14px"
                    }}
                  >
                    Zobacz w kampanii
                  </button>
                  <button
                    onClick={handleCloseModal}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#666",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "14px"
                    }}
                  >
                    Zamknij
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>Nie można załadować szczegółów.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

