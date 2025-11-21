/**
 * Typy dla modułu company-selection
 */

export interface CompanyPreview {
  id: number;
  name: string;
  industry: string | null;
  market: string | null;
  description?: string | null;
  activityDescription?: string | null;
  keywords?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  street?: string | null;
  postalCode?: string | null;
  verificationStatus: string | null;
  importBatch?: {
    id: number;
    name: string;
    language: string;
    market: string;
  } | null;
  classifications?: Array<{
    specializationCode: string;
    score: number;
    confidence: number | null;
    isPrimary: boolean;
    reason?: string | null;
  }>;
}

export interface CompanyStats {
  pending: number;
  qualified: number;
  rejected: number;
  needsReview: number;
  total: number;
}

export interface SelectionFilters {
  specializationCodes?: string[];
  onlyPrimary?: boolean;
  minScore?: number;
  minConfidence?: number;
  languages?: string[];
  importBatchIds?: number[];
}

export type MarketOption = "PL" | "DE" | "FR" | "EN";
export type LanguageOption = "PL" | "EN" | "DE" | "FR";

