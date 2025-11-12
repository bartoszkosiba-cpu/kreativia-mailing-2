import { getOpenAIClient } from "@/services/openaiClient";
import { logger } from "@/services/logger";
import {
  CompanySpecializationDefinition,
  COMPANY_SPECIALIZATIONS,
} from "@/config/companySpecializations";
import { IndustryRuleEntry } from "@/services/industryClassification";
import { createIndustrySuggestion } from "@/services/industryRulesService";

interface GenerateIndustrySuggestionInput {
  industry: string;
  examples?: Array<{
    name?: string | null;
    keywords?: string | null;
    description?: string | null;
  }>;
}

interface IndustrySuggestionResult {
  matches: Array<{
    specializationCode: CompanySpecializationDefinition["code"];
    score: number;
    explanation?: string;
  }>;
}

const SYSTEM_PROMPT = `Jesteś ekspertem ds. segmentacji klientów dla branży wystawienniczej.
Masz listę specjalizacji. Każde industry (branża) musi zostać powiązane z 1-3 specjalizacjami.
Oceniaj jak mocno dana branża pasuje do każdej specjalizacji w skali 1-5 (5 = bardzo mocne dopasowanie, 1 = marginalne).
Zwróć wyłącznie JSON w formacie:
{
  "matches": [
    {"specializationCode": "WK_TRADESHOW_BUILDER", "score": 5, "explanation": "..."},
    ...
  ]
}
Wynik ogranicz do maksymalnie 3 pozycji. Score musi być liczbą od 1 do 5. W explanation po polsku krótko uzasadnij.`;

function buildSpecializationCatalog(): string {
  return COMPANY_SPECIALIZATIONS.map(
    (spec) =>
      `- ${spec.code} (klasa: ${spec.companyClass}): ${spec.label} — ${spec.description}`
  ).join("\n");
}

export async function generateIndustrySuggestion(
  input: GenerateIndustrySuggestionInput
): Promise<IndustryRuleEntry | null> {
  const client = getOpenAIClient();
  const catalog = buildSpecializationCatalog();

  const examples = (input.examples ?? [])
    .map((example, index) => {
      const parts: string[] = [];
      if (example.name) parts.push(`Firma ${index + 1}: ${example.name}`);
      if (example.keywords) parts.push(`Słowa kluczowe: ${example.keywords}`);
      if (example.description) parts.push(`Opis: ${example.description}`);
      return parts.join(" | ");
    })
    .filter(Boolean)
    .join("\n");

  const userPrompt = `Branża: ${input.industry}\n\nSpecjalizacje:\n${catalog}\n\nPrzykładowe firmy:\n${examples || "brak"}\n\nZwróć JSON zgodnie z instrukcją.`;

  try {
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const output = response.output_text ?? "";
    const parsed = JSON.parse(output) as IndustrySuggestionResult;
    const matches = (parsed.matches ?? [])
      .filter((item) => item.specializationCode && item.score)
      .map((item) => ({
        specializationCode: item.specializationCode,
        score: Number(item.score),
        explanation: item.explanation,
        source: "AI" as const,
      }));

    if (!matches.length) {
      logger.warn("industry-ai-agent", "Model nie zwrócił żadnych dopasowań", {
        industry: input.industry,
        raw: output,
      });
      return null;
    }

    const entry: IndustryRuleEntry = {
      industry: input.industry,
      matches,
    };

    await createIndustrySuggestion(entry);

    return entry;
  } catch (error) {
    logger.error("industry-ai-agent", "Błąd generowania sugestii industry", {
      industry: input.industry,
      error,
    });
    return null;
  }
}
