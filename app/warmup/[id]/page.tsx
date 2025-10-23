'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WarmupEmail {
  id: number;
  type: string;
  subtype?: string;
  toEmail: string;
  subject: string;
  content: string;
  status: string;
  sentAt?: string;
  errorMessage?: string;
  wasOpened: boolean;
  wasReplied: boolean;
  warmupDay: number;
  warmupPhase: string;
  createdAt: string;
}

interface Mailbox {
  id: number;
  email: string;
  displayName?: string;
  description?: string;
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
  mxRecordStatus?: string;
  spfRecordStatus?: string;
  dkimRecordStatus?: string;
  dmarcRecordStatus?: string;
  virtualSalesperson: {
    id: number;
    name: string;
    email: string;
  };
}

interface WarmupStats {
  mailbox: Mailbox;
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
  recent: WarmupEmail[];
}

interface PageProps {
  params: {
    id: string;
  };
}

export default function WarmupDetails({ params }: PageProps) {
  const mailboxId = params.id;
  
  console.log('WarmupDetails component rendered with params:', params);
  console.log('mailboxId:', mailboxId);

  // Dodaj style CSS dla animacji
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [stats, setStats] = useState<WarmupStats | null>(null);
  const [emails, setEmails] = useState<WarmupEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mailboxId) {
      fetchWarmupDetails();
      fetchWarmupEmails();
    }
  }, [mailboxId]);

  const fetchWarmupDetails = async () => {
    try {
      console.log('Fetching warmup details for mailbox:', mailboxId);
      const response = await fetch(`/api/warmup/${mailboxId}`);
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);

      if (data.success) {
        setMailbox(data.data.mailbox);
        setStats(data.data.stats);
      } else {
        setError(data.error || 'Błąd podczas pobierania danych');
      }
    } catch (err) {
      console.error('Error fetching warmup details:', err);
      setError('Błąd połączenia z serwerem');
    }
  };

  const fetchWarmupEmails = async () => {
    try {
      console.log('Fetching warmup emails for mailbox:', mailboxId);
      const response = await fetch(`/api/warmup/${mailboxId}/emails?limit=100`);
      console.log('Emails response status:', response.status);
      
      const data = await response.json();
      console.log('Emails response data:', data);

      if (data.success) {
        setEmails(data.data.emails);
      }
    } catch (err) {
      console.error('Błąd podczas pobierania emaili:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
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
        fetchWarmupDetails();
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (err) {
      alert('Błąd podczas wykonywania akcji');
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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--spacing-xl) var(--spacing-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ 
          width: '20px', 
          height: '20px', 
          border: '2px solid #f3f3f3', 
          borderTop: '2px solid var(--color-primary)', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite',
          marginRight: 'var(--spacing-sm)' 
        }}></div>
        <span>Ładowanie...</span>
      </div>
    </div>
    );
  }

  if (error || !mailbox || !stats) {
    return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--spacing-xl) var(--spacing-lg)' }}>
      <div style={{ 
        background: '#ffebee', 
        border: '1px solid #f44336', 
        borderRadius: '4px', 
        padding: 'var(--spacing-md)', 
        color: '#c62828' 
      }}>
        <div>{error || 'Nie znaleziono danych warmup'}</div>
        <Link 
          href="/warmup"
          style={{ 
            marginTop: 'var(--spacing-sm)', 
            display: 'inline-block',
            background: 'var(--color-primary)',
            color: 'white',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Powrót do listy
        </Link>
      </div>
    </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--spacing-xl) var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
            <Link href="/warmup" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
              ← Powrót do listy
            </Link>
          </div>
          <h1>
            {mailbox.displayName || mailbox.email}
          </h1>
          <p style={{ color: 'var(--gray-600)', marginTop: 'var(--spacing-sm)' }}>
            Handlowiec: {mailbox.virtualSalesperson.name} ({mailbox.virtualSalesperson.email})
            <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
              (email głównej skrzynki)
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          {mailbox.warmupStatus === 'ready_to_warmup' && (
            <button
              onClick={() => handleAction('start')}
              style={{
                background: '#4caf50',
                color: 'white',
                border: 'none',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Rozpocznij warmup
            </button>
          )}
          {mailbox.warmupStatus === 'warming' && (
            <button
              onClick={() => handleAction('stop')}
              style={{
                background: '#f44336',
                color: 'white',
                border: 'none',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Zatrzymaj warmup
            </button>
          )}
        </div>
      </div>

      {/* Status i postęp */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '2fr 1fr', 
        gap: 'var(--spacing-lg)', 
        marginBottom: 'var(--spacing-xl)' 
      }}>
        <div>
          <div style={{
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: 'var(--spacing-lg)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Status warmup</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--gray-600)' }}>Status:</span>
                <span 
                  style={{ 
                    padding: '6px 12px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: mailbox.warmupStatus === 'warming' ? '#e8f5e9' :
                               mailbox.warmupStatus === 'ready' ? '#e3f2fd' : '#f5f5f5',
                    color: mailbox.warmupStatus === 'warming' ? '#2e7d32' :
                          mailbox.warmupStatus === 'ready' ? '#1565c0' : '#666'
                  }}
                >
                  {mailbox.warmupStatus === 'warming' ? 'W rozgrzewaniu' :
                   mailbox.warmupStatus === 'ready' ? 'Gotowa' :
                   mailbox.warmupStatus}
                </span>
              </div>
              
              {mailbox.warmupStatus === 'warming' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--gray-600)' }}>Dzień warmup:</span>
                    <span style={{ fontWeight: '500' }}>{mailbox.warmupDay}/30</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--gray-600)' }}>Dzisiejszy limit:</span>
                    <span style={{ fontWeight: '500' }}>{mailbox.warmupTodaySent}/{mailbox.warmupDailyLimit}</span>
                  </div>
                  <div style={{ width: '100%', background: 'var(--gray-200)', borderRadius: '4px', height: '12px' }}>
                    <div 
                      style={{ 
                        background: 'var(--color-primary)', 
                        height: '12px', 
                        borderRadius: '4px',
                        width: `${getProgressPercentage(mailbox)}%`,
                        transition: 'all 0.3s ease'
                      }}
                    ></div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: 'var(--spacing-lg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: 'var(--spacing-md)' }}>DNS Setup</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--gray-600)', fontWeight: '600' }}>MX:</span>
              <span 
                style={{ 
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: mailbox.mxRecordStatus === 'configured' ? '#e8f5e9' : '#ffebee',
                  color: mailbox.mxRecordStatus === 'configured' ? '#2e7d32' : '#c62828'
                }}
              >
                {mailbox.mxRecordStatus || 'Nie sprawdzono'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--gray-600)' }}>SPF:</span>
              <span 
                style={{ 
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: mailbox.spfRecordStatus === 'configured' ? '#e8f5e9' : '#ffebee',
                  color: mailbox.spfRecordStatus === 'configured' ? '#2e7d32' : '#c62828'
                }}
              >
                {mailbox.spfRecordStatus || 'Nie sprawdzono'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--gray-600)' }}>DKIM:</span>
              <span 
                style={{ 
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: mailbox.dkimRecordStatus === 'configured' ? '#e8f5e9' : '#ffebee',
                  color: mailbox.dkimRecordStatus === 'configured' ? '#2e7d32' : '#c62828'
                }}
              >
                {mailbox.dkimRecordStatus || 'Nie sprawdzono'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--gray-600)' }}>DMARC:</span>
              <span 
                style={{ 
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  background: mailbox.dmarcRecordStatus === 'configured' ? '#e8f5e9' : '#ffebee',
                  color: mailbox.dmarcRecordStatus === 'configured' ? '#2e7d32' : '#c62828'
                }}
              >
                {mailbox.dmarcRecordStatus || 'Nie sprawdzono'}
              </span>
            </div>
            <button
              onClick={() => handleAction('check_dns')}
              style={{ 
                marginTop: 'var(--spacing-md)', 
                fontSize: '14px', 
                padding: '8px 12px',
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Sprawdź DNS
            </button>
          </div>
        </div>
      </div>

      {/* Statystyki */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 'var(--spacing-lg)', 
        marginBottom: 'var(--spacing-xl)' 
      }}>
        <div style={{
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: 'var(--spacing-lg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196f3', marginBottom: 'var(--spacing-sm)' }}>
            {stats.emails.total}
          </div>
          <div style={{ color: 'var(--gray-600)' }}>Wszystkie emaile</div>
        </div>
        <div style={{
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: 'var(--spacing-lg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4caf50', marginBottom: 'var(--spacing-sm)' }}>
            {stats.emails.sent}
          </div>
          <div style={{ color: 'var(--gray-600)' }}>Wysłane</div>
        </div>
        <div style={{
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: 'var(--spacing-lg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f44336', marginBottom: 'var(--spacing-sm)' }}>
            {stats.emails.failed}
          </div>
          <div style={{ color: 'var(--gray-600)' }}>Błędy</div>
        </div>
        <div style={{
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: 'var(--spacing-lg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff9800', marginBottom: 'var(--spacing-sm)' }}>
            {mailbox.deliverabilityScore}
          </div>
          <div style={{ color: 'var(--gray-600)' }}>Score reputacji</div>
        </div>
      </div>

      {/* Historia wysyłek warmup według dni */}
      <div style={{
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: 'var(--spacing-lg)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: 'var(--spacing-xl)'
      }}>
        <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <h2>📊 Historia wysyłek warmup (według dni)</h2>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600' }}>Dzień</th>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: '600' }}>Wysłane</th>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: '600' }}>Błędy</th>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: '600' }}>Razem</th>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: '600' }}>Limit</th>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: '600' }}>Realizacja</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const dailyStats = (mailbox as any).dailyStats || {};
                const days = Object.keys(dailyStats).map(Number).sort((a, b) => a - b);
                
                if (days.length === 0) {
                  return (
                    <tr>
                      <td colSpan={6} style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--gray-500)' }}>
                        Brak danych wysyłek
                      </td>
                    </tr>
                  );
                }
                
                return days.map(day => {
                  const dayStats = dailyStats[day];
                  const limit = 15 + Math.floor((day - 1) / 2) * 2;
                  const percentage = limit > 0 ? Math.round((dayStats.sent / limit) * 100) : 0;
                  const isToday = day === mailbox.warmupDay;
                  
                  return (
                    <tr 
                      key={day} 
                      style={{ 
                        borderBottom: '1px solid #f0f0f0',
                        background: isToday ? '#e3f2fd' : 'transparent'
                      }}
                    >
                      <td style={{ 
                        padding: 'var(--spacing-sm)', 
                        fontWeight: isToday ? '700' : '400',
                        color: isToday ? 'var(--color-primary)' : 'var(--color-text)'
                      }}>
                        {isToday && <span style={{ marginRight: '8px' }}>▶</span>}
                        Dzień {day}
                        {isToday && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--color-primary)' }}>(dzisiaj)</span>}
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center', color: '#4caf50', fontWeight: '700', fontSize: '15px' }}>
                        {dayStats.sent}
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center', color: '#f44336', fontWeight: '700', fontSize: '15px' }}>
                        {dayStats.failed}
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center', fontWeight: '600', fontSize: '14px' }}>
                        {dayStats.total}
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center', color: 'var(--gray-600)', fontSize: '14px' }}>
                        {limit}
                      </td>
                      <td style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <div style={{ 
                            width: '80px', 
                            height: '10px', 
                            background: '#e0e0e0', 
                            borderRadius: '5px',
                            overflow: 'hidden'
                          }}>
                            <div style={{ 
                              width: `${Math.min(percentage, 100)}%`, 
                              height: '100%', 
                              background: percentage >= 100 ? '#4caf50' : percentage >= 50 ? '#ff9800' : '#f44336',
                              transition: 'width 0.3s ease'
                            }}></div>
                          </div>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: '600',
                            color: percentage >= 100 ? '#4caf50' : percentage >= 50 ? '#ff9800' : '#f44336',
                            minWidth: '45px',
                            textAlign: 'right'
                          }}>
                            {percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historia emaili */}
      <div style={{
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: 'var(--spacing-lg)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>📧 Szczegółowa historia emaili</h2>
          </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Data</th>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Do</th>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Temat</th>
                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ fontSize: '12px', padding: 'var(--spacing-sm)' }}>
                    {new Date(email.createdAt).toLocaleString('pl-PL')}
                  </td>
                  <td style={{ fontSize: '12px', padding: 'var(--spacing-sm)' }}>
                    {email.toEmail}
                  </td>
                  <td style={{ fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: 'var(--spacing-sm)' }}>
                    {email.subject}
                  </td>
                  <td style={{ padding: 'var(--spacing-sm)' }}>
                    <span 
                      style={{ 
                        padding: '4px 8px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: email.status === 'sent' ? '#e8f5e9' : 
                                   email.status === 'failed' ? '#ffebee' : '#fff3e0',
                        color: email.status === 'sent' ? '#2e7d32' : 
                               email.status === 'failed' ? '#c62828' : '#ef6c00'
                      }}
                    >
                      {email.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {emails.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
            <div style={{ color: 'var(--gray-500)' }}>Brak warmup emaili</div>
          </div>
        )}
      </div>
    </div>
  );
}
