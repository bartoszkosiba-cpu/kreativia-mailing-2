"use client";

import { useState, useEffect } from "react";
import CampaignReport from "./CampaignReport";
import CampaignPlanningInfo from "./CampaignPlanningInfo";
import SalespersonEditor from "./SalespersonEditor";
import LeadsEditor from "./LeadsEditor";
import CampaignScheduler from "./CampaignScheduler";
import CampaignStartButton from "./CampaignStartButton";
import CampaignTextEditor from "./CampaignTextEditor";
import FollowUpManager from "./FollowUpManager";
import CampaignSender from "./CampaignSender";
import CampaignOutboxTabs from "./CampaignOutboxTabs";
import DeleteCampaign from "./DeleteCampaign";
import CampaignInboxPage from "./inbox/page";
import AutoReplySettings from "./AutoReplySettings";
import CampaignAutoRepliesTabs from "./CampaignAutoRepliesTabs";
import NextEmailTime from "./NextEmailTime";
import CampaignAgendaTab from "./CampaignAgendaTab";

type LeadLite = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  language: string;
  hasSentEmail: boolean;
};

type PersonaRoleConfigUI = {
  label: string;
  matchType?: string;
  keywords?: string[];
  departments?: string[];
  minSeniority?: string;
  confidence?: number;
};

type PersonaConditionalRuleUI = {
  rule: "include" | "exclude";
  whenAll?: string[];
  whenAny?: string[];
  unless?: string[];
  notes?: string;
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
  autoReplyContent: string | null;
    autoReplyGuardianTemplate: string | null;
    autoReplyGuardianTitle: string | null;
    autoReplyIncludeGuardian?: boolean; // ✅ NOWE
    autoReplyGuardianIntroText?: string | null; // ✅ NOWE
}

interface AgendaProps {
  personaCriteria: {
    id: number;
    companyCriteriaId: number;
    name: string;
    description?: string | null;
    language?: string | null;
    positiveRoles: PersonaRoleConfigUI[];
    negativeRoles: PersonaRoleConfigUI[];
    conditionalRules: PersonaConditionalRuleUI[];
  } | null;
}

