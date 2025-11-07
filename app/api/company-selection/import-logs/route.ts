import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

/**
 * Pobierz logi importu
 * GET /api/company-selection/import-logs
 */
export async function GET(req: NextRequest) {
  try {
    const logFile = path.join(process.cwd(), 'company-import.log');
    
    if (!fs.existsSync(logFile)) {
      return NextResponse.json({
        success: true,
        logs: "Brak pliku logów - jeszcze nie było importu",
        exists: false,
      });
    }

    const logs = fs.readFileSync(logFile, 'utf-8');
    const lines = logs.split('\n').filter(line => line.trim());
    const lastLines = lines.slice(-100); // Ostatnie 100 linii

    return NextResponse.json({
      success: true,
      logs: lastLines.join('\n'),
      totalLines: lines.length,
      lastLines: lastLines.length,
      exists: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

