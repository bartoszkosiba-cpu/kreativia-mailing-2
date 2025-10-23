import { NextRequest, NextResponse } from "next/server";
import { getDailySummaryReport } from "../../../../src/services/campaignStats";

// GET - Pobierz dzienny raport
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    
    const date = dateParam ? new Date(dateParam) : new Date();

    const report = await getDailySummaryReport(date);

    return NextResponse.json(report);
  } catch (error: any) {
    console.error("Błąd pobierania raportu:", error);
    return NextResponse.json(
      { error: error.message || "Wystąpił błąd" },
      { status: 500 }
    );
  }
}

