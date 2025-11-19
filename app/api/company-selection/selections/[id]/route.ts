import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

const ALLOWED_MARKETS = ["PL", "DE", "FR", "EN"] as const;
type MarketCode = (typeof ALLOWED_MARKETS)[number];
const MAX_PAGE_SIZE = 200;

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
  specializationCodes?: string[];
  onlyPrimary?: boolean;
  minScore?: number;
  minConfidence?: number;
  languages?: string[];
  importBatchIds?: number[];
};

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

function buildCompanyFilter(market: MarketCode, filters: SelectionFilters): Prisma.CompanyWhereInput {
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
    verificationStatus: { not: "BLOCKED" },
  };

  if (importBatchIds.length > 0) {
    where.importBatchId = { in: importBatchIds };
  }

  if (languages.length > 0) {
    where.importBatch = {
      language: { in: languages.map((l) => String(l).toUpperCase()) },
    } as any;
  }

  if (specializationCodes.length > 0 || Number.isFinite(minScore) || Number.isFinite(minConfidence) || onlyPrimary) {
    where.classifications = {
      some: {
        ...(specializationCodes.length > 0 ? { specializationCode: { in: specializationCodes } } : {}),
        ...(onlyPrimary ? { isPrimary: true } : {}),
        ...(Number.isFinite(minScore) ? { score: { gte: Number(minScore) } } : {}),
        ...(Number.isFinite(minConfidence) ? { confidence: { gte: Number(minConfidence) } } : {}),
        source: "AI",
      },
    };
  } else {
    where.classifications = { some: { source: "AI" } };
  }

  return where;
}

