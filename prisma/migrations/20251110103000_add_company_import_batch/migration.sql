PRAGMA foreign_keys=OFF;

CREATE TABLE "CompanyImportBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "CompanyImportBatch_createdAt_index" ON "CompanyImportBatch"("createdAt");

CREATE TABLE "new_Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "country" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "street" TEXT,
    "buildingNumber" TEXT,
    "website" TEXT,
    "description" TEXT,
    "activityDescription" TEXT,
    "nip" TEXT,
    "regon" TEXT,
    "krs" TEXT,
    "legalForm" TEXT,
    "establishmentDate" DATETIME,
    "companySize" TEXT,
    "employeeCount" TEXT,
    "revenue" TEXT,
    "netProfit" TEXT,
    "locationCount" INTEGER,
    "ratingPoints" INTEGER,
    "keywords" TEXT,
    "apolloAccountId" TEXT,
    "sicCode" TEXT,
    "naceCode" TEXT,
    "importBatchId" INTEGER,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationResult" TEXT,
    "verificationScore" REAL,
    "verificationReason" TEXT,
    "verificationComment" TEXT,
    "confidenceThreshold" REAL,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "verificationSource" TEXT,
    "scrapedContent" TEXT,
    "scrapedAt" DATETIME,
    "notes" TEXT,
    "tags" TEXT,
    "csvVerificationDate" DATETIME,
    "csvVerificationStatus" TEXT,
    "csvModificationDate" DATETIME,
    "csvModifiedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "CompanyImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Company" (
  "id", "name", "industry", "country", "city", "postalCode", "street", "buildingNumber", "website",
  "description", "activityDescription", "nip", "regon", "krs", "legalForm", "establishmentDate",
  "companySize", "employeeCount", "revenue", "netProfit", "locationCount", "ratingPoints",
  "keywords", "apolloAccountId", "sicCode", "naceCode", "importBatchId", "verificationStatus", "verificationResult", "verificationScore",
  "verificationReason", "verificationComment", "confidenceThreshold", "verifiedAt", "verifiedBy",
  "verificationSource", "scrapedContent", "scrapedAt", "notes", "tags", "csvVerificationDate",
  "csvVerificationStatus", "csvModificationDate", "csvModifiedBy", "createdAt", "updatedAt"
)
SELECT
  "id", "name", "industry", "country", "city", "postalCode", "street", "buildingNumber", "website",
  "description", "activityDescription", "nip", "regon", "krs", "legalForm", "establishmentDate",
  "companySize", "employeeCount", "revenue", "netProfit", "locationCount", "ratingPoints",
  "keywords", "apolloAccountId", "sicCode", "naceCode", NULL, "verificationStatus", "verificationResult", "verificationScore",
  "verificationReason", "verificationComment", "confidenceThreshold", "verifiedAt", "verifiedBy",
  "verificationSource", "scrapedContent", "scrapedAt", "notes", "tags", "csvVerificationDate",
  "csvVerificationStatus", "csvModificationDate", "csvModifiedBy", "createdAt", "updatedAt"
FROM "Company";

DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";

CREATE INDEX "Company_verificationStatus_index" ON "Company"("verificationStatus");
CREATE INDEX "Company_verifiedAt_index" ON "Company"("verifiedAt");
CREATE INDEX "Company_industry_index" ON "Company"("industry");
CREATE INDEX "Company_country_index" ON "Company"("country");
CREATE INDEX "Company_importBatchId_index" ON "Company"("importBatchId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

