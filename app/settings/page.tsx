"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CompanySettings {
  id: number;
  companyName: string;
  address: string | null;
  logoBase64: string | null;
  disclaimerPl: string | null;
  disclaimerEn: string | null;
  disclaimerDe: string | null;
  disclaimerFr: string | null;
  legalFooter: string | null;
  forwardEmail: string | null;
  warmupPerformanceSettings: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        if (data.logoBase64) {
          setLogoPreview(data.logoBase64);
        }
      }
    } catch (error) {
      console.error("Błąd pobierania ustawień:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      
      // Stwórz preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      // Przygotuj dane do zapisania
      const dataToSave = {
        ...settings,
        logoBase64: logoPreview // Użyj preview (które może być nowym logo lub starym)
      };

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave)
      });

      if (response.ok) {
        alert("Ustawienia zapisane pomyślnie!");
        fetchSettings(); // Odśwież dane
      } else {
        alert("Błąd zapisywania ustawień");
      }
    } catch (error) {
      alert("Błąd zapisywania ustawień");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (settings) {
      setSettings({ ...settings, logoBase64: null });
    }
  };

  if (isLoading) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Ładowanie...</main>;
  }

  if (!settings) {
    return <main className="container" style={{ paddingTop: "var(--spacing-xl)" }}>Błąd ładowania ustawień.</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <h1>⚙️ Ustawienia firmowe</h1>

      <div style={{ marginBottom: 20, display: "flex", gap: "12px", alignItems: "center" }}>
        <Link href="/">← Wróć do strony głównej</Link>
        <Link href="/settings/performance" style={{ 
          padding: "8px 16px", 
          backgroundColor: "#0056b3", 
          color: "white", 
          borderRadius: 4, 
          textDecoration: "none" 
        }}>
          ⚡ Ustawienia wydajności skrzynek
        </Link>
      </div>

      <div style={{ backgroundColor: "#f8f9fa", padding: 20, borderRadius: 8, marginBottom: 20 }}>
        
        {/* Logo firmy */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #ddd" }}>
          <h3>🏢 Logo firmy</h3>
          <div style={{ marginBottom: 16 }}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleLogoChange}
              style={{ marginBottom: 12 }}
            />
            <p style={{ fontSize: "12px", color: "#666" }}>
              Obsługiwane formaty: PNG, JPG. Logo będzie wbudowane w email.
            </p>
          </div>

          {logoPreview && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontWeight: "bold", marginBottom: 8 }}>Podgląd:</p>
              <img
                src={logoPreview}
                alt="Logo preview"
                style={{ maxWidth: 300, maxHeight: 150, border: "1px solid #ddd", borderRadius: 4 }}
              />
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={handleRemoveLogo}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Usuń logo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Adres firmy */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #ddd" }}>
          <h3>📍 Adres firmy</h3>
          <textarea
            value={settings.address || ""}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            rows={4}
            style={{
              width: "100%",
              padding: 12,
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: "14px",
              fontFamily: "monospace"
            }}
            placeholder="**Showroom & Office & Production:**&#10;ul. Bukowska 16&#10;62-081 Wysogotowo, PL"
          />
          <p style={{ fontSize: "12px", color: "#666", marginTop: 8 }}>
            Możesz użyć **tekst** aby pogrubić.
          </p>
        </div>

        {/* Disclaimers wielojęzyczne */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #ddd" }}>
          <h3>💬 Tekst "W razie braku zainteresowania..." (wielojęzyczny)</h3>
          <p style={{ fontSize: "13px", color: "#666", marginBottom: 16 }}>
            Odpowiedni tekst zostanie automatycznie wybrany na podstawie języka odbiorcy.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
              🇵🇱 Polski:
            </label>
            <input
              type="text"
              value={settings.disclaimerPl || ""}
              onChange={(e) => setSettings({ ...settings, disclaimerPl: e.target.value })}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: "14px"
              }}
              placeholder="W razie braku zainteresowania proszę o informację – nie będę się już kontaktować."
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
              🇬🇧 English:
            </label>
            <input
              type="text"
              value={settings.disclaimerEn || ""}
              onChange={(e) => setSettings({ ...settings, disclaimerEn: e.target.value })}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: "14px"
              }}
              placeholder="In case of no interest, please let me know – I will not contact you again."
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
              🇩🇪 Deutsch:
            </label>
            <input
              type="text"
              value={settings.disclaimerDe || ""}
              onChange={(e) => setSettings({ ...settings, disclaimerDe: e.target.value })}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: "14px"
              }}
              placeholder="Bei fehlendem Interesse bitte ich um eine Nachricht – ich werde Sie nicht mehr kontaktieren."
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
              🇫🇷 Français:
            </label>
            <input
              type="text"
              value={settings.disclaimerFr || ""}
              onChange={(e) => setSettings({ ...settings, disclaimerFr: e.target.value })}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 4,
                fontSize: "14px"
              }}
              placeholder="En cas d'absence d'intérêt, veuillez m'en informer – je ne vous contacterai plus."
            />
          </div>
        </div>

        {/* Stopka prawna */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #ddd" }}>
          <h3>⚖️ Stopka prawna</h3>
          <textarea
            value={settings.legalFooter || ""}
            onChange={(e) => setSettings({ ...settings, legalFooter: e.target.value })}
            rows={6}
            style={{
              width: "100%",
              padding: 12,
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: "13px"
            }}
            placeholder="The content of this message is confidential..."
          />
        </div>

        {/* Forward Email */}
        <div style={{ marginBottom: 24 }}>
          <h3>📧 Email do powiadomień</h3>
          <input
            type="email"
            value={settings.forwardEmail || ""}
            onChange={(e) => setSettings({ ...settings, forwardEmail: e.target.value })}
            style={{
              width: "100%",
              padding: 12,
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: "14px"
            }}
            placeholder="bartosz.kosiba@kreativia.pl"
          />
          <p style={{ fontSize: "12px", color: "#666", marginTop: 8 }}>
            Na ten adres będą przesyłane:
            <br />• Odpowiedzi zainteresowanych klientów (pełna konwersacja)
            <br />• Powiadomienia o zablokowanych kontaktach
            <br />• Informacje o nowo dodanych zastępcach
          </p>
        </div>

        {/* Przycisk zapisu */}
        <div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "12px 24px",
              backgroundColor: isSaving ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: isSaving ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "bold"
            }}
          >
            {isSaving ? "Zapisuję..." : "💾 Zapisz ustawienia"}
          </button>
        </div>
      </div>

      {/* Informacje */}
      <div style={{ backgroundColor: "#e8f4fd", padding: 16, borderRadius: 8 }}>
        <h3>ℹ️ Jak to działa?</h3>
        <ul>
          <li><strong>Logo</strong> - będzie wbudowane w każdy email (między PS. a adresem firmy)</li>
          <li><strong>Adres firmy</strong> - wyświetlany w stopce każdego maila</li>
          <li><strong>Disclaimer wielojęzyczny</strong> - automatycznie dopasowywany do języka odbiorcy</li>
          <li><strong>Stopka prawna</strong> - zawsze na końcu maila</li>
        </ul>
      </div>

      {/* Danger Zone - Reset Database */}
      <ResetDatabase />
    </main>
  );
}

