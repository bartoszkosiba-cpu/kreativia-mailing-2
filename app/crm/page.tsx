import { db } from "@/lib/db";

export default async function CRMDashboard() {
  // Pobierz statystyki leadów w CRM
  const crmLeadsCount = await db.lead.count({
    where: { inCRM: true }
  });

  const readyForSalesCount = await db.lead.count({
    where: { 
      inCRM: true,
      crmReadyForSales: true 
    }
  });

  const activeLeadsCount = await db.lead.count({
    where: { 
      inCRM: true,
      status: "ZAINTERESOWANY"
    }
  });

  const recentLeads = await db.lead.findMany({
    where: { inCRM: true },
    orderBy: { crmEnteredAt: 'desc' },
    take: 5,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      company: true,
      crmEnteredAt: true,
      crmReadyForSales: true
    }
  });

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ 
        fontSize: "32px", 
        fontWeight: "700", 
        marginBottom: "2rem",
        fontFamily: "'Montserrat', sans-serif"
      }}>
        Dashboard CRM
      </h1>

      {/* Statystyki */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "1.5rem",
        marginBottom: "2rem"
      }}>
        <div style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "8px",
          border: "1px solid var(--color-border)",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
        }}>
          <div style={{ fontSize: "14px", color: "#666", marginBottom: "0.5rem" }}>
            Leady w CRM
          </div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "var(--color-primary)" }}>
            {crmLeadsCount}
          </div>
        </div>

        <div style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "8px",
          border: "1px solid var(--color-border)",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
        }}>
          <div style={{ fontSize: "14px", color: "#666", marginBottom: "0.5rem" }}>
            Gotowi do przekazania
          </div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "#28a745" }}>
            {readyForSalesCount}
          </div>
        </div>

        <div style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "8px",
          border: "1px solid var(--color-border)",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
        }}>
          <div style={{ fontSize: "14px", color: "#666", marginBottom: "0.5rem" }}>
            Aktywni leady
          </div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: "#155724" }}>
            {activeLeadsCount}
          </div>
        </div>
      </div>

      {/* Ostatnie leady */}
      <div style={{
        background: "white",
        padding: "1.5rem",
        borderRadius: "8px",
        border: "1px solid var(--color-border)",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
      }}>
        <h2 style={{ 
          fontSize: "20px", 
          fontWeight: "600", 
          marginBottom: "1rem",
          fontFamily: "'Montserrat', sans-serif"
        }}>
          Ostatnio dodane do CRM
        </h2>

        {recentLeads.length === 0 ? (
          <p style={{ color: "#666" }}>Brak leadów w CRM</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>Imię i nazwisko</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>Email</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>Firma</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>Data dodania</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.75rem", fontSize: "14px" }}>
                    {lead.firstName || lead.lastName 
                      ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
                      : '-'}
                  </td>
                  <td style={{ padding: "0.75rem", fontSize: "14px" }}>{lead.email}</td>
                  <td style={{ padding: "0.75rem", fontSize: "14px" }}>{lead.company || '-'}</td>
                  <td style={{ padding: "0.75rem", fontSize: "14px", color: "#666" }}>
                    {lead.crmEnteredAt 
                      ? new Date(lead.crmEnteredAt).toLocaleDateString('pl-PL')
                      : '-'}
                  </td>
                  <td style={{ padding: "0.75rem", fontSize: "14px" }}>
                    {lead.crmReadyForSales ? (
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: "#28a745",
                        color: "white",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}>
                        Gotowy
                      </span>
                    ) : (
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: "#ffc107",
                        color: "#000",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}>
                        W trakcie
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Szybkie akcje */}
      <div style={{
        marginTop: "2rem",
        display: "flex",
        gap: "1rem"
      }}>
        <a 
          href="/crm/leads"
          style={{
            padding: "0.75rem 1.5rem",
            background: "var(--color-primary)",
            color: "white",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "600",
            fontSize: "14px",
            display: "inline-block"
          }}
        >
          Zobacz wszystkie leady →
        </a>
        <a 
          href="/crm/sequences"
          style={{
            padding: "0.75rem 1.5rem",
            background: "white",
            color: "var(--color-primary)",
            border: "1px solid var(--color-primary)",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "600",
            fontSize: "14px",
            display: "inline-block"
          }}
        >
          Zarządzaj sekwencjami →
        </a>
      </div>
    </div>
  );
}




