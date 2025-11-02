import { db } from "@/lib/db";
import MaterialDecisionsClient from "./MaterialDecisionsClient";

export default async function MaterialDecisionsPage() {
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

  return (
    <main className="container" style={{ paddingTop: "var(--spacing-xl)", paddingBottom: "var(--spacing-2xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Kolejka decyzji - Automatyczne odpowiedzi</h1>
      </div>

      <MaterialDecisionsClient initialDecisions={decisions} />
    </main>
  );
}

