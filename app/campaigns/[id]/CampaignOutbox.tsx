"use client";

import { useState, useEffect } from "react";

interface OutboxData {
  campaign: {
    id: number;
    name: string;
    status: string;
  };
  sendLogs: Array<{
    id: number;
    status: string;
    error: string | null;
    createdAt: string;
    subject: string | null;
    lead: {
      id: number;
      email: string;
      firstName: string | null;
      lastName: string | null;
      company: string | null;
      status: string;
      isBlocked: boolean;
      blockedReason: string | null;
    };
    mailbox: {
      id: number;
      email: string;
      displayName: string | null;
    } | null;
  }>;
  stats: {
    total: number;
    sent: number;
    failed: number;
    queued: number;
    sentToBlocked: number;
  };
  mailboxStats: Array<{
    email: string;
    displayName: string | null;
    sent: number;
    failed: number;
  }>;
}

export default function CampaignOutbox({ campaignId }: { campaignId: number }) {
  const [data, setData] = useState<OutboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'blocked'>('all');

  useEffect(() => {
    fetchOutbox();
  }, [campaignId]);

  const fetchOutbox = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}/outbox`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        console.error('Błąd pobierania outbox:', result.error);
      }
    } catch (error) {
      console.error('Błąd pobierania outbox:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div className="spin" style={{ 
          width: 40, 
          height: 40, 
          border: '4px solid #f3f3f3', 
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          margin: '0 auto',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: 16, color: '#666' }}>Ładowanie wysyłek...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
        Nie udało się załadować danych wysyłek
      </div>
    );
  }

  // Filtrowanie logów
  const filteredLogs = data.sendLogs.filter(log => {
    if (filter === 'sent') return log.status === 'sent' && !log.lead.isBlocked && log.lead.status !== 'BLOCKED';
    if (filter === 'failed') return log.status === 'error';
    if (filter === 'blocked') return log.status === 'sent' && (log.lead.isBlocked || log.lead.status === 'BLOCKED');
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 24 }}>📤 Wysyłki kampanii: {data.campaign.name}</h2>

      {/* Statystyki */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: 16, 
        marginBottom: 24 
      }}>
        <div style={{ 
          padding: 16, 
          backgroundColor: '#f8f9fa', 
          borderRadius: 8,
          border: '1px solid #dee2e6'
        }}>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Wszystkich</div>
          <div style={{ fontSize: 28, fontWeight: 'bold' }}>{data.stats.total}</div>
        </div>

        <div style={{ 
          padding: 16, 
          backgroundColor: '#d4edda', 
          borderRadius: 8,
          border: '1px solid #c3e6cb'
        }}>
          <div style={{ fontSize: 14, color: '#155724', marginBottom: 4 }}>Wysłanych</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#155724' }}>{data.stats.sent}</div>
        </div>

        <div style={{ 
          padding: 16, 
          backgroundColor: '#f8d7da', 
          borderRadius: 8,
          border: '1px solid #f5c6cb'
        }}>
          <div style={{ fontSize: 14, color: '#721c24', marginBottom: 4 }}>Błędów</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#721c24' }}>{data.stats.failed}</div>
        </div>

        {data.stats.sentToBlocked > 0 && (
          <div style={{ 
            padding: 16, 
            backgroundColor: '#fff3cd', 
            borderRadius: 8,
            border: '1px solid #ffeeba'
          }}>
            <div style={{ fontSize: 14, color: '#856404', marginBottom: 4 }}>⚠️ Do zablokowanych</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#856404' }}>{data.stats.sentToBlocked}</div>
          </div>
        )}
      </div>

      {/* Statystyki skrzynek */}
      {data.mailboxStats.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12 }}>📬 Użyte skrzynki</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {data.mailboxStats.map((mailbox, i) => (
              <div key={i} style={{ 
                padding: 12, 
                backgroundColor: '#e8f4fd', 
                borderRadius: 8,
                border: '1px solid #b3d9ff',
                flex: '1 1 300px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{mailbox.email}</div>
                {mailbox.displayName && (
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{mailbox.displayName}</div>
                )}
                <div style={{ fontSize: 14, color: '#0066cc' }}>
                  ✅ {mailbox.sent} wysłanych
                  {mailbox.failed > 0 && ` | ❌ ${mailbox.failed} błędów`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtry */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: filter === 'all' ? '2px solid #0066cc' : '1px solid #dee2e6',
            backgroundColor: filter === 'all' ? '#e8f4fd' : 'white',
            cursor: 'pointer',
            fontWeight: filter === 'all' ? 'bold' : 'normal'
          }}
        >
          Wszystkie ({data.stats.total})
        </button>
        <button
          onClick={() => setFilter('sent')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: filter === 'sent' ? '2px solid #28a745' : '1px solid #dee2e6',
            backgroundColor: filter === 'sent' ? '#d4edda' : 'white',
            cursor: 'pointer',
            fontWeight: filter === 'sent' ? 'bold' : 'normal'
          }}
        >
          Wysłane ({data.stats.sent - data.stats.sentToBlocked})
        </button>
        <button
          onClick={() => setFilter('failed')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: filter === 'failed' ? '2px solid #dc3545' : '1px solid #dee2e6',
            backgroundColor: filter === 'failed' ? '#f8d7da' : 'white',
            cursor: 'pointer',
            fontWeight: filter === 'failed' ? 'bold' : 'normal'
          }}
        >
          Błędy ({data.stats.failed})
        </button>
        {data.stats.sentToBlocked > 0 && (
          <button
            onClick={() => setFilter('blocked')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: filter === 'blocked' ? '2px solid #ffc107' : '1px solid #dee2e6',
              backgroundColor: filter === 'blocked' ? '#fff3cd' : 'white',
              cursor: 'pointer',
              fontWeight: filter === 'blocked' ? 'bold' : 'normal'
            }}
          >
            ⚠️ Do zablokowanych ({data.stats.sentToBlocked})
          </button>
        )}
      </div>

      {/* Tabela wysyłek */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: 8, 
        border: '1px solid #dee2e6',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold' }}>Data i godzina</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold' }}>Do kogo</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold' }}>Z jakiej skrzynki</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                  Brak wysyłek w wybranym filtrze
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isBlocked = log.lead.isBlocked || log.lead.status === 'BLOCKED';
                const isFailed = log.status === 'error';
                
                return (
                  <tr 
                    key={log.id} 
                    style={{ 
                      borderBottom: '1px solid #dee2e6',
                      backgroundColor: isBlocked ? '#fff3cd' : (isFailed ? '#f8d7da' : 'white')
                    }}
                  >
                    <td style={{ padding: 12, fontSize: 14 }}>
                      {formatDate(log.createdAt)}
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 'bold' }}>{log.lead.email}</div>
                      {(log.lead.firstName || log.lead.lastName) && (
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {log.lead.firstName} {log.lead.lastName}
                        </div>
                      )}
                      {log.lead.company && (
                        <div style={{ fontSize: 12, color: '#666' }}>{log.lead.company}</div>
                      )}
                      {isBlocked && (
                        <div style={{ fontSize: 11, color: '#856404', marginTop: 4 }}>
                          ⚠️ ZABLOKOWANY: {log.lead.blockedReason || 'Nieznany powód'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {log.mailbox ? (
                        <>
                          <div style={{ fontWeight: '600' }}>{log.mailbox.email}</div>
                          {log.mailbox.displayName && (
                            <div style={{ fontSize: 12, color: '#666' }}>{log.mailbox.displayName}</div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#999' }}>Brak danych</span>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {log.status === 'sent' ? (
                        <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Wysłano</span>
                      ) : log.status === 'error' ? (
                        <>
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ Błąd</span>
                          {log.error && (
                            <div style={{ fontSize: 11, color: '#721c24', marginTop: 4 }}>
                              {log.error}
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#6c757d' }}>⏳ {log.status}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

