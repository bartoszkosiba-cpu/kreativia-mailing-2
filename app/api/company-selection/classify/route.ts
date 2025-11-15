/**
 * Company Classification API
 * POST /api/company-selection/classify
 * Klasyfikuje paczki firm używając AI
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import { classifyCompanyWithAI, saveClassificationToDatabase } from "@/services/companyClassificationAI";
import {
  createProgress,
  updateProgress,
  getProgress,
  cleanupOldProgress,
} from "@/services/classificationProgress";
import { randomBytes } from "crypto";

const CHUNK_SIZE = 10; // Klasyfikuj po 10 firm naraz (żeby nie przeciążyć AI)

export async function POST(req: NextRequest) {
  try {
    cleanupOldProgress(); // Wyczyść stare postępy

    const body = await req.json();
    const { companyIds, importBatchId, market }: {
      companyIds?: number[];
      importBatchId?: number;
      market?: string;
    } = body;

    if (!companyIds && !importBatchId) {
      return NextResponse.json(
        { error: "Wymagane są companyIds lub importBatchId" },
        { status: 400 }
      );
    }

    // Pobierz firmy do klasyfikacji
    let companies;
    if (companyIds && companyIds.length > 0) {
      companies = await db.company.findMany({
        where: {
          id: { in: companyIds },
        },
        select: {
          id: true,
          name: true,
          keywords: true,
          activityDescription: true,
        },
      });
    } else if (importBatchId) {
      companies = await db.company.findMany({
        where: {
          importBatchId,
          ...(market ? { market } : {}),
        },
        select: {
          id: true,
          name: true,
          keywords: true,
          activityDescription: true,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Nie znaleziono firm do klasyfikacji" },
        { status: 400 }
      );
    }

    if (companies.length === 0) {
      return NextResponse.json(
        { error: "Brak firm do klasyfikacji" },
        { status: 400 }
      );
    }

    // Utwórz ID postępu
    const progressId = randomBytes(16).toString("hex");
    createProgress(progressId, companies.length);

    logger.info("company-classification-api", `Rozpoczynam klasyfikację ${companies.length} firm (progressId: ${progressId})`);

    // Klasyfikuj w tle (nie blokuj odpowiedzi)
    (async () => {
      const results = {
        total: companies.length,
        classified: 0,
        skipped: 0,
        errors: 0,
        errorDetails: [] as Array<{ companyId: number; companyName: string; error: string }>,
      };

      // Kolejka firm z błędami rate limit do ponownego przetworzenia
      const rateLimitRetryQueue: typeof companies = [];

      try {
        // Klasyfikuj w paczkach po CHUNK_SIZE firm
        for (let i = 0; i < companies.length; i += CHUNK_SIZE) {
          // Sprawdź czy proces został anulowany
          const currentProgress = getProgress(progressId);
          if (!currentProgress || currentProgress.status === "cancelled") {
            logger.info("company-classification-api", `Klasyfikacja anulowana przez użytkownika (progressId: ${progressId})`);
            break;
          }

          const chunk = companies.slice(i, i + CHUNK_SIZE);

          // Klasyfikuj każdą firmę w paczce
          for (let j = 0; j < chunk.length; j++) {
            // Sprawdź czy proces został anulowany (przed każdą firmą)
            const progressCheck = getProgress(progressId);
            if (!progressCheck || progressCheck.status === "cancelled") {
              logger.info("company-classification-api", `Klasyfikacja anulowana przez użytkownika (progressId: ${progressId})`);
              break;
            }

            const company = chunk[j];
            const currentIndex = i + j + 1;

            try {
              // Aktualizuj postęp - przetwarzamy tę firmę
              updateProgress(progressId, {
                current: currentIndex,
                currentCompanyName: company.name,
              });

              // Sprawdź czy firma ma dane do klasyfikacji
              if (!company.keywords && !company.activityDescription) {
                logger.warn("company-classification-api", `Pominięto firmę bez danych: ${company.name}`, { companyId: company.id });
                results.skipped++;
                updateProgress(progressId, {
                  processed: currentIndex,
                  skipped: results.skipped,
                  skippedCompanies: [
                    {
                      companyId: company.id,
                      companyName: company.name,
                      reason: "Brak danych do klasyfikacji (keywords i activityDescription są puste)",
                    },
                  ],
                });
                continue;
              }

              // Klasyfikuj przez AI
              const classification = await classifyCompanyWithAI({
                id: company.id,
                name: company.name,
                keywords: company.keywords,
                activityDescription: company.activityDescription,
              });

              // Zapisz do bazy (zwraca utworzone specjalizacje)
              const createdSpecializations = await saveClassificationToDatabase(
                company.id,
                company.name,
                classification
              );

              // Log jeśli utworzono nowe specjalizacje i zaktualizuj progress
              if (createdSpecializations.length > 0) {
                logger.info("company-classification-api", "Utworzono nowe specjalizacje podczas klasyfikacji", {
                  companyId: company.id,
                  companyName: company.name,
                  newSpecializations: createdSpecializations.map((s) => s.code),
                });

                // Zapisz informacje o nowych specjalizacjach w postępie
                updateProgress(progressId, {
                  newSpecializations: createdSpecializations
                    .filter((s) => s.wasNew)
                    .map((s) => ({
                      code: s.code,
                      label: s.label,
                      description: s.description,
                      companyClass: s.companyClass,
                      companyId: company.id,
                      companyName: company.name,
                      reason: classification.reason,
                    })),
                });
              }

              results.classified++;
              updateProgress(progressId, {
                processed: currentIndex,
                classified: results.classified,
              });

              // Log co 10 firm
              if (results.classified % 10 === 0) {
                logger.info("company-classification-api", `Zaklasyfikowano ${results.classified}/${results.total} firm`);
              }
            } catch (error) {
              const errorObj = error instanceof Error ? error : new Error(String(error));
              const errorMessage = errorObj.message;

              // Sprawdź czy to błąd rate limit - jeśli tak, dodaj do kolejki retry
              if (errorMessage.includes("Rate limit") || errorMessage.includes("429")) {
                logger.warn("company-classification-api", `Rate limit - dodano firmę do kolejki retry: ${company.name}`, { companyId: company.id });
                rateLimitRetryQueue.push(company);
                // Aktualizuj postęp o liczbę firm w kolejce retry
                updateProgress(progressId, {
                  retryQueueCount: rateLimitRetryQueue.length,
                });
                // Nie zwiększaj licznika błędów - firma zostanie przetworzona później
              } else {
                // Inne błędy - liczymy jako błędy
                logger.error("company-classification-api", `Błąd klasyfikacji firmy: ${company.name}`, { companyId: company.id }, errorObj);
                results.errors++;
                results.errorDetails.push({
                  companyId: company.id,
                  companyName: company.name,
                  error: errorMessage,
                });
                updateProgress(progressId, {
                  processed: currentIndex,
                  errors: results.errors,
                  errorDetails: [
                    {
                      companyId: company.id,
                      companyName: company.name,
                      error: errorMessage,
                    },
                  ],
                });
              }
            }

            // Małe opóźnienie między firmami (żeby nie przeciążyć API, ale bez spowalniania)
            // 0.8s = ~75 requestów/min, ale przy rate limit dodamy do kolejki retry
            await new Promise((resolve) => setTimeout(resolve, 800));
          }

          // Większe opóźnienie między paczkami
          if (i + CHUNK_SIZE < companies.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        // Przetwórz firmy z kolejki retry (te, które miały rate limit)
        if (rateLimitRetryQueue.length > 0) {
          logger.info("company-classification-api", `Przetwarzanie ${rateLimitRetryQueue.length} firm z kolejki retry (rate limit)`);
          
          // Poczekaj chwilę przed przetworzeniem kolejki retry (aby rate limit się zresetował)
          await new Promise((resolve) => setTimeout(resolve, 5000));
          
          updateProgress(progressId, {
            currentCompanyName: `Przetwarzanie ${rateLimitRetryQueue.length} firm z kolejki retry...`,
            retryQueueCount: rateLimitRetryQueue.length,
          });

          for (let k = 0; k < rateLimitRetryQueue.length; k++) {
            // Sprawdź czy proces został anulowany (przed każdą firmą z retry)
            const progressCheck = getProgress(progressId);
            if (!progressCheck || progressCheck.status === "cancelled") {
              logger.info("company-classification-api", `Klasyfikacja anulowana podczas retry (progressId: ${progressId})`);
              break;
            }

            const company = rateLimitRetryQueue[k];
            const retryIndex = companies.length + k + 1;

            try {
              updateProgress(progressId, {
                current: retryIndex,
                currentCompanyName: `[RETRY] ${company.name}`,
              });

              // Klasyfikuj przez AI (z retry logic)
              const classification = await classifyCompanyWithAI({
                id: company.id,
                name: company.name,
                keywords: company.keywords,
                activityDescription: company.activityDescription,
              });

              // Zapisz do bazy
              const createdSpecializations = await saveClassificationToDatabase(
                company.id,
                company.name,
                classification
              );

              if (createdSpecializations.length > 0) {
                updateProgress(progressId, {
                  newSpecializations: createdSpecializations
                    .filter((s) => s.wasNew)
                    .map((s) => ({
                      code: s.code,
                      label: s.label,
                      description: s.description,
                      companyClass: s.companyClass,
                      companyId: company.id,
                      companyName: company.name,
                      reason: classification.reason,
                    })),
                });
              }

              results.classified++;
              updateProgress(progressId, {
                processed: retryIndex,
                classified: results.classified,
              });
            } catch (error) {
              const errorObj = error instanceof Error ? error : new Error(String(error));
              logger.error("company-classification-api", `Błąd retry klasyfikacji firmy: ${company.name}`, { companyId: company.id }, errorObj);
              results.errors++;
              results.errorDetails.push({
                companyId: company.id,
                companyName: company.name,
                error: `Retry failed: ${errorObj.message}`,
              });
              updateProgress(progressId, {
                processed: retryIndex,
                errors: results.errors,
                errorDetails: [
                  {
                    companyId: company.id,
                    companyName: company.name,
                    error: `Retry failed: ${errorObj.message}`,
                  },
                ],
              });
            }

            // Opóźnienie między retry - dłuższe, bo już byliśmy blisko limitu
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }

        // Poczekaj chwilę, aby upewnić się że wszystkie transakcje są zatwierdzone
        // Zwiększone do 1500ms, aby statystyki były gotowe od razu po zakończeniu
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Pobierz statystyki specjalizacji - ile firm trafiło do każdej specjalizacji
        // Użyj wszystkich firm z oryginalnej listy (mogły być pominięte, ale to OK)
        const companyIds = companies.map((c) => c.id);
        
        logger.info("company-classification-api", "Pobieranie statystyk specjalizacji", {
          progressId,
          companyIds,
          companyIdsCount: companyIds.length,
          classifiedCount: results.classified,
          skippedCount: results.skipped,
        });

        // Najpierw sprawdź czy są jakieś klasyfikacje dla tych firm
        const allClassifications = await db.companyClassification.findMany({
          where: {
            companyId: {
              in: companyIds,
            },
            source: "AI",
          },
          select: {
            companyId: true,
            specializationCode: true,
            isPrimary: true,
            source: true,
          },
        });

        logger.info("company-classification-api", "Znalezione klasyfikacje", {
          progressId,
          totalClassifications: allClassifications.length,
          classifications: allClassifications.map((c) => ({
            companyId: c.companyId,
            specializationCode: c.specializationCode,
            isPrimary: c.isPrimary,
            source: c.source,
          })),
        });

        const specializationStats = await db.companyClassification.groupBy({
          by: ["specializationCode"],
          where: {
            companyId: {
              in: companyIds,
            },
            source: "AI",
            isPrimary: true,
          },
          _count: {
            _all: true,
          },
        });

        logger.info("company-classification-api", "Statystyki specjalizacji z groupBy", {
          progressId,
          specializationStatsCount: specializationStats.length,
          specializationStats: specializationStats.map((s) => ({
            code: s.specializationCode,
            count: s._count.companyId,
          })),
        });

        // Pobierz etykiety specjalizacji z bazy
        const specializationCodes = specializationStats.map((s) => s.specializationCode);
        const specializations = await db.companySpecialization.findMany({
          where: {
            code: {
              in: specializationCodes,
            },
          },
          select: {
            code: true,
            label: true,
          },
        });

        const specializationMap = new Map(specializations.map((s) => [s.code, s.label]));

        const stats = specializationStats
          .map((stat) => ({
            code: stat.specializationCode,
            label: specializationMap.get(stat.specializationCode) || stat.specializationCode,
            count: stat._count._all,
          }))
          .sort((a, b) => b.count - a.count); // Sortuj od największej liczby firm

        // Oznacz jako zakończone z statystykami specjalizacji
        logger.info("company-classification-api", "Zapisywanie statystyk specjalizacji", { 
          progressId, 
          statsCount: stats.length,
          stats: stats.map(s => ({ code: s.code, label: s.label, count: s.count }))
        });
        
        updateProgress(progressId, {
          status: "completed",
          specializationStats: stats,
          processed: results.total,
        });

        logger.info("company-classification-api", "Klasyfikacja zakończona", { progressId, ...results });
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error("company-classification-api", "Błąd klasyfikacji", { progressId }, errorObj);
        updateProgress(progressId, {
          status: "error",
        });
      }
    })();

    // Zwróć natychmiast z progressId
    return NextResponse.json({
      success: true,
      progressId,
      total: companies.length,
      message: `Rozpoczęto klasyfikację ${companies.length} firm. Sprawdź postęp używając progressId: ${progressId}`,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-classification-api", "Błąd klasyfikacji", null, errorObj);
    return NextResponse.json(
      {
        success: false,
        error: errorObj.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/company-selection/classify?progressId=xxx
 * Pobiera postęp klasyfikacji w czasie rzeczywistym
 */
