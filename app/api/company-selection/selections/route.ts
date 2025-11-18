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
  // NOWY MODEL: filtry oparte o AI CompanyClassification
  specializationCodes?: string[]; // kody specjalizacji (multi)
  onlyPrimary?: boolean; // czy brać tylko isPrimary
  minScore?: number; // 1..5
  minConfidence?: number; // 0.0..1.0
  languages?: string[]; // PL/EN/DE/FR (z CompanyImportBatch.language)
  importBatchIds?: number[]; // multi
};

function buildCompanyFilter(
  market: MarketCode,
  filters: SelectionFilters
): Prisma.CompanyWhereInput {
  const {
    specializationCodes = [],
    onlyPrimary = false,
    minScore,
    minConfidence,
    languages = [],
    importBatchIds = [],
  } = filters;

  const where: Prisma.CompanyWhereInput = {
    market,
    // Zawsze wykluczamy zablokowane firmy
    verificationStatus: { not: "BLOCKED" },
  };

  // Filtr po partiach importu (multi)
  if (importBatchIds.length > 0) {
    where.importBatchId = { in: importBatchIds };
  }

  // Filtr po językach (na partii importu)
  if (languages.length > 0) {
    where.importBatch = {
      language: { in: languages.map((l) => String(l).toUpperCase()) },
    } as any;
  }

  // Filtry AI: CompanyClassification
  // Jeśli wskazano specjalizacje lub progi, wymagamy dopasowania w tabeli klasyfikacji
  if (specializationCodes.length > 0 || Number.isFinite(minScore) || Number.isFinite(minConfidence) || onlyPrimary) {
    where.classifications = {
      some: {
        ...(specializationCodes.length > 0 ? { specializationCode: { in: specializationCodes } } : {}),
        ...(onlyPrimary ? { isPrimary: true } : {}),
        ...(Number.isFinite(minScore) ? { score: { gte: Number(minScore) } } : {}),
        ...(Number.isFinite(minConfidence)
          ? {
              // confidence jest opcjonalne -> traktujemy null jak 0.0, więc filtrujemy tylko wartości >= minConfidence
              confidence: { gte: Number(minConfidence) },
            }
          : {}),
        source: "AI",
      },
    };
  } else {
    // Jeśli nie podano żadnych kryteriów AI, i tak ograniczamy do firm posiadających klasyfikację AI,
    // bo moduł pracuje wyłącznie na AI
    where.classifications = {
      some: { source: "AI" },
    };
  }

  return where;
}

