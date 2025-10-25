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
  const [referer, setReferer] = useState('/archive');

  useEffect(() => {
    if (Number.isNaN(leadId)) {
      router.push('/404');
      return;
    }

    // Pobierz referer z document.referrer
    setReferer(document.referrer || '/archive');

    // Pobierz dane leada
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
      <h1>Szczegóły kontaktu</h1>

      <div style={{ marginBottom: 20 }}>
        <Link 
          href={referer}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            backgroundColor: "var(--gray-100)",
            color: "var(--gray-700)",
            textDecoration: "none",
            borderRadius: "var(--radius)",
            fontSize: "14px",
            fontWeight: "500",
            transition: "background-color 0.2s"
          }}
        >
          ← Wróć
        </Link>
      </div>

      {/* Zarządzanie statusem */}
      <div style={{ backgroundColor: "#e7f3ff", padding: 20, borderRadius: 8, marginBottom: 20, border: "1px solid #b3d9ff" }}>
        <h3 style={{ marginTop: 0, color: "#0066cc" }}>🔧 Zarządzanie statusem</h3>
        <StatusManager 
          leadId={lead.id} 
          currentStatus={lead.status as LeadStatus} 
          currentSubStatus={lead.subStatus as LeadSubStatus | null}
          blockedCampaigns={lead.blockedCampaigns ? JSON.parse(lead.blockedCampaigns) : []}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Podstawowe dane */}
      <div style={{ backgroundColor: "#f8f9fa", padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>
          {lead.firstName} {lead.lastName}
          {lead.isBlocked && (
            <span style={{ 
              marginLeft: 10, 
              padding: "4px 12px", 
              backgroundColor: "#dc3545", 
              color: "white", 
              borderRadius: 12, 
              fontSize: "14px" 
            }}>
              🚫 ZABLOKOWANY
            </span>
          )}
        </h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "8px 16px", fontSize: "14px" }}>
          <strong>Email:</strong>
          <span>{lead.email}</span>

          {lead.company && (
            <>
              <strong>Firma:</strong>
              <span>{lead.company}</span>
            </>
          )}

          {lead.title && (
            <>
              <strong>Stanowisko:</strong>
              <span>{lead.title}</span>
            </>
          )}

          {lead.industry && (
            <>
              <strong>Branża:</strong>
              <span>{lead.industry}</span>
            </>
          )}

          {lead.websiteUrl && (
            <>
              <strong>Strona WWW:</strong>
              <a href={lead.websiteUrl} target="_blank" style={{ color: "#0066cc" }}>{lead.websiteUrl}</a>
            </>
          )}

          {lead.linkedinUrl && (
            <>
              <strong>LinkedIn:</strong>
              <a href={lead.linkedinUrl} target="_blank" style={{ color: "#0066cc" }}>Profil LinkedIn</a>
            </>
          )}

          {lead.companyCity && (
            <>
              <strong>Miasto:</strong>
              <span>{lead.companyCity}</span>
            </>
          )}

          {lead.companyCountry && (
            <>
              <strong>Kraj:</strong>
              <span>{lead.companyCountry}</span>
            </>
          )}

          <strong>Język:</strong>
          <span>{lead.language || "pl"}</span>

          {lead.isBlocked && (
            <>
              <strong>Powód blokady:</strong>
              <span style={{ color: "#dc3545", fontWeight: "bold" }}>{lead.blockedReason}</span>
            </>
          )}

          {lead.blockedAt && (
            <>
              <strong>Data blokady:</strong>
              <span>{new Date(lead.blockedAt).toLocaleString()}</span>
            </>
          )}
        </div>
      </div>

      {/* Tagi */}
      {lead.LeadTag.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3>🏷️ Tagi</h3>
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
      )}

      {/* Kampanie */}
      {lead.CampaignLead.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3>📊 Kampanie ({lead.CampaignLead.length})</h3>
          <ul>
            {lead.CampaignLead.map((cl) => (
              <li key={cl.id}>
                <Link href={`/campaigns/${cl.campaign.id}`} style={{ color: "#0066cc" }}>
                  {cl.campaign.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Odpowiedzi */}
      {lead.replies.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3>📬 Odpowiedzi ({lead.replies.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lead.replies.map((reply) => (
              <div
                key={reply.id}
                style={{
                  padding: 12,
                  backgroundColor: reply.isRead ? "#f8f9fa" : "#e7f3ff",
                  border: "1px solid #ddd",
                  borderRadius: 8
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong>{reply.subject}</strong>
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    {new Date(reply.receivedAt).toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "#555" }}>
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
                  <Link href={`/inbox`} style={{ fontSize: "12px", color: "#0066cc" }}>
                    Zobacz w inbox →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historia wysyłek */}
      {lead.SendLog.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3>📤 Historia wysyłek (ostatnie 10)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <th style={{ padding: 8, textAlign: "left", border: "1px solid #ddd" }}>Data</th>
                <th style={{ padding: 8, textAlign: "left", border: "1px solid #ddd" }}>Kampania</th>
                <th style={{ padding: 8, textAlign: "left", border: "1px solid #ddd" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lead.SendLog.map((log) => (
                <tr key={log.id}>
                  <td style={{ padding: 8, border: "1px solid #ddd" }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: 8, border: "1px solid #ddd" }}>
                    Kampania #{log.campaignId}
                  </td>
                  <td style={{ padding: 8, border: "1px solid #ddd" }}>
                    <span style={{ color: log.status === "sent" ? "#28a745" : "#dc3545" }}>
                      {log.status === "sent" ? "✓ Wysłano" : "✗ Błąd"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Personalizacja */}
      {lead.personalization && (
        <div style={{ backgroundColor: "#fff3cd", padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <h4 style={{ marginTop: 0 }}>🤖 Personalizacja AI</h4>
          <p style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>{lead.personalization}</p>
        </div>
      )}
    </main>
  );
}

// Stary komponent StatusManager został usunięty - używamy nowego z @/components/StatusManager
