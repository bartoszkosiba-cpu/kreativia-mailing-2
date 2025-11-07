import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/services/logger";

/**
 * Pobierz logi modułu wyboru leadów
 * GET /api/company-selection/logs?module=import&limit=500
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const module = searchParams.get("module") || "company-selection";
    const limit = parseInt(searchParams.get("limit") || "1000");

    const logs = logger.getLogs(module, limit);
    const modules = logger.getModules();

    return NextResponse.json({
      success: true,
      logs,
      module,
      modules,
      limit,
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

/**
 * Wyczyść logi modułu
 * DELETE /api/company-selection/logs?module=import
 */
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const module = searchParams.get("module") || "company-selection";

    logger.clearLogs(module);

    return NextResponse.json({
      success: true,
      message: `Logi modułu ${module} zostały wyczyszczone`,
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

