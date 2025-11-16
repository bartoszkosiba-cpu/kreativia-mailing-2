"use client";

import Link from "next/link";

const containerStyle = {
  padding: "2rem",
  display: "flex",
  flexDirection: "column" as const,
  gap: "2rem",
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

const gridStyle = {
  display: "grid",
  gap: "1.25rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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

const checklistStyle = {
  borderRadius: "0.75rem",
  border: "1px solid #E5E7EB",
  padding: "1.25rem",
  backgroundColor: "#F9FAFB",
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.65rem",
};

export default function SelectionsProcessPage() {
  return (
    <div style={containerStyle}>
      <div>
        <div style={breadcrumbsStyle}>Proces 2</div>
        <h1 style={headingStyle}>Selekcje tematyczne</h1>
        <p style={introStyle}>
          W tym etapie przygotowujemy bazy pod konkretne potrzeby – np. wykonawców stoisk targowych. Pracujemy na
          przefiltrowanej bazie, oglądamy firmę po firmie i zapisujemy pakiety, które będą weryfikowane oraz przekazane
          dalej.
        </p>
      </div>

      <div style={gridStyle}>
        <section style={cardStyle}>
          <Link href="/company-selection/selections" style={titlePrimaryLinkStyle}>
            Zapisane selekcje
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Podgląd wszystkich utworzonych baz. Sprawdzisz tutaj statystyki, aktywne kryteria oraz status pracy dla
            każdej selekcji.
          </p>
        </section>

        <section style={cardStyle}>
          <Link href="/company-selection/selections?create=1" style={titleSecondaryLinkStyle}>
            Utwórz nową bazę
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Uruchom kreator, wybierz filtry (segment, branża, import) i zapisz nową bazę tematyczną. Podgląd wyników
            pokaże dokładnie, które firmy wejdą do selekcji.
          </p>
        </section>
      </div>

      <section style={checklistStyle}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Checklista procesu</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#4B5563", lineHeight: 1.6 }}>
          <li>Zdefiniuj cel selekcji (np. typ klientów, rynek, język komunikacji).</li>
          <li>Użyj filtrów, aby wybrać firmy najbardziej pasujące do celu.</li>
          <li>Oceń podgląd – usuń rekordy, które nie pasują.</li>
          <li>Zapisz selekcję i dodaj opis, aby zespół wiedział, do czego służy.</li>
        </ul>
      </section>
    </div>
  );
}
