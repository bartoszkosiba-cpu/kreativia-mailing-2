// Globalny store dla postępu weryfikacji (w produkcji użyj Redis)
type ProgressRecord = {
  total: number;
  processed: number;
  current: number;
  qualified: number;
  rejected: number;
  needsReview: number;
  errors: number;
  status: 'processing' | 'completed' | 'error';
  startTime: number;
  currentCompanyName?: string;
  lastUpdate: number;
};

const GLOBAL_PROGRESS_KEY = '__verificationProgressStore__';

function getProgressStore(): Map<string, ProgressRecord> {
  const globalAny = globalThis as typeof globalThis & {
    [GLOBAL_PROGRESS_KEY]?: Map<string, ProgressRecord>;
  };

  if (!globalAny[GLOBAL_PROGRESS_KEY]) {
    globalAny[GLOBAL_PROGRESS_KEY] = new Map<string, ProgressRecord>();
  }

  return globalAny[GLOBAL_PROGRESS_KEY]!;
}

const verificationProgress = getProgressStore();

// Import logger (lazy import, żeby uniknąć circular dependencies)
let loggerInstance: any = null;
function getLogger() {
  if (!loggerInstance) {
    try {
      loggerInstance = require("@/services/logger").logger;
    } catch (e) {
      // Logger nie dostępny - użyj console
      return {
        debug: console.log,
        info: console.log,
        warn: console.warn,
        error: console.error,
      };
    }
  }
  return loggerInstance;
}

/**
 * Utwórz nowy postęp weryfikacji
 */
export function createProgress(total: number): string {
  const progressId = `progress_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  verificationProgress.set(progressId, {
    total,
    processed: 0,
    current: 0,
    qualified: 0,
    rejected: 0,
    needsReview: 0,
    errors: 0,
    status: 'processing',
    startTime: Date.now(),
    lastUpdate: Date.now(),
  });

  return progressId;
}

/**
 * Pobierz postęp weryfikacji
 */
export function getProgress(progressId: string) {
  return verificationProgress.get(progressId);
}

/**
 * Aktualizuj postęp weryfikacji
 */
export function updateProgress(
  progressId: string,
  update: {
    processed?: number;
    current?: number;
    qualified?: number;
    rejected?: number;
    needsReview?: number;
    errors?: number;
    status?: 'processing' | 'completed' | 'error';
    currentCompanyName?: string;
  }
) {
  const progress = verificationProgress.get(progressId);
  if (!progress) {
    const logger = getLogger();
    logger.warn("verificationProgress", `Próba aktualizacji nieistniejącego progressId: ${progressId}`);
    return;
  }

  // Merge update z istniejącym postępem
  if (update.processed !== undefined) progress.processed = update.processed;
  if (update.current !== undefined) progress.current = update.current;
  if (update.qualified !== undefined) progress.qualified = update.qualified;
  if (update.rejected !== undefined) progress.rejected = update.rejected;
  if (update.needsReview !== undefined) progress.needsReview = update.needsReview;
  if (update.errors !== undefined) progress.errors = update.errors;
  if (update.status !== undefined) progress.status = update.status;
  if (update.currentCompanyName !== undefined) progress.currentCompanyName = update.currentCompanyName;
  
  progress.lastUpdate = Date.now();

  verificationProgress.set(progressId, progress);
  
  // Log tylko dla ważnych aktualizacji (co 5 firm lub zmiana statusu)
  if (update.status || (update.current && update.current % 5 === 0)) {
    const logger = getLogger();
    logger.debug("verificationProgress", `Zaktualizowano progress ${progressId}: ${progress.current}/${progress.total} (${progress.status})`);
  }
}

/**
 * Usuń stary postęp (cleanup)
 */
export function cleanupProgress(progressId: string) {
  verificationProgress.delete(progressId);
}

