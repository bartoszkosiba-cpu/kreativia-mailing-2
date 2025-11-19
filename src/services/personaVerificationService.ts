import { db } from "@/lib/db";

export interface PersonaVerificationSaveInput {
  companyId: number;
  personaCriteriaId?: number | null;
  positiveCount: number;
  negativeCount: number;
  unknownCount: number;
  employees: unknown;
  metadata?: Record<string, unknown> | null;
}

export async function getPersonaVerification(
  companyId: number,
  personaCriteriaId: number | null = null
) {
  // Jeśli personaCriteriaId jest null, użyj findFirst z filtrem
  if (personaCriteriaId === null) {
    return db.personaVerificationResult.findFirst({
      where: {
        companyId,
        personaCriteriaId: null,
      },
    });
  }
  
  // Jeśli personaCriteriaId jest podane, użyj composite unique
  return db.personaVerificationResult.findUnique({
    where: {
      companyId_personaCriteriaId: {
        companyId,
        personaCriteriaId,
      },
    } as any, // Workaround: TypeScript nie widzi zaktualizowanych typów, ale w bazie constraint istnieje
  });
}

export async function listPersonaVerifications() {
  return db.personaVerificationResult.findMany({
    orderBy: { verifiedAt: "desc" },
  });
}

export async function savePersonaVerification(input: PersonaVerificationSaveInput) {
  const { companyId, personaCriteriaId, positiveCount, negativeCount, unknownCount, employees, metadata } = input;

  const employeesJson = typeof employees === "string" ? employees : JSON.stringify(employees);
  const metadataJson =
    metadata === undefined
      ? null
      : typeof metadata === "string"
      ? metadata
      : JSON.stringify(metadata ?? null);

  // Dla upsert musimy użyć odpowiedniego where clause
  // Jeśli personaCriteriaId jest null, musimy użyć findFirst + create/update zamiast upsert
  const finalPersonaCriteriaId = personaCriteriaId ?? null;
  
  if (finalPersonaCriteriaId === null) {
    // Dla null, sprawdź czy istnieje, a potem create lub update
    const existing = await db.personaVerificationResult.findFirst({
      where: {
        companyId,
        personaCriteriaId: null,
      },
    });
    
    if (existing) {
      return db.personaVerificationResult.update({
        where: { id: existing.id },
        data: {
          verifiedAt: new Date(),
          positiveCount,
          negativeCount,
          unknownCount,
          employees: employeesJson,
          metadata: metadataJson,
        },
      });
    } else {
      return db.personaVerificationResult.create({
        data: {
          companyId,
          personaCriteriaId: null,
          verifiedAt: new Date(),
          positiveCount,
          negativeCount,
          unknownCount,
          employees: employeesJson,
          metadata: metadataJson,
        },
      });
    }
  }

  // Dla non-null personaCriteriaId, użyj composite unique
  return db.personaVerificationResult.upsert({
    where: {
      companyId_personaCriteriaId: {
        companyId,
        personaCriteriaId: finalPersonaCriteriaId,
      },
    } as any, // Workaround: TypeScript nie widzi zaktualizowanych typów, ale w bazie constraint istnieje
    create: {
      companyId,
      personaCriteriaId: personaCriteriaId ?? null,
      verifiedAt: new Date(),
      positiveCount,
      negativeCount,
      unknownCount,
      employees: employeesJson,
      metadata: metadataJson,
    },
    update: {
      verifiedAt: new Date(),
      positiveCount,
      negativeCount,
      unknownCount,
      employees: employeesJson,
      metadata: metadataJson,
    },
  });
}

export async function deletePersonaVerification(companyId: number) {
  return db.personaVerificationResult.deleteMany({
    where: { companyId },
  });
}
