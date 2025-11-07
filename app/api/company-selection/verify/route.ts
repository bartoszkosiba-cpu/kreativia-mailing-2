import { NextRequest, NextResponse } from "next/server";
import { verifyAndSaveCompany, getActiveCriteria } from "@/services/companyVerificationAI";
import { logger } from "@/services/logger";
import { updateProgress } from "@/services/verificationProgress";
import { db } from "@/lib/db";

/**
 * Weryfikacja pojedynczej firmy
 * POST /api/company-selection/verify
 */
export async function POST(req: NextRequest) {
  let companyId: number | undefined;
  try {
    const body = await req.json();
    companyId = body.companyId;

    if (!companyId || typeof companyId !== "number") {
      return NextResponse.json(
        { error: "companyId jest wymagane" },
        { status: 400 }
      );
    }

    logger.info("company-verify", `Weryfikuję firmę ID: ${companyId}`);

    // Pobierz kryteria
    const criteria = await getActiveCriteria();
    if (!criteria) {
      logger.warn("company-verify", "Brak konfiguracji kryteriów weryfikacji");
      return NextResponse.json(
        { error: "Brak konfiguracji kryteriów weryfikacji. Utwórz konfigurację w module wyboru leadów." },
        { status: 400 }
      );
    }

    // Weryfikuj
    const result = await verifyAndSaveCompany(companyId, criteria);
    logger.info("company-verify", `Firma ${companyId} zweryfikowana: ${result.status} (score: ${result.score})`);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-verify", "Błąd weryfikacji firmy", companyId ? { companyId } : {}, errorObj);
    return NextResponse.json(
      { error: "Błąd weryfikacji firmy", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Weryfikacja wielu firm (batch) - z śledzeniem postępu
 * PUT /api/company-selection/verify
 */
export async function PUT(req: NextRequest) {
  try {
    const { companyIds, progressId } = await req.json();

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { error: "Lista ID firm jest wymagana" },
        { status: 400 }
      );
    }

    if (!progressId) {
      return NextResponse.json(
        { error: "Brak ID postępu" },
        { status: 400 }
      );
    }

    logger.info("company-verify", `Rozpoczynam weryfikację batch: ${companyIds.length} firm (progressId: ${progressId})`);

    // Pobierz kryteria
    const criteria = await getActiveCriteria();
    if (!criteria) {
      logger.warn("company-verify", "Brak konfiguracji kryteriów weryfikacji (batch)");
      updateProgress(progressId, { status: 'error' });
      return NextResponse.json(
        { error: "Brak konfiguracji kryteriów weryfikacji. Utwórz konfigurację w module wyboru leadów." },
        { status: 400 }
      );
    }

    const results = {
      qualified: 0,
      rejected: 0,
      needsReview: 0,
      errors: 0,
    };

    // Weryfikuj każdą firmę (z opóźnieniem, żeby nie przeciążyć API)
    // Uruchom w tle (nie czekaj na zakończenie)
    // Użyj setImmediate lub Promise.resolve().then() aby upewnić się, że funkcja się uruchomi
    Promise.resolve().then(async () => {
      try {
        logger.info("company-verify", `[BATCH] Rozpoczynam async weryfikację dla ${companyIds.length} firm`);
        
        // Ustaw początkowy status natychmiast
        updateProgress(progressId, {
          status: 'processing',
          processed: 0,
          current: 0,
          currentCompanyName: 'Rozpoczynam weryfikację...',
        });
        logger.info("company-verify", `[BATCH] Ustawiono początkowy progress`);

        for (let i = 0; i < companyIds.length; i++) {
          const companyId = companyIds[i];
          
          try {
            // Pobierz nazwę firmy dla wyświetlenia
            const company = await db.company.findUnique({
              where: { id: companyId },
              select: { name: true },
            });

            // Aktualizuj progress PRZED weryfikacją (dla pierwszej firmy natychmiast)
            if (i === 0) {
              updateProgress(progressId, {
                current: 1,
                processed: 0,
                currentCompanyName: company?.name || `Firma #${companyId}`,
              });
              logger.debug("company-verify", `[BATCH] Zaktualizowano progress dla pierwszej firmy: current=1`);
            }

            logger.debug("company-verify", `[BATCH] Weryfikuję firmę ${i + 1}/${companyIds.length} (ID: ${companyId})`);
            const result = await verifyAndSaveCompany(companyId, criteria);
            
            if (result.status === "QUALIFIED") {
              results.qualified++;
            } else if (result.status === "REJECTED") {
              results.rejected++;
            } else {
              results.needsReview++;
            }

            // Aktualizuj current dla KAŻDEJ firmy (dla widoczności postępu)
            // Aktualizuj processed co 2 firmy (dla lepszej wydajności)
            const shouldUpdateProcessed = (i + 1) % 2 === 0 || i === 0 || i === companyIds.length - 1;
            
            if (shouldUpdateProcessed) {
              updateProgress(progressId, {
                current: i + 1,
                processed: i + 1,
                currentCompanyName: company?.name || `Firma #${companyId}`,
              });
              logger.debug("company-verify", `[BATCH] Zaktualizowano progress (processed): ${i + 1}/${companyIds.length}`);
            } else {
              // Dla pozostałych firm aktualizuj tylko current (ważne dla widoczności!)
              updateProgress(progressId, {
                current: i + 1,
                currentCompanyName: company?.name || `Firma #${companyId}`,
              });
            }

            // Aktualizuj statystyki co 5 firm, co pierwszą firmę, lub na końcu
            const shouldUpdateStats = (i + 1) % 5 === 0 || i === 0 || i === companyIds.length - 1;
            if (shouldUpdateStats) {
              updateProgress(progressId, {
                qualified: results.qualified,
                rejected: results.rejected,
                needsReview: results.needsReview,
                errors: results.errors,
              });
              logger.info("company-verify", `[BATCH] Postęp: ${i + 1}/${companyIds.length} (${Math.round(((i + 1) / companyIds.length) * 100)}%) - Qualified: ${results.qualified}, Rejected: ${results.rejected}, Needs Review: ${results.needsReview}`);
            }

            // Opóźnienie między requestami (1 sekunda)
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            logger.error("company-verify", `Błąd weryfikacji firmy ${companyId}`, null, errorObj);
            results.errors++;
            
            // Aktualizuj current nawet przy błędzie (dla widoczności postępu)
            const shouldUpdateProgress = (i + 1) % 2 === 0 || i === 0 || i === companyIds.length - 1;
            if (shouldUpdateProgress) {
              updateProgress(progressId, {
                current: i + 1,
                processed: i + 1,
                errors: results.errors,
              });
            } else {
              updateProgress(progressId, {
                current: i + 1,
                errors: results.errors,
              });
            }

            // Aktualizuj statystyki co 5 firm lub na końcu
            const shouldUpdateStats = (i + 1) % 5 === 0 || i === 0 || i === companyIds.length - 1;
            if (shouldUpdateStats) {
              updateProgress(progressId, {
                qualified: results.qualified,
                rejected: results.rejected,
                needsReview: results.needsReview,
              });
            }
          }
        }

        // Zakończ weryfikację
        updateProgress(progressId, {
          processed: companyIds.length,
          qualified: results.qualified,
          rejected: results.rejected,
          needsReview: results.needsReview,
          errors: results.errors,
          status: 'completed',
          currentCompanyName: undefined,
        });

        logger.info("company-verify", `[BATCH] Zakończono weryfikację batch: ${results.qualified} qualified, ${results.rejected} rejected, ${results.needsReview} needs review, ${results.errors} errors`);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error("company-verify", "[BATCH] Błąd weryfikacji batch", null, errorObj);
        updateProgress(progressId, {
          status: 'error',
          errors: results.errors,
        });
      }
    }).catch((error) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error("company-verify", "[BATCH] Błąd uruchomienia async weryfikacji", null, errorObj);
      updateProgress(progressId, {
        status: 'error',
      });
    });

    // Zwróć natychmiast (weryfikacja działa w tle)
    return NextResponse.json({
      success: true,
      progressId,
      message: "Weryfikacja rozpoczęta. Postęp można śledzić przez endpoint /api/company-selection/verify/progress",
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-verify", "Błąd weryfikacji batch", null, errorObj);
    return NextResponse.json(
      { error: "Błąd weryfikacji firm", details: errorObj.message },
      { status: 500 }
    );
  }
}

