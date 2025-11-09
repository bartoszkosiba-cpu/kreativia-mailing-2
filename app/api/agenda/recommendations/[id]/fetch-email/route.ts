import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchRecommendationEmail } from "@/services/agendaRecommendationService";
import { logger } from "@/services/logger";

const requestSchema = z.object({
  requestedBy: z.string().optional(),
});

function parseId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const recommendationId = parseId(params.id);

  if (recommendationId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID rekomendacji" }, { status: 400 });
  }

  try {
    const json = await req.json().catch(() => ({}));
    const payload = requestSchema.parse(json);

    const updated = await fetchRecommendationEmail({
      id: recommendationId,
      requestedBy: payload.requestedBy,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe dane wejściowe", details: error.flatten() },
        { status: 400 }
      );
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("agenda-recommendation", "Błąd pobierania emaila", { recommendationId }, err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
