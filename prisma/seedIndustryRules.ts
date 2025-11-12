import { PrismaClient } from "@prisma/client";
import { INDUSTRY_RULE_SEEDS } from "../src/config/industryRuleSeeds";
import { logger } from "../src/services/logger";

async function main() {
  const db = new PrismaClient();
  try {
    const existing = await db.industrySpecializationRule.count();
    if (existing > 0) {
      logger.info("industry-rule-seed", "Rules already exist", { count: existing });
      return;
    }

    const payload = INDUSTRY_RULE_SEEDS.flatMap((entry) =>
      entry.matches.map((match) => ({
        industry: entry.industry,
        specializationCode: match.specializationCode,
        score: match.score,
        explanation: match.explanation,
        source: match.source ?? "MANUAL",
        status: "ACTIVE" as const,
      }))
    );

    await db.industrySpecializationRule.createMany({ data: payload });
    logger.info("industry-rule-seed", "Seed completed", { count: payload.length });
  } catch (error) {
    logger.error("industry-rule-seed", "Seed failed", { error });
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
