import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import { updateProgress, getProgress } from "@/services/verificationProgress";
import { getPersonaCriteriaById } from "@/services/personaCriteriaService";
import { getPersonaBrief } from "@/services/personaBriefService";
import { fetchApolloEmployeesForCompany } from "@/services/apolloEmployeesService";
import { verifyEmployeesWithAI } from "@/services/personaVerificationAI";
import { savePersonaVerification } from "@/services/personaVerificationService";
import { analyseJobTitle } from "@/utils/jobTitleHelpers";

/**
 * Weryfikacja person dla wielu firm (batch) - z śledzeniem postępu
 * PUT /api/company-selection/personas/verify-batch
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyIds, progressId, personaCriteriaId } = body;

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Lista ID firm jest wymagana" },
        { status: 400 }
      );
    }

    if (!progressId) {
      return NextResponse.json(
        { success: false, error: "Brak ID postępu" },
        { status: 400 }
      );
    }

    if (!personaCriteriaId || !Number.isFinite(personaCriteriaId)) {
      return NextResponse.json(
        { success: false, error: "personaCriteriaId jest wymagane" },
        { status: 400 }
      );
    }

    const progress = getProgress(progressId);
    if (!progress) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono postępu dla podanego progressId" },
        { status: 404 }
      );
    }

    // Pobierz kryteria person
    const personaCriteria = await getPersonaCriteriaById(Number(personaCriteriaId));
    if (!personaCriteria) {
      updateProgress(progressId, { status: 'error' });
      return NextResponse.json(
        { success: false, error: "Nie znaleziono kryteriów person o podanym ID" },
        { status: 404 }
      );
    }

    logger.info("persona-verify-batch", `Rozpoczynam weryfikację person dla ${companyIds.length} firm (progressId: ${progressId}, personaCriteriaId: ${personaCriteriaId})`);

    updateProgress(progressId, {
      status: 'processing',
      processed: 0,
      current: 0,
      currentCompanyName: 'Rozpoczynam weryfikację...',
    });

    // Uruchom przetwarzanie w tle (nie czekaj na zakończenie)
    processVerificationBatch(companyIds, progressId, personaCriteria).catch((error) => {
      logger.error("persona-verify-batch", "Błąd przetwarzania batch", { progressId }, error);
      updateProgress(progressId, {
        status: 'error',
        currentCompanyName: `Błąd: ${error instanceof Error ? error.message : String(error)}`,
      });
    });

    return NextResponse.json({
      success: true,
      progressId,
      message: "Weryfikacja person została uruchomiona w tle.",
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-verify-batch", "Błąd uruchamiania batch", null, err);
    return NextResponse.json(
      { success: false, error: "Błąd uruchamiania weryfikacji person", details: err.message },
      { status: 500 }
    );
  }
}

async function processVerificationBatch(
  companyIds: number[],
  progressId: string,
  personaCriteria: any
) {
  let verified = 0;
  let withPersonas = 0;
  let errors = 0;

  // Pobierz brief person (jeśli istnieje)
  let personaBrief = null;
  try {
    personaBrief = await getPersonaBrief(personaCriteria.id);
  } catch (error) {
    // Brief nie jest wymagany
  }

  for (let i = 0; i < companyIds.length; i++) {
    const companyId = companyIds[i];
    
    try {
      // Pobierz nazwę firmy dla postępu
      const company = await db.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });

      if (!company) {
        errors++;
        continue;
      }

      updateProgress(progressId, {
        current: i + 1,
        currentCompanyName: company.name,
      });

      // Sprawdź, czy istnieją już zapisane persony z Apollo
      const existing = await db.personaVerificationResult.findUnique({
        where: { companyId },
      });

      let employeesResult: any = null;

      if (existing && existing.employees) {
        // Użyj zapisanych person z bazy
        const employees = JSON.parse(existing.employees);
        const metadata = existing.metadata ? JSON.parse(existing.metadata) : {};
        employeesResult = {
          success: true,
          company: { id: companyId, name: company.name, website: null },
          people: employees,
          statistics: metadata.statistics || metadata.apolloStatistics || null,
          uniqueTitles: metadata.uniqueTitles || metadata.apolloUniqueTitles || [],
          apolloOrganization: metadata.apolloOrganization || metadata.apolloOrganization || null,
        };
      } else {
        // Pobierz persony z Apollo
        const fetched = await fetchApolloEmployeesForCompany(companyId);
        if (!fetched.success) {
          errors++;
          logger.warn("persona-verify-batch", `Błąd pobierania person dla firmy ${companyId}: ${fetched.message}`);
          continue;
        }
        employeesResult = fetched;
      }

      if (!employeesResult.people || employeesResult.people.length === 0) {
        continue; // Brak person do weryfikacji
      }

      withPersonas++;

      // Przygotuj dane dla AI
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

      // Weryfikuj persony z AI
      const aiResponse = await verifyEmployeesWithAI(personaCriteria, employeesForAI, personaBrief || undefined);

      // Oblicz statystyki z wyników AI
      const positiveCount = aiResponse.results.filter((r) => r.decision === "positive").length;
      const negativeCount = aiResponse.results.filter((r) => r.decision === "negative").length;
      const conditionalCount = aiResponse.results.filter((r) => r.decision === "conditional").length;
      const unknownCount = employeesForAI.length - positiveCount - negativeCount - conditionalCount;

      // Utwórz mapę decyzji AI
      const aiDecisionsMap = new Map<string, { decision: string; reason: string; score?: number }>();
      for (const result of aiResponse.results) {
        const key = result.id || result.matchKey;
        if (key) {
          aiDecisionsMap.set(String(key).toLowerCase(), {
            decision: result.decision,
            reason: result.reason || "",
            score: result.score,
          });
        }
      }

      // Zapisz wyniki weryfikacji
      await savePersonaVerification({
        companyId,
        personaCriteriaId: personaCriteria.id,
        positiveCount,
        negativeCount,
        unknownCount: conditionalCount + unknownCount,
        employees: employeesResult.people,
        metadata: {
          statistics: employeesResult.statistics,
          uniqueTitles: employeesResult.uniqueTitles,
          apolloOrganization: employeesResult.apolloOrganization,
          creditsInfo: employeesResult.creditsInfo,
          personaBrief: personaBrief || null,
          aiDecisions: Object.fromEntries(aiDecisionsMap),
        },
      });

      verified++;

      // Aktualizuj postęp co 5 firm lub na końcu
      if ((i + 1) % 5 === 0 || i === companyIds.length - 1) {
        updateProgress(progressId, {
          processed: i + 1,
          qualified: withPersonas, // Używamy qualified jako withPersonas
          needsReview: verified, // Używamy needsReview jako verified
          errors: errors,
        });
      }
    } catch (error) {
      errors++;
      logger.error("persona-verify-batch", `Błąd weryfikacji firmy ${companyId}`, null, error);
    }
  }

  // Zakończ postęp
  updateProgress(progressId, {
    status: 'completed',
    processed: companyIds.length,
    current: companyIds.length,
    qualified: withPersonas,
    needsReview: verified,
    errors: errors,
    currentCompanyName: 'Zakończono',
  });

  logger.info("persona-verify-batch", `Zakończono weryfikację person (progressId: ${progressId}): ${verified} zweryfikowanych, ${withPersonas} z personami, ${errors} błędów`);
}

