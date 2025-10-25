'use client';

import React, { useState, useEffect } from 'react';
import { LeadStatus, LeadSubStatus } from '@/types/leadStatus';
import { 
  getStatusLabel, 
  getSubStatusLabel, 
  getStatusDescription,
  getAvailableTransitions,
  formatBlockedCampaigns,
  getStatusColor
} from '@/lib/statusHelpers';

interface StatusHistoryEntry {
  id: number;
  oldStatus: string | null;
  oldSubStatus: string | null;
  newStatus: string;
  newSubStatus: string | null;
  reason: string | null;
  changedBy: string | null;
  notes: string | null;
  createdAt: string;
}

interface StatusManagerProps {
  leadId: number;
  currentStatus: LeadStatus;
  currentSubStatus: LeadSubStatus | null;
  blockedCampaigns: number[];
  onStatusChange: (status: LeadStatus, subStatus: LeadSubStatus | null) => Promise<void>;
  className?: string;
}

export function StatusManager({ 
  leadId,
  currentStatus, 
  currentSubStatus, 
  blockedCampaigns,
  onStatusChange,
  className = ''
}: StatusManagerProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>(currentStatus);
  const [selectedSubStatus, setSelectedSubStatus] = useState<LeadSubStatus | null>(currentSubStatus);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Pobierz historię statusów
  const fetchStatusHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/status-history`);
      if (response.ok) {
        const data = await response.json();
        setStatusHistory(data.history || []);
      }
    } catch (error) {
      console.error('Błąd pobierania historii statusów:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Pobierz historię przy załadowaniu komponentu
  useEffect(() => {
    fetchStatusHistory();
  }, [leadId]);
  
  const handleStatusChange = async (newStatus: LeadStatus, newSubStatus: LeadSubStatus | null) => {
    setIsChanging(true);
    setError(null);
    
    try {
      await onStatusChange(newStatus, newSubStatus);
      // Odśwież historię po zmianie statusu
      await fetchStatusHistory();
    } catch (err: any) {
      setError(err.message || 'Błąd podczas zmiany statusu');
    } finally {
      setIsChanging(false);
    }
  };
  
  const description = getStatusDescription(currentStatus, currentSubStatus);
  const availableTransitions = getAvailableTransitions(currentStatus, currentSubStatus);
  
  const handleStatusSelect = (status: LeadStatus, subStatus: LeadSubStatus | null) => {
    setSelectedStatus(status);
    setSelectedSubStatus(subStatus);
  };
  
  const handleConfirm = () => {
    handleStatusChange(selectedStatus, selectedSubStatus);
    setIsOpen(false);
  };
  
  const handleCancel = () => {
    setSelectedStatus(currentStatus);
    setSelectedSubStatus(currentSubStatus);
    setIsOpen(false);
  };
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {/* Current Status Display */}
      <div style={{ 
        backgroundColor: 'var(--gray-50)', 
        padding: 'var(--spacing-md)', 
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--gray-200)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 'var(--spacing-sm)' 
        }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: 'var(--gray-900)',
            margin: 0
          }}>
            Status Leadu
          </h3>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            fontWeight: '500',
            color: 'white',
            fontSize: '1rem',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: getStatusColor(currentStatus),
            borderRadius: 'var(--radius)'
          }}>
            <span style={{ fontSize: '12px', lineHeight: 1 }}>●</span>
            <span>{getStatusLabel(currentStatus)}</span>
          </div>
        </div>
        
        <p style={{ 
          color: 'var(--gray-600)', 
          fontSize: '14px', 
          margin: 0,
          marginBottom: 'var(--spacing-sm)'
        }}>
          {description}
        </p>
        
        {blockedCampaigns.length > 0 && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: 'var(--radius)',
            padding: 'var(--spacing-sm)',
            marginTop: 'var(--spacing-sm)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 'var(--spacing-xs)',
              color: '#92400e',
              fontWeight: '500'
            }}>
                        <span>!</span>
              <span>Zablokowane kampanie:</span>
            </div>
            <p style={{ 
              color: '#b45309', 
              fontSize: '14px', 
              margin: 'var(--spacing-xs) 0 0 0'
            }}>
              {formatBlockedCampaigns(blockedCampaigns)}
            </p>
          </div>
        )}
      </div>
      
      {/* Status Change Section */}
      {availableTransitions.length > 0 && (
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid var(--gray-200)', 
          borderRadius: 'var(--radius-lg)', 
          padding: 'var(--spacing-md)'
        }}>
          <h4 style={{ 
            fontWeight: '500', 
            color: 'var(--gray-900)', 
            marginBottom: 'var(--spacing-sm)',
            margin: 0
          }}>
            Zmień status
          </h4>
          
          <div style={{ position: 'relative', marginBottom: 'var(--spacing-sm)' }}>
            {/* Current Status Display */}
            <button
              onClick={() => !isChanging && setIsOpen(!isOpen)}
            disabled={isChanging}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--radius)',
                border: '2px dashed',
                borderColor: isOpen ? 'var(--color-primary)' : 'var(--gray-300)',
                backgroundColor: isOpen ? 'rgba(216, 30, 66, 0.08)' : 'transparent',
                cursor: isChanging ? 'not-allowed' : 'pointer',
                opacity: isChanging ? 0.5 : 1,
                width: '100%',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                if (!isChanging) {
                  e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                }
              }}
              onMouseOut={(e) => {
                if (!isChanging) {
                  e.currentTarget.style.backgroundColor = isOpen ? 'rgba(216, 30, 66, 0.08)' : 'transparent';
                }
              }}
            >
              <div 
                style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(currentStatus)
                }}
              />
              <span style={{ fontWeight: '500' }}>{getStatusLabel(currentStatus)}</span>
              {currentSubStatus && (
                <>
                  <span style={{ color: 'var(--gray-400)' }}>/</span>
                  <span style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                    {getSubStatusLabel(currentSubStatus)}
                  </span>
                </>
              )}
              {!isChanging && (
                <span style={{ color: 'var(--gray-400)', marginLeft: 'auto' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              )}
            </button>
            
            {/* Dropdown */}
            {isOpen && !isChanging && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 'var(--spacing-xs)',
                backgroundColor: 'white',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                zIndex: 50,
                maxHeight: '384px',
                overflowY: 'auto'
              }}>
                <div style={{ padding: 'var(--spacing-sm)' }}>
                  <h4 style={{ 
                    fontWeight: '500', 
                    color: 'var(--gray-900)', 
                    marginBottom: 'var(--spacing-sm)',
                    margin: 0
                  }}>
                    Wybierz nowy status:
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                    {availableTransitions.map((transition, index) => {
                      const isSelected = selectedStatus === transition.status && selectedSubStatus === transition.subStatus;
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleStatusSelect(transition.status, transition.subStatus)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            padding: 'var(--spacing-sm)',
                            borderRadius: 'var(--radius)',
                            textAlign: 'left',
                            transition: 'all 0.2s ease',
                            border: '2px solid',
                            borderColor: isSelected ? 'var(--color-primary)' : 'transparent',
                            backgroundColor: isSelected ? 'rgba(216, 30, 66, 0.08)' : 'transparent',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                          onMouseOver={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <div 
                            style={{ 
                              width: '16px', 
                              height: '16px', 
                              borderRadius: '50%',
                              backgroundColor: getStatusColor(transition.status)
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500' }}>{getStatusLabel(transition.status)}</div>
                            {transition.subStatus && (
                              <div style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                                {getSubStatusLabel(transition.subStatus)}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
                            {transition.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ 
                    display: 'flex', 
                    gap: 'var(--spacing-xs)', 
                    marginTop: 'var(--spacing-md)', 
                    paddingTop: 'var(--spacing-sm)', 
                    borderTop: '1px solid var(--gray-200)' 
                  }}>
                    <button
                      onClick={handleConfirm}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--color-primary)',
                        color: 'white',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--radius)',
                        fontWeight: '500',
                        cursor: 'pointer',
                        border: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                    >
                      Potwierdź
                    </button>
                    <button
                      onClick={handleCancel}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--gray-200)',
                        color: 'var(--gray-800)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--radius)',
                        fontWeight: '500',
                        cursor: 'pointer',
                        border: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-300)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-200)'}
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius)',
              padding: 'var(--spacing-sm)',
              marginTop: 'var(--spacing-sm)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 'var(--spacing-xs)',
                color: '#dc2626',
                fontWeight: '500'
              }}>
                <span>!</span>
                <span>Błąd:</span>
              </div>
              <p style={{ 
                color: '#b91c1c', 
                fontSize: '14px', 
                margin: 'var(--spacing-xs) 0 0 0'
              }}>
                {error}
              </p>
            </div>
          )}
          
          {isChanging && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 'var(--spacing-xs)', 
              color: 'var(--color-primary)', 
              fontSize: '14px', 
              marginTop: 'var(--spacing-sm)'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--color-primary)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span>Zmieniam status...</span>
            </div>
          )}
        </div>
      )}
      
      {/* Status History */}
      <div style={{ 
        backgroundColor: 'var(--gray-50)', 
        borderRadius: 'var(--radius-lg)', 
        padding: 'var(--spacing-md)',
        border: '1px solid var(--gray-200)'
      }}>
        <h4 style={{ 
          fontWeight: '500', 
          color: 'var(--gray-900)', 
          marginBottom: 'var(--spacing-sm)',
          margin: 0
        }}>
          Historia statusów
        </h4>
        
        {isLoadingHistory ? (
          <p style={{ 
            color: 'var(--gray-500)', 
            fontSize: '14px',
            margin: 0
          }}>
            Ładowanie historii...
          </p>
        ) : statusHistory.length === 0 ? (
          <p style={{ 
            color: 'var(--gray-500)', 
            fontSize: '14px',
            margin: 0
          }}>
            Brak historii zmian statusu.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            {statusHistory.map((entry, index) => (
              <div key={entry.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-xs)',
                backgroundColor: 'white',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--gray-200)',
                fontSize: '14px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(entry.newStatus),
                  flexShrink: 0
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', color: 'var(--gray-900)' }}>
                    {entry.oldStatus ? `${getStatusLabel(entry.oldStatus)} → ${getStatusLabel(entry.newStatus)}` : getStatusLabel(entry.newStatus)}
                  </div>
                  {entry.notes && (
                    <div style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                      {entry.notes}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', textAlign: 'right' }}>
                  {new Date(entry.createdAt).toLocaleString('pl-PL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Compact version for tables
export function StatusManagerCompact({ 
  leadId,
  currentStatus, 
  currentSubStatus, 
  onStatusChange,
  className = ''
}: Omit<StatusManagerProps, 'blockedCampaigns'>) {
  const [isChanging, setIsChanging] = useState(false);
  
  const handleStatusChange = async (newStatus: LeadStatus, newSubStatus: LeadSubStatus | null) => {
    setIsChanging(true);
    
    try {
      await onStatusChange(newStatus, newSubStatus);
    } catch (err) {
      console.error('Błąd zmiany statusu:', err);
    } finally {
      setIsChanging(false);
    }
  };
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        fontWeight: '500',
        color: 'white',
        fontSize: '12px',
        padding: '2px 6px',
        backgroundColor: getStatusColor(currentStatus),
        borderRadius: 'var(--radius)'
      }}>
        <span style={{ fontSize: '8px', lineHeight: 1 }}>●</span>
        <span>{getStatusLabel(currentStatus)}</span>
      </div>
      
      {isChanging && (
        <div style={{
          width: '16px',
          height: '16px',
          border: '2px solid var(--color-primary)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      )}
    </div>
  );
}
