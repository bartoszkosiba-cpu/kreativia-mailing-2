import { db } from "@/lib/db";
import Link from "next/link";
import { headers } from "next/headers";
import CampaignTextEditor from "./CampaignTextEditor";
import SalespersonEditor from "./SalespersonEditor";
import CampaignSender from "./CampaignSender";
import CampaignScheduler from "./CampaignScheduler";
import CampaignStartButton from "./CampaignStartButton";
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
      language: cl.lead.language || "pl",
      hasSentEmail: sentLeadIds.has(cl.lead.id)
    }));

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <RefreshButton />
      
      {campaign.isFollowUp && campaign.parentCampaignId && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          To jest <strong>Follow-up #{campaign.followUpSequence}</strong> dla kampanii:{" "}
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
            <strong>Treść z Content Planner:</strong>{" "}
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
            <strong>Stara wersja Content Planner</strong> (przed refaktorem)
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
            Inbox kampanii
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
            Wróć
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
        startMinute={campaign.startMinute ?? 0}
        endHour={campaign.endHour}
        endMinute={campaign.endMinute ?? 0}
        delayBetweenEmails={campaign.delayBetweenEmails}
        maxEmailsPerDay={campaign.maxEmailsPerDay}
        respectHolidays={campaign.respectHolidays}
        targetCountries={campaign.targetCountries}
        leadsCount={leadsWithStatus.length}
      />

      <CampaignStartButton
        campaignId={campaignId}
        currentStatus={campaign.status}
        leadsCount={leadsWithStatus.length}
        delayBetweenEmails={campaign.delayBetweenEmails}
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

