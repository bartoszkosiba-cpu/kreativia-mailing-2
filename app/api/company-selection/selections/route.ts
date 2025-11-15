import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

const ALLOWED_MARKETS = ["PL", "DE", "FR", "EN"] as const;
type MarketCode = (typeof ALLOWED_MARKETS)[number];

const DEFAULT_PREVIEW_LIMIT = 150;

function normalizeMarket(value: unknown): MarketCode | null {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return (ALLOWED_MARKETS as readonly string[]).includes(normalized) ? (normalized as MarketCode) : null;
}

function normalizeStringArray(source?: unknown, max = 50): string[] {
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .slice(0, max)
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "")).trim())
    .filter(Boolean);
}

type SelectionFilters = {
  industries?: string[];
  segments?: string[];
  subSegments?: string[];
  importBatchIds?: number[];
  verificationStatuses?: string[];
  onlyNeedsReview?: boolean;
};

function buildCompanyFilter(
  market: MarketCode,
  filters: SelectionFilters
): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = {
    market,
    // Automatycznie wykluczamy firmy zablokowane z selekcji
    verificationStatus: { not: "BLOCKED" },
  };

  const { industries, segments, subSegments, importBatchIds, verificationStatuses, onlyNeedsReview } =
    filters;

  if (industries && industries.length > 0) {
    where.industry = { in: industries };
  }

  if (segments && segments.length > 0) {
    where.classificationClass = { in: segments };
  }

  if (subSegments && subSegments.length > 0) {
    where.classificationSubClass = { in: subSegments };
  }

  if (importBatchIds && importBatchIds.length > 0) {
    where.importBatchId = { in: importBatchIds };
  }

  // Jeśli użytkownik JAWNO chce zobaczyć BLOCKED, pozwalamy
  if (verificationStatuses && verificationStatuses.length > 0) {
    // Jeśli jest "BLOCKED" w liście, usuwamy automatyczne wykluczenie
    if (verificationStatuses.includes("BLOCKED")) {
      where.verificationStatus = { in: verificationStatuses };
    } else {
      // Jeśli nie ma BLOCKED, filtrujemy tylko wybrane statusy (wykluczenie BLOCKED już jest na górze)
      const filteredStatuses = verificationStatuses.filter((s) => s !== "BLOCKED");
      if (filteredStatuses.length > 0) {
        where.verificationStatus = { in: filteredStatuses };
      }
      // Jeśli wszystkie statusy były BLOCKED, pozostaje wykluczenie z góry
    }
  }
  // Jeśli nie ma verificationStatuses, wykluczenie BLOCKED już jest na górze funkcji (domyślnie)

  if (onlyNeedsReview) {
    where.classificationNeedsReview = true;
  }

  return where;
}

function sanitizeSelectionFilters(rawFilters: unknown): SelectionFilters {
  if (!rawFilters || typeof rawFilters !== "object") {
    return {};
  }
  const filters = rawFilters as Record<string, unknown>;
  const industries = normalizeStringArray(filters.industries);
  const segments = normalizeStringArray(filters.segments);
  const subSegments = normalizeStringArray(filters.subSegments);
  const verificationStatuses = normalizeStringArray(filters.verificationStatuses);
  const importBatchIds = Array.isArray(filters.importBatchIds)
    ? (filters.importBatchIds as unknown[])
        .map((value) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        })
        .filter((value): value is number => value !== null)
    : [];

  return {
    industries,
    segments,
    subSegments,
    verificationStatuses,
    importBatchIds,
    onlyNeedsReview: Boolean(filters.onlyNeedsReview),
  };
}

