import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listPersonaVerifications, savePersonaVerification, getPersonaVerification } from "@/services/personaVerificationService";
import { fetchApolloEmployeesForCompany } from "@/services/apolloEmployeesService";
import { getPersonaCriteria } from "@/services/personaCriteriaService";
import { getPersonaBrief } from "@/services/personaBriefService";
import {
  verifyEmployeesWithAI,
  classifyPersonByRules,
  type PersonaRuleClassification,
} from "@/services/personaVerificationAI";
import { analyseJobTitle } from "@/utils/jobTitleHelpers";
import { logger } from "@/services/logger";

type PersonaVerificationAction = "reuse" | "refresh" | "reverify";

function buildEmployeeKey(person: any) {
  if (person.id) return String(person.id).toLowerCase();
  return `${person.name || ""}|${person.title || ""}`.toLowerCase();
}

async function computeVerification(
  companyId: number,
  action: PersonaVerificationAction
) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    throw new Error("Firma nie istnieje w bazie");
  }

  const existing = await getPersonaVerification(companyId);

  if (action === "reuse" && existing) {
    const employees = JSON.parse(existing.employees);
    const metadata = existing.metadata ? JSON.parse(existing.metadata) : {};
    return {
      fromCache: true,
      saved: existing,
      employees,
      metadata,
    };
  }

  let employeesSource: any = null;

  if (action === "reverify" && existing) {
    employeesSource = {
      success: true,
      people: JSON.parse(existing.employees),
      statistics: existing.metadata ? JSON.parse(existing.metadata)?.statistics ?? null : null,
      uniqueTitles: existing.metadata ? JSON.parse(existing.metadata)?.uniqueTitles ?? [] : [],
      apolloOrganization: existing.metadata ? JSON.parse(existing.metadata)?.apolloOrganization ?? null : null,
      company: { id: company.id, name: company.name, website: null },
    };
  } else {
    employeesSource = await fetchApolloEmployeesForCompany(companyId);
    if (!employeesSource.success) {
      throw new Error(employeesSource.message || "Błąd pobierania pracowników z Apollo");
    }
  }

  const activeCriteria = await db.companyVerificationCriteria.findFirst({
    where: { isActive: true, isDefault: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!activeCriteria) {
    throw new Error("Brak aktywnej konfiguracji person");
  }

  const personaCriteria = await getPersonaCriteria(activeCriteria.id);
  if (!personaCriteria) {
    throw new Error("Brak zdefiniowanych person dla bieżących kryteriów");
  }

  const personaBrief = await getPersonaBrief(personaCriteria.id);

  const includeSeniority =
    (personaCriteria.positiveRoles ?? []).some((role) => role.minSeniority) ||
    (personaCriteria.negativeRoles ?? []).some((role) => role.minSeniority);

  type EmployeeInputRecord = {
    person: any;
    matchKey: string;
    input: {
      id?: string;
      matchKey: string;
      name?: string;
      title?: string;
      titleNormalized?: string;
      titleEnglish?: string;
      departments: string[];
      seniority: string | null;
      emailStatus: string | null;
      managesPeople: boolean;
      managesProcesses: boolean;
      isExecutive: boolean;
      semanticHint: string | null;
    };
  };

  const employeeInputs: EmployeeInputRecord[] = (employeesSource.people || []).map((person: any) => {
    const analysis = analyseJobTitle(person.title);
    const matchKey = buildEmployeeKey(person);
    const input = {
      id: person.id ? String(person.id) : undefined,
      matchKey,
      name: typeof person.name === "string" ? person.name : undefined,
      title: typeof person.title === "string" ? person.title : undefined,
      titleNormalized: analysis.normalized ?? undefined,
      titleEnglish: analysis.english ?? undefined,
      departments: Array.isArray(person.departments)
        ? person.departments.filter((dep: unknown): dep is string => typeof dep === "string")
        : [],
      seniority: includeSeniority ? person.seniority ?? null : null,
      emailStatus: person.emailStatus ?? person.email_status ?? null,
      managesPeople: analysis.managesPeople,
      managesProcesses: analysis.managesProcesses,
      isExecutive: analysis.isExecutive,
      semanticHint: analysis.semanticHint,
    };

    return {
      person,
      matchKey,
      input,
    };
  });

  const ruleClassifications = new Map<string, PersonaRuleClassification>();
  const employeesForAI: typeof employeeInputs[number]["input"][] = [];

  for (const { matchKey, input } of employeeInputs) {
    const ruleResult = classifyPersonByRules(input, personaCriteria);
    if (ruleResult) {
      const keyLower = matchKey.toLowerCase();
      ruleClassifications.set(keyLower, ruleResult);
      if (input.id) {
        ruleClassifications.set(String(input.id).toLowerCase(), ruleResult);
      }
    } else {
      employeesForAI.push(input);
    }
  }

  let aiResults: Awaited<ReturnType<typeof verifyEmployeesWithAI>>["results"] = [];
  if (employeesForAI.length > 0) {
    const aiResponse = await verifyEmployeesWithAI(personaCriteria, employeesForAI, personaBrief);
    aiResults = aiResponse.results;
  }

  const classificationMap = new Map<string, { decision: string; reason: string; score?: number }>();
  for (const result of aiResults) {
    const keys: string[] = [];
    if (typeof result.id === "string" && result.id.trim()) {
      keys.push(result.id.toLowerCase());
    }
    if (typeof result.matchKey === "string" && result.matchKey.trim()) {
      keys.push(result.matchKey.toLowerCase());
    }
    if (!keys.length) {
      continue;
    }
    for (const key of keys) {
      classificationMap.set(key, {
        decision: result.decision,
        reason: result.reason || "",
        score: typeof result.score === "number" ? result.score : undefined,
      });
    }
  }

  const aiDecisionsMap = new Map<
    string,
    { decision: string; score: number | null; reason: string; overridden?: boolean; source?: string }
  >();

  const enrichedEmployees = employeeInputs.map(({ person, matchKey, input }) => {
    const key = matchKey;
    const lookupKey = input.id ? String(input.id).toLowerCase() : key;

    const ruleInfo = ruleClassifications.get(lookupKey) || ruleClassifications.get(key);
    const aiInfo = classificationMap.get(lookupKey) || classificationMap.get(key);

    let decision: string = "negative"; // Domyślnie negative - jeśli nie ma pewności, nie dodajemy do pozytywnych
    let score: number | null = null;
    let reason = "Brak dopasowania reguł ani dodatkowych informacji.";
    let personaMatchOverridden = false;
    let source: string | undefined;

    if (ruleInfo) {
      decision = ruleInfo.decision === "conditional" ? "negative" : ruleInfo.decision; // Konwertuj conditional na negative
      score = ruleInfo.decision === "positive" ? 1 : ruleInfo.decision === "negative" ? 0 : null;
      reason = ruleInfo.reason;
      personaMatchOverridden = true;
      source = ruleInfo.source;
    } else if (aiInfo) {
      decision = aiInfo.decision === "conditional" ? "negative" : (aiInfo.decision ?? "negative"); // Konwertuj conditional na negative
      score = typeof aiInfo.score === "number" ? aiInfo.score : null;
      reason = aiInfo.reason && aiInfo.reason.trim().length > 0 ? aiInfo.reason : "AI nie podał szczegółowego uzasadnienia.";
      source = "ai";
    } else {
      decision = "negative";
      score = null;
      reason = "AI nie dostarczyło klasyfikacji dla tego stanowiska.";
      source = "ai";
    }

    const scoreText = score !== null ? `Ocena: ${(score * 100).toFixed(0)}%` : null;
    const combinedReason = [scoreText, reason].filter(Boolean).join(" — ");

    aiDecisionsMap.set(lookupKey, {
      decision,
      score,
      reason,
      overridden: personaMatchOverridden,
      source,
    });
    if (key !== lookupKey) {
      aiDecisionsMap.set(key, {
        decision,
        score,
        reason,
        overridden: personaMatchOverridden,
        source,
      });
    }

    return {
      ...person,
      personaMatchStatus: decision,
      personaMatchScore: score,
      personaMatchReason: combinedReason,
      aiDecision: decision,
      aiScore: score,
      aiReason: reason,
      personaMatchOverridden,
    };
  });

  const positiveCount = enrichedEmployees.filter((person: any) => person.personaMatchStatus === "positive").length;
  const negativeCount = enrichedEmployees.filter((person: any) => person.personaMatchStatus === "negative").length;
  // Usunięto conditional - wszystkie są teraz positive lub negative
  const unknownCount = enrichedEmployees.length - positiveCount - negativeCount;

  const saved = await savePersonaVerification({
    companyId,
    personaCriteriaId: personaCriteria.id,
    positiveCount,
    negativeCount,
      unknownCount: unknownCount,
    employees: enrichedEmployees,
    metadata: {
      statistics: employeesSource.statistics,
      uniqueTitles: employeesSource.uniqueTitles,
      apolloOrganization: employeesSource.apolloOrganization,
      creditsInfo: employeesSource.creditsInfo,
      personaBrief,
      aiDecisions: Object.fromEntries(aiDecisionsMap),
    },
  });

  return {
    fromCache: false,
    saved,
    employees: enrichedEmployees,
    metadata: {
      statistics: employeesSource.statistics,
      uniqueTitles: employeesSource.uniqueTitles,
      apolloOrganization: employeesSource.apolloOrganization,
      creditsInfo: employeesSource.creditsInfo,
      personaBrief,
      aiDecisions: Object.fromEntries(aiDecisionsMap),
    },
    aiDecisions: Object.fromEntries(aiDecisionsMap),
  };
}

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 200;

  const results = await listPersonaVerifications();
  const sliced = results.slice(0, Number.isNaN(limit) ? 200 : limit);

  const companyIds = sliced.map((entry) => entry.companyId);
  const companies = companyIds.length
    ? await db.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true, website: true, industry: true },
      })
    : [];

  const companyMap = new Map(companies.map((item) => [item.id, item]));

    return NextResponse.json({
      success: true,
    data: sliced.map((entry) => ({
      id: entry.id,
      companyId: entry.companyId,
      company: companyMap.get(entry.companyId) ?? null,
      positiveCount: entry.positiveCount,
      negativeCount: entry.negativeCount,
      unknownCount: entry.unknownCount,
      totalCount: entry.positiveCount + entry.negativeCount + entry.unknownCount,
      verifiedAt: entry.verifiedAt,
      })),
    });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const action = (body.action as PersonaVerificationAction) || "reuse";

    if (!companyId || Number.isNaN(companyId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID firmy" }, { status: 400 });
    }

    let result;
    try {
      result = await computeVerification(companyId, action);
    } catch (error) {
      throw error;
    }

    const { saved, employees, metadata, fromCache, aiDecisions } = result;
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, website: true },
    });

    return NextResponse.json({
      success: true,
      fromCache,
      verificationId: saved?.id ?? null,
      counts: {
        positive: saved?.positiveCount ?? 0,
        negative: saved?.negativeCount ?? 0,
        unknown: saved?.unknownCount ?? 0,
        total: (saved?.positiveCount ?? 0) + (saved?.negativeCount ?? 0) + (saved?.unknownCount ?? 0),
      },
      verifiedAt: saved?.verifiedAt ?? null,
      data: {
        company,
        apolloOrganization: metadata?.apolloOrganization ?? null,
        statistics: metadata?.statistics ?? null,
        uniqueTitles: metadata?.uniqueTitles ?? [],
        creditsInfo: metadata?.creditsInfo ?? null,
        people: employees.map((employee: any) => {
          const lookupKey = employee.id ? String(employee.id).toLowerCase() : buildEmployeeKey(employee);
          const aiInfo = (metadata?.aiDecisions ?? aiDecisions ?? {})[lookupKey] ?? null;
          return {
            ...employee,
            aiDecision: aiInfo?.decision ?? employee.aiDecision ?? null,
            aiScore: aiInfo?.score ?? employee.aiScore ?? null,
            aiReason: aiInfo?.reason ?? employee.aiReason ?? null,
            personaMatchOverridden: aiInfo?.overridden ?? employee.personaMatchOverridden ?? false,
          };
        }),
        summary: {
          positiveCount: saved?.positiveCount ?? 0,
          negativeCount: saved?.negativeCount ?? 0,
          unknownCount: saved?.unknownCount ?? 0,
        },
        personaBrief: metadata?.personaBrief ?? null,
        aiDecisions: metadata?.aiDecisions ?? aiDecisions ?? {},
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-verification", "Błąd weryfikacji person", { error: err.message, stack: err.stack });
    return NextResponse.json(
      { success: false, error: err.message || "Błąd weryfikacji person" },
      { status: 500 }
    );
  }
}
