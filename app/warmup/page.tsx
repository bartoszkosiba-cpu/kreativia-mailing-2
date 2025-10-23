'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WarmupStats {
  mailbox: {
    id: number;
    email: string;
    warmupStatus: string;
    warmupDay: number;
    warmupPhase: string;
    warmupDailyLimit: number;
    warmupTodaySent: number;
    dnsSetupCompleted: boolean;
    deliverabilityScore: number;
    bounceRate: number;
    openRate: number;
    replyRate: number;
  };
  emails: {
    total: number;
    sent: number;
    failed: number;
    bounced: number;
    byType: {
      internal: number;
      seed: number;
      test: number;
      campaign: number;
    };
  };
}

interface Mailbox {
  id: number;
  email: string;
  displayName?: string;
  description?: string;
  mailboxType: string;
  warmupStatus: string;
  warmupDay: number;
  warmupPhase: string;
  warmupDailyLimit: number;
  warmupTodaySent: number;
  dnsSetupCompleted: boolean;
  deliverabilityScore: number;
  bounceRate: number;
  openRate: number;
  replyRate: number;
  warmupStartDate?: string;
  warmupCompletedAt?: string;
  virtualSalesperson: {
    id: number;
    name: string;
    email: string;
  };
  warmupStats?: WarmupStats;
  dailyStats?: Record<number, { sent: number; failed: number; total: number }>;
}