// Komponent Reset Database
function ResetDatabase() {
  const [isResetting, setIsResetting] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = async () => {
    if (confirmationCode !== "RESET") {
      alert("Błąd: Musisz wpisać 'RESET' aby potwierdzić!");
      return;
    }

    const finalConfirm = confirm(
      "⚠️ OSTATNIE OSTRZEŻENIE!\n\n" +
      "Czy NA PEWNO chcesz usunąć:\n" +
      "- Wszystkie kampanie\n" +
      "- Wszystkie leady\n" +
      "- Cały inbox\n" +
      "- Wszystkie logi wysyłek\n\n" +
      "TEJ AKCJI NIE MOŻNA COFNĄĆ!\n\n" +
      "Kliknij OK aby kontynuować lub Anuluj aby przerwać."
    );

    if (!finalConfirm) {
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch("/api/admin/reset-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationCode })
      });

      if (response.ok) {
        const data = await response.json();
        alert(
          `✅ Baza danych zresetowana pomyślnie!\n\n` +
          `📧 Serwer IMAP:\n` +
          `- Oznaczono ${data.stats.markedEmailsOnServer} maili jako przeczytane\n\n` +
          `Usunięto z bazy:\n` +
          `- ${data.stats.deletedCampaigns} kampanii\n` +
          `- ${data.stats.deletedLeads} leadów\n` +
          `- ${data.stats.deletedReplies} odpowiedzi z inbox\n` +
          `- ${data.stats.deletedSendLogs} logów wysyłek\n` +
          `- ${data.stats.deletedCampaignLeads} powiązań leadów z kampaniami\n` +
          `- ${data.stats.deletedLeadTags} powiązań leadów z tagami\n\n` +
          `✅ Od teraz system będzie pobierał tylko NOWE maile!`
        );
        setShowConfirm(false);
        setConfirmationCode("");
        
        // Odśwież stronę
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`❌ Błąd: ${error.error}`);
      }
    } catch (error) {
      console.error("Błąd resetowania bazy:", error);
      alert("❌ Wystąpił błąd podczas resetowania bazy danych");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div style={{ 
      marginTop: 40, 
      padding: 24, 
      backgroundColor: "#fff5f5", 
      border: "2px solid #dc3545",
      borderRadius: 8 
    }}>
      <h2 style={{ color: "#dc3545", marginTop: 0 }}>⚠️ DANGER ZONE - Resetowanie bazy testowej</h2>
      <p style={{ color: "#721c24", marginBottom: 16 }}>
        <strong>UWAGA:</strong> Ta akcja usunie WSZYSTKIE dane z bazy (kampanie, leady, inbox, logi).
        Użyj tylko do testów! Ta akcja jest <strong>NIEODWRACALNA</strong>.
      </p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            padding: "12px 24px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold"
          }}
        >
          Resetuj bazę danych
        </button>
      ) : (
        <div style={{ 
          padding: 20, 
          backgroundColor: "white", 
          border: "2px solid #dc3545",
          borderRadius: 8 
        }}>
          <h3 style={{ color: "#dc3545", marginTop: 0 }}>Potwierdzenie resetowania</h3>
          <p style={{ marginBottom: 16 }}>
            Wpisz <code style={{ 
              backgroundColor: "#f8d7da", 
              padding: "2px 8px", 
              borderRadius: 4,
              color: "#721c24",
              fontWeight: "bold"
            }}>RESET</code> aby potwierdzić:
          </p>
          
          <input
            type="text"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            placeholder="Wpisz RESET"
            style={{
              width: "100%",
              padding: 12,
              border: "2px solid #dc3545",
              borderRadius: 4,
              fontSize: "16px",
              marginBottom: 16,
              fontWeight: "bold"
            }}
          />

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleReset}
              disabled={isResetting || confirmationCode !== "RESET"}
              style={{
                padding: "12px 24px",
                backgroundColor: confirmationCode === "RESET" ? "#dc3545" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: confirmationCode === "RESET" ? "pointer" : "not-allowed",
                fontSize: "16px",
                fontWeight: "bold",
                opacity: confirmationCode === "RESET" ? 1 : 0.5
              }}
            >
              {isResetting ? "Resetuję..." : "✓ Potwierdź reset"}
            </button>
            
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmationCode("");
              }}
              disabled={isResetting}
              style={{
                padding: "12px 24px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold"
              }}
            >
              Anuluj
            </button>
          </div>

          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            backgroundColor: "#f8d7da",
            borderRadius: 4,
            fontSize: "13px",
            color: "#721c24"
          }}>
            <strong>Co zostanie usunięte:</strong>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li>Wszystkie kampanie (i ich powiązania)</li>
              <li>Wszystkie leady (łącznie z "Nowy kontakt")</li>
              <li>Cały inbox (wszystkie odpowiedzi)</li>
              <li>Wszystkie logi wysyłek</li>
              <li>Wszystkie powiązania leadów z tagami</li>
            </ul>
            <br />
            <strong>Co zostanie zachowane:</strong>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li>Wirtualni handlowcy</li>
              <li>Tagi</li>
              <li>Ustawienia firmy</li>
              <li>Święta (cache)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
