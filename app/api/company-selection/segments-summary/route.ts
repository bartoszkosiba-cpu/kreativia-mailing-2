import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [segmentsRaw, segmentsNeedsReviewRaw, industriesRaw] = await Promise.all([
      db.company.groupBy({
        by: ["classificationClass", "classificationSubClass"],
        where: {
          classificationClass: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
        orderBy: [
          {
            classificationClass: "asc",
          },
          {
            classificationSubClass: "asc",
          },
        ],
      }),
      db.company.groupBy({
        by: ["classificationClass", "classificationSubClass"],
        where: {
          classificationClass: {
            not: null,
          },
          classificationNeedsReview: true,
        },
        _count: {
          _all: true,
        },
      }),
      db.company.groupBy({
        by: ["industry"],
        where: {
          industry: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const needsReviewMap = new Map<string, number>();
    for (const entry of segmentsNeedsReviewRaw) {
      const key = `${entry.classificationClass ?? ""}::${
        entry.classificationSubClass ?? ""
      }`;
      needsReviewMap.set(key, entry._count._all);
    }

    const segments = segmentsRaw.map((entry) => {
      const key = `${entry.classificationClass ?? ""}::${
        entry.classificationSubClass ?? ""
      }`;
      return {
        class: entry.classificationClass,
        subClass: entry.classificationSubClass,
        count: entry._count._all,
        needsReviewCount: needsReviewMap.get(key) ?? 0,
      };
    });

    const industries = industriesRaw
      .filter((entry) => entry.industry && entry.industry.trim() !== "")
      .map((entry) => ({
        industry: entry.industry!,
        count: entry._count._all,
      }))
      .sort((a, b) => b.count - a.count || a.industry.localeCompare(b.industry));

    return NextResponse.json({
      success: true,
      segments,
      industries,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[SegmentsSummary] Błąd:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Nie udało się pobrać podsumowania segmentów",
        details: err.message,
      },
      { status: 500 }
    );
  }
}


