"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface HistoryEntry {
  id: string;
  sequenceNumber: number;
  type: "sent" | "received";
  date: string;
  leadId: number | null;
  leadEmail: string;
  leadName: string;
  leadCompany: string;
  leadStatus: string;
  campaignId: number | null;
  campaignName: string;
  campaignStatus: string;
  subject: string;
  status: string | null;
  classification: string | null;
  sentiment: string | null;
  aiSummary: string | null;
  content: string | null;
  systemActions: string[];
}

interface HistoryStats {
  totalSent: number;
  totalReceived: number;
  total: number;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<HistoryStats>({ totalSent: 0, totalReceived: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  
  // Filtry
  const [type, setType] = useState<"all" | "sent" | "received">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedClassification, setSelectedClassification] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  
  // Rozwinięcie szczegółów
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type !== "all") params.append("type", type);
      if (search) params.append("search", search);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (selectedClassification) params.append("classification", selectedClassification);
      if (selectedStatus) params.append("status", selectedStatus);
      
      const res = await fetch(`/api/inbox/history?${params.toString()}`);
      const data = await res.json();
      
      if (data.success) {
        setHistory(data.history);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Błąd pobierania historii:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [type, selectedClassification, selectedStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const getTypeLabel = (type: "sent" | "received") => {
    return type === "sent" ? "📤 Wysłany" : "📥 Odebrany";
  };

  const getClassificationColor = (classification: string | null) => {
    if (!classification) return "bg-gray-100 text-gray-800";
    switch (classification) {
      case "INTERESTED": return "bg-green-100 text-green-800";
      case "NOT_INTERESTED": return "bg-red-100 text-red-800";
      case "OOO": return "bg-yellow-100 text-yellow-800";
      case "BOUNCE": return "bg-orange-100 text-orange-800";
      case "UNSUBSCRIBE": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string | null) => {
    if (!status) return "bg-gray-100 text-gray-800";
    switch (status) {
      case "sent": return "bg-green-100 text-green-800";
      case "failed": return "bg-red-100 text-red-800";
      case "bounced": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getLeadStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "text-green-600";
      case "BLOCKED": return "text-red-600";
      case "INACTIVE": return "text-gray-600";
      case "TEST": return "text-blue-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 Dziennik wysyłek i odbiorów</h1>
          <p className="text-gray-600">Pełna historia komunikacji z leadami</p>
        </div>

        {/* Statystyki */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-sm text-gray-600 mb-1">Wszystkie</div>
            <div className="text-3xl font-bold text-[var(--color-primary)]">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-sm text-gray-600 mb-1">📤 Wysłane</div>
            <div className="text-3xl font-bold text-green-600">{stats.totalSent}</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-sm text-gray-600 mb-1">📥 Odebrane</div>
            <div className="text-3xl font-bold text-blue-600">{stats.totalReceived}</div>
          </div>
        </div>

        {/* Filtry */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8 border border-gray-200">
          <h2 className="text-lg font-semibold mb-6 text-gray-900">🔍 Filtry i wyszukiwanie</h2>
        
          <form onSubmit={handleSearch} className="space-y-6">
            {/* Typ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Typ</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="all">Wszystkie</option>
                <option value="sent">Tylko wysłane</option>
                <option value="received">Tylko odebrane</option>
              </select>
            </div>

            {/* Klasyfikacja (dla odebranych) */}
            {(type === "received" || type === "all") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Klasyfikacja</label>
                <select
                  value={selectedClassification}
                  onChange={(e) => setSelectedClassification(e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Wszystkie</option>
                  <option value="INTERESTED">Zainteresowane</option>
                  <option value="NOT_INTERESTED">Niezainteresowane</option>
                  <option value="OOO">OOO</option>
                  <option value="BOUNCE">Bounce</option>
                  <option value="UNSUBSCRIBE">Unsubscribe</option>
                  <option value="OTHER">Inne</option>
                </select>
              </div>
            )}

            {/* Status (dla wysłanych) */}
            {(type === "sent" || type === "all") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status wysyłki</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Wszystkie</option>
                  <option value="sent">Wysłane</option>
                  <option value="failed">Nieudane</option>
                  <option value="bounced">Bounced</option>
                </select>
              </div>
            )}
          </div>

            {/* Daty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data od</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data do</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

            {/* Wyszukiwarka */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Szukaj (email, firma)</label>
              <div className="flex gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Wpisz frazę do wyszukania..."
                className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm"
                >
                  🔍 Szukaj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setDateFrom("");
                    setDateTo("");
                    setSelectedClassification("");
                    setSelectedStatus("");
                    setType("all");
                    fetchHistory();
                  }}
                  className="px-8 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-sm"
                >
                  ✖️ Wyczyść
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
          {loading ? (
            <div className="p-12 text-center text-gray-600">Ładowanie...</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-gray-600">Brak wyników</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Typ</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Data i godzina</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Lead</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Kampania</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Temat</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status/Klasyf.</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Akcje systemu</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Szczegóły</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((entry, index) => (
                    <>
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 border border-gray-300">
                            <span className="text-sm font-semibold text-gray-700">#{entry.sequenceNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                          <span className="text-sm font-medium">{getTypeLabel(entry.type)}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(entry.date).toLocaleDateString("pl-PL")}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(entry.date).toLocaleTimeString("pl-PL")}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-5">
                          <div className="text-sm">
                            {entry.leadId ? (
                              <Link href={`/leads/${entry.leadId}`} className="text-[var(--color-primary)] hover:underline font-medium">
                                {entry.leadName || entry.leadEmail}
                              </Link>
                            ) : (
                              <span className="text-gray-600">{entry.leadEmail}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{entry.leadCompany}</div>
                          <div className={`text-xs font-medium mt-1 ${getLeadStatusColor(entry.leadStatus)}`}>
                            {entry.leadStatus}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-5">
                          {entry.campaignId ? (
                            <Link href={`/campaigns/${entry.campaignId}`} className="text-sm text-[var(--color-primary)] hover:underline font-medium">
                              {entry.campaignName}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-5">
                          <div className="text-sm text-gray-900 max-w-xs truncate font-medium">
                            {entry.subject}
                          </div>
                          {entry.aiSummary && (
                            <div className="text-xs text-gray-500 max-w-xs truncate mt-1">
                              {entry.aiSummary}
                            </div>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                          {entry.classification && (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getClassificationColor(entry.classification)}`}>
                              {entry.classification}
                            </span>
                          )}
                          {entry.status && (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(entry.status)}`}>
                              {entry.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-5 text-sm">
                          {entry.systemActions && entry.systemActions.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {entry.systemActions.map((action, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                  ✓ {action}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Brak akcji</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
                          >
                            {expandedId === entry.id ? "🔼 Ukryj" : "🔽 Pokaż"}
                          </button>
                        </td>
                      </tr>
                      {expandedId === entry.id && (
                        <tr>
                          <td colSpan={9} className="px-4 sm:px-6 py-6 bg-gray-50 border-t border-gray-200">
                            <div className="text-sm">
                              <div className="mb-3 font-semibold text-gray-900">
                                📄 Treść wiadomości:
                              </div>
                              <div className="bg-white p-6 rounded-lg border border-gray-300 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                                {entry.content ? entry.content.replace(/<[^>]*>/g, '') : "Brak treści"}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

