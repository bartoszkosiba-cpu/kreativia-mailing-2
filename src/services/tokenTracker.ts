import { db } from "@/lib/db";

/**
 * Ceny OpenAI (USD za 1M tokenów) - stan na 2025
 * https://openai.com/api/pricing/
 */
const PRICING = {
  "gpt-4o": {
    input: 2.50,   // $2.50 / 1M input tokens
    output: 10.00  // $10.00 / 1M output tokens
  },
  "gpt-4o-mini": {
    input: 0.15,   // $0.15 / 1M input tokens
    output: 0.60   // $0.60 / 1M output tokens
  },
  "gpt-4": {
    input: 30.00,
    output: 60.00
  },
  "gpt-3.5-turbo": {
    input: 0.50,
    output: 1.50
  }
};

/**
 * Oblicz koszt wywołania OpenAI
 */
function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING["gpt-4o"];
  
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Zapisz użycie tokenów do bazy
 */
export async function trackTokenUsage(params: {
  operation: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  metadata?: Record<string, any>;
}) {
  try {
    const totalTokens = params.promptTokens + params.completionTokens;
    const estimatedCost = calculateCost(params.model, params.promptTokens, params.completionTokens);

    await db.aITokenUsage.create({
      data: {
        operation: params.operation,
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens,
        estimatedCost,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      }
    });

    console.log(
      `[TOKEN TRACKER] ${params.operation} | ${params.model} | ` +
      `${totalTokens.toLocaleString()} tokens | $${estimatedCost.toFixed(6)}`
    );
  } catch (error) {
    console.error("[TOKEN TRACKER] Błąd zapisu:", error);
    // Nie przerywaj wykonania głównej funkcji
  }
}

/**
 * Pobierz statystyki tokenów z kosztami w PLN
 */
export async function getTokenStats(period: "today" | "week" | "month" | "all" = "today") {
  const now = new Date();
  
  // Kurs USD/PLN (można później dodać automatyczne pobieranie)
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
      startDate = new Date(0); // All time
      endDate = new Date();
  }

  const usage = await db.aITokenUsage.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
  const totalCostUSD = usage.reduce((sum, u) => sum + u.estimatedCost, 0);
  const totalCostPLN = totalCostUSD * USD_TO_PLN;
  const totalCalls = usage.length;

  // Grupuj po operacjach
  const byOperation = usage.reduce((acc, u) => {
    if (!acc[u.operation]) {
      acc[u.operation] = {
        calls: 0,
        tokens: 0,
        costUSD: 0,
        costPLN: 0
      };
    }
    acc[u.operation].calls += 1;
    acc[u.operation].tokens += u.totalTokens;
    acc[u.operation].costUSD += u.estimatedCost;
    acc[u.operation].costPLN += u.estimatedCost * USD_TO_PLN;
    return acc;
  }, {} as Record<string, { calls: number; tokens: number; costUSD: number; costPLN: number }>);

  // Grupuj po modelach
  const byModel = usage.reduce((acc, u) => {
    if (!acc[u.model]) {
      acc[u.model] = {
        calls: 0,
        tokens: 0,
        costUSD: 0,
        costPLN: 0
      };
    }
    acc[u.model].calls += 1;
    acc[u.model].tokens += u.totalTokens;
    acc[u.model].costUSD += u.estimatedCost;
    acc[u.model].costPLN += u.estimatedCost * USD_TO_PLN;
    return acc;
  }, {} as Record<string, { calls: number; tokens: number; costUSD: number; costPLN: number }>);

  return {
    period,
    summary: {
      totalCalls,
      totalTokens,
      totalCostUSD,
      totalCostPLN,
      avgTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
      avgCostPerCallUSD: totalCalls > 0 ? totalCostUSD / totalCalls : 0,
      avgCostPerCallPLN: totalCalls > 0 ? totalCostPLN / totalCalls : 0,
      exchangeRate: USD_TO_PLN
    },
    byOperation,
    byModel,
    recentCalls: usage.slice(0, 10)
  };
}

/**
 * Pobierz statystyki miesięczne (narastające od początku miesiąca)
 */
export async function getMonthlyTokenStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const USD_TO_PLN = 4.20;

  const usage = await db.aITokenUsage.findMany({
    where: {
      createdAt: {
        gte: startOfMonth
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const totalCostUSD = usage.reduce((sum, u) => sum + u.estimatedCost, 0);
  const totalCostPLN = totalCostUSD * USD_TO_PLN;
  const totalCalls = usage.length;

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    totalCalls,
    totalCostUSD,
    totalCostPLN,
    exchangeRate: USD_TO_PLN
  };
}

/**
 * Pobierz statystyki dzienne (od początku dnia - 00:00)
 */
export async function getDailyTokenStats() {
  const now = new Date();
  // Reset dzienny o 00:00 - pobierz dane od początku dzisiejszego dnia
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const USD_TO_PLN = 4.20;

  const usage = await db.aITokenUsage.findMany({
    where: {
      createdAt: {
        gte: startOfDay
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const totalCostUSD = usage.reduce((sum, u) => sum + u.estimatedCost, 0);
  const totalCostPLN = totalCostUSD * USD_TO_PLN;
  const totalCalls = usage.length;

  return {
    date: now.toISOString().split('T')[0],
    totalCalls,
    totalCostUSD,
    totalCostPLN,
    exchangeRate: USD_TO_PLN
  };
}

