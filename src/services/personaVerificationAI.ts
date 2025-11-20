import type { PersonaCriteriaDto, PersonaRoleConfig } from "@/services/personaCriteriaService";
import type { PersonaBriefDto } from "@/services/personaBriefService";
import { logger } from "@/services/logger";
import { getCachedTitleDecision, saveCachedTitleDecision } from "./personaTitleVerificationCache";

export interface PersonaVerificationAIInputPerson {
  id?: string;
  matchKey?: string;
  name?: string;
  title?: string;
  titleNormalized?: string;
  titleEnglish?: string;
  departments?: string[];
  seniority?: string | null;
  emailStatus?: string | null;
  managesPeople?: boolean;
  managesProcesses?: boolean;
  isExecutive?: boolean;
  semanticHint?: string | null;
}

export type PersonaDecision = "positive" | "negative";

export interface PersonaVerificationAIResult {
  id?: string;
  matchKey?: string;
  decision: PersonaDecision;
  score: number;
  reason: string;
}

export interface PersonaVerificationAIResponse {
  results: PersonaVerificationAIResult[];
}

type PersonaBriefContext = Pick<
  PersonaBriefDto,
  "summary" | "decisionGuidelines" | "targetProfiles" | "avoidProfiles" | "additionalNotes" | "aiRole" | "positiveThreshold" | "generatedPrompt"
>;

function buildPrompt(personaCriteria: PersonaCriteriaDto, brief?: PersonaBriefContext) {
  const positiveDescriptions = (personaCriteria.positiveRoles || []).map((role) => ({
    label: role.label,
    keywords: role.keywords || [],
    departments: role.departments || [],
    minSeniority: role.minSeniority || null,
  }));

  const negativeDescriptions = (personaCriteria.negativeRoles || []).map((role) => ({
    label: role.label,
    keywords: role.keywords || [],
    departments: role.departments || [],
    minSeniority: role.minSeniority || null,
  }));

  // Określ rolę AI - użyj z briefu lub fallback
  const aiRole = brief?.aiRole?.trim() || "ekspert ds. weryfikacji person B2B";
  
  // Pobierz próg klasyfikacji (domyślnie 50%)
  const positiveThreshold = brief?.positiveThreshold ?? 0.5;
  
  // Określ filozofię na podstawie progu
  const isLowThreshold = positiveThreshold <= 0.5; // 50% lub mniej = bardziej pozytywne
  const thresholdGuidance = isLowThreshold
    ? "Próg klasyfikacji jest niski (≤50%) - bądź bardziej skłonny do pozytywnych decyzji. W kontekście biznesowym lepiej dodać potencjalnego leada niż go przegapić."
    : "Próg klasyfikacji jest wyższy (>50%) - bądź bardziej restrykcyjny, ale nadal pamiętaj: w kontekście biznesowym lepiej dodać potencjalnego leada niż go przegapić, jeśli istnieje jakakolwiek szansa na wpływ na decyzję zakupową.";
  
  return {
    brief,
    positiveDescriptions,
    negativeDescriptions,
    aiRole,
    positiveThreshold,
    generalGuidelines: [
      "Twoim zadaniem jest ocenić, czy dana osoba może użyć produktu w swojej pracy lub ma wpływ na decyzję zakupową.",
      "Używaj briefu strategicznego jako głównego źródła kontekstu biznesowego - tam znajdziesz informacje o produkcie, odbiorcach i logice decyzyjnej.",
      thresholdGuidance,
      "FILOZOFIA BIZNESOWA: W kontekście B2B lepiej dodać potencjalnego leada niż go przegapić. Jeśli rola ma jakikolwiek związek z projektowaniem, sprzedażą, zarządzaniem projektami lub decyzjami zakupowymi w kontekście biznesowym - rozważ pozytywną klasyfikację.",
      "Jeśli rola dotyczy wsparcia (księgowość, logistyka, IT support) i nie może użyć produktu w pracy ani nie ma wpływu na decyzję, wybierz 'negative'.",
      "Dla stanowisk niepewnych: jeśli istnieje jakakolwiek szansa na wpływ biznesowy, użyj score bliskiego progowi (lub powyżej, jeśli próg niski) i rozważ 'positive'.",
    ],
  };
}

const SENIORITY_ORDER = [
  "intern",
  "entry",
  "junior",
  "mid",
  "senior",
  "manager",
  "director",
  "vp",
  "c_suite",
  "founder",
  "owner",
  "partner",
  "principal",
  "executive",
];

const keywordSynonyms: Record<string, string[]> = {
  "sprzedaż": ["sales", "business development", "bd", "bdm"],
  "sales": ["sprzedaż", "selling", "sales"],
  "account": ["account", "key account"],
  "marketing": ["marketing", "digital marketing"],
  "designer": ["designer", "design", "projektant", "grafik", "3d designer", "visual designer"],
  "projektant": ["designer", "design", "projekt", "projektant"],
  "zarządzanie": ["management", "manager"],
  "logistics": ["logistics", "logistyka"],
  "quality": ["quality", "jakości", "kontroli jakości"],
  "bhp": ["bhp", "health & safety"],
  "security": ["security", "ppoż"],
};

// Usunięto globalne reguły hardcoded - weryfikacja opiera się na briefie i konfiguracji

const GENERIC_ROLE_TOKENS = new Set([
  "specialist",
  "specjalista",
  "manager",
  "menedzer",
  "menadzer",
  "coordinator",
  "koordynator",
  "assistant",
  "asystent",
  "associate",
  "consultant",
  "expert",
  "administrator",
  "worker",
  "employee",
  "staff",
  "partner",
  "member",
]);

function normalizeSeniority(value?: string | null) {
  if (!value) return null;
  return value.toLowerCase();
}

/**
 * Wykrywa słowa w tytule wskazujące na wyższy poziom seniority
 * i zwraca odpowiedni poziom seniority
 */
