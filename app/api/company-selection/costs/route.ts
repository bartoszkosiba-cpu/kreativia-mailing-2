import { NextRequest, NextResponse } from "next/server";
import { getTokenStats } from "@/services/tokenTracker";
import { db } from "@/lib/db";

/**
 * Pobierz koszty AI dla modułu wyboru leadów
 * GET /api/company-selection/costs?period=today|week|month|all
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const period = (searchParams.get("period") || "today") as "today" | "week" | "month" | "all";

    // Operacje związane z modułem wyboru leadów
    const leadSelectionOperations = [
      "company_verification",
      "company_criteria_chat",
      "company_criteria_generate",
      "company_classification", // Klasyfikacja AI firm
    ];

    const now = new Date();
    const USD_TO_PLN = 4.20;

    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date();
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
        break;
      default:
        startDate = new Date(0);
        endDate = new Date();
    }

    // Pobierz użycie tokenów dla operacji modułu wyboru leadów
    const usage = await db.aITokenUsage.findMany({
      where: {
        operation: {
          in: leadSelectionOperations,
        },
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
    const totalCostUSD = usage.reduce((sum, u) => sum + u.estimatedCost, 0);
    const totalCostPLN = totalCostUSD * USD_TO_PLN;
    const totalCalls = usage.length;

    // Grupuj po operacjach
    const byOperation = usage.reduce(
      (acc, u) => {
        if (!acc[u.operation]) {
          acc[u.operation] = {
            calls: 0,
            tokens: 0,
            costUSD: 0,
            costPLN: 0,
          };
        }
        acc[u.operation].calls += 1;
        acc[u.operation].tokens += u.totalTokens;
        acc[u.operation].costUSD += u.estimatedCost;
        acc[u.operation].costPLN += u.estimatedCost * USD_TO_PLN;
        return acc;
      },
      {} as Record<
        string,
        { calls: number; tokens: number; costUSD: number; costPLN: number }
      >
    );

    // Grupuj po modelach
    const byModel = usage.reduce(
      (acc, u) => {
        if (!acc[u.model]) {
          acc[u.model] = {
            calls: 0,
            tokens: 0,
            costUSD: 0,
            costPLN: 0,
          };
        }
        acc[u.model].calls += 1;
        acc[u.model].tokens += u.totalTokens;
        acc[u.model].costUSD += u.estimatedCost;
        acc[u.model].costPLN += u.estimatedCost * USD_TO_PLN;
        return acc;
      },
      {} as Record<
        string,
        { calls: number; tokens: number; costUSD: number; costPLN: number }
      >
    );

    // Pobierz też koszty całej aplikacji dla porównania
    const allUsage = await db.aITokenUsage.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    const allTotalCostUSD = allUsage.reduce((sum, u) => sum + u.estimatedCost, 0);
    const allTotalCostPLN = allTotalCostUSD * USD_TO_PLN;

    return NextResponse.json({
      period,
      module: {
        summary: {
          totalCalls,
          totalTokens,
          totalCostUSD,
          totalCostPLN,
          avgTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
          avgCostPerCallUSD: totalCalls > 0 ? totalCostUSD / totalCalls : 0,
          avgCostPerCallPLN: totalCalls > 0 ? totalCostPLN / totalCalls : 0,
        },
        byOperation,
        byModel,
      },
      application: {
        totalCostUSD: allTotalCostUSD,
        totalCostPLN: allTotalCostPLN,
        modulePercentage: allTotalCostUSD > 0 
          ? (totalCostUSD / allTotalCostUSD) * 100 
          : 0,
      },
      exchangeRate: USD_TO_PLN,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { error: "Błąd pobierania kosztów", details: errorObj.message },
      { status: 500 }
    );
  }
}

