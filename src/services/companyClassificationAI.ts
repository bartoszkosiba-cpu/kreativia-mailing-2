/**
 * Company Classification AI Service
 * Klasyfikuje firmy do specjalizacji używając AI
 * Zwraca główną specjalizację + 1-2 dodatkowe ze scoringiem 1-5
 */

import { db } from "@/lib/db";
import { logger } from "./logger";
import { trackTokenUsage } from "./tokenTracker";
import { COMPANY_SPECIALIZATIONS } from "@/config/companySpecializations";
import type { CompanySpecializationCode } from "@/config/companySpecializations";

export interface AIClassificationResult {
  primarySpecialization: string; // Może być kod istniejący lub nowy (AI_XXXXX)
  primaryScore: number; // 1-5
  primaryConfidence: number; // 0.0-1.0
  primaryLabel?: string; // Nazwa specjalizacji (jeśli nowa)
  primaryDescription?: string; // Opis specjalizacji (jeśli nowa)
  primaryCompanyClass?: "PS" | "WK" | "WKK"; // Klasa firmy (jeśli nowa)
  alternativeSpecializations: Array<{
    code: string; // Może być kod istniejący lub nowy
    score: number; // 1-5
    confidence: number; // 0.0-1.0
    label?: string; // Nazwa specjalizacji (jeśli nowa)
    description?: string; // Opis specjalizacji (jeśli nowa)
    companyClass?: "PS" | "WK" | "WKK"; // Klasa firmy (jeśli nowa)
  }>;
  reason: string; // Uzasadnienie klasyfikacji
  needsReview: boolean; // true jeśli confidence < threshold
}

export interface CreatedSpecialization {
  code: string;
  label: string;
  description: string;
  companyClass: "PS" | "WK" | "WKK";
  wasNew: boolean; // true jeśli specjalizacja została utworzona
}

export interface CompanyDataForClassification {
  id: number; // ID firmy - potrzebne do zapisania informacji o utworzeniu specjalizacji
  name: string;
  keywords?: string | null;
  activityDescription?: string | null; // Short Description
}

/**
 * Klasyfikuje firmę używając AI
 */
/**
 * Sprawdza czy specjalizacja istnieje w bazie danych, jeśli nie - tworzy nową
 */
/**
 * Sprawdza czy istnieje podobna specjalizacja w bazie (na podstawie podobieństwa label/description)
 */
async function findSimilarSpecialization(
  label: string | undefined,
  description: string | undefined,
  companyClass: "PS" | "WK" | "WKK" | undefined
): Promise<{ code: string; label: string; description: string; companyClass: string } | null> {
  if (!label || !description || !companyClass) {
    return null;
  }

  // Pobierz wszystkie specjalizacje z bazy
  const allSpecializations = await db.companySpecialization.findMany({
    where: {
      companyClass,
    },
  });

  // Szukaj podobnych na podstawie kluczowych słów
  const labelWords = label.toLowerCase().split(/\s+/);
  const descriptionWords = description.toLowerCase().split(/\s+/).filter((w) => w.length > 4); // Tylko słowa dłuższe niż 4 znaki

  for (const spec of allSpecializations) {
    const specLabelLower = spec.label.toLowerCase();
    const specDescLower = spec.description.toLowerCase();

    // Sprawdź czy label zawiera podobne słowa kluczowe
    const labelMatch = labelWords.filter((word) => word.length > 4 && specLabelLower.includes(word)).length;
    const descMatch = descriptionWords.filter((word) => specDescLower.includes(word)).length;

    // Jeśli znaleziono co najmniej 2 podobne słowa kluczowe, uznaj za podobną
    if (labelMatch + descMatch >= 2) {
      logger.debug("company-classification-ai", "Znaleziono podobną specjalizację", {
        searching: label,
        found: spec.code,
        labelMatch,
        descMatch,
      });
      return {
        code: spec.code,
        label: spec.label,
        description: spec.description,
        companyClass: spec.companyClass,
      };
    }
  }

  return null;
}

