"use client";

import { useState, useEffect } from "react";

interface FollowUpInfo {
  campaignId: number;
  campaignName: string;
  status: string;
  stats: {
    total: number;
    noReply: number;
    ooo: number;
    blocked: number;
    eligibleForFollowUp: number;
  };
  existingFollowUps: Array<{
    id: number;
    name: string;
    sequence: number;
    status: string;
    scheduledAt: string;
    daysDelay: number;
  }>;
  minFollowUpDays: number;
  maxFollowUps: number;
}

export default function FollowUpManager({ campaignId, isFollowUp }: { campaignId: number; isFollowUp?: boolean }) {
  const [info, setInfo] = useState<FollowUpInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Jeśli to już jest follow-up, nie pokazuj managera (zapobiega niekończącym się łańcuchom)
  if (isFollowUp) {
    return null;
  }
  
  // Formularz nowego follow-upu
  const [followUpText, setFollowUpText] = useState("");
  const [followUpDays, setFollowUpDays] = useState(7);
  const [followUpSequence, setFollowUpSequence] = useState(1);
  
  // Funkcja do tłumaczenia statusów kampanii
  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'DRAFT': 'Szkic',
      'SCHEDULED': 'Zaplanowana',
      'SENDING': 'W trakcie wysyłki',
      'COMPLETED': 'Zakończona',
      'PAUSED': 'Wstrzymana',
      'CANCELLED': 'Anulowana'
    };
    return statusMap[status] || status;
  };
  
  useEffect(() => {
    loadFollowUpInfo();
  }, [campaignId]);
  
  const loadFollowUpInfo = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}/follow-up`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Nie udało się pobrać danych" }));
        console.error("Błąd odpowiedzi API:", errorData);
        alert(`Błąd ładowania danych: ${errorData.error || response.statusText}`);
        return;
      }
      const data = await response.json();
      setInfo(data);
      
      // Ustaw następny numer follow-upu
      const nextSequence = (data.existingFollowUps.length || 0) + 1;
      setFollowUpSequence(nextSequence);
      setFollowUpDays(data.minFollowUpDays);
    } catch (error) {
      console.error("Błąd ładowania info o follow-upach:", error);
      alert(`Błąd ładowania danych: ${error instanceof Error ? error.message : "Nieznany błąd"}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const createFollowUp = async () => {
    if (!followUpText.trim()) {
      alert("Podaj treść follow-upu!");
      return;
    }
    
    if (!info) return;
    
    if (followUpDays < info.minFollowUpDays) {
      alert(`Minimalne opóźnienie to ${info.minFollowUpDays} dni (czas wysyłki poprzedniej kampanii)`);
      return;
    }
    
    setIsCreating(true);
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpText,
          followUpDays,
          followUpSequence
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`${data.message}`);
        setShowForm(false);
        setFollowUpText("");
        await loadFollowUpInfo();
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (error) {
      console.error("Błąd tworzenia follow-upu:", error);
      alert("Błąd tworzenia follow-upu");
    } finally {
      setIsCreating(false);
    }
  };
  
  if (isLoading) {
    return <div>Ładowanie...</div>;
  }
  
  if (!info) {
    return <div>Błąd ładowania danych</div>;
  }
  
  return (
    <div className="card">
      <h2>Follow-upy</h2>
      
      <div style={{ marginBottom: 20 }}>
        <h3>Statystyki kampanii</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div className="stat-box">
            <div className="stat-label">Wszystkich leadów</div>
            <div className="stat-value">{info.stats.total}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Brak odpowiedzi</div>
            <div className="stat-value" style={{ color: "var(--warning)" }}>{info.stats.noReply}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">OOO</div>
            <div className="stat-value" style={{ color: "var(--info)" }}>{info.stats.ooo}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Zablokowanych</div>
            <div className="stat-value" style={{ color: "var(--danger)" }}>{info.stats.blocked}</div>
          </div>
          <div className="stat-box" style={{ background: "var(--success-light)" }}>
            <div className="stat-label">Kwalifikują się do follow-upu</div>
            <div className="stat-value" style={{ color: "var(--success)", fontSize: 24, fontWeight: 700 }}>
              {info.stats.eligibleForFollowUp}
            </div>
          </div>
        </div>
      </div>
      
      {info.existingFollowUps.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3>📋 Istniejące follow-upy</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nazwa</th>
                <th>Status</th>
                <th>Zaplanowano</th>
                <th>Opóźnienie</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {info.existingFollowUps.map((fu) => (
                <tr key={fu.id}>
                  <td>{fu.sequence}</td>
                  <td>
                    <a href={`/campaigns/${fu.id}`}>{fu.name}</a>
                  </td>
                  <td>
                    <span className={`badge badge-${fu.status === 'SCHEDULED' ? 'info' : fu.status === 'COMPLETED' ? 'success' : 'gray'}`}>
                      {getStatusLabel(fu.status)}
                    </span>
                  </td>
                  <td>{new Date(fu.scheduledAt).toLocaleDateString('pl-PL')}</td>
                  <td>{fu.daysDelay} dni</td>
                  <td>
                    <a href={`/campaigns/${fu.id}`} className="btn btn-sm btn-secondary">
                      Szczegóły →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {info.stats.eligibleForFollowUp > 0 && info.existingFollowUps.length < info.maxFollowUps && (
        <div>
          {!showForm ? (
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              ➕ Dodaj follow-up #{followUpSequence}
            </button>
          ) : (
            <div className="card" style={{ background: "var(--gray-50)", padding: 20 }}>
              <h3>Nowy follow-up #{followUpSequence}</h3>
              
              <div className="form-group">
                <label>
                  Opóźnienie (dni od zakończenia poprzedniej wysyłki):
                  <span style={{ color: "var(--gray-500)", fontSize: 12, marginLeft: 8 }}>
                    Minimum: {info.minFollowUpDays} dni
                  </span>
                </label>
                <input
                  type="number"
                  className="input"
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(parseInt(e.target.value) || info.minFollowUpDays)}
                  min={info.minFollowUpDays}
                  max={30}
                />
              </div>
              
              <div className="form-group">
                <label>
                  Treść follow-upu:
                  <span style={{ color: "var(--gray-500)", fontSize: 12, marginLeft: 8 }}>
                    Temat będzie automatycznie: "Re: {info.stats.total > 0 ? '[temat głównej kampanii]' : ''}"
                  </span>
                </label>
                <textarea
                  className="input"
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  rows={8}
                  placeholder="Wpisz treść follow-upu...&#10;&#10;Przykład:&#10;Kontaktuję się ponownie w sprawie naszej poprzedniej wiadomości.&#10;&#10;Czy miał Pan/Pani okazję zapoznać się z ofertą?"
                />
              </div>
              
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={createFollowUp}
                  disabled={isCreating || !followUpText.trim()}
                  className="btn btn-primary"
                >
                  {isCreating ? "Tworzę..." : `Utwórz follow-up #${followUpSequence} (${info.stats.eligibleForFollowUp} leadów)`}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFollowUpText("");
                  }}
                  className="btn btn-secondary"
                  disabled={isCreating}
                >
                  Anuluj
                </button>
              </div>
              
              <div style={{ marginTop: 15, padding: 10, background: "var(--info-light)", borderRadius: 4, fontSize: 13 }}>
                <strong>Do kogo zostanie wysłany:</strong>
                <ul style={{ marginTop: 5, marginBottom: 0 }}>
                  <li>Leady bez odpowiedzi: {info.stats.noReply}</li>
                  <li>Leady z OOO: {info.stats.ooo}</li>
                </ul>
                <div style={{ marginTop: 8 }}>
                  <strong>Pominięci:</strong> INTERESTED, NOT_INTERESTED, UNSUBSCRIBE, BOUNCE ({info.stats.total - info.stats.eligibleForFollowUp})
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {info.stats.eligibleForFollowUp === 0 && (
        <div className="alert alert-info">
          Brak leadów kwalifikujących się do follow-upu (wszyscy odpowiedzieli lub są zablokowani)
        </div>
      )}
      
      {info.existingFollowUps.length >= info.maxFollowUps && (
        <div className="alert alert-warning">
          Osiągnięto maksymalną liczbę follow-upów ({info.maxFollowUps})
        </div>
      )}
    </div>
  );
}

