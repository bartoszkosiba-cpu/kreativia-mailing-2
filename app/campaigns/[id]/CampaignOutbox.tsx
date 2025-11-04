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
    content: string | null; // ✅ DODANO: Treść maila
    toEmail: string | null; // NOWE: Email odbiorcy (dla maili testowych)
    lead: {
      id: number;
      email: string;
      firstName: string | null;
      lastName: string | null;
      company: string | null;
      status: string;
      isBlocked: boolean;
      blockedReason: string | null;
    } | null; // NOWE: Może być null dla maili testowych
    mailbox: {
      id: number;
      email: string;
      displayName: string | null;
    } | null;
    reply: {
      id: number;
      leadId: number | null;
      classification: string | null;
      receivedAt: string;
      createdAt: string;
    } | null;
  }>;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    total: number;
    sent: number;
    failed: number;
    queued: number;
    sentToBlocked: number;
  };
  todayStats: {
    total: number;
    sent: number;
    failed: number;
  };
  mailboxStats: Array<{
    email: string;
    displayName: string | null;
    sent: number;
    failed: number;
  }>;
}

// Funkcja do formatowania statusu odpowiedzi
const getReplyStatus = (classification: string | null, hasReply: boolean) => {
  if (!hasReply) {
    return { label: 'Brak odpowiedzi', color: '#999' };
  }
  
  switch (classification) {
    case 'INTERESTED':
      return { label: 'Zainteresowany', color: '#4caf50' };
    case 'NOT_INTERESTED':
      return { label: 'Niezainteresowany', color: '#ff9800' };
    case 'UNSUBSCRIBE':
      return { label: 'Wypisany', color: '#f44336' };
    case 'OOO':
      return { label: 'Poza biurem', color: '#ff9800' };
    case 'REDIRECT':
      return { label: 'Przekierowanie', color: '#9c27b0' };
    case 'BOUNCE':
      return { label: 'Odbity', color: '#f44336' };
    case 'OTHER':
      return { label: 'Inne', color: '#607d8b' };
    default:
      return { label: 'Klasa nieznana', color: '#999' };
  }
};

