import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  searchOrganizations,
  searchPeopleFromOrganization,
  extractUniqueTitles,
  getPeopleStatistics,
} from "@/services/apolloService";
import { logger } from "@/services/logger";

/**
 * Pobiera pracowników firmy z Apollo
 * GET /api/company-selection/apollo/employees?companyId=123
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "50");

    if (!companyId || isNaN(parseInt(companyId))) {
      return NextResponse.json({ error: "companyId jest wymagane" }, { status: 400 });
    }

    // Pobierz firmę z naszej bazy
    const company = await db.company.findUnique({
      where: { id: parseInt(companyId) },
    });

    if (!company) {
      return NextResponse.json({ error: "Firma nie została znaleziona" }, { status: 404 });
    }

    logger.info("apollo", `Szukanie pracowników dla firmy: ${company.name} (ID: ${companyId})`);

    if (!company.website) {
      return NextResponse.json(
        {
          success: false,
          error: "Firma nie ma adresu strony www",
          companyNotFound: true,
          message: `Firma "${company.name}" nie ma adresu strony www. Dodaj adres strony do bazy firm.`,
        },
        { status: 400 }
      );
    }

    // Wyczyść domenę z http://, https://, www.
    const domain = company.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
    logger.info("apollo", `Wyszukiwanie pracowników dla domeny: ${domain}`);

    // KROK 1: Najpierw spróbuj znaleźć organizację (jeśli mamy dostęp do accounts/search)
    // organization_id jest najbardziej precyzyjny do wyszukiwania pracowników
    // UWAGA: Jeśli nie masz dostępu do accounts/search - dodaj go do istniejącego klucza API
    // (nie potrzebujesz osobnego klucza - wystarczy zaznaczyć endpoint w ustawieniach klucza)
    let apolloOrganization = null;
    
    try {
      // Spróbuj znaleźć organizację po domenie
      logger.info("apollo", `Szukanie organizacji po domenie: ${domain}`);
      const orgSearchResult = await searchOrganizations(domain, {
        country: company.country || undefined,
        perPage: 50,
      });
      
      logger.info("apollo", `Znaleziono ${orgSearchResult.organizations.length} organizacji dla domeny: ${domain}`);
      
      // Znajdź organizację której domena pasuje dokładnie
      apolloOrganization = orgSearchResult.organizations.find(
        (org) => org.primary_domain?.toLowerCase() === domain.toLowerCase()
      );
      
      // Jeśli nie znaleziono po domenie, spróbuj po nazwie firmy
      if (!apolloOrganization && company.name) {
        logger.info("apollo", `Nie znaleziono po domenie, próba po nazwie: ${company.name}`);
        const orgSearchByName = await searchOrganizations(company.name, {
          country: company.country || undefined,
          perPage: 100,
        });
        
        logger.info("apollo", `Znaleziono ${orgSearchByName.organizations.length} organizacji dla nazwy: ${company.name}`);
        
        // Znajdź organizację której domena pasuje
        apolloOrganization = orgSearchByName.organizations.find(
          (org) => org.primary_domain?.toLowerCase() === domain.toLowerCase() ||
                   org.name?.toLowerCase() === company.name.toLowerCase()
        );
      }
      
      if (apolloOrganization) {
        logger.info("apollo", `✅ Znaleziono organizację: ${apolloOrganization.name} (ID: ${apolloOrganization.id}, Domain: ${apolloOrganization.primary_domain})`);
      } else {
        logger.info("apollo", `⚠️ Nie znaleziono organizacji w Apollo dla domeny: ${domain}`);
        if (orgSearchResult.organizations.length > 0) {
          logger.info("apollo", `Przykładowe znalezione organizacje (pierwsze 3):`);
          orgSearchResult.organizations.slice(0, 3).forEach((org, idx) => {
            logger.info("apollo", `  ${idx + 1}. ${org.name} (${org.primary_domain})`);
          });
        }
      }
    } catch (error: any) {
      // Jeśli to błąd 403/404 - brak dostępu do accounts/search
      if (error.message?.includes("403") || error.message?.includes("404") || error.message?.includes("API_INACCESSIBLE")) {
        logger.warn("apollo", `⚠️ Brak dostępu do accounts/search - dodaj api/v1/accounts/search do klucza API`);
        logger.warn("apollo", `Kontynuuję z wyszukiwaniem pracowników po domenie (może być mniej precyzyjne)`);
      } else {
        logger.warn("apollo", `Błąd wyszukiwania organizacji: ${error.message || error}`);
      }
    }

    // KROK 2: Wyszukaj pracowników
    let peopleResult;
    
    try {
      if (apolloOrganization?.id) {
        // NAJLEPSZA OPCJA - użyj organization_id (najbardziej precyzyjne)
        logger.info("apollo", `✅ Wyszukiwanie pracowników po organization_id: ${apolloOrganization.id}`);
        peopleResult = await searchPeopleFromOrganization(
          apolloOrganization.id,
          undefined,
          undefined,
          {
            page,
            perPage,
            revealEmails: false,
          }
        );
      } else {
        // FALLBACK - użyj domeny (jeśli nie znaleźliśmy organizacji)
        logger.info("apollo", `Wyszukiwanie pracowników po domenie: ${domain}`);
        peopleResult = await searchPeopleFromOrganization(undefined, undefined, domain, {
          page,
          perPage,
          revealEmails: false,
        });
        
        // Spróbuj wyciągnąć organizację z wyników
        if (peopleResult.people && peopleResult.people.length > 0) {
          for (const person of peopleResult.people) {
            if (person.organization && person.organization.primary_domain?.toLowerCase() === domain.toLowerCase()) {
              apolloOrganization = person.organization;
              logger.info("apollo", `Znaleziono organizację z danych pracowników: ${apolloOrganization.name} (ID: ${apolloOrganization.id})`);
              break;
            }
          }
        }
      }
    } catch (error: any) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error("apollo", `Błąd wyszukiwania pracowników w Apollo`, { companyId }, errorObj);
      
      // Sprawdź czy to błąd związany z uprawnieniami API
      const isApiAccessError = errorObj.message?.includes("403") || errorObj.message?.includes("API_INACCESSIBLE");
      
      // Sprawdź czy to błąd że firma nie została znaleziona
      const isCompanyNotFound = error?.code === "COMPANY_NOT_FOUND" || errorObj.message?.includes("nie została znaleziona");
      
      return NextResponse.json(
        {
          success: false,
          error: errorObj.message || "Błąd wyszukiwania pracowników w Apollo",
          companyNotFound: isCompanyNotFound || (!isApiAccessError && peopleResult?.people?.length === 0),
          apiAccessError: isApiAccessError,
          message: isApiAccessError
            ? "Twój klucz API Apollo nie ma dostępu do endpointu people/search. Sprawdź uprawnienia w ustawieniach Apollo API - dodaj dostęp do api/v1/people/search."
            : isCompanyNotFound
            ? `Firma "${company.name}" nie została znaleziona w bazie Apollo. Możliwe przyczyny:\n1. Firma nie jest w bazie Apollo\n2. Apollo zwraca nieprecyzyjne wyniki dla tej domeny\n3. Spróbuj sprawdzić firmę ręcznie w Apollo UI`
            : "Błąd wyszukiwania pracowników w Apollo",
          details: errorObj.message,
        },
        { status: 500 }
      );
    }

    // Krok 3: Przetworz wyniki
    const people = peopleResult.people || [];
    const uniqueTitles = extractUniqueTitles(people);
    const statistics = getPeopleStatistics(people);

    logger.info("apollo", `Znaleziono ${people.length} pracowników dla firmy: ${company.name} (WYSZUKIWANIE DARMOWE - emaile nie zostały pobrane)`);
    
    // Dodaj informację o statusie emaili (bez pobierania - darmowe)
    // Apollo zwraca email_status nawet bez revealEmails
    const peopleWithEmailStatus = people.map((person) => {
      const hasEmail = person.email && person.email !== "email_not_unlocked@domain.com";
      const emailStatus = person.email_status || person.contact_email_status || "unknown";
      return {
        ...person,
        // Ukryj email jeśli nie został odblokowany (żeby użytkownik wiedział że trzeba zapłacić)
        email: hasEmail ? person.email : null,
        emailStatus,
        emailUnlocked: hasEmail, // Czy email jest już odblokowany (czy trzeba zapłacić)
      };
    });

    // Jeśli nie znaleziono pracowników, zwróć informacyjną odpowiedź (nie błąd)
    if (people.length === 0) {
      // Sprawdź czy firma w ogóle istnieje w Apollo
      const companyExistsInApollo = apolloOrganization !== null;
      
      let message = "";
      if (!companyExistsInApollo) {
        message = `Firma "${company.name}" nie została znaleziona w bazie Apollo. To może oznaczać, że:
- Firma jest zbyt mała i nie została dodana do bazy Apollo
- Firma ma inną nazwę w Apollo niż w Twojej bazie
- Firma nie jest w bazie Apollo (Apollo skupia się głównie na większych firmach międzynarodowych)

Możesz spróbować:
1. Sprawdzić czy firma istnieje w Apollo ręcznie
2. Dodać firmę do Apollo jeśli jest istotna dla Twojego biznesu
3. Użyć innego źródła danych dla tej firmy`;
      } else if (apolloOrganization) {
        message = `Firma "${apolloOrganization.name}" istnieje w Apollo, ale nie znaleziono pracowników. Możliwe przyczyny:
- Firma nie ma pracowników w bazie Apollo
- Dane o pracownikach nie są dostępne
- Firma jest zbyt mała lub nowa`;
      } else {
        // Fallback - nie powinno się zdarzyć, ale na wszelki wypadek
        message = `Nie znaleziono pracowników w Apollo dla firmy "${company.name}".`;
      }
      
      return NextResponse.json({
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
          uniqueTitles: [],
          uniqueTitlesCount: 0,
        },
        uniqueTitles: [],
        pagination: { page: 1, per_page: 50, total_entries: 0, total_pages: 0 },
        creditsInfo: {
          searchCreditsUsed: 0,
          message: "Wyszukiwanie jest darmowe. Pobieranie emaili wymaga kredytów (1 kredyt za email).",
        },
        message,
        companyNotFound: !companyExistsInApollo, // Flaga że firma nie istnieje w Apollo
      });
    }

    return NextResponse.json({
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
      people: peopleWithEmailStatus,
      statistics,
      uniqueTitles,
      pagination: peopleResult.pagination,
      creditsInfo: {
        searchCreditsUsed: 0, // Wyszukiwanie jest darmowe
        message: "Wyszukiwanie jest darmowe. Pobieranie emaili wymaga kredytów (1 kredyt za email).",
      },
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo", "Błąd pobierania pracowników z Apollo", null, errorObj);
    return NextResponse.json(
      {
        error: "Błąd pobierania pracowników z Apollo",
        details: errorObj.message,
      },
      { status: 500 }
    );
  }
}

