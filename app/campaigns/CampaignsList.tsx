"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Campaign {
  id: number;
  name: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  sendingStartedAt: string | null;
  sendingCompletedAt: string | null;
  parentCampaignId: number | null;
  followUpSequence: number | null;
}

interface Progress {
  sent: number;
  total: number;
  percentage: number;
}

interface Props {
  initialCampaigns: Campaign[];
  initialProgress: Progress[];
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Szkic", color: "#999" },
    SCHEDULED: { label: "Zaplanowana", color: "#3b82f6" },
    IN_PROGRESS: { label: "Wysyła się", color: "#f59e0b" },
    COMPLETED: { label: "Zakończona", color: "#10b981" },
    PAUSED: { label: "Wstrzymana", color: "#6b7280" },
    CANCELLED: { label: "Anulowana", color: "#ef4444" }
  };
  
  const info = statusMap[status] || { label: status, color: "#999" };
  
  return (
    <span style={{ 
      display: "inline-flex", 
      alignItems: "center", 
      gap: "4px",
      padding: "4px 8px",
      borderRadius: "4px",
      backgroundColor: `${info.color}20`,
      color: info.color,
      fontSize: "12px",
      fontWeight: "600"
    }}>
      {info.label}
    </span>
  );
}

export default function CampaignsList({ initialCampaigns, initialProgress }: Props) {
  const router = useRouter();
  const [campaigns] = useState(initialCampaigns);
  const [progress] = useState(initialProgress);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<number>>(new Set());

  const handleRowClick = (campaignId: number, event: React.MouseEvent) => {
    // Nie przekierowuj jeśli kliknięto w przycisk +/-
    if ((event.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }
    router.push(`/campaigns/${campaignId}`);
  };
  
  const toggleExpanded = (campaignId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
  };
  
  // Grupuj kampanie: główne + ich follow-upy
  const mainCampaigns = campaigns.filter(c => !c.parentCampaignId);
  const followUpsByCampaign = campaigns
    .filter(c => c.parentCampaignId)
    .reduce((acc, fu) => {
      if (!acc[fu.parentCampaignId!]) {
        acc[fu.parentCampaignId!] = [];
      }
      acc[fu.parentCampaignId!].push(fu);
      return acc;
    }, {} as Record<number, Campaign[]>);
  
  // Sortuj follow-upy wg sequence (pomijaj null)
  Object.values(followUpsByCampaign).forEach(fus => {
    fus.sort((a, b) => (a.followUpSequence || 0) - (b.followUpSequence || 0));
  });

  if (campaigns.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p style={{ fontSize: "18px", color: "#666", marginBottom: "20px" }}>
          Brak kampanii. Dodaj pierwszą kampanię, aby rozpocząć.
        </p>
        <Link 
          href="/campaigns/new" 
          style={{
            padding: "12px 24px",
            backgroundColor: "var(--success)",
            color: "white",
            textDecoration: "none",
            borderRadius: "6px",
            fontWeight: "600",
            display: "inline-block"
          }}
        >
          Nowa kampania
        </Link>
      </div>
    );
  }

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Nazwa</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Status</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Postęp</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Leady</th>
          <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Daty</th>
        </tr>
      </thead>
      <tbody>
        {mainCampaigns.map((c) => {
          const index = campaigns.findIndex(camp => camp.id === c.id);
          const prog = progress[index];
          const followUps = followUpsByCampaign[c.id] || [];
          const hasFollowUps = followUps.length > 0;
          const isExpanded = expandedCampaigns.has(c.id);
          
          return (
            <React.Fragment key={c.id}>
              {/* Kampania główna */}
              <tr 
                onClick={(e) => handleRowClick(c.id, e)}
                style={{ 
                  borderBottom: hasFollowUps && !isExpanded ? "none" : "1px solid #e5e7eb",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <td style={{ padding: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {hasFollowUps && (
                      <button
                        onClick={(e) => toggleExpanded(c.id, e)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "14px",
                          padding: "0 4px",
                          transition: "transform 0.2s"
                        }}
                        title={isExpanded ? "Zwiń follow-upy" : "Rozwiń follow-upy"}
                      >
                        {isExpanded ? "-" : "+"}
                      </button>
                    )}
                    {!hasFollowUps && <span style={{ width: "22px" }}></span>}
                    <span style={{ fontWeight: 600 }}>
                      {c.name}
                    </span>
                    {hasFollowUps && (
                      <span style={{ 
                        fontSize: "11px", 
                        color: "#6b7280", 
                        backgroundColor: "#f3f4f6", 
                        padding: "2px 6px", 
                        borderRadius: "4px",
                        fontWeight: 500
                      }}>
                        {followUps.length} follow-up{followUps.length > 1 ? 'y' : ''}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: 8 }}>
                  {getStatusBadge(c.status)}
                </td>
                <td style={{ padding: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ 
                      width: "100px", 
                      height: "8px", 
                      backgroundColor: "#e5e7eb", 
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}>
                      <div style={{ 
                        width: `${prog.percentage}%`, 
                        height: "100%", 
                        backgroundColor: prog.percentage === 100 ? "#10b981" : "#3b82f6",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      {prog.sent}/{prog.total}
                    </span>
                  </div>
                </td>
                <td style={{ padding: 8 }}>{prog.total}</td>
                <td style={{ padding: 8, fontSize: "12px", color: "#6b7280" }}>
                  {c.scheduledAt ? (
                    <>
                      {new Date(c.scheduledAt).toLocaleDateString('pl-PL')}
                      {c.sendingStartedAt && (
                        <><br />Start: {new Date(c.sendingStartedAt).toLocaleDateString('pl-PL')}</>
                      )}
                      {c.sendingCompletedAt && (
                        <><br />Koniec: {new Date(c.sendingCompletedAt).toLocaleDateString('pl-PL')}</>
                      )}
                    </>
                  ) : (
                    <span style={{ color: "#999" }}>Nie zaplanowano</span>
                  )}
                </td>
              </tr>

              {/* Follow-upy (jeśli rozwinięte) */}
              {hasFollowUps && isExpanded && followUps.map((fu) => {
                const fuIndex = campaigns.findIndex(camp => camp.id === fu.id);
                const fuProg = progress[fuIndex];
                
                return (
                  <tr 
                    key={fu.id} 
                    onClick={(e) => handleRowClick(fu.id, e)}
                    style={{ 
                      backgroundColor: "#f9fafb", 
                      borderBottom: "1px solid #e5e7eb",
                      cursor: "pointer",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f3f4f6"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                  >
                    <td style={{ padding: 8, paddingLeft: 40 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#9ca3af", fontSize: "12px" }}>├─</span>
                        <span style={{ fontWeight: 500, fontSize: "14px" }}>
                          Follow-up #{fu.followUpSequence}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: 8 }}>
                      {getStatusBadge(fu.status)}
                    </td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ 
                          width: "100px", 
                          height: "8px", 
                          backgroundColor: "#e5e7eb", 
                          borderRadius: "4px",
                          overflow: "hidden"
                        }}>
                          <div style={{ 
                            width: `${fuProg.percentage}%`, 
                            height: "100%", 
                            backgroundColor: fuProg.percentage === 100 ? "#10b981" : "#3b82f6",
                            transition: "width 0.3s ease"
                          }} />
                        </div>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                          {fuProg.sent}/{fuProg.total}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: 8 }}>{fuProg.total}</td>
                    <td style={{ padding: 8, fontSize: "12px", color: "#6b7280" }}>
                      {fu.scheduledAt ? (
                        <>
                          {new Date(fu.scheduledAt).toLocaleDateString('pl-PL')}
                        </>
                      ) : (
                        <span style={{ color: "#999" }}>Nie zaplanowano</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