async function ensureSpecializationExists(
  code: string,
  label: string | undefined,
  description: string | undefined,
  companyClass: "PS" | "WK" | "WKK" | undefined,
  companyId: number,
  companyName: string,
  reason: string,
  confidence: number
): Promise<CreatedSpecialization> {
  // Sprawdź czy specjalizacja już istnieje w bazie (po kodzie)
  const existing = await db.companySpecialization.findUnique({
    where: { code },
  });

  if (existing) {
    return {
      code: existing.code,
      label: existing.label,
      description: existing.description,
      companyClass: existing.companyClass as "PS" | "WK" | "WKK",
      wasNew: false,
    };
  }

  // Jeśli kod nie istnieje i brakuje danych - użyj istniejącej z configu
  const fromConfig = COMPANY_SPECIALIZATIONS.find((s) => s.code === code);
  if (fromConfig) {
    // Specjalizacja jest w configu, ale nie w bazie - dodaj ją
    await db.companySpecialization.create({
      data: {
        code: fromConfig.code,
        label: fromConfig.label,
        description: fromConfig.description,
        companyClass: fromConfig.companyClass,
        createdBy: "MANUAL",
      },
    });
    return {
      code: fromConfig.code,
      label: fromConfig.label,
      description: fromConfig.description,
      companyClass: fromConfig.companyClass,
      wasNew: false,
    };
  }

  // Nowa specjalizacja AI - sprawdź czy istnieje podobna specjalizacja
  const similarSpec = await findSimilarSpecialization(label, description, companyClass);
  if (similarSpec) {
    logger.info("company-classification-ai", "Znaleziono podobną specjalizację, używam istniejącej zamiast tworzyć nową", {
      proposedCode: code,
      proposedLabel: label,
      existingCode: similarSpec.code,
      existingLabel: similarSpec.label,
      companyId,
      companyName,
    });
    return {
      code: similarSpec.code,
      label: similarSpec.label,
      description: similarSpec.description,
      companyClass: similarSpec.companyClass as "PS" | "WK" | "WKK",
      wasNew: false,
    };
  }

  // Jeśli nie ma specjalizacji w configu i nie znaleziono podobnej - użyj WK_OTHER zamiast tworzyć nową
  logger.info("company-classification-ai", "AI próbowała utworzyć nową specjalizację, użyto WK_OTHER zamiast tego", {
    proposedCode: code,
    proposedLabel: label,
    companyId,
    companyName,
  });

  // Zamiast tworzyć nową specjalizację, użyj WK_OTHER
  const otherSpec = await db.companySpecialization.findUnique({
    where: { code: "WK_OTHER" },
  });

  if (otherSpec) {
    return {
      code: otherSpec.code,
      label: otherSpec.label,
      description: otherSpec.description,
      companyClass: otherSpec.companyClass as "PS" | "WK" | "WKK",
      wasNew: false,
    };
  }

  // Jeśli WK_OTHER nie istnieje w bazie, dodaj go (powinien być w configu)
  const otherFromConfig = COMPANY_SPECIALIZATIONS.find((s) => s.code === "WK_OTHER");
  if (!otherFromConfig) {
    throw new Error("WK_OTHER specjalizacja nie została znaleziona w konfiguracji!");
  }

  await db.companySpecialization.create({
    data: {
      code: otherFromConfig.code,
      label: otherFromConfig.label,
      description: otherFromConfig.description,
      companyClass: otherFromConfig.companyClass,
      createdBy: "MANUAL",
    },
  });

  return {
    code: otherFromConfig.code,
    label: otherFromConfig.label,
    description: otherFromConfig.description,
    companyClass: otherFromConfig.companyClass,
    wasNew: false,
  };
}

