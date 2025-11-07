import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Debug endpoint - pokazuje co przychodzi z frontendu
 * POST /api/company-selection/debug-import
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Zapisz do pliku logów co przychodzi
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(process.cwd(), 'import-debug.log');
    
    const logData = {
      timestamp: new Date().toISOString(),
      bodyKeys: Object.keys(body),
      companiesCount: Array.isArray(body.companies) ? body.companies.length : 'NOT ARRAY',
      firstCompany: body.companies && body.companies[0] ? body.companies[0] : null,
      firstCompanyKeys: body.companies && body.companies[0] ? Object.keys(body.companies[0]) : null,
    };
    
    fs.appendFileSync(logFile, JSON.stringify(logData, null, 2) + '\n\n');
    
    return NextResponse.json({
      success: true,
      debug: logData,
      message: "Dane zapisane do import-debug.log",
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

