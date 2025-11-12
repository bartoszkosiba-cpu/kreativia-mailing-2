import { PrismaClient } from "@prisma/client";
import { ensureCompanyClassification } from "../src/services/companySegmentation";
import { logger } from "../src/services/logger";

const db = new PrismaClient();

async function main() {
  const companies = await db.company.findMany({
    select: { id: true },
  });

  logger.info("reclassify", "Start reclassification", { count: companies.length });

  let updated = 0;
  for (const company of companies) {
    const full = await db.company.findUnique({ where: { id: company.id } });
    if (!full) continue;
    const beforeClass = full.classificationClass;
    const beforeSub = full.classificationSubClass;
    const result = await ensureCompanyClassification(full as any);
    if (
      result.classificationClass !== beforeClass ||
      result.classificationSubClass !== beforeSub
    ) {
      updated += 1;
    }
  }

  logger.info("reclassify", "Done reclassification", { updated });
}

main()
  .catch((error) => {
    logger.error("reclassify", "Error during reclassification", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