export async function GET(req: NextRequest) {
  try {
    cleanupOldProgress(); // Wyczyść stare postępy

    const searchParams = req.nextUrl.searchParams;
    const progressId = searchParams.get("progressId");
    const importBatchId = searchParams.get("importBatchId");

    // Jeśli podano progressId, zwróć postęp klasyfikacji
    if (progressId) {
      const progress = getProgress(progressId);
      if (!progress) {
        return NextResponse.json(
          { error: "Postęp nie znaleziony (może być już zakończony lub wygasły)" },
          { status: 404 }
        );
      }

      const elapsed = Date.now() - progress.startTime;
      const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

      // Oblicz szacowany czas zakończenia
      let estimatedEndTime: number | null = null;
      if (progress.processed > 0 && progress.status === "processing") {
        const avgTimePerItem = elapsed / progress.processed;
        estimatedEndTime = Date.now() + avgTimePerItem * (progress.total - progress.processed);
      }

      const remainingTime = estimatedEndTime ? Math.max(0, estimatedEndTime - Date.now()) : null;

      // Debug: sprawdź czy specializationStats są w progress (tylko jeśli completed)
      if (progress.status === "completed") {
        console.log("[API GET] Progress specializationStats:", progress.specializationStats);
        if (progress.skippedCompanies && progress.skippedCompanies.length > 0) {
          console.log("[API GET] Pominięte firmy:", progress.skippedCompanies);
        }
      }

      return NextResponse.json({
        success: true,
        progress: {
          progressId,
          total: progress.total,
          processed: progress.processed,
          current: progress.current,
          classified: progress.classified,
          skipped: progress.skipped,
          errors: progress.errors,
          status: progress.status,
          currentCompanyName: progress.currentCompanyName,
          percentage,
          elapsed: Math.round(elapsed / 1000), // w sekundach
          remainingTime: remainingTime ? Math.round(remainingTime / 1000) : null, // w sekundach
          errorDetails: progress.errorDetails || [],
          newSpecializations: progress.newSpecializations || [],
          retryQueueCount: progress.retryQueueCount || 0,
          specializationStats: progress.specializationStats || [],
          skippedCompanies: progress.skippedCompanies || [],
        },
      });
    }

    // Jeśli podano importBatchId, zwróć statystyki klasyfikacji dla paczki (backward compatibility)
    if (importBatchId) {
      const batchId = parseInt(importBatchId, 10);
      if (isNaN(batchId)) {
        return NextResponse.json(
          { error: "Nieprawidłowy importBatchId" },
          { status: 400 }
        );
      }

      // Pobierz statystyki
      const total = await db.company.count({
        where: { importBatchId: batchId },
      });

      const classified = await db.company.count({
        where: {
          importBatchId: batchId,
          classificationSource: "AI",
        },
      });

      const withClassifications = await db.company.count({
        where: {
          importBatchId: batchId,
          classifications: {
            some: {
              source: "AI",
            },
          },
        },
      });

      const needsReview = await db.company.count({
        where: {
          importBatchId: batchId,
          classificationNeedsReview: true,
        },
      });

      return NextResponse.json({
        success: true,
        stats: {
          total,
          classified,
          withClassifications,
          needsReview,
          notClassified: total - classified,
        },
      });
    }

    return NextResponse.json(
      { error: "Wymagany parametr progressId lub importBatchId" },
      { status: 400 }
    );
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-classification-api", "Błąd pobierania postępu/statystyk", null, errorObj);
    return NextResponse.json(
      {
        success: false,
        error: errorObj.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/company-selection/classify?progressId=xxx
 * Anuluje trwającą klasyfikację
 */
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const progressId = searchParams.get("progressId");

    if (!progressId) {
      return NextResponse.json(
        { error: "Wymagany parametr progressId" },
        { status: 400 }
      );
    }

    const progress = getProgress(progressId);
    if (!progress) {
      return NextResponse.json(
        { error: "Postęp nie znaleziony (może być już zakończony lub wygasły)" },
        { status: 404 }
      );
    }

    // Sprawdź czy można anulować (tylko jeśli jest w trakcie)
    if (progress.status !== "processing") {
      return NextResponse.json(
        { error: `Nie można anulować - status: ${progress.status}` },
        { status: 400 }
      );
    }

    // Oznacz jako anulowany
    updateProgress(progressId, {
      status: "cancelled",
      currentCompanyName: "Anulowano przez użytkownika",
    });

    logger.info("company-classification-api", `Klasyfikacja anulowana przez użytkownika (progressId: ${progressId})`, {
      total: progress.total,
      processed: progress.processed,
      classified: progress.classified,
    });

    return NextResponse.json({
      success: true,
      message: "Klasyfikacja została anulowana",
      progress: {
        progressId,
        status: "cancelled",
        total: progress.total,
        processed: progress.processed,
        classified: progress.classified,
        skipped: progress.skipped,
        errors: progress.errors,
      },
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-classification-api", "Błąd anulowania klasyfikacji", null, errorObj);
    return NextResponse.json(
      {
        success: false,
        error: errorObj.message,
      },
      { status: 500 }
    );
  }
}

