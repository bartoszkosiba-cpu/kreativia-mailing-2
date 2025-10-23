"use client";

import { useState } from "react";
import Link from "next/link";
import DeleteButton from "./DeleteButton";

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
  const statusMap: Record<string, { emoji: string; label: string; color: string }> = {
    DRAFT: { emoji: "📝", label: "Szkic", color: "#999" },
    SCHEDULED: { emoji: "🔵", label: "Zaplanowana", color: "#3b82f6" },
    IN_PROGRESS: { emoji: "🟡", label: "Wysyła się", color: "#f59e0b" },
    COMPLETED: { emoji: "🟢", label: "Zakończona", color: "#10b981" },
    PAUSED: { emoji: "⏸️", label: "Wstrzymana", color: "#6b7280" },
    CANCELLED: { emoji: "🔴", label: "Anulowana", color: "#ef4444" }
  };
  
  const info = statusMap[status] || { emoji: "❓", label: status, color: "#999" };
  
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
      {info.emoji} {info.label}
    </span>
  );
}

export default function CampaignsList({ initialCampaigns, initialProgress }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [progress, setProgress] = useState(initialProgress);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<number>>(new Set());

  const handleDeleted = (campaignId: number) => {
    setCampaigns(campaigns.filter(c => c.id !== campaignId));
    const index = campaigns.findIndex(c => c.id === campaignId);
    if (index !== -1) {
      setProgress(progress.filter((_, i) => i !== index));
    }
  };
  
  const toggleExpanded = (campaignId: number) => {
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
          ➕ Nowa kampania
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
          <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: 8 }}>Akcje</th>
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
            <>
              {/* Kampania główna */}
              <tr key={c.id} style={{ borderBottom: hasFollowUps && !isExpanded ? "none" : "1px solid #e5e7eb" }}>
                <td style={{ padding: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {hasFollowUps && (
                      <button
                        onClick={() => toggleExpanded(c.id)}
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
                        {isExpanded ? "▼" : "▶"}
                      </button>
                    )}
                    {!hasFollowUps && <span style={{ width: "22px" }}></span>}
                    <Link href={`/campaigns/${c.id}`} style={{ fontWeight: 600 }}>
                      📧 {c.name}
                    </Link>
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
                      📅 {new Date(c.scheduledAt).toLocaleDateString('pl-PL')}
                      {c.sendingStartedAt && (
                        <><br/>▶️ {new Date(c.sendingStartedAt).toLocaleDateString('pl-PL')}</>
                      )}
                      {c.sendingCompletedAt && (
                        <><br/>✅ {new Date(c.sendingCompletedAt).toLocaleDateString('pl-PL')}</>
                      )}
                    </>
                  ) : (
                    <span style={{ color: "#999" }}>Nie zaplanowano</span>
                  )}
                </td>
                <td style={{ padding: 8, textAlign: "center" }}>
                  <DeleteButton 
                    campaignId={c.id}
                    campaignName={c.name}
                    onDeleted={() => handleDeleted(c.id)}
                  />
                </td>
              </tr>

              {/* Follow-upy (jeśli rozwinięte) */}
              {hasFollowUps && isExpanded && followUps.map((fu) => {
                const fuIndex = campaigns.findIndex(camp => camp.id === fu.id);
                const fuProg = progress[fuIndex];
                
                return (
                  <tr key={fu.id} style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 8, paddingLeft: 40 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#9ca3af", fontSize: "12px" }}>├─</span>
                        <Link href={`/campaigns/${fu.id}`} style={{ fontWeight: 500, fontSize: "14px" }}>
                          Follow-up #{fu.followUpSequence}
                        </Link>
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
                          📅 {new Date(fu.scheduledAt).toLocaleDateString('pl-PL')}
                        </>
                      ) : (
                        <span style={{ color: "#999" }}>Nie zaplanowano</span>
                      )}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <DeleteButton 
                        campaignId={fu.id}
                        campaignName={`Follow-up #${fu.followUpSequence}`}
                        onDeleted={() => handleDeleted(fu.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </>
          );
        })}
      </tbody>
    </table>
  );
}

