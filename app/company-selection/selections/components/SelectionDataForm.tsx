"use client";

import { MarketOption, LanguageOption } from "@/types/company-selection";
import { CSSProperties } from "react";

const MARKET_OPTIONS: Array<{ value: MarketOption; label: string }> = [
  { value: "PL", label: "Rynek PL" },
  { value: "DE", label: "Rynek DE" },
  { value: "FR", label: "Rynek FR" },
  { value: "EN", label: "Rynek EN / Global" },
];

const LANGUAGE_OPTIONS: Array<{ value: LanguageOption; label: string }> = [
  { value: "PL", label: "Polski" },
  { value: "EN", label: "English" },
  { value: "DE", label: "Deutsch" },
  { value: "FR", label: "Français" },
];

const cardStyle: CSSProperties = {
  backgroundColor: "white",
  borderRadius: "0.75rem",
  border: "1px solid #E5E7EB",
  padding: "1.5rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 600,
  marginBottom: "1rem",
  color: "#111827",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "0.35rem",
  fontWeight: 600,
  color: "#1F2937",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  border: "1px solid #D1D5DB",
  borderRadius: "0.5rem",
  fontSize: "0.95rem",
};

interface SelectionDataFormProps {
  name: string;
  description: string;
  market: MarketOption;
  language: LanguageOption;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onMarketChange: (value: MarketOption) => void;
  onLanguageChange: (value: LanguageOption) => void;
  disabled?: boolean;
}

/**
 * Formularz danych selekcji (nazwa, rynek, język, opis)
 */
export function SelectionDataForm({
  name,
  description,
  market,
  language,
  onNameChange,
  onDescriptionChange,
  onMarketChange,
  onLanguageChange,
  disabled = false,
}: SelectionDataFormProps) {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Dane selekcji</h2>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <label htmlFor="selection-name" style={labelStyle}>
            Nazwa selekcji *
          </label>
          <input
            id="selection-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Np. Wykonawcy stoisk targowych PL"
            style={inputStyle}
            disabled={disabled}
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="selection-market" style={labelStyle}>
            Rynek *
            <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#6B7280", marginLeft: "0.5rem" }}>
              Kraj lub region (PL, DE, FR, EN)
            </span>
          </label>
          <select
            id="selection-market"
            value={market}
            onChange={(e) => onMarketChange(e.target.value as MarketOption)}
            style={inputStyle}
            disabled={disabled}
            aria-required="true"
          >
            {MARKET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="selection-language" style={labelStyle}>
            Preferowany język
          </label>
          <select
            id="selection-language"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as LanguageOption)}
            style={inputStyle}
            disabled={disabled}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label htmlFor="selection-description" style={labelStyle}>
        Opis selekcji (opcjonalnie)
      </label>
      <textarea
        id="selection-description"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Krótko opisz, kogo zawiera baza i do czego będzie używana."
        style={{ ...inputStyle, minHeight: "90px" }}
        disabled={disabled}
      />
    </section>
  );
}

