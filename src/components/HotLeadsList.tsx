'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { LeadStatus, LeadSubStatus } from '@/types/leadStatus';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { getPriorityLevel, isHotLead } from '@/lib/statusHelpers';

interface HotLead {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  status: LeadStatus;
  subStatus: LeadSubStatus | null;
  source: string;
  createdAt: string;
  lastActivity?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface HotLeadsListProps {
  className?: string;
}

export function HotLeadsList({ className = '' }: HotLeadsListProps) {
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchHotLeads();
  }, []);
  
  const fetchHotLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leads/hot');
      
      if (!response.ok) {
        throw new Error('Błąd podczas pobierania hot leads');
      }
      
      const data = await response.json();
      setHotLeads(data.leads || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      return 'Przed chwilą';
    } else if (diffHours < 24) {
      return `${diffHours}h temu`;
    } else if (diffDays < 7) {
      return `${diffDays}d temu`;
    } else {
      return date.toLocaleDateString('pl-PL');
    }
  };
  
  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-red-200 p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p className="font-medium">Błąd ładowania hot leads</p>
          <p className="text-sm mt-1">{error}</p>
          <button 
            onClick={fetchHotLeads}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }
  
  if (hotLeads.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <p className="font-medium">Brak hot leads</p>
          <p className="text-sm mt-1">Wszystkie leady są aktualnie obsłużone</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Hot Leads</h3>
              <p className="text-sm text-gray-600">
                {hotLeads.length} lead{hotLeads.length === 1 ? '' : hotLeads.length < 5 ? 'y' : 'ów'} wymaga natychmiastowej obsługi
              </p>
            </div>
          </div>
          <button
            onClick={fetchHotLeads}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Odśwież
          </button>
        </div>
      </div>
      
      {/* Leads List */}
      <div className="divide-y divide-gray-200">
        {hotLeads.map((lead) => (
          <div key={lead.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {lead.firstName} {lead.lastName}
                    </h4>
                    <p className="text-sm text-gray-600 truncate">
                      {lead.email}
                    </p>
                  </div>
                  <PriorityBadge status={lead.status} subStatus={lead.subStatus} />
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="truncate">{lead.company}</span>
                  <span>•</span>
                  <span>{lead.source}</span>
                  <span>•</span>
                  <span>{formatTime(lead.createdAt)}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 ml-4">
                <StatusBadge 
                  status={lead.status} 
                  subStatus={lead.subStatus}
                  size="sm"
                />
                
                <Link
                  href={`/leads/${lead.id}`}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Szczegóły
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <Link
          href="/leads?filter=hot"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          Zobacz wszystkie hot leads →
        </Link>
      </div>
    </div>
  );
}

// Compact version for dashboard - shows interested leads count
export function HotLeadsWidget({ className = '' }: HotLeadsListProps) {
  const [interestedCount, setInterestedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchInterestedCount();
  }, []);
  
  const fetchInterestedCount = async () => {
    try {
      const response = await fetch('/api/inbox?filter=interested');
      const data = await response.json();
      setInterestedCount(Array.isArray(data) ? data.length : 0);
    } catch (err) {
      console.error('Błąd pobierania liczby zainteresowanych leadów:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`} style={{ borderRadius: "var(--radius)" }}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }
  
  return (
    <Link href="/inbox?filter=interested" className={`block ${className}`} style={{ textDecoration: "none" }}>
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors" style={{ borderRadius: "var(--radius)" }}>
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-medium text-gray-900" style={{ fontSize: "1rem", marginBottom: "4px" }}>Zainteresowani leady</h3>
            <p className="text-2xl font-bold" style={{ color: "var(--success)" }}>
              {interestedCount}
            </p>
          </div>
        </div>
        {interestedCount > 0 && (
          <p className="text-sm text-gray-600 mt-2" style={{ marginTop: "8px", fontSize: "0.875rem" }}>
            Wymagają obsługi
          </p>
        )}
      </div>
    </Link>
  );
}
