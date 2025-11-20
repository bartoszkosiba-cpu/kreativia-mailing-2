import { db } from "@/lib/db";
import { logger } from "./logger";

export interface PersonaTitleCacheKey {
  personaCriteriaId: number;
  titleNormalized: string;
  titleEnglish?: string | null; // null będzie konwertowane na ""
  departments?: string[] | null; // null będzie konwertowane na ""
  seniority?: string | null; // null będzie konwertowane na ""
}

export interface PersonaTitleCacheResult {
  decision: "positive" | "negative";
  score?: number | null;
  reason?: string | null;
}

/**
 * Tworzy klucz cache dla stanowiska
 */
function createCacheKey(key: PersonaTitleCacheKey): string {
  const departments = key.departments 
    ? JSON.stringify([...key.departments].sort()) 
    : null;
  return `${key.personaCriteriaId}|${key.titleNormalized}|${key.titleEnglish || ""}|${departments || ""}|${key.seniority || ""}`;
}

/**
 * Pobiera decyzję z cache dla danego stanowiska
 */
export async function getCachedTitleDecision(
  key: PersonaTitleCacheKey
): Promise<PersonaTitleCacheResult | null> {
  try {
    const departmentsJson = key.departments 
      ? JSON.stringify([...key.departments].sort()) 
      : "";
    const titleEnglish = key.titleEnglish || "";
    const seniority = key.seniority || "";

    const cache = await db.personaTitleVerificationCache.findUnique({
      where: {
        personaCriteriaId_titleNormalized_titleEnglish_departments_seniority: {
          personaCriteriaId: key.personaCriteriaId,
          titleNormalized: key.titleNormalized,
          titleEnglish: titleEnglish,
          departments: departmentsJson,
          seniority: seniority,
        },
      },
    });

    if (cache) {
      // Aktualizuj statystyki użycia
      await db.personaTitleVerificationCache.update({
        where: { id: cache.id },
        data: {
          useCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      // Upewnij się, że decision jest "positive" lub "negative" (conditional już nie istnieje)
      const decision = (cache.decision === "positive" || cache.decision === "negative") 
        ? (cache.decision as "positive" | "negative")
        : "negative"; // Fallback dla nieoczekiwanych wartości
      return {
        decision: decision,
        score: cache.score,
        reason: cache.reason,
      };
    }

    return null;
  } catch (error) {
    logger.error("persona-title-cache", "Błąd pobierania cache", { key }, error);
    return null;
  }
}

/**
 * Zapisuje decyzję do cache
 */
export async function saveCachedTitleDecision(
  key: PersonaTitleCacheKey,
  result: PersonaTitleCacheResult
): Promise<void> {
  try {
    // Walidacja - titleNormalized nie może być puste
    if (!key.titleNormalized || key.titleNormalized.trim().length === 0) {
      logger.warn("persona-title-cache", "Pominięto zapis cache - brak titleNormalized", { key, result });
      return;
    }

    const departmentsJson = key.departments 
      ? JSON.stringify([...key.departments].sort()) 
      : "";
    // Konwertuj null na pusty string dla zgodności z bazą danych
    const titleEnglish = (key.titleEnglish || "").trim();
    const seniority = (key.seniority || "").trim();

    const cacheData = {
      personaCriteriaId: key.personaCriteriaId,
      titleNormalized: key.titleNormalized.toLowerCase().trim(),
      titleEnglish: titleEnglish.toLowerCase(),
      departments: departmentsJson,
      seniority: seniority,
      decision: result.decision,
      score: result.score || null,
      reason: result.reason || null,
    };
    
    logger.info("persona-title-cache", "Próba zapisu cache", {
      personaCriteriaId: cacheData.personaCriteriaId,
      titleNormalized: cacheData.titleNormalized,
      titleEnglish: cacheData.titleEnglish,
      departments: cacheData.departments,
      seniority: cacheData.seniority,
      decision: cacheData.decision,
    });

    const saved = await db.personaTitleVerificationCache.upsert({
      where: {
        personaCriteriaId_titleNormalized_titleEnglish_departments_seniority: {
          personaCriteriaId: cacheData.personaCriteriaId,
          titleNormalized: cacheData.titleNormalized,
          titleEnglish: cacheData.titleEnglish,
          departments: cacheData.departments,
          seniority: cacheData.seniority,
        },
      },
      create: {
        ...cacheData,
        useCount: 1,
        lastUsedAt: new Date(),
      },
      update: {
        decision: cacheData.decision,
        score: cacheData.score,
        reason: cacheData.reason,
        verifiedAt: new Date(),
        // Nie resetujemy useCount - zachowujemy statystyki
      },
    });

    logger.info("persona-title-cache", "Zapisano stanowisko do cache", {
      personaCriteriaId: key.personaCriteriaId,
      titleNormalized: cacheData.titleNormalized,
      decision: result.decision,
      cacheId: saved.id,
    });
  } catch (error) {
    logger.error("persona-title-cache", "Błąd zapisu cache", { key, result }, error);
    // Nie rzucamy błędu - cache jest opcjonalny, ale logujemy szczegóły
    if (error instanceof Error) {
      logger.error("persona-title-cache", "Szczegóły błędu zapisu cache", {
        errorMessage: error.message,
        errorStack: error.stack,
        key,
      });
    }
  }
}

/**
 * Pobiera wszystkie zapisane decyzje dla danego personaCriteriaId
 */
export async function getCachedDecisionsForCriteria(
  personaCriteriaId: number
): Promise<Array<{
  id: number;
  titleNormalized: string;
  titleEnglish: string | null;
  departments: string[] | null;
  seniority: string | null;
  decision: string;
  score: number | null;
  reason: string | null;
  useCount: number;
  verifiedAt: Date;
  lastUsedAt: Date;
}>> {
  try {
    logger.info("persona-title-cache", "Pobieranie cache dla kryteriów", { personaCriteriaId });
    const cache = await db.personaTitleVerificationCache.findMany({
      where: { personaCriteriaId },
      orderBy: [
        { useCount: "desc" },
        { lastUsedAt: "desc" },
      ],
    });
    
    logger.info("persona-title-cache", `Znaleziono ${cache.length} wpisów cache`, { personaCriteriaId, count: cache.length });

    return cache.map((item) => ({
      id: item.id,
      titleNormalized: item.titleNormalized,
      titleEnglish: item.titleEnglish || null,
      departments: item.departments ? (item.departments.trim() ? JSON.parse(item.departments) : null) : null,
      seniority: item.seniority || null,
      decision: item.decision,
      score: item.score,
      reason: item.reason,
      useCount: item.useCount,
      verifiedAt: item.verifiedAt,
      lastUsedAt: item.lastUsedAt,
    }));
  } catch (error) {
    logger.error("persona-title-cache", "Błąd pobierania cache dla kryteriów", { personaCriteriaId }, error);
    return [];
  }
}

/**
 * Usuwa cache dla danego personaCriteriaId
 */
export async function clearCacheForCriteria(personaCriteriaId: number): Promise<void> {
  try {
    await db.personaTitleVerificationCache.deleteMany({
      where: { personaCriteriaId },
    });
  } catch (error) {
    logger.error("persona-title-cache", "Błąd czyszczenia cache", { personaCriteriaId }, error);
  }
}

/**
 * Usuwa pojedynczy wpis z cache
 */
export async function deleteCachedDecision(cacheId: number): Promise<void> {
  try {
    await db.personaTitleVerificationCache.delete({
      where: { id: cacheId },
    });
  } catch (error) {
    logger.error("persona-title-cache", "Błąd usuwania wpisu cache", { cacheId }, error);
    throw error;
  }
}

