import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * Zmiana statusu weryfikacji firmy
 * PATCH /api/company-selection/update-status
 */
export async function PATCH(req: NextRequest) {
  try {
    const { companyId, status, reason, selectionId } = await req.json();

    if (!companyId || typeof companyId !== "number") {
      return NextResponse.json(
        { error: "companyId jest wymagane" },
        { status: 400 }
      );
    }

    if (!status || !["QUALIFIED", "REJECTED", "PENDING", "NEEDS_REVIEW", "BLOCKED"].includes(status)) {
      return NextResponse.json(
        { error: "Nieprawidłowy status. Dozwolone: QUALIFIED, REJECTED, PENDING, NEEDS_REVIEW, BLOCKED" },
        { status: 400 }
      );
    }

    // Pobierz firmę
    const company = await db.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Firma nie istnieje" },
        { status: 404 }
      );
    }

    // Jeśli selectionId jest podane, aktualizuj tylko status w tej selekcji (per-selekcja)
    // Jeśli nie, aktualizuj globalny status (dla firm bez selekcji - nie powinno się zdarzyć w normalnym użyciu)
    if (selectionId != null && Number.isFinite(selectionId)) {
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

      // Aktualizuj status w selekcji
      await db.companySelectionCompany.update({
        where: {
          selectionId_companyId: {
            selectionId,
            companyId,
          },
        },
        data: {
          status,
          reason: reason || membership.reason,
          verifiedAt: new Date(),
        },
      });

      logger.info("company-verify", `Status firmy zmieniony ręcznie w selekcji ${selectionId}: ${company.name} (ID: ${companyId})`, {
        oldStatus: membership.status,
        newStatus: status,
        reason: reason || membership.reason,
      });

      return NextResponse.json({
        success: true,
        company: {
          ...company,
          verificationStatus: status, // Zwracamy status dla kompatybilności
        },
      });
    } else {
      // Aktualizuj globalny status (nie powinno się zdarzyć w normalnym użyciu)
      const updatedCompany = await db.company.update({
        where: { id: companyId },
        data: {
          verificationStatus: status,
          verificationReason: reason || company.verificationReason,
          verificationSource: "MANUAL",
          verifiedBy: "MANUAL",
          verifiedAt: new Date(),
        },
      });

      logger.info("company-verify", `Status firmy zmieniony ręcznie (globalny): ${company.name} (ID: ${companyId})`, {
        oldStatus: company.verificationStatus,
        newStatus: status,
        reason: reason || company.verificationReason,
      });

      return NextResponse.json({
        success: true,
        company: updatedCompany,
      });
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-verify", "Błąd zmiany statusu firmy", null, errorObj);
    return NextResponse.json(
      { error: "Błąd zmiany statusu firmy", details: errorObj.message },
      { status: 500 }
    );
  }
}

