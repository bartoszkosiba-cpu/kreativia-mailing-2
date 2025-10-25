import { LeadStatus, LeadSubStatus } from '@/types/leadStatus';

/**
 * Helper functions for lead status display and management
 * Centralized logic for UI components
 */

// ===== STATUS LABELS =====

export function getStatusLabel(status: LeadStatus): string {
  const labels: Record<LeadStatus, string> = {
    'AKTYWNY': 'Aktywny',
    'ZAINTERESOWANY': 'Zainteresowany', 
    'BLOKADA': 'Blokada',
    'CZEKAJ': 'Czekaj',
    'TEST': 'Test'
  };
  
  return labels[status] || status;
}

export function getSubStatusLabel(subStatus: LeadSubStatus | null): string {
  if (!subStatus) return '';
  
  const labels: Record<LeadSubStatus, string> = {
    // ZAINTERESOWANY sub-statuses
    'ZAINTERESOWANY_CAMPAIGN': 'Z kampanii',
    'ZAINTERESOWANY_NEW': 'Nowy lead',
    
    // BLOKADA sub-statuses  
    'BLOKADA_REFUSAL': 'Odmowa',
    'BLOKADA_BOUNCE': 'Email odbity',
    'BLOKADA_UNSUBSCRIBE': 'Wypisanie',
    'BLOKADA_REDIRECT_COMPLETED': 'Przekierowanie',
    
    // CZEKAJ sub-statuses
    'CZEKAJ_MAYBE': 'Może później',
    'CZEKAJ_REDIRECT_AWAITING_CONTACT': 'Czeka na kontakt',
    'CZEKAJ_OOO': 'Nieobecny',
    'CZEKAJ_OOO_WITH_CONTACTS': 'Nieobecny + kontakty'
  };
  
  return labels[subStatus] || subStatus;
}

export function getFullStatusLabel(status: LeadStatus, subStatus: LeadSubStatus | null): string {
  const mainLabel = getStatusLabel(status);
  const subLabel = getSubStatusLabel(subStatus);
  
  if (subLabel) {
    return `${mainLabel} (${subLabel})`;
  }
  
  return mainLabel;
}

// ===== STATUS COLORS =====

export function getStatusColor(status: LeadStatus): string {
  const colors: Record<LeadStatus, string> = {
    'AKTYWNY': '#10B981',      // green-500
    'ZAINTERESOWANY': '#3B82F6', // blue-500  
    'BLOKADA': '#EF4444',      // red-500
    'CZEKAJ': '#F59E0B',       // amber-500
    'TEST': '#6B7280'          // gray-500
  };
  
  return colors[status] || '#6B7280';
}

export function getSubStatusColor(subStatus: LeadSubStatus | null): string {
  if (!subStatus) return '#6B7280';
  
  const colors: Record<LeadSubStatus, string> = {
    // ZAINTERESOWANY - blue variants
    'ZAINTERESOWANY_CAMPAIGN': '#3B82F6',     // blue-500
    'ZAINTERESOWANY_NEW': '#1D4ED8',          // blue-700
    
    // BLOKADA - red variants
    'BLOKADA_REFUSAL': '#EF4444',             // red-500
    'BLOKADA_BOUNCE': '#DC2626',              // red-600
    'BLOKADA_UNSUBSCRIBE': '#B91C1C',         // red-700
    'BLOKADA_REDIRECT_COMPLETED': '#F97316',  // orange-500
    
    // CZEKAJ - amber/yellow variants
    'CZEKAJ_MAYBE': '#F59E0B',                // amber-500
    'CZEKAJ_REDIRECT_AWAITING_CONTACT': '#D97706', // amber-600
    'CZEKAJ_OOO': '#EAB308',                  // yellow-500
    'CZEKAJ_OOO_WITH_CONTACTS': '#CA8A04'     // yellow-600
  };
  
  return colors[subStatus] || '#6B7280';
}

// ===== STATUS ICONS =====

export function getStatusIcon(status: LeadStatus): string {
  const icons: Record<LeadStatus, string> = {
    'AKTYWNY': '🟢',
    'ZAINTERESOWANY': '🔵', 
    'BLOKADA': '🔴',
    'CZEKAJ': '🟡',
    'TEST': '⚪'
  };
  
  return icons[status] || '⚪';
}

export function getSubStatusIcon(subStatus: LeadSubStatus | null): string {
  if (!subStatus) return '';
  
  const icons: Record<LeadSubStatus, string> = {
    // ZAINTERESOWANY
    'ZAINTERESOWANY_CAMPAIGN': '📧',
    'ZAINTERESOWANY_NEW': '🆕',
    
    // BLOKADA
    'BLOKADA_REFUSAL': '❌',
    'BLOKADA_BOUNCE': '↩️',
    'BLOKADA_UNSUBSCRIBE': '🚫',
    'BLOKADA_REDIRECT_COMPLETED': '↗️',
    
    // CZEKAJ
    'CZEKAJ_MAYBE': '⏰',
    'CZEKAJ_REDIRECT_AWAITING_CONTACT': '📞',
    'CZEKAJ_OOO': '🏖️',
    'CZEKAJ_OOO_WITH_CONTACTS': '👥'
  };
  
  return icons[subStatus] || '';
}

// ===== STATUS LOGIC =====

export function canSendCampaign(status: LeadStatus, subStatus: LeadSubStatus | null, blockedCampaigns: number[] = [], campaignId?: number): boolean {
  // TEST leads - never send campaigns
  if (status === 'TEST') return false;
  
  // BLOKADA leads - never send campaigns
  if (status === 'BLOKADA') return false;
  
  // CZEKAJ leads - never send campaigns
  if (status === 'CZEKAJ') return false;
  
  // AKTYWNY leads - can send campaigns
  if (status === 'AKTYWNY') return true;
  
  // ZAINTERESOWANY leads - can send NEW campaigns, but not follow-ups from same campaign
  if (status === 'ZAINTERESOWANY') {
    if (!campaignId) return true; // New campaign
    
    // Check if this campaign is blocked
    return !blockedCampaigns.includes(campaignId);
  }
  
  return false;
}

