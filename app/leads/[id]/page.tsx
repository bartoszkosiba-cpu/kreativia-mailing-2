"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusManager } from "@/components/StatusManager";
import { LeadStatus, LeadSubStatus } from "@/types/leadStatus";

interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  title: string | null;
  industry: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  companyCity: string | null;
  companyCountry: string | null;
  language: string | null;
  status: string;
  subStatus: string | null;
  blockedCampaigns: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  blockedAt: Date | null;
  personalization: string | null;
  greetingForm: string | null;
  source: string | null;
  sourceDetails: string | null;
  createdAt: Date;
  updatedAt: Date;
  originalLead: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  statusHistory: Array<{
    id: number;
    oldStatus: string | null;
    oldSubStatus: string | null;
    newStatus: string;
    newSubStatus: string | null;
    reason: string | null;
    changedBy: string | null;
    createdAt: Date;
  }>;
  CampaignLead: Array<{
    id: number;
    campaign: {
      id: number;
      name: string;
    };
  }>;
  LeadTag: Array<{
    id: number;
    tag: {
      id: number;
      name: string;
      color: string;
    };
  }>;
  SendLog: Array<{
    id: number;
    campaignId: number;
    status: string;
    createdAt: Date;
  }>;
  replies: Array<{
    id: number;
    subject: string;
    receivedAt: Date;
    isRead: boolean;
    classification: string;
    aiSummary: string | null;
  }>;
}

