-- CreateTable
CREATE TABLE "Company" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompanyVerificationLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "score" REAL,
    "reason" TEXT,
    "source" TEXT,
    "content" TEXT,
    "aiModel" TEXT,
    "aiTokens" INTEGER,
    "aiCost" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyVerificationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyVerificationCriteria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Company_verificationStatus_idx" ON "Company"("verificationStatus");

-- CreateIndex
CREATE INDEX "Company_verifiedAt_idx" ON "Company"("verifiedAt");

-- CreateIndex
CREATE INDEX "Company_industry_idx" ON "Company"("industry");

-- CreateIndex
CREATE INDEX "Company_country_idx" ON "Company"("country");

-- CreateIndex
CREATE INDEX "CompanyVerificationLog_companyId_idx" ON "CompanyVerificationLog"("companyId");

-- CreateIndex
CREATE INDEX "CompanyVerificationLog_status_idx" ON "CompanyVerificationLog"("status");

-- CreateIndex
CREATE INDEX "CompanyVerificationLog_createdAt_idx" ON "CompanyVerificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "CompanyVerificationCriteria_isActive_idx" ON "CompanyVerificationCriteria"("isActive");

-- CreateIndex
CREATE INDEX "CompanyVerificationCriteria_isDefault_idx" ON "CompanyVerificationCriteria"("isDefault");

