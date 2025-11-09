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

export async function getPersonaVerification(companyId: number) {
  return db.personaVerificationResult.findUnique({
    where: { companyId },
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

  return db.personaVerificationResult.upsert({
    where: { companyId },
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
      personaCriteriaId: personaCriteriaId ?? null,
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
