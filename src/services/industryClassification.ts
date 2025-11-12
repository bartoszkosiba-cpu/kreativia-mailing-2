import {
  CLASS_BY_SPECIALIZATION,
  CompanyClassCode,
  CompanySpecializationCode,
} from "@/config/companySpecializations";

export interface IndustrySpecializationScore {
  specializationCode: CompanySpecializationCode;
  score: number; // 1 - 5
  explanation?: string;
  source?: "MANUAL" | "AI";
  updatedAt?: Date;
}

export interface IndustryRuleEntry {
  industry: string;
  matches: IndustrySpecializationScore[];
}

export interface IndustryClassificationInput {
  industry?: string | null;
  keywords?: string[];
  description?: string | null;
}

export interface IndustryClassificationResult {
  primarySpecialization: string | null;
  primaryClass: CompanyClassCode | null;
  matches: IndustrySpecializationScore[];
  isUnmapped: boolean;
  reason?: string;
}

export function normalizeIndustryName(industry: string | null | undefined): string | null {
  if (!industry) {
    return null;
  }
  return industry.trim().toLowerCase();
}

export function buildIndustryRuleMap(entries: IndustryRuleEntry[]): Map<string, IndustrySpecializationScore[]> {
  const map = new Map<string, IndustrySpecializationScore[]>();
  for (const entry of entries) {
    const normalized = normalizeIndustryName(entry.industry);
    if (!normalized) continue;
    const matches = [...entry.matches]
      .filter((item) => Boolean(item.specializationCode))
      .map((item) => ({
        ...item,
        score: clampScore(item.score),
      }))
      .sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      map.set(normalized, matches);
    }
  }
  return map;
}

export function classifyIndustry(
  input: IndustryClassificationInput,
  rules: Map<string, IndustrySpecializationScore[]>
): IndustryClassificationResult {
  const normalized = normalizeIndustryName(input.industry ?? undefined);
  if (!normalized) {
    return {
      primarySpecialization: null,
      primaryClass: null,
      matches: [],
      isUnmapped: true,
      reason: "Brak wartości industry",
    };
  }

  const matches = (rules.get(normalized) ?? []).sort((a, b) => b.score - a.score);
  const top = matches[0];
  const primaryClass = top ? CLASS_BY_SPECIALIZATION.get(top.specializationCode) ?? null : null;

  return {
    primarySpecialization: top?.specializationCode ?? null,
    primaryClass,
    matches,
    isUnmapped: matches.length === 0,
    reason: matches.length === 0 ? "Brak zdefiniowanej reguły dla industry" : undefined,
  };
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  if (score < 0) return 0;
  if (score > 5) return 5;
  return Math.round(score * 10) / 10;
}
