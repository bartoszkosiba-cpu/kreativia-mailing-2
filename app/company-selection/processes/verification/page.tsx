"use client";

import Link from "next/link";

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

export default function VerificationProcessPage() {
  return (
    <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <div style={breadcrumbsStyle}>Proces 3</div>
        <h1 style={headingStyle}>Weryfikacja & Lead export</h1>
        <p style={introStyle}>
          Trzeci etap służy pracy na jednej, wybranej selekcji. Weryfikujemy firmy, przygotowujemy persony i tworzymy
          finalną bazę leadów do modułu Mailing. To tutaj podejmujemy decyzje o kwalifikacji i gotowości do kampanii.
        </p>
      </div>

      <div style={gridStyle}>
        <section style={cardStyle}>
          <Link href="/company-selection/verify" style={titlePrimaryLinkStyle}>
            Weryfikacja firm
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Wybierz selekcję, zobacz statusy i odpal weryfikację AI. Panel pokazuje progres, wyniki i pozwala ręcznie
            poprawić decyzje.
          </p>
        </section>

        <section style={cardStyle}>
          <Link href="/company-selection/criteria" style={titleSecondaryLinkStyle}>
            Ustawienia weryfikacji firm
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Skonfiguruj kryteria weryfikacji firm. Ustal prompt dla AI, progi pewności i słowa kluczowe. Możesz rozmawiać z agentem AI lub edytować kryteria ręcznie.
          </p>
        </section>

        <section style={cardStyle}>
          <Link href="/company-selection/verify-personas" style={titlePrimaryLinkStyle}>
            Weryfikacja person
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Wybierz selekcję i zweryfikuj persony (kontakty) w firmach. Panel pokazuje firmy pozostałe do weryfikacji person oraz pozwala przeprowadzić weryfikację AI.
          </p>
        </section>

        <section style={cardStyle}>
          <Link href="/company-selection/personas" style={titleSecondaryLinkStyle}>
            Ustawienia weryfikacji person
          </Link>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            Skonfiguruj kryteria weryfikacji person. Ustal które stanowiska, działy i poziomy seniority są odpowiednie do kontaktu w zakwalifikowanych firmach.
          </p>
        </section>

        <section style={cardStyle}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.7rem 1.1rem",
              borderRadius: "0.65rem",
              backgroundColor: "#D1D5DB",
              color: "#1F2937",
              fontWeight: 700,
              fontSize: "1.05rem",
            }}
          >
            Eksport leadów
          </span>
          <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
            (W przygotowaniu) – docelowo wygenerujesz tutaj paczkę leadów do Mailingu lub pobierzesz je do CSV.
            Aktualnie proces kończy się na module person.
          </p>
        </section>
      </div>

      <section style={checklistStyle}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Checklista procesu</h3>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#4B5563", lineHeight: 1.6 }}>
          <li>Wybierz selekcję i sprawdź statystyki (ile firm gotowych, ile do weryfikacji).</li>
          <li>Uruchom weryfikację AI, monitoruj progres i popraw decyzje, które wymagają uwagi.</li>
          <li>Dla zakwalifikowanych firm uruchom moduł person – wybierz najlepiej dopasowane kontakty.</li>
          <li>Przygotuj leady do przekazania do modułu Mailing (eksport automatyczny w przygotowaniu).</li>
        </ul>
      </section>
    </div>
  );
}
