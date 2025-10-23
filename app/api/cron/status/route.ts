import { NextResponse } from "next/server";
import { isEmailCronRunning, startEmailCron, stopEmailCron } from "../../../../src/services/emailCron";

// GET - Sprawdź status crona
export async function GET() {
  try {
    const isRunning = isEmailCronRunning();
    
    return NextResponse.json({
      running: isRunning,
      message: isRunning ? "Cron job działa" : "Cron job zatrzymany",
      interval: "15 minut"
    });
  } catch (error: any) {
    console.error("Błąd sprawdzania statusu crona:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Uruchom cron
export async function POST() {
  try {
    startEmailCron();
    
    return NextResponse.json({
      success: true,
      message: "Cron job uruchomiony"
    });
  } catch (error: any) {
    console.error("Błąd uruchamiania crona:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Zatrzymaj cron
export async function DELETE() {
  try {
    stopEmailCron();
    
    return NextResponse.json({
      success: true,
      message: "Cron job zatrzymany"
    });
  } catch (error: any) {
    console.error("Błąd zatrzymywania crona:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

