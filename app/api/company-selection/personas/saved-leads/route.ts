import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/company-selection/personas/saved-leads
 * Pobiera zapisane leady z bazy danych ApolloEmployee
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const selectionId = searchParams.get("selectionId");
    const personaCriteriaId = searchParams.get("personaCriteriaId");
    const companyIds = searchParams.get("companyIds");
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "50");

    const where: any = {};

    if (selectionId) {
      where.selectionId = parseInt(selectionId);
    }

    if (personaCriteriaId) {
      where.personaCriteriaId = parseInt(personaCriteriaId);
    }

    if (companyIds) {
      const ids = companyIds.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
      if (ids.length > 0) {
        where.companyId = { in: ids };
      }
    }

    // Pobierz wszystkie leady (również bez emaili) - nie filtruj po emailu

    const [leads, total] = await Promise.all([
      (db as any).apolloEmployee.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              industry: true,
              country: true,
              city: true,
              website: true,
            },
          },
        },
        orderBy: { apolloFetchedAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      (db as any).apolloEmployee.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      leads,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error: any) {
    console.error("[Saved Leads] Błąd:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Błąd pobierania zapisanych leadów",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

