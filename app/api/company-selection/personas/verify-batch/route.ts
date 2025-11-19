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

function buildEmployeeKey(person: any) {
  if (person.id) return String(person.id);
  return `${person.name || ""}|${person.title || ""}`.toLowerCase();
}

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
  let lastError: { companyId: number; companyName: string; error: string } | null = null;

  // Pobierz brief person (jeśli istnieje)
  let personaBrief = null;
  try {
    personaBrief = await getPersonaBrief(personaCriteria.id);
  } catch (error) {
    // Brief nie jest wymagany
  }

  for (let i = 0; i < companyIds.length; i++) {
    const companyId = companyIds[i];
    let company: { id: number; name: string } | null = null;
    
    try {
      // Pobierz nazwę firmy dla postępu
      company = await db.company.findUnique({
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

      // Sprawdź, czy istnieją już zapisane persony z Apollo (dla tego personaCriteriaId lub null)
      // Najpierw sprawdź dla personaCriteriaId, potem dla null (tylko Apollo)
      // WAŻNE: Dla null musimy użyć findFirst, bo Prisma nie pozwala na null w composite unique key
      let existing = await db.personaVerificationResult.findUnique({
        where: {
          companyId_personaCriteriaId: {
            companyId,
            personaCriteriaId: personaCriteria.id,
          },
        },
      });
      
      // Jeśli nie znaleziono dla personaCriteriaId, sprawdź dla null (dane z Apollo)
      if (!existing) {
        existing = await db.personaVerificationResult.findFirst({
          where: {
            companyId,
            personaCriteriaId: null,
          },
        });
      }

      let employeesResult: any = null;

      if (existing && existing.employees) {
        // Użyj zapisanych person z bazy
        try {
          const employees = typeof existing.employees === "string" ? JSON.parse(existing.employees) : existing.employees;
          const metadata = existing.metadata ? (typeof existing.metadata === "string" ? JSON.parse(existing.metadata) : existing.metadata) : {};
          employeesResult = {
            success: true,
            company: { id: companyId, name: company.name, website: null },
            people: Array.isArray(employees) ? employees : [],
            statistics: metadata.statistics || metadata.apolloStatistics || null,
            uniqueTitles: metadata.uniqueTitles || metadata.apolloUniqueTitles || [],
            apolloOrganization: metadata.apolloOrganization || metadata.apolloOrganization || null,
          };
        } catch (parseError) {
          // Jeśli nie można sparsować danych z bazy, pobierz z Apollo
          logger.warn("persona-verify-batch", `Błąd parsowania danych z bazy dla firmy ${companyId}, pobieram z Apollo`, { companyId }, parseError);
          const fetched = await fetchApolloEmployeesForCompany(companyId);
          if (!fetched.success) {
            errors++;
            logger.warn("persona-verify-batch", `Błąd pobierania person dla firmy ${companyId}: ${fetched.message}`);
            continue;
          }
          employeesResult = fetched;
        }
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
        // Brak person do weryfikacji - pomiń (nie zwiększamy errors, bo to nie jest błąd)
        logger.info("persona-verify-batch", `Firma ${companyId} nie ma person do weryfikacji - pomijam`);
        continue;
      }

      // Funkcja pomocnicza do sprawdzania, czy email jest dostępny
      const hasAvailableEmail = (person: any): boolean => {
        // Email jest dostępny jeśli:
        // 1. Ma faktyczny adres email
        // 2. Lub emailUnlocked === true
        // 3. Lub emailStatus jest w: "verified", "guessed", "unverified", "extrapolated"
        if (person.email) return true;
        if (person.emailUnlocked) return true;
        const status = (person.emailStatus || person.email_status || person.contact_email_status)?.toLowerCase();
        return status === "verified" || status === "guessed" || status === "unverified" || status === "extrapolated";
      };

      // Filtruj persony - weryfikuj tylko te z dostępnym e-mailem
      const employeesWithEmail = (employeesResult.people || []).filter(hasAvailableEmail);
      
      if (employeesWithEmail.length === 0) {
        // Firma ma persony, ale żadna nie ma dostępnego e-maila - pomiń (nie zwiększamy errors, bo to nie jest błąd)
        logger.info("persona-verify-batch", `Firma ${companyId} ma persony, ale żadna nie ma dostępnego e-maila - pomijam`);
        continue;
      }

      withPersonas++;

      // Przygotuj dane dla AI - tylko persony z dostępnym e-mailem
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

      // Weryfikuj persony z AI
      const aiStartTime = Date.now();
      const aiResponse = await verifyEmployeesWithAI(personaCriteria, employeesForAI, personaBrief || undefined);
      const aiDuration = Date.now() - aiStartTime;
      logger.info("persona-verify-batch", `Weryfikacja AI dla firmy ${companyId} (${company.name}) zakończona w ${aiDuration}ms`, {
        companyId,
        companyName: company.name,
        employeesCount: employeesForAI.length,
        duration: aiDuration,
      });

      // Użyj progu z briefu do konwersji score na decision
      const positiveThreshold = personaBrief?.positiveThreshold ?? 0.5; // Domyślnie 50%
      
      // Zastosuj próg do wyników AI (konwertuj "conditional" na "positive" lub "negative" na podstawie score)
      const processedResults = aiResponse.results.map((result) => {
        let finalDecision = result.decision;
        // Jeśli decision jest "conditional" lub nie ma decision, ale jest score, użyj progu do konwersji
        if ((finalDecision === "conditional" || !finalDecision) && typeof result.score === "number") {
          finalDecision = result.score >= positiveThreshold ? "positive" : "negative";
        }
        return {
          ...result,
          decision: finalDecision,
        };
      });

      // Oblicz statystyki z przetworzonych wyników AI
      const positiveCount = processedResults.filter((r) => r.decision === "positive").length;
      const negativeCount = processedResults.filter((r) => r.decision === "negative").length;
      const conditionalCount = processedResults.filter((r) => r.decision === "conditional").length;
      const unknownCount = employeesForAI.length - positiveCount - negativeCount - conditionalCount;

      // Utwórz mapę decyzji AI (używając przetworzonych wyników)
      const aiDecisionsMap = new Map<string, { decision: string; reason: string; score?: number }>();
      for (const result of processedResults) {
        const key = result.id || result.matchKey;
        if (key) {
          aiDecisionsMap.set(String(key).toLowerCase(), {
            decision: result.decision,
            reason: result.reason || "",
            score: result.score,
          });
        }
      }

      // Wzbogać WSZYSTKIE persony (z e-mailami i bez) - podobnie jak w pojedynczej weryfikacji
      // Persony z e-mailem: mają weryfikację AI
      // Persony bez e-maila: oznacz jako "unknown" z powodem
      const enrichedEmployees = (employeesResult.people || []).map((person: any) => {
        const key = buildEmployeeKey(person);
        const aiInfo = aiDecisionsMap.get(key.toLowerCase());
        
        // Jeśli person nie ma dostępnego e-maila, nie weryfikuj go przez AI
        if (!hasAvailableEmail(person)) {
          return {
            ...person,
            personaMatchStatus: "unknown" as const,
            personaMatchReason: "Brak dostępnego e-maila - pominięto w weryfikacji AI",
            personaMatchScore: null,
          };
        }
        
        // Użyj progu z briefu do konwersji score na decision
        const positiveThreshold = personaBrief?.positiveThreshold ?? 0.5;
        let finalDecision = aiInfo?.decision ?? "conditional";
        
        if ((finalDecision === "conditional" || !finalDecision) && typeof aiInfo?.score === "number") {
          finalDecision = aiInfo.score >= positiveThreshold ? "positive" : "negative";
        }
        
        const scoreText = typeof aiInfo?.score === "number" ? `Ocena: ${(aiInfo.score * 100).toFixed(0)}%` : null;
        const combinedReason = [scoreText, aiInfo?.reason].filter(Boolean).join(" — ");
        return {
          ...person,
          personaMatchStatus: finalDecision,
          personaMatchReason: combinedReason || "Brak uzasadnienia",
          personaMatchScore: aiInfo?.score ?? null,
        };
      });

      // Zapisz wyniki weryfikacji - użyj enrichedEmployees (wszystkie persony)
      await savePersonaVerification({
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const companyName = company?.name || `Firma ${companyId}`;
      logger.error("persona-verify-batch", `Błąd weryfikacji firmy ${companyId} (${companyName}): ${errorMessage}`, { companyId, companyName, errorStack }, error);
      
      // Zapisz szczegóły ostatniego błędu
      lastError = {
        companyId,
        companyName,
        error: errorMessage,
      };
      
      // Zaktualizuj postęp z informacją o błędzie
      updateProgress(progressId, {
        processed: i + 1,
        qualified: withPersonas,
        needsReview: verified,
        errors: errors,
        currentCompanyName: `Błąd: ${companyName} - ${errorMessage}`,
      });
    }
  }

  // Zakończ postęp
  // Zachowaj informację o błędzie, jeśli wystąpił
  const finalMessage = errors > 0 && lastError
    ? `Zakończono z ${errors} błędami. Ostatni błąd: ${lastError.companyName} - ${lastError.error}`
    : errors > 0
    ? `Zakończono z ${errors} błędami`
    : 'Zakończono';
  
  updateProgress(progressId, {
    status: 'completed',
    processed: companyIds.length,
    current: companyIds.length,
    qualified: withPersonas,
    needsReview: verified,
    errors: errors,
    currentCompanyName: finalMessage,
  });

  logger.info("persona-verify-batch", `Zakończono weryfikację person (progressId: ${progressId}): ${verified} zweryfikowanych, ${withPersonas} z personami, ${errors} błędów`);
}

