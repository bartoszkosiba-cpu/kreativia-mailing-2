/**
 * Apollo.io API Integration Service
 * Integracja z Apollo.io API do wyszukiwania firm i pracowników
 */

import { logger } from "./logger";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_BASE_URL = "https://api.apollo.io/v1";
const APOLLO_MIXED_PEOPLE_ENDPOINT = `${APOLLO_API_BASE_URL}/mixed_people/search`;

function normalizeDomain(domain?: string | null): string | undefined {
  if (!domain) {
    return undefined;
  }

  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function isAccessDeniedError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  return message.includes("API_INACCESSIBLE") || message.includes("403");
}

function filterPeopleByCriteria(
  people: ApolloPerson[],
  criteria: {
    organizationId?: string;
    organizationName?: string;
    domain?: string;
  }
): ApolloPerson[] {
  let filteredPeople = [...people];

  if (criteria.organizationId) {
    filteredPeople = filteredPeople.filter(
      (person: ApolloPerson) => person.organization?.id === criteria.organizationId
    );
    logger.info(
      "apollo",
      `Filtrowanie po organization_id: ${criteria.organizationId}, znaleziono ${filteredPeople.length} z ${people.length}`
    );
    if (filteredPeople.length === 0 && people.length > 0) {
      logger.warn(
        "apollo",
        `⚠️ Apollo zwrócił ${people.length} osób, ale żadna nie ma organization_id: ${criteria.organizationId}`
      );
    }
    return filteredPeople;
  }

  if (criteria.organizationName) {
    const orgNameLower = criteria.organizationName.toLowerCase().trim();
    filteredPeople = filteredPeople.filter((person: ApolloPerson) => {
      const personOrgName = person.organization?.name?.toLowerCase().trim() || "";
      if (!personOrgName) return false;

      if (personOrgName === orgNameLower) return true;

      if (personOrgName.includes(orgNameLower) || orgNameLower.includes(personOrgName)) {
        const similarity =
          Math.min(personOrgName.length, orgNameLower.length) /
          Math.max(personOrgName.length, orgNameLower.length);
        return similarity > 0.7;
      }

      return false;
    });
    logger.info(
      "apollo",
      `Filtrowanie po organization_name: ${criteria.organizationName}, znaleziono ${filteredPeople.length} z ${people.length}`
    );
    return filteredPeople;
  }

  if (criteria.domain) {
    const domainLower = normalizeDomain(criteria.domain);
    if (!domainLower) {
      return filteredPeople;
    }

    const beforeFilter = filteredPeople.length;

    if (filteredPeople.length > 0) {
      logger.info("apollo", `Przykładowe osoby z wyszukiwania (pierwsze 3):`);
      filteredPeople.slice(0, 3).forEach((p: ApolloPerson, idx: number) => {
        logger.info(
          "apollo",
          `  ${idx + 1}. ${p.name} - Org: ${p.organization?.name} (${normalizeDomain(
            p.organization?.primary_domain
          )})`
        );
      });
    }

    filteredPeople = filteredPeople.filter((person: ApolloPerson) => {
      const orgDomain = normalizeDomain(person.organization?.primary_domain);
      if (orgDomain === domainLower) {
        return true;
      }

      if (person.email && person.email !== "email_not_unlocked@domain.com") {
        const emailDomain = normalizeDomain(person.email.split("@")[1]);
        if (emailDomain === domainLower) {
          return true;
        }
      }

      return false;
    });

    logger.info(
      "apollo",
      `Filtrowanie po domain: ${domainLower}, znaleziono ${filteredPeople.length} z ${beforeFilter} (total: ${people.length})`
    );

    if (filteredPeople.length === 0 && beforeFilter > 0) {
      logger.warn(
        "apollo",
        `⚠️ Apollo zwrócił ${beforeFilter} osób, ale żadna nie pasuje do domeny "${domainLower}"`
      );
      logger.warn(
        "apollo",
        "⚠️ Możliwe przyczyny: organizacja nie jest w bazie Apollo, lub API zwraca błędne wyniki"
      );
    }

    return filteredPeople;
  }

  return filteredPeople;
}