// Note: GET handler is defined below with pagination support

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  let newCompanyIds: number[] = [];
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "Niepoprawne ID selekcji" }, { status: 400 });
    }
    const body = await req.json();
    const selection = await db.companySelection.findUnique({ where: { id } });
    if (!selection) {
      return NextResponse.json({ success: false, error: "Nie znaleziono selekcji" }, { status: 404 });
    }

    const market = normalizeMarket(body.market ?? selection.market);
    const language = typeof body.language === "string" ? body.language.trim() : selection.language ?? undefined;
    if (!market) {
      return NextResponse.json({ success: false, error: "Niepoprawny rynek" }, { status: 400 });
    }
    const filters = sanitizeSelectionFilters(body.filters ?? (selection.filters ? JSON.parse(selection.filters) : {}));

    const excludeIds: number[] = Array.isArray(body.excludeCompanyIds)
      ? body.excludeCompanyIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n))
      : [];

    // Get current companies from selection
    const currentMemberships = await db.companySelectionCompany.findMany({
      where: { selectionId: id },
      select: { companyId: true },
    });
    const currentCompanyIds = currentMemberships.map((m) => m.companyId);

    // If there are exclusions, always use current companies from selection
    // Otherwise, check if filters changed and regenerate if needed
    if (excludeIds.length > 0) {
      // Only exclusions - use current companies and remove excluded ones
      newCompanyIds = currentCompanyIds;
    } else {
      // No exclusions - check if filters changed
      // Parse saved filters and compare
      const savedFiltersRaw = selection.filters ? JSON.parse(selection.filters) : {};
      const savedFilters = sanitizeSelectionFilters(savedFiltersRaw);
      
      // Compare filters (normalize for comparison)
      const filtersChanged =
        JSON.stringify((filters.specializationCodes || []).sort()) !== JSON.stringify((savedFilters.specializationCodes || []).sort()) ||
        JSON.stringify((filters.languages || []).sort()) !== JSON.stringify((savedFilters.languages || []).sort()) ||
        JSON.stringify((filters.importBatchIds || []).sort()) !== JSON.stringify((savedFilters.importBatchIds || []).sort()) ||
        Boolean(filters.onlyPrimary) !== Boolean(savedFilters.onlyPrimary) ||
        (filters.minScore ?? 3) !== (savedFilters.minScore ?? 3) ||
        (filters.minConfidence ?? 0.6) !== (savedFilters.minConfidence ?? 0.6);

      if (filtersChanged) {
        // Filters changed - regenerate list based on new filters
        const where = buildCompanyFilter(market, filters);
        newCompanyIds = await db.company
          .findMany({ where, select: { id: true } })
          .then((rows) => rows.map((r) => r.id));
      } else {
        // No changes - use current companies
        newCompanyIds = currentCompanyIds;
      }
    }

    const filteredIds = newCompanyIds.filter((cid) => !excludeIds.includes(cid));

    const updated = await db.$transaction(async (tx) => {
      // Update selection meta
      const upd = await tx.companySelection.update({
        where: { id },
        data: {
          market,
          language,
          filters: JSON.stringify(filters),
          totalCompanies: filteredIds.length,
          activeCompanies: filteredIds.length,
        },
      });

      // Replace membership
      await tx.companySelectionCompany.deleteMany({ where: { selectionId: id } });
      const companies = await tx.company.findMany({
        where: { id: { in: filteredIds } },
        select: { id: true },
      });
      if (companies.length > 0) {
        await tx.companySelectionCompany.createMany({
          data: companies.map((c) => ({
            selectionId: id,
            companyId: c.id,
            status: "PENDING", // Przy aktualizacji selekcji - zawsze ustawiamy PENDING dla nowych firm
          })),
        });
      }
      return upd;
    });

    logger.info("company-selection", `Zaktualizowano selekcję ${id}, firmy: ${newCompanyIds.length} -> ${updated.totalCompanies}`);

    return NextResponse.json({
      success: true,
      selection: {
        id: updated.id,
        name: updated.name,
        market: updated.market,
        language: updated.language,
        totalCompanies: updated.totalCompanies,
        activeCompanies: updated.activeCompanies,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("company-selection", "Błąd aktualizacji selekcji (PUT /[id])", { newCompanyIds }, err);
    return NextResponse.json(
      { success: false, error: "Nie udało się zaktualizować selekcji", details: err.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const selectionId = Number(params.id);
    if (!Number.isFinite(selectionId)) {
      return NextResponse.json(
        { success: false, error: "Niepoprawne ID selekcji" },
        { status: 400 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
      MAX_PAGE_SIZE
    );
    const statusFilter = searchParams.get("status")?.toUpperCase() || "";
    const search = searchParams.get("search")?.trim();

    const selection = await db.companySelection.findUnique({
      where: { id: selectionId },
    });

    if (!selection) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono selekcji" },
        { status: 404 }
      );
    }

    // Pobierz listę zablokowanych firm (adresy www + firmy bez www)
    // Używamy surowego zapytania SQL, bo Prisma Client może jeszcze nie widzieć nowych pól
    const blockedCompanies = await db.$queryRaw<Array<{ website: string | null; companyId: number | null; blockType: string }>>`
      SELECT website, companyId, blockType FROM BlockedCompany
    `;
    const blockedWebsites = new Set(
      blockedCompanies
        .filter((b) => b.website && b.blockType === "MANUAL")
        .map((b) => b.website.toLowerCase().trim())
    );
    const blockedCompanyIds = new Set(
      blockedCompanies
        .filter((b) => b.companyId && b.blockType === "NO_WEBSITE")
        .map((b) => b.companyId)
    );

    const membershipWhere: any = {
      selectionId,
    };

    if (statusFilter && statusFilter !== "ALL") {
      membershipWhere.status = statusFilter;
    }

    if (search) {
      membershipWhere.company = {
        OR: [
          { name: { contains: search } },
          { industry: { contains: search } },
          { classificationClass: { contains: search } },
          { classificationSubClass: { contains: search } },
        ],
      };
    }

    // Parse saved filters from selection
    let savedFilters: SelectionFilters = {};
    try {
      if (selection.filters) {
        savedFilters = sanitizeSelectionFilters(JSON.parse(selection.filters));
      }
    } catch {
      // Ignore parse errors
    }

    const [memberships, totalBeforeFilter, stats] = await Promise.all([
      db.companySelectionCompany.findMany({
        where: membershipWhere,
        orderBy: [
          { updatedAt: "desc" },
          { id: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit * 2, // Pobierz więcej, żeby po filtrowaniu mieć wystarczająco
        include: {
          company: {
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
              classificationClass: true,
              classificationSubClass: true,
              verificationStatus: true,
              verificationScore: true,
              importBatch: {
                select: {
                  id: true,
                  name: true,
                  language: true,
                  market: true,
                },
              },
              classifications: {
                where: {
                  source: "AI",
                  ...(savedFilters.specializationCodes && savedFilters.specializationCodes.length > 0
                    ? { specializationCode: { in: savedFilters.specializationCodes } }
                    : {}),
                  ...(savedFilters.onlyPrimary ? { isPrimary: true } : {}),
                  ...(Number.isFinite(savedFilters.minScore as number)
                    ? { score: { gte: Number(savedFilters.minScore) } }
                    : {}),
                  ...(Number.isFinite(savedFilters.minConfidence as number)
                    ? { confidence: { gte: Number(savedFilters.minConfidence) } }
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
          },
        },
      }),
      db.companySelectionCompany.count({
        where: membershipWhere,
      }),
      db.companySelectionCompany.groupBy({
        by: ["status"],
        where: { selectionId },
        _count: {
          _all: true,
        },
      }),
    ]);

    // Filtruj firmy z listy zablokowanych (po adresie www, nawet jeśli nie mają statusu BLOCKED)
    const filteredMemberships = memberships.filter((membership) => {
      // Sprawdź czy firma jest zablokowana bez www (po companyId)
      if (blockedCompanyIds.size > 0 && blockedCompanyIds.has(membership.company.id)) {
        return false; // Firma jest zablokowana bez www
      }
      
      // Sprawdź czy firma jest zablokowana po adresie www
      if (!membership.company.website) return true; // Firma bez www nie może być zablokowana po www (chyba że jest w blockedCompanyIds)
      
      const companyWebsite = membership.company.website.toLowerCase().trim();
      // Sprawdź czy adres www firmy pasuje do któregoś z zablokowanych adresów (dokładne dopasowanie)
      return !blockedWebsites.has(companyWebsite);
    });

    // Ogranicz do właściwego limitu po filtrowaniu
    const membershipsToReturn = filteredMemberships.slice(0, limit);
    const total = totalBeforeFilter; // Używamy oryginalnego total, bo filtrowanie po stronie klienta nie zmienia całkowitej liczby

    const statusSummary = stats.map((item) => ({
      status: item.status,
      count: item._count._all,
    }));

    return NextResponse.json({
      success: true,
      selection: {
        id: selection.id,
        name: selection.name,
        description: selection.description,
        market: selection.market,
        language: selection.language,
        totalCompanies: selection.totalCompanies,
        activeCompanies: selection.activeCompanies,
        createdBy: selection.createdBy,
        createdAt: selection.createdAt,
        updatedAt: selection.updatedAt,
      },
      preview: membershipsToReturn.map((membership) => ({
        ...membership.company,
        membershipId: membership.id,
        membershipStatus: membership.status,
        membershipScore: membership.score,
        membershipReason: membership.reason,
        membershipVerifiedAt: membership.verifiedAt,
        membershipUpdatedAt: membership.updatedAt,
        membershipNotes: membership.notes,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: statusSummary,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      {
        success: false,
        error: "Nie udało się pobrać szczegółów selekcji",
        details: err.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: "Niepoprawne ID selekcji" }, { status: 400 });
    }

    const selection = await db.companySelection.findUnique({ where: { id } });
    if (!selection) {
      return NextResponse.json({ success: false, error: "Nie znaleziono selekcji" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      // Usuń powiązania z firmami
      await tx.companySelectionCompany.deleteMany({ where: { selectionId: id } });
      // Usuń powiązania z kryteriami
      await tx.companyVerificationCriteria.deleteMany({ where: { selectionId: id } });
      // Usuń selekcję
      await tx.companySelection.delete({ where: { id } });
    });

    logger.info("company-selection", `Usunięto selekcję "${selection.name}" (ID: ${id})`);

    return NextResponse.json({ success: true, message: "Selekcja została usunięta" });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("company-selection", "Błąd usuwania selekcji (DELETE /[id])", null, err);
    return NextResponse.json(
      { success: false, error: "Nie udało się usunąć selekcji", details: err.message },
      { status: 500 }
    );
  }
}


