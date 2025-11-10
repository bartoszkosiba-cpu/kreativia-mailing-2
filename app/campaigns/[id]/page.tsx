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
import CampaignOutbox from "./CampaignOutbox";
import CampaignPlanningInfo from "./CampaignPlanningInfo";
import CampaignTabs from "./CampaignTabs";
import { getPersonaCriteria } from "@/services/personaCriteriaService";

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
      },
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

  const safeParse = <T,>(raw: string | null | undefined, fallback: T): T => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  let personaDetails: {
    id: number;
    companyCriteriaId: number;
    name: string;
    description?: string | null;
    language?: string | null;
    positiveRoles: any[];
    negativeRoles: any[];
    conditionalRules: any[];
  } | null = null;

  const activeCriteria = await db.companyVerificationCriteria.findFirst({
    where: { isActive: true, isDefault: true },
    orderBy: { updatedAt: "desc" },
  });

  if (activeCriteria) {
    const persona = await getPersonaCriteria(activeCriteria.id);
    if (persona) {
      personaDetails = {
        id: persona.id,
        companyCriteriaId: persona.companyCriteriaId,
        name: persona.name,
        description: persona.description ?? null,
        language: persona.language ?? null,
        positiveRoles: persona.positiveRoles ?? [],
        negativeRoles: persona.negativeRoles ?? [],
        conditionalRules: persona.conditionalRules ?? [],
      };
    }
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      {/* Usunięto belkę ręcznego/auto odświeżania – planowanie ma własny auto-refresh */}
      
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
        
        {/* Usunięto przyciski "Inbox kampanii" i "Wróć" zgodnie z prośbą */}
      </div>

      <CampaignTabs
        campaignId={campaignId}
        campaignName={campaign.name}
        isFollowUp={campaign.isFollowUp}
        status={campaign.status}
        salesperson={campaign.virtualSalesperson}
        leads={leadsWithStatus}
        schedule={{
          scheduledAt: campaign.scheduledAt?.toISOString() || null,
          allowedDays: campaign.allowedDays,
          startHour: campaign.startHour,
          startMinute: campaign.startMinute ?? 0,
          endHour: campaign.endHour,
          endMinute: campaign.endMinute ?? 0,
          delayBetweenEmails: campaign.delayBetweenEmails,
          maxEmailsPerDay: campaign.maxEmailsPerDay,
          respectHolidays: campaign.respectHolidays,
          targetCountries: campaign.targetCountries
        }}
        content={{
          subject: campaign.subject || null,
          text: campaign.text || null,
          jobDescription: campaign.jobDescription || null,
          postscript: campaign.postscript || null,
          linkText: campaign.linkText || null,
          linkUrl: campaign.linkUrl || null,
          abTestEnabled: campaign.abTestEnabled || false,
          abTestMode: campaign.abTestMode || "hash",
          subjectB: campaign.subjectB || null,
          textB: campaign.textB || null,
          jobDescriptionB: campaign.jobDescriptionB || null,
          postscriptB: campaign.postscriptB || null,
          linkTextB: campaign.linkTextB || null,
          linkUrlB: campaign.linkUrlB || null
        }}
        autoReply={{
          autoReplyEnabled: Boolean(campaign.autoReplyEnabled),
          autoReplyContext: campaign.autoReplyContext,
          autoReplyRules: campaign.autoReplyRules,
          autoReplyDelayMinutes: campaign.autoReplyDelayMinutes || 15,
          autoReplyContent: campaign.autoReplyContent,
          autoReplyGuardianTemplate: campaign.autoReplyGuardianTemplate,
          autoReplyGuardianTitle: campaign.autoReplyGuardianTitle,
          autoReplyIncludeGuardian: campaign.autoReplyIncludeGuardian || false, // ✅ NOWE
          autoReplyGuardianIntroText: campaign.autoReplyGuardianIntroText || null // ✅ NOWE
        }}
        agenda={{
          personaCriteria: personaDetails
        }}
      />

      {/* Sekcja usuwania kampanii przeniesiona do karty Raport */}
    </main>
  );
}

