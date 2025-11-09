import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generateAgendaRecommendations,
  listAgendaRecommendations,
} from "@/services/agendaRecommendationService";
import { logger } from "@/services/logger";

const getQuerySchema = z.object({
  campaignId: z.string().min(1),
  status: z.string().optional(),
});

const generateSchema = z.object({
  campaignId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  personaCriteriaId: z.number().int().positive(),
  limit: z.number().int().positive().max(100).optional(),
  requestedBy: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = getQuerySchema.parse(searchParams);

    const campaignId = Number.parseInt(parsed.campaignId, 10);
    if (Number.isNaN(campaignId)) {
      return NextResponse.json({ success: false, error: "Nieprawidłowe ID kampanii" }, { status: 400 });
    }

    const recommendations = await listAgendaRecommendations({
      campaignId,
      status: parsed.status,
    });

    return NextResponse.json({ success: true, data: recommendations });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe parametry zapytania", details: error.flatten() },
        { status: 400 }
      );
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("agenda-recommendation", "Błąd pobierania rekomendacji", null, err);
    return NextResponse.json({ success: false, error: "Błąd pobierania rekomendacji" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = generateSchema.parse(body);

    const result = await generateAgendaRecommendations(payload);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe dane wejściowe", details: error.flatten() },
        { status: 400 }
      );
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("agenda-recommendation", "Błąd generowania rekomendacji", null, err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Błąd generowania rekomendacji" },
      { status: 500 }
    );
  }
}
