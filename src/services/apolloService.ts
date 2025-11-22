/**
 * Apollo.io API Integration Service
 * Integracja z Apollo.io API do wyszukiwania firm i pracowników
 */

import { logger } from "./logger";
import { trackApolloCredits, calculateCreditsUsed } from "./apolloCreditsTracker";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_KEY_MIXED_PEOPLE = process.env.APOLLO_API_KEY_MIXED_PEOPLE; // API Key z dostępem do /mixed_people/api_search
const APOLLO_API_BASE_URL = "https://api.apollo.io/v1";
const APOLLO_MIXED_PEOPLE_ENDPOINT = `${APOLLO_API_BASE_URL}/mixed_people/search`;
const APOLLO_MIXED_PEOPLE_API_SEARCH_ENDPOINT = `${APOLLO_API_BASE_URL}/mixed_people/api_search`; // DARMOWE (no credit charge)

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

    // UWAGA: Dla /mixed_people/api_search format preview może nie mieć primary_domain
    // W takim przypadku, jeśli wyszukiwaliśmy po domenie i znaleźliśmy osoby, 
    // prawdopodobnie wszystkie pasują (bo wyszukiwanie było już po domenie)
    // Jeśli nie mamy primary_domain, ale wyszukiwaliśmy po domenie, zaakceptuj wszystkie
    const hasDomainInfo = filteredPeople.some((p: ApolloPerson) => 
      p.organization?.primary_domain || (p.email && p.email !== "email_not_unlocked@domain.com")
    );

    if (!hasDomainInfo && beforeFilter > 0) {
      // Brak informacji o domenie w odpowiedzi - prawdopodobnie format preview
      // Jeśli wyszukiwaliśmy po domenie i znaleźliśmy osoby, zaakceptuj je wszystkie
      logger.info(
        "apollo",
        `⚠️ Format preview - brak informacji o domenie w odpowiedzi. Akceptuję wszystkie ${beforeFilter} znalezione osoby (wyszukiwanie było już po domenie: ${domainLower})`
      );
      return filteredPeople; // Zwróć wszystkie, bo wyszukiwanie było już po domenie
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
  creditsUsed?: number; // Liczba kredytów zużytych w tym wywołaniu
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
    const errorMessage = errorObj.message || String(error);
    
    // Jeśli to błąd 403 (API_INACCESSIBLE), to jest oczekiwane dla bezpłatnego API key
    // Zmieniam z ERROR na INFO, bo kod kontynuuje z wyszukiwaniem po domenie
    if (isAccessDeniedError(errorMessage)) {
      logger.info("apollo", `Brak dostępu do accounts/search - to jest oczekiwane dla bezpłatnego API key. Kontynuuję z wyszukiwaniem po domenie.`);
      // Zwróć pustą odpowiedź zamiast rzucać błąd
      return {
        organizations: [],
        pagination: {
          page: 1,
          per_page: 50,
          total_entries: 0,
          total_pages: 0,
        },
      };
    }
    
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
    // WAŻNE: Najpierw próbujemy darmowego /mixed_people/api_search (jeśli revealEmails=false)
    // Zgodnie z dokumentacją Apollo: /mixed_people/api_search jest DARMOWE (no credit charge)
    // Ale tylko jeśli revealEmails=false - jeśli revealEmails=true, musimy użyć płatnego endpointu
    let endpoint = `${APOLLO_API_BASE_URL}/people/search`; // Domyślnie używamy /people/search
    let endpointName = "/people/search";
    
    // Wybierz odpowiedni API Key i endpoint
    // WAŻNE: Używamy /mixed_people/api_search z dedykowanym API key (bezpłatne)
    let apiKeyToUse = APOLLO_API_KEY;
    let useMixedPeopleApiSearch = (options?.revealEmails === false || options?.revealEmails === undefined);
    
    if (useMixedPeopleApiSearch) {
      // Używamy darmowego /mixed_people/api_search z dedykowanym API key
      endpoint = APOLLO_MIXED_PEOPLE_API_SEARCH_ENDPOINT;
      endpointName = "/mixed_people/api_search";
      // Użyj dedykowanego API Key dla /mixed_people/api_search (BEZPŁATNE)
      apiKeyToUse = APOLLO_API_KEY_MIXED_PEOPLE || APOLLO_API_KEY;
      logger.info("apollo", `Używam darmowego endpointu /mixed_people/api_search (no credit charge)${APOLLO_API_KEY_MIXED_PEOPLE ? " - używam dedykowanego API Key" : " - używam domyślnego API Key"}`);
    } else {
      logger.info(
        "apollo",
        `Wyszukiwanie pracowników (revealEmails=true) - ZUŻYWA kredyty - używam /people/search`
      );
    }

    // Przygotuj parametry w zależności od endpointu
    // /mixed_people/api_search używa innych nazw parametrów niż /people/search
    const searchParams: any = {
      page: options?.page || 1,
      per_page: options?.perPage || 50,
    };

    if (useMixedPeopleApiSearch) {
      // Parametry dla /mixed_people/api_search (podobne do /mixed_people/search)
      if (organizationId) {
        searchParams.organization_ids = [organizationId];
        logger.info("apollo", `Wyszukiwanie pracowników po organization_ids: ${organizationId}`);
      } else if (organizationName) {
        searchParams.q_organization_name = organizationName;
        logger.info("apollo", `Wyszukiwanie pracowników po q_organization_name: ${organizationName}`);
      } else if (domain) {
        const normalizedDomain = normalizeDomain(domain);
        if (!normalizedDomain) {
          throw new Error("Musisz podać organizationId, organizationName lub poprawną domenę");
        }
        searchParams.q_company_domains = [normalizedDomain]; // UWAGA: q_company_domains, nie q_organization_domains!
        if (!searchParams.q_organization_name) {
          searchParams.q_organization_name = normalizedDomain;
        }
        logger.info("apollo", `Wyszukiwanie pracowników po q_company_domains: ${normalizedDomain}`);
      } else {
        throw new Error("Musisz podać organizationId, organizationName lub domain");
      }
      
      // Dodaj contact_scopes dla /mixed_people/api_search
      // UWAGA: include_personal_emails: true może zwrócić więcej informacji o emailu (ale nie ujawni emaila)
      searchParams.contact_scopes = {
        include_non_exportable_companies: true,
        include_personal_emails: true, // Spróbuj true - może zwrócić więcej informacji o statusie emaila
      };
    } else {
      // Parametry dla /people/search
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
    }

    if (options?.titles && options.titles.length > 0) {
      searchParams.person_titles = options.titles;
    }

    if (!useMixedPeopleApiSearch) {
      // Parametry revealEmails tylko dla /people/search
    if (options?.revealEmails === false || options?.revealEmails === undefined) {
      searchParams.person_details = false;
    } else if (options?.revealEmails === true) {
      searchParams.reveal_personal_emails = true;
      }
    }

    if (!apiKeyToUse) {
      throw new Error("APOLLO_API_KEY nie jest ustawiony w zmiennych środowiskowych");
    }

    let response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "X-Api-Key": apiKeyToUse,
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Jeśli /mixed_people/api_search nie działa (403/404), fallback do /people/search
      if (endpointName === "/mixed_people/api_search" && (response.status === 403 || response.status === 404)) {
        logger.warn("apollo", `Endpoint /mixed_people/api_search niedostępny (${response.status}) - fallback do /people/search`);
        // Fallback do /people/search - musimy zmienić parametry na format dla /people/search
        endpoint = `${APOLLO_API_BASE_URL}/people/search`;
        endpointName = "/people/search";
        
        // Przekonwertuj parametry z formatu /mixed_people/api_search na format /people/search
        const fallbackParams: any = {
          page: searchParams.page || 1,
          per_page: searchParams.per_page || 50,
        };
        
        if (organizationId) {
          fallbackParams.organization_ids = [organizationId];
        } else if (organizationName) {
          fallbackParams.organization_name = organizationName;
          fallbackParams.q_keywords = organizationName;
        } else if (domain) {
          const normalizedDomain = normalizeDomain(domain);
          if (normalizedDomain) {
            fallbackParams.q_organization_domains = [normalizedDomain]; // q_organization_domains dla /people/search
          }
        }
        
        if (options?.titles && options.titles.length > 0) {
          fallbackParams.person_titles = options.titles;
        }
        
        if (options?.revealEmails === false || options?.revealEmails === undefined) {
          fallbackParams.person_details = false;
        } else if (options?.revealEmails === true) {
          fallbackParams.reveal_personal_emails = true;
        }
        
        const fallbackResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "X-Api-Key": APOLLO_API_KEY || apiKeyToUse,
          },
          body: JSON.stringify(fallbackParams),
        });
        
        if (!fallbackResponse.ok) {
          const fallbackErrorText = await fallbackResponse.text();
          throw new Error(`Apollo API error: ${fallbackResponse.status} - ${fallbackErrorText}`);
        }
        
        // Użyj odpowiedzi z fallback
        response = fallbackResponse;
        // Ustaw flagę, że używamy /people/search (nie /mixed_people/api_search)
        useMixedPeopleApiSearch = false;
      } else {
      throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
      }
    }

    // Sprawdź nagłówki odpowiedzi dla informacji o kredytach
    const creditsUsedHeader = response.headers.get("X-Apollo-Credits-Used") || 
                              response.headers.get("x-apollo-credits-used") ||
                              response.headers.get("X-Credits-Used") ||
                              response.headers.get("x-credits-used");
    const creditsUsed = creditsUsedHeader ? parseInt(creditsUsedHeader, 10) : null;

    const data = await response.json();
    
    // Loguj surową odpowiedź dla debugowania
    if (useMixedPeopleApiSearch) {
      // Loguj pełną surową odpowiedź (ograniczoną do 5000 znaków, żeby zobaczyć wszystkie pola)
      const rawResponseStr = JSON.stringify(data, null, 2);
      logger.info("apollo", `[DEBUG] /mixed_people/api_search PEŁNA surowa odpowiedź (${rawResponseStr.length} znaków):`);
      logger.info("apollo", rawResponseStr.substring(0, 5000) + (rawResponseStr.length > 5000 ? "\n... (obcięto)" : ""));
      
      // Szczegółowa analiza pól związanych z emailem
      if (Array.isArray(data.people) && data.people.length > 0) {
        const firstPerson = data.people[0];
        logger.info("apollo", `[DEBUG] Analiza pól emailowych dla pierwszej osoby:`, {
          id: firstPerson.id,
          first_name: firstPerson.first_name,
          allKeys: Object.keys(firstPerson),
          emailFields: {
            has_email: firstPerson.has_email,
            email: firstPerson.email,
            email_status: firstPerson.email_status,
            email_true_status: firstPerson.email_true_status,
            contact_email_status: firstPerson.contact_email_status,
            contact_emails: firstPerson.contact_emails,
          },
          fullPerson: JSON.stringify(firstPerson, null, 2).substring(0, 2000), // Pełny obiekt pierwszej osoby
        });
      }
      
      logger.info("apollo", `[DEBUG] /mixed_people/api_search struktura:`, {
        keys: Object.keys(data),
        hasContacts: Array.isArray(data.contacts),
        contactsLength: Array.isArray(data.contacts) ? data.contacts.length : 0,
        hasPeople: Array.isArray(data.people),
        peopleLength: Array.isArray(data.people) ? data.people.length : 0,
        pagination: data.pagination,
        searchParams: { domain, organizationId, organizationName },
      });
    }
    
    // /mixed_people/api_search zwraca dane w formacie podobnym do /mixed_people/search
    // Może zwracać zarówno `people` jak i `contacts` w odpowiedzi
    let rawPeople: ApolloPerson[] = [];
    
    if (useMixedPeopleApiSearch) {
      // Dla /mixed_people/api_search, dane mogą być w `people` lub `contacts`
      const peopleMap = new Map<string, ApolloPerson>();
      
      // Przetwórz contacts (jeśli istnieją)
      if (Array.isArray(data.contacts)) {
        data.contacts.forEach((contact: any) => {
          const emailEntry = Array.isArray(contact.contact_emails)
            ? contact.contact_emails.find((item: any) => item?.email)
            : null;
          const rawEmail = emailEntry?.email || (contact.email !== "email_not_unlocked@domain.com" ? contact.email : null);
          const emailStatus = emailEntry?.email_status || emailEntry?.email_true_status || contact.email_true_status || contact.email_status;
          
          const person: ApolloPerson = {
            id: contact.person_id || contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            name: contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(" "),
            title: contact.title,
            email: rawEmail || undefined,
            email_status: emailStatus,
            linkedin_url: contact.linkedin_url,
            organization: contact.account || contact.organization ? {
              id: contact.account?.organization_id || contact.organization?.id || contact.organization_id || "",
              name: contact.account?.name || contact.organization?.name || contact.organization_name || "",
              primary_domain: contact.account?.primary_domain || contact.organization?.primary_domain || normalizeDomain(contact.account?.website_url),
            } : undefined,
            headline: contact.headline,
            contact_email_status: contact.email_status,
            departments: contact.departments ?? contact.account?.departments ?? [],
            subdepartments: contact.subdepartments ?? [],
            seniority: contact.seniority ?? contact.account?.seniority,
          };
          
          if (person.id) {
            peopleMap.set(person.id, person);
          }
        });
      }
      
      // Przetwórz people (jeśli istnieją)
      // UWAGA: /mixed_people/api_search zwraca format "preview" z ograniczonymi danymi
      if (Array.isArray(data.people)) {
        data.people.forEach((personData: any) => {
          // Format /mixed_people/api_search ma inne pola niż /people/search
          // - last_name_obfuscated zamiast last_name
          // - has_email zamiast email_status
          // - organization ma tylko flagi has_*, nie pełne dane
          const lastName = personData.last_name || personData.last_name_obfuscated || "";
          const fullName = [personData.first_name, lastName].filter(Boolean).join(" ");
          
          // UWAGA: /mixed_people/api_search (bezpłatny endpoint) zwraca TYLKO has_email: true/false
          // NIE zwraca: email_status, email_true_status, contact_email_status
          // has_email: true = email jest w bazie Apollo (ale nie ujawniony w preview)
          // has_email: false = email NIE jest w bazie Apollo LUB nie jest ujawniony w preview
          // Bez dodatkowych informacji, nie możemy określić dokładnego statusu
          let emailStatus: string | undefined;
          
          // Najpierw sprawdź, czy jest bezpośredni email_status (może być w innych formatach)
          if (personData.email_status) {
            emailStatus = personData.email_status;
          } else if (personData.email_true_status) {
            emailStatus = personData.email_true_status;
          } else if (personData.contact_email_status) {
            emailStatus = personData.contact_email_status;
          } else if (personData.has_email === true) {
            // has_email: true = email jest w bazie Apollo (ale nie ujawniony)
            // Ustawiamy "available" jako ogólny status
            emailStatus = "available";
          } else if (personData.has_email === false) {
            // has_email: false = email NIE jest w bazie Apollo
            // Ustawiamy "unavailable" - zgodnie z dokumentacją Apollo, to oznacza brak emaila w bazie
            emailStatus = "unavailable";
          }
          
          // Sprawdź, czy jest email (nawet jeśli zablokowany)
          const rawEmail = personData.email && personData.email !== "email_not_unlocked@domain.com" 
            ? personData.email 
            : undefined;
          
          const person: ApolloPerson = {
            id: personData.id,
            first_name: personData.first_name,
            last_name: lastName,
            name: personData.name || fullName,
            title: personData.title,
            email: rawEmail,
            email_status: emailStatus,
            linkedin_url: personData.linkedin_url,
            organization: personData.organization ? {
              id: personData.organization.id || personData.organization_id || "",
              name: personData.organization.name || personData.organization_name || "",
              primary_domain: personData.organization.primary_domain || personData.organization.domain || normalizeDomain(personData.organization.website_url),
            } : undefined,
            headline: personData.headline,
            contact_email_status: personData.contact_email_status || emailStatus,
            departments: personData.departments ?? [],
            subdepartments: personData.subdepartments ?? [],
            seniority: personData.seniority,
          };
          
          if (person.id) {
            peopleMap.set(person.id, person);
          }
        });
      }
      
      rawPeople = Array.from(peopleMap.values());
    } else {
      // Dla /people/search, dane są w `people`
      rawPeople = data.people || [];
    }
    
    const filteredPeople = filterPeopleByCriteria(rawPeople, criteria);

    // Jeśli nie ma informacji w nagłówkach, oblicz na podstawie logiki
    let finalCreditsUsed = creditsUsed;
    if (finalCreditsUsed === null || isNaN(finalCreditsUsed)) {
      // /mixed_people/api_search jest DARMOWE (0 kredytów)
      // /people/search kosztuje 1 kredyt za każde wywołanie (za firmę)
      // /mixed_people/search kosztuje 1 kredyt za stronę
      finalCreditsUsed = calculateCreditsUsed({
        endpoint: endpointName,
        options: {
          revealEmails: options?.revealEmails || false,
          perPage: options?.perPage,
          page: options?.page,
        },
        responseData: {
          pagination: data.pagination,
          people: filteredPeople,
        },
      });
    }

    // Zapisz użycie kredytów do bazy (tylko jeśli > 0)
    if (finalCreditsUsed > 0) {
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      await trackApolloCredits({
        operation: `searchPeopleFromOrganization (${organizationId || organizationName || domain})`,
        endpoint: endpointName,
        creditsUsed: finalCreditsUsed,
        metadata: {
          organizationId,
          organizationName,
          domain,
          revealEmails: options?.revealEmails || false,
          perPage: options?.perPage,
          page: options?.page,
          peopleFound: filteredPeople.length,
          totalEntries: data.pagination?.total_entries || 0,
        },
        responseHeaders,
      }).catch((error) => {
        // Nie przerywaj działania jeśli zapis kredytów się nie powiódł
        logger.error("apollo", "Błąd zapisu kredytów Apollo", null, error);
      });
    }

    // Loguj szczegóły odpowiedzi dla debugowania
    if (useMixedPeopleApiSearch) {
      logger.info("apollo", `[DEBUG] /mixed_people/api_search odpowiedź:`, {
        hasContacts: Array.isArray(data.contacts),
        contactsCount: Array.isArray(data.contacts) ? data.contacts.length : 0,
        hasPeople: Array.isArray(data.people),
        peopleCount: Array.isArray(data.people) ? data.people.length : 0,
        rawPeopleCount: rawPeople.length,
        filteredPeopleCount: filteredPeople.length,
        pagination: data.pagination,
        searchParams: { domain, organizationId, organizationName },
      });
    }

    logger.info(
      "apollo",
      `Znaleziono ${filteredPeople.length} pracowników (z ${data.pagination?.total_entries || 0} wyników)${finalCreditsUsed > 0 ? ` | Zużyto ${finalCreditsUsed} kredytów` : ""}`
    );

    // Przygotuj paginację - dla /mixed_people/api_search może być inny format
    let pagination = data.pagination;
    if (useMixedPeopleApiSearch && !pagination) {
      // Jeśli brak paginacji w odpowiedzi, utwórz ją na podstawie danych
      pagination = {
        page: searchParams.page || 1,
        per_page: searchParams.per_page || 50,
        total_entries: rawPeople.length,
        total_pages: Math.max(1, Math.ceil(rawPeople.length / (searchParams.per_page || 50))),
      };
    } else if (pagination) {
      // Zaktualizuj total_entries na podstawie przefiltrowanych wyników
      pagination = {
        ...pagination,
        total_entries: filteredPeople.length,
      };
    }

    return {
      ...data,
      people: filteredPeople,
      pagination: pagination || {
        page: 1,
        per_page: filteredPeople.length,
        total_entries: filteredPeople.length,
        total_pages: 1,
      },
      creditsUsed: finalCreditsUsed, // Dodaj informację o kredytach do odpowiedzi
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
 * UWAGA: Używa mixed_people/search jako fallback, jeśli people/search nie jest dostępny
 * @param personId - ID osoby w Apollo
 * @param organizationInfo - Opcjonalne dane organizacji (organizationId, organizationName, domain) - przyspiesza fallback
 */
export async function enrichPerson(
  personId: string,
  organizationInfo?: { organizationId?: string; organizationName?: string; domain?: string }
): Promise<ApolloPerson> {
  if (!APOLLO_API_KEY) {
    throw new Error("APOLLO_API_KEY nie jest ustawiony w zmiennych środowiskowych");
  }

  const performEnrich = async (): Promise<ApolloPerson> => {
    logger.info("apollo", `Pobieranie pełnych danych osoby: ${personId} (ZUŻYWA KREDYT!)`);
    
    // Spróbuj najpierw /v1/people/search z ID osoby i reveal_personal_emails=true
    try {
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
        // Jeśli 403, użyj fallback
        if (response.status === 403 || errorText.includes("API_INACCESSIBLE")) {
          throw new Error("API_INACCESSIBLE");
        }
        throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const person = data.people?.[0];
      
      if (person) {
        return mapPersonData(person, personId);
      }
    } catch (error: any) {
      // Jeśli błąd dostępu, użyj fallback
      if (error.message?.includes("API_INACCESSIBLE") || isAccessDeniedError(error.message)) {
        logger.warn("apollo", `Endpoint people/search niedostępny - fallback do mixed_people/search dla osoby ${personId}`);
        throw error; // Rzuć dalej, aby użyć fallback
      }
      throw error;
    }

    throw new Error(`Nie znaleziono osoby o ID: ${personId}`);
  };

  // Fallback do mixed_people/search
  // UWAGA: mixed_people/search nie obsługuje person_ids bezpośrednio
  // Musimy użyć organization_id/name/domain
  const performFallback = async (): Promise<ApolloPerson> => {
    logger.info("apollo", `Fallback: używam mixed_people/search dla osoby ${personId}`);
    
    // Krok 1: Pobierz dane organizacji (z parametru lub z API)
    let organizationId: string | undefined = organizationInfo?.organizationId;
    let organizationName: string | undefined = organizationInfo?.organizationName;
    let domain: string | undefined = organizationInfo?.domain;
    
    // Jeśli nie mamy danych organizacji, spróbuj pobrać z API
    if (!organizationId && !organizationName && !domain) {
      try {
        // Spróbuj pobrać dane osoby bez reveal_personal_emails (darmowe)
        const basicResponse = await fetch(`${APOLLO_API_BASE_URL}/people/search`, {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "X-Api-Key": APOLLO_API_KEY,
          },
          body: JSON.stringify({
            person_ids: [personId],
            per_page: 1,
            person_details: false, // Nie pobieraj szczegółów (darmowe)
          }),
        });

        if (basicResponse.ok) {
          const basicData = await basicResponse.json();
          const basicPerson = basicData.people?.[0];
          if (basicPerson) {
            organizationId = basicPerson.organization?.id || basicPerson.organization_id;
            organizationName = basicPerson.organization?.name || basicPerson.organization_name;
            domain = basicPerson.organization?.primary_domain || basicPerson.organization?.domain;
            logger.info("apollo", `Pobrano dane organizacji dla osoby ${personId}: ${organizationId || organizationName || domain}`);
          }
        }
      } catch (error) {
        logger.warn("apollo", `Nie udało się pobrać danych organizacji dla osoby ${personId}`, { error });
      }
    } else {
      logger.info("apollo", `Używam przekazanych danych organizacji dla osoby ${personId}: ${organizationId || organizationName || domain}`);
    }
    
    // Krok 2: Użyj mixed_people/search z organization_id/name/domain
    if (!organizationId && !organizationName && !domain) {
      throw new Error(`Nie można znaleźć organizacji dla osoby ${personId}. Nie można użyć mixed_people/search.`);
    }
    
    // WAŻNE: Najpierw sprawdźmy, czy osoba istnieje (BEZ include_personal_emails - DARMOWE)
    // To zapobiega zużyciu kredytu, jeśli osoba nie istnieje
    const checkPayload: any = {
      page: 1,
      per_page: 100, // Pobierz więcej, aby znaleźć konkretną osobę
      contact_scopes: {
        include_non_exportable_companies: true,
        // NIE ustawiamy include_personal_emails - to jest darmowe sprawdzenie
      },
    };
    
    if (organizationId) {
      checkPayload.organization_ids = [organizationId];
    } else if (organizationName) {
      checkPayload.q_organization_name = organizationName;
    } else if (domain) {
      const normalizedDomain = normalizeDomain(domain);
      if (normalizedDomain) {
        checkPayload.q_company_domains = [normalizedDomain];
      }
    }
    
    logger.info("apollo", `Sprawdzanie istnienia osoby ${personId} w organizacji (DARMOWE - bez include_personal_emails)`);
    
    const checkResponse = await fetch(APOLLO_MIXED_PEOPLE_ENDPOINT, {
      method: "POST",
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify(checkPayload),
    });

    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      throw new Error(`Apollo API error (mixed_people check): ${checkResponse.status} - ${errorText}`);
    }

    const checkData = await checkResponse.json();
    
    // Sprawdź w contacts i people - znajdź konkretną osobę po person_id (DARMOWE)
    let personExists = false;
    if (Array.isArray(checkData.contacts) && checkData.contacts.length > 0) {
      personExists = checkData.contacts.some((c: any) => (c.person_id || c.id) === personId);
    }
    if (!personExists && Array.isArray(checkData.people) && checkData.people.length > 0) {
      personExists = checkData.people.some((p: any) => p.id === personId);
    }
    
    if (!personExists) {
      throw new Error(`Nie znaleziono osoby o ID: ${personId} w organizacji (sprawdzono ${(checkData.contacts?.length || 0) + (checkData.people?.length || 0)} rekordów). Kredyt NIE został zużyty.`);
    }
    
    logger.info("apollo", `Osoba ${personId} istnieje w organizacji. Teraz pobieram email (ZUŻYWA 1 KREDYT)`);
    
    // Krok 3: Teraz pobierz email (ZUŻYWA KREDYT) - tylko jeśli osoba istnieje
    const payload: any = {
      page: 1,
      per_page: 100,
      contact_scopes: {
        include_non_exportable_companies: true,
        include_personal_emails: true, // Odblokuj email (zużywa kredyt) - TYLKO jeśli osoba istnieje
      },
    };
    
    if (organizationId) {
      payload.organization_ids = [organizationId];
    } else if (organizationName) {
      payload.q_organization_name = organizationName;
    } else if (domain) {
      const normalizedDomain = normalizeDomain(domain);
      if (normalizedDomain) {
        payload.q_company_domains = [normalizedDomain];
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
    
    // Sprawdź w contacts i people - znajdź konkretną osobę po person_id
    let person = null;
    if (Array.isArray(data.contacts) && data.contacts.length > 0) {
      person = data.contacts.find((c: any) => (c.person_id || c.id) === personId);
    }
    if (!person && Array.isArray(data.people) && data.people.length > 0) {
      person = data.people.find((p: any) => p.id === personId);
    }
    
    if (!person) {
      // To nie powinno się zdarzyć, bo już sprawdziliśmy, że osoba istnieje
      throw new Error(`Nie znaleziono osoby o ID: ${personId} w mixed_people/search (sprawdzono ${(data.contacts?.length || 0) + (data.people?.length || 0)} rekordów). Kredyt został zużyty, ale osoba nie została znaleziona.`);
    }
    
    // Loguj szczegóły odpowiedzi dla debugowania
    logger.debug("apollo", `Odpowiedź mixed_people/search dla osoby ${personId}`, {
      hasEmail: !!person.email,
      email: person.email,
      hasContactEmails: Array.isArray(person.contact_emails) && person.contact_emails.length > 0,
      contactEmails: person.contact_emails,
      emailStatus: person.email_status || person.contact_email_status,
    });
    
    return mapPersonData(person, personId);
  };

  // Funkcja pomocnicza do mapowania danych osoby
  const mapPersonData = (person: any, personId: string): ApolloPerson => {
    // Sprawdź email w różnych miejscach
    let email = person.email;
    
    // Jeśli nie ma bezpośredniego emaila, sprawdź contact_emails
    if (!email && Array.isArray(person.contact_emails) && person.contact_emails.length > 0) {
      // Szukaj pierwszego emaila, który nie jest placeholderm
      const emailEntry = person.contact_emails.find((e: any) => {
        const eEmail = e?.email || e?.email_address;
        return eEmail && eEmail !== "email_not_unlocked@domain.com" && eEmail !== "email_not_available@domain.com";
      });
      email = emailEntry?.email || emailEntry?.email_address;
    }
    
    // Sprawdź też w innych miejscach (dla różnych formatów odpowiedzi)
    if (!email && person.email_address) {
      email = person.email_address;
    }
    
    // Filtruj placeholder email
    if (email === "email_not_unlocked@domain.com" || email === "email_not_available@domain.com") {
      email = undefined;
    }
    
    const emailStatus = person.email_status || person.email_true_status || 
                       (Array.isArray(person.contact_emails) && person.contact_emails[0]?.email_status) ||
                       person.contact_email_status ||
                       (Array.isArray(person.contact_emails) && person.contact_emails[0]?.status);
    
    logger.info("apollo", `Pobrano pełne dane osoby: ${personId} (email: ${email || 'brak'}, status: ${emailStatus || 'brak'})`);
    
    // Mapuj organizację
    const organization = person.organization || person.account;
    const mappedOrg = organization ? {
      id: organization.organization_id || organization.id || "",
      name: organization.name || "",
      website_url: organization.website_url,
      primary_domain: organization.primary_domain || organization.domain || normalizeDomain(organization.website_url),
      industry: organization.industry,
      estimated_num_employees: organization.estimated_num_employees,
      city: organization.city,
      country: organization.country,
      linkedin_url: organization.linkedin_url,
    } : undefined;
    
    // Zwróć zmapowaną osobę zgodnie z interfejsem ApolloPerson
    return {
      id: person.id || person.person_id || personId,
      first_name: person.first_name,
      last_name: person.last_name,
      name: person.name || [person.first_name, person.last_name].filter(Boolean).join(" "),
      title: person.title,
      email: email,
      email_status: emailStatus,
      contact_email_status: person.contact_email_status || person.email_status,
      linkedin_url: person.linkedin_url,
      organization: mappedOrg,
      headline: person.headline,
      departments: person.departments ?? (person.account?.departments) ?? [],
      subdepartments: person.subdepartments ?? [],
      seniority: person.seniority ?? person.account?.seniority,
    };
  };

  try {
    return await performEnrich();
  } catch (error: any) {
    if (error.message?.includes("API_INACCESSIBLE") || isAccessDeniedError(error.message)) {
      try {
        return await performFallback();
      } catch (fallbackError: any) {
        const errorObj = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
        logger.error("apollo", `Błąd pobierania pełnych danych osoby (fallback): ${personId}`, null, errorObj);
        throw errorObj;
      }
    }
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo", `Błąd pobierania pełnych danych osoby: ${personId}`, null, errorObj);
    throw errorObj;
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

