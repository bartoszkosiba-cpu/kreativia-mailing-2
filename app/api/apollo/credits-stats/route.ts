import { NextResponse } from "next/server";
import { getApolloCreditsStats, getMonthlyApolloCreditsStats, getDailyApolloCreditsStats } from "@/services/apolloCreditsTracker";
import { logger } from "@/services/logger";

/**
 * GET /api/apollo/credits-stats?type=summary|monthly|daily&period=today|month
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "summary";
    const period = (searchParams.get("period") || "today") as "today" | "month";

    if (type === "monthly") {
      const monthlyStats = await getMonthlyApolloCreditsStats();
      return NextResponse.json(monthlyStats);
    }
    
    if (type === "daily") {
      const dailyStats = await getDailyApolloCreditsStats();
      return NextResponse.json(dailyStats);
    }

    const stats = await getApolloCreditsStats(period);
    return NextResponse.json(stats);
  } catch (error: any) {
    logger.error("[API] Błąd pobierania statystyk kredytów Apollo:", error);
    return NextResponse.json(
      { error: error.message || "Błąd serwera" },
      { status: 500 }
    );
  }
}

