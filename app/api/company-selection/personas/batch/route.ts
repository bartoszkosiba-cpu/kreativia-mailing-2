import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Pobiera weryfikacje person dla wielu firm
 * GET /api/company-selection/personas/batch?companyIds=1,2,3&personaCriteriaId=5
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const companyIdsParam = searchParams.get("companyIds");
    const personaCriteriaIdParam = searchParams.get("personaCriteriaId");

    if (!companyIdsParam) {
      return NextResponse.json({ success: false, error: "companyIds jest wymagane" }, { status: 400 });
    }

    const companyIds = companyIdsParam
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (companyIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Obsłuż "null" jako string (gdy frontend wysyła "null" dla weryfikacji bez kryteriów AI)
    const personaCriteriaId = personaCriteriaIdParam === "null" || personaCriteriaIdParam === null
      ? null
      : (Number.isFinite(Number(personaCriteriaIdParam)) ? Number(personaCriteriaIdParam) : null);

    // Pobierz weryfikacje dla wybranych kryteriów (lub null dla Apollo)
    const verifications = await db.personaVerificationResult.findMany({
      where: {
        companyId: { in: companyIds },
        personaCriteriaId: personaCriteriaId ?? null, // Filtruj po personaCriteriaId
      },
      select: {
        companyId: true,
        personaCriteriaId: true,
        positiveCount: true,
        negativeCount: true,
        unknownCount: true,
        verifiedAt: true,
        metadata: true,
        employees: true, // Potrzebne do policzenia person z dostępnym e-mailem
      },
    });

    // Jeśli pobieramy dane z Apollo (personaCriteriaId=null), sprawdź też, czy firmy mają jakąkolwiek weryfikację AI
    // (aby pokazać "Tak (inne)" dla firm, które mają weryfikację AI, ale nie dla wybranych kryteriów)
    let hasAnyAIVerification: Map<number, boolean> = new Map();
    let companiesWithOnlyAI: Map<number, any> = new Map(); // Firmy, które mają tylko weryfikację AI (bez danych z Apollo)
    
    if (personaCriteriaId === null) {
      // Pobierz wszystkie weryfikacje AI (nie Apollo) dla tych firm
      const aiVerifications = await db.personaVerificationResult.findMany({
        where: {
          companyId: { in: companyIds },
          personaCriteriaId: { not: null }, // Wszystkie weryfikacje AI (nie Apollo)
        },
        select: {
          companyId: true,
          personaCriteriaId: true,
          positiveCount: true,
          negativeCount: true,
          unknownCount: true,
          verifiedAt: true,
          metadata: true,
          employees: true,
        },
        orderBy: {
          verifiedAt: 'desc', // Najnowsza weryfikacja
        },
      });
      
      // Grupuj po companyId i weź najnowszą weryfikację dla każdej firmy
      const latestAIVerification = new Map<number, any>();
      aiVerifications.forEach((v) => {
        if (!latestAIVerification.has(v.companyId)) {
          latestAIVerification.set(v.companyId, v);
          hasAnyAIVerification.set(v.companyId, true);
        }
      });
      
      // Sprawdź, które firmy mają tylko weryfikację AI (nie mają danych z Apollo)
      const companiesWithApollo = new Set(verifications.map(v => v.companyId));
      latestAIVerification.forEach((v, companyId) => {
        if (!companiesWithApollo.has(companyId)) {
          // Firma ma tylko weryfikację AI, bez danych z Apollo
          companiesWithOnlyAI.set(companyId, v);
        }
      });
    }

    // Funkcja pomocnicza do sprawdzania, czy email jest dostępny
    const hasAvailableEmail = (person: any): boolean => {
      // Email jest dostępny jeśli:
      // 1. Ma faktyczny adres email
      // 2. Lub emailUnlocked === true
      // 3. Lub emailStatus jest w: "verified", "guessed", "unverified", "extrapolated", "available"
      // Dla bezpłatnego API (/mixed_people/api_search) mamy emailStatus: "available" (z has_email: true)
      if (person.email) return true;
      if (person.emailUnlocked) return true;
      const status = (person.emailStatus || person.email_status || person.contact_email_status)?.toLowerCase();
      return status === "verified" || status === "guessed" || status === "unverified" || status === "extrapolated" || status === "available";
    };

    // Utwórz mapę companyId -> verification
    const verificationMap = new Map(
      verifications.map((v) => {
        let availableEmailCount = 0;
        
        // Policz persony z dostępnym e-mailem
        if (v.employees) {
          try {
            const employees = typeof v.employees === "string" ? JSON.parse(v.employees) : v.employees;
            if (Array.isArray(employees)) {
              availableEmailCount = employees.filter(hasAvailableEmail).length;
            }
          } catch (error) {
            // Jeśli nie można sparsować employees, zostaw 0
            console.error(`[personas/batch] Błąd parsowania employees dla companyId ${v.companyId}:`, error);
          }
        }
        
        // Jeśli pobieramy dane z Apollo (personaCriteriaId=null), ale firma ma weryfikację AI,
        // ustaw personaCriteriaId na -1 (specjalna wartość oznaczająca "ma weryfikację AI, ale nie dla wybranych kryteriów")
        let finalPersonaCriteriaId = v.personaCriteriaId;
        if (personaCriteriaId === null && hasAnyAIVerification.get(v.companyId)) {
          // Firma ma weryfikację AI, ale nie dla wybranych kryteriów (bo pobieramy dane z Apollo)
          // Ustaw specjalną wartość, aby frontend wiedział, że firma ma weryfikację AI
          finalPersonaCriteriaId = -1; // -1 oznacza "ma weryfikację AI, ale nie dla wybranych kryteriów"
        }
        
        return [
          v.companyId,
          {
            personaCriteriaId: finalPersonaCriteriaId,
            positiveCount: v.positiveCount,
            negativeCount: v.negativeCount,
            unknownCount: v.unknownCount,
            totalCount: v.positiveCount + v.negativeCount + v.unknownCount,
            availableEmailCount, // Liczba person z dostępnym e-mailem
            verifiedAt: v.verifiedAt,
            metadata: v.metadata ? JSON.parse(v.metadata) : null,
          },
        ];
      })
    );

    // Dodaj firmy, które mają tylko weryfikację AI (bez danych z Apollo)
    companiesWithOnlyAI.forEach((v, companyId) => {
      let availableEmailCount = 0;
      
      // Policz persony z dostępnym e-mailem
      if (v.employees) {
        try {
          const employees = typeof v.employees === "string" ? JSON.parse(v.employees) : v.employees;
          if (Array.isArray(employees)) {
            availableEmailCount = employees.filter(hasAvailableEmail).length;
          }
        } catch (error) {
          console.error(`[personas/batch] Błąd parsowania employees dla companyId ${companyId}:`, error);
        }
      }
      
      verificationMap.set(companyId, {
        personaCriteriaId: -1, // -1 oznacza "ma weryfikację AI, ale nie dla wybranych kryteriów"
        positiveCount: v.positiveCount,
        negativeCount: v.negativeCount,
        unknownCount: v.unknownCount,
        totalCount: v.positiveCount + v.negativeCount + v.unknownCount,
        availableEmailCount,
        verifiedAt: v.verifiedAt,
        metadata: v.metadata ? JSON.parse(v.metadata) : null,
      });
    });

    return NextResponse.json({
      success: true,
      data: Object.fromEntries(verificationMap),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: "Błąd pobierania weryfikacji person", details: err.message },
      { status: 500 }
    );
  }
}

