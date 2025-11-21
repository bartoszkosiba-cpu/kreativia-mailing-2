import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";

/**
 * GET /api/company-selection/personas/export-csv
 * Eksportuje zapisane pracowników z Apollo do CSV
 * Query params:
 * - selectionId: ID selekcji (opcjonalnie)
 * - personaCriteriaId: ID kryteriów person (opcjonalnie)
 * - companyIds: Lista ID firm oddzielona przecinkami (opcjonalnie)
 * - decision: "positive" | "negative" | "all" (opcjonalnie, domyślnie "all")
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const selectionId = searchParams.get("selectionId");
    const personaCriteriaId = searchParams.get("personaCriteriaId");
    const companyIdsParam = searchParams.get("companyIds");
    const decision = searchParams.get("decision") || "all";

    // Buduj warunki zapytania
    const where: any = {};

    if (selectionId) {
      where.selectionId = Number(selectionId);
    }

    if (personaCriteriaId) {
      where.personaCriteriaId = Number(personaCriteriaId);
    }

    if (companyIdsParam) {
      const companyIds = companyIdsParam.split(",").map((id) => Number(id.trim())).filter((id) => !isNaN(id));
      if (companyIds.length > 0) {
        where.companyId = { in: companyIds };
      }
    }

    if (decision !== "all") {
      where.decision = decision;
    }

    // Pobierz pracowników z bazy
    const employees = await (db as any).apolloEmployee.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            industry: true,
            country: true,
            city: true,
            website: true,
          },
        },
      },
      orderBy: [
        { company: { name: "asc" } },
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });

    if (employees.length === 0) {
      return NextResponse.json(
        { success: false, error: "Brak danych do eksportu" },
        { status: 404 }
      );
    }

    // Przygotuj nagłówki CSV (w tym samym formacie co eksport leadów)
    const headers = [
      "ID",
      "Imię",
      "Nazwisko",
      "Stanowisko",
      "Firma",
      "Email",
      "Status emaila",
      "LinkedIn",
      "Działy",
      "Seniority",
      "Decyzja AI",
      "Score AI",
      "Uzasadnienie AI",
      "ID firmy",
      "Branża firmy",
      "Kraj firmy",
      "Miasto firmy",
      "Strona www firmy",
      "Data pobrania z Apollo",
      "Data weryfikacji",
    ];

    // Przygotuj dane CSV
    const rows = employees.map((emp: any) => {
      const departments = emp.departments ? (typeof emp.departments === "string" ? JSON.parse(emp.departments) : emp.departments) : [];
      const departmentsStr = Array.isArray(departments) ? departments.join("; ") : "";

      return [
        emp.id || "",
        emp.firstName || "",
        emp.lastName || "",
        emp.title || "",
        emp.company?.name || "",
        emp.email || "",
        emp.emailStatus || "",
        emp.linkedinUrl || "",
        departmentsStr,
        emp.seniority || "",
        emp.decision || "",
        emp.score !== null && emp.score !== undefined ? String(emp.score) : "",
        emp.reason || "",
        emp.company?.id || "",
        emp.company?.industry || "",
        emp.company?.country || "",
        emp.company?.city || "",
        emp.company?.website || "",
        emp.apolloFetchedAt ? new Date(emp.apolloFetchedAt).toLocaleString("pl-PL") : "",
        emp.verifiedAt ? new Date(emp.verifiedAt).toLocaleString("pl-PL") : "",
      ];
    });

    // Funkcja do escape'owania wartości CSV
    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // Jeśli zawiera przecinek, cudzysłów lub nową linię, otocz cudzysłowami i podwoj cudzysłowy
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Generuj CSV
    const csvLines = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ];

    const csvContent = csvLines.join("\n");

    // Ustaw nagłówki odpowiedzi dla pobrania pliku
    const response = new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="apollo-employees-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });

    logger.info("apollo-export-csv", `Wyeksportowano ${employees.length} rekordów do CSV`, {
      selectionId,
      personaCriteriaId,
      companyIds: companyIdsParam,
      decision,
    });

    return response;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo-export-csv", "Błąd eksportu CSV", {}, err);
    return NextResponse.json(
      { success: false, error: "Błąd eksportu CSV", details: err.message },
      { status: 500 }
    );
  }
}