export async function classifyCompanyWithAI(
  companyData: CompanyDataForClassification
): Promise<AIClassificationResult> {
  // Przygotuj dane do analizy
  const contentToAnalyze = [
    companyData.keywords,
    companyData.activityDescription,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!contentToAnalyze.trim()) {
    logger.warn("company-classification-ai", "Brak danych do analizy", { companyName: companyData.name });
    throw new Error("Brak danych do klasyfikacji - wymagane są Keywords lub Short Description");
  }

  // Pobierz specjalizacje z bazy danych (istniejące + utworzone przez AI)
  const dbSpecializations = await db.companySpecialization.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Połącz z config (na wypadek gdyby coś brakowało)
  const allSpecializationsMap = new Map<string, { code: string; label: string; description: string; class: string }>();
  
  // Najpierw dodaj z bazy
  for (const spec of dbSpecializations) {
    allSpecializationsMap.set(spec.code, {
      code: spec.code,
      label: spec.label,
      description: spec.description,
      class: spec.companyClass,
    });
  }

  // Dodaj z configu te, których nie ma w bazie
  for (const spec of COMPANY_SPECIALIZATIONS) {
    if (!allSpecializationsMap.has(spec.code)) {
      allSpecializationsMap.set(spec.code, {
        code: spec.code,
        label: spec.label,
        description: spec.description,
        class: spec.companyClass,
      });
    }
  }

  const specializationsList = Array.from(allSpecializationsMap.values());

  // Prompt dla AI
  const systemPrompt = `Jesteś ekspertem w klasyfikacji firm. Twoim zadaniem jest przypisanie firm do odpowiednich specjalizacji na podstawie Keywords i Short Description.

DOSTĘPNE SPECJALIZACJE:
${specializationsList.map((s) => `- ${s.code}: ${s.label} (${s.description})`).join("\n")}

WAŻNE - ZASADY KLASYFIKACJI:
1. PRIORYTET: Używaj istniejących specjalizacji, nawet jeśli nie są idealne!
   - Jeśli jakaś specjalizacja ma score >= 2.5 (dobre lub bardzo dobre dopasowanie) - użyj jej
   - Nie używaj specjalizacji "WK_OTHER" jeśli istniejąca pasuje na poziomie 2.5-5

2. KATEGORIA "INNE" (WK_OTHER) - tylko w ostateczności:
   - Tylko jeśli WSZYSTKIE istniejące specjalizacje mają score < 2.5 (słabe dopasowanie)
   - Użyj kodu: WK_OTHER (specjalizacja "Inne")
   - NIE TWÓRZ nowych specjalizacji! Zawsze używaj istniejących, a jeśli żadna nie pasuje - użyj WK_OTHER

Klasyfikuj firmę zgodnie z następującymi zasadami:
1. Najpierw sprawdź czy firma pasuje do istniejącej specjalizacji (score >= 2.5)
2. Jeśli większość specjalizacji ma score 2.5-4 - użyj najlepszej z nich (score >= 2.5)
3. Jeśli WSZYSTKIE istniejące specjalizacje mają score < 2.5 - użyj WK_OTHER (Inne)
4. Główna specjalizacja (primary) - najlepiej pasująca (score >= 2.5) lub WK_OTHER jeśli wszystko < 2.5
5. Alternatywne specjalizacje (1-2) - jeśli firma może działać w kilku obszarach (score >= 3)

6. Scoring 1-5:
   - 5: Idealne dopasowanie, to jest główna działalność firmy
   - 4: Bardzo dobre dopasowanie, firma na pewno działa w tym obszarze
   - 3: Dobre dopasowanie, firma prawdopodobnie działa w tym obszarze
   - 2: Słabe dopasowanie, firma może działać w tym obszarze
   - 1: Bardzo słabe dopasowanie, tylko częściowa zbieżność

7. Confidence (0.0-1.0): Jak pewny jesteś swojej klasyfikacji
   - 0.9-1.0: Bardzo pewny
   - 0.7-0.89: Pewny
   - 0.5-0.69: Średnio pewny
   - <0.5: Niepewny

8. Zwróć główną specjalizację + maksymalnie 2 alternatywne (tylko jeśli score >= 3)

Odpowiedz TYLKO w formacie JSON bez dodatkowego tekstu.`;

  const userPrompt = `Firma: ${companyData.name}

Keywords: ${companyData.keywords || "brak"}

Short Description: ${companyData.activityDescription || "brak"}

Przeanalizuj i zwróć klasyfikację w formacie:
{
  "primarySpecialization": "WK_TRADESHOW_BUILDER" lub "WK_OTHER" (jeśli żadna specjalizacja nie pasuje),
  "primaryScore": 5,
  "primaryConfidence": 0.95,
  "alternativeSpecializations": [
    {
      "code": "WK_EVENT_COMPANY",
      "score": 4,
      "confidence": 0.8
    }
  ],
  "reason": "Uzasadnienie klasyfikacji - dlaczego ta specjalizacja lub dlaczego WK_OTHER",
  "needsReview": false
}

WAŻNE: Używaj TYLKO kodów z listy dostępnych specjalizacji. Jeśli żadna nie pasuje - użyj WK_OTHER. NIE TWÓRZ nowych specjalizacji!`;

  // Wywołaj AI
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const MODEL = "gpt-4o"; // Używamy GPT-4o dla lepszej jakości klasyfikacji

  logger.debug("company-classification-ai", "Wywołuję AI dla klasyfikacji", {
    companyName: companyData.name,
    model: MODEL,
  });

  // Funkcja retry z obsługą rate limit
  const callAIWithRetry = async (maxRetries = 3): Promise<any> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3, // Niższa temperatura dla bardziej spójnej klasyfikacji
          response_format: { type: "json_object" },
        });
        return response;
      } catch (error: any) {
        // Sprawdź czy to błąd rate limit (429)
        if (error?.status === 429 || error?.message?.includes("Rate limit") || error?.message?.includes("429")) {
          // Wyciągnij informację o czasie oczekiwania z komunikatu błędu
          const retryAfterMatch = error?.message?.match(/try again in (\d+)ms/i) || error?.headers?.["retry-after"];
          const retryAfterMs = retryAfterMatch 
            ? (typeof retryAfterMatch === "string" ? parseInt(retryAfterMatch, 10) : retryAfterMatch)
            : (attempt + 1) * 2000; // Exponential backoff: 2s, 4s, 6s

          if (attempt < maxRetries - 1) {
            logger.warn("company-classification-ai", `Rate limit osiągnięty, czekam ${retryAfterMs}ms przed retry (próba ${attempt + 1}/${maxRetries})`, {
              companyName: companyData.name,
              retryAfterMs,
            });
            await new Promise((resolve) => setTimeout(resolve, retryAfterMs + 1000)); // Dodajemy 1s buffer
            continue; // Retry
          } else {
            throw new Error(`Rate limit: Przekroczono limit po ${maxRetries} próbach. ${error.message}`);
          }
        }
        // Jeśli to inny błąd - rzuć go dalej
        throw error;
      }
    }
    throw new Error("Przekroczono maksymalną liczbę prób");
  };

  try {
    const response = await callAIWithRetry();

    // Track token usage and costs
    if (response.usage) {
      const { trackTokenUsage } = await import("@/services/tokenTracker");
      await trackTokenUsage({
        operation: "company_classification",
        model: MODEL,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        metadata: {
          companyId: companyData.id,
          companyName: companyData.name,
        },
      });
    }

    const rawResponse = response.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error("Brak odpowiedzi z OpenAI");
    }

    // Parse JSON response
    let parsed: AIClassificationResult;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      logger.error("company-classification-ai", "Błąd parsowania JSON", { rawResponse }, parseError as Error);
      throw new Error("Błąd parsowania odpowiedzi AI");
    }

    // Validate response
    if (!parsed.primarySpecialization) {
      throw new Error("Brak primarySpecialization w odpowiedzi AI");
    }

    // Validate scoring
    if (parsed.primaryScore < 1 || parsed.primaryScore > 5) {
      throw new Error(`Nieprawidłowy primaryScore: ${parsed.primaryScore} (powinien być 1-5)`);
    }

    // Validate confidence
    if (parsed.primaryConfidence < 0 || parsed.primaryConfidence > 1) {
      throw new Error(`Nieprawidłowy primaryConfidence: ${parsed.primaryConfidence} (powinien być 0.0-1.0)`);
    }

    // Validate alternative specializations
    if (parsed.alternativeSpecializations) {
      for (const alt of parsed.alternativeSpecializations) {
        if (alt.score < 1 || alt.score > 5) {
          throw new Error(`Nieprawidłowy score w alternativeSpecializations: ${alt.score}`);
        }
        if (alt.confidence < 0 || alt.confidence > 1) {
          throw new Error(`Nieprawidłowy confidence w alternativeSpecializations: ${alt.confidence}`);
        }
      }
    }

    // Track token usage
    if (response.usage) {
      await trackTokenUsage({
        operation: "company_classification",
        model: MODEL,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        metadata: {
          companyName: companyData.name,
          companyId: companyData.id,
        },
      });
    }

    // Determine needsReview
    const CONFIDENCE_THRESHOLD = 0.7;
    parsed.needsReview = parsed.primaryConfidence < CONFIDENCE_THRESHOLD;

    logger.info("company-classification-ai", "Klasyfikacja AI zakończona", {
      companyName: companyData.name,
      primarySpecialization: parsed.primarySpecialization,
      primaryScore: parsed.primaryScore,
      primaryConfidence: parsed.primaryConfidence,
      alternativeCount: parsed.alternativeSpecializations?.length || 0,
      needsReview: parsed.needsReview,
    });

    return parsed;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-classification-ai", "Błąd klasyfikacji AI", { companyName: companyData.name }, errorObj);
    throw errorObj;
  }
}

