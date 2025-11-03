import { db } from "@/lib/db";
import MaterialDecisionsClient from "./MaterialDecisionsClient";

export default async function MaterialDecisionsPage() {
  // Pobierz wszystkie decyzje (również przetworzone, do debugowania)
  const allDecisions = await db.pendingMaterialDecision.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });

  // Oczekujące decyzje (PENDING)
  const decisions = await db.pendingMaterialDecision.findMany({
    where: {
      status: 'PENDING'
    },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true
        }
      },
      campaign: {
        select: {
          id: true,
          name: true
        }
      },
      reply: {
        select: {
          id: true,
          fromEmail: true,
          subject: true,
          content: true,
          createdAt: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // ✅ HISTORIA: Wysłane odpowiedzi z materiałami (ze wszystkich kampanii)
  const sentMaterialResponses = await db.materialResponse.findMany({
    where: {
      status: 'sent' // Tylko wysłane
    },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true
        }
      },
      campaign: {
        select: {
          id: true,
          name: true
        }
      },
      reply: {
        select: {
          id: true,
          subject: true,
          content: true,
          receivedAt: true
        }
      }
    },
    orderBy: [
      { sentAt: 'desc' }, // Najpierw sortuj po sentAt
      { createdAt: 'desc' } // Fallback na createdAt jeśli sentAt jest null
    ],
    take: 50 // Ostatnie 50 wysłanych
  });

  // Debug: Sprawdź czy są jakieś decyzje w bazie
  console.log(`[MATERIAL DECISIONS] PENDING decyzji: ${decisions.length}, wszystkich (ostatnie 10): ${allDecisions.length}`);
  if (allDecisions.length > 0) {
    console.log(`[MATERIAL DECISIONS] Przykładowe statusy:`, allDecisions.map(d => ({ id: d.id, status: d.status })));
  }

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Kolejka decyzji - Automatyczne odpowiedzi</h1>
      </div>

      {decisions.length === 0 && allDecisions.length > 0 && (
        <div style={{ padding: "20px", backgroundColor: "#fff3cd", borderRadius: "8px", marginBottom: "20px", border: "1px solid #ffc107" }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#856404" }}>
            Brak oczekujących decyzji (PENDING)
          </p>
          <p style={{ marginTop: "8px", margin: 0, fontSize: "14px", color: "#856404" }}>
            W bazie znajduje się {allDecisions.length} decyzji, ale wszystkie zostały już przetworzone (status: {allDecisions[0]?.status || 'N/A'}).
          </p>
        </div>
      )}

      {decisions.length === 0 && allDecisions.length === 0 && (
        <div style={{ padding: "20px", backgroundColor: "#e3f2fd", borderRadius: "8px", marginBottom: "20px", border: "1px solid #2196f3" }}>
          <p style={{ margin: 0, fontWeight: 600, color: "#1565c0", marginBottom: "12px" }}>
            Brak decyzji w kolejce
          </p>
          <p style={{ margin: 0, fontSize: "14px", color: "#1565c0", marginBottom: "8px" }}>
            Decyzje pojawiają się tutaj gdy:
          </p>
          <ul style={{ margin: "8px 0 0 20px", padding: 0, fontSize: "14px", color: "#1565c0" }}>
            <li>Kampania ma <strong>włączony moduł automatycznych odpowiedzi</strong> (ustawienia kampanii)</li>
            <li>Lead odpowiada z <strong>INTERESTED</strong> (zainteresowanie)</li>
            <li>AI rozpoznaje <strong>prośbę o materiały</strong> (katalog, cennik) z pewnością ≥ 60%</li>
          </ul>
          <p style={{ marginTop: "12px", margin: 0, fontSize: "13px", color: "#1565c0", fontStyle: "italic" }}>
            Sprawdź czy kampanie mają włączony moduł i czy przyszły odpowiedzi INTERESTED z prośbą o materiały.
          </p>
        </div>
      )}

      <MaterialDecisionsClient 
        initialDecisions={decisions} 
        sentMaterialResponses={sentMaterialResponses}
      />
    </main>
  );
}

