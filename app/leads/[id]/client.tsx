"use client";

import { useState } from "react";
import Link from "next/link";

// Funkcje pomocnicze do formatowania danych
const getIndustryName = (keywords: string | null): string => {
  if (!keywords) return "-";
  
  // Branża to teraz słowa kluczowe z CSV
  // Wyświetl pierwsze 50 znaków słów kluczowych
  if (keywords.length > 50) {
    return keywords.substring(0, 50) + "...";
  }
  
  return keywords;
};

const extractCityFromAddress = (companyCity: string | null): string => {
  // companyCity zawiera wartość z pola "State" z CSV
  // Wyświetl bezpośrednio (np. "Greater Poland Voivodeship", "Masovian Voivodeship")
  if (!companyCity) return "-";
  return companyCity;
};

const extractCountryFromAddress = (companyCountry: string | null): string => {
  // companyCountry zawiera wartość z pola "Company Address" z CSV
  // Wyciągnij tylko kraj z pełnego adresu
  if (!companyCountry) return "-";
  
  // Szukaj kraju w adresie (najczęściej na końcu)
  const countryPatterns = [
    /,\s*(Poland|Germany|France|United Kingdom|UK|USA|United States|Italy|Spain|Netherlands|Holland|Belgium|Austria|Switzerland|Czech Republic|Slovakia|Hungary|Romania|Bulgaria|Croatia|Slovenia|Serbia|Ukraine|Lithuania|Latvia|Estonia|Denmark|Sweden|Norway|Finland|Ireland|Portugal|Greece)$/i,
    /\b(Poland|Germany|France|United Kingdom|UK|USA|United States|Italy|Spain|Netherlands|Holland|Belgium|Austria|Switzerland|Czech Republic|Slovakia|Hungary|Romania|Bulgaria|Croatia|Slovenia|Serbia|Ukraine|Lithuania|Latvia|Estonia|Denmark|Sweden|Norway|Finland|Ireland|Portugal|Greece)\b/i
  ];
  
  for (const pattern of countryPatterns) {
    const match = companyCountry.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Jeśli nie znaleziono kraju, wyświetl pierwsze 40 znaków
  if (companyCountry.length > 40) {
    return companyCountry.substring(0, 40) + "...";
  }
  
  return companyCountry;
};

interface Lead {
  id: number;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  company: string | null;
  email: string;
  industry: string | null;
  keywords: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  companyCity: string | null;
  companyCountry: string | null;
  personalization: string | null;
  LeadTag: Array<{ id: number; tag: { id: number; name: string; color: string } }>;
  CampaignLead: Array<{ id: number; campaign: { id: number; name: string } }>;
}

export default function LeadDetailsClient({ lead }: { lead: Lead }) {
  const [personalization, setPersonalization] = useState(lead.personalization || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const generatePersonalization = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/personalize`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setPersonalization(data.personalization);
      } else {
        alert(`Błąd: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Błąd: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const savePersonalization = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/personalization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalization })
      });
      if (res.ok) {
        alert("Personalizacja zapisana!");
      } else {
        const data = await res.json();
        alert(`Błąd: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Błąd: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main>
      <h1>Szczegóły leada #{lead.id}</h1>
      <p>
        <Link href="/leads">← Wróć do bazy kontaktów</Link>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <div>
          <h2>Dane kontaktowe</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              <tr><td style={{ padding: 8, fontWeight: "bold" }}>Imię:</td><td style={{ padding: 8 }}>{lead.firstName || ""}</td></tr>
              <tr><td style={{ padding: 8, fontWeight: "bold" }}>Nazwisko:</td><td style={{ padding: 8 }}>{lead.lastName || ""}</td></tr>
              <tr><td style={{ padding: 8, fontWeight: "bold" }}>Stanowisko:</td><td style={{ padding: 8 }}>{lead.title || ""}</td></tr>
              <tr><td style={{ padding: 8, fontWeight: "bold" }}>Firma:</td><td style={{ padding: 8 }}>{lead.company || ""}</td></tr>
              <tr><td style={{ padding: 8, fontWeight: "bold" }}>Email:</td><td style={{ padding: 8 }}>{lead.email}</td></tr>
              <tr><td style={{ padding: 8, fontWeight: "bold" }}>Branża:</td><td style={{ padding: 8 }}>{getIndustryName(lead.industry)}</td></tr>
              <tr><td style={{ padding: 8, fontWeight: "bold" }}>Miasto:</td><td style={{ padding: 8 }}>{extractCityFromAddress(lead.companyCity)}</td></tr>
              <tr><td style={{ padding: 8, fontWeight: "bold" }}>Kraj:</td><td style={{ padding: 8 }}>{extractCountryFromAddress(lead.companyCountry)}</td></tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: 20 }}>Linki</h3>
          <p>
            {lead.websiteUrl && (
              <a href={lead.websiteUrl.startsWith("http") ? lead.websiteUrl : `https://${lead.websiteUrl}`} 
                 target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>
                🌐 Strona WWW
              </a>
            )}
            {lead.linkedinUrl && (
              <a href={lead.linkedinUrl.startsWith("http") ? lead.linkedinUrl : `https://${lead.linkedinUrl}`} 
                 target="_blank" rel="noreferrer">
                💼 LinkedIn
              </a>
            )}
          </p>

          {lead.keywords && (
            <>
              <h3>Słowa kluczowe</h3>
              <p style={{ fontSize: "14px", color: "#666" }}>{lead.keywords}</p>
            </>
          )}
        </div>

        <div>
          <h2>Personalizacja AI</h2>
          <div style={{ marginBottom: 10 }}>
            <button 
              onClick={generatePersonalization} 
              disabled={isGenerating}
              style={{ marginRight: 10, padding: 8 }}
            >
              {isGenerating ? "Generuję..." : "Wygeneruj personalizację"}
            </button>
            <button 
              onClick={savePersonalization} 
              disabled={isSaving || !personalization.trim()}
              style={{ padding: 8 }}
            >
              {isSaving ? "Zapisuję..." : "Zapisz"}
            </button>
          </div>
          
          <textarea
            value={personalization}
            onChange={(e) => setPersonalization(e.target.value)}
            placeholder="Personalizacja zostanie wygenerowana automatycznie lub możesz ją edytować ręcznie..."
            rows={6}
            style={{ width: "100%", padding: 8, marginBottom: 10 }}
          />
          
          <p style={{ fontSize: "12px", color: "#666" }}>
            AI generuje krótkie zdanie na podstawie imienia, firmy, branży i stanowiska. 
            Możesz to edytować i zapisać.
          </p>

          <h3 style={{ marginTop: 30 }}>Kampanie</h3>
          {lead.CampaignLead.length === 0 ? (
            <p>Brak kampanii</p>
          ) : (
            <ul>
              {lead.CampaignLead.map((cl) => (
                <li key={cl.id}>
                  <Link href={`/campaigns/${cl.campaign.id}`}>
                    {cl.campaign.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