function detectSeniorityFromTitle(title?: string | null): string | null {
  if (!title) return null;
  const titleLower = title.toLowerCase();
  
  // Słowa wskazujące na bardzo wysoki poziom
  if (/starszy|senior|główny|głowny|chief|head|lead|principal|executive|dyrektor|director|vp|vice president|c-level|c_suite/i.test(titleLower)) {
    return "senior"; // Zwracamy "senior" jako minimum dla takich tytułów
  }
  
  // Słowa wskazujące na średni poziom
  if (/mid|middle|średni|koordynator|coordinator/i.test(titleLower)) {
    return "mid";
  }
  
  return null; // Nie wykryto - użyj seniority z Apollo
}

function meetsSeniorityRequirement(
  personSeniority?: string | null, 
  minSeniority?: string | null,
  personTitle?: string | null // Dodajemy tytuł do sprawdzenia
) {
  if (!minSeniority) return true;
  const normalizedMin = normalizeSeniority(minSeniority);
  if (!normalizedMin) return true;

  const minIndex = SENIORITY_ORDER.indexOf(normalizedMin);
  if (minIndex === -1) return true;

  // Sprawdź czy tytuł sugeruje wyższy poziom seniority
  const titleBasedSeniority = detectSeniorityFromTitle(personTitle);
  if (titleBasedSeniority) {
    const titleIndex = SENIORITY_ORDER.indexOf(titleBasedSeniority);
    if (titleIndex !== -1 && titleIndex >= minIndex) {
      return true; // Tytuł sugeruje wystarczający poziom
    }
  }

  const normalizedPerson = normalizeSeniority(personSeniority);
  if (!normalizedPerson) return true;
  const personIndex = SENIORITY_ORDER.indexOf(normalizedPerson);
  if (personIndex === -1) return true;

  return personIndex >= minIndex;
}

interface TitleMatchContext {
  raw: string;
  title: string;
  normalized: string;
  english: string;
  tokens: string[];
  combined: string;
  departments: string[];
  seniority?: string | null;
}

function buildTitleMatchContext(person: PersonaVerificationAIInputPerson): TitleMatchContext {
  const raw = person.title ?? "";
  const title = raw.toLowerCase();
  const normalized = person.titleNormalized?.toLowerCase() ?? title;
  const english = person.titleEnglish?.toLowerCase() ?? normalized;
  const tokens = Array.from(
    new Set(
      [title, normalized, english]
        .join(" ")
        .split(/[^a-zA-Z0-9ąćęłńóśźżÄÖÜäöüß]+/)
        .filter(Boolean)
    )
  );
  const combined = `${title} ${normalized} ${english}`.trim();
  const departments = Array.isArray(person.departments)
    ? person.departments.map((dep) => dep.toLowerCase())
    : [];

  return {
    raw,
    title,
    normalized,
    english,
    tokens,
    combined,
    departments,
    seniority: person.seniority ?? null,
  };
}

interface RoleMatchResult {
  role: PersonaRoleConfig;
  keyword?: string;
  matchType?: string;
}

function expandRoleKeywords(role: PersonaRoleConfig) {
  const baseKeywords = (role.keywords ?? []).map((kw) => kw.toLowerCase());
  const labelKeywords = (role.label || "")
    .toLowerCase()
    .split(/[^a-z0-9ąćęłńóśźżÄÖÜäöüß]+/)
    .filter((word) => word.length > 2 && !GENERIC_ROLE_TOKENS.has(word));

  const merged = [...baseKeywords, ...labelKeywords];
  const expanded = merged.flatMap((kw) => [kw, ...(keywordSynonyms[kw] ?? [])]);
  return Array.from(new Set(expanded.filter(Boolean)));
}

function testKeywordMatch(
  keyword: string,
  context: TitleMatchContext,
  matchType: PersonaRoleConfig["matchType"]
) {
  if (!keyword) return false;
  const lowered = keyword.toLowerCase();

  if (matchType === "exact") {
    return (
      context.title === lowered ||
      context.normalized === lowered ||
      context.english === lowered ||
      context.tokens.includes(lowered)
    );
  }

  if (matchType === "regex") {
    try {
      const regex = new RegExp(keyword, "i");
      return regex.test(context.raw) || regex.test(context.combined);
    } catch {
      return false;
    }
  }

  return context.combined.includes(lowered);
}

function departmentsMatch(personDepartments: string[], role: PersonaRoleConfig) {
  const requiredDepartments = (role.departments ?? []).map((dep) => dep.toLowerCase());
  if (!requiredDepartments.length) {
    return true;
  }
  if (!personDepartments.length) {
    return true;
  }
  return requiredDepartments.some((dep) => personDepartments.includes(dep));
}

function findMatchingRole(
  person: PersonaVerificationAIInputPerson,
  roles: PersonaRoleConfig[]
): RoleMatchResult | null {
  if (!roles.length) return null;

  const context = buildTitleMatchContext(person);

  for (const role of roles) {
    if (!meetsSeniorityRequirement(context.seniority, role.minSeniority, context.raw)) {
      continue;
    }

    const keywords = expandRoleKeywords(role);
    const matchType = role.matchType ?? "contains";
    const matchedKeyword = keywords.find((keyword) =>
      testKeywordMatch(keyword, context, matchType)
    );

    if (!matchedKeyword) {
      continue;
    }

    if (!departmentsMatch(context.departments, role)) {
      continue;
    }

    return { role, keyword: matchedKeyword, matchType };
  }

  return null;
}

function findGlobalKeywordMatch(context: TitleMatchContext, keywords: string[]) {
  for (const keyword of keywords) {
    const lowered = keyword.toLowerCase();
    if (context.combined.includes(lowered)) {
      return keyword;
    }
  }
  return null;
}

export interface PersonaRuleClassification {
  decision: PersonaDecision;
  reason: string;
  source: "positive-rule" | "negative-rule" | "positive-global" | "negative-global";
  matchedRole?: PersonaRoleConfig;
  matchedKeyword?: string;
}

/**
 * Zwraca pełny prompt jako tekst (do wyświetlenia w UI)
 */
