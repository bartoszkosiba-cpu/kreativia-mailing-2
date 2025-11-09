import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchApolloEmployeesForCompany } from "@/services/apolloEmployeesService";
import { getPersonaCriteria } from "@/services/personaCriteriaService";
import { getPersonaBrief } from "@/services/personaBriefService";
import { verifyEmployeesWithAI } from "@/services/personaVerificationAI";
import {
  savePersonaVerification,
  getPersonaVerification,
} from "@/services/personaVerificationService";
import { analyseJobTitle } from "@/utils/jobTitleHelpers";

function buildEmployeeKey(person: any) {
  if (person.id) return String(person.id);
  return `${person.name || ""}|${person.title || ""}`.toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const force = Boolean(body.force);
    const useStoredEmployees = Boolean(body.useStoredEmployees);

    if (!companyId || Number.isNaN(companyId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe companyId" }, { status: 400 });
    }

    const existing = await getPersonaVerification(companyId);

    if (!force && existing) {
      return NextResponse.json({
        success: true,
        source: "cache",
        data: {
          companyId,
          personaCriteriaId: existing.personaCriteriaId,
          positiveCount: existing.positiveCount,
          negativeCount: existing.negativeCount,
          unknownCount: existing.unknownCount,
          verifiedAt: existing.verifiedAt,
          employees: JSON.parse(existing.employees),
          metadata: existing.metadata ? JSON.parse(existing.metadata) : null,
        },
      });
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });

    if (!company) {
      return NextResponse.json({ success: false, error: "Firma nie istnieje" }, { status: 404 });
    }

    const activeCriteria = await db.companyVerificationCriteria.findFirst({
      where: { isActive: true, isDefault: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!activeCriteria) {
      return NextResponse.json(
        { success: false, error: "Brak aktywnej konfiguracji kryteriów person" },
        { status: 400 }
      );
    }

    const personaCriteria = await getPersonaCriteria(activeCriteria.id);
    if (!personaCriteria) {
      return NextResponse.json(
        { success: false, error: "Brak zdefiniowanych person dla bieżących kryteriów" },
        { status: 400 }
      );
    }

    const personaBrief = await getPersonaBrief(personaCriteria.id);

    let employeesResult = null;

    if (useStoredEmployees && existing) {
      employeesResult = {
        success: true,
        company: { id: companyId, name: company.name, website: null },
        people: JSON.parse(existing.employees),
        statistics: existing.metadata ? JSON.parse(existing.metadata)?.statistics ?? null : null,
        uniqueTitles: existing.metadata ? JSON.parse(existing.metadata)?.uniqueTitles ?? [] : [],
        apolloOrganization: existing.metadata ? JSON.parse(existing.metadata)?.apolloOrganization ?? null : null,
      };
    } else {
      const fetched = await fetchApolloEmployeesForCompany(companyId);
      if (!fetched.success) {
        return NextResponse.json(
          { success: false, error: fetched.message || "Błąd pobierania pracowników z Apollo" },
          { status: fetched.apiAccessError ? 403 : 500 }
        );
      }
      employeesResult = fetched;
    }

    const employeesForAI = (employeesResult.people || []).map((person: any) => {
      const analysis = analyseJobTitle(person.title);
      return {
        id: person.id ? String(person.id) : undefined,
        name: person.name,
        title: person.title,
        titleNormalized: analysis.normalized,
        titleEnglish: analysis.english,
        departments: Array.isArray(person.departments) ? person.departments : [],
        seniority: person.seniority ?? null,
        emailStatus: person.emailStatus ?? person.email_status ?? null,
        managesPeople: analysis.managesPeople,
        managesProcesses: analysis.managesProcesses,
        isExecutive: analysis.isExecutive,
        semanticHint: analysis.semanticHint,
      };
    });

    const aiResponse = await verifyEmployeesWithAI(personaCriteria, employeesForAI, personaBrief);

    const classificationMap = new Map<string, { decision: string; reason: string; score?: number }>();
    for (const result of aiResponse.results) {
      if (!result.id) continue;
      classificationMap.set(result.id.toLowerCase(), {
        decision: result.decision,
        reason: result.reason || "",
        score: typeof result.score === "number" ? result.score : undefined,
      });
    }

    const enrichedEmployees = (employeesResult.people || []).map((person: any) => {
      const key = buildEmployeeKey(person);
      const aiInfo = classificationMap.get(key);
      const scoreText = typeof aiInfo?.score === "number" ? `Ocena: ${(aiInfo.score * 100).toFixed(0)}%` : null;
      const combinedReason = [scoreText, aiInfo?.reason].filter(Boolean).join(" — ");
      return {
        ...person,
        personaMatchStatus: aiInfo?.decision ?? "conditional",
        personaMatchReason: combinedReason,
        personaMatchScore: aiInfo?.score ?? null,
      };
    });

    const positiveCount = enrichedEmployees.filter((p: any) => p.personaMatchStatus === "positive").length;
    const negativeCount = enrichedEmployees.filter((p: any) => p.personaMatchStatus === "negative").length;
    const conditionalCount = enrichedEmployees.filter((p: any) => p.personaMatchStatus === "conditional").length;
    const unknownCount = enrichedEmployees.length - positiveCount - negativeCount - conditionalCount;

    const saved = await savePersonaVerification({
      companyId,
      personaCriteriaId: personaCriteria.id,
      positiveCount,
      negativeCount,
      unknownCount: conditionalCount + unknownCount,
      employees: enrichedEmployees,
      metadata: {
        statistics: employeesResult.statistics,
        uniqueTitles: employeesResult.uniqueTitles,
        apolloOrganization: employeesResult.apolloOrganization,
        personaBrief,
      },
    });

    return NextResponse.json({
      success: true,
      source: "fresh",
      data: {
        companyId,
        personaCriteriaId: personaCriteria.id,
        positiveCount,
        negativeCount,
        unknownCount: conditionalCount + unknownCount,
        verifiedAt: saved.verifiedAt,
        employees: enrichedEmployees,
        metadata: {
          statistics: employeesResult.statistics,
          uniqueTitles: employeesResult.uniqueTitles,
          apolloOrganization: employeesResult.apolloOrganization,
          personaBrief,
        },
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[personas.verify] Błąd:", err);
    return NextResponse.json(
      { success: false, error: "Błąd weryfikacji person", details: err.message },
      { status: 500 }
    );
  }
}

