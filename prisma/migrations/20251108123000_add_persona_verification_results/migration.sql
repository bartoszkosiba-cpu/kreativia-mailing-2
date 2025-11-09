-- CreateTable PersonaVerificationResult
CREATE TABLE "PersonaVerificationResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "personaCriteriaId" INTEGER,
    "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "unknownCount" INTEGER NOT NULL DEFAULT 0,
    "employees" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonaVerificationResult_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonaVerificationResult_personaCriteriaId_fkey" FOREIGN KEY ("personaCriteriaId") REFERENCES "CompanyPersonaCriteria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "PersonaVerificationResult_companyId_key" ON "PersonaVerificationResult"("companyId");
CREATE INDEX "PersonaVerificationResult_verifiedAt_idx" ON "PersonaVerificationResult"("verifiedAt");
