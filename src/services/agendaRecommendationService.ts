import { AgendaRecommendation, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import {
  getPersonaCriteria,
  type PersonaCriteriaDto,
  type PersonaRoleConfig,
} from "@/services/personaCriteriaService";
import {
  enrichPerson,
  searchPeopleFromOrganization,
  type ApolloPerson,
} from "@/services/apolloService";

const DEFAULT_LIMIT = 25;

const SENIORITY_ORDER = [
  "intern",
  "entry",
  "junior",
  "mid",
  "senior",
  "manager",
  "director",
  "vp",
  "c_suite",
  "founder",
  "owner",
  "partner",
  "principal",
  "executive",
];

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

export async function listAgendaRecommendations(params: {
  campaignId: number;
  status?: string;
}): Promise<AgendaRecommendation[]> {
  const { campaignId, status } = params;

  return db.agendaRecommendation.findMany({
    where: {
      campaignId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function generateAgendaRecommendations(
  input: GenerateAgendaInput
): Promise<{
  created: number;
  skipped: number;
  existing: number;
  recommendations: AgendaRecommendation[];
}> {
  const { campaignId, companyId, personaCriteriaId } = input;
  const limit = input.limit ?? DEFAULT_LIMIT;

  const personaCriteria = await getPersonaCriteria(personaCriteriaId);
  if (!personaCriteria) {
    throw new Error("Brak konfiguracji person dla podanego kryterium");
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new Error("Nie znaleziono firmy");
  }

  const organizationId = company.apolloAccountId ?? undefined;
  const domain = extractDomain(company.website);

  if (!organizationId && !domain) {
    throw new Error("Brak informacji potrzebnych do wyszukania osób (domena / konto Apollo)");
  }

  const peopleResult = await searchPeopleFromOrganization(
    organizationId,
    undefined,
    domain,
    { perPage: limit }
  );

  const people = peopleResult.people ?? [];

  const created: AgendaRecommendation[] = [];
  let skipped = 0;
  let existing = 0;

  for (const person of people) {
    const evaluation = evaluatePerson(person, personaCriteria);

    if (evaluation.decision === "rejected") {
      skipped += 1;
      continue;
    }

    if (evaluation.decision === "skip") {
      skipped += 1;
      continue;
    }

    const orFilters: Prisma.AgendaRecommendationWhereInput[] = [
      {
        fullName: person.name,
        title: person.title ?? "",
      },
    ];

    if (person.id) {
      orFilters.push({ externalId: person.id });
    }

    const alreadyExists = await db.agendaRecommendation.findFirst({
      where: {
        campaignId,
        companyId,
        OR: orFilters,
      },
    });

    if (alreadyExists) {
      existing += 1;
      continue;
    }

    const record = await db.agendaRecommendation.create({
      data: {
        campaignId,
        companyId,
        externalId: person.id,
        fullName: person.name || person.linkedin_url || "Nieznane imię",
        title: person.title || "",
        email:
          person.email && !person.email.includes("email_not_unlocked@domain.com")
            ? person.email
            : null,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        sourceUrl: person.linkedin_url || person.organization?.linkedin_url || null,
        metadata: JSON.stringify({
          departments: Array.isArray(person.departments) ? person.departments : [],
          subdepartments: Array.isArray(person.subdepartments) ? person.subdepartments : [],
          seniority: person.seniority ?? null,
          organizationName: person.organization?.name,
          organizationId: person.organization?.id,
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: null,
      },
    });

    created.push(record);
  }

  logger.info("agenda-recommendation", "Wygenerowano rekomendacje", {
    campaignId,
    companyId,
    created: created.length,
    skipped,
    existing,
  });

  return {
    created: created.length,
    skipped,
    existing,
    recommendations: created,
  };
}

export async function updateAgendaRecommendation(input: AgendaDecisionInput) {
  const { id, status, decidedBy, notes } = input;

  const record = await db.agendaRecommendation.findUnique({ where: { id } });
  if (!record) {
    throw new Error("Rekomendacja nie istnieje");
  }

  return db.agendaRecommendation.update({
    where: { id },
    data: {
      status,
      decidedBy: decidedBy ?? null,
      decidedAt: new Date(),
      notes: notes ?? record.notes,
      updatedAt: new Date(),
    },
  });
}

export async function fetchRecommendationEmail(input: FetchEmailInput) {
  const { id, requestedBy } = input;

  const record = await db.agendaRecommendation.findUnique({ where: { id } });
  if (!record) {
    throw new Error("Rekomendacja nie istnieje");
  }

  if (record.status !== "approved" && record.status !== "email_fetched") {
    throw new Error("Email można pobrać dopiero po zatwierdzeniu rekomendacji");
  }

  if (!record.externalId) {
    throw new Error("Brak identyfikatora w Apollo – nie można pobrać emaila");
  }

  const person = await enrichPerson(record.externalId);
  const email = person.email && person.email.includes("email_not_unlocked") ? null : person.email;

  if (!email) {
    throw new Error("Apollo nie zwróciło adresu email (prawdopodobnie brak kredytów lub ograniczenia)");
  }

  return db.agendaRecommendation.update({
    where: { id },
    data: {
      email,
      status: "email_fetched",
      updatedAt: new Date(),
      decidedBy: requestedBy ?? record.decidedBy,
      decidedAt: new Date(),
    },
  });
}

function extractDomain(url?: string | null): string | undefined {
  if (!url) return undefined;

  try {
    const normalized = url.trim();
    const withProtocol = normalized.startsWith("http") ? normalized : `https://${normalized}`;
    const hostname = new URL(withProtocol).hostname;
    return hostname.replace(/^www\./, "");
  } catch (error) {
    return undefined;
  }
}

function evaluatePerson(person: ApolloPerson, criteria: PersonaCriteriaDto): {
  decision: "accept" | "rejected" | "skip";
  confidence: number | null;
  reasoning: string | null;
} {
  const title = person.title?.toLowerCase() ?? "";

  if (!title) {
    return { decision: "skip", confidence: null, reasoning: null };
  }

  // negatywne role
  for (const neg of criteria.negativeRoles ?? []) {
    if (matchesRole(title, person, neg)) {
      return {
        decision: "rejected",
        confidence: null,
        reasoning: `Odrzucono – dopasowanie do negatywnej persony (${neg.label})`,
      };
    }
  }

  let bestScore = 0;
  let bestReason: string | null = null;

  for (const role of criteria.positiveRoles ?? []) {
    const score = scoreRole(title, person, role);
    if (score.score > bestScore) {
      bestScore = score.score;
      bestReason = score.reason;
    }
  }

  if (bestScore <= 0) {
    return { decision: "skip", confidence: null, reasoning: null };
  }

  return {
    decision: "accept",
    confidence: Math.min(bestScore, 1),
    reasoning: bestReason,
  };
}

function matchesRole(title: string, person: ApolloPerson, role: PersonaRoleConfig) {
  const baseLabel = role.label?.toLowerCase() ?? "";
  const keywords = role.keywords?.map((k) => k.toLowerCase()) ?? [];

  if (baseLabel && title.includes(baseLabel)) {
    return true;
  }

  return keywords.some((kw) => title.includes(kw));
}

function scoreRole(
  title: string,
  person: ApolloPerson,
  role: PersonaRoleConfig
) {
  let score = role.confidence ?? 0.3;
  const reasons: string[] = [];
  const label = role.label.toLowerCase();
  const keywords = role.keywords?.map((kw) => kw.toLowerCase()) ?? [];
  const departments = Array.isArray(person.departments) ? person.departments : [];

  if (title.includes(label)) {
    score += 0.3;
    reasons.push(`tytuł zawiera "${role.label}"`);
  }

  for (const kw of keywords) {
    if (title.includes(kw)) {
      score += 0.1;
      reasons.push(`słowo kluczowe: ${kw}`);
      break;
    }
  }

  if (role.departments && role.departments.length > 0) {
    const depMatch = departments.some((dep) =>
      role.departments!.some((expected) => dep.toLowerCase() === expected.toLowerCase())
    );
    if (depMatch) {
      score += 0.1;
      reasons.push(`dział: ${departments.join(", ")}`);
    }
  }

  if (role.minSeniority) {
    const requiredRank = seniorityRank(role.minSeniority);
    const personRank = seniorityRank(person.seniority ?? "");
    if (personRank >= requiredRank) {
      score += 0.15;
      reasons.push(`seniority: ${person.seniority ?? "unknown"}`);
    } else {
      score -= 0.1;
    }
  }

  if (score <= 0) {
    return { score: 0, reason: null };
  }

  return {
    score,
    reason: reasons.length > 0 ? `${role.label}: ${reasons.join(", ")}` : role.label,
  };
}

function seniorityRank(value: string): number {
  const idx = SENIORITY_ORDER.indexOf(value.toLowerCase());
  return idx === -1 ? 0 : idx;
}
