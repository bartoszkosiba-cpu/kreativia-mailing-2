'use client';

import React, { useState } from 'react';
import { LeadStatus, LeadSubStatus } from '@/types/leadStatus';
import { 
  getStatusLabel, 
  getSubStatusLabel, 
  getStatusColor, 
  getSubStatusColor,
  getStatusIcon,
  getSubStatusIcon,
  getAvailableTransitions
} from '@/lib/statusHelpers';

interface StatusSelectorProps {
  currentStatus: LeadStatus;
  currentSubStatus: LeadSubStatus | null;
  onStatusChange: (status: LeadStatus, subStatus: LeadSubStatus | null) => void;
  disabled?: boolean;
  className?: string;
}

export function StatusSelector({ 
  currentStatus, 
  currentSubStatus, 
  onStatusChange, 
  disabled = false,
  className = ''
}: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>(currentStatus);
  const [selectedSubStatus, setSelectedSubStatus] = useState<LeadSubStatus | null>(currentSubStatus);
  
  const availableTransitions = getAvailableTransitions(currentStatus, currentSubStatus);
  
  const handleStatusSelect = (status: LeadStatus, subStatus: LeadSubStatus | null) => {
    setSelectedStatus(status);
    setSelectedSubStatus(subStatus);
  };
  
  const handleConfirm = () => {
    onStatusChange(selectedStatus, selectedSubStatus);
    setIsOpen(false);
  };
  
  const handleCancel = () => {
    setSelectedStatus(currentStatus);
    setSelectedSubStatus(currentSubStatus);
    setIsOpen(false);
  };
  
  return (
    <div className={`relative ${className}`}>
      {/* Current Status Display */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}
          ${isOpen ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
        `}
      >
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: getStatusColor(currentStatus) }}
        />
        <span className="font-medium">{getStatusLabel(currentStatus)}</span>
        {currentSubStatus && (
          <>
            <span className="text-gray-400">/</span>
            <span className="text-sm text-gray-600">{getSubStatusLabel(currentSubStatus)}</span>
          </>
        )}
        {!disabled && (
          <span className="text-gray-400 ml-auto">
            {isOpen ? '▲' : '▼'}
          </span>
        )}
      </button>
      
      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3">
            <h4 className="font-medium text-gray-900 mb-3">Wybierz nowy status:</h4>
            
            <div className="space-y-2">
              {availableTransitions.map((transition, index) => {
                const isSelected = selectedStatus === transition.status && selectedSubStatus === transition.subStatus;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleStatusSelect(transition.status, transition.subStatus)}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors
                      ${isSelected 
                        ? 'bg-blue-50 border-2 border-blue-500' 
                        : 'hover:bg-gray-50 border-2 border-transparent'
                      }
                    `}
                  >
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getStatusColor(transition.status) }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{getStatusLabel(transition.status)}</div>
                      {transition.subStatus && (
                        <div className="text-sm text-gray-600">
                          {getSubStatusLabel(transition.subStatus)}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {transition.label}
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={handleConfirm}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Potwierdź
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple dropdown version for forms
export function StatusSelect({ 
  currentStatus, 
  currentSubStatus, 
  onStatusChange, 
  disabled = false,
  className = ''
}: StatusSelectorProps) {
  const availableTransitions = getAvailableTransitions(currentStatus, currentSubStatus);
  
  return (
    <select
      value={`${currentStatus}|${currentSubStatus || ''}`}
      onChange={(e) => {
        const [status, subStatus] = e.target.value.split('|');
        onStatusChange(status as LeadStatus, subStatus as LeadSubStatus || null);
      }}
      disabled={disabled}
      className={`
        w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {availableTransitions.map((transition, index) => (
        <option 
          key={index} 
          value={`${transition.status}|${transition.subStatus || ''}`}
        >
          {transition.label}
        </option>
      ))}
    </select>
  );
}
