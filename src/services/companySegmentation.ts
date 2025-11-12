import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { logger } from "./logger";
import { classifyCompanyIndustry } from "./industryRulesService";
import type { IndustryClassificationResult } from "./industryClassification";

type CompanyRecord = NonNullable<Awaited<ReturnType<typeof db.company.findUnique>>>;

type ClassCode = "PS" | "WK" | "WKK";

type Rule = {
  class: ClassCode;
  subClass?: string;
  weight: number;
  keywords?: string[];
  industries?: string[];
  nameContains?: string[];
  descriptionContains?: string[];
  signals?: string[];
};

const CLASS_RULES: Rule[] = [
  // PS – Pośrednicy
  {
    class: "PS",
    subClass: "PS_AGENCY",
    weight: 4,
    keywords: [
      "agencja reklamowa",
      "full service agency",
      "media house",
      "agencja 360",
      "marketing 360",
      "atl",
      "btl",
      "integrated marketing",
      "comprehensive marketing",
      "multi channel marketing",
    ],
    industries: ["marketing & advertising", "public relations & communications"],
  },
  {
    class: "PS",
    subClass: "PS_AGENCY",
    weight: 3,
    keywords: [
      "agencja kreatywna",
      "creative agency",
      "creative studio",
      "boutique agency",
      "studio brandingowe",
      "branding studio",
      "graphic studio",
      "marketing studio",
      "studio komunikacji",
    ],
    industries: ["marketing & advertising", "design"],
  },
  {
    class: "PS",
    subClass: "PS_LARGE_FORMAT_PRINT",
    weight: 4,
    keywords: [
      "druk wielkoformatowy",
      "large format print",
      "large format printing",
      "drukarnia wielkoformatowa",
      "printing house",
      "print house",
      "digital print",
      "drukarnia",
    ],
    industries: ["printing", "graphic design"],
  },
  {
    class: "PS",
    subClass: "PS_ONLINE_SELLER",
    weight: 3,
    keywords: [
      "e-commerce",
      "ecommerce",
      "online store",
      "sklep internetowy",
      "webshop",
      "e-shop",
      "marketplace",
      "reseller",
      "dropshipping",
      "online retailer",
    ],
    industries: ["retail", "internet"],
  },
  {
    class: "PS",
    subClass: "PS_FOREIGN_BROKER",
    weight: 3,
    keywords: [
      "export",
      "international",
      "zagraniczny",
      "overseas",
      "foreign trade",
      "global distribution",
      "eu market",
      "international sales",
      "international trading",
    ],
    industries: ["international trade and development", "import and export"],
  },
  {
    class: "PS",
    subClass: "PS_DISPLAY",
    weight: 3,
    keywords: [
      "signage",
      "digital signage",
      "display system",
      "system ekspozycyjny",
      "lightbox",
      "smart frame",
      "visual merchandising",
      "exhibition system",
      "graphics installation",
    ],
    industries: ["design services", "visual merchandising"],
  },
  {
    class: "PS",
    subClass: "PS_AD_PRODUCER",
    weight: 3,
    keywords: [
      "reklama",
      "advert",
      "advertising",
      "graphics",
      "sitodruk",
      "drukarnia reklam",
      "reklamowa",
      "printing studio",
      "druk reklamy",
    ],
  },

  // WK – Wykonawcy
  {
    class: "WK",
    subClass: "WK_TRADESHOW_BUILDER",
    weight: 4,
    keywords: [
      "stoisko",
      "stoiska",
      "stand",
      "booth",
      "exhibition stand",
      "trade show",
      "expo",
      "messebau",
      "fair construction",
      "exhibition builder",
      "targi",
      "exhibition design",
    ],
    industries: ["architecture & planning", "design", "events services", "construction"],
  },
  {
    class: "WK",
    subClass: "WK_EVENT_COMPANY",
    weight: 4,
    keywords: [
      "event agency",
      "event production",
      "event management",
      "event services",
      "agencja eventowa",
      "event marketing",
      "live communication",
      "event organizer",
      "eventy",
      "konferencja",
    ],
    industries: ["events services", "entertainment", "hospitality"],
  },
  {
    class: "WK",
    subClass: "WK_RETAIL_EQUIPMENT",
    weight: 3,
    keywords: [
      "pos production",
      "pos manufacture",
      "display production",
      "shop furniture",
      "custom fabrication",
      "fabrication",
      "manufacturing",
      "production facility",
      "woodworking",
      "metal fabrication",
      "producer",
    ],
    industries: ["manufacturing", "furniture", "mechanical or industrial engineering"],
  },
  {
    class: "WK",
    subClass: "WK_BRANDING_STUDIO",
    weight: 3,
    keywords: [
      "interior design",
      "projektowanie wnętrz",
      "design studio",
      "design office",
      "architectural design",
      "concept design",
      "studio projektowe",
      "exhibition design",
      "visualization",
    ],
    industries: ["architecture & planning", "design"],
  },
  {
    class: "WK",
    subClass: "WK_FITOUT_CONTRACTOR",
    weight: 3,
    keywords: [
      "fit-out",
      "fit out",
      "build-out",
      "wykończenia",
      "wykonawstwo",
      "general contractor",
      "construction works",
      "installation services",
      "assembly",
      "montaż",
      "installation",
    ],
    industries: ["construction", "building materials"],
  },
  {
    class: "WK",
    subClass: "WK_ARCHITECTURE",
    weight: 3,
    keywords: [
      "architektura",
      "architekt",
      "studio architektury",
      "architecture",
      "pracownia architektury",
      "biuro architektoniczne",
      "projektant wnętrz",
      "architekt krajobrazu",
    ],
  },

  // WKK – Wartościowi klienci końcowi
  {
    class: "WKK",
    subClass: "WKK_RETAIL_STORE",
    weight: 4,
    keywords: [
      "modularico",
      "modular booth",
      "modular stand",
      "system modularny",
      "stoisko modularne",
      "wynajem stoiska",
      "rental booth",
      "portable booth",
    ],
  },
  {
    class: "WKK",
    subClass: "WKK_RETAIL_STORE",
    weight: 1,
    keywords: [
      "foundation",
      "fundacja",
      "ngo",
      "stowarzyszenie",
      "powiat",
      "urząd",
      "public sector",
      "municipality",
      "museum",
    ],
  },
];

