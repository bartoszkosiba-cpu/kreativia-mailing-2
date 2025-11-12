import { db } from "@/lib/db";
import { logger } from "./logger";
import {
  buildIndustryRuleMap,
  classifyIndustry,
  IndustryClassificationInput,
  IndustryClassificationResult,
  IndustryRuleEntry,
  IndustrySpecializationScore,
} from "./industryClassification";
import { INDUSTRY_RULE_SEEDS } from "@/config/industryRuleSeeds";

let rulesCache: Map<string, IndustrySpecializationScore[]> | null = null;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minut
let seedingAttempted = false;

async function seedRulesIfEmpty() {
  if (seedingAttempted) return;
  seedingAttempted = true;
  const count = await db.industrySpecializationRule.count();
  if (count > 0) {
    return;
  }

  try {
    const payload = INDUSTRY_RULE_SEEDS.flatMap((entry) =>
      entry.matches.map((match) => ({
        industry: entry.industry,
        specializationCode: match.specializationCode,
        score: match.score,
        explanation: match.explanation,
        source: "MANUAL" as const,
        status: "ACTIVE" as const,
      }))
    );

    if (payload.length > 0) {
      await db.industrySpecializationRule.createMany({ data: payload });
      logger.info("industry-rules", "Seeded initial industry-specialization rules", {
        count: payload.length,
      });
    }
  } catch (error) {
    logger.error("industry-rules", "Failed seeding industry rules", { error });
  }
}

async function loadRulesFromDatabase(): Promise<Map<string, IndustrySpecializationScore[]>> {
  await seedRulesIfEmpty();

  const rows = await db.industrySpecializationRule.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ industry: "asc" }, { score: "desc" }],
  });

  const grouped = new Map<string, IndustrySpecializationScore[]>();
  for (const row of rows) {
    const list = grouped.get(row.industry.toLowerCase()) ?? [];
    list.push({
      specializationCode: row.specializationCode as IndustrySpecializationScore["specializationCode"],
      score: Number(row.score ?? 0),
      explanation: row.explanation ?? undefined,
      source: row.source === "AI" ? "AI" : "MANUAL",
      updatedAt: row.updatedAt ?? undefined,
    });
    grouped.set(row.industry.toLowerCase(), list);
  }

  if (grouped.size === 0 && INDUSTRY_RULE_SEEDS.length > 0) {
    // Fallback to seeds if DB remains empty (np. brak uprawnień do zapisu)
    for (const entry of INDUSTRY_RULE_SEEDS) {
      grouped.set(entry.industry.toLowerCase(), entry.matches);
    }
  }

  return grouped;
}

async function ensureRulesLoaded(): Promise<Map<string, IndustrySpecializationScore[]>> {
  const now = Date.now();
  if (!rulesCache || now - lastLoadedAt > CACHE_TTL_MS) {
    rulesCache = await loadRulesFromDatabase();
    lastLoadedAt = now;
  }
  return rulesCache;
}

export async function classifyCompanyIndustry(
  input: IndustryClassificationInput
): Promise<IndustryClassificationResult> {
  const rules = await ensureRulesLoaded();
  return classifyIndustry(input, rules);
}

export async function refreshIndustryRuleCache() {
  rulesCache = await loadRulesFromDatabase();
  lastLoadedAt = Date.now();
}

export async function upsertIndustryRule(entry: IndustryRuleEntry) {
  for (const match of entry.matches) {
    const existing = await db.industrySpecializationRule.findFirst({
      where: {
        industry: entry.industry,
        specializationCode: match.specializationCode,
      },
    });

    if (existing) {
      await db.industrySpecializationRule.update({
        where: { id: existing.id },
        data: {
          score: match.score,
          explanation: match.explanation,
          status: "ACTIVE",
          source: match.source ?? existing.source ?? "MANUAL",
          updatedBy: match.source === "AI" ? "AI" : existing.updatedBy,
          updatedAt: new Date(),
        },
      });
    } else {
      await db.industrySpecializationRule.create({
        data: {
          industry: entry.industry,
          specializationCode: match.specializationCode,
          score: match.score,
          explanation: match.explanation,
          source: match.source ?? "MANUAL",
          status: "ACTIVE",
        },
      });
    }
  }
  await refreshIndustryRuleCache();
}

export async function createIndustrySuggestion(entry: IndustryRuleEntry) {
  for (const match of entry.matches) {
    await db.industryMappingSuggestion.create({
      data: {
        industry: entry.industry,
        specializationCode: match.specializationCode,
        score: match.score,
        explanation: match.explanation,
        evidence: match.explanation ?? null,
        status: "PENDING",
        createdBy: match.source === "AI" ? "AI" : "MANUAL",
      },
    });
  }
}

export async function listIndustryRules() {
  const rows = await db.industrySpecializationRule.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ industry: "asc" }, { score: "desc" }],
  });
  return rows;
}
