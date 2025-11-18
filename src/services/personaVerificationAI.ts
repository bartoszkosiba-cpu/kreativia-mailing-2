import type { PersonaCriteriaDto, PersonaRoleConfig } from "@/services/personaCriteriaService";
import type { PersonaBriefDto } from "@/services/personaBriefService";
import { logger } from "@/services/logger";

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

export type PersonaDecision = "positive" | "conditional" | "negative";

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
  "summary" | "decisionGuidelines" | "targetProfiles" | "avoidProfiles" | "additionalNotes" | "aiRole"
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
  
  return {
    brief,
    positiveDescriptions,
    negativeDescriptions,
    aiRole,
    generalGuidelines: [
      "Twoim zadaniem jest ocenić, czy dana osoba może użyć produktu w swojej pracy lub ma wpływ na decyzję zakupową.",
      "Traktuj zasady jako wskazówki, nie twarde reguły – jeśli kontekst sugeruje, że rola może użyć produktu w pracy (np. projektant projektuje stoiska i może użyć podwieszeń), możesz zaklasyfikować ją pozytywnie, nawet jeśli nie ma bezpośredniego wpływu na budżet.",
      "Jeśli rola dotyczy wsparcia (księgowość, logistyka, IT support) i nie może użyć produktu w pracy ani nie ma wpływu na decyzję, wybierz 'negative'.",
      "Kiedy nie jesteś pewien lub rola wygląda obiecująco, ale brakuje danych, użyj 'conditional' i wyjaśnij czego potrzebujesz więcej.",
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

const GLOBAL_POSITIVE_KEYWORDS = [
  "sales",
  "sprzeda",
  "business development",
  "account manager",
  "key account",
  "account executive",
  "designer",
  "design",
  "projektant",
  "grafik",
  "visual designer",
  "3d designer",
];

const GLOBAL_NEGATIVE_KEYWORDS = [
  "marketing",
  "logisty",
  "quality",
  "kontroli jakości",
  "bhp",
  "security",
  "assistant",
  "asystent",
  "intern",
  "praktykant",
  "sewing",
];

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

function meetsSeniorityRequirement(personSeniority?: string | null, minSeniority?: string | null) {
  if (!minSeniority) return true;
  const normalizedMin = normalizeSeniority(minSeniority);
  if (!normalizedMin) return true;

  const minIndex = SENIORITY_ORDER.indexOf(normalizedMin);
  if (minIndex === -1) return true;

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
    if (!meetsSeniorityRequirement(context.seniority, role.minSeniority)) {
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

  const globalPositive = findGlobalKeywordMatch(context, GLOBAL_POSITIVE_KEYWORDS);
  if (globalPositive) {
    return {
      decision: "positive",
      reason: `(reguła globalna) Tytuł zawiera słowo lub frazę "${globalPositive}" świadczącą o roli sprzedażowej/projektowej.`,
      source: "positive-global",
      matchedKeyword: globalPositive,
    };
  }

  const globalNegative = findGlobalKeywordMatch(context, GLOBAL_NEGATIVE_KEYWORDS);
  if (globalNegative) {
    return {
      decision: "negative",
      reason: `(reguła globalna) Tytuł zawiera słowo lub frazę "${globalNegative}", która wskazuje na rolę wspierającą (niehandlową).`,
      source: "negative-global",
      matchedKeyword: globalNegative,
    };
  }

  return null;
}

export async function verifyEmployeesWithAI(
  personaCriteria: PersonaCriteriaDto,
  employees: PersonaVerificationAIInputPerson[],
  brief?: PersonaBriefContext
): Promise<PersonaVerificationAIResponse> {
  if (!employees.length) {
    return { results: [] };
  }

  const prompt = buildPrompt(personaCriteria, brief);

  const employeesForAI = employees.map((person) => ({
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

  const briefSection = brief
    ? `Brief strategiczny:
Podsumowanie: ${brief.summary || "brak"}
Wskazówki decyzyjne:
${(brief.decisionGuidelines || [])
        .map((rule, index) => `${index + 1}. ${rule}`)
        .join("\n") || "(brak)"}
Przykładowe persony (pozytywne): ${(brief.targetProfiles || []).join(", ") || "(brak)"}
Przykładowe persony (unikaj): ${(brief.avoidProfiles || []).join(", ") || "(brak)"}
Dodatkowe notatki: ${brief.additionalNotes || "(brak)"}`
    : "Brief strategiczny: (brak)";

  const messages = [
    {
      role: "system" as const,
      content: [
        `Jesteś ${prompt.aiRole}.`,
        "Zwracasz odpowiedź wyłącznie w formacie JSON: {\"results\":[{\"matchKey\":\"...\",\"decision\":\"positive|conditional|negative\",\"score\":0.0-1.0,\"reason\":\"...\"}]}.",
        "Pole 'matchKey' MUSI być zapełnione dla każdego rekordu.",
        "Pole 'reason' MUSI zawierać konkretne, biznesowe uzasadnienie – bez odniesień do poziomów typu junior/senior (chyba że w danych otrzymasz minimalny poziom seniority).",
        "Jeśli otrzymasz sprzeczne reguły, priorytet mają zasady oznaczone jako MUSI/MUST w wiadomości użytkownika.",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        briefSection,
        "",
        "ZASADY OGÓLNE:",
        ...prompt.generalGuidelines.map((guideline) => `- ${guideline}`),
        "",
        "REGUŁY KLASYFIKACJI:",
        "- Jeśli tytuł zawiera słowo 'sales' (w dowolnej formie), decyzja MUSI być 'positive'.",
        "- Jeśli tytuł zawiera słowa 'designer', 'design', 'grafik', 'projektant', decyzja MUSI być 'positive'.",
        "- Jeśli tytuł pasuje do listy 'negatives', decyzja MUSI być 'negative'.",
        "- Jeśli tytuł pasuje do listy 'positives', decyzja MUSI być 'positive'.",
        "- Seniority bierz pod uwagę tylko wtedy, gdy rola ma zdefiniowane 'minSeniority'. Inaczej całkowicie je ignoruj.",
        "- Jeśli rola nie pasuje do żadnej definicji, oceń możliwość użycia produktu w pracy lub wpływ na decyzję zakupową: gdy może użyć produktu lub ma wpływ – 'positive'; gdy brak danych – 'conditional'; gdy rola wspierająca/techniczna bez możliwości użycia produktu – 'negative'.",
        "",
        "Pozytywne role (z konfiguracji):",
        JSON.stringify(prompt.positiveDescriptions, null, 2),
        "",
        "Negatywne role (z konfiguracji):",
        JSON.stringify(prompt.negativeDescriptions, null, 2),
        "",
        "Dane pracowników (id, matchKey, title, titleNormalized, titleEnglish, departments, semanticHint, flagi managesPeople/managesProcesses/isExecutive):",
        JSON.stringify(employeesForAI, null, 2),
        "",
        "Odpowiedz wyłącznie JSON-em zgodnym ze specyfikacją.",
      ].join("\n"),
    },
  ];

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.2,
    max_tokens: 1800,
  });

  if (response.usage) {
    logger.info("persona-criteria-ai", "Zużycie tokenów w weryfikacji person", {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
    });
  }

  let content = response.choices[0]?.message?.content || "";
  content = content.trim();
  if (content.startsWith("```")) {
    content = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "");
  }
 
   try {
     const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.results)) {
      throw new Error("Brak pola results w odpowiedzi AI");
    }

    return {
      results: parsed.results.map((item: any) => {
        const matchKey = typeof item.matchKey === "string" && item.matchKey.trim().length ? item.matchKey : undefined;
        const rawDecision = typeof item.decision === "string" ? item.decision.toLowerCase() : "conditional";
        const decision: PersonaDecision = ["positive", "negative", "conditional"].includes(rawDecision)
          ? (rawDecision as PersonaDecision)
          : "conditional";
        return {
          id: item.id,
          matchKey,
          decision,
          score: typeof item.score === "number" ? Math.max(0, Math.min(1, item.score)) : 0,
          reason: item.reason || "",
        };
      }),
    };
  } catch (error) {
    logger.error("persona-criteria-ai", "Nie udało się sparsować odpowiedzi AI", null, error as Error);
    throw new Error("Błąd parsowania odpowiedzi AI dla weryfikacji person");
  }
}
