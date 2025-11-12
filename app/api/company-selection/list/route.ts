import { CLASS_BY_SPECIALIZATION } from "@/config/companySpecializations";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type FilterCondition = {
  key: string;
  condition: Record<string, unknown>;
};

const buildWhere = (conditions: FilterCondition[], excludeKeys: string[] = []) => {
  const active = conditions.filter((item) => !excludeKeys.includes(item.key));
  if (active.length === 0) {
    return {};
  }
  if (active.length === 1) {
    return active[0].condition;
  }
  return {
    AND: active.map((item) => item.condition),
  };
};

const toNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Lista firm z filtrami
 * GET /api/company-selection/list?status=QUALIFIED&industry=Targi&page=1&limit=50
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const industriesFilter = searchParams
      .getAll("industry")
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
    const country = searchParams.get("country");
    const importBatchId = toNumber(searchParams.get("importBatchId"));
    const batchLanguage = searchParams.get("batchLanguage");
    const marketsFilter = searchParams
      .getAll("market")
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
    const batchName = searchParams.get("batchName");
    const classificationClasses = searchParams
      .getAll("classificationClass")
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
    const classificationSubClasses = searchParams
      .getAll("classificationSubClass")
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
    const needsReview = searchParams.get("needsReview");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search");

    const filterConditions: FilterCondition[] = [];

    if (status && status !== "ALL") {
      filterConditions.push({ key: "status", condition: { verificationStatus: status } });
    }

    if (industriesFilter.length === 1) {
      filterConditions.push({ key: "industry", condition: { industry: industriesFilter[0] } });
    } else if (industriesFilter.length > 1) {
      filterConditions.push({ key: "industry", condition: { industry: { in: industriesFilter } } });
    }

    if (country) {
      filterConditions.push({ key: "country", condition: { country } });
    }

    if (importBatchId != null) {
      filterConditions.push({ key: "importBatch", condition: { importBatchId } });
    }

    if (classificationClasses.length === 1) {
      filterConditions.push({
        key: "class",
        condition: { classificationClass: classificationClasses[0] },
      });
    } else if (classificationClasses.length > 1) {
      filterConditions.push({
        key: "class",
        condition: { classificationClass: { in: classificationClasses } },
      });
    }

    if (classificationSubClasses.length > 0) {
      const orConditions = classificationSubClasses.flatMap((code) => {
        const entries: Record<string, unknown>[] = [
          { classificationSubClass: code },
        ];
        for (const score of ["5", "4", "3"]) {
          entries.push({
            classificationSignals: {
              contains: `"industry-rule:${code}:${score}`,
            },
          });
        }
        return entries;
      });

      filterConditions.push({ key: "subClass", condition: { OR: orConditions } });
    }

    if (needsReview === "true") {
      filterConditions.push({ key: "needsReview", condition: { classificationNeedsReview: true } });
    } else if (needsReview === "false") {
      filterConditions.push({ key: "needsReview", condition: { classificationNeedsReview: false } });
    }

    if (marketsFilter.length > 0) {
      filterConditions.push({
        key: "market",
        condition: {
          OR: [
            { market: { in: marketsFilter } },
            {
              importBatch: {
                market: { in: marketsFilter },
              },
            },
          ],
        },
      });
    }

    if (batchLanguage) {
      filterConditions.push({
        key: "batchLanguage",
        condition: {
          OR: [
            { importBatch: { language: batchLanguage } },
            { importBatch: null },
          ],
        },
      });
    }

    if (batchName && batchName.trim()) {
      filterConditions.push({
        key: "batchName",
        condition: { importBatch: { name: { contains: batchName.trim() } } },
      });
    }

    if (search && search.trim()) {
      const trimmed = search.trim();
      filterConditions.push({
        key: "search",
        condition: {
          OR: [
            { name: { contains: trimmed } },
            { description: { contains: trimmed } },
            { activityDescription: { contains: trimmed } },
          ],
        },
      });
    }

    const whereFull = buildWhere(filterConditions);

    const [companies, total, classAggregationRaw, subClassAggregationRaw, marketAggregationRaw, industryAggregationRaw, signalRows] =
      await Promise.all([
        db.company.findMany({
          where: whereFull,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            importBatch: true,
          },
        }),
        db.company.count({ where: whereFull }),
        db.company.groupBy({
          by: ["classificationClass"],
          where: buildWhere(filterConditions, ["class"]),
          _count: { _all: true },
        }),
        db.company.groupBy({
          by: ["classificationSubClass"],
          where: buildWhere(filterConditions, ["subClass"]),
          _count: { _all: true },
        }),
        db.company.groupBy({
          by: ["market"],
          where: buildWhere(filterConditions, ["market"]),
          _count: { _all: true },
        }),
        db.company.groupBy({
          by: ["industry"],
          where: buildWhere(filterConditions, ["industry"]),
          _count: { _all: true },
        }),
        db.company.findMany({
          where: buildWhere(filterConditions, ["subClass"]),
          select: {
            classificationSignals: true,
          },
        }),
      ]);

    const specializationCountMap = new Map<string, number>();
    for (const entry of subClassAggregationRaw) {
      if (entry.classificationSubClass) {
        specializationCountMap.set(String(entry.classificationSubClass), entry._count._all);
      }
    }

    const allowedClasses = new Set(classificationClasses);
    for (const row of signalRows) {
      if (!row.classificationSignals) continue;
      try {
        const signals: string[] = JSON.parse(row.classificationSignals);
        for (const signal of signals) {
          if (!signal.startsWith(\"industry-rule:\")) continue;
          const parts = signal.split(":");
          const code = parts[1];
          const score = Number(parts[2]);
          if (!code || Number.isNaN(score) || score < 3) continue;
          const specClass = CLASS_BY_SPECIALIZATION.get(code);
          if (allowedClasses.size > 0 && specClass && !allowedClasses.has(specClass)) {
            continue;
          }
          specializationCountMap.set(code, (specializationCountMap.get(code) ?? 0) + 1);
        }
      } catch (parseError) {
        console.warn("[Company List] Nie udało się sparsować classificationSignals", parseError);
      }
    }

    const specializationAggregation = Array.from(specializationCountMap.entries()).map(([value, count]) => ({
      value,
      count,
    }));

    return NextResponse.json({
      companies: companies.map((company) => ({
        ...company,
        classificationSignals: company.classificationSignals
          ? JSON.parse(company.classificationSignals)
          : [],
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      aggregations: {
        class: classAggregationRaw
          .filter((entry) => entry.classificationClass)
          .map((entry) => ({
            value: entry.classificationClass as string,
            count: entry._count._all,
          })),
        subClass: specializationAggregation,
        market: marketAggregationRaw
          .filter((entry) => entry.market)
          .map((entry) => ({
            value: entry.market as string,
            count: entry._count._all,
          })),
        industry: industryAggregationRaw
          .filter((entry) => entry.industry)
          .map((entry) => ({
            value: entry.industry as string,
            count: entry._count._all,
          })),
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

