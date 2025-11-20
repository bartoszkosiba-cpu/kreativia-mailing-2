import { NextRequest, NextResponse } from "next/server";
import { getPersonaCriteriaById } from "@/services/personaCriteriaService";
import { getPersonaBrief } from "@/services/personaBriefService";
import { getFullPromptText } from "@/services/personaVerificationAI";

function parsePersonaId(raw: string | string[] | undefined): number | null {
  if (!raw || Array.isArray(raw)) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * GET /api/company-selection/personas/[id]/prompt
 * Zwraca pełny prompt używany do analizy person przez AI
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const personaId = parsePersonaId(params.id);
  if (personaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID person" }, { status: 400 });
  }

  try {
    // Pobierz kryteria person
    const personaCriteria = await getPersonaCriteriaById(personaId);
    if (!personaCriteria) {
      return NextResponse.json({ success: false, error: "Nie znaleziono kryteriów person" }, { status: 404 });
    }

    // Pobierz brief (jeśli istnieje)
    // PersonaBrief jest powiązany z CompanyPersonaCriteria.id (nie companyCriteriaId)
    const brief = await getPersonaBrief(personaId);

    // Użyj zapisanego promptu jeśli istnieje, w przeciwnym razie wygeneruj
    let promptText: string;
    let isFromSaved: boolean;
    
    if (brief?.generatedPrompt) {
      promptText = brief.generatedPrompt;
      isFromSaved = true;
    } else {
      // Fallback: wygeneruj dynamicznie (dla kompatybilności wstecznej)
      promptText = getFullPromptText(personaCriteria, brief || undefined);
      isFromSaved = false;
    }

    return NextResponse.json({
      success: true,
      data: {
        promptText,
        personaCriteriaId: personaId,
        hasBrief: !!brief,
        isFromSaved,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[Prompt API] Błąd pobierania promptu dla personaCriteriaId=${personaId}:`, err);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania promptu", details: err.message },
      { status: 500 }
    );
  }
}

