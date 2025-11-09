import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/services/logger";
import { getPersonaCriteria } from "@/services/personaCriteriaService";
import { getPersonaBrief, upsertPersonaBrief } from "@/services/personaBriefService";

function parseCriteriaId(raw: string | string[] | undefined): number | null {
  if (!raw || Array.isArray(raw)) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

const payloadSchema = z.object({
  summary: z.string().optional(),
  decisionGuidelines: z.array(z.string()).optional(),
  targetProfiles: z.array(z.string()).optional(),
  avoidProfiles: z.array(z.string()).optional(),
  additionalNotes: z.string().nullable().optional(),
});

function cleanStringArray(value?: string[]): string[] {
  if (!value) return [];
  return value.map((item) => item.trim()).filter((item) => item.length > 0);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const criteriaId = parseCriteriaId(params.id);

  if (criteriaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID konfiguracji" }, { status: 400 });
  }

  try {
    const personaCriteria = await getPersonaCriteria(criteriaId);

    if (!personaCriteria) {
      return NextResponse.json({ success: false, error: "Brak konfiguracji person dla tych kryteriów" }, { status: 404 });
    }

    const brief = await getPersonaBrief(personaCriteria.id);

    return NextResponse.json({
      success: true,
      data: brief,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-brief", "Błąd pobierania briefu person", { criteriaId }, err);
    return NextResponse.json({ success: false, error: "Błąd pobierania briefu" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const criteriaId = parseCriteriaId(params.id);

  if (criteriaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID konfiguracji" }, { status: 400 });
  }

  try {
    const personaCriteria = await getPersonaCriteria(criteriaId);

    if (!personaCriteria) {
      return NextResponse.json({ success: false, error: "Brak konfiguracji person dla tych kryteriów" }, { status: 404 });
    }

    const json = await req.json();
    const parsed = payloadSchema.parse(json);

    await upsertPersonaBrief(personaCriteria.id, {
      summary: (parsed.summary ?? "").trim(),
      decisionGuidelines: cleanStringArray(parsed.decisionGuidelines),
      targetProfiles: cleanStringArray(parsed.targetProfiles),
      avoidProfiles: cleanStringArray(parsed.avoidProfiles),
      additionalNotes: parsed.additionalNotes?.trim() ?? null,
    });

    const updatedBrief = await getPersonaBrief(personaCriteria.id);

    logger.info("persona-brief", "Zapisano brief person", { criteriaId });

    return NextResponse.json({
      success: true,
      data: updatedBrief,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe dane wejściowe", details: error.flatten() },
        { status: 400 }
      );
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-brief", "Błąd zapisu briefu person", { criteriaId }, err);
    return NextResponse.json({ success: false, error: "Błąd zapisu briefu" }, { status: 500 });
  }
}