/**
 * Zapisuje klasyfikację AI do bazy danych
 * Zwraca listę utworzonych specjalizacji (nowych dodanych przez AI)
 */
export async function saveClassificationToDatabase(
  companyId: number,
  companyName: string,
  classification: AIClassificationResult
): Promise<CreatedSpecialization[]> {
  const createdSpecializations: CreatedSpecialization[] = [];

  // Sprawdź i utwórz główną specjalizację jeśli potrzeba
  const primarySpec = await ensureSpecializationExists(
    classification.primarySpecialization,
    classification.primaryLabel,
    classification.primaryDescription,
    classification.primaryCompanyClass,
    companyId,
    companyName,
    classification.reason,
    classification.primaryConfidence
  );
  if (primarySpec.wasNew) {
    createdSpecializations.push(primarySpec);
  }

  // Sprawdź i utwórz alternatywne specjalizacje jeśli potrzeba
  if (classification.alternativeSpecializations) {
    for (const alt of classification.alternativeSpecializations.filter((a) => a.score >= 3)) {
      const altSpec = await ensureSpecializationExists(
        alt.code,
        alt.label,
        alt.description,
        alt.companyClass,
        companyId,
        companyName,
        classification.reason,
        alt.confidence
      );
      if (altSpec.wasNew) {
        createdSpecializations.push(altSpec);
      }
    }
  }

  // Usuń stare klasyfikacje AI (zachowaj MANUAL i RULES)
  await db.companyClassification.deleteMany({
    where: {
      companyId,
      source: "AI",
    },
  });

  // Zapisz główną specjalizację
  await db.companyClassification.create({
    data: {
      companyId,
      specializationCode: primarySpec.code,
      score: classification.primaryScore,
      confidence: classification.primaryConfidence,
      isPrimary: true,
      reason: classification.reason,
      source: "AI",
    },
  });

  // Zapisz alternatywne specjalizacje (tylko jeśli score >= 3)
  if (classification.alternativeSpecializations) {
    for (const alt of classification.alternativeSpecializations.filter((a) => a.score >= 3)) {
      // Znajdź kod specjalizacji (może być już utworzona)
      const altSpecCode = createdSpecializations.find((s) => s.code === alt.code)?.code || alt.code;
      await db.companyClassification.create({
        data: {
          companyId,
          specializationCode: altSpecCode,
          score: alt.score,
          confidence: alt.confidence,
          isPrimary: false,
          reason: classification.reason,
          source: "AI",
        },
      });
    }
  }

  // Pobierz pełną informację o głównej specjalizacji z bazy
  const primarySpecFromDb = await db.companySpecialization.findUnique({
    where: { code: primarySpec.code },
  });

  // Aktualizuj główne pola klasyfikacji (backward compatibility)
  await db.company.update({
    where: { id: companyId },
    data: {
      classificationClass: primarySpecFromDb?.companyClass || null,
      classificationSubClass: primarySpec.code,
      classificationConfidence: classification.primaryConfidence,
      classificationNeedsReview: classification.needsReview,
      classificationSource: "AI",
      classificationUpdatedAt: new Date(),
    },
  });

  logger.debug("company-classification-ai", "Zapisano klasyfikację do bazy", {
    companyId,
    primarySpecialization: primarySpec.code,
    alternativeCount: classification.alternativeSpecializations?.length || 0,
    newSpecializationsCreated: createdSpecializations.length,
  });

  return createdSpecializations;
}

