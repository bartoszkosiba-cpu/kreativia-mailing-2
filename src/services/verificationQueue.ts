import { db } from '@/lib/db';
import { logger } from '@/services/logger';
import {
  VerificationCriteria,
  verifyAndSaveCompany,
  VerificationResult,
} from '@/services/companyVerificationAI';
import { getProgress, updateProgress } from '@/services/verificationProgress';

interface VerificationTask {
  taskId: string;
  companyId: number;
  progressId: string;
  index: number;
  total: number;
  criteria: VerificationCriteria;
  selectionId: number | null; // ID selekcji - weryfikacja per-selekcja
}

interface ProgressAggregation {
  total: number;
  processed: number;
  qualified: number;
  rejected: number;
  needsReview: number;
  errors: number;
  inFlight: number;
  lastCompanyName?: string;
}

interface VerificationQueueState {
  queue: VerificationTask[];
  activeWorkers: number;
  concurrency: number;
  pendingByProgress: Map<string, ProgressAggregation>;
  isProcessing: boolean;
}

const GLOBAL_KEY = '__verificationQueueState__';
const DEFAULT_CONCURRENCY = parseInt(
  process.env.COMPANY_VERIFICATION_WORKERS ||
    process.env.VERIFICATION_WORKERS ||
    '3',
  10,
);

function getQueueState(): VerificationQueueState {
  const globalAny = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: VerificationQueueState;
  };

  if (!globalAny[GLOBAL_KEY]) {
    globalAny[GLOBAL_KEY] = {
      queue: [],
      activeWorkers: 0,
      concurrency: Number.isFinite(DEFAULT_CONCURRENCY) && DEFAULT_CONCURRENCY > 0 ? DEFAULT_CONCURRENCY : 3,
      pendingByProgress: new Map(),
      isProcessing: false,
    };
  }

  return globalAny[GLOBAL_KEY]!;
}

function scheduleProcessing() {
  const state = getQueueState();

  if (state.isProcessing) {
    return;
  }

  state.isProcessing = true;

  const processNext = () => {
    const stateInner = getQueueState();

    while (
      stateInner.activeWorkers < stateInner.concurrency &&
      stateInner.queue.length > 0
    ) {
      const task = stateInner.queue.shift();
      if (!task) {
        break;
      }

      stateInner.activeWorkers += 1;
      void processTask(task).finally(() => {
        const currentState = getQueueState();
        currentState.activeWorkers = Math.max(0, currentState.activeWorkers - 1);

        if (currentState.queue.length > 0) {
          setImmediate(processNext);
        } else {
          currentState.isProcessing = false;
        }
      });
    }

    if (stateInner.queue.length === 0) {
      stateInner.isProcessing = false;
    }
  };

  setImmediate(processNext);
}

async function processTask(task: VerificationTask): Promise<void> {
  const { companyId, progressId, criteria, selectionId } = task;
  const queueState = getQueueState();
  const aggregation = queueState.pendingByProgress.get(progressId);

  if (!aggregation) {
    logger.warn('verification-queue', `Brak agregacji postępu dla ${progressId} – pomijam zadanie`);
    return;
  }

  let companyName = `Firma #${companyId}`;
  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (company?.name) {
      companyName = company.name;
    }
  } catch (error) {
    logger.warn('verification-queue', `Nie udało się pobrać nazwy firmy ${companyId}`, error instanceof Error ? error : new Error(String(error)));
  }

  aggregation.inFlight += 1;
  aggregation.lastCompanyName = companyName;

  updateProgress(progressId, {
    current: aggregation.processed + aggregation.inFlight,
    currentCompanyName: companyName,
    status: 'processing',
  });

  try {
    const result = await verifyAndSaveCompany(companyId, criteria, selectionId);
    applyResultToAggregation(progressId, aggregation, result, companyName);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('verification-queue', `Błąd weryfikacji firmy ${companyId}`, { progressId, companyId }, err);
    applyErrorToAggregation(progressId, aggregation, companyName, err);
  }
}