export function getFullPromptText(personaCriteria: PersonaCriteriaDto, brief?: PersonaBriefContext): string {
  const prompt = buildPrompt(personaCriteria, brief);
  
  // Pobierz próg klasyfikacji (domyślnie 50%) - potrzebny w prompcie
  const positiveThreshold = brief?.positiveThreshold ?? 0.5;
  const isLowThreshold = positiveThreshold <= 0.5; // 50% lub mniej = bardziej pozytywne

  const briefSection = brief
    ? `KONTEKST BIZNESOWY I BRIEF STRATEGICZNY:
${brief.summary ? `KONTEKST BIZNESOWY (produkt, odbiorcy, logika decyzyjna):
${brief.summary}` : "KONTEKST BIZNESOWY: (brak)"}

Wskazówki decyzyjne:
${(brief.decisionGuidelines || [])
        .map((rule, index) => `${index + 1}. ${rule}`)
        .join("\n") || "(brak)"}
Przykładowe persony (pozytywne): ${(brief.targetProfiles || []).join(", ") || "(brak)"}
Przykładowe persony (unikaj): ${(brief.avoidProfiles || []).join(", ") || "(brak)"}
${brief.additionalNotes ? `Dodatkowe notatki: ${brief.additionalNotes}` : ""}`
    : "KONTEKST BIZNESOWY I BRIEF STRATEGICZNY: (brak - weryfikuj na podstawie reguł)";

  const systemPrompt = [
    `Jesteś ${prompt.aiRole}.`,
        "Zwracasz odpowiedź wyłącznie w formacie JSON: {\"results\":[{\"matchKey\":\"...\",\"decision\":\"positive|negative\",\"score\":0.0-1.0,\"reason\":\"...\"}]}.",
        "Pole 'matchKey' MUSI być zapełnione dla każdego rekordu.",
        "Pole 'score' MUSI być liczbą z zakresu 0.0-1.0 dla KAŻDEJ decyzji (zarówno pozytywnej jak i negatywnej) - to jest wymagane. NIGDY nie zwracaj null lub undefined dla score.",
        "Pole 'reason' MUSI zawierać konkretne, biznesowe uzasadnienie – bez odniesień do poziomów typu junior/senior (chyba że w danych otrzymasz minimalny poziom seniority).",
    "⚠️ KRYTYCZNE: W uzasadnieniu ('reason') NIE WYMYŚLAJ informacji o działach, firmach, kontekście - używaj TYLKO danych które otrzymałeś w polu 'departments' lub innych polach pracownika. Jeśli w danych NIE MA informacji o dziale - NIE PISZ o dziale w uzasadnieniu!",
    "Jeśli otrzymasz sprzeczne reguły, priorytet mają zasady oznaczone jako MUSI/MUST w wiadomości użytkownika.",
    "",
    "WAŻNE - TŁUMACZENIE STANOWISK:",
    "- Przed analizą stanowiska, PRZETŁUMACZ tytuł na język polski (lub angielski jeśli to pomoże w rozpoznaniu)",
    "- Rozpoznawaj synonimy: 'Head of Production' = 'Kierownik produkcji', 'Vice President' = 'Wiceprezes', 'Senior Project Manager' = 'Starszy Kierownik Projektu'",
    "- Nie analizuj tytułów literalnie - najpierw zrozum ich znaczenie w kontekście biznesowym",
    "- Jeśli tytuł jest w języku obcym (niemiecki, francuski, etc.), przetłumacz go przed analizą",
  ].join("\n");

  const userPrompt = [
    "⚠️ KRYTYCZNE - ZAWSZE NAJPIERW:",
    "1. PRZETŁUMACZ tytuł stanowiska na język polski (lub angielski) jeśli jest w innym języku",
    "2. ROZPOZNAJ synonimy (np. 'Head of Production' = 'Kierownik produkcji', 'Vice President' = 'Wiceprezes', 'CAD' = 'projektowanie')",
    "3. ⚠️ NIE WYMYŚLAJ informacji o działach - używaj TYLKO danych z pola 'departments' w danych pracownika. Jeśli w danych NIE MA informacji o dziale - NIE PISZ o dziale w uzasadnieniu!",
    "",
    briefSection,
    "",
    "ZASADY OGÓLNE:",
    ...prompt.generalGuidelines.map((guideline) => `- ${guideline}`),
    "",
    "🎯 GŁÓWNA ZASADA: Brief strategiczny jest NAJWAŻNIEJSZYM źródłem kontekstu biznesowego. Wszystkie decyzje powinny być oparte na kontekście biznesowym z briefu.",
    "",
    "INFORMACJA POMOCNICZA - Konfiguracja person (tylko jako dodatkowa informacja, nie priorytet):",
    "Poniższe role są przekazywane jako informacja pomocnicza. Możesz je wykorzystać jako wskazówkę, ale PRIORYTET MA ZAWSZE BRIEF STRATEGICZNY.",
    "",
    "Pozytywne role (z konfiguracji - informacja pomocnicza):",
    JSON.stringify(prompt.positiveDescriptions, null, 2),
    "",
    "Negatywne role (z konfiguracji - informacja pomocnicza):",
    JSON.stringify(prompt.negativeDescriptions, null, 2),
    "",
    "REGUŁY KLASYFIKACJI (w kolejności priorytetu - sprawdzaj od góry do dołu):",
    "",
    "PRIORYTET 1: Brief strategiczny - to jest GŁÓWNE źródło kontekstu biznesowego",
    "   - Oceń każde stanowisko na podstawie kontekstu biznesowego z briefu",
    "   - Sprawdź czy stanowisko pasuje do 'Przykładowe persony (pozytywne)' z briefu",
    "   - Sprawdź czy stanowisko pasuje do 'Przykładowe persony (unikaj)' z briefu",
    "   - Zastosuj 'Wskazówki decyzyjne' z briefu",
    "   - Oceń czy osoba może użyć produktu/usługi w swojej pracy (zgodnie z kontekstem biznesowym)",
    "   - Oceń czy ma wpływ na decyzję zakupową (zgodnie z kontekstem biznesowym)",
    "   - Oceń czy może szerzyć wiedzę o produktach wewnątrz firmy (zgodnie z kontekstem biznesowym)",
    "",
    "PRIORYTET 2: Analiza ogólna (tylko jeśli brief nie daje jednoznacznej odpowiedzi)",
    "   - Jeśli brief nie daje jednoznacznej odpowiedzi, oceń na podstawie ogólnych zasad biznesowych",
    "   - Jeśli nie jesteś pewien, ale istnieje jakakolwiek szansa na wpływ biznesowy zgodny z briefem → użyj score bliskiego progowi i rozważ 'positive' (lepiej dodać niż przegapić)",
    `   - PRÓG KLASYFIKACJI: ${(positiveThreshold * 100).toFixed(0)}% - jeśli score ≥ ${(positiveThreshold * 100).toFixed(0)}%, decyzja będzie pozytywna`,
    `   - ${isLowThreshold ? "Próg jest niski - bądź bardziej skłonny do pozytywnych decyzji dla stanowisk niepewnych" : "Próg jest wyższy - bądź bardziej restrykcyjny, ale nadal pamiętaj o filozofii 'lepiej dodać niż przegapić'"}`,
    "",
    "SENIORITY:",
    "   - Bierz pod uwagę TYLKO wtedy, gdy rola ma zdefiniowane 'minSeniority' w konfiguracji",
    "   - Jeśli rola NIE ma 'minSeniority' → całkowicie ignoruj seniority",
    "   - WAŻNE: Jeśli tytuł zawiera słowa jak 'starszy', 'senior', 'główny', 'chief', 'head', 'lead', 'dyrektor', 'director' - traktuj to jako wyższy poziom seniority (co najmniej 'senior'), nawet jeśli seniority z danych wskazuje na niższy poziom (np. 'entry').",
    "",
    "UWAGA: Podczas rzeczywistej weryfikacji, na końcu promptu dodawane są dane pracowników do analizy.",
  ].join("\n");

  return `=== PROMPT SYSTEMOWY ===\n\n${systemPrompt}\n\n=== PROMPT UŻYTKOWNIKA ===\n\n${userPrompt}`;
}