const CLASS_PRIORITIES: Record<ClassCode, number> = {
  PS: 4,
  WK: 3,
  WKK: 2,
};

function containsAny(source: string, needles: string[]): string | null {
  const lower = source.toLowerCase();
  for (const needle of needles) {
    if (needle && lower.includes(needle.toLowerCase())) {
      return needle;
    }
  }
  return null;
}

function registerMatch(
  accumulator: Map<ClassCode, { score: number; signals: string[]; subScores: Map<string, number> }>,
  rule: Rule,
  signal: string
) {
  const entry = accumulator.get(rule.class) || {
    score: 0,
    signals: [],
    subScores: new Map<string, number>(),
  };
  entry.score += rule.weight;
  entry.signals.push(signal);
  if (rule.subClass) {
    const current = entry.subScores.get(rule.subClass) || 0;
    entry.subScores.set(rule.subClass, current + rule.weight);
  }
  accumulator.set(rule.class, entry);
}

function classifyUsingRules(company: CompanyRecord) {
  const accumulator = new Map<ClassCode, { score: number; signals: string[]; subScores: Map<string, number> }>();

  const industry = (company.industry || "").toLowerCase();
  const keywordsList = (company.keywords || "")
    .toLowerCase()
    .split(",")
    .map((kw) => kw.trim())
    .filter(Boolean);
  const name = company.name.toLowerCase();
  const description = [
    company.descriptionPl,
    company.activityDescriptionPl,
    company.description,
    company.activityDescription,
    company.verificationReason,
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();

  for (const rule of CLASS_RULES) {
    let matched = false;

    if (!matched && rule.industries && rule.industries.length > 0) {
      const hit = containsAny(industry, rule.industries);
      if (hit) {
        registerMatch(accumulator, rule, `industry:${hit}`);
        matched = true;
      }
    }

    if (!matched && rule.keywords && rule.keywords.length > 0) {
      for (const kw of rule.keywords) {
        if (keywordsList.includes(kw.toLowerCase())) {
          registerMatch(accumulator, rule, `keyword:${kw}`);
          matched = true;
          break;
        }
        if (!matched && containsAny(name, [kw])) {
          registerMatch(accumulator, rule, `name:${kw}`);
          matched = true;
          break;
        }
        if (!matched && containsAny(description, [kw])) {
          registerMatch(accumulator, rule, `description:${kw}`);
          matched = true;
          break;
        }
      }
    }

    if (!matched && rule.descriptionContains && rule.descriptionContains.length > 0) {
      const hit = containsAny(description, rule.descriptionContains);
      if (hit) {
        registerMatch(accumulator, rule, `desc:${hit}`);
      }
    }
  }

  if (accumulator.size === 0) {
    return {
      class: null as ClassCode | null,
      subClass: null as string | null,
      score: 0,
      signals: [] as string[],
      needsReview: true,
    };
  }

  let bestClass: ClassCode | null = null;
  let bestScore = -Infinity;
  let bestSignals: string[] = [];
  let bestSubClass: string | null = null;

  const sortedEntries = Array.from(accumulator.entries()).sort((a, b) => {
    const [classA, dataA] = a;
    const [classB, dataB] = b;
    if (dataA.score === dataB.score) {
      return (CLASS_PRIORITIES[classB] || 0) - (CLASS_PRIORITIES[classA] || 0);
    }
    return dataB.score - dataA.score;
  });

  const [first] = sortedEntries;
  if (!first) {
    return {
      class: null,
      subClass: null,
      score: 0,
      signals: [],
      needsReview: true,
    };
  }

  bestClass = first[0];
  bestScore = first[1].score;
  bestSignals = first[1].signals;

  if (first[1].subScores.size > 0) {
    const subArr = Array.from(first[1].subScores.entries()).sort((a, b) => b[1] - a[1]);
    bestSubClass = subArr[0][0];
  }

  const needsReview = bestScore <= 0;

  return {
    class: bestClass,
    subClass: bestSubClass,
    score: bestScore,
    signals: bestSignals,
    needsReview,
  };
}

export async function ensureCompanyClassification(company: CompanyRecord): Promise<CompanyRecord> {
  const combinedDescription = [
    company.descriptionPl,
    company.activityDescriptionPl,
    company.description,
    company.activityDescription,
    company.verificationReason,
  ]
    .filter(Boolean)
    .join(" \n ");

  const keywordsArray = (company.keywords || "")
    .split(",")
    .map((kw) => kw.trim())
    .filter(Boolean);

  let industryResult: IndustryClassificationResult | null = null;

  if (company.industry) {
    industryResult = await classifyCompanyIndustry({
      industry: company.industry,
      keywords: keywordsArray,
      description: combinedDescription,
    });
  }

  if (
    industryResult &&
    !industryResult.isUnmapped &&
    industryResult.primaryClass &&
    industryResult.primarySpecialization &&
    industryResult.matches.length > 0
  ) {
    const [topMatch, secondMatch] = industryResult.matches;
    const needsReview = !topMatch || topMatch.score <= 0;

    const signals = industryResult.matches.map((match) =>
      `industry-rule:${match.specializationCode}:${match.score}`
    );

    const shouldUpdate =
      industryResult.primaryClass !== company.classificationClass ||
      industryResult.primarySpecialization !== company.classificationSubClass ||
      needsReview !== company.classificationNeedsReview ||
      (topMatch?.score ?? null) !== company.classificationConfidence ||
      company.classificationSource !== "INDUSTRY_RULE";

    if (shouldUpdate) {
      const updated = await db.company.update({
        where: { id: company.id },
        data: {
          classificationClass: industryResult.primaryClass,
          classificationSubClass: industryResult.primarySpecialization,
          classificationConfidence: topMatch?.score ?? null,
          classificationNeedsReview: needsReview,
          classificationSource: industryResult.matches[0].source === "AI" ? "INDUSTRY_AI" : "INDUSTRY_RULE",
          classificationSignals: signals.length ? JSON.stringify(signals) : null,
          classificationUpdatedAt: new Date(),
        },
      });

      logger.debug("company-segmentation", "Klasyfikacja na podstawie industry rules", {
        companyId: company.id,
        class: industryResult.primaryClass,
        subClass: industryResult.primarySpecialization,
        confidence: topMatch?.score ?? null,
        needsReview,
      });

      return updated as CompanyRecord;
    }

    return company;
  }

  const result = classifyUsingRules(company);

  if (!result.class && !company.classificationClass) {
    if (!company.classificationNeedsReview) {
      return await db.company.update({
        where: { id: company.id },
        data: {
          classificationClass: "WKK",
          classificationSubClass: "WKK_OFFICE_CORPORATE",
          classificationConfidence: 1,
          classificationNeedsReview: false,
          classificationSource: "FALLBACK",
          classificationSignals: JSON.stringify(["fallback:default"]),
          classificationUpdatedAt: new Date(),
        },
      });
    }
    return await db.company.update({
      where: { id: company.id },
      data: {
        classificationClass: "WKK",
        classificationSubClass: "WKK_OFFICE_CORPORATE",
        classificationConfidence: 1,
        classificationNeedsReview: false,
        classificationSource: "FALLBACK",
        classificationSignals: JSON.stringify(["fallback:default"]),
        classificationUpdatedAt: new Date(),
      },
    });
  }

  const shouldUpdate =
    result.class !== company.classificationClass ||
    result.subClass !== company.classificationSubClass ||
    result.needsReview !== company.classificationNeedsReview;

  const targetClass = result.class ?? "WKK";
  const targetSubClass = result.subClass ?? "WKK_OFFICE_CORPORATE";
  const targetNeedsReview = result.needsReview && result.subClass ? true : false;

  if (!shouldUpdate && !targetNeedsReview) {
    return company;
  }

  const data: Prisma.CompanyUpdateInput = {
    classificationClass: targetClass,
    classificationSubClass: targetSubClass,
    classificationConfidence: result.score ?? 1,
    classificationNeedsReview: targetNeedsReview,
    classificationSource: result.subClass ? "RULES" : "FALLBACK",
    classificationSignals: result.signals.length ? JSON.stringify(result.signals) : JSON.stringify(["fallback:default"]),
    classificationUpdatedAt: new Date(),
  };

  const updated = await db.company.update({
    where: { id: company.id },
    data,
  });

  logger.debug("company-segmentation", "Zaktualizowano klasyfikację firmy (fallback rules)", {
    companyId: company.id,
    class: result.class,
    subClass: result.subClass,
    confidence: result.score,
    needsReview: result.needsReview,
  });

  return updated as CompanyRecord;
}