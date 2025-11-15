/**
 * Globalny store dla postępu klasyfikacji AI (w produkcji użyj Redis)
 */

type ClassificationProgressRecord = {
  total: number;
  processed: number;
  current: number;
  classified: number;
  skipped: number;
  errors: number;
  status: "processing" | "completed" | "error" | "cancelled";
  currentCompanyName?: string;
  lastUpdate: number;
  startTime: number;
  errorDetails?: Array<{ companyId: number; companyName: string; error: string }>;
  newSpecializations?: Array<{
    code: string;
    label: string;
    description: string;
    companyClass: string;
    companyId: number;
    companyName: string;
    reason: string;
  }>;
  retryQueueCount?: number; // Liczba firm w kolejce retry
  estimatedCost?: number; // Szacowany koszt klasyfikacji (USD)
  specializationStats?: Array<{
    code: string;
    label: string;
    count: number;
  }>; // Statystyki specjalizacji - ile firm trafiło do każdej
  skippedCompanies?: Array<{
    companyId: number;
    companyName: string;
    reason: string;
  }>; // Lista pominiętych firm i powody
};

const GLOBAL_PROGRESS_KEY = "__classificationProgressStore__";

function getProgressStore(): Map<string, ClassificationProgressRecord> {
  const globalAny = globalThis as typeof globalThis & {
    [GLOBAL_PROGRESS_KEY]?: Map<string, ClassificationProgressRecord>;
  };

  if (!globalAny[GLOBAL_PROGRESS_KEY]) {
    globalAny[GLOBAL_PROGRESS_KEY] = new Map<string, ClassificationProgressRecord>();
  }

  return globalAny[GLOBAL_PROGRESS_KEY]!;
}

const classificationProgress = getProgressStore();

/**
 * Utwórz nowy postęp klasyfikacji
 */
export function createProgress(progressId: string, total: number): void {
  classificationProgress.set(progressId, {
    total,
    processed: 0,
    current: 0,
    classified: 0,
    skipped: 0,
    errors: 0,
    status: "processing",
    lastUpdate: Date.now(),
    startTime: Date.now(),
    errorDetails: [],
    newSpecializations: [],
  });
}

/**
 * Pobierz postęp klasyfikacji
 */
export function getProgress(progressId: string): ClassificationProgressRecord | null {
  const progress = classificationProgress.get(progressId);
  if (!progress) {
    return null;
  }

  // Automatycznie oznacz jako zakończone jeśli wszystkie zostały przetworzone
  if (progress.processed >= progress.total && progress.status === "processing") {
    progress.status = "completed";
    progress.lastUpdate = Date.now();
    classificationProgress.set(progressId, progress);
  }

  // Debug: sprawdź czy specializationStats są w progress
  if (progress.status === "completed") {
    console.log("[classificationProgress] getProgress - specializationStats:", {
      progressId,
      hasStats: !!progress.specializationStats,
      statsCount: progress.specializationStats?.length || 0,
      stats: progress.specializationStats,
    });
  }

  return progress;
}

/**
 * Aktualizuj postęp klasyfikacji
 */
export function updateProgress(
  progressId: string,
  update: {
    processed?: number;
    current?: number;
    classified?: number;
    skipped?: number;
    errors?: number;
    status?: "processing" | "completed" | "error" | "cancelled";
    currentCompanyName?: string;
    errorDetails?: Array<{ companyId: number; companyName: string; error: string }>;
    newSpecializations?: Array<{
      code: string;
      label: string;
      description: string;
      companyClass: string;
      companyId: number;
      companyName: string;
      reason: string;
    }>;
    retryQueueCount?: number;
    estimatedCost?: number;
    specializationStats?: Array<{
      code: string;
      label: string;
      count: number;
    }>;
    skippedCompanies?: Array<{
      companyId: number;
      companyName: string;
      reason: string;
    }>;
  }
): void {
  const progress = classificationProgress.get(progressId);
  if (!progress) {
    return;
  }

  // Merge update z istniejącym postępem
  if (update.processed !== undefined) progress.processed = update.processed;
  if (update.current !== undefined) progress.current = update.current;
  if (update.classified !== undefined) progress.classified = update.classified;
  if (update.skipped !== undefined) progress.skipped = update.skipped;
  if (update.errors !== undefined) progress.errors = update.errors;
  if (update.status !== undefined) progress.status = update.status;
  if (update.currentCompanyName !== undefined) progress.currentCompanyName = update.currentCompanyName;
  if (update.errorDetails !== undefined) {
    progress.errorDetails = [...(progress.errorDetails || []), ...update.errorDetails];
  }
  if (update.newSpecializations !== undefined) {
    progress.newSpecializations = [...(progress.newSpecializations || []), ...update.newSpecializations];
  }
  if (update.retryQueueCount !== undefined) progress.retryQueueCount = update.retryQueueCount;
  if (update.estimatedCost !== undefined) progress.estimatedCost = update.estimatedCost;
  if (update.specializationStats !== undefined) {
    progress.specializationStats = update.specializationStats;
    console.log("[classificationProgress] Zapisano specializationStats:", {
      progressId,
      statsCount: update.specializationStats?.length || 0,
      stats: update.specializationStats,
    });
  }
  if (update.skippedCompanies !== undefined) {
    // Dodaj pominięte firmy do listy (nie nadpisuj, tylko dodaj)
    if (!progress.skippedCompanies) {
      progress.skippedCompanies = [];
    }
    progress.skippedCompanies.push(...update.skippedCompanies);
  }

  progress.lastUpdate = Date.now();

  classificationProgress.set(progressId, progress);
}

/**
 * Usuń postęp klasyfikacji (cleanup)
 */
export function cleanupProgress(progressId: string): void {
  classificationProgress.delete(progressId);
}

/**
 * Automatyczne czyszczenie starych postępów (starsze niż 2 godziny)
 */
export function cleanupOldProgress(): void {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, progress] of classificationProgress.entries()) {
    if (progress.lastUpdate < twoHoursAgo) {
      classificationProgress.delete(id);
    }
  }
}

