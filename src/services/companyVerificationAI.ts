/**
 * Company Verification AI Service
 * Weryfikuje firmy pod kątem przydatności do prospectingu używając AI
 */

import { db } from "@/lib/db";
import { logger } from "./logger";
import { ensureCompanyClassification } from "./companySegmentation";
import { trackTokenUsage } from "./tokenTracker";

export interface VerificationResult {
  status: "QUALIFIED" | "REJECTED" | "NEEDS_REVIEW";
  score: number; // 0.0 - 1.0
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  keywords?: string[];
}

export interface VerificationCriteria {
  id: number;
  name: string;
  criteriaText: string;
  qualifiedThreshold: number;
  rejectedThreshold: number;
  qualifiedKeywords?: string[];
  rejectedKeywords?: string[];
}

/**
 * Pobiera aktywną konfigurację kryteriów weryfikacji
 */
export async function getActiveCriteria(): Promise<VerificationCriteria | null> {
  const criteria = await db.companyVerificationCriteria.findFirst({
    where: {
      isActive: true,
      isDefault: true,
    },
  });

  if (!criteria) {
    return null;
  }

  return {
    id: criteria.id,
    name: criteria.name,
    criteriaText: criteria.criteriaText,
    qualifiedThreshold: criteria.qualifiedThreshold,
    rejectedThreshold: criteria.rejectedThreshold,
    qualifiedKeywords: criteria.qualifiedKeywords
      ? JSON.parse(criteria.qualifiedKeywords)
      : undefined,
    rejectedKeywords: criteria.rejectedKeywords
      ? JSON.parse(criteria.rejectedKeywords)
      : undefined,
  };
}

/**
 * Weryfikuje firmę używając AI
 */
export async function verifyCompanyWithAI(
  companyData: {
    name: string;
    description?: string | null;
    activityDescription?: string | null;
    industry?: string | null;
    website?: string | null;
  },
  criteria?: VerificationCriteria | null
): Promise<VerificationResult> {
  // Pobierz kryteria jeśli nie podano
  if (!criteria) {
    criteria = await getActiveCriteria();
  }

  // Jeśli brak kryteriów, użyj domyślnych
  if (!criteria) {
    logger.error("company-verification-ai", "Brak konfiguracji kryteriów weryfikacji", { companyName: companyData.name });
    throw new Error(
      "Brak konfiguracji kryteriów weryfikacji. Utwórz konfigurację w module wyboru leadów."
    );
  }

  // Przygotuj dane do analizy
  const contentToAnalyze = [
    companyData.description,
    companyData.activityDescription,
    companyData.industry,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!contentToAnalyze.trim()) {
    logger.warn("company-verification-ai", "Brak danych do analizy", { companyName: companyData.name });
    return {
      status: "NEEDS_REVIEW",
      score: 0.5,
      reason: "Brak danych do analizy - wymagana ręczna weryfikacja lub scraping strony",
      confidence: "LOW",
    };
  }

  // Wywołaj AI
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `Jesteś ekspertem od weryfikacji firm pod kątem przydatności do prospectingu.

${criteria.criteriaText}

DANE FIRMY:
Nazwa: ${companyData.name}
Branża: ${companyData.industry || "Nie podano"}
Opis: ${contentToAnalyze}

WAŻNE INSTRUKCJE DLA POLA "reason":
- Dla firm QUALIFIED (zakwalifikowanych): Napisz krótko dlaczego firma pasuje (np. "Buduje stoiska targowe i struktury wystawiennicze")
- Dla firm REJECTED (odrzuconych): NIGDY nie pisz czego firma NIE robi (np. "nie zajmuje się stoiskami"). Zamiast tego napisz:
  * CO firma faktycznie robi (np. "Zajmuje się agencją reklamową i marketingiem cyfrowym")
  * DLACZEGO to nie pasuje (np. "nie wykonuje fizycznych stoisk targowych")
- Zawsze zaczynaj od tego co firma ROBI, potem dlaczego to nie pasuje (jeśli REJECTED)
- Maksymalnie 200 znaków
- Bądź konkretny i zwięzły

Odpowiedz w formacie JSON:
{
  "status": "QUALIFIED" | "REJECTED",
  "score": 0.0-1.0, // 1.0 = na pewno pasuje, 0.0 = na pewno nie pasuje
  "reason": "Uzasadnienie decyzji (max 200 znaków) - PAMIĘTAJ: dla REJECTED pisz co robi + dlaczego nie pasuje",
  "keywords": ["słowo1", "słowo2"], // Kluczowe słowa które zadecydowały
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Jesteś ekspertem od weryfikacji firm. Odpowiadasz TYLKO w formacie JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    // Track token usage
    if (response.usage) {
      await trackTokenUsage({
        operation: "company_verification",
        model: "gpt-4o-mini",
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        metadata: { companyName: companyData.name },
      });
    }

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Brak odpowiedzi z OpenAI");
    }

    // Parse JSON response
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```json")) {
      cleanContent = cleanContent.replace(/^```json\s*/, "").replace(/```\s*$/, "");
    } else if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }

    const aiResult = JSON.parse(cleanContent);

    // Określ status na podstawie score i progów
    let finalStatus: "QUALIFIED" | "REJECTED" | "NEEDS_REVIEW";
    if (aiResult.score >= criteria.qualifiedThreshold) {
      finalStatus = "QUALIFIED";
    } else if (aiResult.score <= criteria.rejectedThreshold) {
      finalStatus = "REJECTED";
    } else {
      finalStatus = "NEEDS_REVIEW";
    }

    logger.info("company-verification-ai", `Firma zweryfikowana: ${finalStatus} (score: ${aiResult.score})`, {
      companyName: companyData.name,
      status: finalStatus,
      score: aiResult.score,
      confidence: aiResult.confidence,
    });

    return {
      status: finalStatus,
      score: aiResult.score,
      reason: aiResult.reason,
      confidence: aiResult.confidence,
      keywords: aiResult.keywords,
    };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("company-verification-ai", "Błąd weryfikacji AI", { companyName: companyData.name }, errorObj);
    throw error;
  }
}

