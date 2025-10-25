'use client';

import React from 'react';
import { LeadStatus, LeadSubStatus } from '@/types/leadStatus';
import { 
  getStatusLabel, 
  getSubStatusLabel, 
  getStatusColor, 
  getSubStatusColor,
  getStatusIcon,
  getSubStatusIcon
} from '@/lib/statusHelpers';

interface StatusBadgeProps {
  status: LeadStatus;
  subStatus?: LeadSubStatus | null;
  showIcon?: boolean;
  showSubStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ 
  status, 
  subStatus = null, 
  showIcon = true, 
  showSubStatus = true,
  size = 'md',
  className = ''
}: StatusBadgeProps) {
  const statusColor = getStatusColor(status);
  const subStatusColor = getSubStatusColor(subStatus);
  const statusIcon = getStatusIcon(status);
  const subStatusIcon = getSubStatusIcon(subStatus);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5', 
    lg: 'text-base px-4 py-2'
  };
  
  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {/* Main Status */}
      <div 
        className={`inline-flex items-center gap-1 rounded-full font-medium text-white ${sizeClasses[size]}`}
        style={{ backgroundColor: statusColor }}
      >
        {showIcon && statusIcon && (
          <span style={{ fontSize: '12px', lineHeight: '1' }}>
            {statusIcon}
          </span>
        )}
        <span>{getStatusLabel(status)}</span>
      </div>
      
      {/* Sub Status */}
      {showSubStatus && subStatus && (
        <div 
          className="inline-flex items-center gap-1 rounded-full font-medium text-white text-xs px-2 py-1"
          style={{ backgroundColor: subStatusColor }}
        >
          {showIcon && subStatusIcon && (
            <span style={{ fontSize: '10px', lineHeight: '1' }}>
              {subStatusIcon}
            </span>
          )}
          <span>
            {getSubStatusLabel(subStatus)}
          </span>
        </div>
      )}
    </div>
  );
}

// Compact version for tables
export function StatusBadgeCompact({ 
  status, 
  subStatus = null, 
  className = ''
}: Omit<StatusBadgeProps, 'size' | 'showIcon' | 'showSubStatus'>) {
  const statusColor = getStatusColor(status);
  const statusIcon = getStatusIcon(status);
  
  return (
    <div 
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium text-white ${className}`}
      style={{ backgroundColor: statusColor }}
      title={subStatus ? `${getStatusLabel(status)} (${getSubStatusLabel(subStatus)})` : getStatusLabel(status)}
    >
      <span style={{ fontSize: '10px', lineHeight: '1' }}>{statusIcon}</span>
      <span>{getStatusLabel(status)}</span>
    </div>
  );
}

// Priority indicator
export function PriorityBadge({ 
  status, 
  subStatus = null, 
  className = ''
}: Omit<StatusBadgeProps, 'size' | 'showIcon' | 'showSubStatus'>) {
  const isHot = status === 'ZAINTERESOWANY' || subStatus === 'ZAINTERESOWANY_NEW';
  
  if (!isHot) return null;
  
  return (
    <div 
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 animate-pulse ${className}`}
      title="Hot Lead - wymaga natychmiastowej obsługi"
    >
      <span>🔥</span>
      <span>HOT</span>
    </div>
  );
}