export function canReceiveFollowUp(status: LeadStatus, subStatus: LeadSubStatus | null, blockedCampaigns: number[] = [], campaignId?: number): boolean {
  // Only AKTYWNY leads can receive follow-ups
  if (status !== 'AKTYWNY') return false;
  
  // Check if this campaign is blocked
  if (campaignId && blockedCampaigns.includes(campaignId)) return false;
  
  return true;
}

export function isHotLead(status: LeadStatus, subStatus: LeadSubStatus | null): boolean {
  // New leads from referrals are always hot
  if (subStatus === 'ZAINTERESOWANY_NEW') return true;
  
  // Recently interested leads are hot
  if (status === 'ZAINTERESOWANY') return true;
  
  return false;
}

export function getPriorityLevel(status: LeadStatus, subStatus: LeadSubStatus | null): 'HIGH' | 'MEDIUM' | 'LOW' {
  // Hot leads
  if (isHotLead(status, subStatus)) return 'HIGH';
  
  // Active leads
  if (status === 'AKTYWNY') return 'MEDIUM';
  
  // Waiting leads
  if (status === 'CZEKAJ') return 'LOW';
  
  // Blocked/Test leads
  return 'LOW';
}

// ===== STATUS TRANSITIONS =====

export function getAvailableTransitions(currentStatus: LeadStatus, currentSubStatus: LeadSubStatus | null): Array<{status: LeadStatus, subStatus: LeadSubStatus | null, label: string}> {
  const transitions: Array<{status: LeadStatus, subStatus: LeadSubStatus | null, label: string}> = [];
  
  switch (currentStatus) {
    case 'AKTYWNY':
      transitions.push(
        { status: 'ZAINTERESOWANY', subStatus: 'ZAINTERESOWANY_CAMPAIGN', label: 'Oznacz jako zainteresowany' },
        { status: 'BLOKADA', subStatus: 'BLOKADA_REFUSAL', label: 'Zablokuj (odmowa)' },
        { status: 'CZEKAJ', subStatus: 'CZEKAJ_MAYBE', label: 'Przenieś do czekania' },
        { status: 'TEST', subStatus: null, label: 'Przenieś do testów' }
      );
      break;
      
    case 'ZAINTERESOWANY':
      transitions.push(
        { status: 'AKTYWNY', subStatus: null, label: 'Przywróć do aktywnych' },
        { status: 'BLOKADA', subStatus: 'BLOKADA_REFUSAL', label: 'Zablokuj (odmowa)' }
      );
      break;
      
    case 'BLOKADA':
      transitions.push(
        { status: 'AKTYWNY', subStatus: null, label: 'Reaktywuj' },
        { status: 'ZAINTERESOWANY', subStatus: 'ZAINTERESOWANY_NEW', label: 'Oznacz jako zainteresowany' }
      );
      break;
      
    case 'CZEKAJ':
      transitions.push(
        { status: 'AKTYWNY', subStatus: null, label: 'Przywróć do aktywnych' },
        { status: 'ZAINTERESOWANY', subStatus: 'ZAINTERESOWANY_NEW', label: 'Oznacz jako zainteresowany' },
        { status: 'BLOKADA', subStatus: 'BLOKADA_REFUSAL', label: 'Zablokuj' }
      );
      break;
      
    case 'TEST':
      transitions.push(
        { status: 'AKTYWNY', subStatus: null, label: 'Przenieś do aktywnych' }
      );
      break;
  }
  
  return transitions;
}

// ===== UTILITY FUNCTIONS =====

export function formatBlockedCampaigns(blockedCampaigns: number[]): string {
  if (blockedCampaigns.length === 0) return 'Brak';
  if (blockedCampaigns.length === 1) return `Kampania ${blockedCampaigns[0]}`;
  return `Kampanie: ${blockedCampaigns.join(', ')}`;
}

export function getStatusDescription(status: LeadStatus, subStatus: LeadSubStatus | null): string {
  const descriptions: Record<string, string> = {
    'AKTYWNY': 'Lead aktywny - może otrzymywać kampanie i follow-upy',
    'ZAINTERESOWANY_CAMPAIGN': 'Zainteresowany po kampanii - przekazany do handlowca',
    'ZAINTERESOWANY_NEW': 'Nowy lead - wymaga natychmiastowej obsługi',
    'BLOKADA_REFUSAL': 'Zablokowany - odmówił współpracy',
    'BLOKADA_BOUNCE': 'Zablokowany - email odbity',
    'BLOKADA_UNSUBSCRIBE': 'Zablokowany - wypisał się z listy',
    'BLOKADA_REDIRECT_COMPLETED': 'Zablokowany - przekierowanie zakończone',
    'CZEKAJ_MAYBE': 'Czeka - może być zainteresowany w przyszłości',
    'CZEKAJ_REDIRECT_AWAITING_CONTACT': 'Czeka na kontakt - wysłano AUTO_FOLLOWUP',
    'CZEKAJ_OOO': 'Czeka - nieobecny, bez kontaktów zastępczych',
    'CZEKAJ_OOO_WITH_CONTACTS': 'Czeka - nieobecny, utworzono nowe leady',
    'TEST': 'Test - nie uczestniczy w kampaniach'
  };
  
  const key = subStatus ? `${status}_${subStatus}` : status;
  return descriptions[key] || 'Brak opisu';
}
