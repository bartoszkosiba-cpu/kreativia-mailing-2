import { db } from "@/lib/db";
import {
  extractUniqueTitles,
  getPeopleStatistics,
  searchOrganizations,
  searchPeopleFromOrganization,
} from "@/services/apolloService";
import { logger } from "@/services/logger";

export interface ApolloEmployeesResult {
  success: boolean;
  company?: {
    id: number;
    name: string;
    website: string | null;
  };
  apolloOrganization?: {
    id?: string | null;
    name?: string | null;
    domain?: string | null;
    employees?: number | null;
  } | null;
  people: any[];
  statistics?: {
    total: number;
    withTitles: number;
    withEmails: number;
    uniqueTitlesCount: number;
  };
  uniqueTitles?: string[];
  pagination?: any;
  creditsInfo?: {
    searchCreditsUsed: number;
    message: string;
  };
  message?: string;
  companyNotFound?: boolean;
  apiAccessError?: boolean;
  metadata?: Record<string, unknown>;
}

export async function fetchApolloEmployeesForCompany(companyId: number): Promise<ApolloEmployeesResult> {
  const company = await db.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    return {
      success: false,
      people: [],
      message: "Nie znaleziono firmy w bazie",
    };
  }

  logger.info("apollo", `Szukanie pracowników dla firmy: ${company.name} (ID: ${companyId})`);

  if (!company.website) {
    return {
      success: false,
      company: {
        id: company.id,
        name: company.name,
        website: company.website,
      },
      people: [],
      message: `Firma "${company.name}" nie ma adresu strony www. Dodaj adres strony do bazy firm.`,
      companyNotFound: true,
    };
  }

  const domain = company.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();

  let apolloOrganization: any = null;

  try {
    const orgSearchResult = await searchOrganizations(domain, {
      country: company.country || undefined,
      perPage: 50,
    });

    apolloOrganization = orgSearchResult.organizations.find(
      (org) => org.primary_domain?.toLowerCase() === domain.toLowerCase()
    );

    if (!apolloOrganization && company.name) {
      const orgSearchByName = await searchOrganizations(company.name, {
        country: company.country || undefined,
        perPage: 100,
      });

      apolloOrganization = orgSearchByName.organizations.find(
        (org) =>
          org.primary_domain?.toLowerCase() === domain.toLowerCase() ||
          org.name?.toLowerCase() === company.name.toLowerCase()
      );
    }
  } catch (error: any) {
    if (error.message?.includes("403") || error.message?.includes("404") || error.message?.includes("API_INACCESSIBLE")) {
      logger.warn("apollo", `⚠️ Brak dostępu do accounts/search - kontynuuję po domenie`);
    } else {
      logger.warn("apollo", `Błąd wyszukiwania organizacji: ${error.message || error}`);
    }
  }

  let peopleResult;

  try {
    const perPage = 100;

    if (apolloOrganization?.id) {
      peopleResult = await searchPeopleFromOrganization(apolloOrganization.id, undefined, undefined, {
        page: 1,
        perPage,
        revealEmails: false,
      });
    } else {
      peopleResult = await searchPeopleFromOrganization(undefined, undefined, domain, {
        page: 1,
        perPage,
        revealEmails: false,
      });

      if (peopleResult.people && peopleResult.people.length > 0) {
        for (const person of peopleResult.people) {
          if (person.organization && person.organization.primary_domain?.toLowerCase() === domain.toLowerCase()) {
            apolloOrganization = person.organization;
            break;
          }
        }
      }
    }
  } catch (error: any) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo", `Błąd wyszukiwania pracowników w Apollo`, { companyId }, errorObj);

    const isApiAccessError = errorObj.message?.includes("403") || errorObj.message?.includes("API_INACCESSIBLE");
    return {
      success: false,
      people: [],
      company: {
        id: company.id,
        name: company.name,
        website: company.website,
      },
      message: errorObj.message || "Błąd wyszukiwania pracowników w Apollo",
      apiAccessError: isApiAccessError,
      companyNotFound: !peopleResult?.people?.length,
    };
  }

  const people = (peopleResult?.people || []).map((person: any) => {
    const hasEmail = person.email && person.email !== "email_not_unlocked@domain.com";
    // Apollo może zwracać status w email_status lub contact_email_status
    // contact_email_status jest dostępny bez kredytów i może zawierać: "verified", "guessed", "unverified", "unavailable"
    // Normalizujemy status do lowercase, aby obsłużyć różne warianty pisowni
    const rawStatus = person.email_status || person.contact_email_status;
    const emailStatus = rawStatus ? String(rawStatus).toLowerCase() : null;
    return {
      ...person,
      email: hasEmail ? person.email : null,
      emailStatus,
      emailUnlocked: hasEmail,
    };
  });

  if (people.length === 0) {
    const companyExistsInApollo = apolloOrganization !== null;
    const message = companyExistsInApollo
      ? `Firma "${apolloOrganization?.name ?? company.name}" istnieje w Apollo, ale nie znaleziono pracowników.`
      : `Firma "${company.name}" nie została znaleziona w bazie Apollo.`;

    return {
      success: true,
      company: {
        id: company.id,
        name: company.name,
        website: company.website,
      },
      apolloOrganization: apolloOrganization
        ? {
            id: apolloOrganization.id,
            name: apolloOrganization.name,
            domain: apolloOrganization.primary_domain,
            employees: apolloOrganization.estimated_num_employees,
          }
        : null,
      people: [],
      statistics: {
        total: 0,
        withTitles: 0,
        withEmails: 0,
        uniqueTitlesCount: 0,
      },
      uniqueTitles: [],
      pagination: peopleResult?.pagination,
      creditsInfo: {
        searchCreditsUsed: 0,
        message: "Wyszukiwanie jest darmowe. Pobieranie emaili wymaga kredytów (1 kredyt za email).",
      },
      message,
      companyNotFound: !companyExistsInApollo,
    };
  }

  const statistics = getPeopleStatistics(people);
  const uniqueTitles = extractUniqueTitles(people);

  return {
    success: true,
    company: {
      id: company.id,
      name: company.name,
      website: company.website,
    },
    apolloOrganization: apolloOrganization
      ? {
          id: apolloOrganization.id,
          name: apolloOrganization.name,
          domain: apolloOrganization.primary_domain,
          employees: apolloOrganization.estimated_num_employees,
        }
      : null,
    people,
    statistics,
    uniqueTitles,
    pagination: peopleResult?.pagination,
    creditsInfo: {
      searchCreditsUsed: 0,
      message: "Wyszukiwanie jest darmowe. Pobieranie emaili wymaga kredytów (1 kredyt za email).",
    },
  };
}

