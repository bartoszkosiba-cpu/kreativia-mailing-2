"use client";

import { useState, useEffect } from "react";
import CampaignOutbox from "./CampaignOutbox";
import CampaignStartButton from "./CampaignStartButton";
import CampaignSender from "./CampaignSender";

interface Props {
  campaignId: number;
  campaignName: string;
  campaignStatus: string;
  leadsCount: number;
  delayBetweenEmails: number;
  hasSubject: boolean;
  hasText: boolean;
  hasLeads: boolean;
  salesperson?: {
    name: string;
    email: string;
  } | null;
}

export default function CampaignOutboxTabs(props: Props) {
  type SubTabId = "status" | "maile" | "testy" | "informacje";
  
  // Mapowanie hash -> sub tab ID
  const hashToSubTab: Record<string, SubTabId> = {
    "#wysylka-status": "status",
    "#wysylka-maile": "maile",
    "#wysylka-testy": "testy",
    "#wysylka-informacje": "informacje"
  };
  
  // Mapowanie sub tab ID -> hash
  const subTabToHash: Record<SubTabId, string> = {
    "status": "#wysylka-status",
    "maile": "#wysylka-maile",
    "testy": "#wysylka-testy",
    "informacje": "#wysylka-informacje"
  };
  
  // ✅ Zawsze zaczynaj od "status" (dla SSR) - hash zostanie sprawdzony w useEffect
  const [activeTab, setActiveTab] = useState<SubTabId>("status");
  const [isClient, setIsClient] = useState(false);
  
  // ✅ Sprawdź hash dopiero po mount (tylko na kliencie)
  useEffect(() => {
    setIsClient(true);
    
    // Funkcja do pobrania aktywnej podkarty z URL hash
    const getActiveSubTabFromHash = (): SubTabId => {
      if (typeof window === 'undefined') return "status";
      const hash = window.location.hash;
      // Sprawdź czy hash pasuje do podkart wysyłki
      if (hashToSubTab[hash]) {
        return hashToSubTab[hash];
      }
      // Jeśli jesteśmy na karcie wysyłka (#wysylka), ale bez podkarty, zwróć domyślną
      if (hash === "#wysylka") {
        return "status";
      }
      return "status";
    };
    
      // Sprawdź hash przy pierwszym załadowaniu (tylko jeśli jesteśmy na karcie wysyłka)
      if (window.location.hash.startsWith("#wysylka")) {
        const initialSubTab = getActiveSubTabFromHash();
        setActiveTab(initialSubTab);
      
      // Jeśli jest tylko #wysylka bez podkarty, ustaw domyślny hash
      if (window.location.hash === "#wysylka") {
        window.history.replaceState(null, '', `${window.location.pathname}#wysylka-status`);
      }
    }
    
    // Nasłuchuj zmian hash
    const handleHashChange = () => {
      if (window.location.hash.startsWith("#wysylka")) {
        const newActive = getActiveSubTabFromHash();
        setActiveTab(newActive);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Pusta tablica zależności - uruchom tylko raz przy mount
  
  // Synchronizuj hash URL z aktywną podkartą przy zmianie (tylko na kliencie)
  useEffect(() => {
    if (!isClient) return;
    
    const hash = subTabToHash[activeTab];
    if (hash && typeof window !== 'undefined') {
      // Użyj history.replaceState zamiast pushState, aby nie dodawać wpisu do historii
      window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
    }
  }, [activeTab, isClient]);

  const TabButton = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: "8px 16px",
        borderRadius: 6,
        border: activeTab === id ? "2px solid var(--color-primary)" : "1px solid #dee2e6",
        background: activeTab === id ? "#e8f4fd" : "white",
        cursor: "pointer",
        fontWeight: activeTab === id ? 700 : 500,
        fontSize: 14
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Przyciski kart */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <TabButton id="status" label="Status kampanii" />
        <TabButton id="maile" label="Wysłane maile" />
        <TabButton id="testy" label="Testy" />
        <TabButton id="informacje" label="Informacje" />
      </div>

      {/* Zawartość kart */}
      {activeTab === "status" && (
        <CampaignOutboxStatusTab
          campaignId={props.campaignId}
          campaignName={props.campaignName}
          campaignStatus={props.campaignStatus}
          leadsCount={props.leadsCount}
          delayBetweenEmails={props.delayBetweenEmails}
        />
      )}

      {activeTab === "maile" && (
        <CampaignOutbox campaignId={props.campaignId} showStats={false} />
      )}

      {activeTab === "testy" && (
        <CampaignSender
          campaignId={props.campaignId}
          hasSubject={props.hasSubject}
          hasText={props.hasText}
          hasLeads={props.hasLeads}
          leadsCount={props.leadsCount}
          salesperson={props.salesperson}
        />
      )}

      {activeTab === "informacje" && (
        <CampaignOutboxInfoTab campaignId={props.campaignId} campaignStatus={props.campaignStatus} />
      )}
    </div>
  );
}

// Komponent dla karty "Status wysyłki"
function CampaignOutboxStatusTab({
  campaignId,
  campaignName,
  campaignStatus,
  leadsCount,
  delayBetweenEmails
}: {
  campaignId: number;
  campaignName: string;
  campaignStatus: string;
  leadsCount: number;
  delayBetweenEmails: number;
}) {
  const [outboxData, setOutboxData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/outbox?page=1&limit=1`);
        const result = await response.json();
        if (result.success) {
          setOutboxData(result.data);
        }
      } catch (error) {
        console.error('Błąd pobierania outbox:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [campaignId]);

  if (loading || !outboxData) {
    return <div>Ładowanie...</div>;
  }

  // Funkcja do formatowania statusu kampanii
  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string; bgColor: string } } = {
      'DRAFT': { label: 'Szkic', color: '#666', bgColor: '#e9ecef' },
      'SCHEDULED': { label: 'Zaplanowana', color: '#0066cc', bgColor: '#e8f4fd' },
      'IN_PROGRESS': { label: 'W trakcie', color: '#4caf50', bgColor: '#d4edda' },
      'PAUSED': { label: 'Wstrzymana', color: '#ff9800', bgColor: '#fff3cd' },
      'CANCELLED': { label: 'Anulowana', color: '#f44336', bgColor: '#f8d7da' },
      'COMPLETED': { label: 'Zakończona', color: '#4caf50', bgColor: '#d4edda' }
    };
    return statusMap[status] || { label: status, color: '#666', bgColor: '#e9ecef' };
  };

  const statusInfo = getStatusLabel(campaignStatus);

  return (
    <div>
      {/* Status kampanii */}
      <div style={{ 
        marginBottom: 24, 
        padding: 16, 
        backgroundColor: statusInfo.bgColor, 
        borderRadius: 8, 
        border: `2px solid ${statusInfo.color}` 
      }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Faktyczny status kampanii</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: statusInfo.color }}>
          {statusInfo.label}
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
          ID: {campaignId} | Status techniczny: {campaignStatus}
        </div>
      </div>

      <h3 style={{ marginBottom: 16 }}>Wysyłki kampanii: {campaignName}</h3>

      {/* Statystyki */}
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
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#155724' }}>{outboxData.todayStats.sent}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Z całej kampanii: {outboxData.stats.sent}</div>
        </div>

        <div style={{ 
          padding: 16, 
          backgroundColor: '#f8d7da', 
          borderRadius: 8,
          border: '1px solid #f5c6cb'
        }}>
          <div style={{ fontSize: 14, color: '#721c24', marginBottom: 4 }}>Błędów dzisiaj</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#721c24' }}>{outboxData.todayStats.failed}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Z całej kampanii: {outboxData.stats.failed}</div>
        </div>
      </div>

      {/* Uruchomienie według harmonogramu */}
      <CampaignStartButton
        campaignId={campaignId}
        currentStatus={campaignStatus}
        leadsCount={leadsCount}
        delayBetweenEmails={delayBetweenEmails}
      />

      {/* Użyte skrzynki */}
      {outboxData.mailboxStats.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 8 }}>Użyte skrzynki</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#666', fontStyle: 'italic' }}>
            Liczba pokazuje całkowitą liczbę maili wysłanych z tej kampanii (wszystkie czasy), nie tylko dzisiaj.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {outboxData.mailboxStats.map((mailbox: any, i: number) => (
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
    </div>
  );
}

// Komponent dla karty "Informacje"
function CampaignOutboxInfoTab({ campaignId, campaignStatus }: { campaignId: number; campaignStatus: string }) {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mailboxes, setMailboxes] = useState<any>(null);
  const [mailboxesLoading, setMailboxesLoading] = useState(true);

  // Funkcja do formatowania statusu kampanii (ta sama co w CampaignOutboxStatusTab)
  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string; bgColor: string } } = {
      'DRAFT': { label: 'Szkic', color: '#666', bgColor: '#e9ecef' },
      'SCHEDULED': { label: 'Zaplanowana', color: '#0066cc', bgColor: '#e8f4fd' },
      'IN_PROGRESS': { label: 'W trakcie', color: '#4caf50', bgColor: '#d4edda' },
      'PAUSED': { label: 'Wstrzymana', color: '#ff9800', bgColor: '#fff3cd' },
      'CANCELLED': { label: 'Anulowana', color: '#f44336', bgColor: '#f8d7da' },
      'COMPLETED': { label: 'Zakończona', color: '#4caf50', bgColor: '#d4edda' }
    };
    return statusMap[status] || { label: status, color: '#666', bgColor: '#e9ecef' };
  };

  const statusInfo = getStatusLabel(campaignStatus);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/campaigns/${campaignId}/sending-info`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setInfo(result.data);
        } else {
          console.error('Błąd pobierania informacji:', result.error || 'Nieznany błąd');
          setInfo(null);
        }
      } catch (error) {
        console.error('Błąd pobierania informacji:', error);
        setInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
    // Odświeżaj co 30 sekund
    const interval = setInterval(fetchInfo, 30000);
    
    // Pobierz informacje o skrzynkach
    const fetchMailboxes = async () => {
      try {
        setMailboxesLoading(true);
        const response = await fetch(`/api/campaigns/${campaignId}/mailboxes`);
        const result = await response.json();
        if (result.success) {
          setMailboxes(result.data);
        } else {
          console.error('Błąd pobierania skrzynek:', result.error || 'Nieznany błąd');
          setMailboxes(null);
        }
      } catch (error) {
        console.error('Błąd pobierania skrzynek:', error);
        setMailboxes(null);
      } finally {
        setMailboxesLoading(false);
      }
    };
    
    fetchMailboxes();
    // Odświeżaj skrzynki co 60 sekund
    const mailboxesInterval = setInterval(fetchMailboxes, 60000);
    
    return () => {
      clearInterval(interval);
      clearInterval(mailboxesInterval);
    };
  }, [campaignId]);

  if (loading) {
    return <div style={{ padding: 24 }}>Ładowanie informacji...</div>;
  }

  if (!info) {
    return (
      <div style={{ padding: 24, color: '#d32f2f' }}>
        Błąd podczas pobierania informacji. Sprawdź konsolę przeglądarki.
      </div>
    );
  }

  const formatTime = (date: Date | null) => {
    if (!date) return 'Brak danych';
    return new Date(date).toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatInterval = (seconds: number | null) => {
    if (seconds === null) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}min ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatScheduleTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const formatAllowedDays = (allowedDays: string | null) => {
    if (!allowedDays) return 'Brak';
    const dayNames: { [key: string]: string } = {
      'MON': 'Pon',
      'TUE': 'Wt',
      'WED': 'Śr',
      'THU': 'Czw',
      'FRI': 'Pt',
      'SAT': 'Sb',
      'SUN': 'Nd'
    };
    return allowedDays.split(',').map(day => dayNames[day.trim()] || day.trim()).join(', ');
  };

  return (
    <div>
      {/* Status kampanii */}
      <div style={{ 
        marginBottom: 24, 
        padding: 16, 
        backgroundColor: statusInfo.bgColor, 
        borderRadius: 8, 
        border: `2px solid ${statusInfo.color}` 
      }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Faktyczny status wysyłki</div>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: statusInfo.color }}>
          {statusInfo.label}
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
          ID: {campaignId} | Status techniczny: {campaignStatus}
        </div>
      </div>

      <h3 style={{ marginBottom: 24 }}>Szczegółowe informacje o wysyłce</h3>

      {/* Okno czasowe wysyłki */}
      <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#e8f4fd', borderRadius: 8, border: '2px solid #0066cc' }}>
        <h4 style={{ marginTop: 0, color: '#0066cc', marginBottom: 12 }}>Możliwe godziny wysyłki</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Okno czasowe</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0066cc' }}>
              {formatScheduleTime(info.schedule.startHour, info.schedule.startMinute || 0)} - {formatScheduleTime(info.schedule.endHour, info.schedule.endMinute || 0)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Dozwolone dni</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>
              {formatAllowedDays(info.schedule.allowedDays)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Pozostało czasu w oknie</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: info.todayInfo.secondsRemainingInWindow > 0 ? '#4caf50' : '#999' }}>
              {info.todayInfo.secondsRemainingInWindow > 0 
                ? `${Math.floor(info.todayInfo.secondsRemainingInWindow / 3600)}h ${Math.floor((info.todayInfo.secondsRemainingInWindow % 3600) / 60)}min`
                : 'Okno zakończone'}
            </div>
          </div>
        </div>
      </div>

      {/* Statystyki dzisiejsze */}
      <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8 }}>
        <h4 style={{ marginTop: 0 }}>Dzisiaj</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Kampania aktywna</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>
              {info.todayInfo.isActiveToday ? 'Tak' : 'Nie'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Wysłanych dzisiaj</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{info.todayInfo.sentToday}</div>
            <div style={{ fontSize: 11, color: '#666' }}>Limit: {info.todayInfo.maxPerDay}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>W kolejce</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{info.todayInfo.queuedToday}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Szacowane do wysłania dziś</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0066cc' }}>
              {info.todayInfo.estimatedRemaining || 0}
            </div>
            <div style={{ fontSize: 11, color: '#666' }}>
              {info.todayInfo.secondsRemainingInWindow > 0 
                ? `Pozostało: ${Math.floor(info.todayInfo.secondsRemainingInWindow / 60)}min`
                : 'Okno czasowe zakończone'}
            </div>
          </div>
        </div>
      </div>

      {/* Opóźnienie między mailami */}
      <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8 }}>
        <h4 style={{ marginTop: 0 }}>Szacowany odstęp między mailami</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Bazowy</div>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{info.delayInfo.base}s</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Minimum (80%)</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#4caf50' }}>{info.delayInfo.min}s</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Maksimum (120%)</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff9800' }}>{info.delayInfo.max}s</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Średni</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#0066cc' }}>{info.delayInfo.average}s</div>
          </div>
        </div>
      </div>

      {/* Ostatnie maile */}
      <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8 }}>
        <h4 style={{ marginTop: 0 }}>Ostatnie wysłane maile</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#e8f4fd', borderBottom: '2px solid #b3d9ff' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Data i godzina</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Do kogo</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Odstęp</th>
              </tr>
            </thead>
            <tbody>
              {info.lastEmails.map((email: any, index: number) => (
                <tr key={email.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px', fontSize: 14 }}>{formatTime(email.sentAt)}</td>
                  <td style={{ padding: '12px', fontSize: 14 }}>
                    {email.lead?.email || 'Brak danych'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: 14, fontWeight: index === 0 ? 'bold' : 'normal', color: index === 0 ? '#0066cc' : '#666' }}>
                    {formatInterval(email.intervalSeconds)}
                  </td>
                </tr>
              ))}
              {info.lastEmails.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                    Brak wysłanych maili
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Skrzynki mailowe */}
      {!mailboxesLoading && mailboxes && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6' }}>
          <h4 style={{ marginTop: 0, marginBottom: 8 }}>Skrzynki mailowe</h4>
          <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#666', fontStyle: 'italic' }}>
            Dane pokazują globalną liczbę maili wysłanych dzisiaj ze skrzynki (wszystkie kampanie), nie tylko z tej kampanii.
          </p>
          
          {/* Podsumowanie */}
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#e8f4fd', borderRadius: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Wszystkich skrzynek</div>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>{mailboxes.summary.totalMailboxes}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Aktywnych</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#4caf50' }}>{mailboxes.summary.activeMailboxes}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Dostępnych teraz</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: mailboxes.summary.availableMailboxes > 0 ? '#4caf50' : '#f44336' }}>
                  {mailboxes.summary.availableMailboxes}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Pozostało dzisiaj</div>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: mailboxes.summary.effectiveRemainingToday > 0 ? '#4caf50' : '#999' }}>
                  {mailboxes.summary.effectiveRemainingToday}
                </div>
              </div>
            </div>
          </div>

          {/* Lista skrzynek */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#e8f4fd', borderBottom: '2px solid #b3d9ff', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Email</th>
                  <th style={{ padding: '10px', textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Limit dzienny</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Wysłano dziś<br/><span style={{ fontSize: 10, fontWeight: 'normal' }}>(wszystkie)</span></th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Wysłano dziś<br/><span style={{ fontSize: 10, fontWeight: 'normal' }}>(ta kampania)</span></th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Pozostało</th>
                  <th style={{ padding: '10px', textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#666' }}>Dostępna</th>
                </tr>
              </thead>
              <tbody>
                {mailboxes.mailboxes.map((mailbox: any, index: number) => (
                  <tr 
                    key={mailbox.id} 
                    style={{ 
                      borderBottom: '1px solid #dee2e6',
                      backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa',
                      opacity: mailbox.isActive ? 1 : 0.6
                    }}
                  >
                    <td style={{ padding: '10px', fontSize: 13 }}>
                      {mailbox.email}
                      {mailbox.isMain && <span style={{ marginLeft: 8, fontSize: 11, color: '#0066cc', fontWeight: 'bold' }}>(główna)</span>}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: '#666' }}>
                      {mailbox.status}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontSize: 13 }}>
                      {mailbox.effectiveLimit}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontSize: 13, color: mailbox.currentSent >= mailbox.effectiveLimit ? '#f44336' : '#666' }}>
                      {mailbox.currentSent}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontSize: 13, color: '#666' }}>
                      {mailbox.sentTodayForCampaign !== undefined ? mailbox.sentTodayForCampaign : '-'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontSize: 13, fontWeight: 'bold', color: mailbox.remaining > 0 ? '#4caf50' : mailbox.remaining === 0 ? '#ff9800' : '#f44336' }}>
                      {mailbox.remaining}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {mailbox.isAvailable ? (
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>✓</span>
                      ) : (
                        <span style={{ color: '#999' }}>✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: 12, fontSize: 11, color: '#666', fontStyle: 'italic' }}>
            * Limity są resetowane codziennie o 00:00 polskiego czasu
          </div>
        </div>
      )}

      {/* Kolejny ruch systemu */}
      <div style={{ padding: 16, backgroundColor: '#fff3cd', borderRadius: 8, border: '2px solid #ff9800', marginBottom: 24 }}>
        <h4 style={{ marginTop: 0, color: '#ff9800', marginBottom: 12 }}>Kolejny ruch systemu</h4>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Akcja</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff9800' }}>
            {info.nextAction?.action || 'Brak informacji'}
          </div>
          {info.nextAction?.reason && (
            <div style={{ fontSize: 13, color: '#666', marginTop: 4, fontStyle: 'italic' }}>
              {info.nextAction.reason}
            </div>
          )}
        </div>

        {info.nextAction?.nextLead && (
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Następny lead w kolejce</div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>
              {info.nextAction.nextLead.firstName} {info.nextAction.nextLead.lastName}
              {info.nextAction.nextLead.company && ` (${info.nextAction.nextLead.company})`}
            </div>
            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
              {info.nextAction.nextLead.email}
            </div>
          </div>
        )}

        {info.nextEmailTime && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Szacowany czas</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff9800' }}>
              {formatTime(info.nextEmailTime)}
            </div>
            {info.nextAction?.waitTimeSeconds && info.nextAction.waitTimeSeconds > 0 && (
              <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                {info.nextAction.waitTimeSeconds < 60 
                  ? `za ~${info.nextAction.waitTimeSeconds} sekund`
                  : `za ~${Math.floor(info.nextAction.waitTimeSeconds / 60)} minut ${info.nextAction.waitTimeSeconds % 60 > 0 ? `i ${info.nextAction.waitTimeSeconds % 60} sekund` : ''}`}
              </div>
            )}
          </div>
        )}

        {!info.nextEmailTime && info.nextAction?.action !== 'Brak leadów do wysłania' && (
          <div style={{ fontSize: 14, color: '#999', fontStyle: 'italic' }}>
            Brak zaplanowanego czasu wysyłki
          </div>
        )}
      </div>
    </div>
  );
}
