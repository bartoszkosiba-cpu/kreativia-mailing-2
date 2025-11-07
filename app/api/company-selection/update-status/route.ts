import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * Zmiana statusu weryfikacji firmy
 * PATCH /api/company-selection/update-status
 */
export async function PATCH(req: NextRequest) {
  try {
    const { companyId, status, reason } = await req.json();

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

    // Aktualizuj status
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

    logger.info("company-verify", `Status firmy zmieniony ręcznie: ${company.name} (ID: ${companyId})`, {
      oldStatus: company.verificationStatus,
      newStatus: status,
      reason: reason || company.verificationReason,
    });

    return NextResponse.json({
      success: true,
      company: updatedCompany,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-verify", "Błąd zmiany statusu firmy", null, errorObj);
    return NextResponse.json(
      { error: "Błąd zmiany statusu firmy", details: errorObj.message },
      { status: 500 }
    );
  }
}

