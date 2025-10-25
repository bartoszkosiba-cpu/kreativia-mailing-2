// Lead Status System Types
// Definicje typów dla nowego systemu statusów leadów

export type LeadStatus = 
  | "AKTYWNY" 
  | "ZAINTERESOWANY" 
  | "BLOKADA" 
  | "CZEKAJ" 
  | "TEST"
  | "NO_GREETING";

export type LeadSubStatus = 
  // ZAINTERESOWANY sub-statuses
  | "ZAINTERESOWANY_CAMPAIGN"
  | "ZAINTERESOWANY_NEW"
  | "ZAINTERESOWANY_REACTIVATED"
  
  // BLOKADA sub-statuses
  | "BLOKADA_REFUSAL"
  | "BLOKADA_BOUNCE"
  | "BLOKADA_UNSUBSCRIBE"
  | "BLOKADA_REDIRECT_COMPLETED"
  
  // CZEKAJ sub-statuses
  | "CZEKAJ_MAYBE"
  | "CZEKAJ_REDIRECT_AWAITING_CONTACT"
  | "CZEKAJ_OOO"
  | "CZEKAJ_OOO_WITH_CONTACTS"
  | "CZEKAJ_REDIRECT_COMPLETED";

export type LeadSource = 
  | "CSV_IMPORT"
  | "OOO_RESPONSE"
  | "REDIRECT_RESPONSE"
  | "UNATTACHED";

export interface LeadStatusInfo {
  status: LeadStatus;
  subStatus?: LeadSubStatus;
  blockedCampaigns: number[];
  reactivatedAt?: Date;
  lastReactivation?: string;
  originalLeadId?: number;
  source?: LeadSource;
  sourceDetails?: Record<string, any>;
}

export interface LeadStatusConfig {
  status: LeadStatus;
  subStatus?: LeadSubStatus;
  label: string;
  color: string;
  icon: string;
  description: string;
  canSendCampaigns: boolean;
  canSendNewCampaigns: boolean;
  canSendFollowUps: boolean;
  requiresAction: boolean;
  actionType?: "FORWARD" | "AUTO_FOLLOWUP" | "REACTIVATE" | "NONE";
}

