"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AutoReplyItem {
  id: number;
  type: "material" | "decision";
  lead: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
    company: string | null;
  };
  status: string;
  aiConfidence: number | null;
  aiReasoning?: string | null;
  createdAt: Date;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  subject?: string;
  responseText?: string;
  error?: string | null;
  material?: {
    id: number;
    name: string;
    type: string;
    fileName?: string | null;
    url?: string | null;
  } | null;
  reply?: {
    id: number;
    subject: string | null;
    content: string;
    receivedAt: Date;
  } | null;
  decidedAt?: Date | null;
  suggestedAction?: string;
  decisionNote?: string | null;
  leadResponse?: string;
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

export default function CampaignAutoRepliesHistory({ campaignId }: Props) {
  const [items, setItems] = useState<AutoReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [filterType, setFilterType] = useState<"all" | "material" | "decision">("all");
  const [filterStatus, setFilterStatus] = useState<string>("");
  
  // Modal state
  const [selectedItem, setSelectedItem] = useState<AutoReplyItem | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [processingDecision, setProcessingDecision] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", itemsPerPage.toString());
      params.append("offset", ((currentPage - 1) * itemsPerPage).toString());
      if (filterType !== "all") {
        params.append("type", filterType);
      }
      if (filterStatus) {
        params.append("status", filterStatus);
      }

      const response = await fetch(`/api/campaigns/${campaignId}/auto-replies?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setItems(data.data || []);
        setTotalItems(data.total || 0);
      }
    } catch (error: any) {
      console.error("Błąd pobierania historii:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [campaignId, currentPage, itemsPerPage, filterType, filterStatus]);

  const handleRowClick = async (item: AutoReplyItem) => {
    setSelectedItem(item);
    setDecisionNote("");
    setPreviewData(null);
    setLoadingPreview(true);

    try {
      if (item.type === "material") {
        // Dla MaterialResponse - użyj zapisanej odpowiedzi
        if (item.responseText && item.subject) {
          // Pobierz wszystkie materiały z kampanii
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
            : item.material ? [{
                id: item.material.id,
                name: item.material.name,
                type: item.material.type,
                url: item.material.url || null,
                fileName: item.material.fileName || null
              }] : [];
          
          setPreviewData({
            subject: item.subject,
            content: item.responseText,
            materials
          });
        }
      } else if (item.type === "decision") {
        // Dla PendingMaterialDecision - wygeneruj podgląd
        const response = await fetch(`/api/material-decisions/${item.id}/preview`);
        const data = await response.json();
        
        if (data.success) {
          setPreviewData(data.data);
        } else {
          alert(`Błąd: ${data.error}`);
        }
      }
    } catch (error: any) {
      console.error("Błąd pobierania podglądu:", error);
      alert(`Błąd pobierania podglądu: ${error.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setPreviewData(null);
    setDecisionNote("");
  };

  const handleApproveDecision = async () => {
    if (!selectedItem || selectedItem.type !== "decision") return;
    
    setProcessingDecision(true);
    try {
      const response = await fetch(`/api/material-decisions/${selectedItem.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "APPROVED",
          decisionNote: decisionNote.trim() || null,
          decidedBy: "Administrator"
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      // Odśwież listę i zamknij modal
      await fetchData();
      handleCloseModal();
    } catch (error: any) {
      alert(`Błąd: ${error.message}`);
    } finally {
      setProcessingDecision(false);
    }
  };

  const handleRejectDecision = async () => {
    if (!selectedItem || selectedItem.type !== "decision") return;
    
    setProcessingDecision(true);
    try {
      const response = await fetch(`/api/material-decisions/${selectedItem.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REJECTED",
          decisionNote: decisionNote.trim() || null,
          decidedBy: "Administrator"
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
        return;
      }

      // Odśwież listę i zamknij modal
      await fetchData();
      handleCloseModal();
    } catch (error: any) {
      alert(`Błąd: ${error.message}`);
    } finally {
      setProcessingDecision(false);
    }
  };

  const getStatusLabel = (status: string, type: "material" | "decision") => {
    if (type === "material") {
      const labels: Record<string, string> = {
        pending: "Oczekuje",
        scheduled: "Zaplanowano",
        sent: "Wysłano",
        failed: "Błąd"
      };
      return labels[status] || status;
    } else {
      const labels: Record<string, string> = {
        PENDING: "Oczekuje na decyzję",
        APPROVED: "Zatwierdzono",
        REJECTED: "Odrzucono"
      };
      return labels[status] || status;
    }
  };

  const getStatusColor = (status: string, type: "material" | "decision") => {
    if (type === "material") {
      const colors: Record<string, string> = {
        pending: "#ff9800",
        scheduled: "#2196f3",
        sent: "#4caf50",
        failed: "#f44336"
      };
      return colors[status] || "#999";
    } else {
      const colors: Record<string, string> = {
        PENDING: "#ff9800",
        APPROVED: "#4caf50",
        REJECTED: "#f44336"
      };
      return colors[status] || "#999";
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pl-PL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <>
      <div style={{ marginTop: "30px", padding: "20px", backgroundColor: "white", borderRadius: "8px" }}>
        <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Historia automatycznych odpowiedzi</h3>

        {/* Filtry */}
        <div style={{ display: "flex", gap: "15px", marginBottom: "20px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            <span>Typ:</span>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setCurrentPage(1);
              }}
              style={{
                padding: "6px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            >
              <option value="all">Wszystkie</option>
              <option value="material">Wysłane materiały</option>
              <option value="decision">Decyzje administratora</option>
            </select>
          </label>

          {filterType === "material" && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
              <span>Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px"
                }}
              >
                <option value="">Wszystkie</option>
                <option value="pending">Oczekuje</option>
                <option value="scheduled">Zaplanowano</option>
                <option value="sent">Wysłano</option>
                <option value="failed">Błąd</option>
              </select>
            </label>
          )}

          {filterType === "decision" && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
              <span>Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px"
                }}
              >
                <option value="">Wszystkie</option>
                <option value="PENDING">Oczekuje na decyzję</option>
                <option value="APPROVED">Zatwierdzono</option>
                <option value="REJECTED">Odrzucono</option>
              </select>
            </label>
          )}
        </div>

        {/* Tabela */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "#666" }}>Ładowanie...</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "#666" }}>Brak historii automatycznych odpowiedzi</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd", backgroundColor: "#f8f9fa" }}>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Data</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Typ</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Lead</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Pewność AI</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Szczegóły</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleRowClick(item)}
                      style={{
                        borderBottom: "1px solid #eee",
                        cursor: "pointer",
                        transition: "background-color 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f5f5f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "white";
                      }}
                    >
                      <td style={{ padding: "12px" }}>{formatDate(item.createdAt)}</td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 600,
                            backgroundColor: item.type === "material" ? "#e3f2fd" : "#fff3e0",
                            color: item.type === "material" ? "#1976d2" : "#e65100"
                          }}
                        >
                          {item.type === "material" ? "Materiały" : "Decyzja"}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <Link
                          href={`/leads/${item.lead.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "#2196f3", textDecoration: "none" }}
                        >
                          {item.lead.firstName} {item.lead.lastName}
                          <br />
                          <small style={{ color: "#666", fontSize: "12px" }}>{item.lead.email}</small>
                        </Link>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 600,
                            backgroundColor: getStatusColor(item.status, item.type) + "20",
                            color: getStatusColor(item.status, item.type)
                          }}
                        >
                          {getStatusLabel(item.status, item.type)}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        {item.aiConfidence !== null ? (
                          <span style={{ fontWeight: 600 }}>
                            {(item.aiConfidence * 100).toFixed(0)}%
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {item.type === "material" ? (
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            {item.subject && (
                              <div><strong>Temat:</strong> {item.subject}</div>
                            )}
                            {item.scheduledAt && (
                              <div><strong>Zaplanowano:</strong> {formatDate(item.scheduledAt)}</div>
                            )}
                            {item.sentAt && (
                              <div><strong>Wysłano:</strong> {formatDate(item.sentAt)}</div>
                            )}
                            {item.error && (
                              <div style={{ color: "#f44336" }}><strong>Błąd:</strong> {item.error}</div>
                            )}
                            {item.material && (
                              <div><strong>Materiał:</strong> {item.material.name}</div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            {item.suggestedAction && (
                              <div><strong>Sugestia AI:</strong> {item.suggestedAction}</div>
                            )}
                            {item.decidedAt && (
                              <div><strong>Zdecydowano:</strong> {formatDate(item.decidedAt)}</div>
                            )}
                            {item.decisionNote && (
                              <div><strong>Notatka:</strong> {item.decisionNote}</div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginacja */}
            {totalItems > itemsPerPage && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #ddd" }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    backgroundColor: currentPage === 1 ? "#f5f5f5" : "white",
                    borderRadius: "4px",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    fontSize: "14px"
                  }}
                >
                  Pierwsza
                </button>

                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    backgroundColor: currentPage === 1 ? "#f5f5f5" : "white",
                    borderRadius: "4px",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    fontSize: "14px"
                  }}
                >
                  Poprzednia
                </button>

                <div style={{ padding: "8px 16px", fontSize: "14px", fontWeight: 600 }}>
                  {currentPage} / {Math.ceil(totalItems / itemsPerPage)}
                </div>

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    backgroundColor: currentPage >= Math.ceil(totalItems / itemsPerPage) ? "#f5f5f5" : "white",
                    borderRadius: "4px",
                    cursor: currentPage >= Math.ceil(totalItems / itemsPerPage) ? "not-allowed" : "pointer",
                    fontSize: "14px"
                  }}
                >
                  Następna
                </button>

                <button
                  onClick={() => setCurrentPage(Math.ceil(totalItems / itemsPerPage))}
                  disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    backgroundColor: currentPage >= Math.ceil(totalItems / itemsPerPage) ? "#f5f5f5" : "white",
                    borderRadius: "4px",
                    cursor: currentPage >= Math.ceil(totalItems / itemsPerPage) ? "not-allowed" : "pointer",
                    fontSize: "14px"
                  }}
                >
                  Ostatnia
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal z podglądem */}
      {selectedItem && (
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
                Podgląd odpowiedzi - {selectedItem.lead.firstName} {selectedItem.lead.lastName}
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
                <p>Ładowanie podglądu...</p>
              </div>
            ) : previewData ? (
              <>
                {/* Informacje o leadzie i odpowiedzi */}
                <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
                  <div style={{ marginBottom: "10px" }}>
                    <strong>Email leada:</strong> {selectedItem.lead.email}
                  </div>
                  {selectedItem.reply && (
                    <div style={{ marginBottom: "10px" }}>
                      <strong>Odpowiedź leada:</strong>
                      <div style={{ marginTop: "5px", padding: "10px", backgroundColor: "white", borderRadius: "4px", whiteSpace: "pre-wrap" }}>
                        {selectedItem.reply.content}
                      </div>
                    </div>
                  )}
                  {selectedItem.aiReasoning && (
                    <div style={{ marginTop: "10px", fontSize: "13px", color: "#666" }}>
                      <strong>Uzasadnienie AI:</strong> {selectedItem.aiReasoning}
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

                {/* Akcje dla decyzji */}
                {selectedItem.type === "decision" && selectedItem.status === "PENDING" && (
                  <>
                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Notatka (opcjonalnie):</label>
                      <textarea
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="Dodaj notatkę do tej decyzji..."
                        style={{
                          width: "100%",
                          minHeight: "80px",
                          padding: "10px",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "14px",
                          fontFamily: "inherit"
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "15px", justifyContent: "flex-end" }}>
                      <button
                        onClick={handleRejectDecision}
                        disabled={processingDecision}
                        style={{
                          padding: "12px 24px",
                          backgroundColor: processingDecision ? "#ccc" : "#f44336",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: processingDecision ? "not-allowed" : "pointer",
                          fontWeight: 600,
                          fontSize: "16px"
                        }}
                      >
                        {processingDecision ? "Przetwarzanie..." : "Odrzuć"}
                      </button>
                      <button
                        onClick={handleApproveDecision}
                        disabled={processingDecision}
                        style={{
                          padding: "12px 24px",
                          backgroundColor: processingDecision ? "#ccc" : "#4caf50",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: processingDecision ? "not-allowed" : "pointer",
                          fontWeight: 600,
                          fontSize: "16px"
                        }}
                      >
                        {processingDecision ? "Przetwarzanie..." : "Zatwierdź - Wyślij materiały"}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p style={{ color: "#666" }}>Brak danych podglądu</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
