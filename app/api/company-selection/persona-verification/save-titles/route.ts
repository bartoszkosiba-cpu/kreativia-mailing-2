import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getPersonaCriteria,
  upsertPersonaCriteria,
  PersonaRoleConfig,
} from "@/services/personaCriteriaService";

function normalize(title: string) {
  return title.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const titles: string[] = Array.isArray(body?.titles) ? body.titles : [];

    const cleanedTitles = titles
      .map((title) => (typeof title === "string" ? title.trim() : ""))
      .filter((title) => title.length > 0);

    if (!cleanedTitles.length) {
      return NextResponse.json(
        { success: false, error: "Brak tytułów do zapisania" },
        { status: 400 }
      );
    }

    const criteriaRecord = await db.companyVerificationCriteria.findFirst({
      where: { isActive: true, isDefault: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!criteriaRecord) {
      return NextResponse.json(
        { success: false, error: "Brak aktywnej konfiguracji person" },
        { status: 400 }
      );
    }

    const personaCriteria = await getPersonaCriteria(criteriaRecord.id);
    if (!personaCriteria) {
      return NextResponse.json(
        { success: false, error: "Brak zdefiniowanych person dla bieżących kryteriów" },
        { status: 400 }
      );
    }

    const existingLabels = new Set(
      personaCriteria.positiveRoles.map((role) => normalize(role.label))
    );

    const newRoles: PersonaRoleConfig[] = [];
    for (const title of cleanedTitles) {
      const key = normalize(title);
      if (existingLabels.has(key)) {
        continue;
      }

      newRoles.push({
        label: title,
        matchType: "contains",
        keywords: [title],
        departments: [],
        confidence: 0.8,
      });
      existingLabels.add(key);
    }

    if (!newRoles.length) {
      return NextResponse.json({
        success: true,
        added: [],
        message: "Wszystkie wybrane stanowiska są już zapisane w konfiguracji.",
      });
    }

    await upsertPersonaCriteria(personaCriteria.companyCriteriaId, {
      name: personaCriteria.name,
      description: personaCriteria.description,
      positiveRoles: [...personaCriteria.positiveRoles, ...newRoles],
      negativeRoles: personaCriteria.negativeRoles,
      conditionalRules: personaCriteria.conditionalRules,
      language: personaCriteria.language,
      chatHistory: personaCriteria.chatHistory,
      lastUserMessage: personaCriteria.lastUserMessage,
      lastAIResponse: personaCriteria.lastAIResponse,
      updatedBy: "persona-verification",
    });

    return NextResponse.json({
      success: true,
      added: newRoles.map((role) => role.label),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json(
      { success: false, error: err.message || "Błąd zapisu stanowisk" },
      { status: 500 }
    );
  }
}

