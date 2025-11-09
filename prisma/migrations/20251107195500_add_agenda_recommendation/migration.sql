-- CreateTable AgendaRecommendation
CREATE TABLE "AgendaRecommendation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "leadId" INTEGER,
    "externalId" TEXT,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "confidence" REAL,
    "reasoning" TEXT,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "notes" TEXT,
    "metadata" TEXT,
    CONSTRAINT "AgendaRecommendation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgendaRecommendation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgendaRecommendation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes dla szybkich zapytań
CREATE INDEX "AgendaRecommendation_campaignId_idx" ON "AgendaRecommendation" ("campaignId");
CREATE INDEX "AgendaRecommendation_companyId_idx" ON "AgendaRecommendation" ("companyId");
CREATE INDEX "AgendaRecommendation_status_idx" ON "AgendaRecommendation" ("status");
