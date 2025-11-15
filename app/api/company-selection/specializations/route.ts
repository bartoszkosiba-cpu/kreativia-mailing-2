/**
 * API endpoint for fetching company specializations
 * GET /api/company-selection/specializations
 * Returns all specializations from database (manual + AI-created)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

export async function GET(req: NextRequest) {
  try {
    const specializations = await db.companySpecialization.findMany({
      orderBy: [
        { createdBy: "asc" }, // MANUAL first, then AI
        { createdAt: "asc" },
      ],
      include: {
        firstCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Policz liczbę firm dla każdej specjalizacji - TYLKO z klasyfikacji AI
    // Używamy tylko tabeli CompanyClassification z source = "AI" i isPrimary = true
    const companyCountsMap = new Map<string, number>();
    
    const classifications = await db.companyClassification.groupBy({
      by: ["specializationCode"],
      where: {
        isPrimary: true, // Liczymy tylko główne klasyfikacje
        source: "AI", // TYLKO klasyfikacje z AI
      },
      _count: {
        _all: true,
      },
    });

    for (const item of classifications) {
      companyCountsMap.set(item.specializationCode, item._count._all);
    }

    return NextResponse.json({
      success: true,
      specializations: specializations.map((spec) => ({
        id: spec.id,
        code: spec.code,
        label: spec.label,
        description: spec.description,
        companyClass: spec.companyClass,
        createdBy: spec.createdBy,
        createdAt: spec.createdAt.toISOString(),
        firstCompanyId: spec.firstCompanyId,
        firstCompanyName: spec.firstCompanyName,
        firstCompanyReason: spec.firstCompanyReason,
        aiConfidence: spec.aiConfidence,
        companyCount: companyCountsMap.get(spec.code) || 0, // Liczba firm z tą specjalizacją jako główną
        firstCompany: spec.firstCompany
          ? {
              id: spec.firstCompany.id,
              name: spec.firstCompany.name,
            }
          : null,
      })),
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-specializations-api", "Błąd pobierania specjalizacji", null, errorObj);
    return NextResponse.json(
      {
        success: false,
        error: errorObj.message,
      },
      { status: 500 }
    );
  }
}

