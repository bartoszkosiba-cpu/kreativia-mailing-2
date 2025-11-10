import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { logger } from "./logger";

type CompanyRecord = NonNullable<Awaited<ReturnType<typeof db.company.findUnique>>>;

type TranslationResult = {
  translation: string;
  language: string;
};

async function callOpenAIJSON(
  prompt: string,
  systemPrompt: string
): Promise<{ language?: string; translation?: string } | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 600,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as { language?: string; translation?: string };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("company-translation", "Błąd parsowania JSON z OpenAI", null, err);
    return null;
  }
}

async function translateTextToPolish(text: string): Promise<TranslationResult | null> {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.warn(
      "company-translation",
      "Brak klucza OPENAI_API_KEY – pomijam tłumaczenie tekstu"
    );
    return null;
  }

  try {
    const detection = await callOpenAIJSON(
      trimmed,
      "Wykryj język tekstu (kod ISO 639-1, np. pl, en) i zwróć JSON {\"language\":\"...\",\"translation\":\"...\"}. Jeśli tekst jest już po polsku, language=\"pl\" i translation = oryginał. Jeśli nie, przetłumacz na polski."
    );

    if (!detection?.translation) {
      return null;
    }

    let translation = detection.translation;
    const detectedLang = (detection.language ?? "unknown").toLowerCase();

    if (detectedLang !== "pl" && translation.trim() === trimmed) {
      const forced = await callOpenAIJSON(
        trimmed,
        "Przetłumacz tekst na język polski i zwróć JSON {\"translation\":\"...\"}. Nie dodawaj komentarzy."
      );
      if (forced?.translation) {
        translation = forced.translation;
      }
    }

    return {
      translation,
      language: detectedLang,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("company-translation", "Błąd tłumaczenia tekstu", null, err);
    return null;
  }
}

export async function ensurePolishDescriptions(
  company: CompanyRecord
): Promise<CompanyRecord> {
  const tasks: Array<{ field: "activity" | "description"; text: string }> = [];

  if ((company.activityDescription ?? "").trim() && !company.activityDescriptionPl) {
    tasks.push({ field: "activity", text: company.activityDescription! });
  }

  if ((company.description ?? "").trim() && !company.descriptionPl) {
    tasks.push({ field: "description", text: company.description! });
  }

  if (tasks.length === 0) {
    return company;
  }

  const data: Prisma.CompanyUpdateInput = {};
  const detectedLanguages: string[] = [];

  for (const task of tasks) {
    const result = await translateTextToPolish(task.text);
    if (!result) {
      continue;
    }

    if (task.field === "activity") {
      data.activityDescriptionPl = result.translation;
    } else {
      data.descriptionPl = result.translation;
    }

    if (result.language) {
      detectedLanguages.push(result.language);
    }
  }

  if (!data.activityDescriptionPl && !data.descriptionPl) {
    return company;
  }

  if (detectedLanguages.length > 0) {
    const preferred =
      detectedLanguages.find((lang) => lang && lang !== "unknown") ?? detectedLanguages[0];
    if (preferred) {
      data.detectedLanguage = preferred;
    }
  }

  data.translationUpdatedAt = new Date();

  const updated = await db.company.update({
    where: { id: company.id },
    data,
  });

  return updated as CompanyRecord;
}

