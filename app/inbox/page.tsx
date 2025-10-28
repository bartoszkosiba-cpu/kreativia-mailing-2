"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AIAgentButton from "./AIAgentButton";

interface InboxReply {
  id: number;
  subject: string;
  content: string;
  fromEmail: string;
  toEmail: string | null;
  receivedAt: string;
  classification: string | null;
  sentiment: string | null;
  aiSummary: string | null;
  suggestedAction: string | null;
  isRead: boolean;
  isHandled: boolean;
  wasForwarded: boolean;
  wasBlocked: boolean;
  newContactsAdded: number;
  lead: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    email: string;
  };
  campaign: {
    id: number;
    name: string;
  };
}

export default function InboxPage() {
  const [replies, setReplies] = useState<InboxReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [filter, setFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    fetchReplies();
  }, [filter, unreadOnly]);

  const fetchReplies = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (unreadOnly) params.set("unreadOnly", "true");
      
      const response = await fetch(`/api/inbox?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReplies(data);
      }
    } catch (error) {
      console.error("Błąd pobierania odpowiedzi:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchNew = async () => {
    if (!confirm("Pobrać nowe maile z serwera IMAP? To może potrwać chwilę.")) return;
    
    setIsFetching(true);
    try {
      const response = await fetch("/api/inbox/fetch", {
        method: "POST"
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`${data.message}\n\nSukces: ${data.success}\nBłędy: ${data.errors}`);
        fetchReplies();
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Błąd pobierania maili: ${error.message}`);
    } finally {
      setIsFetching(false);
    }
  };

  const markAsHandled = async (replyId: number) => {
    try {
      const response = await fetch(`/api/inbox/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHandled: true, isRead: true })
      });
      
      if (response.ok) {
        fetchReplies();
      }
    } catch (error) {
      console.error("Błąd oznaczania jako obsłużone:", error);
    }
  };

  const markAsRead = async (replyId: number) => {
    try {
      await fetch(`/api/inbox/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true })
      });
      fetchReplies();
    } catch (error) {
      console.error("Błąd oznaczania jako przeczytane:", error);
    }
  };

  const getClassificationColor = (classification: string | null) => {
    switch (classification) {
      case "INTERESTED": return "#28a745";
      case "UNSUBSCRIBE": return "#dc3545";
      case "OOO": return "#ffc107";
      case "REDIRECT": return "#17a2b8";
      case "BOUNCE": return "#6c757d";
      default: return "#007bff";
    }
  };

  const getClassificationIcon = (classification: string | null) => {
    switch (classification) {
      case "INTERESTED": return "●";
      case "UNSUBSCRIBE": return "■";
      case "OOO": return "□";
      case "REDIRECT": return "◆";
      case "BOUNCE": return "✖";
      case "NOT_INTERESTED": return "○";
      case "MAYBE_LATER": return "▸";
      default: return "○";
    }
  };

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</main>;
  }

  return (
    <div className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: "var(--spacing-2xl)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2.5rem", marginBottom: "var(--spacing-sm)" }}>
            Inbox - Do obsługi
          </h1>
          <p style={{ fontSize: "1.1rem", color: "var(--gray-600)" }}>
            Maile wymagające Twojej uwagi - zainteresowani i odpowiedzi
          </p>
        </div>
        <Link 
          href="/archive"
          className="btn"
          style={{
            backgroundColor: "var(--gray-100)",
            color: "var(--gray-700)",
            textDecoration: "none",
            border: "1px solid var(--gray-200)",
            fontWeight: "600",
            padding: "12px 24px"
          }}
        >
          Zobacz archiwum
        </Link>
      </div>

      {/* Kontrolki i filtry */}
      <div className="card" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <div style={{ display: "flex", gap: "var(--spacing-md)", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={handleFetchNew}
            disabled={isFetching}
            className="btn"
            style={{
              backgroundColor: isFetching ? "#ccc" : "var(--primary)",
              color: "white",
              border: "none",
              fontWeight: "600",
              padding: "12px 24px"
            }}
          >
            {isFetching ? "Pobieranie..." : "Pobierz nowe maile"}
          </button>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "var(--spacing-sm)",
              border: "1px solid var(--gray-300)",
              borderRadius: "var(--radius)",
              fontSize: "14px"
            }}
          >
            <option value="all">Wszystkie do obsługi</option>
            <option value="interested">Tylko zainteresowani</option>
            <option value="replies">Inne odpowiedzi</option>
          </select>

          <label style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "var(--spacing-sm)" }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              style={{ marginRight: "var(--spacing-xs)" }}
            />
            <span style={{ fontSize: "14px" }}>Tylko nieprzeczytane</span>
          </label>
        </div>
      </div>

      {/* Statystyki */}
      <div className="grid grid-4" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Zainteresowani</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--success)" }}>
            {replies.filter(r => r.classification === "INTERESTED").length}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Odpowiedzi</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--warning)" }}>
            {replies.filter(r => r.classification !== "INTERESTED" && r.classification !== null).length}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Nieprzeczytane</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--info)" }}>
            {replies.filter(r => !r.isRead).length}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Do obsługi</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--primary)" }}>
            {replies.filter(r => !r.isHandled).length}
          </div>
        </div>
      </div>

      {/* Lista odpowiedzi */}
      <div>
        {replies.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "var(--spacing-2xl)", color: "var(--gray-600)" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "var(--spacing-sm)" }}>Brak odpowiedzi.</p>
            <p style={{ fontSize: "14px" }}>Kliknij "Pobierz nowe maile" aby sprawdzić skrzynkę.</p>
          </div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--gray-200)" }}>
                  <th style={{ padding: "var(--spacing-md)", textAlign: "left", width: "40px" }}></th>
                  <th style={{ padding: "var(--spacing-md)", textAlign: "left" }}>Od / Do</th>
                  <th style={{ padding: "var(--spacing-md)", textAlign: "left" }}>Temat</th>
                  <th style={{ padding: "var(--spacing-md)", textAlign: "left", width: "150px" }}>Data</th>
                  <th style={{ padding: "var(--spacing-md)", textAlign: "left", width: "120px" }}>Typ</th>
                  <th style={{ padding: "var(--spacing-md)", textAlign: "left", width: "100px" }}>Akcje</th>
                </tr>
              </thead>
            <tbody>
              {replies
                .sort((a, b) => {
                  // INTERESTED zawsze na górze
                  if (a.classification === "INTERESTED" && b.classification !== "INTERESTED") return -1;
                  if (a.classification !== "INTERESTED" && b.classification === "INTERESTED") return 1;
                  // Potem nieobsłużone
                  if (!a.isHandled && b.isHandled) return -1;
                  if (a.isHandled && !b.isHandled) return 1;
                  // Potem nieprzeczytane
                  if (!a.isRead && b.isRead) return -1;
                  if (a.isRead && !b.isRead) return 1;
                  // Ostatecznie po dacie
                  return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
                })
                .map((reply) => (
                <tr
                  key={reply.id}
                  style={{
                    backgroundColor: reply.isRead ? "#fff" : "#f0f8ff",
                    borderBottom: "1px solid var(--gray-200)",
                    cursor: "pointer"
                  }}
                  onClick={() => !reply.isRead && markAsRead(reply.id)}
                >
                  {/* Ikona */}
                  <td style={{ padding: "var(--spacing-md)", textAlign: "center" }}>
                    <span style={{ fontSize: "1.2rem", color: getClassificationColor(reply.classification) }}>{getClassificationIcon(reply.classification)}</span>
                  </td>
                  
                  {/* Od / Do */}
                  <td style={{ padding: "var(--spacing-md)" }}>
                    {reply.lead ? (
                      <div>
                        <strong>{reply.lead.firstName || ""} {reply.lead.lastName || ""}</strong>
                        {reply.lead.company && <div style={{ fontSize: "12px", color: "#666" }}>{reply.lead.company}</div>}
                      </div>
                    ) : (
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        <div>{reply.fromEmail}</div>
                        {reply.toEmail && <div style={{ color: "#999" }}>→ {reply.toEmail}</div>}
                      </div>
                    )}
                  </td>
                  
                  {/* Temat */}
                  <td style={{ padding: "var(--spacing-md)" }}>
                    <div style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {reply.subject}
                    </div>
                    {reply.aiSummary && (
                      <div style={{ fontSize: "11px", color: "var(--gray-600)", marginTop: 4 }}>
                        {reply.aiSummary.substring(0, 80)}...
                      </div>
                    )}
                  </td>
                  
                  {/* Data */}
                  <td style={{ padding: "var(--spacing-md)", fontSize: "12px", color: "var(--gray-600)" }}>
                    {new Date(reply.receivedAt).toLocaleDateString("pl-PL")}
                    <br />
                    {new Date(reply.receivedAt).toLocaleTimeString("pl-PL")}
                  </td>
                  
                  {/* Typ */}
                  <td style={{ padding: "var(--spacing-md)", fontSize: "11px" }}>
                    <div style={{
                      padding: "4px 8px",
                      backgroundColor: getClassificationColor(reply.classification),
                      color: "white",
                      borderRadius: "var(--radius)",
                      textAlign: "center"
                    }}>
                      {reply.classification?.replace("_", " ")}
                    </div>
                    {reply.campaign && (
                      <div style={{ marginTop: 4, fontSize: "10px", color: "var(--gray-600)" }}>
                        {reply.campaign.name}
                      </div>
                    )}
                  </td>
                  
                  {/* Akcje */}
                  <td style={{ padding: "var(--spacing-md)" }}>
                    {reply.lead && (
                      <Link
                        href={`/leads/${reply.lead.id}`}
                        className="btn"
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "var(--primary)",
                          color: "white",
                          textDecoration: "none",
                          borderRadius: "var(--radius)",
                          fontSize: "11px",
                          fontWeight: "600"
                        }}
                      >
                        Lead
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Informacje */}
      <div className="card" style={{ marginTop: "var(--spacing-2xl)" }}>
        <h3 style={{ marginTop: 0 }}>Co pokazuje inbox?</h3>
        <p style={{ fontSize: "14px", marginBottom: 12 }}>
          Tutaj są <strong>tylko te maile, które wymagają Twojej uwagi</strong> - zainteresowani i odpowiedzi. 
          Pełne archiwum wszystkich maili znajdziesz w <Link href="/archive" style={{ color: "var(--primary)" }}>Archiwum</Link>.
        </p>
        <ul style={{ fontSize: "14px", margin: 0 }}>
          <li><strong>Zainteresowani</strong> - najważniejsze! Automatycznie forwarded, ale sprawdź czy wszystko OK</li>
          <li><strong>Inne odpowiedzi</strong> - np. NOT_INTERESTED, MAYBE_LATER - warto sprawdzić co piszą</li>
          <li><strong>Oznacz jako obsłużone</strong> - usuwa z listy (maile i tak zostają w archiwum)</li>
          <li><strong>Auto-obsłużone</strong> - OOO/REDIRECT z nowymi kontaktami - już dodane do bazy</li>
        </ul>
      </div>
    </div>
  );
}