export default function CampaignOutbox({ campaignId, showStats = true }: { campaignId: number; showStats?: boolean }) {
  const [data, setData] = useState<OutboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'blocked'>('all');
  
  // ✅ PAGINACJA
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // ✅ MODAL SZCZEGÓŁÓW
  const [selectedLog, setSelectedLog] = useState<OutboxData['sendLogs'][0] | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchOutbox();
  }, [campaignId, currentPage, itemsPerPage]);

  const fetchOutbox = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}/outbox?page=${currentPage}&limit=${itemsPerPage}`);
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
  
  const handleLogClick = (log: OutboxData['sendLogs'][0]) => {
    setSelectedLog(log);
    setShowModal(true);
  };
  
  const closeModal = () => {
    setShowModal(false);
    setSelectedLog(null);
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
    const lead = log.lead as any;
    if (filter === 'sent') return log.status === 'sent' && !!lead && !lead.isBlocked && lead.status !== 'BLOCKED';
    if (filter === 'failed') return log.status === 'error';
    if (filter === 'blocked') return log.status === 'sent' && !!lead && (lead.isBlocked || lead.status === 'BLOCKED');
    return true;
  });

  const formatDate = (dateString: string) => {
    const { formatPolishDateTime } = require('@/utils/polishTime');
    return formatPolishDateTime(dateString);
  };

  return (
    <div style={{ padding: 24 }}>
      {showStats && <h2 style={{ marginBottom: 24 }}>Wysyłki kampanii: {data.campaign.name}</h2>}

      {/* Statystyki - tylko jeśli showStats = true */}
      {showStats && (
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 16, 
            marginBottom: 24 
          }}>
            <div style={{ 
              padding: 16, 
              backgroundColor: '#d4edda', 
              borderRadius: 8,
              border: '1px solid #c3e6cb'
            }}>
              <div style={{ fontSize: 14, color: '#155724', marginBottom: 4 }}>Wysłanych dzisiaj</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#155724' }}>{data.todayStats.sent}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Z całej kampanii: {data.stats.sent}</div>
            </div>

            <div style={{ 
              padding: 16, 
              backgroundColor: '#f8d7da', 
              borderRadius: 8,
              border: '1px solid #f5c6cb'
            }}>
              <div style={{ fontSize: 14, color: '#721c24', marginBottom: 4 }}>Błędów dzisiaj</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#721c24' }}>{data.todayStats.failed}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Z całej kampanii: {data.stats.failed}</div>
            </div>

            {data.stats.sentToBlocked > 0 && (
              <div style={{ 
                padding: 16, 
                backgroundColor: '#fff3cd', 
                borderRadius: 8,
                border: '1px solid #ffeeba'
              }}>
                <div style={{ fontSize: 14, color: '#856404', marginBottom: 4 }}>Do zablokowanych</div>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: '#856404' }}>{data.stats.sentToBlocked}</div>
              </div>
            )}
          </div>

          {/* Statystyki skrzynek */}
          {data.mailboxStats.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 8 }}>Użyte skrzynki</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                Liczba pokazuje całkowitą liczbę maili wysłanych z tej kampanii (wszystkie czasy), nie tylko dzisiaj.
              </p>
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
                      {mailbox.sent} wysłanych
                      {mailbox.failed > 0 && ` | ${mailbox.failed} błędów`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
            Do zablokowanych ({data.stats.sentToBlocked})
          </button>
        )}
      </div>

      {/* Kontrolki paginacji */}
      {data.pagination && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 16,
          padding: '12px 16px',
          backgroundColor: '#f8f9fa',
          borderRadius: 8,
          border: '1px solid #dee2e6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>Wierszy na stronę:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              style={{ 
                padding: '4px 8px', 
                border: '1px solid #dee2e6', 
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          <div style={{ fontSize: 14, color: '#666' }}>
            {data.pagination.total > 0 ? (
              <>Strona {data.pagination.page} z {data.pagination.totalPages} ({data.pagination.total} maili)</>
            ) : (
              "Brak maili"
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                border: '1px solid #dee2e6',
                borderRadius: 6,
                backgroundColor: currentPage === 1 ? '#e9ecef' : 'white',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              Pierwsza
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                border: '1px solid #dee2e6',
                borderRadius: 6,
                backgroundColor: currentPage === 1 ? '#e9ecef' : 'white',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              Poprzednia
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(data.pagination!.totalPages, p + 1))}
              disabled={currentPage === data.pagination!.totalPages}
              style={{
                padding: '6px 12px',
                border: '1px solid #dee2e6',
                borderRadius: 6,
                backgroundColor: currentPage === data.pagination!.totalPages ? '#e9ecef' : 'white',
                cursor: currentPage === data.pagination!.totalPages ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              Następna
            </button>
            <button
              onClick={() => setCurrentPage(data.pagination!.totalPages)}
              disabled={currentPage === data.pagination!.totalPages}
              style={{
                padding: '6px 12px',
                border: '1px solid #dee2e6',
                borderRadius: 6,
                backgroundColor: currentPage === data.pagination!.totalPages ? '#e9ecef' : 'white',
                cursor: currentPage === data.pagination!.totalPages ? 'not-allowed' : 'pointer',
                fontSize: 14
              }}
            >
              Ostatnia
            </button>
          </div>
        </div>
      )}

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
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold' }}>Temat</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold' }}>Z jakiej skrzynki</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold' }}>Status wysyłki</th>
              <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold' }}>Odpowiedź</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                  Brak wysyłek w wybranym filtrze
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const lead = log.lead as any;
                const isBlocked = (lead?.isBlocked) || (lead?.status === 'BLOCKED');
                const isFailed = log.status === 'error';
                const hasReply = !!log.reply;
                const replyStatus = getReplyStatus(log.reply?.classification || null, hasReply);
                const isTestEmail = !lead || (log.subject?.includes('[TEST]'));
                
                return (
                  <tr 
                    key={log.id} 
                    onClick={() => handleLogClick(log)}
                    style={{ 
                      borderBottom: '1px solid #dee2e6',
                      backgroundColor: isBlocked ? '#fff3cd' : (isFailed ? '#f8d7da' : (isTestEmail ? '#f0f7ff' : 'white')),
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isBlocked && !isFailed && !isTestEmail) {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isBlocked && !isFailed && !isTestEmail) {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <td style={{ padding: 12, fontSize: 14 }}>
                      {formatDate(log.createdAt)}
                    </td>
                    <td style={{ padding: 12 }}>
                      {lead ? (
                        <>
                          <div style={{ fontWeight: 'bold' }}>{lead.email}</div>
                          {(lead.firstName || lead.lastName) && (
                            <div style={{ fontSize: 12, color: '#666' }}>
                              {lead.firstName} {lead.lastName}
                            </div>
                          )}
                          {lead.company && (
                            <div style={{ fontSize: 12, color: '#666' }}>{lead.company}</div>
                          )}
                          {isBlocked && (
                            <div style={{ fontSize: 11, color: '#856404', marginTop: 4 }}>
                              ZABLOKOWANY: {lead.blockedReason || 'Nieznany powód'}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {log.toEmail ? (
                            <>
                              <div style={{ fontWeight: 'bold', color: '#0066cc' }}>{log.toEmail}</div>
                              <div style={{ fontSize: 11, color: '#666', marginTop: 2, fontStyle: 'italic' }}>
                                Mail testowy
                              </div>
                            </>
                          ) : (
                            <span style={{ color: '#999', fontStyle: 'italic' }}>Brak danych odbiorcy</span>
                          )}
                        </>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {log.subject ? (
                        <>
                          <div style={{ fontWeight: '600', marginBottom: 4 }}>
                            {log.subject}
                          </div>
                          {isTestEmail && (
                            <div style={{ 
                              fontSize: 11, 
                              color: '#0066cc', 
                              backgroundColor: '#e8f4fd',
                              padding: '2px 6px',
                              borderRadius: 4,
                              display: 'inline-block',
                              fontWeight: '600'
                            }}>
                              TEST
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#999' }}>Brak tematu</span>
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
                        <span style={{ color: '#28a745', fontWeight: 'bold' }}>Wysłano</span>
                      ) : log.status === 'error' ? (
                        <>
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>Błąd</span>
                          {log.error && (
                            <div style={{ fontSize: 11, color: '#721c24', marginTop: 4 }}>
                              {log.error}
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#6c757d' }}>{log.status}</span>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {hasReply ? (
                        <span style={{ color: replyStatus.color, fontWeight: 'bold' }}>
                          {replyStatus.label}
                        </span>
                      ) : (
                        <span style={{ color: '#999', fontStyle: 'italic' }}>
                          Brak odpowiedzi
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal szczegółów maila */}
      {showModal && selectedLog && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={closeModal}
        >
          <div 
            style={{
              backgroundColor: "white",
              borderRadius: 8,
              padding: 24,
              maxWidth: "800px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Szczegóły maila</h2>
              <button
                onClick={closeModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#666",
                  padding: "4px"
                }}
                title="Zamknij"
              >
                ×
              </button>
            </div>

            {/* Podstawowe informacje */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr 1fr", 
              gap: 16, 
              marginBottom: 24,
              padding: 16,
              backgroundColor: "#f8f9fa",
              borderRadius: 8,
              fontSize: 14
            }}>
              <div>
                <strong>Typ:</strong><br />
                <span style={{ color: "#666" }}>Wysłany</span>
              </div>
              <div>
                <strong>Data:</strong><br />
                <span style={{ color: "#666" }}>{formatDate(selectedLog.createdAt)}</span>
              </div>
              <div>
                <strong>Status:</strong><br />
                <span style={{ 
                  color: selectedLog.status === 'sent' ? '#28a745' : '#dc3545', 
                  fontWeight: 'bold' 
                }}>
                  {selectedLog.status === 'sent' ? 'Wysłano' : selectedLog.status === 'error' ? 'Błąd' : selectedLog.status}
                </span>
              </div>
            </div>

            {/* Nadawca i odbiorca */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: 16, 
              marginBottom: 24,
              fontSize: 14
            }}>
              <div style={{ 
                padding: 16, 
                backgroundColor: "#f0f9ff", 
                borderRadius: 8,
                border: "1px solid #bae6fd"
              }}>
                <strong style={{ color: "#0369a1" }}>Wysłał</strong><br />
                <div style={{ marginTop: 8 }}>
                  {selectedLog.mailbox ? (
                    <>
                      <strong>{selectedLog.mailbox.displayName || selectedLog.mailbox.email}</strong><br />
                      <span style={{ color: "#666", fontSize: 12, wordBreak: "break-all" }}>
                        {selectedLog.mailbox.email}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "#999" }}>Brak danych skrzynki</span>
                  )}
                </div>
              </div>
              
              <div style={{ 
                padding: 16, 
                backgroundColor: "#f0fdf4", 
                borderRadius: 8,
                border: "1px solid #bbf7d0"
              }}>
                <strong style={{ color: "#166534" }}>Otrzymał</strong><br />
                <div style={{ marginTop: 8 }}>
                  {selectedLog.lead ? (
                    <>
                      <span style={{ color: "#666", wordBreak: "break-all" }}>
                        {selectedLog.lead.email}
                      </span>
                      {(selectedLog.lead.firstName || selectedLog.lead.lastName) && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
                          {selectedLog.lead.firstName} {selectedLog.lead.lastName}
                        </div>
                      )}
                      {selectedLog.lead.company && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>
                          {selectedLog.lead.company}
                        </div>
                      )}
                    </>
                  ) : selectedLog.toEmail ? (
                    <>
                      <span style={{ color: "#666", wordBreak: "break-all" }}>
                        {selectedLog.toEmail}
                      </span>
                      <div style={{ marginTop: 4, fontSize: 11, color: "#0066cc", fontStyle: "italic" }}>
                        Mail testowy
                      </div>
                    </>
                  ) : (
                    <span style={{ color: "#999" }}>Brak danych odbiorcy</span>
                  )}
                </div>
              </div>
            </div>

            {/* Temat */}
            <div style={{ marginBottom: 24 }}>
              <strong>Temat:</strong>
              <div style={{ 
                marginTop: 8, 
                padding: 12, 
                backgroundColor: "#f8f9fa", 
                borderRadius: 8,
                fontSize: 14
              }}>
                {selectedLog.subject || "Brak tematu"}
              </div>
            </div>

            {/* Treść maila */}
            {selectedLog.content && (
              <div style={{ marginBottom: 24 }}>
                <strong>Treść:</strong>
                <div style={{ 
                  marginTop: 8, 
                  padding: 12, 
                  backgroundColor: "#f8f9fa", 
                  borderRadius: 8,
                  border: "1px solid #dee2e6",
                  maxHeight: "400px",
                  overflow: "auto",
                  fontSize: 12,
                  lineHeight: "1.6",
                  fontFamily: "Arial, sans-serif"
                }}
                dangerouslySetInnerHTML={{ 
                  __html: selectedLog.content
                    .replace(/\r\n/g, '<br>')
                    .replace(/\n/g, '<br>')
                    .replace(/\r/g, '<br>')
                }}
                />
              </div>
            )}

            {/* Informacje o błędzie */}
            {selectedLog.status === 'error' && selectedLog.error && (
              <div style={{ 
                marginBottom: 24,
                padding: 12, 
                backgroundColor: "#f8d7da", 
                borderRadius: 8,
                border: "1px solid #f5c6cb"
              }}>
                <strong style={{ color: "#721c24" }}>Błąd:</strong>
                <div style={{ marginTop: 8, color: "#721c24", fontSize: 14 }}>
                  {selectedLog.error}
                </div>
              </div>
            )}

            {/* Informacje o odpowiedzi */}
            {selectedLog.reply && (
              <div style={{ 
                marginBottom: 24,
                padding: 12, 
                backgroundColor: "#d4edda", 
                borderRadius: 8,
                border: "1px solid #c3e6cb"
              }}>
                <strong style={{ color: "#155724" }}>Odpowiedź:</strong>
                <div style={{ marginTop: 8, fontSize: 14, color: "#155724" }}>
                  <div>
                    <strong>Klasyfikacja:</strong> {getReplyStatus(selectedLog.reply.classification, true).label}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    Data odpowiedzi: {formatDate(selectedLog.reply.receivedAt)}
                  </div>
                </div>
              </div>
            )}

            {/* Przycisk zamknięcia */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button
                onClick={closeModal}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: "bold"
                }}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

