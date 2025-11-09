-- Add keywords and apolloAccountId columns to Company
PRAGMA foreign_keys=OFF;

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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_Company" (
  "id", "name", "industry", "country", "city", "postalCode", "street", "buildingNumber", "website",
  "description", "activityDescription", "nip", "regon", "krs", "legalForm", "establishmentDate",
  "companySize", "employeeCount", "revenue", "netProfit", "locationCount", "ratingPoints",
  "sicCode", "naceCode", "verificationStatus", "verificationResult", "verificationScore",
  "verificationReason", "verificationComment", "confidenceThreshold", "verifiedAt", "verifiedBy",
  "verificationSource", "scrapedContent", "scrapedAt", "notes", "tags", "csvVerificationDate",
  "csvVerificationStatus", "csvModificationDate", "csvModifiedBy", "createdAt", "updatedAt"
)
SELECT
  "id", "name", "industry", "country", "city", "postalCode", "street", "buildingNumber", "website",
  "description", "activityDescription", "nip", "regon", "krs", "legalForm", "establishmentDate",
  "companySize", "employeeCount", "revenue", "netProfit", "locationCount", "ratingPoints",
  "sicCode", "naceCode", "verificationStatus", "verificationResult", "verificationScore",
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

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

