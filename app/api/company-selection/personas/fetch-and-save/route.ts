import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/services/logger";
import { fetchApolloEmployeesForCompany } from "@/services/apolloEmployeesService";
import { getPersonaVerification } from "@/services/personaVerificationService";
import { searchPeopleFromOrganization, searchOrganizations } from "@/services/apolloService";
import { createProgress, updateProgress as updateProgressService } from "@/services/verificationProgress";

interface FetchAndSaveRequest {
  companyIds: number[];
  selectionId?: number;
  personaCriteriaId?: number;
  revealEmails?: boolean; // Czy pobierać emaile (zużywa kredyty Apollo)
  positiveEmployeesOnly?: boolean; // Czy zapisać tylko pozytywne persony
  progressId?: string; // ID postępu (opcjonalnie, jeśli już istnieje)
}

interface FetchResult {
  companyId: number;
  companyName: string;
  success: boolean;
  employeesCount: number;
  createdCount?: number; // Nowe rekordy
  updatedCount?: number; // Zaktualizowane rekordy
  employeesWithEmail: number;
  employeesWithoutEmail: number;
  creditsUsed?: number;
  error?: string;
}

/**
 * POST /api/company-selection/personas/fetch-and-save
 * Pobiera dane z Apollo i zapisuje do bazy danych
 */
