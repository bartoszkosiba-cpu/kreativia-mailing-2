import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { logger } from "./logger";

type CompanyRecord = NonNullable<Awaited<ReturnType<typeof db.company.findUnique>>>;

type ClassCode = "PS" | "WK" | "WKK" | "KK";

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
  // Pośrednicy (agencje, drukarnie, resellerzy)
  {
    class: "PS",
    subClass: "PS_AGENCY",
    weight: 3,
    keywords: [
      "agencja",
      "agency",
      "advertising",
      "marketing agency",
      "media buying",
      "public relations",
      "seo",
      "social media",
      "content marketing",
      "digital marketing",
      "campaign",
    ],
    industries: ["marketing & advertising", "public relations & communications", "online media"],
  },
  {
    class: "PS",
    subClass: "PS_PRINT",
    weight: 3,
    keywords: [
      "drukarnia",
      "druk",
      "print",
      "printing",
      "poligrafia",
      "druk wielkoformatowy",
      "druk cyfrowy",
      "druk offsetowy",
    ],
    industries: ["printing"],
  },
  {
    class: "PS",
    subClass: "PS_ECOMMERCE",
    weight: 2,
    keywords: [
      "sklep",
      "store",
      "e-commerce",
      "sprzedawca",
      "reseller",
      "dropshipping",
      "marketplace",
      "sales platform",
      "shop",
    ],
  },
  {
    class: "PS",
    subClass: "PS_FOREIGN",
    weight: 2,
    keywords: [
      "export",
      "zagran",
      "international",
      "eu market",
      "foreign",
      "global",
    ],
  },
  {
    class: "PS",
    subClass: "PS_SPECIALIZED",
    weight: 2,
    keywords: [
      "smart frame",
      "signage",
      "modularico",
      "distributor",
      "distribution",
      "supplier",
    ],
  },
  // Wykonawcy (stoiska, eventy, producenci)
  {
    class: "WK",
    subClass: "WK_TRADESHOW",
    weight: 4,
    keywords: [
      "stoisko",
      "stand",
      "expo",
      "targi",
      "trade show",
      "booth",
      "wystaw",
      "podwieszenia",
      "expo",
      "oprawa event",
    ],
    industries: ["architecture & planning", "design", "events services", "construction"],
  },
  {
    class: "WK",
    subClass: "WK_EVENT",
    weight: 3,
    keywords: [
      "event",
      "konferencja",
      "scenografia",
      "event production",
      "event management",
      "organizacja wydarzeń",
      "fest",
    ],
    industries: ["events services", "entertainment", "leisure, travel & tourism"],
  },
  {
    class: "WK",
    subClass: "WK_PRODUCTION",
    weight: 2,
    keywords: [
      "produkcja",
      "montaż",
      "instal",
      "fabrication",
      "wykonaw",
      "fit-out",
      "adaptacja",
      "wykończenia",
      "prefab",
    ],
    industries: ["furniture", "mechanical or industrial engineering", "construction", "manufacturing"],
  },
  {
    class: "WK",
    subClass: "WK_DESIGN",
    weight: 2,
    keywords: ["projekt", "design", "projektowanie", "visual", "concept"],
  },
  // Wartościowi klienci końcowi (sieci, duże marki)
  {
    class: "WKK",
    subClass: "WKK_RETAIL",
    weight: 3,
    keywords: [
      "sieć",
      "network",
      "retail",
      "store chain",
      "franczyza",
      "franchise",
      "multi location",
      "concept store",
    ],
    industries: ["retail", "hospitality"],
  },
  {
    class: "WKK",
    subClass: "WKK_BRAND",
    weight: 2,
    keywords: [
      "brand",
      "marka",
      "campaign",
      "marketing team",
      "showroom",
      "flagship",
      "rebranding",
      "merchandising",
    ],
  },
  // Klienci końcowi (pozostali, Modularico)
  {
    class: "KK",
    subClass: "KK_MODULARICO",
    weight: 3,
    keywords: ["modularico", "stoisko modularne", "modular booth"],
  },
  {
    class: "KK",
    subClass: "KK_GENERAL",
    weight: 1,
    keywords: ["foundation", "stowarzyszenie", "ngo", "powiat", "urzad"],
  },
];

const CLASS_PRIORITIES: Record<ClassCode, number> = {
  PS: 4,
  WK: 3,
  WKK: 2,
  KK: 1,
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

  const secondScore = sortedEntries[1]?.[1].score ?? 0;
  const needsReview = bestScore < 2 || bestScore === secondScore;

  return {
    class: bestClass,
    subClass: bestSubClass,
    score: bestScore,
    signals: bestSignals,
    needsReview,
  };
}

export async function ensureCompanyClassification(company: CompanyRecord): Promise<CompanyRecord> {
  const result = classifyUsingRules(company);

  if (!result.class && !company.classificationClass) {
    // Brak klasyfikacji i brak wcześniejszego wpisu – ustaw needs review
    if (!company.classificationNeedsReview) {
      return await db.company.update({
        where: { id: company.id },
        data: {
          classificationNeedsReview: true,
          classificationSource: "RULES",
          classificationSignals: result.signals.length ? JSON.stringify(result.signals) : null,
          classificationUpdatedAt: new Date(),
        },
      });
    }
    return company;
  }

  const shouldUpdate =
    result.class !== company.classificationClass ||
    result.subClass !== company.classificationSubClass ||
    result.needsReview !== company.classificationNeedsReview;

  if (!shouldUpdate && !result.needsReview) {
    return company;
  }

  const data: Prisma.CompanyUpdateInput = {
    classificationClass: result.class,
    classificationSubClass: result.subClass,
    classificationConfidence: result.score,
    classificationNeedsReview: result.needsReview,
    classificationSource: "RULES",
    classificationSignals: result.signals.length ? JSON.stringify(result.signals) : null,
    classificationUpdatedAt: new Date(),
  };

  const updated = await db.company.update({
    where: { id: company.id },
    data,
  });

  logger.debug("company-segmentation", "Zaktualizowano klasyfikację firmy", {
    companyId: company.id,
    class: result.class,
    subClass: result.subClass,
    confidence: result.score,
    needsReview: result.needsReview,
  });

  return updated as CompanyRecord;
}
