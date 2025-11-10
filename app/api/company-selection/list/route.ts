import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Lista firm z filtrami
 * GET /api/company-selection/list?status=QUALIFIED&industry=Targi&page=1&limit=50
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const industry = searchParams.get("industry");
    const country = searchParams.get("country");
    const importBatchId = searchParams.get("importBatchId");
      const batchLanguage = searchParams.get("batchLanguage");
      const market = searchParams.get("market");
    const batchName = searchParams.get("batchName");
    const classificationClass = searchParams.get("classificationClass");
    const classificationSubClass = searchParams.get("classificationSubClass");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search");

    const where: any = {};

    if (status && status !== "ALL") {
      where.verificationStatus = status;
    }

    if (industry) {
      where.industry = industry;
    }

    if (country) {
      where.country = country;
    }

      if (market) {
        where.market = market;
      }

    if (importBatchId) {
      const parsedBatchId = parseInt(importBatchId, 10);
      if (!Number.isNaN(parsedBatchId)) {
        where.importBatchId = parsedBatchId;
      }
    }

    if (classificationClass) {
      where.classificationClass = classificationClass;
    }

    if (classificationSubClass) {
      where.classificationSubClass = classificationSubClass;
    }

    const importBatchWhere: any = {};
    if (batchLanguage) {
      importBatchWhere.language = batchLanguage;
    }
          if (market && !where.market) {
            importBatchWhere.market = market;
          }
    if (batchName && batchName.trim()) {
      importBatchWhere.name = { contains: batchName.trim() };
    }
    if (Object.keys(importBatchWhere).length > 0) {
      where.importBatch = importBatchWhere;
    }

    // Wyszukiwanie po nazwie firmy (case-insensitive dla lepszego wyszukiwania)
    // SQLite używa LIKE dla case-insensitive search
    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      // Używamy contains dla prostszego wyszukiwania - SQLite będzie szukał w całej bazie
      // Dla lepszej wydajności możemy użyć LIKE, ale contains jest prostsze
      where.OR = [
        { name: { contains: search.trim() } },
        { description: { contains: search.trim() } },
        { activityDescription: { contains: search.trim() } },
      ];
    }

    const [companies, total] = await Promise.all([
      db.company.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          importBatch: true,
        },
      }),
      db.company.count({ where }),
    ]);

    return NextResponse.json({
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Company List] Błąd:", error);
    return NextResponse.json(
      { error: "Błąd pobierania listy firm", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

