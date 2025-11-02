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
  };
}

export default function AutoReplySettings({ campaignId, initialSettings }: Props) {
  // Konwersja initialSettings do boolean (uwzględnij różne typy)
  const initialEnabled = initialSettings.autoReplyEnabled === true || initialSettings.autoReplyEnabled === 1 || initialSettings.autoReplyEnabled === "1";
  
  const [enabled, setEnabled] = useState(initialEnabled);
  const [context, setContext] = useState(initialSettings.autoReplyContext || "");
  const [rules, setRules] = useState(initialSettings.autoReplyRules || "");
  const [delay, setDelay] = useState(initialSettings.autoReplyDelayMinutes || 15);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  // Synchronizuj stan z initialSettings gdy się zmienią (np. po odświeżeniu strony)
  useEffect(() => {
    const newEnabled = initialSettings.autoReplyEnabled === true || initialSettings.autoReplyEnabled === 1 || initialSettings.autoReplyEnabled === "1";
    setEnabled(newEnabled);
    setContext(initialSettings.autoReplyContext || "");
    setRules(initialSettings.autoReplyRules || "");
    setDelay(initialSettings.autoReplyDelayMinutes || 15);
  }, [initialSettings.autoReplyEnabled, initialSettings.autoReplyContext, initialSettings.autoReplyRules, initialSettings.autoReplyDelayMinutes]);

  // Automatyczny zapis checkboxa przy zmianie (opóźniony, żeby uniknąć zapisu przy inicjalizacji)
  const [prevEnabled, setPrevEnabled] = useState(initialEnabled);
  useEffect(() => {
    // Zapisz tylko jeśli wartość faktycznie się zmieniła (nie przy pierwszym renderze)
    if (enabled !== prevEnabled && enabled !== initialEnabled) {
      const timeoutId = setTimeout(() => {
        const saveCheckbox = async () => {
          try {
            const response = await fetch(`/api/campaigns/${campaignId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                autoReplyEnabled: enabled
              })
            });

            const data = await response.json();

            if (!data.success) {
              console.error("[AUTO REPLY] Błąd automatycznego zapisu checkboxa:", data.error);
              // Przywróć poprzednią wartość w przypadku błędu
              setEnabled(prevEnabled);
            } else {
              // Zapis się udał, zaktualizuj prevEnabled
              setPrevEnabled(enabled);
            }
          } catch (error: any) {
            console.error("[AUTO REPLY] Błąd automatycznego zapisu checkboxa:", error);
            // Przywróć poprzednią wartość w przypadku błędu
            setEnabled(prevEnabled);
          }
        };

        saveCheckbox();
      }, 500); // Opóźnienie 500ms żeby uniknąć nadmiernych requestów

      return () => clearTimeout(timeoutId);
    }
  }, [enabled, prevEnabled, initialEnabled, campaignId]);

  // Zapisz wszystkie ustawienia (kontekst + zasady + opóźnienie)
  // Uwaga: autoReplyEnabled zapisuje się automatycznie przez checkbox
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSavedMessage("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoReplyContext: context.trim() || null,
          autoReplyRules: rules.trim() || null,
          autoReplyDelayMinutes: delay
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`Błąd: ${data.error}`);
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

      {/* Checkbox aktywacji (automatyczny zapis) */}
      <div style={{ marginBottom: "20px", border: "1px solid #e0e0e0", padding: "15px", borderRadius: "8px", backgroundColor: "#fafafa" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ 
              width: "18px", 
              height: "18px", 
              cursor: "pointer"
            }}
          />
          <span style={{ fontWeight: 600 }}>
            Włącz automatyczne odpowiedzi z materiałami
          </span>
        </label>
        <p style={{ marginTop: "8px", color: "#666", fontSize: "14px" }}>
          Gdy lead odpowiada z zainteresowaniem i prosi o materiały (katalog, cennik), system automatycznie wyśle odpowiedź z załącznikami/linkami.
        </p>
        <p style={{ marginTop: "4px", color: "#999", fontSize: "12px", fontStyle: "italic" }}>
          Zmiana zapisuje się automatycznie.
        </p>
      </div>

      {/* Opcje widoczne tylko gdy moduł jest aktywny */}
      {enabled && (
        <>
          {/* Kontekst kampanii */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Kontekst kampanii dla AI
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Np. 'Oferujemy meble biurowe. W treści maila pytamy: Czy mogę przesłać katalog i cennik?'"
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
            <p style={{ marginTop: "4px", color: "#666", fontSize: "13px" }}>
              Opisz kontekst kampanii, aby AI lepiej rozpoznał prośby o materiały.
            </p>
          </div>

          {/* Zasady dla AI */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
              Zasady dla AI (opcjonalnie, JSON)
            </label>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder='{"tone": "professional", "style": "friendly", "include": ["greeting", "thank you"]}'
              style={{
                width: "100%",
                minHeight: "60px",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontFamily: "monospace",
                fontSize: "13px"
              }}
            />
            <p style={{ marginTop: "4px", color: "#666", fontSize: "13px" }}>
              Dodatkowe zasady dla AI przy generowaniu odpowiedzi (ton, styl).
            </p>
          </div>

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
    </div>
  );
}
