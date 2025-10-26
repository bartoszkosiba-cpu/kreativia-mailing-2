"use client";

import { useState, useEffect } from "react";

interface CampaignSenderProps {
  campaignId: number;
  hasSubject: boolean;
  hasText: boolean;
  hasLeads: boolean;
  leadsCount: number;
  salesperson?: {
    name: string;
    email: string;
  } | null;
}

export default function CampaignSender({ campaignId, hasSubject, hasText, hasLeads, leadsCount, salesperson }: CampaignSenderProps) {
  const [testEmail, setTestEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [hasSentEmails, setHasSentEmails] = useState(false);
  const [isCheckingHistory, setIsCheckingHistory] = useState(true);

  const canSend = hasSubject && hasText && hasLeads;

  // Sprawdź czy kampania ma już wysłane maile
  useEffect(() => {
    const checkSendHistory = async () => {
      try {
        setIsCheckingHistory(true);
        const response = await fetch(`/api/campaigns/${campaignId}/outbox`);
        const data = await response.json();
        
        if (data.success && data.data.stats.sent > 0) {
          setHasSentEmails(true);
        }
      } catch (error) {
        console.error('Błąd sprawdzania historii wysyłek:', error);
      } finally {
        setIsCheckingHistory(false);
      }
    };

    checkSendHistory();
  }, [campaignId]);

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      alert("Podaj email testowy");
      return;
    }

    setIsTestSending(true);
    setResult(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          testEmail: testEmail.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(`✅ Test mail wysłany pomyślnie do ${testEmail}`);
      } else {
        setResult(`❌ Błąd: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ Błąd: ${error instanceof Error ? error.message : "Nieznany błąd"}`);
    } finally {
      setIsTestSending(false);
    }
  };

  const handleSendCampaign = async (forceResend = false) => {
    // LIMIT BEZPIECZEŃSTWA: max 20 leadów dla natychmiastowej wysyłki
    const MAX_INSTANT_SEND = 20;
    
    if (leadsCount > MAX_INSTANT_SEND) {
      alert(`⚠️ ZABEZPIECZENIE:\n\nPrzycisk "Uruchom kampanię" jest przeznaczony tylko do testów!\n\nMasz ${leadsCount} leadów w kampanii, co przekracza limit ${MAX_INSTANT_SEND} maili.\n\n✅ Użyj zamiast tego HARMONOGRAMU:\n1. Ustaw harmonogram wysyłki poniżej\n2. Kliknij "Zaplanuj kampanię"\n3. System będzie wysyłał automatycznie zgodnie z harmonogramem\n\nTo zabezpiecza przed przypadkowym wysłaniem setek maili jednocześnie!`);
      return;
    }

    if (!forceResend && !confirm(`⚠️ UWAGA - To jest NATYCHMIASTOWA wysyłka testowa!\n\nWysłanych zostanie ${leadsCount} maili TERAZ (bez harmonogramu).\n\n✅ Jeśli chcesz wysłać więcej maili lub rozłożyć wysyłkę w czasie:\n- Użyj HARMONOGRAMU poniżej\n- Kliknij "Zaplanuj kampanię"\n\nCzy na pewno chcesz wysłać ${leadsCount} maili NATYCHMIAST?`)) {
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceResend })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(`✅ Kampania wysłana pomyślnie!\n\n${data.message}\n\nSzczegóły:\n- Wysłano: ${data.summary.success}\n- Błędy: ${data.summary.errors}\n- Razem: ${data.summary.total}`);
      } else {
        setResult(`❌ Błąd: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ Błąd: ${error instanceof Error ? error.message : "Nieznany błąd"}`);
    } finally {
      setIsSending(false);
    }
  };

  const MAX_INSTANT_SEND = 20;
  const exceedsLimit = leadsCount > MAX_INSTANT_SEND;

  return (
    <div style={{ marginBottom: 20, padding: 20, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
      <h3>Wysyłka testowa (max {MAX_INSTANT_SEND} leadów)</h3>
      
      {exceedsLimit && (
        <div style={{ 
          padding: 12, 
          backgroundColor: "#fff3cd", 
          border: "2px solid #ffc107",
          borderRadius: 4, 
          marginBottom: 16 
        }}>
          <p style={{ margin: 0, color: "#856404", fontWeight: "bold" }}>
            Za dużo leadów dla testowej wysyłki!
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#856404" }}>
            Masz {leadsCount} leadów w kampanii. Przycisk "Uruchom kampanię" jest zablokowany (limit: {MAX_INSTANT_SEND}).
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#856404" }}>
            Użyj <strong>HARMONOGRAMU</strong> poniżej, aby wysłać więcej maili bezpiecznie.
          </p>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
          Email testowy
        </label>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="twoj-email@example.com"
          style={{
            width: "100%",
            padding: 8,
            border: "1px solid #ccc",
            borderRadius: 4,
            fontSize: 16
          }}
        />
        <p style={{ fontSize: "12px", color: "#666", marginTop: 4 }}>
          Wyślij testowy mail przed wysyłką do wszystkich leadów
        </p>
      </div>

      {salesperson && (
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#e8f4fd", borderRadius: 4 }}>
          <p style={{ margin: 0, fontWeight: "bold" }}>Nadawca:</p>
          <p style={{ margin: "4px 0", fontSize: "14px" }}>
{salesperson.name}
          </p>
          <p style={{ margin: "4px 0", fontSize: "14px" }}>
            Email: {salesperson.email}
            <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>
              (główna skrzynka)
            </span>
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={handleTestSend}
          disabled={!hasSubject || !testEmail.trim() || isTestSending}
          style={{
            padding: "10px 20px",
            backgroundColor: (!hasSubject || !testEmail.trim() || isTestSending) ? "#ccc" : "#17a2b8",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: (!hasSubject || !testEmail.trim() || isTestSending) ? "not-allowed" : "pointer"
          }}
        >
          {isTestSending ? "Wysyłanie testu..." : "Wyślij test"}
        </button>

        {!hasSentEmails ? (
          // Pokazuj "Wyślij kampanię" jeśli NIE BYŁO wysyłki
          <button
            onClick={() => handleSendCampaign(false)}
            disabled={!canSend || isSending || exceedsLimit || isCheckingHistory}
            style={{
              padding: "10px 20px",
              backgroundColor: (!canSend || isSending || exceedsLimit || isCheckingHistory) ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: (!canSend || isSending || exceedsLimit || isCheckingHistory) ? "not-allowed" : "pointer",
              fontWeight: "bold"
            }}
            title={exceedsLimit ? `Limit przekroczony (${leadsCount}/${MAX_INSTANT_SEND}). Użyj harmonogramu.` : ""}
          >
            {isCheckingHistory ? "Sprawdzanie..." : isSending ? "Wysyłanie..." : exceedsLimit ? `Zablokowane (${leadsCount} leadów)` : "Wyślij kampanię"}
          </button>
        ) : (
          // Pokazuj "Wyślij ponownie" jeśli BYŁA wysyłka
          <button
            onClick={() => handleSendCampaign(true)}
            disabled={!canSend || isSending || exceedsLimit}
            style={{
              padding: "10px 20px",
              backgroundColor: (!canSend || isSending || exceedsLimit) ? "#ccc" : "#ff9800",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: (!canSend || isSending || exceedsLimit) ? "not-allowed" : "pointer",
              fontWeight: "bold"
            }}
            title="Wyślij ponownie do wszystkich leadów (ignoruje sprawdzanie duplikatów)"
          >
            {isSending ? "Wysyłanie..." : "Wyślij ponownie"}
          </button>
        )}
      </div>

      {!hasSubject && (
        <div style={{ padding: 12, backgroundColor: "#fff3cd", borderRadius: 4, marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#856404" }}>
            Kampania nie ma tematu maila. Dodaj temat przed wysyłką.
          </p>
        </div>
      )}

      {!hasText && (
        <div style={{ padding: 12, backgroundColor: "#fff3cd", borderRadius: 4, marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#856404" }}>
            Kampania nie ma treści. Dodaj treść przed wysyłką.
          </p>
        </div>
      )}

      {!hasLeads && (
        <div style={{ padding: 12, backgroundColor: "#fff3cd", borderRadius: 4, marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#856404" }}>
            Kampania nie ma leadów. Dodaj leady przed wysyłką.
          </p>
        </div>
      )}

      {result && (
        <div style={{
          padding: 12,
          backgroundColor: result.includes("✅") ? "#d4edda" : "#f8d7da",
          borderRadius: 4,
          border: `1px solid ${result.includes("✅") ? "#c3e6cb" : "#f5c6cb"}`
        }}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "14px" }}>
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
