import { NextRequest, NextResponse } from "next/server";
import { createProgress, getProgress, updateProgress as updateProgressService, cleanupProgress } from "@/services/verificationProgress";
import { logger } from "@/services/logger";

/**
 * Pobierz postęp weryfikacji
 * GET /api/company-selection/verify/progress?progressId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const progressId = searchParams.get("progressId");

    if (!progressId) {
      return NextResponse.json(
        { error: "Brak ID postępu" },
        { status: 400 }
      );
    }

    const progress = getProgress(progressId);
    if (!progress) {
      logger.warn("progress", `Nie znaleziono postępu dla progressId: ${progressId}`);
      return NextResponse.json(
        { error: "Nie znaleziono postępu" },
        { status: 404 }
      );
    }

    logger.info("progress", `GET progress dla ${progressId}: current=${progress.current}, processed=${progress.processed}, total=${progress.total}, status=${progress.status}`);

    const now = Date.now();
    const elapsed = Math.round((now - progress.startTime) / 1000); // w sekundach
    
    // Użyj current (aktualizowane dla każdej firmy) zamiast processed (tylko co 5 firm)
    const currentProcessed = progress.current || progress.processed;
    const percentage = progress.total > 0 
      ? Math.round((currentProcessed / progress.total) * 100) 
      : 0;

    // Oblicz szacowany czas pozostały (użyj current dla dokładniejszego szacowania)
    let estimatedTimeRemaining: number | null = null;
    if (currentProcessed > 0 && progress.status === 'processing') {
      const avgTimePerCompany = elapsed / currentProcessed;
      estimatedTimeRemaining = Math.round(avgTimePerCompany * (progress.total - currentProcessed));
    }

    return NextResponse.json({
      progressId,
      total: progress.total,
      processed: currentProcessed, // Zwróć current jako processed dla frontendu
      current: progress.current,
      qualified: progress.qualified,
      rejected: progress.rejected,
      needsReview: progress.needsReview,
      errors: progress.errors,
      status: progress.status,
      percentage,
      elapsed,
      estimatedTimeRemaining,
      currentCompanyName: progress.currentCompanyName,
      lastUpdate: progress.lastUpdate,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: "Błąd pobierania postępu", details: errorObj.message },
      { status: 500 }
    );
  }
}

/**
 * Utwórz nowy postęp weryfikacji
 * POST /api/company-selection/verify/progress
 */
export async function POST(req: NextRequest) {
  try {
    const { total } = await req.json();

    if (!total || typeof total !== "number") {
      return NextResponse.json(
        { error: "Liczba firm jest wymagana" },
        { status: 400 }
      );
    }

    const progressId = createProgress(total);

    return NextResponse.json({
      success: true,
      progressId,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: "Błąd tworzenia postępu", details: errorObj.message },
      { status: 500 }
    );
  }
}