function extractNumericIds(source?: unknown): number[] {
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .map((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value): value is number => value !== null);
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const marketParam = searchParams.get("market")?.trim().toUpperCase();
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);

    const where: Prisma.CompanySelectionWhereInput = {};
    const market = normalizeMarket(marketParam);
    if (market) {
      where.market = market;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const selections = await db.companySelection.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        criteria: {
          select: {
            id: true,
            name: true,
            isActive: true,
            updatedAt: true,
          },
        },
      },
    });

    const enriched = selections.map((selection) => ({
      id: selection.id,
      name: selection.name,
      market: selection.market,
      language: selection.language,
      description: selection.description,
      totalCompanies: selection.totalCompanies,
      activeCompanies: selection.activeCompanies,
      createdBy: selection.createdBy,
      createdAt: selection.createdAt,
      updatedAt: selection.updatedAt,
      criteria: selection.criteria.map((criterion) => ({
        id: criterion.id,
        name: criterion.name,
        isActive: criterion.isActive,
        updatedAt: criterion.updatedAt,
      })),
    }));

    return NextResponse.json({ success: true, selections: enriched });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("company-selection", "Błąd pobierania selekcji firm", null, err);
    return NextResponse.json(
      { success: false, error: "Nie udało się pobrać listy selekcji", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let companyIds: number[] = [];
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : undefined;
    const language = typeof body.language === "string" ? body.language.trim() : undefined;
    const market = normalizeMarket(body.market);
    const dryRun = Boolean(body.dryRun);
    const previewLimit = Math.min(body.previewLimit ?? DEFAULT_PREVIEW_LIMIT, 300);
    const filters = sanitizeSelectionFilters(body.filters);
    const excludeCompanyIds = new Set(extractNumericIds(body.excludeCompanyIds));

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nazwa selekcji jest wymagana" },
        { status: 400 }
      );
    }

    if (!market) {
      return NextResponse.json(
        { success: false, error: "Niepoprawny rynek. Dozwolone wartości: PL, DE, FR, EN." },
        { status: 400 }
      );
    }

    const where = buildCompanyFilter(market, filters);
    companyIds = await db.company
      .findMany({
        where,
        select: { id: true },
      })
      .then((records) => records.map((record) => record.id));

    const filteredIds = companyIds.filter((id) => !excludeCompanyIds.has(id));
    const totalMatches = companyIds.length;
    const totalAfterExclusions = filteredIds.length;

    if (dryRun) {
      if (filteredIds.length === 0) {
        return NextResponse.json({
          success: true,
          totalMatches,
          totalAfterExclusions,
          preview: [],
        });
      }

      const previewCompanies = await db.company.findMany({
        where: {
          id: { in: filteredIds.slice(0, previewLimit) },
        },
        select: {
          id: true,
          name: true,
          industry: true,
          market: true,
          classificationClass: true,
          classificationSubClass: true,
          verificationStatus: true,
          importBatch: {
            select: {
              id: true,
              name: true,
              language: true,
              market: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return NextResponse.json({
        success: true,
        totalMatches,
        totalAfterExclusions,
        preview: previewCompanies,
      });
    }

    if (filteredIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Nie znaleziono firm spełniających wskazane kryteria (po uwzględnieniu wykluczeń).",
        },
        { status: 400 }
      );
    }

    const selection = await db.$transaction(async (tx) => {
      const createdSelection = await tx.companySelection.create({
        data: {
          name,
          description,
          market,
          language,
          filters: filters ? JSON.stringify(filters) : null,
          totalCompanies: filteredIds.length,
          activeCompanies: filteredIds.length,
        },
      });

      const companies = await tx.company.findMany({
        where: { id: { in: filteredIds } },
        select: {
          id: true,
          verificationStatus: true,
        },
      });

      await tx.companySelectionCompany.createMany({
        data: companies.map((company) => ({
          selectionId: createdSelection.id,
          companyId: company.id,
          status: company.verificationStatus ?? "PENDING",
        })),
      });

      return createdSelection;
    });

    logger.info(
      "company-selection",
      `Utworzono nową selekcję firm "${selection.name}" (ID: ${selection.id}), liczba firm: ${filteredIds.length}`
    );

    return NextResponse.json({
      success: true,
      selection: {
        id: selection.id,
        name: selection.name,
        market: selection.market,
        language: selection.language,
        totalCompanies: selection.totalCompanies,
        activeCompanies: selection.activeCompanies,
        createdAt: selection.createdAt,
        updatedAt: selection.updatedAt,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("company-selection", "Błąd tworzenia selekcji firm", { companyIds }, err);
    return NextResponse.json(
      {
        success: false,
        error: "Nie udało się utworzyć selekcji firm",
        details: err.message,
      },
      { status: 500 }
    );
  }
}


