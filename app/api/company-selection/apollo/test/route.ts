import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/services/logger";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_BASE_URL = "https://api.apollo.io/v1";
const APOLLO_MIXED_PEOPLE_ENDPOINT = `${APOLLO_API_BASE_URL}/mixed_people/search`;

/**
 * POST /api/company-selection/apollo/test
 * Testowanie Apollo API - sprawdzanie kiedy zużywany jest kredyt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      testType, 
      personId, 
      organizationId, 
      organizationName, 
      domain,
      includePersonalEmails 
    } = body;

    if (!APOLLO_API_KEY) {
      return NextResponse.json(
        { success: false, error: "APOLLO_API_KEY nie jest ustawiony" },
        { status: 500 }
      );
    }

    const results: any[] = [];

    // Test 1: Sprawdzenie osoby przez people/search (bez reveal_personal_emails)
    if (testType === "check_person" || testType === "all") {
      try {
        logger.info("apollo-test", `Test 1: Sprawdzanie osoby ${personId} przez people/search (DARMOWE)`);
        
        const response = await fetch(`${APOLLO_API_BASE_URL}/people/search`, {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "X-Api-Key": APOLLO_API_KEY,
          },
          body: JSON.stringify({
            person_ids: [personId],
            per_page: 1,
            person_details: false,
          }),
        });

        const data = await response.json();
        results.push({
          test: "Test 1: people/search (bez reveal_personal_emails)",
          status: response.status,
          success: response.ok,
          personFound: !!data.people?.[0],
          person: data.people?.[0] ? {
            id: data.people[0].id,
            name: data.people[0].name,
            organization: data.people[0].organization?.name,
            organizationId: data.people[0].organization?.id || data.people[0].organization_id,
            domain: data.people[0].organization?.primary_domain || data.people[0].organization?.domain,
            email: data.people[0].email,
            emailStatus: data.people[0].email_status || data.people[0].contact_email_status,
          } : null,
          creditsUsed: 0, // To nie powinno zużywać kredytu
        });
      } catch (error: any) {
        results.push({
          test: "Test 1: people/search (bez reveal_personal_emails)",
          success: false,
          error: error.message,
        });
      }
    }

    // Test 2: Sprawdzenie osoby przez people/search (z reveal_personal_emails)
    if (testType === "check_person_with_email" || testType === "all") {
      try {
        logger.info("apollo-test", `Test 2: Sprawdzanie osoby ${personId} przez people/search (ZUŻYWA KREDYT!)`);
        
        const response = await fetch(`${APOLLO_API_BASE_URL}/people/search`, {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/json",
            "X-Api-Key": APOLLO_API_KEY,
          },
          body: JSON.stringify({
            person_ids: [personId],
            reveal_personal_emails: true,
            per_page: 1,
          }),
        });

        const data = await response.json();
        results.push({
          test: "Test 2: people/search (z reveal_personal_emails=true)",
          status: response.status,
          success: response.ok,
          personFound: !!data.people?.[0],
          person: data.people?.[0] ? {
            id: data.people[0].id,
            name: data.people[0].name,
            email: data.people[0].email,
            emailStatus: data.people[0].email_status,
          } : null,
          creditsUsed: response.ok ? 1 : 0, // To ZUŻYWA kredyt jeśli sukces
          note: response.ok ? "⚠️ KREDYT ZOSTAŁ ZUŻYTY!" : "Kredyt nie został zużyty (błąd API)",
        });
      } catch (error: any) {
        results.push({
          test: "Test 2: people/search (z reveal_personal_emails=true)",
          success: false,
          error: error.message,
          creditsUsed: 0,
        });
      }
    }

    // Test 3: Sprawdzenie przez mixed_people/search (bez include_personal_emails)
    if ((testType === "check_mixed" || testType === "all") && (organizationId || organizationName || domain)) {
      try {
        logger.info("apollo-test", `Test 3: Sprawdzanie przez mixed_people/search (DARMOWE)`);
        
        const payload: any = {
          page: 1,
          per_page: 100,
          contact_scopes: {
            include_non_exportable_companies: true,
            // NIE ustawiamy include_personal_emails
          },
        };

        if (organizationId) {
          payload.organization_ids = [organizationId];
        } else if (organizationName) {
          payload.q_organization_name = organizationName;
        } else if (domain) {
          payload.q_company_domains = [domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]];
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

        const data = await response.json();
        const contacts = data.contacts || [];
        const people = data.people || [];
        const personInContacts = contacts.find((c: any) => (c.person_id || c.id) === personId);
        const personInPeople = people.find((p: any) => p.id === personId);
        const personFound = !!personInContacts || !!personInPeople;

        results.push({
          test: "Test 3: mixed_people/search (bez include_personal_emails)",
          status: response.status,
          success: response.ok,
          personFound,
          totalContacts: contacts.length,
          totalPeople: people.length,
          person: personInContacts || personInPeople ? {
            id: (personInContacts || personInPeople).id || (personInContacts || personInPeople).person_id,
            name: (personInContacts || personInPeople).name,
            email: (personInContacts || personInPeople).email,
            emailStatus: (personInContacts || personInPeople).email_status,
          } : null,
          creditsUsed: 0, // To nie powinno zużywać kredytu
        });
      } catch (error: any) {
        results.push({
          test: "Test 3: mixed_people/search (bez include_personal_emails)",
          success: false,
          error: error.message,
        });
      }
    }

    // Test 4: Sprawdzenie przez mixed_people/search (z include_personal_emails)
    if ((testType === "check_mixed_with_email" || testType === "all") && (organizationId || organizationName || domain)) {
      try {
        logger.info("apollo-test", `Test 4: Sprawdzanie przez mixed_people/search (ZUŻYWA KREDYT!)`);
        
        const payload: any = {
          page: 1,
          per_page: 100,
          contact_scopes: {
            include_non_exportable_companies: true,
            include_personal_emails: true, // To ZUŻYWA kredyt
          },
        };

        if (organizationId) {
          payload.organization_ids = [organizationId];
        } else if (organizationName) {
          payload.q_organization_name = organizationName;
        } else if (domain) {
          payload.q_company_domains = [domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]];
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

        const data = await response.json();
        const contacts = data.contacts || [];
        const people = data.people || [];
        const personInContacts = contacts.find((c: any) => (c.person_id || c.id) === personId);
        const personInPeople = people.find((p: any) => p.id === personId);
        const personFound = !!personInContacts || !!personInPeople;

        results.push({
          test: "Test 4: mixed_people/search (z include_personal_emails=true)",
          status: response.status,
          success: response.ok,
          personFound,
          totalContacts: contacts.length,
          totalPeople: people.length,
          person: personInContacts || personInPeople ? {
            id: (personInContacts || personInPeople).id || (personInContacts || personInPeople).person_id,
            name: (personInContacts || personInPeople).name,
            email: (personInContacts || personInPeople).email,
            emailStatus: (personInContacts || personInPeople).email_status,
            contactEmails: (personInContacts || personInPeople).contact_emails,
          } : null,
          creditsUsed: response.ok ? 1 : 0, // To ZUŻYWA kredyt jeśli sukces
          note: response.ok ? "⚠️ KREDYT ZOSTAŁ ZUŻYTY (nawet jeśli osoba nie została znaleziona)!" : "Kredyt nie został zużyty (błąd API)",
        });
      } catch (error: any) {
        results.push({
          test: "Test 4: mixed_people/search (z include_personal_emails=true)",
          success: false,
          error: error.message,
          creditsUsed: 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalTests: results.length,
        successfulTests: results.filter(r => r.success).length,
        totalCreditsUsed: results.reduce((sum, r) => sum + (r.creditsUsed || 0), 0),
        personFoundInAnyTest: results.some(r => r.personFound),
      },
    });
  } catch (error: any) {
    logger.error("apollo-test", "Błąd testowania Apollo API", {}, error);
    return NextResponse.json(
      {
        success: false,
        error: "Błąd testowania Apollo API",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

