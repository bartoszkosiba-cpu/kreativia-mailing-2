import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import { PersonaCriteriaPayload } from "@/services/personaCriteriaService";
import { regeneratePromptForPersonaCriteria } from "@/services/personaBriefService";

/**
 * Pobierz szczegóły persony
 * GET /api/company-selection/personas/[id]
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID persony" }, { status: 400 });
    }

    const persona = await db.companyPersonaCriteria.findUnique({
      where: { id },
      include: {
        personaVerifications: {
          take: 1,
        },
      },
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

    // Sprawdź czy persona jest używana w weryfikacjach
    const isUsed = persona.personaVerifications.length > 0;

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
        isUsed: isUsed,
      },
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria", "Błąd pobierania persony", { id: params.id }, errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania persony", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Zaktualizuj personę
 * PUT /api/company-selection/personas/[id]
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID persony" }, { status: 400 });
    }

    const body = await req.json();
    const {
      name,
      description,
      positiveRoles,
      negativeRoles,
      conditionalRules,
      language,
      chatHistory,
      lastUserMessage,
      lastAIResponse,
      companyCriteriaId,
    } = body;

    const existing = await db.companyPersonaCriteria.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Nie znaleziono persony" }, { status: 404 });
    }

    // Jeśli podano companyCriteriaId, sprawdź czy istnieje
    if (companyCriteriaId !== undefined && companyCriteriaId !== null) {
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

    const updated = await db.companyPersonaCriteria.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(positiveRoles !== undefined && { positiveRoles: JSON.stringify(positiveRoles) }),
        ...(negativeRoles !== undefined && { negativeRoles: JSON.stringify(negativeRoles) }),
        ...(conditionalRules !== undefined && {
          conditionalRules: conditionalRules && conditionalRules.length > 0
            ? JSON.stringify(conditionalRules)
            : null,
        }),
        ...(language !== undefined && { language: language || null }),
        ...(chatHistory !== undefined && { chatHistory: chatHistory ? JSON.stringify(chatHistory) : null }),
        ...(lastUserMessage !== undefined && { lastUserMessage: lastUserMessage || null }),
        ...(lastAIResponse !== undefined && { lastAIResponse: lastAIResponse || null }),
        ...(companyCriteriaId !== undefined && { companyCriteriaId: companyCriteriaId || null }),
        updatedAt: new Date(),
      },
    });

    logger.info("persona-criteria", `Zaktualizowano personę: ${id}`);

    // Regeneruj prompt jeśli PersonaCriteria zostało zmienione (może wpłynąć na prompt)
    try {
      await regeneratePromptForPersonaCriteria(id);
      logger.info("persona-criteria", `Zregenerowano prompt dla persony: ${id}`);
    } catch (promptError) {
      // Nie przerywamy procesu jeśli regeneracja promptu się nie powiodła
      logger.error("persona-criteria", "Błąd regeneracji promptu", { personaId: id }, promptError as Error);
    }

    return NextResponse.json({
      success: true,
      persona: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        companyCriteriaId: updated.companyCriteriaId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria", "Błąd aktualizacji persony", { id: params.id }, errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd aktualizacji persony", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Usuń personę
 * DELETE /api/company-selection/personas/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID persony" }, { status: 400 });
    }

    const existing = await db.companyPersonaCriteria.findUnique({
      where: { id },
      include: {
        personaVerifications: {
          take: 1,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Nie znaleziono persony" }, { status: 404 });
    }

    // Sprawdź czy persony są używane w weryfikacjach
    // Jeśli są, ustawiamy personaCriteriaId na null (onDelete: SetNull w schemacie)
    // Nie blokujemy usunięcia, ale informujemy użytkownika
    const verificationCount = existing.personaVerifications.length;
    
    if (verificationCount > 0) {
      // Ustaw personaCriteriaId na null we wszystkich weryfikacjach przed usunięciem
      await db.personaVerificationResult.updateMany({
        where: { personaCriteriaId: id },
        data: { personaCriteriaId: null },
      });
      
      logger.info("persona-criteria", `Usunięto personę ${id}, ustawiono personaCriteriaId na null w ${verificationCount} weryfikacjach`);
    }

    await db.companyPersonaCriteria.delete({
      where: { id },
    });

    logger.info("persona-criteria", `Usunięto personę: ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria", "Błąd usuwania persony", { id: params.id }, errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd usuwania persony", details: errorObj.message },
      { status: 500 }
    );
  }
}

