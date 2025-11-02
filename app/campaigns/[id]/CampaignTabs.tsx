"use client";

import { useState } from "react";
import CampaignReport from "./CampaignReport";
import CampaignPlanningInfo from "./CampaignPlanningInfo";
import SalespersonEditor from "./SalespersonEditor";
import LeadsEditor from "./LeadsEditor";
import CampaignScheduler from "./CampaignScheduler";
import CampaignStartButton from "./CampaignStartButton";
import CampaignTextEditor from "./CampaignTextEditor";
import FollowUpManager from "./FollowUpManager";
import CampaignSender from "./CampaignSender";
import CampaignOutbox from "./CampaignOutbox";
import DeleteCampaign from "./DeleteCampaign";
import CampaignInboxPage from "./inbox/page";
import AutoReplySettings from "./AutoReplySettings";
import CampaignAutoRepliesHistory from "./CampaignAutoRepliesHistory";

type LeadLite = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  language: string;
  hasSentEmail: boolean;
};

interface Props {
  campaignId: number;
  campaignName: string;
  isFollowUp: boolean;
  status: string;
  salesperson: any;
  leads: LeadLite[];
  schedule: {
    scheduledAt: string | null;
    allowedDays: string | null;
    startHour: number | null;
    startMinute: number | null;
    endHour: number | null;
    endMinute: number | null;
    delayBetweenEmails: number | null;
    maxEmailsPerDay: number | null;
    respectHolidays: boolean | null;
    targetCountries: string | null;
  };
  content: {
    subject: string | null;
    text: string | null;
    jobDescription: string | null;
    postscript: string | null;
    linkText: string | null;
    linkUrl: string | null;
    abTestEnabled: boolean | null;
    abTestMode: string | null;
    subjectB: string | null;
    textB: string | null;
    jobDescriptionB: string | null;
    postscriptB: string | null;
    linkTextB: string | null;
    linkUrlB: string | null;
  };
}

interface AutoReplySettingsProps {
  autoReplyEnabled: boolean;
  autoReplyContext: string | null;
  autoReplyRules: string | null;
  autoReplyDelayMinutes: number;
}

export default function CampaignTabs(props: Props & { autoReply?: AutoReplySettingsProps }) {
  const [active, setActive] = useState<
    "raport" | "handlowiec" | "leady" | "harmonogram" | "tresc" | "followupy" | "wysylka" | "inbox" | "automatyczne"
  >("raport");

  const TabButton = ({ id, label }: { id: typeof active; label: string }) => (
    <button
      onClick={() => setActive(id)}
      style={{
        padding: "8px 12px",
        borderRadius: 6,
        border: active === id ? "2px solid var(--color-primary)" : "1px solid #dee2e6",
        background: active === id ? "#e8f4fd" : "white",
        cursor: "pointer",
        fontWeight: active === id ? 700 : 500
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <TabButton id="raport" label="Raport" />
        <TabButton id="handlowiec" label="Handlowiec" />
        <TabButton id="leady" label="Leady" />
        <TabButton id="harmonogram" label="Harmonogram" />
        <TabButton id="tresc" label="Treść kampanii" />
        <TabButton id="followupy" label="Follow-upy" />
        <TabButton id="wysylka" label="Wysyłka" />
        <TabButton id="automatyczne" label="Automatyczne odpowiedzi" />
        <TabButton id="inbox" label="Inbox" />
      </div>

      {active === "raport" && (
        <>
          <CampaignReport campaignId={props.campaignId} />
          <DeleteCampaign campaignId={props.campaignId} campaignName={props.campaignName} />
        </>
      )}

      {active === "handlowiec" && (
        <SalespersonEditor campaignId={props.campaignId} currentSalesperson={props.salesperson} />
      )}

      {active === "leady" && (
        <LeadsEditor campaignId={props.campaignId} currentLeads={props.leads} campaignStatus={props.status} />
      )}

      {active === "harmonogram" && (
        <>
          <CampaignScheduler
            campaignId={props.campaignId}
            currentStatus={props.status}
            scheduledAt={props.schedule.scheduledAt}
            allowedDays={props.schedule.allowedDays}
            startHour={props.schedule.startHour}
            startMinute={props.schedule.startMinute ?? 0}
            endHour={props.schedule.endHour}
            endMinute={props.schedule.endMinute ?? 0}
            delayBetweenEmails={props.schedule.delayBetweenEmails}
            maxEmailsPerDay={props.schedule.maxEmailsPerDay}
            respectHolidays={props.schedule.respectHolidays}
            targetCountries={props.schedule.targetCountries}
            leadsCount={props.leads.length}
          />
          <CampaignPlanningInfo campaignId={props.campaignId} />
        </>
      )}

      {active === "tresc" && (
        <CampaignTextEditor
          campaignId={props.campaignId}
          initialSubject={props.content.subject || ""}
          initialText={props.content.text || ""}
          initialJobDescription={props.content.jobDescription || ""}
          initialPostscript={props.content.postscript || ""}
          initialLinkText={props.content.linkText || ""}
          initialLinkUrl={props.content.linkUrl || ""}
          initialAbTestEnabled={!!props.content.abTestEnabled}
          initialAbTestMode={props.content.abTestMode || "hash"}
          initialSubjectB={props.content.subjectB || ""}
          initialTextB={props.content.textB || ""}
          initialJobDescriptionB={props.content.jobDescriptionB || ""}
          initialPostscriptB={props.content.postscriptB || ""}
          initialLinkTextB={props.content.linkTextB || ""}
          initialLinkUrlB={props.content.linkUrlB || ""}
          leads={props.leads}
        />
      )}

      {active === "followupy" && (
        <FollowUpManager campaignId={props.campaignId} isFollowUp={props.isFollowUp} />
      )}

      {active === "wysylka" && (
        <>
          <CampaignStartButton
            campaignId={props.campaignId}
            currentStatus={props.status}
            leadsCount={props.leads.length}
            delayBetweenEmails={props.schedule.delayBetweenEmails}
          />
          <CampaignOutbox campaignId={props.campaignId} />
          <CampaignSender
            campaignId={props.campaignId}
            hasSubject={!!props.content.subject}
            hasText={!!props.content.text}
            hasLeads={props.leads.length > 0}
            leadsCount={props.leads.length}
            salesperson={props.salesperson}
          />
        </>
      )}

      {active === "automatyczne" && (
        <>
          <AutoReplySettings
            campaignId={props.campaignId}
            initialSettings={{
              autoReplyEnabled: props.autoReply?.autoReplyEnabled || false,
              autoReplyContext: props.autoReply?.autoReplyContext || null,
              autoReplyRules: props.autoReply?.autoReplyRules || null,
              autoReplyDelayMinutes: props.autoReply?.autoReplyDelayMinutes || 15
            }}
          />
          <CampaignAutoRepliesHistory campaignId={props.campaignId} />
        </>
      )}

      {active === "inbox" && (
        // Reuse page component as a tab by passing params
        <CampaignInboxPage params={{ id: String(props.campaignId) }} />
      )}
    </div>
  );
}


