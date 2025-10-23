import { db } from "@/lib/db";
import Link from "next/link";
import { headers } from "next/headers";
import CampaignTextEditor from "./CampaignTextEditor";
import SalespersonEditor from "./SalespersonEditor";
import CampaignSender from "./CampaignSender";
import CampaignScheduler from "./CampaignScheduler";
import CampaignReport from "./CampaignReport";
import LeadsEditor from "./LeadsEditor";
import DeleteCampaign from "./DeleteCampaign";
import FollowUpManager from "./FollowUpManager";
import RefreshButton from "./RefreshButton";
import CampaignOutbox from "./CampaignOutbox";

export default async function CampaignDetailsPage({ params }: { params: { id: string } }) {
  const campaignId = Number(params.id);
  if (Number.isNaN(campaignId)) {
    return <main>Nieprawidłowe ID kampanii.</main>;
  }

  // Pobierz referer z nagłówków
  const headersList = await headers();
  const referer = headersList.get('referer') || '/campaigns';

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: { 
      virtualSalesperson: true,
      savedContent: {
        include: {
          productGroup: true
        }
      },
      contentVersion: {
        include: {
          campaignTheme: {
            include: {
              productGroup: true
            }
          }
        }
      },
      CampaignLead: { 
        include: { 
          lead: { 
            include: { LeadTag: { include: { tag: true } } }
          } 
        } 
      }
    }
  });

  if (!campaign) {
    return <main>Nie znaleziono kampanii.</main>;
  }

  // Sprawdź które leady już otrzymały mail
  const sentLogs = await db.sendLog.findMany({
    where: {
      campaignId,
      status: "sent"
    },
    select: {
      leadId: true
    }
  });
  
  const sentLeadIds = new Set(sentLogs.map(log => log.leadId));
  
  // Filtruj tylko aktywne leady (nie zablokowane)
  const leadsWithStatus = campaign.CampaignLead
    .filter(cl => cl.lead.status !== 'BLOCKED')
    .map(cl => ({
      id: cl.lead.id,
      firstName: cl.lead.firstName,
      lastName: cl.lead.lastName,
      email: cl.lead.email,
      company: cl.lead.company,
      hasSentEmail: sentLeadIds.has(cl.lead.id)
    }));

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <RefreshButton />
      
      {campaign.isFollowUp && campaign.parentCampaignId && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          ℹ️ To jest <strong>Follow-up #{campaign.followUpSequence}</strong> dla kampanii:{" "}
          <Link href={`/campaigns/${campaign.parentCampaignId}`} style={{ fontWeight: 600 }}>
            Kampania główna →
          </Link>
        </div>
      )}
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>{campaign.name}</h1>
        
        {/* Źródło treści z Content Planner (NOWE) */}
        {campaign.savedContent && (
          <div style={{ 
            marginTop: 12, 
            padding: 12, 
            backgroundColor: "#f0f9ff", 
            borderRadius: 6,
            border: "1px solid #bae6fd",
            fontSize: 13
          }}>
            🎨 <strong>Treść z Content Planner:</strong>{" "}
            {campaign.savedContent.productGroup.iconEmoji}{" "}
            {campaign.savedContent.productGroup.name} &gt;{" "}
            {campaign.savedContent.name}{" "}
            ({campaign.savedContent.type})
            {campaign.savedContent.usageCount > 1 && ` • Użyto ${campaign.savedContent.usageCount}x`}
            {" • "}
            <Link 
              href={`/content-planner/groups/${campaign.savedContent.productGroupId}`}
              style={{ color: "var(--color-primary)", textDecoration: "underline" }}
            >
              Zobacz grupę →
            </Link>
          </div>
        )}
        
        {/* Stare źródło (DEPRECATED - dla backward compatibility) */}
        {!campaign.savedContent && campaign.contentVersion && (
          <div style={{ 
            marginTop: 12, 
            padding: 12, 
            backgroundColor: "#fff7ed", 
            borderRadius: 6,
            border: "1px solid #fed7aa",
            fontSize: 13
          }}>
            ⚠️ <strong>Stara wersja Content Planner</strong> (przed refaktorem)
          </div>
        )}
        
        <div style={{ display: "flex", gap: "12px", marginTop: 16 }}>
          <Link 
            href={`/campaigns/${campaignId}/inbox`}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--info)",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "14px"
            }}
          >
            📥 Inbox kampanii
          </Link>
          <Link 
            href={referer}
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
            ← Wróć
          </Link>
        </div>
      </div>

      <SalespersonEditor 
        campaignId={campaignId}
        currentSalesperson={campaign.virtualSalesperson}
      />

      <CampaignReport campaignId={campaignId} />

      <LeadsEditor 
        campaignId={campaignId}
        currentLeads={leadsWithStatus}
        campaignStatus={campaign.status}
      />

      <CampaignScheduler
        campaignId={campaignId}
        currentStatus={campaign.status}
        scheduledAt={campaign.scheduledAt?.toISOString() || null}
        allowedDays={campaign.allowedDays}
        startHour={campaign.startHour}
        endHour={campaign.endHour}
        delayBetweenEmails={campaign.delayBetweenEmails}
        maxEmailsPerHour={campaign.maxEmailsPerHour}
        respectHolidays={campaign.respectHolidays}
        targetCountries={campaign.targetCountries}
        leadsCount={leadsWithStatus.length}
      />

      <CampaignTextEditor 
        campaignId={campaignId} 
        initialSubject={campaign.subject || ""}
        initialText={campaign.text || ""}
        initialJobDescription={campaign.jobDescription || ""}
        initialPostscript={campaign.postscript || ""}
        initialLinkText={campaign.linkText || ""}
        initialLinkUrl={campaign.linkUrl || ""}
        leads={leadsWithStatus}
      />

      <FollowUpManager campaignId={campaignId} isFollowUp={campaign.isFollowUp} />

      <CampaignOutbox campaignId={campaignId} />

      <div style={{ marginBottom: 20, padding: 20, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
        <h2>Informacje o kampanii</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <p><strong>Liczba aktywnych leadów:</strong> {leadsWithStatus.length}</p>
            <p><strong>Utworzono:</strong> {new Date(campaign.createdAt).toLocaleString()}</p>
            <p><strong>Ostatnia aktualizacja:</strong> {new Date(campaign.updatedAt).toLocaleString()}</p>
          </div>
          <div>
            <p><strong>Wirtualny handlowiec:</strong></p>
            {campaign.virtualSalesperson ? (
              <div style={{ padding: 12, backgroundColor: "white", borderRadius: 4, border: "1px solid #ddd" }}>
                <p style={{ margin: 0, fontWeight: "bold" }}>{campaign.virtualSalesperson.name}</p>
                <p style={{ margin: "4px 0", color: "#666" }}>{campaign.jobDescription || "Wirtualny handlowiec"}</p>
                <p style={{ margin: "4px 0", fontSize: "14px" }}>
                  <a href={`mailto:${campaign.virtualSalesperson.email}`} style={{ color: "#0066cc" }}>
                    {campaign.virtualSalesperson.email}
                  </a>
                  <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>
                    (główna skrzynka)
                  </span>
                </p>
                <p style={{ margin: "4px 0", fontSize: "12px", color: "#666" }}>
                  Język: {campaign.virtualSalesperson.language.toUpperCase()}
                  {campaign.virtualSalesperson.markets && ` • Rynki: ${campaign.virtualSalesperson.markets}`}
                </p>
              </div>
            ) : (
              <div style={{ padding: 12, backgroundColor: "#fff3cd", borderRadius: 4, border: "1px solid #ffeaa7" }}>
                <p style={{ margin: 0, color: "#856404" }}>Brak przypisanego handlowca</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#856404" }}>
                  Maile będą wysyłane bez określonego nadawcy
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <h2>Leady w kampanii ({leadsWithStatus.length})</h2>
      {leadsWithStatus.length === 0 ? (
        <p>Brak aktywnych leadów w kampanii.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <th style={{ padding: 8, textAlign: "left", border: "1px solid #ddd" }}>ID</th>
                <th style={{ padding: 8, textAlign: "left", border: "1px solid #ddd" }}>Imię</th>
                <th style={{ padding: 8, textAlign: "left", border: "1px solid #ddd" }}>Nazwisko</th>
                <th style={{ padding: 8, textAlign: "left", border: "1px solid #ddd" }}>Firma</th>
                <th style={{ padding: 8, textAlign: "left", border: "1px solid #ddd" }}>Email</th>
                <th style={{ padding: 8, textAlign: "left", border: "1px solid #ddd" }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {leadsWithStatus.map((lead) => {
                return (
                  <tr key={lead.id}>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>{lead.id}</td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>{lead.firstName || "-"}</td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>{lead.lastName || "-"}</td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>{lead.company || "-"}</td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>
                      <a href={`mailto:${lead.email}`} style={{ color: "#0066cc" }}>
                        {lead.email}
                      </a>
                    </td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>
                      <Link href={`/leads/${lead.id}`} style={{ color: "#0066cc", fontSize: "14px" }}>
                        Szczegóły
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CampaignSender 
        campaignId={campaignId}
        hasSubject={!!campaign.subject}
        hasText={!!campaign.text}
        hasLeads={leadsWithStatus.length > 0}
        leadsCount={leadsWithStatus.length}
        salesperson={campaign.virtualSalesperson}
      />

      <DeleteCampaign 
        campaignId={campaignId}
        campaignName={campaign.name}
      />
    </main>
  );
}

