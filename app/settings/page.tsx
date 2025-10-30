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
    <div className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ marginBottom: "var(--spacing-2xl)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2.5rem", marginBottom: "var(--spacing-sm)" }}>
            Ustawienia firmowe
          </h1>
          <p style={{ fontSize: "1.1rem", color: "var(--gray-600)" }}>
            Konfiguracja danych firmy, logo, disclaimerów i powiadomień
          </p>
        </div>
        <Link 
          href="/settings/performance"
          className="btn"
          style={{
            backgroundColor: "var(--primary)",
            color: "white",
            textDecoration: "none",
            fontWeight: "600",
            padding: "12px 24px"
          }}
        >
          Ustawienia wydajności skrzynek
        </Link>
      </div>

      <div className="card" style={{ marginBottom: "var(--spacing-2xl)" }}>
        
        {/* Logo firmy */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid var(--gray-200)" }}>
          <h3 style={{ marginTop: 0 }}>Logo firmy</h3>
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
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid var(--gray-200)" }}>
          <h3 style={{ marginTop: 0 }}>Adres firmy</h3>
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
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid var(--gray-200)" }}>
          <h3 style={{ marginTop: 0 }}>Tekst "W razie braku zainteresowania..." (wielojęzyczny)</h3>
          <p style={{ fontSize: "13px", color: "#666", marginBottom: 16 }}>
            Odpowiedni tekst zostanie automatycznie wybrany na podstawie języka odbiorcy.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
              Polski:
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
              English:
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
              Deutsch:
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
              Français:
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
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid var(--gray-200)" }}>
          <h3 style={{ marginTop: 0 }}>Stopka prawna</h3>
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
          <h3 style={{ marginTop: 0 }}>Email do powiadomień</h3>
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
            className="btn"
            style={{
              backgroundColor: isSaving ? "#ccc" : "var(--success)",
              color: "white",
              border: "none",
              fontWeight: "600",
              padding: "12px 24px"
            }}
          >
            {isSaving ? "Zapisuję..." : "Zapisz ustawienia"}
          </button>
        </div>
      </div>

      {/* Informacje */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Jak to działa?</h3>
        <ul style={{ margin: 0, paddingLeft: "20px" }}>
          <li style={{ marginBottom: "8px" }}><strong>Logo</strong> - będzie wbudowane w każdy email (między PS. a adresem firmy)</li>
          <li style={{ marginBottom: "8px" }}><strong>Adres firmy</strong> - wyświetlany w stopce każdego maila</li>
          <li style={{ marginBottom: "8px" }}><strong>Disclaimer wielojęzyczny</strong> - automatycznie dopasowywany do języka odbiorcy</li>
          <li style={{ marginBottom: "8px" }}><strong>Stopka prawna</strong> - zawsze na końcu maila</li>
        </ul>
      </div>
    </div>
  );
}

