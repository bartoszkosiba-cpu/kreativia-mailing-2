/**
 * Endpoint do pobierania pełnych danych osób z Apollo (ZUŻYWA KREDYTY!)
 * Powinien być wywoływany tylko gdy użytkownik chce pobrać email konkretnych osób
 */

import { NextRequest, NextResponse } from "next/server";
import { enrichPerson, enrichPeopleBulk } from "@/services/apolloService";
import { logger } from "@/services/logger";

/**
 * POST /api/company-selection/apollo/enrich
 * Pobiera pełne dane (email) dla wybranych osób
 * 
 * Body: {
 *   personIds: string[] - lista ID osób do wzbogacenia
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personIds } = body;

    if (!personIds || !Array.isArray(personIds) || personIds.length === 0) {
      return NextResponse.json(
        { error: "Musisz podać listę ID osób (personIds)" },
        { status: 400 }
      );
    }

    if (personIds.length > 100) {
      return NextResponse.json(
        { error: "Maksymalnie 100 osób na raz (ze względu na limity API)" },
        { status: 400 }
      );
    }

    logger.info("apollo", `Pobieranie pełnych danych dla ${personIds.length} osób (ZUŻYWA ${personIds.length} KREDYTÓW!)`);

    // Pobierz pełne dane dla wszystkich osób
    const enrichedPeople = await enrichPeopleBulk(personIds);

    logger.info("apollo", `Pobrano pełne dane dla ${enrichedPeople.length} osób`);

    return NextResponse.json({
      success: true,
      people: enrichedPeople,
      creditsUsed: enrichedPeople.length, // Liczba użytych kredytów
      message: `Pobrano dane dla ${enrichedPeople.length} osób. Zużyto ${enrichedPeople.length} kredytów.`,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo", "Błąd pobierania pełnych danych osób", null, errorObj);
    return NextResponse.json(
      {
        error: "Błąd pobierania pełnych danych osób",
        details: errorObj.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/company-selection/apollo/enrich?personId=xxx
 * Pobiera pełne dane (email) dla jednej osoby
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personId = searchParams.get("personId");

    if (!personId) {
      return NextResponse.json(
        { error: "Musisz podać personId" },
        { status: 400 }
      );
    }

    logger.info("apollo", `Pobieranie pełnych danych dla osoby: ${personId} (ZUŻYWA 1 KREDYT!)`);

    // Pobierz pełne dane dla jednej osoby
    const enrichedPerson = await enrichPerson(personId);

    logger.info("apollo", `Pobrano pełne dane dla osoby: ${personId}`);

    return NextResponse.json({
      success: true,
      person: enrichedPerson,
      creditsUsed: 1, // 1 kredyt za email
      message: "Pobrano pełne dane osoby. Zużyto 1 kredyt.",
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo", "Błąd pobierania pełnych danych osoby", null, errorObj);
    return NextResponse.json(
      {
        error: "Błąd pobierania pełnych danych osoby",
        details: errorObj.message,
      },
      { status: 500 }
    );
  }
}

