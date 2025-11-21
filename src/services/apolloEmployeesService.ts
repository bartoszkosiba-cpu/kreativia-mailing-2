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

  const MAX_EMPLOYEES = 500; // Maksymalna liczba pracowników do pobrania
  const perPage = 100;
  let allPeople: any[] = [];
  let peopleResult: any = null;
  let currentPage = 1;
  let totalPages = 1;
  let totalCreditsUsed = 0; // WAŻNE: /people/search kosztuje 1 kredyt za firmę (nie za stronę)

  try {
    // Pobierz wszystkie strony (max 500 pracowników = max 5 stron po 100)
    do {
      if (apolloOrganization?.id) {
        peopleResult = await searchPeopleFromOrganization(apolloOrganization.id, undefined, undefined, {
          page: currentPage,
          perPage,
          revealEmails: false,
        });
      } else {
        peopleResult = await searchPeopleFromOrganization(undefined, undefined, domain, {
          page: currentPage,
          perPage,
          revealEmails: false,
        });

        // Przy pierwszej stronie, spróbuj znaleźć organizację
        if (currentPage === 1 && peopleResult.people && peopleResult.people.length > 0) {
          for (const person of peopleResult.people) {
            if (person.organization && person.organization.primary_domain?.toLowerCase() === domain.toLowerCase()) {
              apolloOrganization = person.organization;
              break;
            }
          }
        }
      }

      // WAŻNE: /people/search kosztuje 1 kredyt za firmę (nie za stronę)
      // Naliczamy kredyt tylko przy pierwszej stronie (pierwszym wywołaniu dla firmy)
      if (currentPage === 1 && peopleResult?.creditsUsed !== undefined) {
        totalCreditsUsed = peopleResult.creditsUsed; // 1 kredyt za firmę
      } else if (currentPage === 1 && peopleResult?.creditsUsed === undefined) {
        // Jeśli nie ma informacji o kredytach, zakładamy 1 kredyt za firmę
        totalCreditsUsed = 1;
      }
      // Dla kolejnych stron (currentPage > 1) nie naliczamy dodatkowych kredytów

      // Dodaj pracowników z tej strony
      if (peopleResult?.people && peopleResult.people.length > 0) {
        allPeople.push(...peopleResult.people);
      }

      // Sprawdź paginację
      totalPages = peopleResult?.pagination?.total_pages || 1;
      const currentTotal = peopleResult?.pagination?.total_entries || allPeople.length;

      // Jeśli osiągnęliśmy limit 500 lub nie ma więcej stron, przerwij
      if (allPeople.length >= MAX_EMPLOYEES || currentPage >= totalPages) {
        // Ogranicz do MAX_EMPLOYEES jeśli przekroczono
        if (allPeople.length > MAX_EMPLOYEES) {
          allPeople = allPeople.slice(0, MAX_EMPLOYEES);
        }
        break;
      }

      currentPage++;
    } while (currentPage <= totalPages && allPeople.length < MAX_EMPLOYEES);

    // Zaktualizuj peopleResult z połączonymi danymi
    peopleResult = {
      ...peopleResult,
      people: allPeople,
      pagination: {
        ...peopleResult?.pagination,
        page: currentPage - 1,
        total_entries: allPeople.length,
        total_pages: Math.ceil(allPeople.length / perPage),
      },
    };

    logger.info("apollo", `Pobrano ${allPeople.length} pracowników dla firmy ${company.name} (${currentPage - 1} stron, max ${MAX_EMPLOYEES})${totalCreditsUsed > 0 ? ` | Zużyto ${totalCreditsUsed} kredytów` : ""}`, {
      companyId,
      totalEmployees: allPeople.length,
      pagesFetched: currentPage - 1,
      totalPagesAvailable: totalPages,
      totalCreditsUsed,
    });
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

  const people = (allPeople.length > 0 ? allPeople : (peopleResult?.people || [])).map((person: any) => {
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
      searchCreditsUsed: totalCreditsUsed,
      message: totalCreditsUsed > 0 
        ? `Zużyto ${totalCreditsUsed} kredytów podczas pobierania listy pracowników. Pobieranie emaili wymaga dodatkowych kredytów (1 kredyt za email).`
        : "Wyszukiwanie jest darmowe. Pobieranie emaili wymaga kredytów (1 kredyt za email).",
    },
  };
}

