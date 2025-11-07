import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * Pobierz aktywną konfigurację kryteriów
 * GET /api/company-selection/criteria
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    // Jeśli podano ID, pobierz konkretne kryteria
    if (id) {
      const criteria = await db.companyVerificationCriteria.findUnique({
        where: { id: parseInt(id) },
      });
      return NextResponse.json({ criteria });
    }

    // W przeciwnym razie pobierz aktywne i domyślne kryteria
    const criteria = await db.companyVerificationCriteria.findFirst({
      where: {
        isActive: true,
        isDefault: true,
      },
    });

    if (!criteria) {
      return NextResponse.json({ criteria: null });
    }

    return NextResponse.json({ criteria });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-criteria", "Błąd pobierania kryteriów", null, errorObj);
    return NextResponse.json(
      { error: "Błąd pobierania kryteriów", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Utwórz/aktualizuj konfigurację kryteriów
 * POST /api/company-selection/criteria
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, description, criteriaText, qualifiedThreshold, rejectedThreshold, chatHistory } = data;

    if (!name || !criteriaText) {
      return NextResponse.json(
        { error: "Nazwa i tekst kryteriów są wymagane" },
        { status: 400 }
      );
    }

    // Jeśli istnieje domyślna konfiguracja, usuń flagę isDefault
    const existingDefault = await db.companyVerificationCriteria.findFirst({
      where: { isDefault: true },
    });

    if (existingDefault) {
      await db.companyVerificationCriteria.update({
        where: { id: existingDefault.id },
        data: { isDefault: false },
      });
    }

    // Utwórz nową konfigurację
    const criteria = await db.companyVerificationCriteria.create({
      data: {
        name,
        description: description || null,
        criteriaText,
        qualifiedThreshold: qualifiedThreshold || 0.8,
        rejectedThreshold: rejectedThreshold || 0.3,
        chatHistory: chatHistory ? JSON.stringify(chatHistory) : null,
        isActive: true,
        isDefault: true,
      },
    });

    logger.info("company-criteria", `Utworzono nowe kryteria: ${criteria.name} (ID: ${criteria.id})`);
    return NextResponse.json({ success: true, criteria });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-criteria", "Błąd tworzenia kryteriów", null, errorObj);
    return NextResponse.json(
      { error: "Błąd tworzenia kryteriów", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Aktualizuj konfigurację kryteriów
 * PUT /api/company-selection/criteria
 */
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const { id, name, description, criteriaText, qualifiedThreshold, rejectedThreshold, chatHistory } = data;

    if (!id) {
      return NextResponse.json(
        { error: "ID konfiguracji jest wymagane" },
        { status: 400 }
      );
    }

    const criteria = await db.companyVerificationCriteria.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(criteriaText && { criteriaText }),
        ...(qualifiedThreshold !== undefined && { qualifiedThreshold }),
        ...(rejectedThreshold !== undefined && { rejectedThreshold }),
        ...(chatHistory && { chatHistory: JSON.stringify(chatHistory) }),
      },
    });

    logger.info("company-criteria", `Zaktualizowano kryteria: ${criteria.name} (ID: ${criteria.id})`);
    return NextResponse.json({ success: true, criteria });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-criteria", "Błąd aktualizacji kryteriów", null, errorObj);
    return NextResponse.json(
      { error: "Błąd aktualizacji kryteriów", details: errorObj.message },
      { status: 500 }
    );
  }
}

