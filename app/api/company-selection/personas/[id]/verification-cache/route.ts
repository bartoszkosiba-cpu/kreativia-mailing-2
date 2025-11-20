import { NextRequest, NextResponse } from "next/server";
import { getCachedDecisionsForCriteria, clearCacheForCriteria, deleteCachedDecision } from "@/services/personaTitleVerificationCache";

function parsePersonaId(raw: string | string[] | undefined): number | null {
  if (!raw || Array.isArray(raw)) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * GET /api/company-selection/personas/[id]/verification-cache
 * Pobiera wszystkie zapisane decyzje cache dla danego personaCriteriaId
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const personaId = parsePersonaId(params.id);
  if (personaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID person" }, { status: 400 });
  }

  try {
    const cache = await getCachedDecisionsForCriteria(personaId);
    // Loguj dla debugowania
    console.log(`[Cache API] Pobrano ${cache.length} wpisów cache dla personaCriteriaId=${personaId}`);
    return NextResponse.json({
      success: true,
      data: cache,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[Cache API] Błąd pobierania cache dla personaCriteriaId=${personaId}:`, err);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania cache", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/company-selection/personas/[id]/verification-cache
 * Usuwa cache dla danego personaCriteriaId (lub pojedynczy wpis jeśli podano cacheId w query)
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const personaId = parsePersonaId(params.id);
  if (personaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID person" }, { status: 400 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const cacheId = searchParams.get("cacheId");

    if (cacheId) {
      // Usuń pojedynczy wpis
      const cacheIdNum = Number(cacheId);
      if (!Number.isFinite(cacheIdNum)) {
        return NextResponse.json({ success: false, error: "Nieprawidłowe ID cache" }, { status: 400 });
      }
      await deleteCachedDecision(cacheIdNum);
      return NextResponse.json({ success: true, message: "Wpis cache został usunięty" });
    } else {
      // Usuń cały cache dla tego personaCriteriaId
      await clearCacheForCriteria(personaId);
      return NextResponse.json({ success: true, message: "Cache został wyczyszczony" });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: "Błąd usuwania cache", details: err.message },
      { status: 500 }
    );
  }
}

