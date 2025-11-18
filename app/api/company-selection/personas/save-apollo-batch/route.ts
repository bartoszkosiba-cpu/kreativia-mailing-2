import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchApolloEmployeesForCompany } from "@/services/apolloEmployeesService";
import { logger } from "@/services/logger";
import { updateProgress, getProgress } from "@/services/verificationProgress";

/**
 * Pobiera i zapisuje persony z Apollo dla wielu firm (batch) - z śledzeniem postępu
 * PUT /api/company-selection/personas/save-apollo-batch
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyIds, progressId } = body;

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

    const progress = getProgress(progressId);
    if (!progress) {
      return NextResponse.json(
        { success: false, error: "Nie znaleziono postępu dla podanego progressId" },
        { status: 404 }
      );
    }

    logger.info("persona-apollo-batch", `Rozpoczynam pobieranie person z Apollo dla ${companyIds.length} firm (progressId: ${progressId})`);

    updateProgress(progressId, {
      status: 'processing',
      processed: 0,
      current: 0,
      currentCompanyName: 'Rozpoczynam pobieranie...',
    });

    // Uruchom przetwarzanie w tle (nie czekaj na zakończenie)
    processApolloBatch(companyIds, progressId).catch((error) => {
      logger.error("persona-apollo-batch", "Błąd przetwarzania batch", { progressId }, error);
      updateProgress(progressId, {
        status: 'error',
        currentCompanyName: `Błąd: ${error instanceof Error ? error.message : String(error)}`,
      });
    });

    return NextResponse.json({
      success: true,
      progressId,
      message: "Pobieranie person z Apollo zostało uruchomione w tle.",
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-apollo-batch", "Błąd uruchamiania batch", null, err);
    return NextResponse.json(
      { success: false, error: "Błąd uruchamiania pobierania person", details: err.message },
      { status: 500 }
    );
  }
}

async function processApolloBatch(companyIds: number[], progressId: string) {
  let withPersonas = 0;
  let errors = 0;

  for (let i = 0; i < companyIds.length; i++) {
    const companyId = companyIds[i];
    
    try {
      // Pobierz nazwę firmy dla postępu
      const company = await db.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });

      updateProgress(progressId, {
        current: i + 1,
        currentCompanyName: company?.name || `Firma #${companyId}`,
      });

      // Pobierz persony z Apollo
      const apolloResult = await fetchApolloEmployeesForCompany(companyId);
      
      if (!apolloResult.success) {
        errors++;
        logger.warn("persona-apollo-batch", `Błąd pobierania person dla firmy ${companyId}: ${apolloResult.message}`);
        continue;
      }

      // Zapisz persony w bazie
      const employeesJson = JSON.stringify(apolloResult.people || []);
      const metadataJson = JSON.stringify({
        apolloFetchedAt: new Date().toISOString(),
        statistics: apolloResult.statistics || null,
        uniqueTitles: apolloResult.uniqueTitles || [],
        apolloOrganization: apolloResult.apolloOrganization || null,
        creditsInfo: apolloResult.creditsInfo || null,
        verifiedByAI: false,
      });

      // Sprawdź, czy istnieje już weryfikacja z AI
      const existing = await db.personaVerificationResult.findUnique({
        where: { companyId },
      });

      if (existing && existing.personaCriteriaId !== null) {
        // Jeśli istnieje weryfikacja z AI, tylko zaktualizuj metadane Apollo
        const existingMetadata = existing.metadata ? JSON.parse(existing.metadata) : {};
        const updatedMetadata = {
          ...existingMetadata,
          apolloFetchedAt: new Date().toISOString(),
          apolloStatistics: apolloResult.statistics || null,
          apolloUniqueTitles: apolloResult.uniqueTitles || [],
          apolloOrganization: apolloResult.apolloOrganization || null,
          apolloCreditsInfo: apolloResult.creditsInfo || null,
        };

        await db.personaVerificationResult.update({
          where: { companyId },
          data: {
            metadata: JSON.stringify(updatedMetadata),
          },
        });
      } else {
        // Jeśli nie ma weryfikacji AI, zapisz persony z Apollo
        await db.personaVerificationResult.upsert({
          where: { companyId },
          create: {
            companyId,
            personaCriteriaId: null,
            verifiedAt: new Date(),
            positiveCount: 0,
            negativeCount: 0,
            unknownCount: apolloResult.people?.length || 0,
            employees: employeesJson,
            metadata: metadataJson,
          },
          update: {
            personaCriteriaId: null,
            verifiedAt: new Date(),
            positiveCount: 0,
            negativeCount: 0,
            unknownCount: apolloResult.people?.length || 0,
            employees: employeesJson,
            metadata: metadataJson,
          },
        });
      }

      if (apolloResult.people && apolloResult.people.length > 0) {
        withPersonas++;
      }

      // Aktualizuj postęp co 5 firm lub na końcu
      if ((i + 1) % 5 === 0 || i === companyIds.length - 1) {
        updateProgress(progressId, {
          processed: i + 1,
          qualified: withPersonas, // Używamy qualified jako withPersonas
          errors: errors,
        });
      }
    } catch (error) {
      errors++;
      logger.error("persona-apollo-batch", `Błąd przetwarzania firmy ${companyId}`, null, error);
    }
  }

  // Zakończ postęp
  updateProgress(progressId, {
    status: 'completed',
    processed: companyIds.length,
    current: companyIds.length,
    qualified: withPersonas,
    errors: errors,
    currentCompanyName: 'Zakończono',
  });

  logger.info("persona-apollo-batch", `Zakończono pobieranie person z Apollo (progressId: ${progressId}): ${withPersonas} z personami, ${errors} błędów`);
}

