import { NextRequest, NextResponse } from "next/server";
import { verifyAndSaveCompany } from "@/services/companyVerificationAI";
import { logger } from "@/services/logger";
import { updateProgress, getProgress } from "@/services/verificationProgress";
import { enqueueVerificationBatch, getVerificationQueueSnapshot } from "@/services/verificationQueue";
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
    const criteriaId = body.criteriaId ? Number(body.criteriaId) : null;
    const selectionId = body.selectionId ? Number(body.selectionId) : null;

    if (!companyId || typeof companyId !== "number") {
      return NextResponse.json(
        { error: "companyId jest wymagane" },
        { status: 400 }
      );
    }

    if (!criteriaId || !Number.isFinite(criteriaId)) {
      return NextResponse.json(
        { error: "criteriaId jest wymagane. Wybierz kryteria weryfikacji." },
        { status: 400 }
      );
    }

    if (!selectionId || !Number.isFinite(selectionId)) {
      return NextResponse.json(
        { error: "selectionId jest wymagane. Weryfikacja musi odbywać się w kontekście selekcji." },
        { status: 400 }
      );
    }

    logger.info("company-verify", `Weryfikuję firmę ID: ${companyId} z kryteriami ID: ${criteriaId} w selekcji ID: ${selectionId}`);

    // Sprawdź, czy firma jest w tej selekcji
    const membership = await db.companySelectionCompany.findUnique({
      where: {
        selectionId_companyId: {
          selectionId,
          companyId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Firma nie jest w tej selekcji." },
        { status: 404 }
      );
    }

    // Pobierz kryteria
    const criteriaRecord = await db.companyVerificationCriteria.findUnique({
      where: { id: criteriaId },
    });

    if (!criteriaRecord) {
      logger.warn("company-verify", `Nie znaleziono kryteriów ID: ${criteriaId}`);
      return NextResponse.json(
        { error: "Nie znaleziono wybranych kryteriów weryfikacji." },
        { status: 404 }
      );
    }

    const criteria = {
      id: criteriaRecord.id,
      name: criteriaRecord.name,
      criteriaText: criteriaRecord.criteriaText,
      qualifiedThreshold: criteriaRecord.qualifiedThreshold,
      rejectedThreshold: criteriaRecord.rejectedThreshold,
      qualifiedKeywords: criteriaRecord.qualifiedKeywords
        ? JSON.parse(criteriaRecord.qualifiedKeywords)
        : undefined,
      rejectedKeywords: criteriaRecord.rejectedKeywords
        ? JSON.parse(criteriaRecord.rejectedKeywords)
        : undefined,
    };

    // Weryfikuj (tylko dla tej selekcji - nie aktualizujemy globalnego statusu)
    const result = await verifyAndSaveCompany(companyId, criteria, selectionId);
    logger.info("company-verify", `Firma ${companyId} zweryfikowana w selekcji ${selectionId}: ${result.status} (score: ${result.score})`);

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
    const { companyIds, progressId, criteriaId, selectionId } = await req.json();

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

    if (!criteriaId || !Number.isFinite(criteriaId)) {
      return NextResponse.json(
        { error: "criteriaId jest wymagane. Wybierz kryteria weryfikacji." },
        { status: 400 }
      );
    }

    if (!selectionId || !Number.isFinite(selectionId)) {
      return NextResponse.json(
        { error: "selectionId jest wymagane. Weryfikacja musi odbywać się w kontekście selekcji." },
        { status: 400 }
      );
    }

    const progress = getProgress(progressId);
    if (!progress) {
      return NextResponse.json(
        { error: "Nie znaleziono postępu dla podanego progressId" },
        { status: 404 }
      );
    }

    logger.info("company-verify", `Kolejkuję weryfikację batch: ${companyIds.length} firm (progressId: ${progressId}, criteriaId: ${criteriaId}, selectionId: ${selectionId})`);

    // Sprawdź, czy wszystkie firmy są w tej selekcji
    const memberships = await db.companySelectionCompany.findMany({
      where: {
        selectionId: Number(selectionId),
        companyId: { in: companyIds },
      },
      select: { companyId: true },
    });

    const membershipCompanyIds = new Set(memberships.map(m => m.companyId));
    const missingCompanies = companyIds.filter(id => !membershipCompanyIds.has(id));

    if (missingCompanies.length > 0) {
      return NextResponse.json(
        { error: `Następujące firmy nie są w tej selekcji: ${missingCompanies.join(", ")}` },
        { status: 400 }
      );
    }

    // Pobierz kryteria
    const criteriaRecord = await db.companyVerificationCriteria.findUnique({
      where: { id: Number(criteriaId) },
    });

    if (!criteriaRecord) {
      logger.warn("company-verify", `Nie znaleziono kryteriów ID: ${criteriaId} (batch)`);
      updateProgress(progressId, { status: 'error' });
      return NextResponse.json(
        { error: "Nie znaleziono wybranych kryteriów weryfikacji." },
        { status: 404 }
      );
    }

    const criteria = {
      id: criteriaRecord.id,
      name: criteriaRecord.name,
      criteriaText: criteriaRecord.criteriaText,
      qualifiedThreshold: criteriaRecord.qualifiedThreshold,
      rejectedThreshold: criteriaRecord.rejectedThreshold,
      qualifiedKeywords: criteriaRecord.qualifiedKeywords
        ? JSON.parse(criteriaRecord.qualifiedKeywords)
        : undefined,
      rejectedKeywords: criteriaRecord.rejectedKeywords
        ? JSON.parse(criteriaRecord.rejectedKeywords)
        : undefined,
    };

    updateProgress(progressId, {
      status: 'processing',
      processed: progress.processed || 0,
      current: progress.processed || 0,
      currentCompanyName: 'Kolejka w przygotowaniu...'
    });

    enqueueVerificationBatch({
      companyIds,
      progressId,
      criteria,
      selectionId: Number(selectionId),
    });

    const snapshot = getVerificationQueueSnapshot();

    return NextResponse.json({
      success: true,
      progressId,
      queued: companyIds.length,
      queue: snapshot,
      message: "Weryfikacja została dodana do kolejki i będzie realizowana równolegle przez workerów.",
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

