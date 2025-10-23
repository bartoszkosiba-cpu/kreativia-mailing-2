import { NextRequest, NextResponse } from "next/server";
import { sendDailyReportEmail } from "../../../../src/services/dailyReportEmail";

// POST - Wyślij raport emailem
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    
    const date = dateParam ? new Date(dateParam) : new Date();

    await sendDailyReportEmail(date);

    return NextResponse.json({
      success: true,
      message: "Raport wysłany"
    });
  } catch (error: any) {
    console.error("Błąd wysyłki raportu:", error);
    return NextResponse.json(
      { error: error.message || "Wystąpił błąd" },
      { status: 500 }
    );
  }
}

