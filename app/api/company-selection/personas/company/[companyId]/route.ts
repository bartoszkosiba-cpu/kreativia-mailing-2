import { NextRequest, NextResponse } from "next/server";
import { getPersonaVerification, deletePersonaVerification } from "@/services/personaVerificationService";

function parseCompanyId(raw: string | string[] | undefined): number | null {
  if (!raw || Array.isArray(raw)) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function GET(req: NextRequest, { params }: { params: { companyId: string } }) {
  const companyId = parseCompanyId(params.companyId);
  if (companyId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID firmy" }, { status: 400 });
  }

  // Pobierz personaCriteriaId z query params (opcjonalne)
  // Obsłuż "null" jako string (gdy frontend wysyła "null" dla weryfikacji bez kryteriów AI)
  const personaCriteriaIdParam = req.nextUrl.searchParams.get("personaCriteriaId");
  const personaCriteriaId = personaCriteriaIdParam === "null" || personaCriteriaIdParam === null
    ? null
    : (Number.isFinite(Number(personaCriteriaIdParam)) ? Number(personaCriteriaIdParam) : null);

  try {
    const result = await getPersonaVerification(companyId, personaCriteriaId);
    if (!result) {
      // Zwróć 200 z pustymi danymi zamiast 404 - to jest normalna sytuacja (brak weryfikacji)
      // Frontend sprawdza `data === null` aby wiedzieć, że nie ma weryfikacji
      return NextResponse.json({ success: true, data: null });
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

    // Policz persony z dostępnym e-mailem
    let availableEmailCount = 0;
    if (result.employees) {
      try {
        const employees = typeof result.employees === "string" ? JSON.parse(result.employees) : result.employees;
        if (Array.isArray(employees)) {
          availableEmailCount = employees.filter(hasAvailableEmail).length;
        }
      } catch (error) {
        // Jeśli nie można sparsować employees, zostaw 0
        console.error(`[personas/company] Błąd parsowania employees dla companyId ${companyId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        companyId,
        personaCriteriaId: result.personaCriteriaId,
        positiveCount: result.positiveCount,
        negativeCount: result.negativeCount,
        unknownCount: result.unknownCount,
        availableEmailCount,
        verifiedAt: result.verifiedAt,
        employees: JSON.parse(result.employees),
        metadata: result.metadata ? JSON.parse(result.metadata) : null,
      },
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error("Błąd pobierania weryfikacji person:", errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania weryfikacji person", details: errorObj.message },
      { status: 500 }
    );
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { companyId: string } }) {
  const companyId = parseCompanyId(params.companyId);
  if (companyId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID firmy" }, { status: 400 });
  }

  await deletePersonaVerification(companyId);
  return NextResponse.json({ success: true });
}

