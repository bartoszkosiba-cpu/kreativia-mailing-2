const STOPWORDS = new Set(["", "-", "/", "&", "and", "of", "the"]);

function removeDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const TRANSLATION_DICTIONARY: Array<[RegExp, string]> = [
  // Polish
  [/prezes/g, "president"],
  [/wlasciciel|właściciel/g, "owner"],
  [/zarzadzajacy|zarządzający/g, "managing"],
  [/zarzad|zarząd/g, "board"],
  [/dyrektor/g, "director"],
  [/kierownik/g, "manager"],
  [/wykonawcz(y|a)/g, "executive"],
  [/produkcj(a|y)/g, "production"],
  [/operacyj(ny|na)/g, "operations"],
  [/sprzedaz(y|na)?/g, "sales"],
  [/marketing(u|owy)?/g, "marketing"],
  [/projekt(ant|ow?y|u)/g, "project"],
  [/logist(yka|yczny|yczna)/g, "logistics"],
  [/eksport/g, "export"],
  [/import/g, "import"],
  [/menedzer|menadzer/g, "manager"],
  [/konsultant/g, "consultant"],
  // German
  [/geschaftsfuhrer|geschäftsführer/g, "managing director"],
  [/leiterin?|leitung/g, "leader"],
  [/bereichsleiter/g, "department leader"],
  [/vertrieb/g, "sales"],
  [/produktion/g, "production"],
  [/projekt/g, "project"],
  [/betrieb/g, "operations"],
  [/logistik/g, "logistics"],
  [/geschaftsentwicklung/g, "business development"],
  // French
  [/direct(eur|rice)/g, "director"],
  [/responsable/g, "manager"],
  [/chef/g, "head"],
  [/ventes/g, "sales"],
  [/commercial/g, "sales"],
  [/projet/g, "project"],
  [/production/g, "production"],
  [/exploitation/g, "operations"],
  [/logistique/g, "logistics"],
  [/export/g, "export"],
];

const MANAGEMENT_KEYWORDS = [
  "manager",
  "managing",
  "leader",
  "lead",
  "head",
  "director",
  "chief",
  "executive",
  "president",
  "vice",
  "vp",
  "supervisor",
  "principal",
  "owner",
  "founder",
  "chair",
  "ceo",
  "coo",
  "cmo",
  "cfo",
  "cto",
  "kierownik",
  "dyrektor",
  "koordynator",
  "leiter",
  "leitung",
  "chef",
  "responsable",
];

const PROCESS_KEYWORDS = [
  "operations",
  "operational",
  "operation",
  "production",
  "manufacturing",
  "supply",
  "chain",
  "logistics",
  "logistic",
  "process",
  "plant",
  "factory",
  "industrial",
  "engineering",
  "automation",
  "programme",
  "program",
  "projekt",
  "projektion",
  "projekcja",
  "projektowy",
  "projektowa",
  "projektmanager",
  "projektleiter",
  "operationsmanager",
  "operacyjny",
  "produkcja",
  "eksport",
  "import",
];

const EXECUTIVE_KEYWORDS = [
  "chief",
  "ceo",
  "coo",
  "cfo",
  "cmo",
  "cto",
  "president",
  "vice president",
  "executive",
  "board",
  "managing director",
  "general manager",
  "owner",
  "founder",
  "chairman",
  "chairwoman",
  "prezes",
  "zarzadzajacy",
  "zarządzający",
];

const PROJECT_KEYWORDS = ["project", "projekt", "programma", "program"];

export interface TitleAnalysis {
  original: string;
  normalized: string;
  english: string;
  tokens: string[];
  managesPeople: boolean;
  managesProcesses: boolean;
  isExecutive: boolean;
  semanticHint: string | null;
}

export function analyseJobTitle(title?: string | null): TitleAnalysis {
  const original = title?.trim() ?? "";
  if (!original) {
    return {
      original: "",
      normalized: "",
      english: "",
      tokens: [],
      managesPeople: false,
      managesProcesses: false,
      isExecutive: false,
      semanticHint: null,
    };
  }

  const normalized = removeDiacritics(original.toLowerCase());
  let english = normalized;
  for (const [regex, replacement] of TRANSLATION_DICTIONARY) {
    english = english.replace(regex, ` ${replacement} `);
  }
  english = english
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((word) => !STOPWORDS.has(word))
    .join(" ")
    .trim();

  const tokens = english.split(" ").filter(Boolean);

  const managesPeople = tokens.some((token) =>
    MANAGEMENT_KEYWORDS.some((kw) => token.includes(kw))
  );

  const managesProcesses =
    tokens.some((token) => PROCESS_KEYWORDS.some((kw) => token.includes(kw))) ||
    /operations?|produkcja|produkcyjny|logistics?/i.test(normalized);

  const isExecutive =
    tokens.some((token) => EXECUTIVE_KEYWORDS.some((kw) => token.includes(kw))) ||
    /^c[eo]|^vp/.test(normalized) ||
    /czlonek zarzadu|członek zarządu/.test(normalized);

  let semanticHint: string | null = null;
  if (isExecutive) {
    semanticHint = "executive";
  } else if (managesPeople && managesProcesses) {
    semanticHint = "operations_manager";
  } else if (managesPeople && tokens.some((token) =>
      PROJECT_KEYWORDS.some((kw) => token.includes(kw))
    )) {
    semanticHint = "project_manager";
  } else if (managesPeople) {
    semanticHint = "manager";
  }

  return {
    original,
    normalized,
    english,
    tokens,
    managesPeople,
    managesProcesses,
    isExecutive,
    semanticHint,
  };
}