export default function LeadDetailsPage({ params }: { params: { id: string } }) {
  const leadId = Number(params.id);
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [referer, setReferer] = useState('/leads');
  const [isEditingGreeting, setIsEditingGreeting] = useState(false);
  const [greetingValue, setGreetingValue] = useState('');

  const fetchLead = async () => {
    try {
      const response = await fetch(`/api/leads/${leadId}`);
      if (response.ok) {
        const data = await response.json();
        setLead(data);
      } else {
        router.push('/404');
      }
    } catch (error) {
      console.error('Błąd pobierania leada:', error);
      router.push('/404');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: LeadStatus, newSubStatus: LeadSubStatus | null) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          subStatus: newSubStatus,
          blockedReason: newStatus === 'BLOKADA' ? 'MANUAL' : undefined
        })
      });

      if (response.ok) {
        // Odśwież dane leada
        await fetchLead();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Błąd zmiany statusu');
      }
    } catch (error: any) {
      console.error("Błąd zmiany statusu:", error);
      throw error;
    }
  };

  const handleGreetingEdit = () => {
    setGreetingValue(lead?.greetingForm || '');
    setIsEditingGreeting(true);
  };

  const handleGreetingSave = async () => {
    try {
      const response = await fetch(`/api/leads/${leadId}/greeting`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ greetingForm: greetingValue })
      });

      if (response.ok) {
        await fetchLead();
        setIsEditingGreeting(false);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Błąd aktualizacji powitania');
      }
    } catch (error: any) {
      console.error("Błąd aktualizacji powitania:", error);
      alert("Błąd aktualizacji powitania: " + error.message);
    }
  };

  const handleGreetingCancel = () => {
    setIsEditingGreeting(false);
    setGreetingValue('');
  };

  useEffect(() => {
    if (Number.isNaN(leadId)) {
      router.push('/404');
      return;
    }

    // Pobierz referer z document.referrer
    setReferer(document.referrer || '/leads');

    fetchLead();
  }, [leadId, router]);

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}><h1>Ładowanie...</h1></main>;
  }

  if (!lead) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}><h1>Lead nie znaleziony</h1></main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--spacing-2xl)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-md)", marginBottom: "var(--spacing-sm)" }}>
          <Link 
            href="/leads"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--gray-100)",
              color: "var(--gray-700)",
              textDecoration: "none",
              borderRadius: "var(--radius)",
              fontSize: "14px",
              fontWeight: "500",
              transition: "all 0.2s ease",
              border: "1px solid var(--gray-200)"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "var(--gray-200)";
              e.currentTarget.style.borderColor = "var(--gray-300)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "var(--gray-100)";
              e.currentTarget.style.borderColor = "var(--gray-200)";
            }}
          >
            <span>←</span>
            <span>Wróć do listy leadów</span>
          </Link>
        </div>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "var(--spacing-sm)", margin: 0 }}>
          {lead.firstName} {lead.lastName}
        </h1>
        <p style={{ fontSize: "1.1rem", color: "var(--gray-600)", margin: 0 }}>
          Szczegóły leada i zarządzanie statusem
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--spacing-lg)" }}>

        {/* Podstawowe dane */}
        <div className="card">
          <div className="card-header">
            <h3>Podstawowe dane</h3>
            {lead.isBlocked && (
              <span style={{ 
                padding: "4px 12px", 
                backgroundColor: "#dc3545", 
                color: "white", 
                borderRadius: 12, 
                fontSize: "12px" 
              }}>
                ZABLOKOWANY
              </span>
            )}
          </div>
          <div>
            <table style={{ width: "100%", fontSize: "14px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)", width: "40%" }}>Email:</td>
                  <td style={{ padding: "8px" }}>{lead.email}</td>
                </tr>
                {lead.company && (
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)" }}>Firma:</td>
                    <td style={{ padding: "8px" }}>{lead.company}</td>
                  </tr>
                )}
                {lead.title && (
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)" }}>Stanowisko:</td>
                    <td style={{ padding: "8px" }}>{lead.title}</td>
                  </tr>
                )}
                {lead.industry && (
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)" }}>Branża:</td>
                    <td style={{ padding: "8px" }}>{lead.industry}</td>
                  </tr>
                )}
                {lead.websiteUrl && (
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)" }}>WWW:</td>
                    <td style={{ padding: "8px" }}>
                      <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>
                        {lead.websiteUrl}
                      </a>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)" }}>Język:</td>
                  <td style={{ padding: "8px" }}>{lead.language || "pl"}</td>
                </tr>
                {lead.isBlocked && lead.blockedReason && (
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)" }}>Powód:</td>
                    <td style={{ padding: "8px", color: "#dc3545", fontWeight: "bold" }}>{lead.blockedReason}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Informacje o źródle i datach */}
        <div className="card">
          <div className="card-header">
            <h3>Informacje</h3>
          </div>
          <div>
            <table style={{ width: "100%", fontSize: "14px" }}>
              <tbody>
                {lead.source && (
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)", width: "40%" }}>Źródło:</td>
                    <td style={{ padding: "8px" }}>
                      <span style={{ 
                        padding: "2px 8px", 
                        backgroundColor: lead.source === "CSV_IMPORT" ? "#e3f2fd" : 
                                        lead.source === "OOO_RESPONSE" ? "#fff3e0" :
                                        lead.source === "REDIRECT_RESPONSE" ? "#f3e5f5" : "#e8f5e9",
                        borderRadius: 12,
                        fontSize: "12px"
                      }}>
                        {lead.source}
                      </span>
                    </td>
                  </tr>
                )}
                {lead.originalLead && (
                  <tr>
                    <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)" }}>Utworzony przez:</td>
                    <td style={{ padding: "8px" }}>
                      <Link href={`/leads/${lead.originalLead.id}`} style={{ color: "#0066cc" }}>
                        {lead.originalLead.firstName} {lead.originalLead.lastName} ({lead.originalLead.email})
                      </Link>
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)" }}>Utworzono:</td>
                  <td style={{ padding: "8px" }}>{new Date(lead.createdAt).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style={{ padding: "8px", fontWeight: "600", color: "var(--gray-700)" }}>Ostatnia aktualizacja:</td>
                  <td style={{ padding: "8px" }}>{new Date(lead.updatedAt).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Tagi */}
        {lead.LeadTag.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3>Tagi ({lead.LeadTag.length})</h3>
            </div>
            <div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {lead.LeadTag.map((lt) => (
                  <span
                    key={lt.id}
                    style={{
                      padding: "4px 12px",
                      backgroundColor: lt.tag.color || "#007bff",
                      color: "white",
                      borderRadius: 12,
                      fontSize: "12px"
                    }}
                  >
                    {lt.tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Kampanie */}
        {lead.CampaignLead.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3>Kampanie ({lead.CampaignLead.length})</h3>
            </div>
            <div>
              <ul style={{ margin: 0, paddingLeft: "20px" }}>
                {lead.CampaignLead.map((cl) => (
                  <li key={cl.id} style={{ marginBottom: "8px" }}>
                    <Link href={`/campaigns/${cl.campaign.id}`} style={{ color: "#0066cc" }}>
                      {cl.campaign.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Powitanie */}
        <div className="card">
          <div className="card-header">
            <h3>Powitanie</h3>
            {!isEditingGreeting && (
              <button
                onClick={handleGreetingEdit}
                className="btn"
                style={{ fontSize: "12px", padding: "4px 12px" }}
              >
                Edytuj
              </button>
            )}
          </div>
          <div>
            {isEditingGreeting ? (
              <div>
                <textarea
                  value={greetingValue}
                  onChange={(e) => setGreetingValue(e.target.value)}
                  placeholder="Wprowadź powitanie..."
                  style={{
                    width: "100%",
                    minHeight: "80px",
                    padding: "8px",
                    border: "1px solid var(--gray-300)",
                    borderRadius: "var(--radius)",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                />
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button
                    onClick={handleGreetingSave}
                    className="btn btn-primary"
                    style={{ fontSize: "12px" }}
                  >
                    Zapisz
                  </button>
                  <button
                    onClick={handleGreetingCancel}
                    className="btn"
                    style={{ fontSize: "12px" }}
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              lead.greetingForm ? (
                <p style={{ whiteSpace: "pre-wrap", fontSize: "14px", margin: 0 }}>{lead.greetingForm}</p>
              ) : (
                <p style={{ fontSize: "14px", color: "var(--gray-500)", fontStyle: "italic", margin: 0 }}>
                  Brak przygotowanego powitania
                </p>
              )
            )}
          </div>
        </div>

        {/* Personalizacja */}
        {lead.personalization && (
          <div className="card">
            <div className="card-header">
              <h3>Personalizacja AI</h3>
            </div>
            <div>
              <p style={{ whiteSpace: "pre-wrap", fontSize: "14px", margin: 0 }}>{lead.personalization}</p>
            </div>
          </div>
        )}

        {/* Odpowiedzi */}
        {lead.replies.length > 0 && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-header">
              <h3>Odpowiedzi ({lead.replies.length})</h3>
            </div>
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {lead.replies.map((reply) => (
                  <div
                    key={reply.id}
                    style={{
                      padding: 12,
                      backgroundColor: reply.isRead ? "var(--gray-50)" : "#e7f3ff",
                      border: "1px solid var(--gray-300)",
                      borderRadius: "var(--radius)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <strong>{reply.subject}</strong>
                      <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                        {new Date(reply.receivedAt).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "14px", color: "var(--gray-700)" }}>
                      {reply.aiSummary || "Brak podsumowania"}
                    </p>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{
                        padding: "2px 8px",
                        backgroundColor: reply.classification === "INTERESTED" ? "#28a745" : 
                                       reply.classification === "UNSUBSCRIBE" ? "#dc3545" :
                                       reply.classification === "OOO" ? "#ffc107" : "#007bff",
                        color: "white",
                        borderRadius: 12,
                        fontSize: "11px"
                      }}>
                        {reply.classification}
                      </span>
                      <Link href={`/archive`} style={{ fontSize: "12px", color: "#0066cc" }}>
                        Zobacz w archiwum →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Historia wysyłek */}
        {lead.SendLog.length > 0 && (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-header">
              <h3>Historia wysyłek ({lead.SendLog.length})</h3>
            </div>
            <div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--gray-100)" }}>
                    <th style={{ padding: 8, textAlign: "left", border: "1px solid var(--gray-300)" }}>Data</th>
                    <th style={{ padding: 8, textAlign: "left", border: "1px solid var(--gray-300)" }}>Kampania</th>
                    <th style={{ padding: 8, textAlign: "left", border: "1px solid var(--gray-300)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lead.SendLog.map((log) => (
                    <tr key={log.id}>
                      <td style={{ padding: 8, border: "1px solid var(--gray-300)" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: 8, border: "1px solid var(--gray-300)" }}>
                        Kampania #{log.campaignId}
                      </td>
                      <td style={{ padding: 8, border: "1px solid var(--gray-300)" }}>
                        <span style={{ color: log.status === "sent" ? "#28a745" : "#dc3545" }}>
                          {log.status === "sent" ? "Wysłano" : "Błąd"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Historia zmian statusu */}
        {lead.statusHistory && lead.statusHistory.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3>Historia statusów</h3>
            </div>
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lead.statusHistory.slice(0, 5).map((history) => (
                  <div
                    key={history.id}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "var(--gray-50)",
                      border: "1px solid var(--gray-200)",
                      borderRadius: "var(--radius)",
                      fontSize: "13px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: "600" }}>
                        {history.oldStatus || "NOWY"} → {history.newStatus}
                      </span>
                      <span style={{ color: "var(--gray-500)", fontSize: "12px" }}>
                        {new Date(history.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {history.reason && (
                      <div style={{ color: "var(--gray-600)", fontSize: "12px" }}>
                        Przyczyna: {history.reason} {history.changedBy && `(${history.changedBy})`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Zarządzanie statusem */}
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-header">
            <h3>Zarządzanie statusem</h3>
          </div>
          <div>
            <StatusManager 
              leadId={lead.id} 
              currentStatus={lead.status as LeadStatus} 
              currentSubStatus={lead.subStatus as LeadSubStatus | null}
              blockedCampaigns={lead.blockedCampaigns ? JSON.parse(lead.blockedCampaigns) : []}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>

      </div>
    </main>
  );
}

// Stary komponent StatusManager został usunięty - używamy nowego z @/components/StatusManager
