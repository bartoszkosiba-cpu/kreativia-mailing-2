"use client";

import { useState, useEffect } from "react";
import MaterialsManager from "./MaterialsManager";

interface Props {
  campaignId: number;
  initialSettings: {
    autoReplyEnabled: boolean;
    autoReplyContext: string | null;
    autoReplyRules: string | null;
    autoReplyDelayMinutes: number;
    autoReplyContent: string | null;
    autoReplyGuardianTemplate: string | null;
    autoReplyGuardianTitle: string | null;
    autoReplyIncludeGuardian?: boolean; // ✅ NOWE
    autoReplyGuardianIntroText?: string | null; // ✅ NOWE
  };
  campaignSubject?: string | null; // Temat kampanii (dla podglądu)
}

export default function AutoReplySettings({ campaignId, initialSettings, campaignSubject }: Props) {
  // Konwersja initialSettings do boolean (uwzględnij różne typy)
  const autoReplyEnabledValue: any = initialSettings.autoReplyEnabled;
  const initialEnabled = autoReplyEnabledValue === true || autoReplyEnabledValue === 1 || String(autoReplyEnabledValue) === "1";
  
  // Funkcjonalność zawsze włączona (checkbox ukryty)
  const [enabled, setEnabled] = useState(true);
  const [delay, setDelay] = useState(initialSettings.autoReplyDelayMinutes || 15);
  const [content, setContent] = useState(initialSettings.autoReplyContent || "");
  const [includeGuardian, setIncludeGuardian] = useState(initialSettings.autoReplyIncludeGuardian || false); // ✅ NOWE
  const [guardianIntroText, setGuardianIntroText] = useState(initialSettings.autoReplyGuardianIntroText || ""); // ✅ NOWE
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  
  // Podgląd
  const [previewData, setPreviewData] = useState<{
    guardian: { name: string; email: string; phone: string; title: string };
    exampleSignature: string | null;
    exampleSubject: string;
    materials: Array<{ id: number; name: string; type: string; url: string | null; fileName: string | null }>;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Synchronizuj stan z initialSettings gdy się zmienią (np. po odświeżeniu strony)
  useEffect(() => {
    // enabled zawsze true - checkbox ukryty
    setEnabled(true);
    setDelay(initialSettings.autoReplyDelayMinutes || 15);
    setContent(initialSettings.autoReplyContent || "");
    setIncludeGuardian(initialSettings.autoReplyIncludeGuardian || false); // ✅ NOWE
    setGuardianIntroText(initialSettings.autoReplyGuardianIntroText || ""); // ✅ NOWE
  }, [initialSettings.autoReplyDelayMinutes, initialSettings.autoReplyContent, initialSettings.autoReplyIncludeGuardian, initialSettings.autoReplyGuardianIntroText]);

  // Pobierz dane dla podglądu (dane handlowca i stopka)
  useEffect(() => {
    if (enabled) {
      loadPreviewData();
    }
  }, [enabled, campaignId]);

  const loadPreviewData = async () => {
    setLoadingPreview(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/auto-reply-preview`);
      const data = await response.json();
      
      if (data.success) {
        setPreviewData(data.data);
      }
    } catch (error: any) {
      console.error("[AUTO REPLY] Błąd pobierania podglądu:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Zapisz autoReplyEnabled jako true przy pierwszym załadowaniu (checkbox ukryty, ale funkcjonalność zawsze włączona)
  useEffect(() => {
    const ensureEnabled = async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            autoReplyEnabled: true
          })
        });

        const data = await response.json();
        if (!data.success) {
          console.error("[AUTO REPLY] Błąd zapisu autoReplyEnabled:", data.error);
        }
      } catch (error: any) {
        console.error("[AUTO REPLY] Błąd zapisu autoReplyEnabled:", error);
      }
    };

    // Zapisz tylko raz przy załadowaniu
    ensureEnabled();
  }, [campaignId]);

  // Zapisz wszystkie ustawienia (kontekst + zasady + opóźnienie)
  // Uwaga: autoReplyEnabled zawsze jest true (checkbox ukryty)
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSavedMessage("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                autoReplyDelayMinutes: delay,
                autoReplyContent: content.trim() || null,
                autoReplyIncludeGuardian: includeGuardian === true, // ✅ NOWE: Upewnij się że to boolean
                autoReplyGuardianIntroText: guardianIntroText && guardianIntroText.trim() ? guardianIntroText.trim() : null // ✅ NOWE: Poprawna obsługa pustego stringa
              })
      });

      const data = await response.json();

      if (!data.success) {
        // ✅ Wyświetl szczegóły błędu jeśli są dostępne
        const errorMessage = data.details 
          ? `${data.error}\n\nSzczegóły: ${data.details}`
          : data.error;
        alert(`Błąd: ${errorMessage}`);
        console.error("[AUTO REPLY] Błąd zapisu:", data);
        return;
      }

      setSavedMessage("✓ Zapisano ustawienia");
      setTimeout(() => setSavedMessage(""), 3000);
    } catch (error: any) {
      alert(`Błąd zapisu: ${error.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px", marginBottom: "20px" }}>
      <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Automatyczne odpowiedzi z materiałami</h2>

      {/* Checkbox ukryty - funkcjonalność zawsze włączona */}

      {/* Opcje widoczne tylko gdy moduł jest aktywny */}
      {enabled && (
        <>
          {/* Opóźnienie wysyłki */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Opóźnienie wysyłki (minuty)
            </label>
            <input
              type="number"
              value={delay}
              onChange={(e) => setDelay(parseInt(e.target.value) || 15)}
              min={1}
              max={1440}
              style={{
                width: "120px",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            />
            <p style={{ marginTop: "4px", color: "#666", fontSize: "13px" }}>
              Po wykryciu prośby o materiały, odpowiedź zostanie wysłana po tym czasie (domyślnie 15 min).
            </p>
          </div>

          {/* Statyczna treść odpowiedzi */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "6px", border: "1px solid #e0e0e0" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Treść odpowiedzi *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Wprowadź treść odpowiedzi. Możesz użyć placeholderów: {firstName}, {lastName}, {greeting}, {materials}"
              required
              style={{
                width: "100%",
                minHeight: "150px",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontFamily: "inherit",
                fontSize: "14px"
              }}
            />
            <p style={{ marginTop: "4px", color: "#666", fontSize: "13px" }}>
              Treść odpowiedzi która zostanie wysłana do leada. Placeholdery: {`{firstName}`}, {`{lastName}`}, {`{greeting}`}, {`{materials}`}
            </p>
          </div>

          {/* ✅ NOWE: Dodanie danych handlowca */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f0f9ff", borderRadius: "6px", border: "1px solid #bae6fd" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "12px" }}>
              <input
                type="checkbox"
                checked={includeGuardian}
                onChange={(e) => setIncludeGuardian(e.target.checked)}
                style={{ 
                  width: "18px", 
                  height: "18px", 
                  cursor: "pointer"
                }}
              />
              <span style={{ fontWeight: 600 }}>
                Dodaj dane handlowca do odpowiedzi
              </span>
            </label>
            <p style={{ marginTop: "4px", marginBottom: "12px", color: "#666", fontSize: "13px", marginLeft: "28px" }}>
              Dane handlowca zostaną dodane pod treścią odpowiedzi. Email handlowca zostanie automatycznie dodany do CC.
            </p>
            
            {includeGuardian && (
              <div style={{ marginLeft: "28px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                  Tekst przed danymi handlowca (opcjonalnie)
                </label>
                <textarea
                  value={guardianIntroText}
                  onChange={(e) => setGuardianIntroText(e.target.value)}
                  placeholder='np. "Do wiadomości dołączam opiekuna klienta, który będzie się z Wami kontaktował i pomoże w dalszej współpracy."'
                  style={{
                    width: "100%",
                    minHeight: "80px",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontFamily: "inherit",
                    fontSize: "14px"
                  }}
                />
                <p style={{ marginTop: "4px", color: "#666", fontSize: "12px" }}>
                  Ten tekst pojawi się przed danymi handlowca (imię, nazwisko, telefon, email).
                </p>
              </div>
            )}
          </div>

          {/* JEDEN przycisk zapisu dla wszystkich ustawień */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              style={{
                padding: "12px 24px",
                backgroundColor: savingSettings ? "#ccc" : "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: savingSettings ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "16px"
              }}
            >
              {savingSettings ? "Zapisywanie..." : "Zapisz ustawienia"}
            </button>
            {savedMessage && (
              <span style={{ color: "green", fontWeight: 600 }}>{savedMessage}</span>
            )}
          </div>
        </>
      )}

      {/* Pokaż sekcję materiałów tylko gdy auto-reply jest włączony */}
      {enabled && (
        <MaterialsManager campaignId={campaignId} />
      )}

      {/* Podgląd odpowiedzi - tylko gdy moduł jest aktywny i jest treść */}
      {enabled && content.trim() && (
        <EmailPreview
          content={content}
          previewData={previewData}
          loadingPreview={loadingPreview}
          campaignSubject={campaignSubject}
          campaignId={campaignId}
          includeGuardian={includeGuardian}
          guardianIntroText={guardianIntroText}
        />
      )}
    </div>
  );
}

// Komponent podglądu emaila
function EmailPreview({
  content,
  previewData,
  loadingPreview,
  campaignSubject,
  campaignId,
  includeGuardian,
  guardianIntroText
}: {
  content: string;
  previewData: {
    guardian: { name: string; email: string; phone: string; title: string };
    exampleSignature: string | null;
    exampleSubject: string;
    materials: Array<{ id: number; name: string; type: string; url: string | null; fileName: string | null }>;
  } | null;
  loadingPreview: boolean;
  campaignSubject: string | null | undefined;
  campaignId: number;
  includeGuardian?: boolean; // ✅ NOWE
  guardianIntroText?: string; // ✅ NOWE
}) {
  
  // Użyj przykładowego powitania dla podglądu (bez potrzeby ładowania z API)
  const exampleGreeting = "Dzień dobry [Lead]";
  
  // Generuj treść emaila z podstawionymi placeholderami
  const generatePreviewContent = (): string => {
    if (!content.trim()) return "";
    
    let previewContent = content;
    
    // Podstaw placeholdery - użyj przykładowych wartości dla podglądu
    previewContent = previewContent.replace(/\{firstName\}/g, "[Imię leada]");
    previewContent = previewContent.replace(/\{lastName\}/g, "[Nazwisko leada]");
    previewContent = previewContent.replace(/\{greeting\}/g, exampleGreeting);
    
    // Materiały
    if (previewData && previewData.materials.length > 0) {
      const materialsList = previewData.materials.map((m, idx) => {
        if (m.type === "LINK") {
          return `${idx + 1}. ${m.name}`;
        } else {
          return `${idx + 1}. ${m.name}`;
        }
      }).join('\n');
      previewContent = previewContent.replace(/\{materials\}/g, materialsList);
      previewContent = previewContent.replace(/\{materialsList\}/g, materialsList);
    } else {
      previewContent = previewContent.replace(/\{materials\}/g, "1. Przykładowy katalog");
      previewContent = previewContent.replace(/\{materialsList\}/g, "1. Przykładowy katalog");
    }
    
    // ✅ Jeśli treść nie zaczyna się od powitania (i nie ma placeholder {greeting}), dodaj je na początku
    // Sprawdź czy treść już zawiera powitanie na początku
    const trimmedContent = previewContent.trim();
    const hasGreetingAtStart = trimmedContent.toLowerCase().startsWith('dzień dobry') || 
                               trimmedContent.toLowerCase().startsWith('hello') ||
                               trimmedContent.toLowerCase().startsWith('guten tag') ||
                               trimmedContent.toLowerCase().startsWith('bonjour') ||
                               trimmedContent.toLowerCase().includes('dzień dobry');
    
    // Jeśli nie ma powitania na początku i nie było placeholder {greeting}, dodaj przykładowe powitanie
    if (!hasGreetingAtStart && !content.includes('{greeting}')) {
      previewContent = `${exampleGreeting},\n\n${previewContent}`;
    }
    
    return previewContent;
  };

  // ✅ Dodaj dane handlowca do podglądu (jeśli włączone)
  const generateGuardianPreview = (): string => {
    if (!includeGuardian || !previewData?.guardian) return "";
    
    let guardianPreview = "";
    
    // Tekst wprowadzający (jeśli ustawiony)
    if (guardianIntroText?.trim()) {
      guardianPreview += guardianIntroText.trim() + "\n\n";
    }
    
    // Formatowanie danych handlowca (zgodnie z wymaganiami)
    const guardian = previewData.guardian;
    guardianPreview += `<strong>${guardian.name}</strong>`;
    
    // Tytuł/stanowisko (jeśli jest - to jest w previewData.guardian.title)
    if (guardian.title) {
      guardianPreview += "\n" + guardian.title;
    }
    
    // Telefon i email
    guardianPreview += "\n";
    if (guardian.phone) {
      guardianPreview += "\nM. " + guardian.phone;
    }
    if (guardian.email) {
      guardianPreview += "\nE. " + guardian.email;
    }
    
    return guardianPreview;
  };

  // Temat emaila
  const emailSubject = campaignSubject 
    ? (campaignSubject.startsWith('Re:') ? campaignSubject : `Re: ${campaignSubject}`)
    : (previewData?.exampleSubject || "Re: Materiały");

  const previewContent = generatePreviewContent();
  const guardianPreview = generateGuardianPreview(); // ✅ NOWE
  // Nie wyświetlamy stopki w podglądzie - będzie dodana automatycznie podczas wysyłki

  if (loadingPreview) {
    return (
      <div style={{ marginTop: "30px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "8px", border: "1px solid #e0e0e0" }}>
        <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Podgląd odpowiedzi</h3>
        <p style={{ color: "#666" }}>Ładowanie danych podglądu...</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "30px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "8px", border: "1px solid #e0e0e0" }}>
      <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Podgląd odpowiedzi</h3>
      
      {/* Informacja o powitaniu */}
      <div style={{ marginBottom: "15px", padding: "10px", backgroundColor: "#e9ecef", borderRadius: "4px", fontSize: "13px", color: "#666", fontStyle: "italic" }}>
        💡 Tu pojawi się powitanie przygotowane automatycznie dla konkretnego leada (np. "Dzień dobry Panie Janie")
      </div>

      {/* Email preview */}
      <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "6px", border: "1px solid #ddd" }}>
        <div style={{ marginBottom: "15px", paddingBottom: "15px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: "12px", color: "#999", marginBottom: "5px" }}>Od:</div>
          <div style={{ fontWeight: 600 }}>{previewData?.guardian.email || "handlowiec@kreativia.pl"}</div>
          <div style={{ fontSize: "12px", color: "#999", marginTop: "5px" }}>Do: jan.kowalski@example.com</div>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <div style={{ fontSize: "12px", color: "#999", marginBottom: "5px" }}>Temat:</div>
          <div style={{ fontWeight: 600, fontSize: "16px" }}>{emailSubject}</div>
        </div>

        <div style={{ marginTop: "20px", whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: "1.6", color: "#333" }}>
          {previewContent}
        </div>

        {/* ✅ Dane handlowca (jeśli włączone) */}
        {includeGuardian && guardianPreview && (
          <div style={{ marginTop: "25px", paddingTop: "20px", borderTop: "1px solid #ddd" }}>
            <div 
              style={{ 
                whiteSpace: "pre-wrap", 
                fontSize: "14px", 
                lineHeight: "1.6", 
                color: "#333" 
              }}
              dangerouslySetInnerHTML={{ __html: guardianPreview.replace(/\n/g, '<br>') }}
            />
            {previewData?.guardian.email && (
              <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#e3f2fd", borderRadius: "4px", fontSize: "12px", color: "#1565c0" }}>
                <strong>Email handlowca zostanie dodany do CC:</strong> {previewData.guardian.email}
              </div>
            )}
          </div>
        )}

        {/* Stopka będzie automatycznie dodana z oryginalnego maila kampanii */}
        <div style={{ marginTop: "25px", paddingTop: "20px", borderTop: "2px solid #ddd", fontSize: "12px", color: "#999", fontStyle: "italic", backgroundColor: "#f9f9f9", padding: "15px", borderRadius: "6px" }}>
          <strong style={{ color: "#666", fontStyle: "normal" }}>Stopka emaila</strong> zostanie automatycznie pobrana z oryginalnego maila kampanii i dodana na końcu odpowiedzi.
        </div>

        {previewData && previewData.materials.length > 0 && (
          <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#e8f5e9", borderRadius: "6px", border: "1px solid #c8e6c9" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "10px", color: "#2e7d32" }}>Dołączone materiały:</div>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#333" }}>
              {previewData.materials.map((mat, idx) => (
                <li key={idx}>
                  {mat.name} ({mat.type === "LINK" ? "Link" : "Załącznik"})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

    </div>
  );
}
