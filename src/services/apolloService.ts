/**
 * Apollo.io API Integration Service
 * Integracja z Apollo.io API do wyszukiwania firm i pracowników
 */

import { logger } from "./logger";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_BASE_URL = "https://api.apollo.io/v1";

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

  try {
    // Używamy TYLKO people/search (bardziej precyzyjny niż mixed_people/search)
    // mixed_people/search zwraca nieprecyzyjne wyniki - osoby z innych firm (np. Mike Braham, Bill Gates zamiast pracowników INTER MARK GROUP)
    // WYMAGANE: Dodaj dostęp do api/v1/people/search w Apollo API Settings
    
    // GŁÓWNE WYSZUKIWANIE przez people/search (używamy TYLKO tego endpointu)
    const searchParams: any = {
      page: options?.page || 1,
      per_page: options?.perPage || 50,
    };

    // Użyj organization_id jeśli dostępne (najbardziej precyzyjne)
    if (organizationId) {
      // WAŻNE: Dla organization_id używamy organization_ids (tablica) zamiast organization_id
      searchParams.organization_ids = [organizationId];
      logger.info("apollo", `Wyszukiwanie pracowników po organization_ids: ${organizationId}`);
    } else if (organizationName) {
      // UWAGA: organization_name może nie działać poprawnie w Apollo API
      // Spróbuj użyć q_keywords jako alternatywy (często działa lepiej)
      searchParams.organization_name = organizationName;
      // Dodatkowo dodaj q_keywords dla lepszego dopasowania
      searchParams.q_keywords = organizationName;
      logger.info("apollo", `Wyszukiwanie pracowników po organization_name + q_keywords: ${organizationName}`);
    } else if (domain) {
      // WAŻNE: Używamy q_organization_domains (z prefiksem q_) - to jest właściwy parametr!
      // organization_domains (bez prefiksu) może nie działać poprawnie
      searchParams.q_organization_domains = [domain];
      logger.info("apollo", `Wyszukiwanie pracowników po q_organization_domains: ${domain}`);
    } else {
      throw new Error("Musisz podać organizationId, organizationName lub domain");
    }

    // Filtrowanie po stanowiskach jeśli podano
    if (options?.titles && options.titles.length > 0) {
      searchParams.person_titles = options.titles;
    }
    
    // WAŻNE: NIE pobieraj emaili automatycznie - to zużywa kredyty!
    // Ustawiamy person_details: false żeby Apollo nie odblokowywał emaili
    // Użytkownik będzie mógł później wybrać które osoby chce pobrać (i zapłacić za nie)
    if (options?.revealEmails === false || options?.revealEmails === undefined) {
      // Domyślnie NIE pobieramy emaili - tylko podstawowe dane (darmowe)
      searchParams.person_details = false;
      // Nie używamy reveal_personal_emails=true - to by automatycznie pobierało emaile
    } else if (options?.revealEmails === true) {
      // Tylko jeśli użytkownik wyraźnie chce pobrać emaile
      searchParams.reveal_personal_emails = true;
    }

    logger.info("apollo", `Wyszukiwanie pracowników (revealEmails=${options?.revealEmails || false}) - ${options?.revealEmails ? 'ZUŻYWA kredyty' : 'DARMOWE'}`);

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

    // Filtruj tylko osoby z właściwej organizacji (Apollo czasem zwraca osoby z innych firm)
    let filteredPeople = data.people || [];
    if (organizationId) {
      // Najbardziej precyzyjne - filtruj po ID organizacji
      // Apollo powinno zwrócić tylko osoby z tej organizacji, ale sprawdzamy dla pewności
      filteredPeople = filteredPeople.filter(
        (person: ApolloPerson) => person.organization?.id === organizationId
      );
      logger.info("apollo", `Filtrowanie po organization_id: ${organizationId}, znaleziono ${filteredPeople.length} z ${data.people.length}`);
      if (filteredPeople.length === 0 && data.people.length > 0) {
        logger.warn("apollo", `⚠️ Apollo zwrócił ${data.people.length} osób, ale żadna nie ma organization_id: ${organizationId}`);
      }
    } else if (organizationName) {
      // Filtruj po nazwie - sprawdź dokładne dopasowanie
      const orgNameLower = organizationName.toLowerCase().trim();
      filteredPeople = filteredPeople.filter((person: ApolloPerson) => {
        const personOrgName = person.organization?.name?.toLowerCase().trim() || "";
        if (!personOrgName) return false;
        
        // Dokładne dopasowanie
        if (personOrgName === orgNameLower) return true;
        
        // Częściowe dopasowanie - ale tylko jeśli nazwa jest podobna
        if (personOrgName.includes(orgNameLower) || orgNameLower.includes(personOrgName)) {
          const similarity = Math.min(personOrgName.length, orgNameLower.length) / Math.max(personOrgName.length, orgNameLower.length);
          return similarity > 0.7; // Tylko jeśli podobieństwo > 70%
        }
        
        return false;
      });
      logger.info("apollo", `Filtrowanie po organization_name: ${organizationName}, znaleziono ${filteredPeople.length} z ${data.people.length}`);
    } else if (domain) {
      // Filtruj po domenie organizacji - WAŻNE: musimy przefiltrować bo Apollo zwraca przypadkowe wyniki
      const domainLower = domain.toLowerCase().trim();
      const beforeFilter = filteredPeople.length;
      
      // Loguj pierwsze 3 osoby dla debugowania
      if (filteredPeople.length > 0) {
        logger.info("apollo", `Przykładowe osoby z people/search (pierwsze 3):`);
        filteredPeople.slice(0, 3).forEach((p: ApolloPerson, idx: number) => {
          logger.info("apollo", `  ${idx + 1}. ${p.name} - Org: ${p.organization?.name} (${p.organization?.primary_domain})`);
        });
      }
      
      filteredPeople = filteredPeople.filter((person: ApolloPerson) => {
        const orgDomain = person.organization?.primary_domain?.toLowerCase().trim();
        
        // Sprawdź czy organizacja ma tę domenę (priorytet)
        if (orgDomain === domainLower) {
          return true;
        }
        
        // Sprawdź czy email kończy się na tę domenę
        if (person.email && person.email !== "email_not_unlocked@domain.com") {
          const emailDomain = person.email.split("@")[1]?.toLowerCase();
          if (emailDomain === domainLower) {
            return true;
          }
        }
        
        return false;
      });
      
      logger.info("apollo", `Filtrowanie po domain: ${domain}, znaleziono ${filteredPeople.length} z ${beforeFilter} (total: ${data.people.length})`);
      
      // Jeśli po filtrowaniu nie ma wyników, to znaczy że Apollo zwrócił przypadkowe osoby
      if (filteredPeople.length === 0 && beforeFilter > 0) {
        logger.warn("apollo", `⚠️ Apollo zwrócił ${beforeFilter} osób, ale żadna nie pasuje do domeny "${domain}"`);
        logger.warn("apollo", `⚠️ Możliwe przyczyny: organizacja nie jest w bazie Apollo, lub API zwraca błędne wyniki`);
      }
    }

    logger.info(
      "apollo",
      `Znaleziono ${filteredPeople.length} pracowników (z ${data.pagination?.total_entries || 0} wyników)`
    );

    return {
      ...data,
      people: filteredPeople,
      pagination: {
        ...data.pagination,
        total_entries: filteredPeople.length, // Aktualizujemy liczbę po filtrowaniu
      },
    };
  } catch (error: any) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    // Jeśli to błąd 403 - endpoint niedostępny, przekaż informację dalej
    if (errorObj.message?.includes("403") || errorObj.message?.includes("API_INACCESSIBLE")) {
      logger.warn("apollo", `Endpoint people/search nie jest dostępny dla tego API key`);
      logger.warn("apollo", `Sprawdź uprawnienia API key w Apollo.io - może potrzebujesz dodać dostęp do people/search`);
    }
    
    logger.error(
      "apollo",
      `Błąd wyszukiwania pracowników w Apollo`,
      { organizationId, organizationName, domain },
      errorObj
    );
    throw error;
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

