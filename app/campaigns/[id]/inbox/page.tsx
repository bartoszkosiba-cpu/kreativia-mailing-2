"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AIAgentButton from "../../../inbox/AIAgentButton";

interface InboxReply {
  id: number;
  messageId: string;
  threadId: string | null;
  subject: string;
  content: string;
  fromEmail: string;
  receivedAt: string;
  classification: string | null;
  sentiment: string | null;
  aiSummary: string | null;
  suggestedAction: string | null;
  extractedEmails: string;
  extractedData: string;
  wasForwarded: boolean;
  forwardedAt: string | null;
  wasBlocked: boolean;
  newContactsAdded: number;
  isRead: boolean;
  isHandled: boolean;
  handledAt: string | null;
  handledNote: string | null;
  campaignId: number | null;
  leadId: number | null;
  lead: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
    company: string | null;
  } | null;
  campaign: {
    id: number;
    name: string;
  } | null;
}

export default function CampaignInboxPage({ params }: { params: { id: string } }) {
  const campaignId = Number(params.id);
  const [replies, setReplies] = useState<InboxReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [filter, setFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [campaignName, setCampaignName] = useState("Ładowanie...");
  const [isInitialized, setIsInitialized] = useState(false);

  // Ustaw filtr z URL params przy pierwszym załadowaniu
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlFilter = urlParams.get('filter');
      if (urlFilter) {
        setFilter(urlFilter);
      }
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    fetchCampaignDetails();
  }, [campaignId]);

  useEffect(() => {
    // Poczekaj aż filtr zostanie ustawiony z URL
    if (isInitialized) {
      fetchReplies();
    }
  }, [filter, unreadOnly, isInitialized, campaignId]);

  const fetchCampaignDetails = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setCampaignName(data.campaignName);
      } else {
        setCampaignName("Nieznana kampania");
      }
    } catch (error) {
      console.error("Error fetching campaign details:", error);
      setCampaignName("Błąd ładowania nazwy kampanii");
    }
  };

  const fetchReplies = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("campaignId", campaignId.toString());
      if (filter !== "all") params.set("filter", filter);
      if (unreadOnly) params.set("unreadOnly", "true");

      const response = await fetch(`/api/inbox?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Filtruj powiadomienia "[LEAD ZAINTERESOWANY]" - to są maile powiadomieniowe, nie odpowiedzi leadów
        const filteredData = Array.isArray(data) 
          ? data.filter((reply: InboxReply) => 
              !reply.subject?.includes('[LEAD ZAINTERESOWANY]') && 
              !reply.subject?.includes('[NOWY LEAD]')
            )
          : (data.data || []).filter((reply: InboxReply) => 
              !reply.subject?.includes('[LEAD ZAINTERESOWANY]') && 
              !reply.subject?.includes('[NOWY LEAD]')
            );
        setReplies(Array.isArray(filteredData) ? filteredData : filteredData);
      } else {
        console.error("Failed to fetch replies");
      }
    } catch (error) {
      console.error("Error fetching replies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (replyId: number) => {
    try {
      await fetch(`/api/inbox/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      setReplies((prev) =>
        prev.map((reply) => (reply.id === replyId ? { ...reply, isRead: true } : reply))
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAsHandled = async (replyId: number) => {
    try {
      await fetch(`/api/inbox/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHandled: true }),
      });
      setReplies((prev) =>
        prev.map((reply) => (reply.id === replyId ? { ...reply, isHandled: true } : reply))
      );
    } catch (error) {
      console.error("Error marking as handled:", error);
    }
  };

  const getClassificationColor = (classification: string | null) => {
    switch (classification) {
      case "INTERESTED": return "#28a745";
      case "NOT_INTERESTED": return "#ffc107";
      case "UNSUBSCRIBE": return "#dc3545";
      case "OOO": return "#17a2b8";
      case "REDIRECT": return "#6f42c1";
      case "BOUNCE": return "#6c757d";
      default: return "#007bff";
    }
  };

  const getClassificationEmoji = (classification: string | null) => {
    switch (classification) {
      case "INTERESTED": return "✅";
      case "NOT_INTERESTED": return "❌";
      case "UNSUBSCRIBE": return "🚫";
      case "OOO": return "🏖️";
      case "REDIRECT": return "🔄";
      case "BOUNCE": return "📧";
      default: return "❓";
    }
  };

  const getSentimentEmoji = (sentiment: string | null) => {
    switch (sentiment) {
      case "positive": return "😊";
      case "negative": return "😠";
      case "neutral": return "😐";
      default: return "";
    }
  };

  const handleFetchNewEmails = async () => {
    setIsFetching(true);
    try {
      const response = await fetch("/api/inbox/fetch", { method: "POST" });
      if (response.ok) {
        alert("Pobieranie maili rozpoczęte w tle.");
        fetchReplies();
      } else {
        alert("Błąd podczas pobierania maili.");
      }
    } catch (error) {
      console.error("Error fetching new emails:", error);
      alert("Wystąpił błąd sieci podczas pobierania maili.");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>📥 Inbox kampanii: {campaignName}</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/inbox"
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--gray-500)",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            ← Globalny Inbox
          </Link>
          <button
            onClick={handleFetchNewEmails}
            disabled={isFetching}
            style={{
              padding: "8px 16px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              opacity: isFetching ? 0.7 : 1
            }}
          >
            {isFetching ? "Pobieram..." : "Pobierz nowe maile"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <label>
          Filtruj:
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ marginLeft: 8, padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc" }}
          >
            <option value="all">Wszystkie</option>
            <option value="INTERESTED">Zainteresowane</option>
            <option value="NOT_INTERESTED">Niezainteresowane</option>
            <option value="UNSUBSCRIBE">Wypisane</option>
            <option value="OOO">Out of Office</option>
            <option value="REDIRECT">Przekierowania</option>
            <option value="BOUNCE">Odbite</option>
            <option value="OTHER">Inne</option>
          </select>
        </label>
        <label style={{ marginLeft: 20 }}>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            style={{ marginRight: 5 }}
          />
          Tylko nieprzeczytane
        </label>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 16, backgroundColor: "#d4edda", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {replies.filter(r => r.classification === "INTERESTED").length}
          </div>
          <div style={{ fontSize: "12px", color: "#155724" }}>Zainteresowani</div>
        </div>
        <div style={{ padding: 16, backgroundColor: "#fff3cd", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {replies.filter(r => r.classification === "NOT_INTERESTED").length}
          </div>
          <div style={{ fontSize: "12px", color: "#856404" }}>Niezainteresowani</div>
        </div>
        <div style={{ padding: 16, backgroundColor: "#f8d7da", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {replies.filter(r => r.classification === "UNSUBSCRIBE").length}
          </div>
          <div style={{ fontSize: "12px", color: "#721c24" }}>Wypisani</div>
        </div>
        <div style={{ padding: 16, backgroundColor: "#fff3cd", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {replies.filter(r => r.classification === "OOO").length}
          </div>
          <div style={{ fontSize: "12px", color: "#856404" }}>OOO</div>
        </div>
        <div style={{ padding: 16, backgroundColor: "#e8f4fd", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {replies.filter(r => !r.isHandled).length}
          </div>
          <div style={{ fontSize: "12px", color: "#004085" }}>Do obsługi</div>
        </div>
      </div>

      {/* Lista odpowiedzi */}
      <div>
        {isLoading ? (
          <p style={{ textAlign: "center", padding: 40, color: "#666" }}>Ładowanie odpowiedzi...</p>
        ) : replies.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
            <p>Brak odpowiedzi dla tej kampanii.</p>
            <p style={{ fontSize: "14px" }}>Kliknij "Pobierz nowe maile" aby sprawdzić skrzynkę.</p>
          </div>
        ) : (
          replies.map((reply) => (
            <div
              key={reply.id}
              style={{
                marginBottom: 16,
                padding: 16,
                backgroundColor: reply.isRead ? "#fff" : "#f0f8ff",
                border: `2px solid ${getClassificationColor(reply.classification)}`,
                borderRadius: 8,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
              onClick={() => !reply.isRead && markAsRead(reply.id)}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "1.5rem" }}>{getClassificationEmoji(reply.classification)}</span>
                  <div>
                    <strong style={{ fontSize: "1.1rem", color: getClassificationColor(reply.classification) }}>
                      {reply.classification} {getSentimentEmoji(reply.sentiment)}
                    </strong>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      Od: <strong>{reply.fromEmail}</strong> • Lead: {reply.lead?.firstName} {reply.lead?.lastName} ({reply.lead?.email}) • {reply.lead?.company}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      📅 {new Date(reply.receivedAt).toLocaleString("pl-PL")}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {reply.isHandled && (
                    <span style={{ padding: "4px 8px", backgroundColor: "#e9ecef", borderRadius: 4, fontSize: "12px", color: "#6c757d" }}>
                      Obsłużone
                    </span>
                  )}
                  {reply.wasForwarded && (
                    <span style={{ padding: "4px 8px", backgroundColor: "#e9ecef", borderRadius: 4, fontSize: "12px", color: "#6c757d" }}>
                      Przekazano
                    </span>
                  )}
                  {reply.wasBlocked && (
                    <span style={{ padding: "4px 8px", backgroundColor: "#e9ecef", borderRadius: 4, fontSize: "12px", color: "#6c757d" }}>
                      Zablokowano
                    </span>
                  )}
                  {reply.newContactsAdded > 0 && (
                    <span style={{ padding: "4px 8px", backgroundColor: "#e9ecef", borderRadius: 4, fontSize: "12px", color: "#6c757d" }}>
                      ➕ {reply.newContactsAdded} nowy kontakt
                    </span>
                  )}
                </div>
              </div>

              {/* AI Summary & Suggested Action */}
              {(reply.aiSummary || reply.suggestedAction) && (
                <div style={{
                  backgroundColor: "#f8f9fa",
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 12,
                  borderLeft: "3px solid #007bff"
                }}>
                  {reply.aiSummary && (
                    <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#343a40" }}>
                      🤖 AI Podsumowanie: <strong>{reply.aiSummary}</strong>
                    </p>
                  )}
                  {reply.suggestedAction && (
                    <p style={{ margin: 0, fontSize: "14px", color: "#343a40" }}>
                      💡 Sugerowana akcja: <em>{reply.suggestedAction}</em>
                    </p>
                  )}
                </div>
              )}

              {/* Treść */}
              <details style={{ marginBottom: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: "bold", marginBottom: 8 }}>
                  📄 Temat: {reply.subject}
                </summary>
                <div style={{
                  whiteSpace: "pre-wrap",
                  padding: 12,
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  fontSize: "14px",
                  marginTop: 8,
                  maxHeight: 300,
                  overflowY: "auto"
                }}>
                  {reply.content}
                </div>
              </details>

              {/* Akcje */}
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                <AIAgentButton
                  replyId={reply.id}
                  onProcessed={fetchReplies}
                />

                {!reply.isHandled && (
                  <button
                    onClick={() => markAsHandled(reply.id)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    ✅ Oznacz jako obsłużone
                  </button>
                )}

                <Link
                  href={`/leads/${reply.lead?.id || '#'}`}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#0066cc",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: 4,
                    fontSize: "12px",
                    display: "inline-block"
                  }}
                >
                  👤 Zobacz kontakt
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}