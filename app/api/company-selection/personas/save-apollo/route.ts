import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchApolloEmployeesForCompany } from "@/services/apolloEmployeesService";
import { logger } from "@/services/logger";

/**
 * Pobiera persony z Apollo i zapisuje je w bazie (bez weryfikacji AI)
 * POST /api/company-selection/personas/save-apollo
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companyId = Number(body.companyId);

    if (!companyId || Number.isNaN(companyId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe companyId" }, { status: 400 });
    }

    // Pobierz persony z Apollo
    const apolloResult = await fetchApolloEmployeesForCompany(companyId);
    
    if (!apolloResult.success) {
      return NextResponse.json(
        { success: false, error: apolloResult.message || "Błąd pobierania pracowników z Apollo" },
        { status: apolloResult.apiAccessError ? 403 : 500 }
      );
    }

    // Zapisz persony w bazie (bez weryfikacji AI)
    const employeesJson = JSON.stringify(apolloResult.people || []);
    const metadataJson = JSON.stringify({
      apolloFetchedAt: new Date().toISOString(),
      statistics: apolloResult.statistics || null,
      uniqueTitles: apolloResult.uniqueTitles || [],
      apolloOrganization: apolloResult.apolloOrganization || null,
      creditsInfo: apolloResult.creditsInfo || null,
      verifiedByAI: false, // Oznaczenie, że to tylko pobranie z Apollo, bez weryfikacji AI
    });

    // Sprawdź, czy istnieje już weryfikacja z AI
    const existing = await db.personaVerificationResult.findUnique({
      where: { companyId },
    });

    // Jeśli istnieje weryfikacja z AI, nie nadpisuj jej - tylko zaktualizuj metadane Apollo
    if (existing && existing.personaCriteriaId !== null) {
      const existingMetadata = existing.metadata ? JSON.parse(existing.metadata) : {};
      const updatedMetadata = {
        ...existingMetadata,
        apolloFetchedAt: new Date().toISOString(),
        apolloStatistics: apolloResult.statistics || null,
        apolloUniqueTitles: apolloResult.uniqueTitles || [],
        apolloOrganization: apolloResult.apolloOrganization || null,
        apolloCreditsInfo: apolloResult.creditsInfo || null,
      };

      const saved = await db.personaVerificationResult.update({
        where: { companyId },
        data: {
          metadata: JSON.stringify(updatedMetadata),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          companyId,
          fetchedAt: saved.verifiedAt,
          employeesCount: apolloResult.people?.length || 0,
          statistics: apolloResult.statistics,
          apolloOrganization: apolloResult.apolloOrganization,
          note: "Persony z Apollo zapisane w metadanych (istnieje już weryfikacja AI)",
        },
      });
    }

    // Jeśli nie ma weryfikacji AI, zapisz persony z Apollo
    const saved = await db.personaVerificationResult.upsert({
      where: { companyId },
      create: {
        companyId,
        personaCriteriaId: null, // Brak weryfikacji AI
        verifiedAt: new Date(),
        positiveCount: 0,
        negativeCount: 0,
        unknownCount: apolloResult.people?.length || 0, // Wszystkie jako unknown, bo nie było weryfikacji
        employees: employeesJson,
        metadata: metadataJson,
      },
      update: {
        // Aktualizuj tylko jeśli nie było weryfikacji AI (personaCriteriaId === null)
        personaCriteriaId: null,
        verifiedAt: new Date(),
        positiveCount: 0,
        negativeCount: 0,
        unknownCount: apolloResult.people?.length || 0,
        employees: employeesJson,
        metadata: metadataJson,
      },
    });

    logger.info("persona-apollo-save", `Zapisano persony z Apollo dla firmy ${companyId}`, { companyId, count: apolloResult.people?.length || 0 });

    return NextResponse.json({
      success: true,
      data: {
        companyId,
        fetchedAt: saved.verifiedAt,
        employeesCount: apolloResult.people?.length || 0,
        statistics: apolloResult.statistics,
        apolloOrganization: apolloResult.apolloOrganization,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-apollo-save", "Błąd zapisywania person z Apollo", null, err);
    return NextResponse.json(
      { success: false, error: "Błąd zapisywania person z Apollo", details: err.message },
      { status: 500 }
    );
  }
}