export function classifyPersonByRules(
  person: PersonaVerificationAIInputPerson,
  personaCriteria: PersonaCriteriaDto
): PersonaRuleClassification | null {
  const positiveRoles = personaCriteria.positiveRoles ?? [];
  const negativeRoles = personaCriteria.negativeRoles ?? [];
  const context = buildTitleMatchContext(person);

  const positiveMatch = findMatchingRole(person, positiveRoles);
  if (positiveMatch) {
    const label = positiveMatch.role.label?.trim() || "pozytywna rola";
    const reasonParts = [`Stanowisko pasuje do pozytywnej reguły "${label}".`];
    if (positiveMatch.keyword) {
      reasonParts.push(`Dopasowanie po słowie kluczowym "${positiveMatch.keyword}".`);
    }
    if (positiveMatch.role.minSeniority) {
      reasonParts.push(`Minimalny poziom seniority: ${positiveMatch.role.minSeniority}.`);
    }
    return {
      decision: "positive",
      reason: `(reguła) ${reasonParts.join(" ")}`,
      source: "positive-rule",
      matchedRole: positiveMatch.role,
      matchedKeyword: positiveMatch.keyword,
    };
  }

  const negativeMatch = findMatchingRole(person, negativeRoles);
  if (negativeMatch) {
    const label = negativeMatch.role.label?.trim() || "negatywna rola";
    const reasonParts = [`Stanowisko pasuje do negatywnej reguły "${label}".`];
    if (negativeMatch.keyword) {
      reasonParts.push(`Dopasowanie po słowie kluczowym "${negativeMatch.keyword}".`);
    }
    return {
      decision: "negative",
      reason: `(reguła) ${reasonParts.join(" ")}`,
      source: "negative-rule",
      matchedRole: negativeMatch.role,
      matchedKeyword: negativeMatch.keyword,
    };
  }

  // Usunięto globalne reguły hardcoded - weryfikacja opiera się na briefie i konfiguracji
  return null;
}