function sanitizeSelectionFilters(rawFilters: unknown): SelectionFilters {
  if (!rawFilters || typeof rawFilters !== "object") {
    return {};
  }
  const filters = rawFilters as Record<string, unknown>;
  const specializationCodes = normalizeStringArray(filters.specializationCodes, 200);
  const languages = normalizeStringArray(filters.languages, 10);
  const onlyPrimary = Boolean(filters.onlyPrimary);
  const minScore =
    typeof filters.minScore === "number"
      ? filters.minScore
      : typeof filters.minScore === "string"
      ? Number(filters.minScore)
      : undefined;
  const minConfidence =
    typeof filters.minConfidence === "number"
      ? filters.minConfidence
      : typeof filters.minConfidence === "string"
      ? Number(filters.minConfidence)
      : undefined;
  const importBatchIds = Array.isArray(filters.importBatchIds)
    ? (filters.importBatchIds as unknown[])
        .map((value) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        })
        .filter((value): value is number => value !== null)
    : [];

  return {
    specializationCodes,
    languages,
    onlyPrimary,
    minScore: Number.isFinite(minScore as number) ? (minScore as number) : undefined,
    minConfidence: Number.isFinite(minConfidence as number) ? (minConfidence as number) : undefined,
    importBatchIds,
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
    const includeCriteria = searchParams.get("includeCriteria") !== "false"; // Domyślnie true dla kompatybilności wstecznej

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

    // Pobierz selekcje
    const selections = await db.companySelection.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const selectionIds = selections.map((s) => s.id);

    // Pobierz statystyki weryfikacji dla wszystkich selekcji równolegle
    const verificationStats = await db.companySelectionCompany.groupBy({
      by: ["selectionId", "status"],
      where: {
        selectionId: { in: selectionIds },
      },
      _count: {
        _all: true,
      },
    });

    // Pobierz daty ostatniej weryfikacji i ostatnich zmian dla każdej selekcji
    const lastVerificationDates = await db.companySelectionCompany.groupBy({
      by: ["selectionId"],
      where: {
        selectionId: { in: selectionIds },
        verifiedAt: { not: null },
      },
      _max: {
        verifiedAt: true,
      },
    });

    // Pobierz daty ostatnich zmian statusu (updatedAt) dla zweryfikowanych firm (status != PENDING)
    const lastStatusChangeDates = await db.companySelectionCompany.groupBy({
      by: ["selectionId"],
      where: {
        selectionId: { in: selectionIds },
        status: { not: "PENDING" },
      },
      _max: {
        updatedAt: true,
      },
    });

    // Zmapuj statystyki do selekcji
    const statsMap = new Map<number, {
      pending: number;
      qualified: number;
      rejected: number;
      needsReview: number;
      blocked: number;
      total: number;
    }>();

    const lastVerificationMap = new Map<number, Date>();
    const lastStatusChangeMap = new Map<number, Date>();

    // Zmapuj daty ostatniej weryfikacji (najnowsza dla każdej selekcji)
    for (const item of lastVerificationDates) {
      if (item._max.verifiedAt) {
        lastVerificationMap.set(item.selectionId, item._max.verifiedAt);
      }
    }

    // Zmapuj daty ostatnich zmian statusu (najnowsza dla każdej selekcji)
    for (const item of lastStatusChangeDates) {
      if (item._max.updatedAt) {
        lastStatusChangeMap.set(item.selectionId, item._max.updatedAt);
      }
    }

    for (const stat of verificationStats) {
      if (!statsMap.has(stat.selectionId)) {
        statsMap.set(stat.selectionId, {
          pending: 0,
          qualified: 0,
          rejected: 0,
          needsReview: 0,
          blocked: 0,
          total: 0,
        });
      }
      const stats = statsMap.get(stat.selectionId)!;
      const count = stat._count._all;
      
      switch (stat.status) {
        case "PENDING":
          stats.pending = count;
          break;
        case "QUALIFIED":
          stats.qualified = count;
          break;
        case "REJECTED":
          stats.rejected = count;
          break;
        case "NEEDS_REVIEW":
          stats.needsReview = count;
          break;
        case "BLOCKED":
          stats.blocked = count;
          break;
      }
      // Sumuj total po wszystkich statusach
      stats.total = stats.pending + stats.qualified + stats.rejected + stats.needsReview + stats.blocked;
    }

    // Zmapuj daty ostatniej weryfikacji (najnowsza dla każdej selekcji)
    for (const item of lastVerificationDates) {
      if (item._max.verifiedAt) {
        lastVerificationMap.set(item.selectionId, item._max.verifiedAt);
      }
    }

    // Pobierz kryteria tylko jeśli są potrzebne
    let criteriaMap = new Map<number, Array<{ id: number; name: string; isActive: boolean; updatedAt: Date }>>();
    if (includeCriteria) {
      const allCriteria = await db.companyVerificationCriteria.findMany({
        where: {
          selectionId: { not: null },
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          updatedAt: true,
          selectionId: true,
        },
      });

      // Zmapuj kryteria do selekcji
      for (const criterion of allCriteria) {
        if (criterion.selectionId) {
          if (!criteriaMap.has(criterion.selectionId)) {
            criteriaMap.set(criterion.selectionId, []);
          }
          criteriaMap.get(criterion.selectionId)!.push({
            id: criterion.id,
            name: criterion.name,
            isActive: criterion.isActive,
            updatedAt: criterion.updatedAt,
          });
        }
      }
    }

    const enriched = selections.map((selection) => {
      const stats = statsMap.get(selection.id) || {
        pending: 0,
        qualified: 0,
        rejected: 0,
        needsReview: 0,
        blocked: 0,
        total: selection.totalCompanies || 0,
      };
      const lastVerification = lastVerificationMap.get(selection.id);
      const lastStatusChange = lastStatusChangeMap.get(selection.id);
      
      // Użyj daty ostatniej weryfikacji, jeśli istnieje, w przeciwnym razie daty ostatniej zmiany statusu
      const lastVerificationOrChange = lastVerification || lastStatusChange || null;

      return {
        id: selection.id,
        name: selection.name,
        market: selection.market,
        language: selection.language,
        filters: selection.filters,
        description: selection.description,
        totalCompanies: selection.totalCompanies,
        activeCompanies: selection.activeCompanies,
        createdBy: selection.createdBy,
        createdAt: selection.createdAt,
        updatedAt: selection.updatedAt,
        verificationStats: stats,
        lastVerificationAt: lastVerificationOrChange,
        ...(includeCriteria ? { criteria: criteriaMap.get(selection.id) || [] } : {}),
      };
    });

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
    // Szybka ścieżka: liczniki per specjalizacja dla aktualnych filtrów (bez wymogu nazwy)
    if (body?.mode === "specCounts") {
      const marketForStats = normalizeMarket(body.market);
      if (!marketForStats) {
        return NextResponse.json({ success: false, error: "Niepoprawny rynek" }, { status: 400 });
      }
      const rawFilters = sanitizeSelectionFilters(body.filters);
      // Pomijamy specializationCodes – liczymy dla każdej specjalizacji osobno
      const filtersNoSpec: SelectionFilters = {
        ...rawFilters,
        specializationCodes: [],
      };
      const whereCompanyNoSpec = buildCompanyFilter(marketForStats, filtersNoSpec);
      const onlyPrimary = Boolean(rawFilters.onlyPrimary);
      const minScore = rawFilters.minScore;
      const minConfidence = rawFilters.minConfidence;

      const grouped = await db.companyClassification.groupBy({
        by: ["specializationCode"],
        where: {
          source: "AI",
          ...(onlyPrimary ? { isPrimary: true } : {}),
          ...(Number.isFinite(minScore as number) ? { score: { gte: Number(minScore) } } : {}),
          ...(Number.isFinite(minConfidence as number) ? { confidence: { gte: Number(minConfidence) } } : {}),
          company: whereCompanyNoSpec,
        },
        _count: { _all: true },
      });

      const counts: Record<string, number> = {};
      for (const row of grouped) {
        counts[row.specializationCode] = row._count._all;
      }
      return NextResponse.json({ success: true, counts });
    }
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
      const page = Number.isFinite(Number(body.page)) && Number(body.page) > 0 ? Number(body.page) : 1;
      const pageSizeCandidate = Number.isFinite(Number(body.pageSize)) && Number(body.pageSize) > 0 ? Number(body.pageSize) : (body.previewLimit ?? DEFAULT_PREVIEW_LIMIT);
      const pageSize = Math.min(Math.max(1, pageSizeCandidate), 300);
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const pageIds = filteredIds.slice(start, end);

      if (filteredIds.length === 0) {
        return NextResponse.json({
          success: true,
          totalMatches,
          totalAfterExclusions,
          page,
          pageSize,
          totalPages: 0,
          preview: [],
        });
      }

      // Pobierz podgląd z dopasowanymi klasyfikacjami AI spełniającymi filtry
      const previewBase = await db.company.findMany({
        where: { id: { in: pageIds } },
        select: {
          id: true,
          name: true,
          description: true,
          activityDescription: true,
          keywords: true,
          industry: true,
          website: true,
          country: true,
          city: true,
          street: true,
          postalCode: true,
          market: true,
          verificationStatus: true,
          importBatch: {
            select: { id: true, name: true, language: true, market: true },
          },
          classifications: {
            where: {
              source: "AI",
              ...(filters.specializationCodes && filters.specializationCodes.length > 0
                ? { specializationCode: { in: filters.specializationCodes } }
                : {}),
              ...(filters.onlyPrimary ? { isPrimary: true } : {}),
              ...(Number.isFinite(filters.minScore as number)
                ? { score: { gte: Number(filters.minScore) } }
                : {}),
              ...(Number.isFinite(filters.minConfidence as number)
                ? { confidence: { gte: Number(filters.minConfidence) } }
                : {}),
            },
            select: {
              specializationCode: true,
              score: true,
              confidence: true,
              isPrimary: true,
              reason: true,
            },
            orderBy: [{ isPrimary: "desc" }, { score: "desc" }],
          },
        },
        orderBy: { id: "asc" },
      });

      return NextResponse.json({
        success: true,
        totalMatches,
        totalAfterExclusions,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(totalAfterExclusions / pageSize)),
        preview: previewBase,
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



