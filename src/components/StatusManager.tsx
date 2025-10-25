'use client';

import React, { useState } from 'react';
import { LeadStatus, LeadSubStatus } from '@/types/leadStatus';
import { 
  getStatusLabel, 
  getSubStatusLabel, 
  getStatusDescription,
  getAvailableTransitions,
  formatBlockedCampaigns
} from '@/lib/statusHelpers';
import { StatusBadge } from './StatusBadge';
import { StatusSelector } from './StatusSelector';

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
  
  const handleStatusChange = async (newStatus: LeadStatus, newSubStatus: LeadSubStatus | null) => {
    setIsChanging(true);
    setError(null);
    
    try {
      await onStatusChange(newStatus, newSubStatus);
    } catch (err: any) {
      setError(err.message || 'Błąd podczas zmiany statusu');
    } finally {
      setIsChanging(false);
    }
  };
  
  const description = getStatusDescription(currentStatus, currentSubStatus);
  const availableTransitions = getAvailableTransitions(currentStatus, currentSubStatus);
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Current Status Display */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Status Leadu</h3>
          <StatusBadge 
            status={currentStatus} 
            subStatus={currentSubStatus}
            size="lg"
          />
        </div>
        
        <p className="text-gray-600 text-sm mb-3">
          {description}
        </p>
        
        {blockedCampaigns.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <span>⚠️</span>
              <span className="font-medium">Zablokowane kampanie:</span>
            </div>
            <p className="text-yellow-700 text-sm mt-1">
              {formatBlockedCampaigns(blockedCampaigns)}
            </p>
          </div>
        )}
      </div>
      
      {/* Status Change Section */}
      {availableTransitions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Zmień status</h4>
          
          <StatusSelector
            currentStatus={currentStatus}
            currentSubStatus={currentSubStatus}
            onStatusChange={handleStatusChange}
            disabled={isChanging}
            className="mb-3"
          />
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
              <div className="flex items-center gap-2 text-red-800">
                <span>❌</span>
                <span className="font-medium">Błąd:</span>
              </div>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          )}
          
          {isChanging && (
            <div className="flex items-center gap-2 text-blue-600 text-sm mt-3">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span>Zmieniam status...</span>
            </div>
          )}
        </div>
      )}
      
      {/* Status History (placeholder for future implementation) */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Historia statusów</h4>
        <p className="text-gray-500 text-sm">
          Historia zmian statusu będzie dostępna w przyszłej wersji.
        </p>
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
    <div className={`flex items-center gap-2 ${className}`}>
      <StatusBadge 
        status={currentStatus} 
        subStatus={currentSubStatus}
        size="sm"
      />
      
      <StatusSelector
        currentStatus={currentStatus}
        currentSubStatus={currentSubStatus}
        onStatusChange={handleStatusChange}
        disabled={isChanging}
      />
      
      {isChanging && (
        <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
      )}
    </div>
  );
}
