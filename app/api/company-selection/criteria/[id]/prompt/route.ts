import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import { getCompanyVerificationBrief } from "@/services/companyVerificationBriefService";

function parseCriteriaId(rawId: string | string[] | undefined): number | null {
  if (!rawId) return null;
  const str = Array.isArray(rawId) ? rawId[0] : rawId;
  const parsed = parseInt(str, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const criteriaId = parseCriteriaId(params.id);

  if (criteriaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID kryteriów" }, { status: 400 });
  }

  try {
    const criteria = await db.companyVerificationCriteria.findUnique({
      where: { id: criteriaId },
    });

    if (!criteria) {
      return NextResponse.json({ success: false, error: "Kryteria nie zostały znalezione" }, { status: 404 });
    }

    // Pobierz model z query params (domyślnie gpt-4o-mini)
    const searchParams = req.nextUrl.searchParams;
    const model = searchParams.get("model") || "gpt-4o-mini";
    const validModel = model === "gpt-4o" ? "gpt-4o" : "gpt-4o-mini";

    // Pobierz brief (jeśli istnieje)
    const brief = await getCompanyVerificationBrief(criteriaId);

    // Rekonstruuj pełny prompt używany w rzeczywistej weryfikacji
    let fullPrompt = `Jesteś ekspertem od weryfikacji firm pod kątem przydatności do prospectingu.

`;

    // PRIORYTET 1: Brief strategiczny (jeśli istnieje)
    if (brief && (brief.summary || brief.decisionGuidelines.length > 0 || brief.targetCompanies.length > 0 || brief.avoidCompanies.length > 0 || brief.aiRole)) {
      fullPrompt += `[BRIEF STRATEGICZNY - PRIORYTET 1]
`;
      if (brief.summary) {
        fullPrompt += `Podsumowanie: ${brief.summary}
`;
      }
      if (brief.decisionGuidelines.length > 0) {
        fullPrompt += `Wskazówki decyzyjne:
${brief.decisionGuidelines.map((g, i) => `${i + 1}. ${g}`).join("\n")}
`;
      }
      if (brief.targetCompanies.length > 0) {
        fullPrompt += `Przykłady firm kwalifikowanych: ${brief.targetCompanies.join(", ")}
`;
      }
      if (brief.avoidCompanies.length > 0) {
        fullPrompt += `Przykłady firm odrzucanych: ${brief.avoidCompanies.join(", ")}
`;
      }
      if (brief.aiRole) {
        fullPrompt += `Rola AI: ${brief.aiRole}
`;
      }
      fullPrompt += `
`;
    }

    // PRIORYTET 2: Szczegółowe kryteria
    fullPrompt += `[KRYTERIA WERYFIKACJI - PRIORYTET 2]
${criteria.criteriaText || "Brak zdefiniowanych kryteriów"}

DANE FIRMY:
Nazwa: [Nazwa firmy]
Branża: [Branża firmy lub "Nie podano"]
Liczba pracowników: [Liczba pracowników lub "Brak danych"]
Wielkość firmy: [Wielkość firmy lub "Brak danych"]
Liczba lokalizacji: [Liczba lokalizacji lub "Brak danych"]
Opis: [Opis firmy, opis działalności, branża - łącznie]

WAŻNE - INTERPRETACJA BRAKU DANYCH:
- Jeśli liczba pracowników to "Brak danych" (0 lub null w bazie), to NIE oznacza że firma nie ma pracowników - oznacza tylko brak informacji w bazie
- W takim przypadku firma powinna być traktowana jako POZYTYWNA w kontekście liczby pracowników (brak danych nie może dyskwalifikować)
- Podobnie z liczbą lokalizacji - brak danych nie oznacza że firma nie ma lokalizacji

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

    return NextResponse.json({
      success: true,
      data: {
        promptText: fullPrompt,
        model: validModel,
        criteriaId: criteriaId,
        qualifiedThreshold: criteria.qualifiedThreshold,
        rejectedThreshold: criteria.rejectedThreshold,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("criteria-prompt", "Błąd pobierania promptu", { criteriaId }, err);
    return NextResponse.json({ success: false, error: "Błąd pobierania promptu" }, { status: 500 });
  }
}