export async function POST(req: NextRequest) {
  try {
    const body: FetchAndSaveRequest = await req.json();
    const { companyIds, selectionId, personaCriteriaId, revealEmails = false, positiveEmployeesOnly = false, progressId } = body;

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Lista ID firm jest wymagana" },
        { status: 400 }
      );
    }

    // Jeśli progressId nie jest podany, utwórz nowy postęp
    let currentProgressId = progressId;
    if (!currentProgressId) {
      currentProgressId = createProgress(companyIds.length);
    }

    const results: FetchResult[] = [];
    let totalEmployees = 0;
    let totalCreated = 0; // Suma nowych rekordów
    let totalUpdated = 0; // Suma zaktualizowanych rekordów
    let totalEmployeesWithEmail = 0;
    let totalEmployeesWithoutEmail = 0;
    let totalCreditsUsed = 0;
    let successCount = 0;
    let errorCount = 0;

    // Pobierz dane z weryfikacji AI jeśli personaCriteriaId jest podane
    const verificationDataMap = new Map<number, any>();
    if (personaCriteriaId) {
      for (const companyId of companyIds) {
        try {
          const verification = await getPersonaVerification(companyId, personaCriteriaId);
          if (verification && verification.employees) {
            const employees = JSON.parse(verification.employees);
            // Mapuj po różnych kluczach dla lepszego dopasowania
            const employeeMap = new Map<string, any>();
            for (const emp of employees) {
              // Dodaj różne klucze dla lepszego dopasowania
              const keys = [
                emp.matchKey,
                emp.titleNormalized,
                emp.title,
                emp.name,
                `${emp.first_name || emp.firstName || ""}_${emp.last_name || emp.lastName || ""}`,
                emp.id ? String(emp.id) : null,
              ].filter(Boolean).map((k: any) => String(k).toLowerCase());
              
              for (const key of keys) {
                if (key) {
                  employeeMap.set(key, emp);
                }
              }
            }
            verificationDataMap.set(companyId, employeeMap);
          }
        } catch (error) {
          logger.warn("apollo-fetch-save", `Błąd pobierania weryfikacji dla firmy ${companyId}`, { companyId, error: error as Error });
        }
      }
    }

    // Pobierz dane z Apollo dla każdej firmy
    for (let i = 0; i < companyIds.length; i++) {
      const companyId = companyIds[i];
      try {
        // Aktualizuj postęp - aktualna firma
        updateProgressService(currentProgressId, {
          current: i + 1,
          currentCompanyName: `Firma #${companyId}`,
        });
        const company = await db.company.findUnique({
          where: { id: companyId },
          select: { id: true, name: true, website: true },
        });

        if (!company) {
          results.push({
            companyId,
            companyName: `Firma #${companyId}`,
            success: false,
            employeesCount: 0,
            employeesWithEmail: 0,
            employeesWithoutEmail: 0,
            error: "Firma nie została znaleziona w bazie",
          });
          errorCount++;
          continue;
        }

        // Pobierz dane z Apollo
        let apolloResult = await fetchApolloEmployeesForCompany(companyId);

        if (!apolloResult.success || !apolloResult.people || apolloResult.people.length === 0) {
          results.push({
            companyId,
            companyName: company.name,
            success: false,
            employeesCount: 0,
            employeesWithEmail: 0,
            employeesWithoutEmail: 0,
            error: apolloResult.message || "Brak danych z Apollo",
          });
          errorCount++;
          continue;
        }

        // Jeśli revealEmails=true, pobierz emaile (zużywa kredyty)
        let employees = apolloResult.people;
        let creditsUsed = 0;

        if (revealEmails && apolloResult.apolloOrganization?.id) {
          // Pobierz emaile z Apollo (zużywa kredyty)
          try {
            const peopleWithEmails = await searchPeopleFromOrganization(
              apolloResult.apolloOrganization.id,
              undefined,
              undefined,
              {
                page: 1,
                perPage: 100,
                revealEmails: true,
              }
            );
            
            // Mapuj emaile do istniejących pracowników
            const emailMap = new Map<string, any>();
            for (const person of peopleWithEmails.people || []) {
              const key = person.id ? String(person.id) : `${person.first_name || ""}_${person.last_name || ""}_${person.title || ""}`;
              if (key) {
                emailMap.set(key, person);
              }
            }

            // Zaktualizuj emaile w employees
            employees = employees.map((emp: any) => {
              const key = emp.id ? String(emp.id) : `${emp.first_name || emp.firstName || ""}_${emp.last_name || emp.lastName || ""}_${emp.title || ""}`;
              const personWithEmail = emailMap.get(key);
              if (personWithEmail && personWithEmail.email) {
                return {
                  ...emp,
                  email: personWithEmail.email,
                  emailUnlocked: true,
                  emailStatus: personWithEmail.email_status || personWithEmail.contact_email_status || null,
                };
              }
              return emp;
            });

            creditsUsed = employees.filter((p: any) => p.email && p.emailUnlocked).length;
          } catch (emailError) {
            logger.warn("apollo-fetch-save", `Błąd pobierania emaili dla firmy ${companyId}`, { companyId, error: emailError as Error });
            // Kontynuuj bez emaili
          }
        }

        // Pobierz dane weryfikacji AI dla tej firmy (jeśli są)
        const verificationMap = verificationDataMap.get(companyId);

        // Jeśli positiveEmployeesOnly=true, filtruj tylko pozytywne persony
        let employeesToSave = employees;
        if (positiveEmployeesOnly) {
          if (verificationMap && verificationMap.size > 0) {
            // Filtruj tylko pozytywne persony z weryfikacji AI
            const matchedEmployees: any[] = [];
            const unmatchedEmployees: any[] = [];
            
            employeesToSave = employees.filter((person: any) => {
              // Spróbuj różne klucze do dopasowania
              const matchKey = person.matchKey || (person.id ? String(person.id) : null);
              const titleNormalized = person.titleNormalized?.toLowerCase() || person.title?.toLowerCase() || "";
              const nameKey = person.name ? person.name.toLowerCase() : "";
              const firstName = (person.first_name || person.firstName || "").toLowerCase();
              const lastName = (person.last_name || person.lastName || "").toLowerCase();
              
              // Spróbuj dopasować po różnych kluczach
              const keys = [
                matchKey?.toLowerCase(),
                titleNormalized,
                nameKey,
                `${firstName}_${lastName}`,
                `${lastName}_${firstName}`,
                person.id ? String(person.id).toLowerCase() : null,
              ].filter(Boolean);
              
              let matched = false;
              for (const key of keys) {
                if (key) {
                  const verifiedEmployee = verificationMap.get(key);
                  if (verifiedEmployee) {
                    matched = true;
                    const decision = verifiedEmployee.decision || verifiedEmployee.personaMatchStatus;
                    if (decision === "positive") {
                      matchedEmployees.push({ person, key, verifiedEmployee });
                      return true;
                    }
                  }
                }
              }
              
              if (!matched) {
                unmatchedEmployees.push({ person, keys });
              }
              return false;
            });
            
            logger.info("apollo-fetch-save", `Filtrowanie pozytywnych person dla firmy ${company.name}`, {
              companyId,
              totalEmployees: employees.length,
              filteredEmployees: employeesToSave.length,
              verificationMapSize: verificationMap.size,
              matchedCount: matchedEmployees.length,
              unmatchedCount: unmatchedEmployees.length,
              sampleUnmatched: unmatchedEmployees.slice(0, 3).map((u: any) => ({
                title: u.person.title,
                name: u.person.name,
                keys: u.keys,
              })),
            });
          } else {
            // Jeśli nie ma weryfikacji, ale positiveEmployeesOnly=true, nie zapisuj nic
            logger.warn("apollo-fetch-save", `Brak weryfikacji dla firmy ${companyId}, ale positiveEmployeesOnly=true`, { 
              companyId,
              hasPersonaCriteriaId: !!personaCriteriaId,
            });
            employeesToSave = [];
          }
        } else {
          logger.info("apollo-fetch-save", `Zapisywanie wszystkich person dla firmy ${company.name}`, {
            companyId,
            totalEmployees: employees.length,
          });
        }

        // Zapisz pracowników do bazy danych
        let savedCount = 0;
        let createdCount = 0; // Nowe rekordy
        let updatedCount = 0; // Zaktualizowane rekordy
        let employeesWithEmail = 0;
        let employeesWithoutEmail = 0;
        let saveErrors = 0;

        // FILTRUJ TYLKO LEADY Z DOSTĘPNYMI EMAILAMI (osoby z adresem e-mail to leady)
        // Zapisujemy TYLKO leady, które mają FAKTYCZNY dostępny email
        const leadsToSave = employeesToSave.filter((person: any) => {
          const email = person.email;
          const emailStatus = person.emailStatus || person.contact_email_status || null;
          const emailUnlocked = person.emailUnlocked || false;
          
          // Email musi być faktycznie dostępny (nie placeholder)
          const hasRealEmail = email && 
                               email !== "email_not_unlocked@domain.com" && 
                               email.trim() !== "" &&
                               email.includes("@");
          
          // Email jest dostępny jeśli:
          // 1. Ma faktyczny email I (jest odblokowany LUB status wskazuje na dostępność)
          // 2. Status emaila wskazuje na dostępność: verified, guessed (unverified i extrapolated mogą być niedostępne)
          const isEmailAvailable = hasRealEmail && (
            emailUnlocked || 
            emailStatus === "verified" || 
            emailStatus === "guessed"
          );
          
          return isEmailAvailable;
        });

        logger.info("apollo-fetch-save", `Przygotowanie do zapisu leadów dla firmy ${company.name}`, {
          companyId,
          employeesToSaveCount: employeesToSave.length,
          leadsToSaveCount: leadsToSave.length,
          totalEmployeesFromApollo: employees.length,
          positiveEmployeesOnly,
          hasVerificationMap: !!verificationMap,
          verificationMapSize: verificationMap?.size || 0,
        });

        if (leadsToSave.length === 0 && employeesToSave.length > 0) {
          logger.warn("apollo-fetch-save", `Brak leadów z emailami do zapisania dla firmy ${company.name}`, {
            companyId,
            totalEmployees: employees.length,
            employeesToSaveCount: employeesToSave.length,
            positiveEmployeesOnly,
            hasVerificationMap: !!verificationMap,
            verificationMapSize: verificationMap?.size || 0,
          });
        }

        for (const person of leadsToSave) {
          // Wszystkie leady w leadsToSave mają już dostępny email (przefiltrowane wcześniej)
          const email = person.email;
          const emailStatus = person.emailStatus || person.contact_email_status || null;
          const emailUnlocked = person.emailUnlocked || false;
          
          // Wszystkie leady tutaj mają email (bo zostały przefiltrowane)
          employeesWithEmail++;

          // Spróbuj dopasować do weryfikacji AI
          let decision: string | null = null;
          let score: number | null = null;
          let reason: string | null = null;

          if (verificationMap) {
            const matchKey = person.matchKey || person.id ? String(person.id) : null;
            const titleNormalized = person.titleNormalized?.toLowerCase() || "";
            const key = matchKey?.toLowerCase() || titleNormalized;

            if (key) {
              const verifiedEmployee = verificationMap.get(key);
              if (verifiedEmployee) {
                decision = verifiedEmployee.decision || null;
                score = verifiedEmployee.score || null;
                reason = verifiedEmployee.reason || null;
              }
            }
          }

          // Przygotuj dane do zapisu
          const departments = Array.isArray(person.departments) 
            ? JSON.stringify(person.departments) 
            : (person.departments ? String(person.departments) : null);

          try {
            // Sprawdź czy pracownik już istnieje (po apolloPersonId + companyId)
            const apolloPersonId = person.id ? String(person.id) : null;
            
            logger.debug("apollo-fetch-save", `Próba zapisu leada dla firmy ${companyId}`, {
              companyId,
              apolloPersonId,
              personTitle: person.title,
              personName: person.name,
              email: email || "brak",
            });
            
            // Sprawdź czy model apolloEmployee jest dostępny
            if (!(db as any).apolloEmployee) {
              throw new Error("Model apolloEmployee nie jest dostępny w Prisma Client. Uruchom 'npx prisma generate' i zrestartuj serwer.");
            }
            
            if (apolloPersonId) {
              const existing = await (db as any).apolloEmployee.findFirst({
                where: {
                  companyId: company.id,
                  apolloPersonId,
                },
              });

              if (existing) {
                // Aktualizuj istniejący rekord
                logger.debug("apollo-fetch-save", `Aktualizacja istniejącego pracownika dla firmy ${companyId}`, {
                  companyId,
                  apolloPersonId,
                  existingId: existing.id,
                });
                await (db as any).apolloEmployee.update({
                  where: { id: existing.id },
                  data: {
                    firstName: person.first_name || person.firstName || existing.firstName,
                    lastName: person.last_name || person.lastName || existing.lastName,
                    title: person.title || existing.title,
                    email: email || existing.email,
                    emailStatus: emailStatus ? String(emailStatus).toLowerCase() : existing.emailStatus,
                    emailUnlocked: emailUnlocked || existing.emailUnlocked,
                    linkedinUrl: person.linkedin_url || person.linkedinUrl || existing.linkedinUrl,
                    departments,
                    seniority: person.seniority || existing.seniority,
                    decision: decision || existing.decision,
                    score: score !== null ? score : existing.score,
                    reason: reason || existing.reason,
                    apolloFetchedAt: new Date(),
                    verifiedAt: decision ? new Date() : existing.verifiedAt,
                    updatedAt: new Date(),
                  },
                });
                savedCount++;
                updatedCount++;
                logger.debug("apollo-fetch-save", `Zaktualizowano pracownika dla firmy ${companyId}`, {
                  companyId,
                  apolloPersonId,
                  savedCount,
                  updatedCount,
                });
              } else {
                // Utwórz nowy rekord
                logger.debug("apollo-fetch-save", `Tworzenie nowego pracownika dla firmy ${companyId}`, {
                  companyId,
                  apolloPersonId,
                });
                await (db as any).apolloEmployee.create({
                  data: {
                    companyId: company.id,
                    selectionId: selectionId || null,
                    personaCriteriaId: personaCriteriaId || null,
                    apolloPersonId,
                    firstName: person.first_name || person.firstName || null,
                    lastName: person.last_name || person.lastName || null,
                    title: person.title || null,
                    email: email || null,
                    emailStatus: emailStatus ? String(emailStatus).toLowerCase() : null,
                    emailUnlocked,
                    linkedinUrl: person.linkedin_url || person.linkedinUrl || null,
                    departments,
                    seniority: person.seniority || null,
                    decision,
                    score,
                    reason,
                    apolloFetchedAt: new Date(),
                    verifiedAt: decision ? new Date() : null,
                  },
                });
                savedCount++;
                createdCount++;
              }
            } else {
              // Jeśli nie ma apolloPersonId, próbuj utworzyć (może być duplikat po emailu)
              try {
                await (db as any).apolloEmployee.create({
                  data: {
                    companyId: company.id,
                    selectionId: selectionId || null,
                    personaCriteriaId: personaCriteriaId || null,
                    apolloPersonId: null,
                    firstName: person.first_name || person.firstName || null,
                    lastName: person.last_name || person.lastName || null,
                    title: person.title || null,
                    email: email || null,
                    emailStatus: emailStatus ? String(emailStatus).toLowerCase() : null,
                    emailUnlocked,
                    linkedinUrl: person.linkedin_url || person.linkedinUrl || null,
                    departments,
                    seniority: person.seniority || null,
                    decision,
                    score,
                    reason,
                    apolloFetchedAt: new Date(),
                    verifiedAt: decision ? new Date() : null,
                  },
                });
                savedCount++;
              } catch (createError: any) {
                // Jeśli błąd to duplicate, zignoruj
                if (createError.code === "P2002" || createError.message?.includes("UNIQUE constraint")) {
                  logger.debug("apollo-fetch-save", `Pracownik już istnieje dla firmy ${companyId}`, { 
                    companyId,
                    personTitle: person.title,
                    personName: person.name,
                  });
                  // Zwiększ savedCount nawet jeśli to duplikat (bo rekord już istnieje)
                  savedCount++;
                } else {
                  logger.error("apollo-fetch-save", `Błąd tworzenia pracownika bez apolloPersonId dla firmy ${companyId}`, {
                    companyId,
                    personTitle: person.title,
                    personName: person.name,
                    errorCode: createError.code,
                    errorMessage: createError.message,
                  }, createError);
                  throw createError;
                }
              }
            }
          } catch (saveError: any) {
            saveErrors++;
            // Loguj szczegóły błędu
            logger.error("apollo-fetch-save", `Błąd zapisu pracownika dla firmy ${companyId}`, { 
              companyId, 
              personId: person.id,
              personTitle: person.title,
              personName: person.name,
              apolloPersonId: person.id ? String(person.id) : null,
              errorCode: saveError.code,
              errorMessage: saveError.message,
              errorStack: saveError.stack,
            }, saveError);
            // NIE zwiększamy savedCount w przypadku błędu
          }
        }

        logger.info("apollo-fetch-save", `Zakończono zapis leadów dla firmy ${company.name}`, {
          companyId,
          savedCount,
          createdCount,
          updatedCount,
          employeesWithEmail,
          employeesWithoutEmail,
          leadsToSaveCount: leadsToSave.length,
          employeesToSaveCount: employeesToSave.length,
          saveErrors,
          totalEmployeesFromApollo: employees.length,
        });

        totalEmployees += savedCount;
        totalCreated += createdCount;
        totalUpdated += updatedCount;
        totalEmployeesWithEmail += employeesWithEmail;
        totalEmployeesWithoutEmail += employeesWithoutEmail;
        totalCreditsUsed += creditsUsed;
        successCount++;

        results.push({
          companyId,
          companyName: company.name,
          success: true,
          employeesCount: savedCount,
          createdCount,
          updatedCount,
          employeesWithEmail,
          employeesWithoutEmail,
          creditsUsed,
        });

        // Aktualizuj postęp - przetworzona firma
        updateProgressService(currentProgressId, {
          processed: i + 1,
          qualified: successCount,
        });

        logger.info("apollo-fetch-save", `Zapisano ${savedCount} pracowników dla firmy ${company.name}`, {
          companyId,
          savedCount,
          employeesWithEmail,
          employeesWithoutEmail,
          employeesToSaveCount: employeesToSave.length,
          totalEmployeesFromApollo: employees.length,
          positiveEmployeesOnly,
          hasVerificationMap: !!verificationMap,
          verificationMapSize: verificationMap?.size || 0,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("apollo-fetch-save", `Błąd przetwarzania firmy ${companyId}`, { companyId }, err);
        
        results.push({
          companyId,
          companyName: `Firma #${companyId}`,
          success: false,
          employeesCount: 0,
          employeesWithEmail: 0,
          employeesWithoutEmail: 0,
          error: err.message,
        });
        errorCount++;

        // Aktualizuj postęp - błąd
        updateProgressService(currentProgressId, {
          processed: i + 1,
          errors: errorCount,
        });
      }
    }

    // Zakończ postęp
    updateProgressService(currentProgressId, {
      status: errorCount === companyIds.length ? "error" : "completed",
      processed: companyIds.length,
    });

    return NextResponse.json({
      success: true,
      progressId: currentProgressId,
      summary: {
        totalCompanies: companyIds.length,
        successCount,
        errorCount,
        totalEmployees,
        totalCreated,
        totalUpdated,
        totalEmployeesWithEmail,
        totalEmployeesWithoutEmail,
        totalCreditsUsed,
      },
      results,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("apollo-fetch-save", "Błąd pobierania i zapisywania danych", {}, err);
    return NextResponse.json(
      { success: false, error: "Błąd pobierania i zapisywania danych", details: err.message },
      { status: 500 }
    );
  }
}