export default function WarmupDashboard() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMailboxes();
  }, []);

  const fetchMailboxes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/warmup');
      const data = await response.json();

      if (data.success) {
        setMailboxes(data.data);
      } else {
        setError(data.error || 'Błąd podczas pobierania danych');
      }
    } catch (err) {
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (mailboxId: number, action: string) => {
    try {
      const response = await fetch(`/api/warmup/${mailboxId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchMailboxes(); // Odśwież dane
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (err) {
      alert('Błąd podczas wykonywania akcji');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inactive': return { background: '#f5f5f5', color: '#666' };
      case 'dns_pending': return { background: '#fff3e0', color: '#ef6c00' };
      case 'ready_to_warmup': return { background: '#e3f2fd', color: '#1565c0' };
      case 'warming': return { background: '#e8f5e9', color: '#2e7d32' };
      case 'ready': return { background: '#e8f5e9', color: '#2e7d32' };
      case 'failed': return { background: '#ffebee', color: '#c62828' };
      default: return { background: '#f5f5f5', color: '#666' };
    }
  };

  const getStatusText = (status: string, mailboxType?: string, warmupDay?: number) => {
    // Dla starych skrzynek zawsze pokazuj "Gotowa"
    if (mailboxType === 'warmed_up') {
      return '✅ Gotowa (istniejąca)';
    }
    
    switch (status) {
      case 'inactive': return '⏸️ Nieaktywna';
      case 'dns_pending': return '⏳ Oczekuje DNS';
      case 'ready_to_warmup': return '🚀 Gotowa do warmup';
      case 'warming': return '🔥 W rozgrzewaniu';
      case 'ready': 
        // Jeśli ready ale warmupDay = 0, to znaczy że nie rozpoczęła
        return warmupDay && warmupDay > 0 ? '✅ Gotowa' : '⏸️ Nowa';
      case 'failed': return '❌ Błąd';
      default: return status;
    }
  };

  const getPhaseText = (phase: string) => {
    switch (phase) {
      case 'silent': return 'Faza cicha (1-7 dni)';
      case 'building': return 'Faza budowania (8-14 dni)';
      case 'acceleration': return 'Faza akceleracji (15-21 dni)';
      case 'ready': return 'Gotowa do pełnej prędkości';
      default: return phase;
    }
  };

  const getProgressPercentage = (mailbox: Mailbox) => {
    if (mailbox.warmupStatus === 'ready') return 100;
    if (mailbox.warmupStatus === 'warming') {
      // Postęp dzisiejszy: wysłane/limit * 100
      const dailyLimit = mailbox.warmupDailyLimit || 0;
      if (dailyLimit > 0) {
        return Math.round((mailbox.warmupTodaySent / dailyLimit) * 100);
      }
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-2xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading" style={{ marginRight: 'var(--spacing-sm)' }}></div>
          <span>Ładowanie...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-2xl)' }}>
        <div className="alert alert-error">
          <div>{error}</div>
          <button 
            onClick={fetchMailboxes}
            className="btn btn-danger"
            style={{ marginTop: 'var(--spacing-sm)' }}
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-2xl)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <div>
          <h1>Warmup Skrzynek</h1>
          <p style={{ color: 'var(--gray-600)', marginTop: 'var(--spacing-sm)' }}>
            Monitorowanie rozgrzewania nowych skrzynek mailowych
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <Link
            href="/warmup/dns-setup"
            className="btn btn-success"
          >
            Instrukcje DNS
          </Link>
          <Link
            href="/salespeople"
            className="btn btn-primary"
          >
            Zarządzaj skrzynkami
          </Link>
        </div>
      </div>

      {/* Statystyki ogólne */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--info)', marginBottom: 'var(--spacing-sm)' }}>
            {mailboxes.filter(m => m.warmupStatus === 'warming').length}
          </div>
          <div style={{ color: 'var(--gray-600)' }}>W rozgrzewaniu</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)', marginBottom: 'var(--spacing-sm)' }}>
            {mailboxes.filter(m => m.warmupStatus === 'ready').length}
          </div>
          <div style={{ color: 'var(--gray-600)' }}>Gotowe</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)', marginBottom: 'var(--spacing-sm)' }}>
            {mailboxes.filter(m => m.warmupStatus === 'dns_pending').length}
          </div>
          <div style={{ color: 'var(--gray-600)' }}>Oczekuje DNS</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--gray-600)', marginBottom: 'var(--spacing-sm)' }}>
            {mailboxes.filter(m => m.warmupStatus === 'inactive').length}
          </div>
          <div style={{ color: 'var(--gray-600)' }}>Nieaktywne</div>
        </div>
      </div>

      {/* Lista skrzynek */}
      <div className="card">
        <div className="card-header">
          <h2>Skrzynki mailowe</h2>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Skrzynka</th>
                <th>Handlowiec</th>
                <th>Status</th>
                <th>Postęp dzisiaj</th>
                <th>DNS</th>
                <th>Statystyki</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {mailboxes.map((mailbox) => {
                const statusColors = getStatusColor(mailbox.warmupStatus);
                return (
                  <tr key={mailbox.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: '500', color: 'var(--color-text)' }}>
                          {mailbox.displayName || mailbox.email}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{mailbox.email}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                        {mailbox.virtualSalesperson?.name || 'Brak danych'}
                      </div>
                    </td>
                    <td>
                      <span 
                        className="badge"
                        style={{ 
                          background: statusColors.background, 
                          color: statusColors.color,
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        {getStatusText(mailbox.warmupStatus, mailbox.mailboxType, mailbox.warmupDay)}
                      </span>
                      {mailbox.warmupStatus === 'warming' && (
                        <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                          Dzień {mailbox.warmupDay}/30 - {getPhaseText(mailbox.warmupPhase)}
                        </div>
                      )}
                    </td>
                    <td>
                      {mailbox.warmupStatus === 'warming' && (
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--gray-600)', marginBottom: '4px' }}>
                            <span>{mailbox.warmupTodaySent}/{mailbox.warmupDailyLimit} dzisiaj</span>
                            <span>{getProgressPercentage(mailbox)}%</span>
                          </div>
                          <div style={{ width: '100%', background: 'var(--gray-200)', borderRadius: '4px', height: '8px' }}>
                            <div 
                              style={{ 
                                background: 'var(--color-primary)', 
                                height: '8px', 
                                borderRadius: '4px',
                                width: `${getProgressPercentage(mailbox)}%`,
                                transition: 'all 0.3s ease'
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      <span 
                        className="badge"
                        style={{ 
                          background: mailbox.dnsSetupCompleted ? '#e8f5e9' : '#ffebee',
                          color: mailbox.dnsSetupCompleted ? '#2e7d32' : '#c62828',
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        {mailbox.dnsSetupCompleted ? 'OK' : 'Brak'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-text)' }}>
                      <div>Score: {mailbox.deliverabilityScore}/100</div>
                      <div>Bounce: {mailbox.bounceRate.toFixed(1)}%</div>
                      <div>Open: {mailbox.openRate.toFixed(1)}%</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        {/* Opcje warmup tylko dla nowych skrzynek */}
        {mailbox.mailboxType !== 'warmed_up' && mailbox.warmupStatus === 'ready' && (
          <button
            onClick={() => handleAction(mailbox.id, 'start')}
            className="btn btn-success"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            Start
          </button>
        )}
                        {mailbox.mailboxType !== 'warmed_up' && mailbox.warmupStatus === 'warming' && (
                          <button
                            onClick={() => handleAction(mailbox.id, 'stop')}
                            className="btn btn-danger"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            Stop
                          </button>
                        )}
                        {!mailbox.dnsSetupCompleted && (
                          <button
                            onClick={() => handleAction(mailbox.id, 'check_dns')}
                            className="btn btn-primary"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            Sprawdź DNS
                          </button>
                        )}
                        <Link
                          href={`/warmup/${mailbox.id}`}
                          style={{ 
                            color: 'var(--gray-600)', 
                            fontSize: '12px',
                            textDecoration: 'underline'
                          }}
                        >
                          Szczegóły
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {mailboxes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
          <div style={{ color: 'var(--gray-500)', fontSize: '18px' }}>Brak skrzynek do wyświetlenia</div>
          <Link
            href="/salespeople"
            className="btn btn-primary"
            style={{ marginTop: 'var(--spacing-md)', display: 'inline-block' }}
          >
            Dodaj pierwszą skrzynkę
          </Link>
        </div>
      )}
    </div>
  );
}