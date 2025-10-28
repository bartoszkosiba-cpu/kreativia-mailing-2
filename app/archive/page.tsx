"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ArchiveEmail {
  id: string;
  type: "sent" | "received" | "warmup";
  date: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  content: string;
  status: string;
  error?: string;
  leadId?: number;
  leadName: string;
  leadCompany?: string;
  campaignId?: number;
  campaignName: string;
  mailboxId?: number;
  mailboxName: string;
  salespersonName?: string;
  classification?: string;
  sentiment?: string;
  aiSummary?: string;
  warmupDay?: number;
  warmupPhase?: string;
}

interface ArchiveStats {
  total: number;
  sent: number;
  received: number;
  warmup: number;
  byStatus: Record<string, number>;
  byClassification: Record<string, number>;
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

export default function ArchivePage() {
  const [emails, setEmails] = useState<ArchiveEmail[]>([]);
  const [stats, setStats] = useState<ArchiveStats>({
    total: 0,
    sent: 0,
    received: 0,
    warmup: 0,
    byStatus: {},
    byClassification: {}
  });
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  
  // Filtry
  const [type, setType] = useState<"all" | "sent" | "received" | "warmup">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedClassification, setSelectedClassification] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedMailbox, setSelectedMailbox] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  
  // Paginacja
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  
  // Modal szczegółów
  const [selectedEmail, setSelectedEmail] = useState<ArchiveEmail | null>(null);
  const [showModal, setShowModal] = useState(false);
  

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type !== "all") params.append("type", type);
      if (search) params.append("search", search);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (selectedClassification) params.append("classification", selectedClassification);
      if (selectedStatus) params.append("status", selectedStatus);
      if (selectedMailbox) params.append("mailboxId", selectedMailbox);
      if (selectedCampaign) params.append("campaignId", selectedCampaign);
      
      // Paginacja
      params.append("limit", itemsPerPage.toString());
      params.append("offset", ((currentPage - 1) * itemsPerPage).toString());
      
      const res = await fetch(`/api/archive?${params.toString()}`);
      const data = await res.json();
      
      if (data.success) {
        setEmails(data.data.emails);
        setStats(data.data.stats);
        setTotalItems(data.data.total || 0);
      }
    } catch (error) {
      console.error("Błąd pobierania archiwum:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.data || []);
      }
    } catch (error) {
      console.error("Błąd pobierania kampanii:", error);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchArchive();
  }, [type, selectedClassification, selectedStatus, selectedMailbox, selectedCampaign, currentPage, itemsPerPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
    fetchArchive();
  };

  const handleEmailClick = (email: ArchiveEmail) => {
    setSelectedEmail(email);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmail(null);
  };

  const getTypeLabel = (type: "sent" | "received" | "warmup") => {
    switch (type) {
      case "sent": return "Wysłany";
      case "received": return "Odebrany";
      case "warmup": return "Warmup";
      default: return "Nieznany";
    }
  };

  const handleFetch = async () => {
    setIsFetching(true);
    try {
      const response = await fetch('/api/inbox/fetch', {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message || `Przetworzono ${data.count || 0} nowych maili`);
        fetchArchive(); // Odśwież listę
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(`Błąd podczas pobierania maili: ${error}`);
    } finally {
      setIsFetching(false);
    }
  };

  const handleClearArchive = async () => {
    if (!confirm('Czy na pewno chcesz wyczyścić archiwum? To usunie WSZYSTKIE maile z bazy danych.\n\nTej operacji NIE MOŻNA COFNĄĆ!')) {
      return;
    }

    if (!confirm('OSTATNIE OSTRZEŻENIE!\n\nTo trwale usunie wszystkie maile (wysłane, odebrane i warmup).\n\nCzy naprawdę chcesz kontynuować?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/archive', {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        fetchArchive(); // Odśwież listę
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      alert(`Błąd podczas czyszczenia archiwum: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: "sent" | "received" | "warmup") => {
    switch (type) {
      case "sent": return "#e3f2fd";
      case "received": return "#f3e5f5";
      case "warmup": return "#fff3e0";
      default: return "#f5f5f5";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent": return "#e8f5e9";
      case "queued": return "#fff3e0";
      case "failed": return "#ffebee";
      case "handled": return "#e8f5e9";
      case "unhandled": return "#fff3e0";
      default: return "#f5f5f5";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "sent": return "Wysłany";
      case "queued": return "W kolejce";
      case "failed": return "Błąd";
      case "handled": return "Obsłużony";
      case "unhandled": return "Nie obsłużony";
      default: return status;
    }
  };

  const getClassificationColor = (classification: string | null) => {
    if (!classification) return "#f5f5f5";
    switch (classification) {
      case "NOTIFICATION": return "#fff3e0";
      case "INTERESTED": return "#e8f5e9";
      case "NOT_INTERESTED": return "#ffebee";
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
      case "NOTIFICATION": return "Powiadomienia";
      case "INTERESTED": return "Zainteresowany";
      case "NOT_INTERESTED": return "Nie zainteresowany";
      case "REDIRECT": return "Przekierowanie";
      case "OOO": return "Poza biurem";
      case "UNSUBSCRIBE": return "Wypisanie";
      case "BOUNCE": return "Odbity";
      case "OTHER": return "Inne";
      default: return classification;
    }
  };

  return (
    <div className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: "var(--spacing-2xl)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2.5rem", marginBottom: "var(--spacing-sm)" }}>
            Archiwum Maili
          </h1>
          <p style={{ fontSize: "1.1rem", color: "var(--gray-600)" }}>
            Centralne archiwum wszystkich maili - wysłanych, odebranych i warmup
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleFetch}
            disabled={isFetching}
            className="btn"
            style={{
              backgroundColor: isFetching ? "#ccc" : "#6b7280",
              color: "white",
              border: "none",
              fontWeight: "bold",
              padding: "12px 24px",
              borderRadius: "6px",
              cursor: isFetching ? "not-allowed" : "pointer"
            }}
          >
            {isFetching ? "Pobieranie..." : "Odśwież"}
          </button>
          <button
            onClick={handleClearArchive}
            disabled={loading}
            className="btn"
            style={{
              backgroundColor: "#dc3545",
              color: "white",
              borderColor: "#dc3545",
              fontWeight: "bold",
              padding: "12px 24px"
            }}
          >
            Wyczyść archiwum
          </button>
        </div>
      </div>

      {/* Statystyki */}
      <div className="grid grid-4" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Wszystkie</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--primary)" }}>
            {stats.total}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Wysłane</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--success)" }}>
            {stats.sent}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Odebrane</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--warning)" }}>
            {stats.received}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "var(--gray-900)", marginBottom: "var(--spacing-xs)" }}>Warmup</h3>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--info)" }}>
            {stats.warmup}
          </div>
        </div>
      </div>

      {/* Filtry */}
      <div className="card" style={{ marginBottom: "var(--spacing-2xl)" }}>
        <h2 style={{ marginBottom: "var(--spacing-lg)" }}>Filtry</h2>
        
        <form onSubmit={handleSearch} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--spacing-md)" }}>
          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Typ maila
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="all">Wszystkie</option>
              <option value="sent">Wysłane</option>
              <option value="received">Odebrane</option>
              <option value="warmup">Warmup</option>
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

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Klasyfikacja
            </label>
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie</option>
              <option value="NOTIFICATION">Powiadomienia</option>
              <option value="INTERESTED">Zainteresowany</option>
              <option value="NOT_INTERESTED">Nie zainteresowany</option>
              <option value="REDIRECT">Przekierowanie</option>
              <option value="OOO">Poza biurem</option>
              <option value="UNSUBSCRIBE">Wypisanie</option>
              <option value="BOUNCE">Odbity</option>
              <option value="OTHER">Inne</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: "100%", padding: "var(--spacing-sm)", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
            >
              <option value="">Wszystkie</option>
              <option value="sent">Wysłany</option>
              <option value="queued">W kolejce</option>
              <option value="failed">Błąd</option>
              <option value="handled">Obsłużony</option>
              <option value="unhandled">Nie obsłużony</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "var(--spacing-xs)", fontWeight: "600" }}>
              Kampania
            </label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
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

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="submit"
              style={{
                padding: "var(--spacing-sm) var(--spacing-lg)",
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              Szukaj
            </button>
          </div>
        </form>
      </div>

      {/* Lista maili */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-lg)" }}>
          <h2>Lista Maili</h2>
          
          {/* Kontrolki paginacji */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-md)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
              <label style={{ fontSize: "14px", fontWeight: "600" }}>Wierszy na stronę:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ padding: "4px 8px", border: "1px solid var(--gray-300)", borderRadius: "var(--radius)" }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            
            <div style={{ fontSize: "14px", color: "var(--gray-600)" }}>
              {totalItems > 0 ? (
                <>Strona {currentPage} z {Math.ceil(totalItems / itemsPerPage)} ({totalItems} maili)</>
              ) : (
                "Brak maili"
              )}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div style={{ textAlign: "center", padding: "var(--spacing-2xl)" }}>
            <div style={{ color: "var(--gray-500)" }}>Ładowanie archiwum...</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--gray-200)" }}>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Typ</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Data</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Od</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Do</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Temat</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Status</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Klasyfikacja</th>
                  <th style={{ padding: "var(--spacing-sm)", textAlign: "left", fontWeight: "600" }}>Lead</th>
                </tr>
              </thead>
                     <tbody>
                       {emails.map((email) => (
                         <tr 
                           key={email.id} 
                           style={{ 
                             borderBottom: "1px solid var(--gray-100)",
                             cursor: "pointer",
                             transition: "background-color 0.2s"
                           }}
                           onClick={() => handleEmailClick(email)}
                           onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--gray-50)"}
                           onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                         >
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "9999px",
                          fontSize: "12px",
                          fontWeight: "600",
                          background: getTypeColor(email.type),
                          color: "var(--gray-700)"
                        }}
                      >
                        {getTypeLabel(email.type)}
                      </span>
                    </td>
                    <td style={{ padding: "var(--spacing-sm)", fontSize: "12px" }}>
                      {new Date(email.date).toLocaleString('pl-PL')}
                    </td>
                    <td style={{ padding: "var(--spacing-sm)", fontSize: "12px", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {email.fromEmail}
                    </td>
                    <td style={{ padding: "var(--spacing-sm)", fontSize: "12px", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {email.toEmail}
                    </td>
                    <td style={{ padding: "var(--spacing-sm)", fontSize: "12px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {email.subject}
                    </td>
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "9999px",
                          fontSize: "12px",
                          fontWeight: "600",
                          background: getStatusColor(email.status),
                          color: "var(--gray-700)"
                        }}
                        >
                          {getStatusLabel(email.status)}
                        </span>
                    </td>
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      {email.classification && (
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "9999px",
                            fontSize: "12px",
                            fontWeight: "600",
                            background: getClassificationColor(email.classification),
                            color: "var(--gray-700)"
                          }}
                        >
                          {getClassificationLabel(email.classification)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "var(--spacing-sm)" }}>
                      {email.leadId && (
                        <Link
                          href={`/leads/${email.leadId}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "var(--success)",
                            color: "white",
                            textDecoration: "none",
                            borderRadius: "var(--radius)",
                            fontSize: "12px",
                            fontWeight: "600",
                            display: "inline-block",
                            transition: "background-color 0.2s"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#15803d"}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--success)"}
                          title="Przejdź do leada"
                        >
                          Lead
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {emails.length === 0 && (
              <div style={{ textAlign: "center", padding: "var(--spacing-2xl)" }}>
                <div style={{ color: "var(--gray-500)" }}>Brak maili spełniających kryteria</div>
              </div>
            )}
          </div>
        )}

        {/* Paginacja */}
        {totalItems > itemsPerPage && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--spacing-sm)", marginTop: "var(--spacing-lg)", paddingTop: "var(--spacing-lg)", borderTop: "1px solid var(--gray-200)" }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--gray-300)",
                backgroundColor: currentPage === 1 ? "var(--gray-100)" : "white",
                borderRadius: "var(--radius)",
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
                border: "1px solid var(--gray-300)",
                backgroundColor: currentPage === 1 ? "var(--gray-100)" : "white",
                borderRadius: "var(--radius)",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                fontSize: "14px"
              }}
            >
              Poprzednia
            </button>
            
            <div style={{ padding: "8px 16px", fontSize: "14px", fontWeight: "600" }}>
              {currentPage} / {Math.ceil(totalItems / itemsPerPage)}
            </div>
            
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
              style={{
                padding: "8px 12px",
                border: "1px solid var(--gray-300)",
                backgroundColor: currentPage >= Math.ceil(totalItems / itemsPerPage) ? "var(--gray-100)" : "white",
                borderRadius: "var(--radius)",
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
                border: "1px solid var(--gray-300)",
                backgroundColor: currentPage >= Math.ceil(totalItems / itemsPerPage) ? "var(--gray-100)" : "white",
                borderRadius: "var(--radius)",
                cursor: currentPage >= Math.ceil(totalItems / itemsPerPage) ? "not-allowed" : "pointer",
                fontSize: "14px"
              }}
            >
              Ostatnia
            </button>
          </div>
        )}
      </div>

      {/* Modal szczegółów */}
      {showModal && selectedEmail && (
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
              <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Szczegóły maila</h2>
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
              gridTemplateColumns: "1fr 1fr 1fr", 
              gap: "var(--spacing-md)", 
              marginBottom: "var(--spacing-lg)",
              padding: "var(--spacing-md)",
              backgroundColor: "var(--gray-50)",
              borderRadius: "var(--radius)",
              fontSize: "14px"
            }}>
              <div>
                <strong>Typ:</strong><br />
                <span style={{ color: "var(--gray-700)" }}>{getTypeLabel(selectedEmail.type)}</span>
              </div>
              <div>
                <strong>Data:</strong><br />
                <span style={{ color: "var(--gray-700)" }}>{new Date(selectedEmail.date).toLocaleString('pl-PL')}</span>
              </div>
              <div>
                <strong>Kampania:</strong><br />
                <span style={{ color: "var(--gray-700)", wordBreak: "break-word" }}>{selectedEmail.campaignName}</span>
              </div>
            </div>

            {/* Nadawca i odbiorca */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "var(--spacing-lg)", 
              marginBottom: "var(--spacing-lg)",
              fontSize: "14px"
            }}>
              <div style={{ 
                padding: "var(--spacing-md)", 
                backgroundColor: "#f0f9ff", 
                borderRadius: "var(--radius)",
                border: "1px solid #bae6fd"
              }}>
                <strong style={{ color: "#0369a1" }}>📤 {selectedEmail.type === 'received' ? 'Odebrał' : 'Wysłał'}</strong><br />
                <div style={{ marginTop: "var(--spacing-xs)" }}>
                  {selectedEmail.type === 'received' ? (
                    // Dla odpowiedzi: kto odpisał
                    <>
                      <span style={{ color: "var(--gray-700)", wordBreak: "break-all" }}>
                        {selectedEmail.fromEmail}
                      </span>
                      {selectedEmail.leadName && selectedEmail.leadName !== selectedEmail.fromEmail && (
                        <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--gray-600)" }}>
                          Lead: {selectedEmail.leadName} {selectedEmail.leadCompany && `(${selectedEmail.leadCompany})`}
                        </div>
                      )}
                    </>
                  ) : (
                    // Dla wysłanych: nasza skrzynka
                    <>
                      <strong>{selectedEmail.mailboxName}</strong><br />
                      <span style={{ color: "var(--gray-600)", fontSize: "12px", wordBreak: "break-all" }}>
                        {selectedEmail.fromEmail}
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              <div style={{ 
                padding: "var(--spacing-md)", 
                backgroundColor: "#f0fdf4", 
                borderRadius: "var(--radius)",
                border: "1px solid #bbf7d0"
              }}>
                <strong style={{ color: "#166534" }}>📥 {selectedEmail.type === 'received' ? 'Na skrzynkę' : 'Otrzymał'}</strong><br />
                <div style={{ marginTop: "var(--spacing-xs)" }}>
                  {selectedEmail.type === 'received' ? (
                    // Dla odpowiedzi: nasza skrzynka
                    <>
                      <strong>{selectedEmail.mailboxName}</strong><br />
                      <span style={{ color: "var(--gray-600)", fontSize: "12px", wordBreak: "break-all" }}>
                        {selectedEmail.toEmail}
                      </span>
                    </>
                  ) : (
                    // Dla wysłanych: lead
                    <>
                      <span style={{ color: "var(--gray-700)", wordBreak: "break-all" }}>
                        {selectedEmail.toEmail}
                      </span>
                      {selectedEmail.leadName && selectedEmail.leadName !== selectedEmail.toEmail && (
                        <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--gray-600)" }}>
                          Lead: {selectedEmail.leadName} {selectedEmail.leadCompany && `(${selectedEmail.leadCompany})`}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Dodatkowe informacje (tylko jeśli są istotne) */}
            {(selectedEmail.classification || selectedEmail.warmupDay) && (
              <div style={{ 
                display: "flex", 
                gap: "var(--spacing-md)", 
                marginBottom: "var(--spacing-lg)",
                fontSize: "14px"
              }}>
                {selectedEmail.classification && (
                  <div>
                    <strong>Klasyfikacja:</strong><br />
                    <span style={{ color: "var(--gray-700)" }}>{getClassificationLabel(selectedEmail.classification)}</span>
                  </div>
                )}
                {selectedEmail.warmupDay && (
                  <div>
                    <strong>Dzień warmup:</strong><br />
                    <span style={{ color: "var(--gray-700)" }}>{selectedEmail.warmupDay} ({selectedEmail.warmupPhase})</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: "var(--spacing-lg)" }}>
              <strong>Temat:</strong>
              <div style={{ 
                marginTop: "var(--spacing-xs)", 
                padding: "var(--spacing-sm)", 
                backgroundColor: "var(--gray-50)", 
                borderRadius: "var(--radius)",
                fontSize: "14px"
              }}>
                {selectedEmail.subject}
              </div>
            </div>

            {selectedEmail.content && (
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <strong>Treść:</strong>
                <div style={{ 
                  marginTop: "var(--spacing-xs)", 
                  padding: "var(--spacing-sm)", 
                  backgroundColor: "var(--gray-50)", 
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--gray-200)",
                  maxHeight: "300px",
                  overflow: "auto",
                  fontSize: "12px",
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
                    ${convertTextToHtml(selectedEmail.content)}
                  `
                }}
                />
              </div>
            )}

            {selectedEmail.error && (
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <strong style={{ color: "var(--error)" }}>Błąd:</strong>
                <div style={{ 
                  marginTop: "var(--spacing-xs)", 
                  padding: "var(--spacing-sm)", 
                  backgroundColor: "#fef2f2", 
                  borderRadius: "var(--radius)",
                  border: "1px solid #fecaca",
                  fontSize: "12px",
                  color: "var(--error)"
                }}>
                  {selectedEmail.error}
                </div>
              </div>
            )}

            {selectedEmail.aiSummary && (
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <strong>Podsumowanie AI:</strong>
                <div style={{ 
                  marginTop: "var(--spacing-xs)", 
                  padding: "var(--spacing-sm)", 
                  backgroundColor: "#f0f9ff", 
                  borderRadius: "var(--radius)",
                  border: "1px solid #bae6fd",
                  fontSize: "12px"
                }}>
                  {selectedEmail.aiSummary}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--spacing-md)", justifyContent: "flex-end", marginTop: "var(--spacing-xl)" }}>
              {selectedEmail.campaignId && (
                <Link
                  href={`/campaigns/${selectedEmail.campaignId}`}
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-lg)",
                    backgroundColor: "var(--primary)",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "var(--radius)",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}
                >
                  Przejdź do kampanii
                </Link>
              )}
              
              {selectedEmail.leadId && (
                <Link
                  href={`/leads/${selectedEmail.leadId}`}
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-lg)",
                    backgroundColor: "var(--success)",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "var(--radius)",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}
                >
                  Przejdź do leada
                </Link>
              )}
              
              <button
                onClick={closeModal}
                style={{
                  padding: "var(--spacing-sm) var(--spacing-lg)",
                  backgroundColor: "var(--gray-500)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius)",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