/**
 * Sprawdza czy firma jest na liście zablokowanych
 * Zwraca nazwę zablokowanej firmy jeśli znaleziono dopasowanie
 */
export async function checkIfBlocked(companyId: number, companyWebsite: string | null | undefined): Promise<string | null> {
  try {
    // Sprawdź czy firma jest zablokowana jako "bez www" (po companyId)
    const noWebsiteBlock = await db.blockedCompany.findUnique({
      where: { companyId } as any,
    });
    
    if (noWebsiteBlock && noWebsiteBlock.blockType === "NO_WEBSITE") {
      logger.info("company-verify", `Firma zablokowana (brak www): companyId=${companyId}`);
      return "NO_WEBSITE";
    }

    // Sprawdź blokady po adresie www (tylko jeśli firma ma www)
    if (!companyWebsite) {
      return null; // Firma bez www nie może być zablokowana po www
    }

    // Pobierz wszystkie zablokowane firmy (tylko te z website)
    const blockedCompanies = await db.blockedCompany.findMany({
      where: {
        website: { not: null },
        blockType: "MANUAL",
      } as any,
      select: { website: true, companyName: true } as any,
    });

    // Normalizuj adres www firmy
    const companyWebsiteLower = companyWebsite.toLowerCase().trim();
    
    // Sprawdź czy adres www firmy pasuje do któregoś z zablokowanych adresów (dokładne dopasowanie)
    for (const blocked of blockedCompanies) {
      const blockedWebsite = (blocked as any).website;
      if (!blockedWebsite) continue;
      const blockedWebsiteLower = blockedWebsite.toLowerCase().trim();
      if (companyWebsiteLower === blockedWebsiteLower) {
        logger.info("company-verify", `Firma zablokowana: ${companyWebsite} (dopasowanie: ${blockedWebsite})`);
        return blockedWebsite;
      }
    }

    return null;
  } catch (error) {
    logger.error("company-verify", "Błąd sprawdzania listy zablokowanych firm", { companyId, companyWebsite }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Weryfikuje firmę i zapisuje wynik do bazy
 * @param companyId - ID firmy do weryfikacji
 * @param criteria - Kryteria weryfikacji
 * @param selectionId - ID selekcji (opcjonalne). Jeśli podane, aktualizuje tylko status w tej selekcji. Jeśli null, aktualizuje globalny status.
 */
export async function verifyAndSaveCompany(
  companyId: number,
  criteria?: VerificationCriteria | null,
  selectionId?: number | null
): Promise<VerificationResult> {
  // Pobierz firmę
  let company = await db.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new Error(`Firma o ID ${companyId} nie została znaleziona`);
  }

  company = await ensureCompanyClassification(company);

  // SPRAWDŹ CZY FIRMA JEST ZABLOKOWANA - PRZED weryfikacją AI (po companyId lub adresie www)
  const blockedMatch = await checkIfBlocked(companyId, company.website);
  if (blockedMatch) {
    const blockedReason = blockedMatch === "NO_WEBSITE" 
      ? "Firma zablokowana automatycznie: brak adresu strony www"
      : `Firma zablokowana (adres www: ${blockedMatch})`;
    
    // Firma jest zablokowana - oznacz jako BLOCKED (globalnie - blokada dotyczy wszystkich selekcji)
    await db.company.update({
      where: { id: companyId },
      data: {
        verificationStatus: "BLOCKED",
        verificationReason: blockedReason,
        verifiedAt: new Date(),
        verifiedBy: "SYSTEM",
        verificationSource: "BLOCKED_LIST",
        verificationScore: null,
      },
    });

    // Zaktualizuj również status w CompanySelectionCompany dla wszystkich selekcji (blokada dotyczy wszystkich)
    await db.companySelectionCompany.updateMany({
      where: { companyId },
      data: {
        status: "BLOCKED",
        score: null,
        verifiedAt: new Date(),
        reason: blockedReason,
        verificationResult: null,
      },
    });

    // Zapisz log
    await db.companyVerificationLog.create({
      data: {
        companyId,
        status: "BLOCKED",
        score: null,
        reason: blockedReason,
        source: "BLOCKED_LIST",
        content: `Firma: ${company.name}`,
      },
    });

    logger.info("company-verify", `Firma zablokowana podczas weryfikacji: ${company.name} (ID: ${companyId})`, {
      blockedMatch,
    });

    return {
      status: "REJECTED", // Zwracamy REJECTED dla kompatybilności, ale status w DB to BLOCKED
      score: 0,
      reason: blockedReason,
      confidence: "HIGH",
    };
  }

  // Weryfikuj przez AI tylko jeśli nie jest zablokowana
  const result = await verifyCompanyWithAI(
    {
      name: company.name,
      description: company.description ?? company.descriptionPl,
      activityDescription: company.activityDescription ?? company.activityDescriptionPl,
      industry: company.industry,
      website: company.website,
    },
    criteria
  );

  // Pobierz progi z kryteriów
  const activeCriteria = criteria || (await getActiveCriteria());
  const qualifiedThreshold = activeCriteria?.qualifiedThreshold || 0.8;
  const rejectedThreshold = activeCriteria?.rejectedThreshold || 0.3;

  // Jeśli selectionId jest podane, aktualizuj tylko status w tej selekcji (per-selekcja)
  // Jeśli nie, aktualizuj globalny status (dla firm bez selekcji - nie powinno się zdarzyć w normalnym użyciu)
  if (selectionId != null && Number.isFinite(selectionId)) {
    // Weryfikacja per-selekcja - aktualizuj tylko status w tej selekcji
    await db.companySelectionCompany.update({
      where: {
        selectionId_companyId: {
          selectionId,
          companyId,
        },
      },
      data: {
        status: result.status,
        score: result.score,
        verifiedAt: new Date(),
        reason: result.reason,
        verificationResult: JSON.stringify(result),
      },
    });
    
    // NIE aktualizujemy globalnego statusu - pozostaje taki, jaki był po imporcie CSV
  } else {
    // Weryfikacja bez selekcji (nie powinno się zdarzyć, ale dla bezpieczeństwa)
    // Aktualizuj globalny status
    await db.company.update({
      where: { id: companyId },
      data: {
        verificationStatus: result.status,
        verificationScore: result.score,
        verificationReason: result.reason,
        verifiedAt: new Date(),
        verifiedBy: "AI",
        verificationSource: "DESCRIPTION",
        confidenceThreshold: result.status === "QUALIFIED" 
          ? qualifiedThreshold 
          : result.status === "REJECTED" 
          ? rejectedThreshold 
          : (qualifiedThreshold + rejectedThreshold) / 2,
        verificationResult: JSON.stringify(result),
      },
    });
  }

  // Zapisz log
  await db.companyVerificationLog.create({
    data: {
      companyId,
      status: result.status,
      score: result.score,
      reason: result.reason,
      source: "DESCRIPTION",
      content: [company.description, company.activityDescription]
        .filter(Boolean)
        .join("\n\n"),
      aiModel: "gpt-4o-mini",
    },
  });

  return result;
}

