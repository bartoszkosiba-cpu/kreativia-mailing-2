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
  } | null;
  subject: string;
  responseText: string;
  sentAt: Date | null;
  status: string;
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
  campaignId: number;
}

export default function CampaignMaterialDecisions({ campaignId }: Props) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [sentMaterialResponses, setSentMaterialResponses] = useState<MaterialResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  
  // Modal state dla podglądu decyzji
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [decisionPreviewData, setDecisionPreviewData] = useState<PreviewData | null>(null);
  const [loadingDecisionPreview, setLoadingDecisionPreview] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  
  // State dla zarządzania decyzjami
  const [processing, setProcessing] = useState<number | null>(null);
  const [decisionNote, setDecisionNote] = useState<Record<number, string>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      // Pobierz oczekujące decyzje dla tej kampanii
      const decisionsResponse = await fetch(`/api/material-decisions?campaignId=${campaignId}`);
      const decisionsData = await decisionsResponse.json();
      
      if (decisionsData.success) {
        setDecisions(decisionsData.decisions || []);
      }

      // Pobierz historię wysłanych odpowiedzi dla tej kampanii
      const historyResponse = await fetch(`/api/campaigns/${campaignId}/auto-replies?type=material&status=sent&limit=50`);
      const historyData = await historyResponse.json();
      
      if (historyData.success) {
        // Konwertuj dane z API na format MaterialResponse
        const materialResponses = (historyData.data || [])
          .filter((item: any) => item.type === 'material')
          .map((item: any) => ({
            id: item.id,
            lead: item.lead,
            campaign: { id: campaignId, name: item.campaign?.name || '' },
            reply: item.reply,
            subject: item.subject || '',
            responseText: item.responseText || '',
            sentAt: item.sentAt || item.createdAt,
            status: item.status || 'sent'
          }));
        setSentMaterialResponses(materialResponses);
      }
    } catch (error: any) {
      console.error("Błąd pobierania danych:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [campaignId]);

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
    setLoadingDecisionPreview(false);
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
          decidedBy: "Administrator"
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      // Odśwież listę
      await fetchData();
      setProcessing(null);
      setDecisionNote({ ...decisionNote, [decisionId]: "" });
    } catch (error: any) {
      alert(`Błąd: ${error.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleResponseClick = async (response: MaterialResponse) => {
    setSelectedDecision(null);
    setDecisionPreviewData(null);
    setLoadingDecisionPreview(true);
    
    try {
      // Pobierz podgląd z zapisanej odpowiedzi
      const materialsResponse = await fetch(`/api/campaigns/${campaignId}/materials`);
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
      
      setDecisionPreviewData({
        subject: response.subject || 'Brak tematu',
        content: response.responseText || 'Brak treści',
        materials
      });
    } catch (error: any) {
      console.error("Błąd pobierania podglądu:", error);
      alert(`Błąd pobierania podglądu: ${error.message}`);
    } finally {
      setLoadingDecisionPreview(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Ładowanie...</div>;
  }

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
                      {decision.lead.company && `${decision.lead.company} • `}
                      Pewność AI: {(decision.aiConfidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: "15px", padding: "12px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                  <strong style={{ display: "block", marginBottom: "6px" }}>Odpowiedź leada:</strong>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "14px" }}>{decision.leadResponse}</p>
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
                      fontSize: "14px"
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
                  cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: "8px" }}>
                      {response.lead.firstName} {response.lead.lastName} ({response.lead.email})
                    </h3>
                    <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
                      {response.lead.company && `${response.lead.company} • `}
                      Wysłano: {response.sentAt ? new Date(response.sentAt).toLocaleString('pl-PL') : 'N/A'}
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
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal z podglądem decyzji lub historii */}
      {(selectedDecision || decisionPreviewData) && (
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
              padding: "30px",
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: "20px" }}>
              Podgląd odpowiedzi - {selectedDecision ? `${selectedDecision.lead.firstName} ${selectedDecision.lead.lastName}` : 'Historia'}
            </h2>

            {loadingDecisionPreview ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p>Ładowanie podglądu...</p>
              </div>
            ) : decisionPreviewData ? (
              <>
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
                  {selectedDecision ? (
                    <>
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
                          fontSize: "14px"
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
                          fontSize: "14px"
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
                    </>
                  ) : null}
                  <button
                    onClick={() => {
                      setSelectedDecision(null);
                      setDecisionPreviewData(null);
                    }}
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
    </div>
  );
}

