import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search");
    const language = searchParams.get("language");
    const limitParam = parseInt(searchParams.get("limit") || "100", 10);
    const limit = Number.isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 1), 500);

    const where: any = {};

    if (language) {
      where.language = language;
    }

    if (search && search.trim()) {
      where.name = { contains: search.trim() };
    }

    const batches = await db.companyImportBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error("[Company Import Batches] Błąd:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Błąd pobierania partii importu",
      },
      { status: 500 }
    );
  }
}

