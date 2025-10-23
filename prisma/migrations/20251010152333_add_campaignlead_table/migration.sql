-- CreateTable
CREATE TABLE "CampaignLead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "leadId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "industry" TEXT,
    "keywords" TEXT,
    "linkedinUrl" TEXT,
    "websiteUrl" TEXT,
    "companyCity" TEXT,
    "companyCountry" TEXT,
    "campaignId" INTEGER,
    CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("campaignId", "company", "companyCity", "companyCountry", "email", "firstName", "id", "industry", "keywords", "lastName", "linkedinUrl", "title", "websiteUrl") SELECT "campaignId", "company", "companyCity", "companyCountry", "email", "firstName", "id", "industry", "keywords", "lastName", "linkedinUrl", "title", "websiteUrl" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CampaignLead_campaignId_leadId_key" ON "CampaignLead"("campaignId", "leadId");
