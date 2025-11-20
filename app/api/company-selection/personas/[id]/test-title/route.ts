import { NextRequest, NextResponse } from "next/server";
import { getPersonaCriteriaById } from "@/services/personaCriteriaService";
import { getPersonaBrief } from "@/services/personaBriefService";
import { verifyEmployeesWithAI } from "@/services/personaVerificationAI";
import { analyseJobTitle } from "@/utils/jobTitleHelpers";

function buildEmployeeKey(person: any) {
  if (person.id) return String(person.id);
  return `${person.name || ""}|${person.title || ""}`.toLowerCase();
}

/**
 * Testowanie klasyfikacji pojedynczego stanowiska
 * POST /api/company-selection/personas/[id]/test-title
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const personaId = Number(params.id);
    if (!personaId || !Number.isFinite(personaId)) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe ID kryteriów person" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { title, model = "gpt-4o-mini" } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "Nazwa stanowiska jest wymagana" },
        { status: 400 }
      );
    }

    // Pobierz kryteria i brief
    const personaCriteria = await getPersonaCriteriaById(personaId);
    if (!personaCriteria) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono kryteriów person" },
        { status: 404 }
      );
    }

    const personaBrief = await getPersonaBrief(personaId);

    // Przygotuj dane testowe - symuluj pracownika z podanym stanowiskiem
    const analysis = analyseJobTitle(title);
    const testEmployee = {
      id: "test-1",
      matchKey: `test|${title.toLowerCase()}`,
      name: "Test Employee",
      title: title,
      titleNormalized: analysis.normalized,
      titleEnglish: analysis.english,
      departments: [],
      seniority: null,
      emailStatus: null,
      managesPeople: false,
      managesProcesses: false,
      isExecutive: false,
      semanticHint: null,
    };

    // Weryfikuj przez AI (bez cache dla testów)
    const aiResponse = await verifyEmployeesWithAI(
      personaCriteria,
      [testEmployee],
      personaBrief || undefined,
      false, // useCache = false dla testów
      model as "gpt-4o-mini" | "gpt-4o" // Użyj wybranego modelu
    );

    if (!aiResponse.results || aiResponse.results.length === 0) {
      return NextResponse.json(
        { success: false, error: "Brak wyniku z AI" },
        { status: 500 }
      );
    }

    const result = aiResponse.results[0];
    return NextResponse.json({
      success: true,
      result: {
        title: title,
        decision: result.decision,
        score: result.score,
        reason: result.reason,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[Test Title] Błąd", err);
    return NextResponse.json(
      { success: false, error: err.message || "Błąd podczas testowania stanowiska" },
      { status: 500 }
    );
  }
}

