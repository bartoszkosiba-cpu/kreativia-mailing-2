-- Add market column to import batches
ALTER TABLE "CompanyImportBatch" ADD COLUMN "market" TEXT NOT NULL DEFAULT 'PL';

-- Add market column to companies
ALTER TABLE "Company" ADD COLUMN "market" TEXT;

-- Create table for company selections
CREATE TABLE "CompanySelection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "market" TEXT NOT NULL,
    "language" TEXT,
    "filters" TEXT,
    "totalCompanies" INTEGER NOT NULL DEFAULT 0,
    "activeCompanies" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "CompanySelection_market_idx" ON "CompanySelection"("market");
CREATE INDEX "CompanySelection_createdAt_idx" ON "CompanySelection"("createdAt");

-- Create junction table for companies assigned to selections
CREATE TABLE "CompanySelectionCompany" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "selectionId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "score" REAL,
    "reason" TEXT,
    "verifiedAt" DATETIME,
    "verificationResult" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanySelectionCompany_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "CompanySelection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanySelectionCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CompanySelectionCompany_selectionId_companyId_key" ON "CompanySelectionCompany"("selectionId", "companyId");
CREATE INDEX "CompanySelectionCompany_selectionId_status_idx" ON "CompanySelectionCompany"("selectionId", "status");
CREATE INDEX "CompanySelectionCompany_companyId_idx" ON "CompanySelectionCompany"("companyId");

-- Add optional relation from verification criteria to selection
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CompanyVerificationCriteria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "selectionId" INTEGER,
    "criteriaText" TEXT NOT NULL,
    "qualifiedKeywords" TEXT,
    "rejectedKeywords" TEXT,
    "qualifiedThreshold" REAL NOT NULL DEFAULT 0.8,
    "rejectedThreshold" REAL NOT NULL DEFAULT 0.3,
    "chatHistory" TEXT,
    "lastUserMessage" TEXT,
    "lastAIResponse" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanyVerificationCriteria_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "CompanySelection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_CompanyVerificationCriteria" (
    "id",
    "name",
    "description",
    "criteriaText",
    "qualifiedKeywords",
    "rejectedKeywords",
    "qualifiedThreshold",
    "rejectedThreshold",
    "chatHistory",
    "lastUserMessage",
    "lastAIResponse",
    "isActive",
    "isDefault",
    "createdAt",
    "updatedAt"
) SELECT
    "id",
    "name",
    "description",
    "criteriaText",
    "qualifiedKeywords",
    "rejectedKeywords",
    "qualifiedThreshold",
    "rejectedThreshold",
    "chatHistory",
    "lastUserMessage",
    "lastAIResponse",
    "isActive",
    "isDefault",
    "createdAt",
    "updatedAt"
FROM "CompanyVerificationCriteria";

DROP TABLE "CompanyVerificationCriteria";
ALTER TABLE "new_CompanyVerificationCriteria" RENAME TO "CompanyVerificationCriteria";

CREATE INDEX "CompanyVerificationCriteria_isActive_idx" ON "CompanyVerificationCriteria"("isActive");
CREATE INDEX "CompanyVerificationCriteria_isDefault_idx" ON "CompanyVerificationCriteria"("isDefault");
CREATE INDEX "CompanyVerificationCriteria_selectionId_idx" ON "CompanyVerificationCriteria"("selectionId");

PRAGMA foreign_keys=ON;

-- Ensure index for new company market column
CREATE INDEX "Company_market_idx" ON "Company"("market");

