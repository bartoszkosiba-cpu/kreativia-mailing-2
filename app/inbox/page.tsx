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
      case "INTERESTED": return "🟢";
      case "UNSUBSCRIBE": return "🚫";
      case "OOO": return "⏸️";
      case "REDIRECT": return "🔄";
      case "BOUNCE": return "❌";
      default: return "⚪";
    }
  };

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>📬 Inbox - Do obsługi</h1>
          <p style={{ color: "var(--gray-600)", marginTop: 8, marginBottom: 0 }}>
            Maile wymagające Twojej uwagi - zainteresowani i odpowiedzi
          </p>
        </div>
        <Link 
          href="/archive"
          style={{
            padding: "8px 16px",
            backgroundColor: "var(--gray-100)",
            color: "var(--gray-700)",
            textDecoration: "none",
            borderRadius: "6px",
            border: "1px solid var(--gray-200)",
            fontSize: "14px",
            fontWeight: "500"
          }}
        >
          Zobacz archiwum →
        </Link>
      </div>

      {/* Kontrolki */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          onClick={handleFetchNew}
          disabled={isFetching}
          style={{
            padding: "10px 20px",
            backgroundColor: isFetching ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: isFetching ? "not-allowed" : "pointer",
            fontWeight: "bold"
          }}
        >
          {isFetching ? "Pobieranie..." : "🔄 Pobierz nowe maile"}
        </button>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: "14px"
          }}
        >
          <option value="all">📋 Wszystkie do obsługi</option>
          <option value="interested">🟢 Tylko zainteresowani</option>
          <option value="replies">💬 Inne odpowiedzi</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", padding: "10px" }}>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Tylko nieprzeczytane
        </label>
      </div>

      {/* Statystyki */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 16, backgroundColor: "#d4edda", borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>
            {replies.filter(r => r.classification === "INTERESTED").length}
          </div>
          <div style={{ fontSize: "12px", color: "#155724" }}>Zainteresowani</div>
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
        {replies.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
            <p>Brak odpowiedzi.</p>
            <p style={{ fontSize: "14px" }}>Kliknij "Pobierz nowe maile" aby sprawdzić skrzynkę.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "white" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: 12, textAlign: "left", width: "40px" }}></th>
                <th style={{ padding: 12, textAlign: "left" }}>Od / Do</th>
                <th style={{ padding: 12, textAlign: "left" }}>Temat</th>
                <th style={{ padding: 12, textAlign: "left", width: "150px" }}>Data</th>
                <th style={{ padding: 12, textAlign: "left", width: "120px" }}>Typ</th>
                <th style={{ padding: 12, textAlign: "left", width: "100px" }}>Akcje</th>
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
                    borderBottom: "1px solid #eee",
                    cursor: "pointer"
                  }}
                  onClick={() => !reply.isRead && markAsRead(reply.id)}
                >
                  {/* Ikona */}
                  <td style={{ padding: 12, textAlign: "center" }}>
                    <span style={{ fontSize: "20px" }}>{getClassificationIcon(reply.classification)}</span>
                  </td>
                  
                  {/* Od / Do */}
                  <td style={{ padding: 12 }}>
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
                  <td style={{ padding: 12 }}>
                    <div style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {reply.subject}
                    </div>
                    {reply.aiSummary && (
                      <div style={{ fontSize: "11px", color: "#666", marginTop: 4 }}>
                        {reply.aiSummary.substring(0, 80)}...
                      </div>
                    )}
                  </td>
                  
                  {/* Data */}
                  <td style={{ padding: 12, fontSize: "12px", color: "#666" }}>
                    {new Date(reply.receivedAt).toLocaleDateString("pl-PL")}
                    <br />
                    {new Date(reply.receivedAt).toLocaleTimeString("pl-PL")}
                  </td>
                  
                  {/* Typ */}
                  <td style={{ padding: 12, fontSize: "11px" }}>
                    <div style={{
                      padding: "4px 8px",
                      backgroundColor: getClassificationColor(reply.classification),
                      color: "white",
                      borderRadius: 4,
                      textAlign: "center"
                    }}>
                      {reply.classification?.replace("_", " ")}
                    </div>
                    {reply.campaign && (
                      <div style={{ marginTop: 4, fontSize: "10px", color: "#666" }}>
                        {reply.campaign.name}
                      </div>
                    )}
                  </td>
                  
                  {/* Akcje */}
                  <td style={{ padding: 12 }}>
                    {reply.lead && (
                      <Link
                        href={`/leads/${reply.lead.id}`}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#0066cc",
                          color: "white",
                          textDecoration: "none",
                          borderRadius: 4,
                          fontSize: "11px",
                          display: "inline-block"
                        }}
                      >
                        👤 Lead
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Informacje */}
      <div style={{ backgroundColor: "#f0f9ff", padding: 16, borderRadius: 8, marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>ℹ️ Co pokazuje inbox?</h3>
        <p style={{ fontSize: "14px", marginBottom: 12 }}>
          Tutaj są <strong>tylko te maile, które wymagają Twojej uwagi</strong> - zainteresowani i odpowiedzi. 
          Pełne archiwum wszystkich maili znajdziesz w <Link href="/archive" style={{ color: "#0066cc" }}>Archiwum</Link>.
        </p>
        <ul style={{ fontSize: "14px", margin: 0 }}>
          <li><strong>🟢 Zainteresowani</strong> - najważniejsze! Automatycznie forwarded, ale sprawdź czy wszystko OK</li>
          <li><strong>💬 Inne odpowiedzi</strong> - np. NOT_INTERESTED, MAYBE_LATER - warto sprawdzić co piszą</li>
          <li><strong>✅ Oznacz jako obsłużone</strong> - usuwa z listy (maile i tak zostają w archiwum)</li>
          <li><strong>🔄 Auto-obsłużone</strong> - OOO/REDIRECT z nowymi kontaktami - już dodane do bazy</li>
        </ul>
      </div>
    </main>
  );
}

