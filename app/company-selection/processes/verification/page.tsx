"use client";

import Link from "next/link";

const containerStyle = {
  padding: "2rem",
  display: "flex",
  flexDirection: "column" as const,
  gap: "2rem",
};

const headingStyle = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#111827",
};

const introStyle = {
  fontSize: "1rem",
  lineHeight: 1.6,
  color: "#374151",
  maxWidth: "720px",
};

const gridStyle = {
  display: "grid",
  gap: "1.25rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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
};

const linkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.65rem 1.2rem",
  borderRadius: "0.65rem",
  backgroundColor: "#10B981",
  color: "white",
  fontWeight: 600,
  textDecoration: "none",
};

const secondaryLinkStyle = {
  ...linkStyle,
  backgroundColor: "#059669",
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
    <div style={containerStyle}>
      <div>
        <div style={{ fontSize: "0.85rem", color: "#6B7280", marginBottom: "0.5rem" }}>Proces 3</div>
        <h1 style={headingStyle}>Weryfikacja & Lead export</h1>
        <p style={introStyle}>
          Trzeci etap służy pracy na jednej, wybranej selekcji. Weryfikujemy firmy, przygotowujemy persony i tworzymy
          finalną bazę leadów do modułu Mailing. To tutaj podejmujemy decyzje o kwalifikacji i gotowości do kampanii.
        </p>
      </div>

      <div style={gridStyle}>
        <section style={cardStyle}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>Weryfikacja firm</h2>
            <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
              Wybierz selekcję, zobacz statusy i odpal weryfikację AI. Panel pokazuje progres, wyniki i pozwala ręcznie
              poprawić decyzje.
            </p>
          </div>
          <Link href="/company-selection/verify" style={linkStyle}>
            Przejdź do weryfikacji
          </Link>
        </section>

        <section style={cardStyle}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>Persony i leady</h2>
            <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
              Po weryfikacji przygotuj persony dla najciekawszych firm. Na podstawie wyników wygeneruj listę kontaktów,
              która trafi do Mailingu.
            </p>
          </div>
          <Link href="/company-selection/personas" style={secondaryLinkStyle}>
            Otwórz moduł person
          </Link>
        </section>

        <section style={cardStyle}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>Eksport leadów</h2>
            <p style={{ fontSize: "0.95rem", color: "#4B5563", lineHeight: 1.6 }}>
              (W przygotowaniu) – docelowo wygenerujesz tutaj paczkę leadów do Mailingu lub pobierzesz je do CSV.
              Aktualnie proces kończy się na module person.
            </p>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.65rem 1.2rem",
              borderRadius: "0.65rem",
              backgroundColor: "#D1D5DB",
              color: "#1F2937",
              fontWeight: 600,
            }}
          >
            W budowie
          </span>
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
