import { NextRequest, NextResponse } from "next/server";
import { createProgress, getProgress, updateProgress as updateProgressService, cleanupProgress } from "@/services/verificationProgress";
import { logger } from "@/services/logger";

/**
 * Pobierz postęp weryfikacji person
 * GET /api/company-selection/personas/verify/progress?progressId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const progressId = searchParams.get("progressId");

    if (!progressId) {
      return NextResponse.json(
        { success: false, error: "Brak ID postępu" },
        { status: 400 }
      );
    }

    const progress = getProgress(progressId);
    if (!progress) {
      logger.warn("persona-progress", `Nie znaleziono postępu dla progressId: ${progressId}`);
      return NextResponse.json(
        { success: false, error: "Nie znaleziono postępu" },
        { status: 404 }
      );
    }

    const now = Date.now();
    const elapsed = Math.round((now - progress.startTime) / 1000);
    
    const currentProcessed = progress.current || progress.processed;
    const percentage = progress.total > 0 
      ? Math.round((currentProcessed / progress.total) * 100) 
      : 0;

    let estimatedTimeRemaining: number | null = null;
    if (currentProcessed > 0 && progress.status === 'processing') {
      const avgTimePerCompany = elapsed / currentProcessed;
      estimatedTimeRemaining = Math.round(avgTimePerCompany * (progress.total - currentProcessed));
    }

    return NextResponse.json({
      success: true,
      progress: {
        progressId,
        total: progress.total,
        processed: currentProcessed,
        current: progress.current,
        withPersonas: progress.qualified || 0, // Używamy qualified jako withPersonas (firmy z personami)
        verified: progress.needsReview || 0, // Używamy needsReview jako verified (firmy zweryfikowane)
        errors: progress.errors || 0,
        status: progress.status,
        percentage,
        elapsed,
        estimatedTimeRemaining,
        currentCompanyName: progress.currentCompanyName,
        lastUpdate: progress.lastUpdate,
      },
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-progress", "Błąd pobierania postępu", null, errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania postępu", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Utwórz nowy postęp weryfikacji person
 * POST /api/company-selection/personas/verify/progress
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { total } = body;

    if (!total || typeof total !== "number" || total <= 0) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowa liczba firm" },
        { status: 400 }
      );
    }

    const progressId = createProgress(total);
    logger.info("persona-progress", `Utworzono postęp weryfikacji person: ${progressId} (${total} firm)`);

    return NextResponse.json({
      success: true,
      progressId,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-progress", "Błąd tworzenia postępu", null, errorObj);
    return NextResponse.json(
      { success: false, error: "Błąd tworzenia postępu", details: errorObj.message },
      { status: 500 }
    );
  }
}

