"use client";

import Link from "next/link";
import { useMemo } from "react";

const cardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.75rem",
  padding: "1.5rem",
  borderRadius: "0.75rem",
  border: "1px solid #E5E7EB",
  backgroundColor: "white",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
  minHeight: "180px",
};

const titlePrimaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
  padding: "0.7rem 1.1rem",
  borderRadius: "0.65rem",
  backgroundColor: "#2563EB",
  color: "white",
  fontWeight: 700,
  fontSize: "1.05rem",
  textDecoration: "none",
};

const titleSecondaryLinkStyle = {
  ...titlePrimaryLinkStyle,
  backgroundColor: "#4B5563",
};

const gridStyle = {
  display: "grid",
  gap: "1.25rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const breadcrumbsStyle = {
  fontSize: "0.85rem",
  color: "#6B7280",
  marginBottom: "0.5rem",
};

const headingStyle = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#111827",
  marginBottom: "0.75rem",
};

const introStyle = {
  fontSize: "1rem",
  lineHeight: 1.6,
  color: "#374151",
  marginBottom: "1.75rem",
  maxWidth: "720px",
};

const checklistStyle = {
  borderRadius: "0.75rem",
  border: "1px solid #E5E7EB",
  padding: "1.25rem",
  backgroundColor: "#F9FAFB",
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.65rem",
};

export default function ImportProcessPage() {
  const steps = useMemo(
    () => [
      "Wgraj nowe rekordy CSV i sprawdź logi importu",
      "Uzupełnij brakujące dane (np. adresy www) i usuń duplikaty",
      "Zweryfikuj przypisaną klasę, subsegment oraz branżę",
      "Dodaj reguły dla nowych industry, jeśli pojawiły się w imporcie",
    ],
    []
  );

  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <div style={breadcrumbsStyle}>Proces 1</div>
        <h1 style={headingStyle}>Import i klasyfikacja</h1>
        <p style={introStyle}>
          Pierwszy krok odpowiada za utrzymanie kompletnej bazy firm. Wgrywamy rekordy, czyścimy dane i
          upewniamy się, że każda firma ma przypisaną klasę, specjalizację oraz branżę. Z tego procesu korzysta
          się zawsze, gdy pojawia się nowe źródło danych lub trzeba poprawić istniejące wpisy.
        </p>
      </div>

      <div style={gridStyle}>
        <section style={cardStyle}>
          <Link href="/company-selection/import-mass" style={titlePrimaryLinkStyle}>
            Import CSV
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Wgraj plik z listą firm. System waliduje dane, pokazuje logi i powody pominięcia. Gotowe wpisy trafiają
            automatycznie do bazy.
          </p>
        </section>

        <section style={cardStyle}>
          <Link href="/company-selection/overview" style={titleSecondaryLinkStyle}>
            Przegląd bazy
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Przeglądaj wszystkie firmy wraz z oznaczeniami klas, specjalizacji i branż. Wykorzystaj filtry, by znaleźć
            rekordy wymagające uwagi lub naprawić pojedyncze wpisy.
          </p>
        </section>

        <section style={cardStyle}>
          <Link href="/company-selection/settings" style={titleSecondaryLinkStyle}>
            Reguły klasyfikacji
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Zarządzaj katalogiem specjalizacji, regułami przypisującymi industry i propozycjami od AI. To tutaj
            utrzymujemy wiedzę o segmentacji.
          </p>
        </section>

        <section style={cardStyle}>
          <Link href="/company-selection/blocked" style={titleSecondaryLinkStyle}>
            Zablokowane firmy
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Przejrzyj listę firm w statusie blokady (NOT_INTERESTED, UNSUBSCRIBE) lub wyłączonych ręcznie i zdecyduj,
            czy przywrócić je do procesu.
          </p>
        </section>
      </div>

      <section style={checklistStyle}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Checklista procesu</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#4B5563", lineHeight: 1.6 }}>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