export async function verifyEmployeesWithAI(
  personaCriteria: PersonaCriteriaDto,
  employees: PersonaVerificationAIInputPerson[],
  brief?: PersonaBriefContext,
  useCache: boolean = true, // Opcja wyłączenia cache (domyślnie włączona)
  model: "gpt-4o-mini" | "gpt-4o" = "gpt-4o-mini", // Model AI do użycia
  saveToCache: boolean = true // Opcja wyłączenia zapisu do cache (domyślnie włączona)
): Promise<PersonaVerificationAIResponse> {
  if (!employees.length) {
    return { results: [] };
  }

  // Sprawdź cache dla każdego stanowiska (jeśli cache jest włączony)
  const cachedResults: Map<string, PersonaVerificationAIResult> = new Map();
  const employeesToVerify: PersonaVerificationAIInputPerson[] = [];

  if (useCache) {
    for (const person of employees) {
      const titleNormalized = (person.titleNormalized || person.title || "").toLowerCase();
      if (!titleNormalized) {
        // Jeśli brak tytułu, zawsze weryfikuj przez AI
        employeesToVerify.push(person);
        continue;
      }

      const cacheKey = {
        personaCriteriaId: personaCriteria.id,
        titleNormalized,
        titleEnglish: person.titleEnglish?.toLowerCase() || null,
        departments: Array.isArray(person.departments) ? person.departments : null,
        seniority: person.seniority || null,
      };

      const cached = await getCachedTitleDecision(cacheKey);
      if (cached) {
        // Użyj wyniku z cache
        const matchKey = person.matchKey || (person.id ? String(person.id) : undefined);
        if (matchKey) {
          cachedResults.set(matchKey.toLowerCase(), {
            id: person.id,
            matchKey,
            decision: cached.decision,
            score: cached.score ?? null, // Zachowaj null jeśli score nie istnieje
            reason: cached.reason || "",
          });
          logger.info("persona-criteria-ai", "Cache hit - użyto zapisanej decyzji", {
            personaCriteriaId: personaCriteria.id,
            titleNormalized,
            decision: cached.decision,
            score: cached.score,
          });
        }
      } else {
        // Nie ma w cache - trzeba zweryfikować przez AI
        employeesToVerify.push(person);
      }
    }
  } else {
    // Cache wyłączony - weryfikuj wszystkie
    employeesToVerify.push(...employees);
  }

  // Jeśli wszystkie stanowiska są w cache, zwróć wyniki z cache
  if (employeesToVerify.length === 0) {
    logger.info("persona-criteria-ai", "Wszystkie stanowiska były w cache - brak weryfikacji przez AI", {
      personaCriteriaId: personaCriteria.id,
      totalEmployees: employees.length,
      cachedCount: cachedResults.size,
    });
    return {
      results: Array.from(cachedResults.values()),
    };
  }
  
  logger.info("persona-criteria-ai", "Weryfikacja przez AI", {
    personaCriteriaId: personaCriteria.id,
    totalEmployees: employees.length,
    cachedCount: cachedResults.size,
    toVerifyCount: employeesToVerify.length,
  });

  // Sprawdź czy jest zapisany prompt w brief
  let savedPrompt: string | null = null;
  if (brief && brief.generatedPrompt) {
    savedPrompt = brief.generatedPrompt;
    logger.info("persona-criteria-ai", "Używam zapisanego promptu z bazy", {
      personaCriteriaId: personaCriteria.id,
      promptLength: savedPrompt.length,
    });
  } else {
    logger.info("persona-criteria-ai", "Brak zapisanego promptu - będzie wygenerowany dynamicznie", {
      personaCriteriaId: personaCriteria.id,
    });
  }

  const prompt = buildPrompt(personaCriteria, brief);

  const employeesForAI = employeesToVerify.map((person) => ({
    id: person.id ? String(person.id) : undefined,
    matchKey: person.matchKey,
    name: person.name,
    title: person.title,
    titleNormalized: person.titleNormalized,
    titleEnglish: person.titleEnglish,
    departments: Array.isArray(person.departments) ? person.departments : [],
    seniority: person.seniority ?? null,
    emailStatus: person.emailStatus ?? null,
    managesPeople: person.managesPeople ?? false,
    managesProcesses: person.managesProcesses ?? false,
    isExecutive: person.isExecutive ?? false,
    semanticHint: person.semanticHint ?? null,
  }));

  // Przygotuj messages - użyj zapisanego promptu jeśli istnieje, w przeciwnym razie wygeneruj dynamicznie
  let messages: Array<{ role: "system" | "user"; content: string }>;
  
  if (savedPrompt) {
    // Parsuj zapisany prompt (format: "=== PROMPT SYSTEMOWY ===\n\n[system]\n\n=== PROMPT UŻYTKOWNIKA ===\n\n[user]")
    const promptParts = savedPrompt.split("=== PROMPT UŻYTKOWNIKA ===");
    const systemPromptText = promptParts[0]?.replace("=== PROMPT SYSTEMOWY ===", "").trim() || "";
    const userPromptBase = promptParts[1]?.trim() || "";
    
    // Dodaj dane pracowników do user prompt
    const userPromptWithEmployees = [
      userPromptBase,
      "",
      "Dane pracowników (id, matchKey, title, titleNormalized, titleEnglish, departments, semanticHint, flagi managesPeople/managesProcesses/isExecutive):",
      JSON.stringify(employeesForAI, null, 2),
      "",
      "Odpowiedz wyłącznie JSON-em zgodnym ze specyfikacją.",
    ].join("\n");
    
    messages = [
      {
        role: "system" as const,
        content: systemPromptText,
      },
      {
        role: "user" as const,
        content: userPromptWithEmployees,
      },
    ];
    
    logger.info("persona-criteria-ai", "Używam zapisanego promptu z bazy", {
      personaCriteriaId: personaCriteria.id,
      systemPromptLength: systemPromptText.length,
      userPromptLength: userPromptWithEmployees.length,
    });
  } else {
    // Fallback: generuj dynamicznie (dla kompatybilności wstecznej)
    const positiveThreshold = brief?.positiveThreshold ?? 0.5;
    const isLowThreshold = positiveThreshold <= 0.5;

  const briefSection = brief
      ? `KONTEKST BIZNESOWY I BRIEF STRATEGICZNY:
${brief.summary ? `KONTEKST BIZNESOWY (produkt, odbiorcy, logika decyzyjna):
${brief.summary}` : "KONTEKST BIZNESOWY: (brak)"}

Wskazówki decyzyjne:
${(brief.decisionGuidelines || [])
        .map((rule, index) => `${index + 1}. ${rule}`)
        .join("\n") || "(brak)"}
Przykładowe persony (pozytywne): ${(brief.targetProfiles || []).join(", ") || "(brak)"}
Przykładowe persony (unikaj): ${(brief.avoidProfiles || []).join(", ") || "(brak)"}
${brief.additionalNotes ? `Dodatkowe notatki: ${brief.additionalNotes}` : ""}`
      : "KONTEKST BIZNESOWY I BRIEF STRATEGICZNY: (brak - weryfikuj na podstawie reguł)";

    messages = [
    {
      role: "system" as const,
      content: [
        `Jesteś ${prompt.aiRole}.`,
        "Zwracasz odpowiedź wyłącznie w formacie JSON: {\"results\":[{\"matchKey\":\"...\",\"decision\":\"positive|negative\",\"score\":0.0-1.0,\"reason\":\"...\"}]}.",
        "Pole 'matchKey' MUSI być zapełnione dla każdego rekordu.",
        "Pole 'score' MUSI być liczbą z zakresu 0.0-1.0 dla KAŻDEJ decyzji (zarówno pozytywnej jak i negatywnej) - to jest wymagane.",
        "Pole 'reason' MUSI zawierać konkretne, biznesowe uzasadnienie – bez odniesień do poziomów typu junior/senior (chyba że w danych otrzymasz minimalny poziom seniority).",
        "Jeśli otrzymasz sprzeczne reguły, priorytet mają zasady oznaczone jako MUSI/MUST w wiadomości użytkownika.",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        "⚠️ KRYTYCZNE - ZAWSZE NAJPIERW:",
        "1. PRZETŁUMACZ tytuł stanowiska na język polski (lub angielski) jeśli jest w innym języku",
        "2. ROZPOZNAJ synonimy (np. 'Head of Production' = 'Kierownik produkcji', 'Vice President' = 'Wiceprezes', 'CAD' = 'projektowanie')",
        "3. ⚠️ NIE WYMYŚLAJ informacji o działach - używaj TYLKO danych z pola 'departments' w danych pracownika. Jeśli w danych NIE MA informacji o dziale - NIE PISZ o dziale w uzasadnieniu!",
        "",
        briefSection,
        "",
        "ZASADY OGÓLNE:",
        ...prompt.generalGuidelines.map((guideline) => `- ${guideline}`),
        "",
        "🎯 GŁÓWNA ZASADA: Brief strategiczny jest NAJWAŻNIEJSZYM źródłem kontekstu biznesowego. Wszystkie decyzje powinny być oparte na kontekście biznesowym z briefu.",
        "",
        "INFORMACJA POMOCNICZA - Konfiguracja person (tylko jako dodatkowa informacja, nie priorytet):",
        "Poniższe role są przekazywane jako informacja pomocnicza. Możesz je wykorzystać jako wskazówkę, ale PRIORYTET MA ZAWSZE BRIEF STRATEGICZNY.",
        "",
        "Pozytywne role (z konfiguracji - informacja pomocnicza):",
        JSON.stringify(prompt.positiveDescriptions, null, 2),
        "",
        "Negatywne role (z konfiguracji - informacja pomocnicza):",
        JSON.stringify(prompt.negativeDescriptions, null, 2),
        "",
        "REGUŁY KLASYFIKACJI (w kolejności priorytetu - sprawdzaj od góry do dołu):",
        "",
        "PRIORYTET 1: Brief strategiczny - to jest GŁÓWNE źródło kontekstu biznesowego",
        "   - Oceń każde stanowisko na podstawie kontekstu biznesowego z briefu",
        "   - Sprawdź czy stanowisko pasuje do 'Przykładowe persony (pozytywne)' z briefu",
        "   - Sprawdź czy stanowisko pasuje do 'Przykładowe persony (unikaj)' z briefu",
        "   - Zastosuj 'Wskazówki decyzyjne' z briefu",
        "   - Oceń czy osoba może użyć produktu/usługi w swojej pracy (zgodnie z kontekstem biznesowym)",
        "   - Oceń czy ma wpływ na decyzję zakupową (zgodnie z kontekstem biznesowym)",
        "   - Oceń czy może szerzyć wiedzę o produktach wewnątrz firmy (zgodnie z kontekstem biznesowym)",
        "",
        "PRIORYTET 2: Analiza ogólna (tylko jeśli brief nie daje jednoznacznej odpowiedzi)",
        "   - Jeśli brief nie daje jednoznacznej odpowiedzi, oceń na podstawie ogólnych zasad biznesowych",
        "   - Jeśli nie jesteś pewien, ale istnieje jakakolwiek szansa na wpływ biznesowy zgodny z briefem → użyj score bliskiego progowi i rozważ 'positive' (lepiej dodać niż przegapić)",
        `   - PRÓG KLASYFIKACJI: ${(positiveThreshold * 100).toFixed(0)}% - jeśli score ≥ ${(positiveThreshold * 100).toFixed(0)}%, decyzja będzie pozytywna`,
        `   - ${isLowThreshold ? "Próg jest niski - bądź bardziej skłonny do pozytywnych decyzji dla stanowisk niepewnych" : "Próg jest wyższy - bądź bardziej restrykcyjny, ale nadal pamiętaj o filozofii 'lepiej dodać niż przegapić'"}`,
        "",
        "SENIORITY:",
        "   - Bierz pod uwagę TYLKO wtedy, gdy rola ma zdefiniowane 'minSeniority' w konfiguracji",
        "   - Jeśli rola NIE ma 'minSeniority' → całkowicie ignoruj seniority",
        "   - WAŻNE: Jeśli tytuł zawiera słowa jak 'starszy', 'senior', 'główny', 'chief', 'head', 'lead', 'dyrektor', 'director' - traktuj to jako wyższy poziom seniority (co najmniej 'senior'), nawet jeśli seniority z danych wskazuje na niższy poziom (np. 'entry').",
        "",
        "Dane pracowników (id, matchKey, title, titleNormalized, titleEnglish, departments, semanticHint, flagi managesPeople/managesProcesses/isExecutive):",
        JSON.stringify(employeesForAI, null, 2),
        "",
        "Odpowiedz wyłącznie JSON-em zgodnym ze specyfikacją.",
      ].join("\n"),
    },
  ];
    
    logger.info("persona-criteria-ai", "Generuję prompt dynamicznie (brak zapisanego promptu)", {
      personaCriteriaId: personaCriteria.id,
    });
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000, // 60 sekund timeout dla pojedynczego requestu
    maxRetries: 3, // Maksymalnie 3 próby
  });

  // Funkcja retry z obsługą rate limit i timeout
  const callAIWithRetry = async (maxRetries = 3): Promise<any> => {
    let requestParams: any = {
    model: model, // Użyj wybranego modelu
    messages,
      temperature: 0.4,
      max_tokens: 4000, // Zwiększony limit, aby uniknąć obcięcia odpowiedzi
    };
    
    // Spróbuj z response_format (jeśli model obsługuje)
    requestParams.response_format = { type: "json_object" };
    let triedWithoutFormat = false;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await openai.chat.completions.create(requestParams);
        return response;
      } catch (error: any) {
        // Jeśli błąd związany z response_format, spróbuj bez niego (tylko raz)
        if (!triedWithoutFormat && 
            (error?.message?.includes("response_format") || error?.code === "invalid_request_error") && 
            requestParams.response_format) {
          logger.warn("persona-verification-ai", "Model nie obsługuje response_format, próbuję bez niego", {
            personaCriteriaId: personaCriteria.id,
            employeesCount: employeesToVerify.length,
          });
          delete requestParams.response_format;
          triedWithoutFormat = true;
          continue; // Spróbuj ponownie bez response_format
        }
        
        // Sprawdź czy to błąd rate limit (429)
        if (error?.status === 429 || error?.message?.includes("Rate limit") || error?.message?.includes("429")) {
          // Wyciągnij informację o czasie oczekiwania z komunikatu błędu
          const retryAfterMatch = error?.message?.match(/try again in (\d+)ms/i) || error?.headers?.["retry-after"];
          const retryAfterMs = retryAfterMatch 
            ? (typeof retryAfterMatch === "string" ? parseInt(retryAfterMatch, 10) : retryAfterMatch)
            : (attempt + 1) * 2000; // Exponential backoff: 2s, 4s, 6s

          if (attempt < maxRetries - 1) {
            logger.warn("persona-verification-ai", `Rate limit osiągnięty, czekam ${retryAfterMs}ms przed retry (próba ${attempt + 1}/${maxRetries})`, {
              employeesCount: employees.length,
              personaCriteriaId: personaCriteria.id,
              retryAfterMs,
            });
            await new Promise((resolve) => setTimeout(resolve, retryAfterMs + 1000)); // Dodajemy 1s buffer
            continue; // Retry
          } else {
            throw new Error(`Rate limit: Przekroczono limit po ${maxRetries} próbach. ${error.message}`);
          }
        }
        
        // Sprawdź czy to timeout
        if (error?.message?.includes("timeout") || error?.code === "ETIMEDOUT" || error?.code === "ECONNABORTED") {
          if (attempt < maxRetries - 1) {
            const backoffMs = (attempt + 1) * 3000; // Exponential backoff: 3s, 6s, 9s
            logger.warn("persona-verification-ai", `Timeout, czekam ${backoffMs}ms przed retry (próba ${attempt + 1}/${maxRetries})`, {
              employeesCount: employees.length,
              personaCriteriaId: personaCriteria.id,
            });
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue; // Retry
          } else {
            throw new Error(`Timeout: Przekroczono limit czasu po ${maxRetries} próbach. ${error.message}`);
          }
        }
        
        // Jeśli to inny błąd - rzuć go dalej
        throw error;
      }
    }
    throw new Error("Przekroczono maksymalną liczbę prób");
  };

  const response = await callAIWithRetry();

  if (response.usage) {
    logger.info("persona-criteria-ai", "Zużycie tokenów w weryfikacji person", {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
    });
    
    // Zapisz zużycie tokenów do bazy danych
    try {
      const { trackTokenUsage } = await import("./tokenTracker");
      await trackTokenUsage({
        operation: "persona_verification",
        model: "gpt-4o-mini",
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        metadata: {
          employeesCount: employees.length,
          personaCriteriaId: personaCriteria.id,
        },
      });
    } catch (error) {
      // Nie przerywaj wykonania jeśli tracking się nie powiedzie
      logger.error("persona-criteria-ai", "Błąd zapisu zużycia tokenów", { error });
    }
  }

  let content = response.choices[0]?.message?.content || "";
  const originalContent = content; // Zachowaj oryginalną treść do logowania
  
  if (!content || content.trim().length === 0) {
    logger.error("persona-criteria-ai", "Pusta odpowiedź z AI", {
      personaCriteriaId: personaCriteria.id,
      employeesCount: employeesToVerify.length,
    });
    throw new Error("Pusta odpowiedź z AI");
  }
  
  content = content.trim();
  
  // Usuń markdown code blocks jeśli istnieją
  if (content.startsWith("```")) {
    content = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  
  // Spróbuj wyciągnąć JSON z odpowiedzi, jeśli jest otoczony tekstem
  // Często AI dodaje komentarze przed/po JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    content = jsonMatch[0];
  }
 
   try {
     const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Odpowiedź AI nie jest obiektem JSON");
    }
    
    if (!Array.isArray(parsed.results)) {
      logger.error("persona-criteria-ai", "Brak pola results w odpowiedzi AI", {
        personaCriteriaId: personaCriteria.id,
        employeesCount: employeesToVerify.length,
        parsedKeys: Object.keys(parsed),
        contentPreview: originalContent.substring(0, 500),
        parsedPreview: JSON.stringify(parsed).substring(0, 500),
      });
      throw new Error("Brak pola results w odpowiedzi AI");
    }

    const results = parsed.results.map((item: any) => {
        const matchKey = typeof item.matchKey === "string" && item.matchKey.trim().length ? item.matchKey : undefined;
        const rawDecision = typeof item.decision === "string" ? item.decision.toLowerCase() : "negative";
        const decision: PersonaDecision = ["positive", "negative"].includes(rawDecision)
          ? (rawDecision as PersonaDecision)
          : "negative";
        // Walidacja score - jeśli brak, użyj domyślnego na podstawie decyzji
        let score: number | null = null;
        if (typeof item.score === "number" && !isNaN(item.score)) {
          score = Math.max(0, Math.min(1, item.score));
        } else {
          // Jeśli brak score, użyj domyślnego na podstawie decyzji
          // Loguj to jako problem, ale nie przerywaj procesu
          logger.warn("persona-criteria-ai", "Brak score w odpowiedzi AI - używam domyślnego", {
            personaCriteriaId: personaCriteria.id,
            matchKey,
            decision,
            itemScore: item.score,
          });
          // Domyślny score: 1.0 dla positive, 0.0 dla negative
          score = decision === "positive" ? 1.0 : 0.0;
        }
        return {
          id: item.id,
          matchKey,
          decision,
          score,
          reason: item.reason || "",
        };
    });
    
    // Sprawdź czy wszystkie wyniki mają score
    const resultsWithoutScore = results.filter(r => r.score === null);
    if (resultsWithoutScore.length > 0) {
      logger.error("persona-criteria-ai", "Niektóre wyniki nie mają score po walidacji", {
        personaCriteriaId: personaCriteria.id,
        resultsWithoutScoreCount: resultsWithoutScore.length,
        totalResults: results.length,
      });
    }

    // Zapisz wyniki do cache (tylko te, które były weryfikowane przez AI) - tylko jeśli saveToCache = true
    // Mapuj wyniki z powrotem do employeesToVerify, aby zapisać cache
    const cachePromises: Promise<void>[] = [];
    
    if (!saveToCache) {
      logger.info("persona-criteria-ai", "Pomijam zapis cache (saveToCache = false)", {
        personaCriteriaId: personaCriteria.id,
        resultsCount: results.length,
      });
    } else {
      logger.info("persona-criteria-ai", "Rozpoczynam zapis cache", {
        personaCriteriaId: personaCriteria.id,
        resultsCount: results.length,
        employeesToVerifyCount: employeesToVerify.length,
      });
    }
    let matchedCount = 0;
    let skippedNoEmployee = 0;
    let skippedNoTitle = 0;
    
    for (const result of results) {
      // Pomiń zapis do cache jeśli saveToCache = false
      if (!saveToCache) {
        continue;
      }
      
      const employee = employeesToVerify.find((emp) => {
        const empMatchKey = emp.matchKey || (emp.id ? String(emp.id) : undefined);
        const resultMatchKey = result.matchKey || result.id;
        return empMatchKey && resultMatchKey && empMatchKey.toLowerCase() === resultMatchKey.toLowerCase();
      });

      if (employee) {
        matchedCount++;
        const titleNormalized = (employee.titleNormalized || employee.title || "").toLowerCase().trim();
        if (titleNormalized && titleNormalized.length > 0) {
          // Zapisz do cache (zbieramy wszystkie promisy, aby poczekać na zakończenie)
          logger.info("persona-criteria-ai", "Zapisuję stanowisko do cache", {
            personaCriteriaId: personaCriteria.id,
            titleNormalized,
            title: employee.title,
            matchKey: result.matchKey || result.id,
          });
          
          // Użyj progu z briefu do konwersji score na decision przed zapisem do cache
          // Zawsze używamy progu do konwersji score na decision (nie ufamy decyzji AI)
          const positiveThreshold = brief?.positiveThreshold ?? 0.5; // Domyślnie 50%
          
          // Upewnij się że score jest zawsze liczbą (użyj domyślnego jeśli null)
          const scoreForCache = typeof result.score === "number" ? result.score : (result.decision === "positive" ? 1.0 : 0.0);
          
          const cacheDecision: "positive" | "negative" = 
            scoreForCache >= positiveThreshold 
              ? "positive" 
              : "negative";
          
          const cachePromise = saveCachedTitleDecision(
            {
              personaCriteriaId: personaCriteria.id,
              titleNormalized,
              titleEnglish: employee.titleEnglish?.toLowerCase()?.trim() || null,
              departments: Array.isArray(employee.departments) && employee.departments.length > 0 ? employee.departments : null,
              seniority: employee.seniority?.trim() || null,
            },
            {
              decision: cacheDecision, // Użyj decyzji opartej na progu
              score: scoreForCache, // Zawsze liczba (nie null)
              reason: result.reason,
            }
          ).catch((error) => {
            // Nie przerywamy wykonania jeśli zapis cache się nie powiedzie
            logger.warn("persona-criteria-ai", "Błąd zapisu cache (niekrytyczny)", { 
              employee: { 
                title: employee.title, 
                titleNormalized,
                titleEnglish: employee.titleEnglish,
                departments: employee.departments,
                seniority: employee.seniority,
              },
              result,
              personaCriteriaId: personaCriteria.id,
              error: error instanceof Error ? error.message : String(error),
            });
          });
          cachePromises.push(cachePromise);
        } else {
          skippedNoTitle++;
          logger.warn("persona-criteria-ai", "Pominięto zapis cache - brak titleNormalized", {
            employee: { 
              title: employee.title,
              titleNormalized: employee.titleNormalized,
            },
            result,
          });
        }
      } else {
        skippedNoEmployee++;
        logger.warn("persona-criteria-ai", "Nie znaleziono employee dla result", {
          resultMatchKey: result.matchKey || result.id,
          resultId: result.id,
          employeesToVerifyCount: employeesToVerify.length,
          employeesMatchKeys: employeesToVerify.map(e => e.matchKey || e.id),
        });
      }
    }
    
    logger.info("persona-criteria-ai", "Podsumowanie zapisu cache", {
      personaCriteriaId: personaCriteria.id,
      resultsCount: results.length,
      matchedCount,
      skippedNoEmployee,
      skippedNoTitle,
      cachePromisesCount: cachePromises.length,
    });
    
    // WAŻNE: Czekamy na zakończenie wszystkich zapisów cache PRZED zwróceniem wyników
    // Dzięki temu kolejne firmy w batch'u będą mogły skorzystać z cache zapisanego przez wcześniejsze firmy
    if (cachePromises.length > 0) {
      const cacheResults = await Promise.allSettled(cachePromises);
      const successful = cacheResults.filter(r => r.status === "fulfilled").length;
      const failed = cacheResults.filter(r => r.status === "rejected").length;
      
      logger.info("persona-criteria-ai", `Zapis cache zakończony: ${successful} sukces, ${failed} błędów (cache dostępny dla kolejnych firm w batch'u)`, {
        personaCriteriaId: personaCriteria.id,
        cachedCount: cachePromises.length,
        successful,
        failed,
        totalVerified: results.length,
      });
      
      if (failed > 0) {
        logger.warn("persona-criteria-ai", "Niektóre zapisy cache się nie powiodły", {
          personaCriteriaId: personaCriteria.id,
          failed,
          errors: cacheResults.filter(r => r.status === "rejected").map(r => r.status === "rejected" ? r.reason : null),
        });
      }
    } else {
      logger.info("persona-criteria-ai", "Brak stanowisk do zapisania w cache", {
        personaCriteriaId: personaCriteria.id,
        totalResults: results.length,
        employeesToVerifyCount: employeesToVerify.length,
      });
    }

    // Połącz wyniki z cache i z AI
    const allResults = [...Array.from(cachedResults.values()), ...results];

    return { results: allResults };
  } catch (error) {
    // Loguj szczegóły błędu parsowania, aby zobaczyć, co dokładnie zwróciło AI
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("persona-criteria-ai", "Nie udało się sparsować odpowiedzi AI", {
      personaCriteriaId: personaCriteria.id,
      employeesCount: employeesToVerify.length,
      errorMessage,
      originalContent: originalContent.substring(0, 1000), // Pierwsze 1000 znaków odpowiedzi
      contentLength: originalContent.length,
    }, error as Error);
    
    // Jeśli to błąd parsowania JSON, dodaj więcej informacji
    if (errorMessage.includes("JSON") || errorMessage.includes("parse")) {
      throw new Error(`Błąd parsowania odpowiedzi AI dla weryfikacji person: ${errorMessage}. Otrzymana treść (pierwsze 500 znaków): ${originalContent.substring(0, 500)}`);
    }
    
    throw new Error(`Błąd parsowania odpowiedzi AI dla weryfikacji person: ${errorMessage}`);
  }
}
