import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * Pobierz listę wszystkich kryteriów lub konkretne kryterium
 * GET /api/company-selection/criteria?id=123 - pobierz konkretne kryterium
 * GET /api/company-selection/criteria - pobierz listę wszystkich kryteriów
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");
    const selectionId = searchParams.get("selectionId");

    // Jeśli podano ID, pobierz konkretne kryteria
    if (id) {
      const criteria = await db.companyVerificationCriteria.findUnique({
        where: { id: parseInt(id) },
        include: {
          selection: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      return NextResponse.json({ success: true, criteria });
    }

    // Jeśli podano selectionId, pobierz kryteria przypisane do tej selekcji
    if (selectionId) {
      const criteria = await db.companyVerificationCriteria.findMany({
        where: { selectionId: parseInt(selectionId) },
        include: {
          selection: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { updatedAt: "desc" },
        ],
      });
      return NextResponse.json({ success: true, criteria });
    }

    // W przeciwnym razie pobierz listę wszystkich kryteriów
    const allCriteria = await db.companyVerificationCriteria.findMany({
      include: {
        selection: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { updatedAt: "desc" },
      ],
    });

    return NextResponse.json({ success: true, criteria: allCriteria });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-criteria", "Błąd pobierania kryteriów", null, errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania kryteriów", details: errorObj.message },
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

    // Sprawdź czy użytkownik chce ustawić jako domyślne
    const setAsDefault = Boolean(data.isDefault);

    // Jeśli ustawiamy jako domyślne, usuń flagę isDefault z innych
    if (setAsDefault) {
      const existingDefault = await db.companyVerificationCriteria.findFirst({
        where: { isDefault: true },
      });

      if (existingDefault) {
        await db.companyVerificationCriteria.update({
          where: { id: existingDefault.id },
          data: { isDefault: false },
        });
      }
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
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        isDefault: setAsDefault,
        selectionId: data.selectionId ? Number(data.selectionId) : null,
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
    const { id, name, description, criteriaText, qualifiedThreshold, rejectedThreshold, chatHistory, selectionId, isDefault } = data;

    if (!id) {
      return NextResponse.json(
        { error: "ID konfiguracji jest wymagane" },
        { status: 400 }
      );
    }

    // Jeśli ustawiamy jako domyślne, usuń flagę isDefault z innych
    if (isDefault === true) {
      const existingDefault = await db.companyVerificationCriteria.findFirst({
        where: { isDefault: true, id: { not: id } },
      });

      if (existingDefault) {
        await db.companyVerificationCriteria.update({
          where: { id: existingDefault.id },
          data: { isDefault: false },
        });
      }
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
        ...(selectionId !== undefined && { selectionId: selectionId ? Number(selectionId) : null }),
        ...(isDefault !== undefined && { isDefault: Boolean(isDefault) }),
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