function applyResultToAggregation(
  progressId: string,
  aggregation: ProgressAggregation,
  result: VerificationResult,
  companyName: string,
) {
  aggregation.inFlight = Math.max(0, aggregation.inFlight - 1);
  aggregation.processed += 1;

  if (result.status === 'QUALIFIED') {
    aggregation.qualified += 1;
  } else if (result.status === 'REJECTED') {
    aggregation.rejected += 1;
  } else {
    aggregation.needsReview += 1;
  }

  const completed = aggregation.processed >= aggregation.total && aggregation.inFlight === 0;

  updateProgress(progressId, {
    processed: aggregation.processed,
    current: aggregation.processed + aggregation.inFlight,
    qualified: aggregation.qualified,
    rejected: aggregation.rejected,
    needsReview: aggregation.needsReview,
    errors: aggregation.errors,
    status: completed ? 'completed' : 'processing',
    currentCompanyName: completed ? undefined : companyName,
  });

  if (completed) {
    logger.info('verification-queue', `Zakończono weryfikację batch ${progressId}: processed=${aggregation.processed}`);
  }
}

function applyErrorToAggregation(
  progressId: string,
  aggregation: ProgressAggregation,
  companyName: string,
  error: Error,
) {
  aggregation.inFlight = Math.max(0, aggregation.inFlight - 1);
  aggregation.processed += 1;
  aggregation.errors += 1;

  const completed = aggregation.processed >= aggregation.total && aggregation.inFlight === 0;

  updateProgress(progressId, {
    processed: aggregation.processed,
    current: aggregation.processed + aggregation.inFlight,
    errors: aggregation.errors,
    status: completed ? 'error' : 'processing',
    currentCompanyName: completed ? undefined : companyName,
  });

  if (completed) {
    logger.error('verification-queue', `Batch ${progressId} zakończył się błędem`, error);
  }
}

export interface EnqueueBatchOptions {
  companyIds: number[];
  progressId: string;
  criteria: VerificationCriteria;
  selectionId: number | null; // ID selekcji - weryfikacja per-selekcja
}

export function enqueueVerificationBatch(options: EnqueueBatchOptions) {
  const { companyIds, progressId, criteria, selectionId } = options;
  const queueState = getQueueState();

  if (!Array.isArray(companyIds) || companyIds.length === 0) {
    throw new Error('Brak firm do weryfikacji w batchu');
  }

  const progress = getProgress(progressId);
  if (!progress) {
    throw new Error(`Nie znaleziono postępu dla progressId: ${progressId}`);
  }

  let aggregation = queueState.pendingByProgress.get(progressId);
  if (!aggregation) {
    aggregation = {
      total: progress.total || companyIds.length,
      processed: progress.processed || 0,
      qualified: progress.qualified || 0,
      rejected: progress.rejected || 0,
      needsReview: progress.needsReview || 0,
      errors: progress.errors || 0,
      inFlight: 0,
    };
    queueState.pendingByProgress.set(progressId, aggregation);
  } else {
    aggregation.total += companyIds.length;
  }

  const baseProcessed = aggregation.processed + aggregation.inFlight;

  const tasks = companyIds.map<VerificationTask>((companyId, idx) => ({
    taskId: `task_${progressId}_${companyId}_${Date.now()}_${idx}_${Math.random()
      .toString(36)
      .substring(2, 8)}`,
    companyId,
    progressId,
    index: baseProcessed + idx + 1,
    total: aggregation.total,
    criteria,
    selectionId: selectionId ?? null,
  }));

  queueState.queue.push(...tasks);

  logger.info(
    'verification-queue',
    `Dodano ${tasks.length} zadań do kolejki (progressId=${progressId}). Łącznie w kolejce: ${queueState.queue.length}`,
  );

  scheduleProcessing();
}

export function getVerificationQueueSnapshot() {
  const state = getQueueState();
  return {
    queueLength: state.queue.length,
    activeWorkers: state.activeWorkers,
    concurrency: state.concurrency,
    progressIds: Array.from(state.pendingByProgress.keys()),
  };
}
