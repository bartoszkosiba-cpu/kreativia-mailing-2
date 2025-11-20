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
    const { companyIds, progressId, personaCriteriaId, forceRefresh, model: modelParam = "gpt-4o-mini" } = body;
    const model = modelParam; // Upewnij się że model jest zdefiniowane w całym zakresie

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
    processVerificationBatch(companyIds, progressId, personaCriteria, Boolean(forceRefresh), model).catch((error) => {
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
  personaCriteria: any,
  forceRefresh: boolean = false, // Jeśli true, wyłącza cache i wymusza ponowną weryfikację przez AI
  model: string = "gpt-4o-mini" // Model AI do użycia
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
        } as any, // Workaround: TypeScript nie widzi zaktualizowanych typów, ale w bazie constraint istnieje
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
          logger.warn("persona-verify-batch", `Błąd parsowania danych z bazy dla firmy ${companyId}, pobieram z Apollo`, { 
            companyId, 
            error: parseError instanceof Error ? parseError.message : String(parseError) 
          });
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
      // Jeśli forceRefresh=true, wyłącz cache aby wymusić ponowną weryfikację (przydatne do wypełnienia cache)
      logger.info("persona-verify-batch", `Rozpoczynam weryfikację AI dla firmy ${companyId} (${company.name})`, {
        companyId,
        companyName: company.name,
        employeesCount: employeesForAI.length,
        forceRefresh,
        useCache: !forceRefresh,
      });
      
      const aiStartTime = Date.now();
      const selectedModel = (model === "gpt-4o" || model === "gpt-4o-mini") ? model : "gpt-4o-mini";
      const aiResponse = await verifyEmployeesWithAI(
        personaCriteria, 
        employeesForAI, 
        personaBrief || undefined,
        !forceRefresh, // useCache = !forceRefresh (jeśli forceRefresh, wyłącz cache)
        selectedModel // Użyj wybranego modelu lub domyślnego
      );
      const aiDuration = Date.now() - aiStartTime;
      logger.info("persona-verify-batch", `Weryfikacja AI dla firmy ${companyId} (${company.name}) zakończona w ${aiDuration}ms`, {
        companyId,
        companyName: company.name,
        employeesCount: employeesForAI.length,
        resultsCount: aiResponse.results.length,
        duration: aiDuration,
        forceRefresh,
      });

      // Użyj progu z briefu do konwersji score na decision
      // Zawsze używamy progu do konwersji score na decision (nie ufamy decyzji AI)
      const positiveThreshold = personaBrief?.positiveThreshold ?? 0.5; // Domyślnie 50%
      
      // Zastosuj próg do wyników AI
      const processedResults = aiResponse.results.map((result) => {
        const finalDecision: "positive" | "negative" = 
          typeof result.score === "number" && result.score >= positiveThreshold 
            ? "positive" 
            : "negative";
        return {
          ...result,
          decision: finalDecision,
        };
      });

      // Oblicz statystyki z przetworzonych wyników AI
      const positiveCount = processedResults.filter((r) => r.decision === "positive").length;
      const negativeCount = processedResults.filter((r) => r.decision === "negative").length;
      // Usunięto conditional - wszystkie są teraz positive lub negative
      const unknownCount = employeesForAI.length - positiveCount - negativeCount;

      // Utwórz mapę decyzji AI (używając przetworzonych wyników)
      const aiDecisionsMap = new Map<string, { decision: string; reason: string; score?: number }>();
      for (const result of processedResults) {
        const key = result.id || result.matchKey;
        if (key) {
          // Upewnij się że score jest zawsze liczbą (użyj domyślnego jeśli null)
          const scoreValue = typeof result.score === "number" ? result.score : (result.decision === "positive" ? 1.0 : 0.0);
          aiDecisionsMap.set(String(key).toLowerCase(), {
            decision: result.decision,
            reason: result.reason || "",
            score: scoreValue,
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
        // Zawsze używamy progu do konwersji score na decision (nie ufamy decyzji AI)
        const positiveThreshold = personaBrief?.positiveThreshold ?? 0.5;
        const finalDecision: "positive" | "negative" = 
          typeof aiInfo?.score === "number" && aiInfo.score >= positiveThreshold 
            ? "positive" 
            : "negative";
        
        // Upewnij się że score jest zawsze liczbą (użyj domyślnego jeśli null)
        const scoreValue = typeof aiInfo?.score === "number" ? aiInfo.score : (finalDecision === "positive" ? 1.0 : 0.0);
        const scoreText = `Ocena: ${(scoreValue * 100).toFixed(0)}%`;
        const combinedReason = [scoreText, aiInfo?.reason].filter(Boolean).join(" — ");
        return {
          ...person,
          personaMatchStatus: finalDecision,
          personaMatchReason: combinedReason || "Brak uzasadnienia",
          personaMatchScore: scoreValue,
        };
      });

      // Zapisz wyniki weryfikacji - użyj enrichedEmployees (wszystkie persony)
      await savePersonaVerification({
        companyId,
        personaCriteriaId: personaCriteria.id,
        positiveCount,
        negativeCount,
        unknownCount: unknownCount,
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
      logger.error("persona-verify-batch", `Błąd weryfikacji firmy ${companyId} (${companyName}): ${errorMessage}`, { 
        companyId, 
        companyName, 
        errorStack,
        error: error instanceof Error ? error.message : String(error),
      });
      
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

