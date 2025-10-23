import { NextResponse } from "next/server";
import { getTokenStats, getMonthlyTokenStats, getDailyTokenStats } from "@/services/tokenTracker";

/**
 * GET /api/ai/token-stats?type=summary|monthly|daily&period=today|week|month|all
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "summary";
    const period = (searchParams.get("period") || "today") as "today" | "week" | "month" | "all";

    if (type === "monthly") {
      const monthlyStats = await getMonthlyTokenStats();
      return NextResponse.json(monthlyStats);
    }
    
    if (type === "daily") {
      const dailyStats = await getDailyTokenStats();
      return NextResponse.json(dailyStats);
    }

    // Domyślnie zwróć szczegółowe statystyki
    const stats = await getTokenStats(period);
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("[API] Błąd pobierania statystyk tokenów:", error);
    return NextResponse.json(
      { error: error.message || "Błąd serwera" },
      { status: 500 }
    );
  }
}

