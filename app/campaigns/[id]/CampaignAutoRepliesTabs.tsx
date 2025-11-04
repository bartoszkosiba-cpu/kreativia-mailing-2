"use client";

import { useState, useEffect } from "react";
import AutoReplySettings from "./AutoReplySettings";
import CampaignMaterialDecisions from "./CampaignMaterialDecisions";

interface Props {
  campaignId: number;
  autoReply?: {
    autoReplyEnabled: boolean;
    autoReplyContext: string | null;
    autoReplyRules: string | null;
    autoReplyDelayMinutes: number;
    autoReplyContent: string | null;
    autoReplyGuardianTemplate: string | null;
    autoReplyGuardianTitle: string | null;
    autoReplyIncludeGuardian?: boolean;
    autoReplyGuardianIntroText?: string | null;
  };
  campaignSubject?: string | null;
}

export default function CampaignAutoRepliesTabs({ campaignId, autoReply, campaignSubject }: Props) {
  type SubTabId = "ustawienia" | "oczekujace" | "odrzucone" | "wyslane";
  
  // Mapowanie hash -> sub tab ID
  const hashToSubTab: Record<string, SubTabId> = {
    "#automatyczne-ustawienia": "ustawienia",
    "#automatyczne-oczekujace": "oczekujace",
    "#automatyczne-odrzucone": "odrzucone",
    "#automatyczne-wyslane": "wyslane"
  };
  
  // Mapowanie sub tab ID -> hash
  const subTabToHash: Record<SubTabId, string> = {
    "ustawienia": "#automatyczne-ustawienia",
    "oczekujace": "#automatyczne-oczekujace",
    "odrzucone": "#automatyczne-odrzucone",
    "wyslane": "#automatyczne-wyslane"
  };
  
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("ustawienia");
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    
    const getActiveSubTabFromHash = (): SubTabId => {
      if (typeof window === 'undefined') return "ustawienia";
      const hash = window.location.hash;
      
      // Sprawdź czy hash pasuje do podkart automatycznych odpowiedzi
      if (hashToSubTab[hash]) {
        return hashToSubTab[hash];
      }
      
      // Jeśli jesteśmy na karcie automatyczne (#automatyczne), ale bez podkarty, zwróć domyślną
      if (hash === "#automatyczne") {
        return "ustawienia";
      }
      
      return "ustawienia";
    };
    
    // Sprawdź hash przy pierwszym załadowaniu (tylko jeśli jesteśmy na karcie automatyczne)
    if (window.location.hash === "#automatyczne" || window.location.hash.startsWith("#automatyczne-")) {
      const initialSubTab = getActiveSubTabFromHash();
      setActiveSubTab(initialSubTab);
      
      // Jeśli jest tylko #automatyczne bez podkarty, ustaw domyślny hash
      if (window.location.hash === "#automatyczne") {
        window.history.replaceState(null, '', `${window.location.pathname}#automatyczne-ustawienia`);
      }
    }
    
    // Nasłuchuj zmian hash
    const handleHashChange = () => {
      if (window.location.hash === "#automatyczne" || window.location.hash.startsWith("#automatyczne-")) {
        const newActive = getActiveSubTabFromHash();
        setActiveSubTab(newActive);
        
        // Jeśli hash to tylko #automatyczne (bez podkarty), ustaw domyślną podkartę
        if (window.location.hash === "#automatyczne") {
          window.history.replaceState(null, '', `${window.location.pathname}#automatyczne-ustawienia`);
        }
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);
  
  // Synchronizuj hash URL z aktywną podkartą przy zmianie (tylko na kliencie)
  useEffect(() => {
    if (!isClient) return;
    
    const hash = subTabToHash[activeSubTab];
    if (hash && typeof window !== 'undefined') {
      // Jeśli przełączamy podkartę, sprawdź czy jesteśmy na karcie "automatyczne"
      // Jeśli nie, nie zmieniaj hash (podkarty są widoczne tylko w kontekście głównej karty)
      if (window.location.hash === "#automatyczne" || window.location.hash.startsWith("#automatyczne-")) {
        window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
      }
      // Jeśli active === "automatyczne" i hash już zaczyna się od "#automatyczne-", nie zmieniaj (podkarta ma priorytet)
    }
  }, [activeSubTab, isClient]);
  
  const SubTabButton = ({ id, label }: { id: SubTabId; label: string }) => (
    <button
      onClick={() => setActiveSubTab(id)}
      style={{
        padding: "8px 16px",
        borderRadius: 6,
        border: activeSubTab === id ? "2px solid var(--color-primary)" : "1px solid #dee2e6",
        background: activeSubTab === id ? "#e8f4fd" : "white",
        cursor: "pointer",
        fontWeight: activeSubTab === id ? 700 : 500,
        fontSize: "14px"
      }}
    >
      {label}
    </button>
  );
  
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0", borderBottom: "2px solid #dee2e6", paddingBottom: "8px" }}>
        <SubTabButton id="ustawienia" label="Ustawienia" />
        <SubTabButton id="oczekujace" label="Oczekujące na decyzje" />
        <SubTabButton id="odrzucone" label="Odrzucone" />
        <SubTabButton id="wyslane" label="Wysłane" />
      </div>
      
      {activeSubTab === "ustawienia" && (
        <AutoReplySettings
          campaignId={campaignId}
          initialSettings={{
            autoReplyEnabled: autoReply?.autoReplyEnabled || false,
            autoReplyContext: autoReply?.autoReplyContext || null,
            autoReplyRules: autoReply?.autoReplyRules || null,
            autoReplyDelayMinutes: autoReply?.autoReplyDelayMinutes || 15,
            autoReplyContent: autoReply?.autoReplyContent || null,
            autoReplyGuardianTemplate: autoReply?.autoReplyGuardianTemplate || null,
            autoReplyGuardianTitle: autoReply?.autoReplyGuardianTitle || null,
            autoReplyIncludeGuardian: autoReply?.autoReplyIncludeGuardian || false,
            autoReplyGuardianIntroText: autoReply?.autoReplyGuardianIntroText || null
          }}
          campaignSubject={campaignSubject || null}
        />
      )}
      
      {activeSubTab === "oczekujace" && (
        <CampaignMaterialDecisions campaignId={campaignId} showOnlyPending={true} />
      )}
      
      {activeSubTab === "odrzucone" && (
        <CampaignMaterialDecisions campaignId={campaignId} showOnlyRejected={true} />
      )}
      
      {activeSubTab === "wyslane" && (
        <CampaignMaterialDecisions campaignId={campaignId} showOnlyHistory={true} />
      )}
    </div>
  );
}