export default function CampaignTabs(props: Props & { autoReply?: AutoReplySettingsProps; agenda?: AgendaProps }) {
      type TabId = "raport" | "handlowiec" | "leady" | "harmonogram" | "tresc" | "followupy" | "wysylka" | "inbox" | "automatyczne" | "agenda";
      
      // Mapowanie hash -> tab ID
      const hashToTab: Record<string, TabId> = {
        "#raport": "raport",
        "#handlowiec": "handlowiec",
        "#leady": "leady",
        "#harmonogram": "harmonogram",
        "#tresc": "tresc",
        "#followupy": "followupy",
        "#wysylka": "wysylka",
        "#inbox": "inbox",
        "#automatyczne": "automatyczne",
        "#agenda": "agenda",
      };
      
      // Mapowanie tab ID -> hash
      const tabToHash: Record<TabId, string> = {
        "raport": "#raport",
        "handlowiec": "#handlowiec",
        "leady": "#leady",
        "harmonogram": "#harmonogram",
        "tresc": "#tresc",
        "followupy": "#followupy",
        "wysylka": "#wysylka",
        "inbox": "#inbox",
        "automatyczne": "#automatyczne",
        "agenda": "#agenda",
      };
      
      // ✅ Zawsze zaczynaj od "raport" (dla SSR) - hash zostanie sprawdzony w useEffect
      const [active, setActive] = useState<TabId>("raport");
  const [isClient, setIsClient] = useState(false);
  
  // ✅ Sprawdź hash dopiero po mount (tylko na kliencie)
  useEffect(() => {
    setIsClient(true);
    
    // Funkcja do pobrania aktywnej karty z URL hash
    const getActiveTabFromHash = (): TabId => {
      if (typeof window === 'undefined') return "raport";
      const hash = window.location.hash;
      
      // Sprawdź czy hash to podkarta wysyłki (np. #wysylka-status)
      if (hash.startsWith("#wysylka-")) {
        return "wysylka";
      }
      
      // Sprawdź czy hash to podkarta automatycznych odpowiedzi (np. #automatyczne-ustawienia)
      if (hash.startsWith("#automatyczne-")) {
        return "automatyczne";
      }
      
      // Sprawdź normalne mapowanie hash -> tab
      if (hashToTab[hash]) {
        return hashToTab[hash];
      }
      
      return "raport";
    };
    
    // Sprawdź hash przy pierwszym załadowaniu
    const initialTab = getActiveTabFromHash();
    setActive(initialTab);
    
    // Jeśli nie ma hash, ustaw domyślny hash
    if (!window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}#raport`);
    }
    
    // Jeśli hash to tylko #wysylka (bez podkarty), ustaw domyślną podkartę
    if (window.location.hash === "#wysylka") {
      window.history.replaceState(null, '', `${window.location.pathname}#wysylka-status`);
    }
    
    // Jeśli hash to tylko #automatyczne (bez podkarty), ustaw domyślną podkartę
    if (window.location.hash === "#automatyczne") {
      window.history.replaceState(null, '', `${window.location.pathname}#automatyczne-ustawienia`);
    }
    
    // Nasłuchuj zmian hash
    const handleHashChange = () => {
      const newActive = getActiveTabFromHash();
      setActive(newActive);
      
      // Jeśli hash to tylko #wysylka (bez podkarty), ustaw domyślną podkartę
      if (window.location.hash === "#wysylka") {
        window.history.replaceState(null, '', `${window.location.pathname}#wysylka-status`);
      }
      
      // Jeśli hash to tylko #automatyczne (bez podkarty), ustaw domyślną podkartę
      if (window.location.hash === "#automatyczne") {
        window.history.replaceState(null, '', `${window.location.pathname}#automatyczne-ustawienia`);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Pusta tablica zależności - uruchom tylko raz przy mount
  
  // Synchronizuj hash URL z aktywną kartą przy zmianie (tylko na kliencie)
  useEffect(() => {
    if (!isClient) return;
    
    const hash = tabToHash[active];
    if (hash && typeof window !== 'undefined') {
      // Jeśli przełączamy na kartę "wysylka", sprawdź czy jest już podkarta w hash
      // Jeśli nie, ustaw domyślną podkartę "status"
      if (active === "wysylka" && !window.location.hash.startsWith("#wysylka-")) {
        window.history.replaceState(null, '', `${window.location.pathname}#wysylka-status`);
      } else if (active === "automatyczne" && !window.location.hash.startsWith("#automatyczne-")) {
        // Jeśli przełączamy na kartę "automatyczne", sprawdź czy jest już podkarta w hash
        // Jeśli nie, ustaw domyślną podkartę "ustawienia"
        window.history.replaceState(null, '', `${window.location.pathname}#automatyczne-ustawienia`);
      } else if (active !== "wysylka" && active !== "automatyczne") {
        // Dla innych kart, ustaw normalny hash
        window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
      }
      // Jeśli active === "wysylka" i hash już zaczyna się od "#wysylka-", nie zmieniaj (podkarta ma priorytet)
      // Jeśli active === "automatyczne" i hash już zaczyna się od "#automatyczne-", nie zmieniaj (podkarta ma priorytet)
    }
  }, [active, isClient]);

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
        <TabButton id="agenda" label="Agenda AI" />
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
            allowedDays={props.schedule.allowedDays || ""}
            startHour={props.schedule.startHour ?? 9}
            startMinute={props.schedule.startMinute ?? 0}
            endHour={props.schedule.endHour ?? 17}
            endMinute={props.schedule.endMinute ?? 0}
            delayBetweenEmails={props.schedule.delayBetweenEmails ?? 60}
            maxEmailsPerDay={props.schedule.maxEmailsPerDay ?? 50}
            respectHolidays={props.schedule.respectHolidays ?? false}
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
        <CampaignOutboxTabs
          campaignId={props.campaignId}
          campaignName={props.campaignName}
          campaignStatus={props.status}
          leadsCount={props.leads.length}
          delayBetweenEmails={props.schedule.delayBetweenEmails ?? 60}
          hasSubject={!!props.content.subject}
          hasText={!!props.content.text}
          hasLeads={props.leads.length > 0}
          salesperson={props.salesperson}
        />
      )}

      {active === "automatyczne" && (
        <CampaignAutoRepliesTabs 
          campaignId={props.campaignId}
          autoReply={{
            autoReplyEnabled: props.autoReply?.autoReplyEnabled || false,
            autoReplyContext: props.autoReply?.autoReplyContext || null,
            autoReplyRules: props.autoReply?.autoReplyRules || null,
            autoReplyDelayMinutes: props.autoReply?.autoReplyDelayMinutes || 15,
            autoReplyContent: props.autoReply?.autoReplyContent || null,
            autoReplyGuardianTemplate: props.autoReply?.autoReplyGuardianTemplate || null,
            autoReplyGuardianTitle: props.autoReply?.autoReplyGuardianTitle || null,
            autoReplyIncludeGuardian: props.autoReply?.autoReplyIncludeGuardian || false,
            autoReplyGuardianIntroText: props.autoReply?.autoReplyGuardianIntroText || null
          }}
          campaignSubject={props.content?.subject || null}
        />
      )}

      {active === "agenda" && (
        <CampaignAgendaTab
          campaignId={props.campaignId}
          personaCriteria={props.agenda?.personaCriteria ?? null}
        />
      )}

      {active === "inbox" && (
        // Reuse page component as a tab by passing params
        <CampaignInboxPage params={{ id: String(props.campaignId) }} />
      )}
    </div>
  );
}


