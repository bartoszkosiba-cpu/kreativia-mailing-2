import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/services/logger";
import { PersonaCriteriaPayload, getPersonaCriteria, upsertPersonaCriteria } from "@/services/personaCriteriaService";

const matchTypes = ["contains", "exact", "regex", "embedding"] as const;
const ruleTypes = ["include", "exclude"] as const;

const roleSchema = z.object({
  label: z.string().min(1),
  matchType: z.enum(matchTypes).optional(),
  keywords: z.array(z.string().min(1)).optional(),
  departments: z.array(z.string().min(1)).optional(),
  minSeniority: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const conditionalRuleSchema = z.object({
  rule: z.enum(ruleTypes),
  whenAll: z.array(z.string().min(1)).optional(),
  whenAny: z.array(z.string().min(1)).optional(),
  unless: z.array(z.string().min(1)).optional(),
  notes: z.string().optional(),
});

const payloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  positiveRoles: z.array(roleSchema).default([]),
  negativeRoles: z.array(roleSchema).default([]),
  conditionalRules: z.array(conditionalRuleSchema).optional(),
  language: z.string().min(2).max(10).optional(),
  chatHistory: z.array(z.any()).optional(),
  lastUserMessage: z.string().optional(),
  lastAIResponse: z.string().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

function parseCriteriaId(rawId: string | string[] | undefined): number | null {
  if (!rawId || Array.isArray(rawId)) {
    return null;
  }

  const parsed = Number.parseInt(rawId, 10);
  return Number.isNaN(parsed) ? null : parsed;
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
    const criteria = await getPersonaCriteria(criteriaId);

    return NextResponse.json({
      success: true,
      data: criteria,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria", "Błąd pobierania konfiguracji person", { criteriaId }, err);
    return NextResponse.json({ success: false, error: "Błąd pobierania konfiguracji" }, { status: 500 });
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
    const json = await req.json();
    const parsed = payloadSchema.parse(json);
    const payload: PersonaCriteriaPayload = {
      ...parsed,
      positiveRoles: parsed.positiveRoles ?? [],
      negativeRoles: parsed.negativeRoles ?? [],
      conditionalRules: parsed.conditionalRules ?? [],
    };

    const result = await upsertPersonaCriteria(criteriaId, payload);

    logger.info("persona-criteria", "Zapisano konfigurację person", { criteriaId });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Nieprawidłowe dane wejściowe", details: error.flatten() },
        { status: 400 }
      );
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-criteria", "Błąd zapisu konfiguracji person", { criteriaId }, err);
    return NextResponse.json({ success: false, error: "Błąd zapisu konfiguracji" }, { status: 500 });
  }
}

