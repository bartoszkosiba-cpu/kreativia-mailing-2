import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import { PersonaCriteriaPayload, upsertPersonaCriteriaById } from "@/services/personaCriteriaService";

/**
 * Pobierz listę wszystkich person lub konkretną personę
 * GET /api/company-selection/personas?id=123 - pobierz konkretną personę
 * GET /api/company-selection/personas - pobierz listę wszystkich person
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    // Jeśli podano ID, pobierz konkretną personę
    if (id) {
      const persona = await db.companyPersonaCriteria.findUnique({
        where: { id: parseInt(id) },
      });

      if (!persona) {
        return NextResponse.json({ success: false, error: "Nie znaleziono persony" }, { status: 404 });
      }

      // Pobierz companyCriteria osobno, jeśli istnieje
      let companyCriteria = null;
      if (persona.companyCriteriaId) {
        const criteria = await db.companyVerificationCriteria.findUnique({
          where: { id: persona.companyCriteriaId },
          select: { id: true, name: true },
        });
        companyCriteria = criteria;
      }

      return NextResponse.json({
        success: true,
        persona: {
          id: persona.id,
          companyCriteriaId: persona.companyCriteriaId,
          name: persona.name,
          description: persona.description,
          positiveRoles: JSON.parse(persona.positiveRoles || "[]"),
          negativeRoles: JSON.parse(persona.negativeRoles || "[]"),
          conditionalRules: persona.conditionalRules ? JSON.parse(persona.conditionalRules) : [],
          language: persona.language,
          chatHistory: persona.chatHistory ? JSON.parse(persona.chatHistory) : [],
          lastUserMessage: persona.lastUserMessage,
          lastAIResponse: persona.lastAIResponse,
          createdAt: persona.createdAt,
          updatedAt: persona.updatedAt,
          companyCriteria: companyCriteria,
        },
      });
    }

    // W przeciwnym razie pobierz listę wszystkich person
    // Sortuj po createdAt (najnowsze utworzone u góry)
    // Pobierz tylko potrzebne pola - nie pobieraj dużych pól JSON (chatHistory, positiveRoles, etc.)
    const allPersonas = await db.companyPersonaCriteria.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        companyCriteriaId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { createdAt: "desc" },
      ],
    });

    // Pobierz companyCriteria osobno tylko dla tych person, które mają companyCriteriaId
    const criteriaIds = allPersonas
      .map((p) => p.companyCriteriaId)
      .filter((id): id is number => id !== null);
    
    const criteriaMap = new Map<number, { id: number; name: string }>();
    if (criteriaIds.length > 0) {
      const criteria = await db.companyVerificationCriteria.findMany({
        where: { id: { in: criteriaIds } },
        select: { id: true, name: true },
      });
      criteria.forEach((c) => criteriaMap.set(c.id, c));
    }

    // Sortuj ponownie po stronie serwera, aby upewnić się, że daty są poprawnie posortowane
    // (niektóre daty mogą być zapisane jako timestampy, więc sortowanie SQL może być niepoprawne)
    const sortedPersonas = [...allPersonas].sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA; // desc - najnowsze u góry
    });

    return NextResponse.json({
      success: true,
      personas: sortedPersonas.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        companyCriteriaId: p.companyCriteriaId,
        companyCriteria: p.companyCriteriaId ? criteriaMap.get(p.companyCriteriaId) || null : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria", "Błąd pobierania person", null, errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania person", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Utwórz nową personę
 * POST /api/company-selection/personas
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      positiveRoles = [],
      negativeRoles = [],
      conditionalRules = [],
      language = "pl",
      companyCriteriaId,
      chatHistory,
      lastUserMessage,
      lastAIResponse,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nazwa jest wymagana" },
        { status: 400 }
      );
    }

    // Sprawdź czy companyCriteriaId istnieje (jeśli podano)
    if (companyCriteriaId) {
      const criteria = await db.companyVerificationCriteria.findUnique({
        where: { id: companyCriteriaId },
      });
      if (!criteria) {
        return NextResponse.json(
          { success: false, error: "Nie znaleziono kryteriów firm o podanym ID" },
          { status: 404 }
        );
      }
    }

    const payload: PersonaCriteriaPayload = {
      name,
      description: description || undefined,
      positiveRoles: Array.isArray(positiveRoles) ? positiveRoles : [],
      negativeRoles: Array.isArray(negativeRoles) ? negativeRoles : [],
      conditionalRules: Array.isArray(conditionalRules) ? conditionalRules : [],
      language: language || "pl",
      chatHistory: Array.isArray(chatHistory) ? chatHistory : undefined,
      lastUserMessage: typeof lastUserMessage === "string" ? lastUserMessage : undefined,
      lastAIResponse: typeof lastAIResponse === "string" ? lastAIResponse : undefined,
    };

    // Utwórz personę bez companyCriteriaId (niezależną)
    // Jeśli podano chatHistory, kopiujemy go (dla kopii persony)
    const persona = await db.companyPersonaCriteria.create({
      data: {
        companyCriteriaId: companyCriteriaId || null,
        name: payload.name,
        description: payload.description || null,
        positiveRoles: JSON.stringify(payload.positiveRoles),
        negativeRoles: JSON.stringify(payload.negativeRoles),
        conditionalRules: payload.conditionalRules && payload.conditionalRules.length > 0
          ? JSON.stringify(payload.conditionalRules)
          : null,
        language: payload.language || null,
        chatHistory: payload.chatHistory && payload.chatHistory.length > 0
          ? JSON.stringify(payload.chatHistory)
          : null,
        lastUserMessage: payload.lastUserMessage || null,
        lastAIResponse: payload.lastAIResponse || null,
      },
    });

    logger.info("persona-criteria", `Utworzono nową personę: ${persona.id} (${persona.name})`);

    return NextResponse.json({
      success: true,
      persona: {
        id: persona.id,
        name: persona.name,
        description: persona.description,
        companyCriteriaId: persona.companyCriteriaId,
        createdAt: persona.createdAt,
        updatedAt: persona.updatedAt,
      },
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria", "Błąd tworzenia persony", null, errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd tworzenia persony", details: errorObj.message },
      { status: 500 }
    );
  }
}