async function searchPeopleViaMixedPeople(
  organizationId?: string,
  organizationName?: string,
  domain?: string,
  options?: {
    perPage?: number;
    page?: number;
  }
): Promise<ApolloSearchPeopleResponse> {
  if (!APOLLO_API_KEY) {
    throw new Error("APOLLO_API_KEY nie jest ustawiony w zmiennych środowiskowych");
  }

  const payload: any = {
    page: options?.page || 1,
    per_page: options?.perPage || 50,
    contact_scopes: {
      include_non_exportable_companies: true,
      include_personal_emails: true,
    },
  };

  if (organizationId) {
    payload.organization_ids = [organizationId];
  }

  if (organizationName) {
    payload.q_organization_name = organizationName;
  }

  if (domain) {
    const normalizedDomain = normalizeDomain(domain);
    if (normalizedDomain) {
      payload.q_company_domains = [normalizedDomain];
      if (!payload.q_organization_name) {
        payload.q_organization_name = normalizedDomain;
      }
    }
  }

  const response = await fetch(APOLLO_MIXED_PEOPLE_ENDPOINT, {
    method: "POST",
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      "X-Api-Key": APOLLO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apollo API error (mixed_people): ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  const peopleMap = new Map<string, ApolloPerson>();

  const upsertPerson = (person: ApolloPerson) => {
    if (!person.id) {
      const fallbackId = `${person.name || "unknown"}-${normalizeDomain(person.organization?.primary_domain) || "no-org"}`;
      person.id = fallbackId;
    }
    peopleMap.set(person.id, person);
  };

  const mapOrganization = (
    sourceOrg: any,
    fallbackName?: string,
    fallbackId?: string
  ): ApolloOrganization | undefined => {
    const resolvedId = sourceOrg?.organization_id || sourceOrg?.id || fallbackId;
    const resolvedName = sourceOrg?.name || fallbackName;

    if (!resolvedId && !resolvedName) {
      return undefined;
    }

    return {
      id: resolvedId || "",
      name: resolvedName || "",
      website_url: sourceOrg?.website_url,
      primary_domain:
        sourceOrg?.primary_domain || sourceOrg?.domain || normalizeDomain(sourceOrg?.website_url) || undefined,
      industry: sourceOrg?.industry,
      estimated_num_employees: sourceOrg?.estimated_num_employees,
      city: sourceOrg?.city,
      country: sourceOrg?.country,
      linkedin_url: sourceOrg?.linkedin_url,
    };
  };

  if (Array.isArray(data.contacts)) {
    data.contacts.forEach((contact: any) => {
      const emailEntry = Array.isArray(contact.contact_emails)
        ? contact.contact_emails.find((item: any) => item?.email)
        : null;

      const rawEmail = emailEntry?.email || (contact.email !== "email_not_unlocked@domain.com" ? contact.email : null);
      const emailStatus =
        emailEntry?.email_status || emailEntry?.email_true_status || contact.email_true_status || contact.email_status;

      const organization = mapOrganization(
        contact.account || contact.organization,
        contact.organization_name,
        contact.organization_id
      );

      const person: ApolloPerson = {
        id: contact.person_id || contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        name: contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(" "),
        title: contact.title,
        email: rawEmail || undefined,
        email_status: emailStatus,
        linkedin_url: contact.linkedin_url,
        organization,
        headline: contact.headline,
        contact_email_status: contact.email_status,
        departments: contact.departments ?? contact.account?.departments ?? [],
        subdepartments: contact.subdepartments ?? [],
        seniority: contact.seniority ?? contact.account?.seniority,
      };

      upsertPerson(person);
    });
  }

  if (Array.isArray(data.people)) {
    data.people.forEach((personData: any) => {
      const organization = mapOrganization(personData.organization, personData.organization_name, personData.organization_id);

      const person: ApolloPerson = {
        id: personData.id,
        first_name: personData.first_name,
        last_name: personData.last_name,
        name: personData.name || [personData.first_name, personData.last_name].filter(Boolean).join(" "),
        title: personData.title,
        email: personData.email !== "email_not_unlocked@domain.com" ? personData.email : undefined,
        email_status: personData.email_status,
        linkedin_url: personData.linkedin_url,
        organization,
        headline: personData.headline,
        contact_email_status: personData.contact_email_status,
        departments: personData.departments ?? [],
        subdepartments: personData.subdepartments ?? [],
        seniority: personData.seniority,
      };

      upsertPerson(person);
    });
  }

  let people = Array.from(peopleMap.values());

  people = filterPeopleByCriteria(people, {
    organizationId,
    organizationName,
    domain,
  });

  logger.info(
    "apollo",
    `Fallback mixed_people/search zwrócił ${people.length} osób (contacts: ${data.contacts?.length || 0}, people: ${
      data.people?.length || 0
    })`
  );

  const pagination = {
    page: data.pagination?.page || options?.page || 1,
    per_page: data.pagination?.per_page || options?.perPage || people.length || 1,
    total_entries: people.length,
    total_pages: data.pagination?.total_pages || Math.max(1, Math.ceil(people.length / (options?.perPage || 1))) || 1,
  };

  return {
    people,
    pagination,
  };
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url?: string;
  primary_domain?: string;
  industry?: string;
  estimated_num_employees?: number;
  city?: string;
  country?: string;
  linkedin_url?: string;
}

export interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  name: string;
  title?: string;
  email?: string;
  email_status?: string; // "verified", "guessed", "unavailable", "email_not_unlocked@domain.com"
  linkedin_url?: string;
  phone_number?: string;
  organization?: ApolloOrganization;
  headline?: string;
  contact_email_status?: string; // Status emaila bez pobierania (darmowe)
  departments?: string[];
  subdepartments?: string[];
  seniority?: string;
}

export interface ApolloSearchOrganizationsResponse {
  organizations: ApolloOrganization[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

export interface ApolloSearchPeopleResponse {
  people: ApolloPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

/**
 * Wyszukuje firmy w Apollo po nazwie
 */
export async function searchOrganizations(
  companyName: string,
  options?: {
    industry?: string;
    country?: string;
    perPage?: number;
  }
): Promise<ApolloSearchOrganizationsResponse> {
  if (!APOLLO_API_KEY) {
    throw new Error("APOLLO_API_KEY nie jest ustawiony w zmiennych środowiskowych");
  }

  try {
    const searchParams: any = {
      page: 1,
      per_page: options?.perPage || 10,
    };

    // Jeśli companyName wygląda jak domena (zawiera kropkę, bez spacji), użyj q_organization_domains
    // To jest bardziej precyzyjne niż q_keywords dla wyszukiwania po domenie
    if (companyName.includes('.') && !companyName.includes(' ')) {
      searchParams.q_organization_domains = [companyName];
      logger.info("apollo", `Wyszukiwanie organizacji po domenie: ${companyName}`);
    } else {
      // Dla nazw firm użyj q_keywords
      searchParams.q_keywords = companyName;
      logger.info("apollo", `Wyszukiwanie organizacji po nazwie: ${companyName}`);
    }

    if (options?.industry) {
      searchParams.industry_tag_ids = [options.industry];
    }

    if (options?.country) {
      searchParams.q_organization_locations = [options.country];
    }

    // Spróbuj najpierw /v1/organizations/search (jeśli dostępne), potem /v1/accounts/search jako fallback
    let response;
    try {
      // Próba użycia organizations/search (preferowane, bardziej precyzyjne)
      response = await fetch(`${APOLLO_API_BASE_URL}/organizations/search`, {
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          "X-Api-Key": APOLLO_API_KEY,
        },
        body: JSON.stringify(searchParams),
      });
      
      // Jeśli 404/403, użyj accounts/search jako fallback
      if (response.status === 404 || response.status === 403) {
        logger.info("apollo", `organizations/search niedostępny (${response.status}), używam accounts/search jako fallback`);
        response = await fetch(`${APOLLO_API_BASE_URL}/accounts/search`, {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "X-Api-Key": APOLLO_API_KEY,
          },
          body: JSON.stringify(searchParams),
        });
      }
    } catch (error) {
      // Fallback do accounts/search jeśli organizations/search nie jest dostępne
      logger.info("apollo", "organizations/search niedostępny, używam accounts/search jako fallback");
      response = await fetch(`${APOLLO_API_BASE_URL}/accounts/search`, {
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          "X-Api-Key": APOLLO_API_KEY,
        },
        body: JSON.stringify(searchParams),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Mapuj accounts na organizations (dla kompatybilności wstecznej)
    // Apollo używa teraz "accounts" zamiast "organizations"
    const mappedData = {
      ...data,
      organizations: data.accounts || data.organizations || [],
    };
    
    logger.info("apollo", `Znaleziono ${mappedData.pagination?.total_entries || 0} firm dla "${companyName}"`);

    return mappedData;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo", `Błąd wyszukiwania firm w Apollo: ${companyName}`, null, errorObj);
    throw error;
  }
}

/**
 * Wyszukuje pracowników firmy w Apollo
 * Może używać organization_id, organization_name lub domeny
 */
export async function searchPeopleFromOrganization(
  organizationId?: string,
  organizationName?: string,
  domain?: string,
  options?: {
    perPage?: number;
    page?: number;
    titles?: string[]; // Filtrowanie po stanowiskach
    revealEmails?: boolean; // Czy pobierać emaile (zużywa kredyty) - domyślnie FALSE!
  }
): Promise<ApolloSearchPeopleResponse> {
  if (!APOLLO_API_KEY) {
    throw new Error("APOLLO_API_KEY nie jest ustawiony w zmiennych środowiskowych");
  }

  const criteria = {
    organizationId,
    organizationName,
    domain,
  };

  const performPeopleSearch = async (): Promise<ApolloSearchPeopleResponse> => {
    const searchParams: any = {
      page: options?.page || 1,
      per_page: options?.perPage || 50,
    };

    if (organizationId) {
      searchParams.organization_ids = [organizationId];
      logger.info("apollo", `Wyszukiwanie pracowników po organization_ids: ${organizationId}`);
    } else if (organizationName) {
      searchParams.organization_name = organizationName;
      searchParams.q_keywords = organizationName;
      logger.info("apollo", `Wyszukiwanie pracowników po organization_name + q_keywords: ${organizationName}`);
    } else if (domain) {
      const normalizedDomain = normalizeDomain(domain);
      if (!normalizedDomain) {
        throw new Error("Musisz podać organizationId, organizationName lub poprawną domenę");
      }
      searchParams.q_organization_domains = [normalizedDomain];
      logger.info("apollo", `Wyszukiwanie pracowników po q_organization_domains: ${normalizedDomain}`);
    } else {
      throw new Error("Musisz podać organizationId, organizationName lub domain");
    }

    if (options?.titles && options.titles.length > 0) {
      searchParams.person_titles = options.titles;
    }

    if (options?.revealEmails === false || options?.revealEmails === undefined) {
      searchParams.person_details = false;
    } else if (options?.revealEmails === true) {
      searchParams.reveal_personal_emails = true;
    }

    logger.info(
      "apollo",
      `Wyszukiwanie pracowników (revealEmails=${options?.revealEmails || false}) - ${
        options?.revealEmails ? "ZUŻYWA kredyty" : "DARMOWE"
      }`
    );

    const response = await fetch(`${APOLLO_API_BASE_URL}/people/search`, {
      method: "POST",
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawPeople: ApolloPerson[] = data.people || [];
    const filteredPeople = filterPeopleByCriteria(rawPeople, criteria);

    logger.info(
      "apollo",
      `Znaleziono ${filteredPeople.length} pracowników (z ${data.pagination?.total_entries || 0} wyników)`
    );

    return {
      ...data,
      people: filteredPeople,
      pagination: {
        ...data.pagination,
        total_entries: filteredPeople.length,
      },
    };
  };

  try {
    return await performPeopleSearch();
  } catch (error: any) {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    if (isAccessDeniedError(errorObj.message)) {
      logger.warn("apollo", "Endpoint people/search niedostępny - fallback do mixed_people/search");
      return await searchPeopleViaMixedPeople(organizationId, organizationName, domain, options);
    }

    logger.error(
      "apollo",
      `Błąd wyszukiwania pracowników w Apollo`,
      { organizationId, organizationName, domain },
      errorObj
    );
    throw errorObj;
  }
}

/**
 * Pobiera pełne dane osoby z Apollo (ZUŻYWA KREDYTY!)
 * UWAGA: Użytkownik ma dostęp tylko do /v1/people/search, więc używamy tego endpointu
 * z parametrem reveal_personal_emails=true do odblokowania emaili
 */
export async function enrichPerson(personId: string): Promise<ApolloPerson> {
  if (!APOLLO_API_KEY) {
    throw new Error("APOLLO_API_KEY nie jest ustawiony w zmiennych środowiskowych");
  }

  try {
    logger.info("apollo", `Pobieranie pełnych danych osoby: ${personId} (ZUŻYWA KREDYT!)`);
    
    // Użyj /v1/people/search z ID osoby i reveal_personal_emails=true
    // (nie mamy dostępu do /v1/people/{id})
    const response = await fetch(`${APOLLO_API_BASE_URL}/people/search`, {
      method: "POST",
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        person_ids: [personId],
        reveal_personal_emails: true, // Odblokuj email (zużywa kredyt)
        per_page: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const person = data.people?.[0];
    
    if (!person) {
      throw new Error(`Nie znaleziono osoby o ID: ${personId}`);
    }
    
    logger.info("apollo", `Pobrano pełne dane osoby: ${personId} (email: ${person.email || 'brak'})`);
    
    return person;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo", `Błąd pobierania pełnych danych osoby: ${personId}`, null, errorObj);
    throw error;
  }
}

/**
 * Pobiera pełne dane wielu osób (ZUŻYWA KREDYTY!)
 * UWAGA: Użytkownik ma dostęp tylko do /v1/people/search, więc używamy tego endpointu
 * z parametrem reveal_personal_emails=true do odblokowania emaili
 */
export async function enrichPeopleBulk(personIds: string[]): Promise<ApolloPerson[]> {
  if (!APOLLO_API_KEY) {
    throw new Error("APOLLO_API_KEY nie jest ustawiony w zmiennych środowiskowych");
  }

  if (personIds.length === 0) {
    return [];
  }

  try {
    logger.info("apollo", `Pobieranie pełnych danych dla ${personIds.length} osób (ZUŻYWA ${personIds.length} KREDYTÓW!)`);
    
    // Użyj /v1/people/search z person_ids i reveal_personal_emails=true
    // (nie mamy dostępu do /v1/people/bulk)
    const response = await fetch(`${APOLLO_API_BASE_URL}/people/search`, {
      method: "POST",
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        person_ids: personIds,
        reveal_personal_emails: true, // Odblokuj emaile (zużywa kredyty)
        per_page: personIds.length, // Pobierz wszystkie na raz
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const people = data.people || [];
    logger.info("apollo", `Pobrano pełne dane dla ${people.length} osób`);
    
    return people;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo", `Błąd pobierania pełnych danych dla ${personIds.length} osób`, null, errorObj);
    throw error;
  }
}

/**
 * Pobiera wszystkie unikalne stanowiska z listy pracowników
 */
export function extractUniqueTitles(people: ApolloPerson[]): string[] {
  const titles = people
    .map((person) => person.title)
    .filter((title): title is string => !!title && title.trim().length > 0)
    .map((title) => title.trim());

  // Usuń duplikaty i posortuj
  return Array.from(new Set(titles)).sort();
}

/**
 * Pobiera statystyki pracowników (liczba, stanowiska)
 */
export function getPeopleStatistics(people: ApolloPerson[]) {
  const total = people.length;
  const withTitles = people.filter((p) => p.title).length;
  const uniqueTitles = extractUniqueTitles(people);
  const withEmails = people.filter((p) => p.email && p.email !== "email_not_unlocked@domain.com").length;

  return {
    total,
    withTitles,
    withEmails,
    uniqueTitles,
    uniqueTitlesCount: uniqueTitles.length,
  };
}

