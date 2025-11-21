import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import { getPersonaCriteriaById, type PersonaCriteriaDto, upsertPersonaCriteriaById, type PersonaRoleConfig } from "@/services/personaCriteriaService";
import { upsertPersonaBrief, regeneratePromptForPersonaCriteria } from "@/services/personaBriefService";
import { trackTokenUsage } from "@/services/tokenTracker";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

function parsePersonaId(raw: string | string[] | undefined): number | null {
  if (!raw || Array.isArray(raw)) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Regeneruje brief strategiczny na podstawie aktualnej rozmowy
 */
async function regenerateBriefFromConversation(
  personaId: number,
  history: ChatCompletionMessageParam[],
  savedPersonaCriteria: PersonaCriteriaDto,
  openai: any
): Promise<void> {
  try {
    // Sprawdź czy użytkownik powiedział, że seniority nie jest ważne
    const historyText = JSON.stringify(history, null, 2).toLowerCase();
    const seniorityNotImportant = historyText.includes("seniority nie") || 
      historyText.includes("seniority nie jest") ||
      historyText.includes("seniority nie ma") ||
      historyText.includes("seniority nieistotne") ||
      historyText.includes("seniority nie ważne") ||
      (historyText.includes("seniority") && (historyText.includes("nie ważne") || historyText.includes("nieistotne")));
    
    const briefPrompt = `Na podstawie historii rozmowy z użytkownikiem przygotuj brief strategiczny dla weryfikacji person. Odpowiedz TYLKO w JSON:
{
  "summary": "SZCZEGÓŁOWE podsumowanie kontekstu biznesowego - MUSISZ uwzględnić: 1) Co to za produkt/usługa (dokładny opis), 2) Do jakich firm jest kierowany (profil odbiorców), 3) Kto w tych firmach podejmuje decyzje zakupowe i dlaczego (logika decyzyjna), 4) Jaki jest cel kampanii. To jest KLUCZOWE dla poprawnej weryfikacji person przez AI.",
  "decisionGuidelines": ["Wskazówka 1 - jak oceniać stanowiska", "Wskazówka 2 - co brać pod uwagę"],
  "targetProfiles": ["Wszystkie stanowiska pozytywne z wygenerowanych person - MUSISZ uwzględnić WSZYSTKIE z listy poniżej"],
  "avoidProfiles": ["Wszystkie stanowiska negatywne z wygenerowanych person - MUSISZ uwzględnić WSZYSTKIE z listy poniżej"],
  "aiRole": "Rola AI podczas weryfikacji (np. ekspert od stoisk targowych, analityk sprzedażowy B2B)"
}

${seniorityNotImportant ? "WAŻNE: Użytkownik wyraźnie stwierdził, że seniority nie jest ważne. W briefie nie uwzględniaj wymagań dotyczących poziomu seniority." : ""}

WAŻNE - MUSISZ uwzględnić WSZYSTKIE stanowiska z wygenerowanych person w targetProfiles i avoidProfiles. Nie pomijaj żadnego stanowiska.

Historia rozmowy:
${JSON.stringify(history, null, 2)}

Wygenerowane persony:
Pozytywne: ${JSON.stringify(savedPersonaCriteria.positiveRoles?.map((r: any) => r.label) || [], null, 2)}
Negatywne: ${JSON.stringify(savedPersonaCriteria.negativeRoles?.map((r: any) => r.label) || [], null, 2)}

Uwaga: W targetProfiles i avoidProfiles MUSISZ uwzględnić WSZYSTKIE stanowiska z powyższych list. Nie pomijaj żadnego.`;

    const briefCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Jesteś ekspertem ds. prospectingu. Zwracasz wyłącznie poprawny JSON zgodny ze schematem.",
        },
        { role: "user", content: briefPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    if (briefCompletion.usage) {
      await trackTokenUsage({
        operation: "persona_brief_regenerate",
        model: "gpt-4o",
        promptTokens: briefCompletion.usage.prompt_tokens,
        completionTokens: briefCompletion.usage.completion_tokens,
        metadata: { personaId },
      });
    }

    let briefContent = briefCompletion.choices[0]?.message?.content ?? "";
    let briefClean = briefContent.trim();

    if (briefClean.startsWith("```json")) {
      briefClean = briefClean.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    } else if (briefClean.startsWith("```")) {
      briefClean = briefClean.replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    }

    let briefParsed: {
      summary?: string;
      decisionGuidelines?: string[];
      targetProfiles?: string[];
      avoidProfiles?: string[];
      aiRole?: string;
    } | undefined;

    try {
      briefParsed = JSON.parse(briefClean);
    } catch (parseError) {
      logger.error("persona-brief-regenerate", "Błąd parsowania JSON briefu", { personaId }, parseError as Error);
      logger.error("persona-brief-regenerate", "Zawartość briefu", { personaId, content: briefClean.substring(0, 500) });
      return; // Nie rzucamy błędu - regeneracja briefu nie jest krytyczna
    }

    // Walidacja danych
    if (!briefParsed || typeof briefParsed !== "object") {
      logger.error("persona-brief-regenerate", "Brief nie jest obiektem", { personaId });
      return;
    }

    // Zapisz brief tylko jeśli są dane do zapisania
    if (briefParsed.summary || briefParsed.decisionGuidelines?.length || briefParsed.targetProfiles?.length || briefParsed.avoidProfiles?.length || briefParsed.aiRole) {
      await upsertPersonaBrief(personaId, {
        summary: briefParsed.summary || "",
        decisionGuidelines: Array.isArray(briefParsed.decisionGuidelines) ? briefParsed.decisionGuidelines : [],
        targetProfiles: Array.isArray(briefParsed.targetProfiles) ? briefParsed.targetProfiles : [],
        avoidProfiles: Array.isArray(briefParsed.avoidProfiles) ? briefParsed.avoidProfiles : [],
        aiRole: briefParsed.aiRole || null,
      });
      logger.info("persona-brief-regenerate", "Zregenerowano brief strategiczny z rozmowy", { personaId });
    }
  } catch (error) {
    logger.error("persona-brief-regenerate", "Błąd regeneracji briefu z rozmowy", { personaId }, error as Error);
    // Nie rzucamy błędu - regeneracja briefu nie jest krytyczna
  }
}

/**
 * POST /api/company-selection/personas/[id]/verification-cache/apply-changes
 * Przekazuje zmiany decyzji do briefu i aktualizuje istniejące weryfikacje
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const personaId = parsePersonaId(params.id);
  if (personaId === null) {
    return NextResponse.json({ success: false, error: "Nieprawidłowe ID person" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { changes } = body;

    if (!Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ success: false, error: "Brak zmian do przekazania" }, { status: 400 });
    }

    // Pobierz cache entries do zmiany
    const cacheEntries = await (db as any).personaTitleVerificationCache.findMany({
      where: {
        id: { in: changes.map((c: any) => c.cacheId) },
        personaCriteriaId: personaId,
      },
    });

    if (cacheEntries.length === 0) {
      return NextResponse.json({ success: false, error: "Nie znaleziono wpisów cache do zmiany" }, { status: 404 });
    }

    // Mapuj zmiany po cacheId
    const changesMap = new Map(changes.map((c: any) => [c.cacheId, c]));
    
    // Zapisz stare decyzje przed aktualizacją (dla wiadomości do czatu)
    const oldDecisionsMap = new Map(cacheEntries.map((entry: any) => [entry.id, entry.decision]));

    // 1. Zaktualizuj cache entries
    let updatedCacheCount = 0;
    for (const cacheEntry of cacheEntries) {
      const change = changesMap.get(cacheEntry.id);
      if (!change) continue;

      await (db as any).personaTitleVerificationCache.update({
        where: { id: cacheEntry.id },
        data: {
          decision: change.newDecision,
          reason: change.justification,
          verifiedAt: new Date(),
        },
      });
      updatedCacheCount++;
    }

    logger.info("persona-cache-apply-changes", `Zaktualizowano ${updatedCacheCount} wpisów cache`, { personaId });

    // 2. Znajdź wszystkie weryfikacje z tym samym personaCriteriaId
    const verifications = await db.personaVerificationResult.findMany({
      where: { personaCriteriaId: personaId },
    });

    logger.info("persona-cache-apply-changes", `Znaleziono ${verifications.length} weryfikacji do aktualizacji`, { personaId });

    // 3. Zaktualizuj weryfikacje
    let updatedVerificationsCount = 0;
    for (const verification of verifications) {
      try {
        const employees = JSON.parse(verification.employees);
        let hasChanges = false;
        let positiveCount = 0;
        let negativeCount = 0;
        let unknownCount = 0;

        // Dla każdej zmiany w cache, znajdź pasujące stanowiska w employees
        for (const cacheEntry of cacheEntries) {
          const change = changesMap.get(cacheEntry.id);
          if (!change) continue;

          // Normalizuj departments dla porównania
          const cacheDepartments = cacheEntry.departments 
            ? (cacheEntry.departments.trim() ? JSON.parse(cacheEntry.departments) : [])
            : [];
          const cacheDepartmentsSorted = [...cacheDepartments].sort().join(",");

          // Znajdź pasujące stanowiska w employees
          for (const employee of employees) {
            const employeeTitleNormalized = employee.titleNormalized?.toLowerCase() || "";
            const employeeDepartments = Array.isArray(employee.departments) ? employee.departments : [];
            const employeeDepartmentsSorted = [...employeeDepartments].sort().join(",");
            const employeeSeniority = employee.seniority || "";

            // Sprawdź dokładne dopasowanie: titleNormalized + departments + seniority
            if (
              employeeTitleNormalized === cacheEntry.titleNormalized.toLowerCase() &&
              employeeDepartmentsSorted === cacheDepartmentsSorted &&
              employeeSeniority === (cacheEntry.seniority || "")
            ) {
              // Zmień decyzję tylko jeśli była inna
              if (employee.decision !== change.newDecision) {
                employee.decision = change.newDecision;
                employee.reason = change.justification;
                hasChanges = true;
              }
            }
          }
        }

        // Przelicz statystyki
        for (const employee of employees) {
          if (employee.decision === "positive") {
            positiveCount++;
          } else if (employee.decision === "negative") {
            negativeCount++;
          } else {
            unknownCount++;
          }
        }

        // Zaktualizuj weryfikację tylko jeśli były zmiany
        if (hasChanges) {
          await db.personaVerificationResult.update({
            where: { id: verification.id },
            data: {
              employees: JSON.stringify(employees),
              positiveCount,
              negativeCount,
              unknownCount,
              updatedAt: new Date(),
            },
          });
          updatedVerificationsCount++;
        }
      } catch (parseError) {
        logger.error("persona-cache-apply-changes", `Błąd parsowania employees dla weryfikacji ${verification.id}`, { verificationId: verification.id }, parseError as Error);
        // Kontynuuj z następną weryfikacją
      }
    }

    logger.info("persona-cache-apply-changes", `Zaktualizowano ${updatedVerificationsCount} weryfikacji`, { personaId });

    // 4. Przekaż zmiany do briefu przez czat
    const personaCriteria = await getPersonaCriteriaById(personaId);
    if (!personaCriteria) {
      return NextResponse.json({ success: false, error: "Nie znaleziono kryteriów person" }, { status: 404 });
    }

    // Przygotuj wiadomość dla czatu z uzasadnieniami zmian
    // Użyj starej decyzji PRZED aktualizacją
    const changesSummary = cacheEntries.map((cacheEntry: any) => {
      const change = changesMap.get(cacheEntry.id);
      if (!change) return null;
      
      // Stara decyzja to ta która była w cache przed aktualizacją
      const oldDecision = oldDecisionsMap.get(cacheEntry.id) || cacheEntry.decision;
      
      return {
        title: cacheEntry.titleNormalized,
        from: oldDecision === "positive" ? "Pozytywne" : "Negatywne",
        to: change.newDecision === "positive" ? "Pozytywne" : "Negatywne",
        justification: change.justification,
      };
    }).filter(Boolean);

    const chatMessage = `Zaktualizowałem następujące decyzje weryfikacji person:\n\n${changesSummary.map((c: any) => 
      `- "${c.title}": ${c.from} → ${c.to}\n  Uzasadnienie: ${c.justification}`
    ).join("\n\n")}\n\nProszę zaktualizuj brief strategiczny oraz konfigurację person (positiveRoles/negativeRoles), aby uwzględnić te zmiany. Dla stanowisk zmienionych z negatywnego na pozytywne dodaj je do positiveRoles, a dla zmienionych z pozytywnego na negatywne dodaj je do negativeRoles.`;

    // Pobierz istniejącą historię czatu
    const existingChatHistory = personaCriteria.chatHistory 
      ? (typeof personaCriteria.chatHistory === "string" ? JSON.parse(personaCriteria.chatHistory) : personaCriteria.chatHistory)
      : [];

    // Dodaj nową wiadomość użytkownika i odpowiedź AI
    const newChatHistory = [
      ...existingChatHistory,
      { role: "user", content: chatMessage },
      { role: "assistant", content: "Rozumiem. Zaktualizuję brief strategiczny oraz konfigurację person (positiveRoles/negativeRoles), aby uwzględnić te zmiany w decyzjach weryfikacji person." },
    ];

    // Zaktualizuj historię czatu
    await db.companyPersonaCriteria.update({
      where: { id: personaId },
      data: {
        chatHistory: JSON.stringify(newChatHistory),
        lastUserMessage: chatMessage,
        lastAIResponse: "Rozumiem. Zaktualizuję brief strategiczny, aby uwzględnić te zmiany w decyzjach weryfikacji person.",
        updatedBy: "cache-changes",
      },
    });

    // 5. Zaktualizuj konfigurację person (positiveRoles/negativeRoles) na podstawie zmian w cache
    const currentPositiveRoles = personaCriteria.positiveRoles || [];
    const currentNegativeRoles = personaCriteria.negativeRoles || [];
    const updatedPositiveRoles = [...currentPositiveRoles];
    const updatedNegativeRoles = [...currentNegativeRoles];

    for (const cacheEntry of cacheEntries) {
      const change = changesMap.get(cacheEntry.id);
      if (!change) continue;

      const title = cacheEntry.titleNormalized;
      const departments = cacheEntry.departments 
        ? (cacheEntry.departments.trim() ? JSON.parse(cacheEntry.departments) : [])
        : [];
      const seniority = cacheEntry.seniority || null;

      // Sprawdź czy rola już istnieje w konfiguracji
      const existingPositiveIndex = updatedPositiveRoles.findIndex((r: PersonaRoleConfig) => 
        r.label?.toLowerCase() === title.toLowerCase()
      );
      const existingNegativeIndex = updatedNegativeRoles.findIndex((r: PersonaRoleConfig) => 
        r.label?.toLowerCase() === title.toLowerCase()
      );

      if (change.newDecision === "positive") {
        // Usuń z negatywnych jeśli istnieje
        if (existingNegativeIndex >= 0) {
          updatedNegativeRoles.splice(existingNegativeIndex, 1);
        }
        // Dodaj do pozytywnych jeśli nie istnieje
        if (existingPositiveIndex < 0) {
          updatedPositiveRoles.push({
            label: title,
            keywords: [title.toLowerCase()],
            departments: departments.length > 0 ? departments : [],
            minSeniority: seniority || null,
            confidence: 0.8, // Domyślna pewność dla ręcznie zmienionych decyzji
          });
        }
      } else {
        // Usuń z pozytywnych jeśli istnieje
        if (existingPositiveIndex >= 0) {
          updatedPositiveRoles.splice(existingPositiveIndex, 1);
        }
        // Dodaj do negatywnych jeśli nie istnieje
        if (existingNegativeIndex < 0) {
          updatedNegativeRoles.push({
            label: title,
            keywords: [title.toLowerCase()],
            departments: departments.length > 0 ? departments : [],
            minSeniority: seniority || null,
            confidence: 0.8, // Domyślna pewność dla ręcznie zmienionych decyzji
          });
        }
      }
    }

    // Zaktualizuj konfigurację person
    await upsertPersonaCriteriaById(personaId, {
      name: personaCriteria.name,
      description: personaCriteria.description,
      positiveRoles: updatedPositiveRoles,
      negativeRoles: updatedNegativeRoles,
      conditionalRules: personaCriteria.conditionalRules || [],
      language: personaCriteria.language,
      chatHistory: newChatHistory,
      lastUserMessage: chatMessage,
      lastAIResponse: "Rozumiem. Zaktualizuję brief strategiczny oraz konfigurację person (positiveRoles/negativeRoles), aby uwzględnić te zmiany w decyzjach weryfikacji person.",
      updatedBy: "cache-changes",
    });

    logger.info("persona-cache-apply-changes", "Konfiguracja person została zaktualizowana", { 
      personaId, 
      positiveRolesCount: updatedPositiveRoles.length,
      negativeRolesCount: updatedNegativeRoles.length,
    });

    // 6. Regeneruj brief na podstawie zaktualizowanej historii
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Pobierz zaktualizowaną konfigurację person
    const updatedPersonaCriteria = await getPersonaCriteriaById(personaId);
    if (updatedPersonaCriteria) {
      await regenerateBriefFromConversation(personaId, newChatHistory, updatedPersonaCriteria, openai);
    }

    // Regeneruj prompt po aktualizacji briefu i konfiguracji person
    await regeneratePromptForPersonaCriteria(personaId);

    logger.info("persona-cache-apply-changes", "Brief i prompt zostały zaktualizowane", { personaId });

    return NextResponse.json({
      success: true,
      updatedCache: updatedCacheCount,
      updatedVerifications: updatedVerificationsCount,
      message: "Zmiany zostały przekazane i brief został zaktualizowany",
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("persona-cache-apply-changes", "Błąd przekazywania zmian", { personaId }, err);
    return NextResponse.json(
      { success: false, error: "Błąd przekazywania zmian", details: err.message },
      { status: 500 }
    );
  }
}

