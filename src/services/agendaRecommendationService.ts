import { logger } from "@/services/logger";

export interface GenerateAgendaInput {
  campaignId: number;
  companyId: number;
  personaCriteriaId: number;
  limit?: number;
  requestedBy?: string;
}

export interface AgendaDecisionInput {
  id: number;
  status: "approved" | "rejected";
  decidedBy?: string;
  notes?: string;
}

export interface FetchEmailInput {
  id: number;
  requestedBy?: string;
}

export interface AgendaRecommendationPlaceholder {
  id: number;
  campaignId: number;
  companyId: number;
  status: "pending" | "approved" | "rejected" | "email_fetched";
  fullName: string;
  title: string;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MODULE_NAME = "agenda-recommendation";

function logDisabled(action: string) {
  logger.warn(MODULE_NAME, `${action} – moduł rekomendacji agendy jest obecnie wyłączony.`);
}

export async function listAgendaRecommendations(_params: {
  campaignId: number;
  status?: string;
}): Promise<AgendaRecommendationPlaceholder[]> {
  logDisabled("listAgendaRecommendations");
  return [];
}

export async function generateAgendaRecommendations(
  _input: GenerateAgendaInput
): Promise<{
  created: number;
  skipped: number;
  existing: number;
  recommendations: AgendaRecommendationPlaceholder[];
}> {
  logDisabled("generateAgendaRecommendations");
  return {
    created: 0,
    skipped: 0,
    existing: 0,
    recommendations: [],
  };
}

export async function updateAgendaRecommendation(_input: AgendaDecisionInput) {
  logDisabled("updateAgendaRecommendation");
  throw new Error("Moduł rekomendacji agendy jest wyłączony.");
}

export async function fetchRecommendationEmail(_input: FetchEmailInput) {
  logDisabled("fetchRecommendationEmail");
  throw new Error("Moduł rekomendacji agendy jest wyłączony.");
}
