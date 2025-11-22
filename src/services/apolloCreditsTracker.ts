import { db } from "@/lib/db";
import { logger } from "./logger";

// Ceny Apollo (USD za kredyt) - estymowane na podstawie dokumentacji
const APOLLO_CREDIT_COST_USD = 0.01; // 1 kredyt = $0.01 - $0.05, przyjmujemy średnią

// Kurs USD/PLN (można później dodać automatyczne pobieranie)
const USD_TO_PLN = 4.20;

interface ApolloCreditParams {
  endpoint: string;
  options?: {
    perPage?: number;
    page?: number;
    revealEmails?: boolean;
    includePersonalEmails?: boolean;
  };
  responseData?: {
    pagination?: {
      total_entries?: number;
      total_pages?: number;
      per_page?: number;
    };
    people?: any[];
    contacts?: any[];
  };
  peopleCount?: number; // Liczba osób do bulk_match
  newEmailsCount?: number; // Liczba nowych emaili dla bulk_match
}

/**
 * Oblicz liczbę kredytów zużytych dla danego wywołania Apollo API
 */
export function calculateCreditsUsed(params: ApolloCreditParams): number {
  const { endpoint, options, responseData, peopleCount, newEmailsCount } = params;
  let credits = 0;

  // Logika naliczania kredytów na podstawie dokumentacji Apollo
  if (endpoint.includes("/mixed_people/api_search")) {
    // /mixed_people/api_search jest DARMOWE (no credit charge) - zgodnie z dokumentacją Apollo
    credits = 0;
    logger.debug("apollo-credits", `Calculated ${credits} credits for /mixed_people/api_search (FREE - no credit charge)`);
  } else if (endpoint.includes("/mixed_people/search")) {
    // 1 credit / page returned (tylko jeśli includePersonalEmails=true)
    if (options?.includePersonalEmails) {
      credits = responseData?.pagination?.total_pages || 1;
      logger.debug("apollo-credits", `Calculated ${credits} credits for /mixed_people/search (per page)`);
    }
  } else if (endpoint.includes("/people/bulk_match")) {
    // 1 credit / net-new email returned
    credits = newEmailsCount || 0;
    logger.debug("apollo-credits", `Calculated ${credits} credits for /people/bulk_match (new emails)`);
  } else if (endpoint.includes("/people/search")) {
    // /people/search - NIE jest wymieniony w oficjalnej dokumentacji Apollo jako endpoint zużywający kredyty,
    // ALE w praktyce Apollo nalicza kredyty za ten endpoint.
    // Z doświadczenia: 1 kredyt za każde wywołanie (za firmę), niezależnie od liczby stron wyników.
    // To jest inne niż /mixed_people/search (1 kredyt za stronę).
    // 
    // WAŻNE: Jeśli revealEmails=true, to dodatkowo mogą być naliczane kredyty za odkryte emaile,
    // ale podstawowe wywołanie /people/search kosztuje 1 kredyt za firmę.
    credits = 1; // 1 kredyt za każde wywołanie /people/search (za firmę)
    logger.debug("apollo-credits", `Calculated ${credits} credit for /people/search (1 credit per company call)`);
  } else if (endpoint.includes("/organizations/enrich")) {
    // 1 credit / result returned
    credits = 1;
    logger.debug("apollo-credits", `Calculated ${credits} credits for /organizations/enrich`);
  } else if (endpoint.includes("/organizations/bulk_enrich")) {
    // 1 credit / company returned
    credits = peopleCount || 0; // Liczba firm
    logger.debug("apollo-credits", `Calculated ${credits} credits for /organizations/bulk_enrich`);
  }
  // /mixed_people/api_search jest darmowy, więc 0 kredytów

  return credits;
}

/**
 * Zapisz użycie kredytów Apollo do bazy
 */
export async function trackApolloCredits(params: {
  operation: string;
  endpoint: string;
  creditsUsed: number;
  metadata?: Record<string, any>;
  responseHeaders?: Record<string, string>;
}) {
  try {
    const estimatedCost = params.creditsUsed * APOLLO_CREDIT_COST_USD;

    const metadata = {
      ...params.metadata,
      responseHeaders: params.responseHeaders,
    };

    await (db as any).apolloCreditsUsage.create({
      data: {
        operation: params.operation,
        endpoint: params.endpoint,
        creditsUsed: params.creditsUsed,
        estimatedCost,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    logger.info(
      "apollo-credits",
      `[CREDIT TRACKER] ${params.operation} | ${params.endpoint} | ` +
        `${params.creditsUsed} credits | $${estimatedCost.toFixed(6)}`
    );
  } catch (error) {
    logger.error("apollo-credits", "[CREDIT TRACKER] Błąd zapisu:", error);
  }
}

/**
 * Pobierz statystyki kredytów Apollo z kosztami w PLN
 */
export async function getApolloCreditsStats(period: "today" | "month" = "today") {
  const now = new Date();

  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
      break;
    default:
      startDate = new Date(0); // All time
      endDate = new Date();
  }

  const usage = await (db as any).apolloCreditsUsage.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalCredits = usage.reduce((sum: number, u: any) => sum + u.creditsUsed, 0);
  const totalCostUSD = usage.reduce((sum: number, u: any) => sum + u.estimatedCost, 0);
  const totalCostPLN = totalCostUSD * USD_TO_PLN;
  const totalCalls = usage.length;

  return {
    period,
    summary: {
      totalCalls,
      totalCredits,
      totalCostUSD,
      totalCostPLN,
      avgCreditsPerCall: totalCalls > 0 ? Math.round(totalCredits / totalCalls) : 0,
      avgCostPerCallUSD: totalCalls > 0 ? totalCostUSD / totalCalls : 0,
      avgCostPerCallPLN: totalCalls > 0 ? totalCostPLN / totalCalls : 0,
      exchangeRate: USD_TO_PLN,
    },
    recentCalls: usage.slice(0, 10),
  };
}

export async function getMonthlyApolloCreditsStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const usage = await (db as any).apolloCreditsUsage.findMany({
    where: {
      createdAt: {
        gte: startOfMonth,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalCredits = usage.reduce((sum: number, u: any) => sum + u.creditsUsed, 0);
  const totalCostUSD = usage.reduce((sum: number, u: any) => sum + u.estimatedCost, 0);
  const totalCostPLN = totalCostUSD * USD_TO_PLN;
  const totalCalls = usage.length;

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    totalCalls,
    totalCredits,
    totalCostUSD,
    totalCostPLN,
    exchangeRate: USD_TO_PLN,
  };
}

export async function getDailyApolloCreditsStats() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const usage = await (db as any).apolloCreditsUsage.findMany({
    where: {
      createdAt: {
        gte: startOfDay,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalCredits = usage.reduce((sum: number, u: any) => sum + u.creditsUsed, 0);
  const totalCostUSD = usage.reduce((sum: number, u: any) => sum + u.estimatedCost, 0);
  const totalCostPLN = totalCostUSD * USD_TO_PLN;
  const totalCalls = usage.length;

  return {
    date: now.toISOString().split("T")[0],
    totalCalls,
    totalCredits,
    totalCostUSD,
    totalCostPLN,
    exchangeRate: USD_TO_PLN,
  };
}