// Status configurations
export const LEAD_STATUS_CONFIGS: Record<LeadStatus, LeadStatusConfig[]> = {
  AKTYWNY: [{
    status: "AKTYWNY",
    label: "Aktywny",
    color: "#28a745",
    icon: "✅",
    description: "Lead nic nie odpisał - od importu do pierwszej odpowiedzi",
    canSendCampaigns: true,
    canSendNewCampaigns: true,
    canSendFollowUps: true,
    requiresAction: false,
    actionType: "NONE"
  }],
  
  ZAINTERESOWANY: [
    {
      status: "ZAINTERESOWANY",
      subStatus: "ZAINTERESOWANY_CAMPAIGN",
      label: "Zainteresowany (kampania)",
      color: "#155724",
      icon: "💚",
      description: "Odpowiedź na kampanię - przejmij!",
      canSendCampaigns: false,
      canSendNewCampaigns: true,
      canSendFollowUps: false,
      requiresAction: true,
      actionType: "FORWARD"
    },
    {
      status: "ZAINTERESOWANY",
      subStatus: "ZAINTERESOWANY_NEW",
      label: "Zainteresowany (nowy)",
      color: "#155724",
      icon: "💚",
      description: "Nowy mail z zainteresowaniem - przejmij!",
      canSendCampaigns: true,
      canSendNewCampaigns: true,
      canSendFollowUps: true,
      requiresAction: true,
      actionType: "FORWARD"
    },
    {
      status: "ZAINTERESOWANY",
      subStatus: "ZAINTERESOWANY_REACTIVATED",
      label: "Zainteresowany (reaktywowany)",
      color: "#155724",
      icon: "💚",
      description: "Lead reaktywowany z BLOKADA - przejmij!",
      canSendCampaigns: true,
      canSendNewCampaigns: true,
      canSendFollowUps: true,
      requiresAction: true,
      actionType: "FORWARD"
    }
  ],
  
  BLOKADA: [
    {
      status: "BLOKADA",
      subStatus: "BLOKADA_REFUSAL",
      label: "Blokada (odmowa)",
      color: "#dc3545",
      icon: "🚫",
      description: "Jasna odmowa - trwale zablokowany",
      canSendCampaigns: false,
      canSendNewCampaigns: false,
      canSendFollowUps: false,
      requiresAction: false,
      actionType: "NONE"
    },
    {
      status: "BLOKADA",
      subStatus: "BLOKADA_BOUNCE",
      label: "Blokada (odbicie)",
      color: "#dc3545",
      icon: "🚫",
      description: "Email odbity - trwale zablokowany",
      canSendCampaigns: false,
      canSendNewCampaigns: false,
      canSendFollowUps: false,
      requiresAction: false,
      actionType: "NONE"
    },
    {
      status: "BLOKADA",
      subStatus: "BLOKADA_UNSUBSCRIBE",
      label: "Blokada (wypisanie)",
      color: "#dc3545",
      icon: "🚫",
      description: "Prośba o wypisanie - trwale zablokowany",
      canSendCampaigns: false,
      canSendNewCampaigns: false,
      canSendFollowUps: false,
      requiresAction: false,
      actionType: "NONE"
    },
    {
      status: "BLOKADA",
      subStatus: "BLOKADA_REDIRECT_COMPLETED",
      label: "Blokada (przekazał kontakt)",
      color: "#dc3545",
      icon: "🚫",
      description: "Przekazał kontakt i został zablokowany",
      canSendCampaigns: false,
      canSendNewCampaigns: false,
      canSendFollowUps: false,
      requiresAction: false,
      actionType: "NONE"
    }
  ],
  
  CZEKAJ: [
    {
      status: "CZEKAJ",
      subStatus: "CZEKAJ_MAYBE",
      label: "Czekaj (może później)",
      color: "#ffc107",
      icon: "⏳",
      description: "Miękka odmowa - czeka na reaktywację ręczną",
      canSendCampaigns: false,
      canSendNewCampaigns: true,
      canSendFollowUps: false,
      requiresAction: false,
      actionType: "NONE"
    },
    {
      status: "CZEKAJ",
      subStatus: "CZEKAJ_REDIRECT_AWAITING_CONTACT",
      label: "Czekaj (czeka na kontakt)",
      color: "#ffc107",
      icon: "⏳",
      description: "Przekazał do działu - czeka na kontakt",
      canSendCampaigns: false,
      canSendNewCampaigns: true,
      canSendFollowUps: false,
      requiresAction: true,
      actionType: "AUTO_FOLLOWUP"
    },
    {
      status: "CZEKAJ",
      subStatus: "CZEKAJ_OOO",
      label: "Czekaj (OOO)",
      color: "#ffc107",
      icon: "⏳",
      description: "Out of office - czeka na powrót",
      canSendCampaigns: true,
      canSendNewCampaigns: true,
      canSendFollowUps: true,
      requiresAction: false,
      actionType: "NONE"
    },
    {
      status: "CZEKAJ",
      subStatus: "CZEKAJ_OOO_WITH_CONTACTS",
      label: "Czekaj (OOO z kontaktami)",
      color: "#ffc107",
      icon: "⏳",
      description: "OOO z przekazanymi kontaktami zastępczymi",
      canSendCampaigns: true,
      canSendNewCampaigns: true,
      canSendFollowUps: true,
      requiresAction: false,
      actionType: "NONE"
    }
  ],
  
  TEST: [{
    status: "TEST",
    label: "Test",
    color: "#6c757d",
    icon: "🧪",
    description: "Lead testowy - nie wysyłaj",
    canSendCampaigns: false,
    canSendNewCampaigns: false,
    canSendFollowUps: false,
    requiresAction: false,
    actionType: "NONE"
  }],
  
  NO_GREETING: [{
    status: "NO_GREETING",
    label: "Brak powitania",
    color: "#9CA3AF",
    icon: "●",
    description: "Lead zaimportowany bez powitania - wymaga przygotowania",
    canSendCampaigns: false,
    canSendNewCampaigns: false,
    canSendFollowUps: false,
    requiresAction: true,
    actionType: "NONE"
  }]
};

// Helper functions
export function getLeadStatusConfig(status: LeadStatus, subStatus?: LeadSubStatus): LeadStatusConfig | null {
  const configs = LEAD_STATUS_CONFIGS[status];
  if (!configs) return null;
  
  if (subStatus) {
    return configs.find(config => config.subStatus === subStatus) || configs[0];
  }
  
  return configs[0];
}

export function canSendCampaign(lead: LeadStatusInfo, campaignId: number): boolean {
  const config = getLeadStatusConfig(lead.status, lead.subStatus);
  if (!config) return false;
  
  // Check if campaign is blocked
  if (lead.blockedCampaigns.includes(campaignId)) {
    return false;
  }
  
  return config.canSendCampaigns;
}

export function canSendNewCampaign(lead: LeadStatusInfo): boolean {
  const config = getLeadStatusConfig(lead.status, lead.subStatus);
  return config?.canSendNewCampaigns || false;
}

export function canSendFollowUps(lead: LeadStatusInfo, campaignId: number): boolean {
  const config = getLeadStatusConfig(lead.status, lead.subStatus);
  if (!config) return false;
  
  // Check if campaign is blocked
  if (lead.blockedCampaigns.includes(campaignId)) {
    return false;
  }
  
  return config.canSendFollowUps;
}

export function requiresAction(lead: LeadStatusInfo): boolean {
  const config = getLeadStatusConfig(lead.status, lead.subStatus);
  return config?.requiresAction || false;
}

export function getActionType(lead: LeadStatusInfo): string | undefined {
  const config = getLeadStatusConfig(lead.status, lead.subStatus);
  return config?.actionType;
}
