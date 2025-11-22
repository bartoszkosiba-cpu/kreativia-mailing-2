import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchApolloEmployeesForCompany } from "@/services/apolloEmployeesService";
import { getPersonaCriteria, getPersonaCriteriaById } from "@/services/personaCriteriaService";
import { getPersonaBrief } from "@/services/personaBriefService";
import { verifyEmployeesWithAI } from "@/services/personaVerificationAI";
import {
  savePersonaVerification,
  getPersonaVerification,
} from "@/services/personaVerificationService";
import { analyseJobTitle } from "@/utils/jobTitleHelpers";
import { logger } from "@/services/logger";

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
    const personaCriteriaId = body.personaCriteriaId ? Number(body.personaCriteriaId) : null;
    const providedEmployees = body.employees; // Opcjonalnie: persony przekazane w body

    if (!companyId || Number.isNaN(companyId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe companyId" }, { status: 400 });
    }

    // Użyj personaCriteriaId z body, jeśli jest dostępne
    const criteriaIdForLookup = personaCriteriaId ?? null;
    const existing = await getPersonaVerification(companyId, criteriaIdForLookup);

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

    let personaCriteria = null;

    // Jeśli podano personaCriteriaId, użyj go bezpośrednio
    if (personaCriteriaId && Number.isFinite(personaCriteriaId)) {
      personaCriteria = await getPersonaCriteriaById(personaCriteriaId);
      if (!personaCriteria) {
        return NextResponse.json(
          { success: false, error: "Nie znaleziono kryteriów person o podanym ID" },
          { status: 404 }
        );
      }
    } else {
      // Fallback: szukaj przez CompanyVerificationCriteria (stara logika)
      const activeCriteria = await db.companyVerificationCriteria.findFirst({
        where: { isActive: true, isDefault: true },
        orderBy: { updatedAt: "desc" },
      });

      if (!activeCriteria) {
        return NextResponse.json(
          { success: false, error: "Brak aktywnej konfiguracji kryteriów person. Wybierz kryteria person lub ustaw domyślne kryteria firm." },
          { status: 400 }
        );
      }

      personaCriteria = await getPersonaCriteria(activeCriteria.id);
      if (!personaCriteria) {
        return NextResponse.json(
          { success: false, error: "Brak zdefiniowanych person dla bieżących kryteriów" },
          { status: 400 }
        );
      }
    }

    // Pobierz personaBrief - używamy personaCriteria.id (który jest CompanyPersonaCriteria.id)
    const personaBrief = await getPersonaBrief(personaCriteria.id);

    let employeesResult = null;

    // Jeśli persony są przekazane w body, użyj ich
    if (providedEmployees && Array.isArray(providedEmployees) && providedEmployees.length > 0) {
      // Użyj przekazanych person (np. z Apollo)
      employeesResult = {
        success: true,
        company: { id: companyId, name: company.name, website: null },
        people: providedEmployees,
        statistics: body.statistics || null,
        uniqueTitles: body.uniqueTitles || [],
        apolloOrganization: body.apolloOrganization || null,
      };
    } else if (useStoredEmployees && existing) {
      // Użyj zapisanych person z bazy (z tego samego personaCriteriaId lub z null jeśli nie ma weryfikacji AI)
      const existingMetadata = existing.metadata ? JSON.parse(existing.metadata) : {};
      employeesResult = {
        success: true,
        company: { id: companyId, name: company.name, website: null },
        people: JSON.parse(existing.employees),
        statistics: existingMetadata.statistics ?? null,
        uniqueTitles: existingMetadata.uniqueTitles ?? [],
        apolloOrganization: existingMetadata.apolloOrganization ?? null,
        apolloFetchedAt: existingMetadata.apolloFetchedAt || null, // Zachowaj datę pobrania z Apollo
      };
    } else {
      // Pobierz persony z Apollo
      const fetched = await fetchApolloEmployeesForCompany(companyId);
      if (!fetched.success) {
        return NextResponse.json(
          { success: false, error: fetched.message || "Błąd pobierania pracowników z Apollo" },
          { status: fetched.apiAccessError ? 403 : 500 }
        );
      }
      employeesResult = fetched;
    }

    // Funkcja pomocnicza do sprawdzania, czy email jest dostępny
    const hasAvailableEmail = (person: any): boolean => {
      // Email jest dostępny jeśli:
      // 1. Ma faktyczny adres email
      // 2. Lub emailUnlocked === true
      // 3. Lub emailStatus jest w: "verified", "guessed", "unverified", "extrapolated", "available"
      // Dla bezpłatnego API (/mixed_people/api_search) mamy emailStatus: "available" (z has_email: true)
      if (person.email) return true;
      if (person.emailUnlocked) return true;
      const status = (person.emailStatus || person.email_status || person.contact_email_status)?.toLowerCase();
      return status === "verified" || status === "guessed" || status === "unverified" || status === "extrapolated" || status === "available";
    };
    
    // Filtruj persony - weryfikuj tylko te z dostępnym e-mailem
    const employeesWithEmail = (employeesResult.people || []).filter(hasAvailableEmail);
    
    const employeesForAI = employeesWithEmail.map((person: any) => {
      const analysis = analyseJobTitle(person.title);
      const matchKey = buildEmployeeKey(person); // Utwórz matchKey używając tej samej funkcji co do mapowania
      return {
        id: person.id ? String(person.id) : undefined,
        matchKey: matchKey, // Dodaj matchKey, aby AI mógł go zwrócić
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

    const aiResponse = await verifyEmployeesWithAI(personaCriteria, employeesForAI, personaBrief, true, "gpt-4o-mini");

    const classificationMap = new Map<string, { decision: string; reason: string; score?: number }>();
    for (const result of aiResponse.results) {
      // Użyj matchKey jeśli jest dostępny, w przeciwnym razie id
      const key = result.matchKey || result.id;
      if (!key) {
        logger.warn("personas-verify", "Brak klucza w wyniku AI", { result });
        continue;
      }
      const normalizedKey = String(key).toLowerCase();
      classificationMap.set(normalizedKey, {
        decision: result.decision,
        reason: result.reason || "",
        score: typeof result.score === "number" ? result.score : undefined,
      });
    }

    // Wzbogać tylko persony z dostępnym e-mailem (te, które były weryfikowane przez AI)
    // Dodaj też persony bez dostępnego e-maila, ale bez weryfikacji AI (dla kompletności danych)
    const enrichedEmployees = (employeesResult.people || []).map((person: any) => {
      const key = buildEmployeeKey(person);
      const normalizedKey = String(key).toLowerCase();
      const aiInfo = classificationMap.get(normalizedKey);
      
      // Jeśli nie znaleziono dopasowania, spróbuj też znaleźć po ID (jeśli person ma ID)
      // To pomaga w przypadku, gdy AI zwróciło matchKey jako ID, ale buildEmployeeKey zwróciło name|title
      let finalAiInfo = aiInfo;
      if (!finalAiInfo && person.id) {
        const idKey = String(person.id).toLowerCase();
        finalAiInfo = classificationMap.get(idKey);
      }
      
      // Jeśli person nie ma dostępnego e-maila, nie weryfikuj go przez AI
      if (!hasAvailableEmail(person)) {
        return {
          ...person,
          personaMatchStatus: "unknown" as const, // Oznacz jako unknown, bo nie weryfikujemy
          personaMatchReason: "Brak dostępnego e-maila - pominięto w weryfikacji AI",
          personaMatchScore: null,
        };
      }
      
      // Użyj progu z briefu do konwersji score na decision
      // Zawsze używamy progu do konwersji score na decision (nie ufamy decyzji AI)
      const positiveThreshold = personaBrief?.positiveThreshold ?? 0.5; // Domyślnie 50%
      
      // Użyj finalAiInfo (może być z matchKey lub ID)
      const aiInfoToUse = finalAiInfo || aiInfo;
      
      // Jeśli nie znaleziono dopasowania AI, użyj domyślnej decyzji
      if (!aiInfoToUse) {
        logger.warn("personas-verify", "Brak klasyfikacji AI dla persony", {
          companyId,
          personKey: key,
          personId: person.id,
          personName: person.name,
          personTitle: person.title,
        });
        return {
          ...person,
          personaMatchStatus: "negative" as const,
          personaMatchReason: "Brak klasyfikacji AI",
          personaMatchScore: null,
        };
      }
      
      const finalDecision: "positive" | "negative" = 
        typeof aiInfoToUse.score === "number" && aiInfoToUse.score >= positiveThreshold 
          ? "positive" 
          : "negative";
      
      // Upewnij się że score jest zawsze liczbą (użyj domyślnego jeśli null)
      const scoreValue = typeof aiInfoToUse?.score === "number" ? aiInfoToUse.score : (finalDecision === "positive" ? 1.0 : 0.0);
      const scoreText = `Ocena: ${(scoreValue * 100).toFixed(0)}%`;
      const combinedReason = [scoreText, aiInfoToUse?.reason].filter(Boolean).join(" — ");
      return {
        ...person,
        personaMatchStatus: finalDecision,
        personaMatchReason: combinedReason || "Brak uzasadnienia",
        personaMatchScore: scoreValue,
      };
    });

    const positiveCount = enrichedEmployees.filter((p: any) => p.personaMatchStatus === "positive").length;
    const negativeCount = enrichedEmployees.filter((p: any) => p.personaMatchStatus === "negative").length;
    // Usunięto conditional - wszystkie są teraz positive lub negative
    const unknownCount = enrichedEmployees.length - positiveCount - negativeCount;

    // Sprawdź, czy istnieje już weryfikacja person z apolloFetchedAt w metadanych
    // WAŻNE: apolloFetchedAt jest zawsze w rekordzie z personaCriteriaId=null (dane z Apollo)
    // Sprawdź rekord Apollo niezależnie od tego, czy istnieje weryfikacja AI
    const apolloRecord = await getPersonaVerification(companyId, null);
    const apolloMetadata = apolloRecord?.metadata ? JSON.parse(apolloRecord.metadata) : {};
    // Zachowaj istniejące apolloFetchedAt z rekordu Apollo lub ustaw nowe, jeśli persony zostały właśnie pobrane z Apollo
    const apolloFetchedAt = apolloMetadata.apolloFetchedAt || ((employeesResult as any).apolloFetchedAt ? new Date().toISOString() : null);

    const saved = await savePersonaVerification({
      companyId,
      personaCriteriaId: personaCriteria.id, // To jest CompanyPersonaCriteria.id
      positiveCount,
      negativeCount,
      unknownCount: unknownCount,
      employees: enrichedEmployees,
      metadata: {
        statistics: employeesResult.statistics,
        uniqueTitles: employeesResult.uniqueTitles,
        apolloOrganization: employeesResult.apolloOrganization,
        apolloFetchedAt: apolloFetchedAt, // Zachowaj lub ustaw datę pobrania z Apollo
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
        unknownCount: unknownCount,
        verifiedAt: saved.verifiedAt,
        employees: enrichedEmployees,
        metadata: {
          statistics: employeesResult.statistics,
          uniqueTitles: employeesResult.uniqueTitles,
          apolloOrganization: employeesResult.apolloOrganization,
          apolloFetchedAt: apolloFetchedAt, // Zwróć również w odpowiedzi
          personaBrief,
        },
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("personas-verify", "Błąd weryfikacji person", { companyId, error: err.message }, err);
    return NextResponse.json(
      { success: false, error: "Błąd weryfikacji person", details: err.message },
      { status: 500 }
    );
  }
}

