"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  } | null;
  campaign: {
    id: number;
    name: string;
  } | null;
  isConfirmed?: boolean;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
}

interface Campaign {
  id: number;
  name: string;
  status: string;
}

// Funkcja konwersji zwykłego tekstu na HTML
function convertTextToHtml(text: string): string {
  if (!text) return '';
  
  // Sprawdź czy to prawdziwy HTML (zawiera tagi HTML)
  const hasHtmlTags = text.includes('<html>') || 
                     text.includes('<br>') || 
                     text.includes('<p>') || 
                     text.includes('<div>') ||
                     text.includes('<body>') ||
                     text.includes('<head>');
  
  // Jeśli już zawiera prawdziwy HTML, zwróć jak jest
  if (hasHtmlTags) {
    return text;
  }
  
  // Konwertuj zwykły tekst na HTML
  return text
    .replace(/\r\n/g, '<br>') // Windows line breaks
    .replace(/\n/g, '<br>') // Unix line breaks
    .replace(/\r/g, '<br>') // Mac line breaks
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>') // Cytaty na blockquote
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **tekst** na <strong>
    .replace(/\*(.+?)\*/g, '<em>$1</em>') // *tekst* na <em>
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>') // Linki
    .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>'); // Emaile
}

function InboxPageContent() {
  const searchParams = useSearchParams();
  const [replies, setReplies] = useState<InboxReply[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedReply, setSelectedReply] = useState<InboxReply | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Filtry
  const [classification, setClassification] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Inicjalizuj filtry z URL jeśli istnieją
  useEffect(() => {
    const urlFilter = searchParams?.get("filter");
    if (urlFilter && ["all", "interested", "replies", "unsubscribe", "ooo", "redirect", "other"].includes(urlFilter)) {
      if (urlFilter === "interested") {
        setClassification("INTERESTED");
      } else if (urlFilter === "replies") {
        setClassification("");
      } else {
        setClassification(urlFilter.toUpperCase());
      }
    }
  }, [searchParams]);

  useEffect(() => {
    fetchCampaigns();
    fetchReplies();
  }, [classification, campaignId, status, dateFrom, dateTo, unreadOnly]);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCampaigns(data.data || []);
        }
      }
    } catch (error) {
      console.error("Błąd pobierania kampanii:", error);
    }
  };

  const fetchReplies = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (classification) params.set("classification", classification);
      if (campaignId) params.set("campaignId", campaignId);
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReplies();
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

  const handleRowClick = (reply: InboxReply) => {
    setSelectedReply(reply);
    setShowModal(true);
    // Oznacz jako przeczytane przy otwarciu modala
    if (!reply.isRead) {
      markAsRead(reply.id);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedReply(null);
  };

  const getClassificationColor = (classification: string | null) => {
    if (!classification) return "#f5f5f5";
    switch (classification) {
      case "INTERESTED": return "#e8f5e9";
      case "NOT_INTERESTED": return "#ffebee";
      case "MAYBE_LATER": return "#fff3e0";
      case "REDIRECT": return "#e3f2fd";
      case "OOO": return "#f3e5f5";
      case "UNSUBSCRIBE": return "#ffebee";
      case "BOUNCE": return "#ffebee";
      case "OTHER": return "#f0f0f0";
      default: return "#f5f5f5";
    }
  };

  const getClassificationLabel = (classification: string | null) => {
    if (!classification) return "";
    switch (classification) {
      case "INTERESTED": return "Zainteresowany";
      case "NOT_INTERESTED": return "Nie zainteresowany";
      case "MAYBE_LATER": return "Może później";
      case "REDIRECT": return "Przekierowanie";
      case "OOO": return "Poza biurem";
      case "UNSUBSCRIBE": return "Wypisanie";
      case "BOUNCE": return "Odbity";
      case "OTHER": return "Inne";
      default: return classification;
    }
  };

  if (isLoading) {
    return <div className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</div>;
  }

  // Statystyki
  const stats = {
    interested: replies.filter(r => r.classification === "INTERESTED").length,
    replies: replies.filter(r => r.classification !== "INTERESTED" && r.classification !== null).length,
    unread: replies.filter(r => !r.isRead).length,
    unhandled: replies.filter(r => !r.isHandled).length
  };

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
        <div style={{ display: "flex", gap: "12px" }}>
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
      </div>

      {/* Statystyki */}
      <div className="grid grid-4" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Zainteresowani</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--success)" }}>
            {stats.interested}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Odpowiedzi</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--warning)" }}>
            {stats.replies}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Nieprzeczytane</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--info)" }}>
            {stats.unread}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Do obsługi</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--primary)" }}>
            {stats.unhandled}
          </div>
        </div>
      </div>

      {/* Filtry */}
      <div className="card" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <h2 style={{ marginBottom: "var(--spacing-lg)" }}>Filtry</h2>
        
        <form onSubmit={handleSearch} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--spacing-md)" }}>
          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Klasyfikacja
            </label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie</option>
              <option value="INTERESTED">Zainteresowany</option>
              <option value="NOT_INTERESTED">Nie zainteresowany</option>
              <option value="MAYBE_LATER">Może później</option>
              <option value="REDIRECT">Przekierowanie</option>
              <option value="OOO">Poza biurem</option>
              <option value="UNSUBSCRIBE">Wypisanie</option>
              <option value="BOUNCE">Odbity</option>
              <option value="OTHER">Inne</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Kampania
            </label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie kampanie</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} ({campaign.status}) - ID: {campaign.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie</option>
              <option value="handled">Obsłużone</option>
              <option value="unhandled">Nie obsłużone</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Wyszukiwanie
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj w treści, temacie, emailach..."
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Data od
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Data do
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "var(--spacing-sm)" }}>
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                style={{ marginRight: "var(--spacing-xs)" }}
              />
              <span style={{ fontSize: "14px", fontWeight: "600" }}>Tylko nieprzeczytane</span>
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="submit"
              className="btn"
              style={{
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                fontWeight: "600",
                padding: "var(--spacing-sm) var(--spacing-lg)"
              }}
            >
              Szukaj
            </button>
          </div>
        </form>
      </div>

      {/* Lista odpowiedzi */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-lg)" }}>
          <h2 style={{ margin: 0 }}>Lista Maili ({replies.length})</h2>
        </div>
        
        {replies.length === 0 ? (
          <div style={{ textAlign: "center", padding: "var(--spacing-2xl)", color: "var(--gray-600)" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "var(--spacing-sm)" }}>Brak odpowiedzi.</p>
            <p style={{ fontSize: "14px" }}>Kliknij "Pobierz nowe maile" aby sprawdzić skrzynkę.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--gray-200)" }}>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Data</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Od</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Temat</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Klasyfikacja</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Kampania</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Status</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Akcje</th>
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
                      borderBottom: "1px solid var(--gray-100)",
                      cursor: "pointer",
                      backgroundColor: reply.isRead ? "#fff" : "#f0f8ff",
                      transition: "background-color 0.2s"
                    }}
                    onClick={() => handleRowClick(reply)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--gray-50)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = reply.isRead ? "#fff" : "#f0f8ff"}
                  >
                    {/* Data */}
                    <td style={{ padding: "var(--spacing-sm)", fontSize: "12px" }}>
                      {new Date(reply.receivedAt).toLocaleString('pl-PL')}
                    </td>
                    
                    {/* Od */}
                    <td style={{ padding: "var(--spacing-sm)", fontSize: "12px" }}>
                      {reply.lead ? (
                        <div>
                          <div style={{ fontWeight: "600" }}>
                            {reply.lead.firstName || ""} {reply.lead.lastName || ""}
                          </div>
                          {reply.lead.company && (
                            <div style={{ fontSize: "11px", color: "var(--gray-600)" }}>{reply.lead.company}</div>
                          )}
                          <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>{reply.fromEmail}</div>
                        </div>
                      ) : (
                        <div style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {reply.fromEmail}
                        </div>
                      )}
                    </td>
                    
                    {/* Temat */}
                    <td style={{ padding: "var(--spacing-sm)", fontSize: "12px", maxWidth: "300px" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {reply.subject}
                      </div>
                      {reply.aiSummary && (
                        <div style={{ fontSize: "11px", color: "var(--gray-600)", marginTop: 4 }}>
                          {reply.aiSummary.substring(0, 80)}...
                        </div>
                      )}
                    </td>
                    
                    {/* Klasyfikacja */}
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      {reply.classification && (
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "9999px",
                            fontSize: "12px",
                            fontWeight: "600",
                            background: getClassificationColor(reply.classification),
                            color: "var(--gray-700)"
                          }}
                        >
                          {getClassificationLabel(reply.classification)}
                        </span>
                      )}
                    </td>
                    
                    {/* Kampania */}
                    <td style={{ padding: "var(--spacing-sm)", fontSize: "12px" }}>
                      {reply.campaign ? (
                        <Link
                          href={`/campaigns/${reply.campaign.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "var(--primary)", textDecoration: "none" }}
                        >
                          {reply.campaign.name}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--gray-500)" }}>Brak</span>
                      )}
                    </td>
                    
                    {/* Status */}
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "9999px",
                            fontSize: "11px",
                            fontWeight: "600",
                            background: reply.isHandled ? "#e8f5e9" : "#fff3e0",
                            color: "var(--gray-700)"
                          }}
                        >
                          {reply.isHandled ? "Obsłużone" : "Nie obsłużone"}
                        </span>
                        {!reply.isRead && (
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "9999px",
                              fontSize: "10px",
                              fontWeight: "600",
                              background: "#e3f2fd",
                              color: "var(--primary)"
                            }}
                          >
                            Nieprzeczytane
                          </span>
                        )}
                        {reply.classification === "INTERESTED" && (
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: "9999px",
                              fontSize: "10px",
                              fontWeight: "600",
                              background: reply.isConfirmed ? "#28a745" : "#dc3545",
                              color: "white"
                            }}
                          >
                            {reply.isConfirmed ? "✓ Potwierdzone" : "✗ Nie potwierdzone"}
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Akcje */}
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                        {reply.lead && (
                          <Link
                            href={`/leads/${reply.lead.id}`}
                            className="btn"
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#17a2b8",
                              color: "white",
                              textDecoration: "none",
                              borderRadius: "var(--radius)",
                              fontSize: "11px",
                              fontWeight: "600"
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Lead
                          </Link>
                        )}
                      </div>
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
        <ul style={{ fontSize: "14px", margin: 0, paddingLeft: "20px" }}>
          <li style={{ marginBottom: "8px" }}><strong>Zainteresowani</strong> - najważniejsze! Automatycznie forwarded, ale sprawdź czy wszystko OK</li>
          <li style={{ marginBottom: "8px" }}><strong>Inne odpowiedzi</strong> - np. NOT_INTERESTED, MAYBE_LATER - warto sprawdzić co piszą</li>
          <li style={{ marginBottom: "8px" }}><strong>Oznacz jako obsłużone</strong> - usuwa z listy (maile i tak zostają w archiwum)</li>
          <li style={{ marginBottom: "8px" }}><strong>Auto-obsłużone</strong> - OOO/REDIRECT z nowymi kontaktami - już dodane do bazy</li>
        </ul>
      </div>

      {/* Modal szczegółów */}
      {showModal && selectedReply && (
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
            zIndex: 1000
          }}
          onClick={closeModal}
        >
          <div 
            style={{
              backgroundColor: "white",
              borderRadius: "var(--radius)",
              padding: "var(--spacing-2xl)",
              maxWidth: "800px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-lg)" }}>
              <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Szczegóły odpowiedzi</h2>
              <button
                onClick={closeModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "var(--gray-500)",
                  padding: "4px"
                }}
                title="Zamknij"
              >
                ×
              </button>
            </div>

            {/* Podstawowe informacje */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "var(--spacing-md)", 
              marginBottom: "var(--spacing-lg)",
              padding: "var(--spacing-md)",
              backgroundColor: "var(--gray-50)",
              borderRadius: "var(--radius)",
              fontSize: "14px"
            }}>
              <div>
                <strong>Od:</strong><br />
                <span style={{ color: "var(--gray-700)" }}>{selectedReply.fromEmail}</span>
              </div>
              <div>
                <strong>Data:</strong><br />
                <span style={{ color: "var(--gray-700)" }}>{new Date(selectedReply.receivedAt).toLocaleString('pl-PL')}</span>
              </div>
              <div>
                <strong>Klasyfikacja:</strong><br />
                <span style={{ 
                  padding: "2px 8px",
                  backgroundColor: getClassificationColor(selectedReply.classification),
                  color: "var(--gray-700)",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "600"
                }}>
                  {getClassificationLabel(selectedReply.classification) || "BRAK"}
                </span>
              </div>
              <div>
                <strong>Kampania:</strong><br />
                <span style={{ color: "var(--gray-700)" }}>{selectedReply.campaign?.name || "Brak"}</span>
              </div>
              {selectedReply.classification === "INTERESTED" && (
                <>
                  <div>
                    <strong>Potwierdzenie:</strong><br />
                    <span style={{ color: selectedReply.isConfirmed ? "#28a745" : "#dc3545", fontWeight: "600" }}>
                      {selectedReply.isConfirmed ? "✓ Potwierdzone" : "✗ Nie potwierdzone"}
                    </span>
                  </div>
                  {selectedReply.isConfirmed && selectedReply.confirmedAt && (
                    <div>
                      <strong>Data potwierdzenia:</strong><br />
                      <span style={{ color: "var(--gray-700)" }}>
                        {new Date(selectedReply.confirmedAt).toLocaleString('pl-PL')}
                      </span>
                      {selectedReply.confirmedBy && (
                        <div style={{ fontSize: "12px", color: "var(--gray-600)", marginTop: "4px" }}>
                          przez: {selectedReply.confirmedBy}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Temat */}
            <div style={{ marginBottom: "var(--spacing-lg)" }}>
              <strong>Temat:</strong>
              <div style={{ 
                padding: "var(--spacing-sm)",
                backgroundColor: "var(--gray-50)",
                borderRadius: "var(--radius)",
                marginTop: "var(--spacing-xs)"
              }}>
                {selectedReply.subject}
              </div>
            </div>

            {/* Treść maila */}
            <div style={{ marginBottom: "var(--spacing-lg)" }}>
              <strong>Treść:</strong>
              <div 
                style={{ 
                  padding: "var(--spacing-md)",
                  backgroundColor: "var(--gray-50)",
                  borderRadius: "var(--radius)",
                  marginTop: "var(--spacing-xs)",
                  maxHeight: "400px",
                  overflow: "auto",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  fontFamily: "Arial, sans-serif"
                }}
                dangerouslySetInnerHTML={{ 
                  __html: `
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      p { margin: 0 0 10px 0; }
                      br { line-height: 1.6; }
                      div { margin: 0 0 10px 0; }
                      strong, b { font-weight: bold; }
                      em, i { font-style: italic; }
                      ul, ol { margin: 10px 0; padding-left: 20px; }
                      li { margin: 5px 0; }
                      blockquote { margin: 10px 0; padding: 10px; border-left: 3px solid #ccc; background: #f9f9f9; }
                      a { color: #0066cc; text-decoration: underline; }
                      img { max-width: 100%; height: auto; }
                    </style>
                    ${convertTextToHtml(selectedReply.content)}
                  `
                }}
              />
            </div>

            {/* AI Summary */}
            {selectedReply.aiSummary && (
              <div style={{ 
                marginBottom: "var(--spacing-lg)",
                padding: "var(--spacing-md)",
                backgroundColor: "#fef3c7",
                borderRadius: "var(--radius)",
                border: "1px solid #fbbf24"
              }}>
                <strong style={{ color: "#92400e" }}>Podsumowanie AI:</strong>
                <p style={{ marginTop: "var(--spacing-xs)", color: "#78350f" }}>{selectedReply.aiSummary}</p>
              </div>
            )}

            {/* Akcje */}
            <div style={{ display: "flex", gap: "var(--spacing-md)", justifyContent: "flex-end" }}>
              {selectedReply.lead && (
                <Link
                  href={`/leads/${selectedReply.lead.id}`}
                  className="btn"
                  style={{
                    backgroundColor: "#17a2b8",
                    color: "white",
                    textDecoration: "none",
                    padding: "8px 16px",
                    borderRadius: "var(--radius)",
                    fontWeight: "600"
                  }}
                >
                  Zobacz lead
                </Link>
              )}
              {selectedReply.campaign && (
                <Link
                  href={`/campaigns/${selectedReply.campaign.id}`}
                  className="btn"
                  style={{
                    backgroundColor: "var(--primary)",
                    color: "white",
                    textDecoration: "none",
                    padding: "8px 16px",
                    borderRadius: "var(--radius)",
                    fontWeight: "600"
                  }}
                >
                  Zobacz kampanię
                </Link>
              )}
              {!selectedReply.isHandled && (
                <button
                  onClick={async () => {
                    await markAsHandled(selectedReply.id);
                    closeModal();
                  }}
                  className="btn"
                  style={{
                    backgroundColor: "var(--success)",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "var(--radius)",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                >
                  Oznacz jako obsłużone
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: "var(--spacing-2xl)", textAlign: "center" }}>Ładowanie...</div>}>
      <InboxPageContent />
    </Suspense>
  );
}
