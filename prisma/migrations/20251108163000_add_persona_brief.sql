-- DropIndex
DROP INDEX "AgendaRecommendation_status_idx";

-- DropIndex
DROP INDEX "AgendaRecommendation_companyId_idx";

-- DropIndex
DROP INDEX "AgendaRecommendation_campaignId_idx";

-- DropIndex
DROP INDEX "SendLog_campaignId_leadId_variantLetter_unique";

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "warmupSchedule" TEXT;

-- AlterTable
ALTER TABLE "VirtualSalesperson" ADD COLUMN "realSalespersonPhone" TEXT;
ALTER TABLE "VirtualSalesperson" ADD COLUMN "realSalespersonSignature" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AgendaRecommendation";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "BlockedCompany" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "text" TEXT,
    "jobDescription" TEXT,
    "postscript" TEXT,
    "linkText" TEXT,
    "linkUrl" TEXT,
    "gmailLabel" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 200,
    "virtualSalespersonId" INTEGER,
    "contentVersionId" INTEGER,
    "savedContentId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" DATETIME,
    "sendingStartedAt" DATETIME,
    "sendingCompletedAt" DATETIME,
    "delayBetweenEmails" INTEGER NOT NULL DEFAULT 90,
    "maxEmailsPerDay" INTEGER NOT NULL DEFAULT 500,
    "allowedDays" TEXT NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
    "startHour" INTEGER NOT NULL DEFAULT 9,
    "startMinute" INTEGER NOT NULL DEFAULT 0,
    "endHour" INTEGER NOT NULL DEFAULT 15,
    "endMinute" INTEGER NOT NULL DEFAULT 0,
    "respectHolidays" BOOLEAN NOT NULL DEFAULT true,
    "targetCountries" TEXT,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "parentCampaignId" INTEGER,
    "followUpSequence" INTEGER,
    "followUpDays" INTEGER NOT NULL DEFAULT 7,
    "queuePriority" INTEGER NOT NULL DEFAULT 999,
    "estimatedStartDate" DATETIME,
    "estimatedEndDate" DATETIME,
    "abTestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "abTestMode" TEXT,
    "subjectB" TEXT,
    "textB" TEXT,
    "jobDescriptionB" TEXT,
    "postscriptB" TEXT,
    "linkTextB" TEXT,
    "linkUrlB" TEXT,
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReplyContext" TEXT,
    "autoReplyRules" TEXT,
    "autoReplyDelayMinutes" INTEGER NOT NULL DEFAULT 15,
    "autoReplyContent" TEXT,
    "autoReplyGuardianTemplate" TEXT,
    "autoReplyGuardianTitle" TEXT,
    "autoReplyIncludeGuardian" BOOLEAN NOT NULL DEFAULT false,
    "autoReplyGuardianIntroText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_virtualSalespersonId_fkey" FOREIGN KEY ("virtualSalespersonId") REFERENCES "VirtualSalesperson" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "CampaignVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_savedContentId_fkey" FOREIGN KEY ("savedContentId") REFERENCES "SavedContent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_parentCampaignId_fkey" FOREIGN KEY ("parentCampaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("abTestEnabled", "abTestMode", "allowedDays", "autoReplyContent", "autoReplyContext", "autoReplyDelayMinutes", "autoReplyEnabled", "autoReplyGuardianIntroText", "autoReplyGuardianTemplate", "autoReplyGuardianTitle", "autoReplyIncludeGuardian", "autoReplyRules", "contentVersionId", "createdAt", "dailyLimit", "delayBetweenEmails", "description", "endHour", "endMinute", "estimatedEndDate", "estimatedStartDate", "followUpDays", "followUpSequence", "gmailLabel", "id", "isFollowUp", "jobDescription", "jobDescriptionB", "linkText", "linkTextB", "linkUrl", "linkUrlB", "maxEmailsPerDay", "name", "parentCampaignId", "postscript", "postscriptB", "queuePriority", "respectHolidays", "savedContentId", "scheduledAt", "sendingCompletedAt", "sendingStartedAt", "startHour", "startMinute", "status", "subject", "subjectB", "targetCountries", "text", "textB", "updatedAt", "virtualSalespersonId") SELECT "abTestEnabled", "abTestMode", "allowedDays", "autoReplyContent", "autoReplyContext", "autoReplyDelayMinutes", "autoReplyEnabled", "autoReplyGuardianIntroText", "autoReplyGuardianTemplate", "autoReplyGuardianTitle", "autoReplyIncludeGuardian", "autoReplyRules", "contentVersionId", "createdAt", "dailyLimit", "delayBetweenEmails", "description", "endHour", "endMinute", "estimatedEndDate", "estimatedStartDate", "followUpDays", "followUpSequence", "gmailLabel", "id", "isFollowUp", "jobDescription", "jobDescriptionB", "linkText", "linkTextB", "linkUrl", "linkUrlB", "maxEmailsPerDay", "name", "parentCampaignId", "postscript", "postscriptB", "queuePriority", "respectHolidays", "savedContentId", "scheduledAt", "sendingCompletedAt", "sendingStartedAt", "startHour", "startMinute", "status", "subject", "subjectB", "targetCountries", "text", "textB", "updatedAt", "virtualSalespersonId" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
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
INSERT INTO "new_Company" ("activityDescription", "buildingNumber", "city", "companySize", "confidenceThreshold", "country", "createdAt", "csvModificationDate", "csvModifiedBy", "csvVerificationDate", "csvVerificationStatus", "description", "employeeCount", "establishmentDate", "id", "industry", "krs", "legalForm", "locationCount", "naceCode", "name", "netProfit", "nip", "notes", "postalCode", "ratingPoints", "regon", "revenue", "scrapedAt", "scrapedContent", "sicCode", "street", "tags", "updatedAt", "verificationComment", "verificationReason", "verificationResult", "verificationScore", "verificationSource", "verificationStatus", "verifiedAt", "verifiedBy", "website") SELECT "activityDescription", "buildingNumber", "city", "companySize", "confidenceThreshold", "country", "createdAt", "csvModificationDate", "csvModifiedBy", "csvVerificationDate", "csvVerificationStatus", "description", "employeeCount", "establishmentDate", "id", "industry", "krs", "legalForm", "locationCount", "naceCode", "name", "netProfit", "nip", "notes", "postalCode", "ratingPoints", "regon", "revenue", "scrapedAt", "scrapedContent", "sicCode", "street", "tags", "updatedAt", "verificationComment", "verificationReason", "verificationResult", "verificationScore", "verificationSource", "verificationStatus", "verifiedAt", "verifiedBy", "website" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE INDEX "Company_verificationStatus_idx" ON "Company"("verificationStatus");
CREATE INDEX "Company_verifiedAt_idx" ON "Company"("verifiedAt");
CREATE INDEX "Company_industry_idx" ON "Company"("industry");
CREATE INDEX "Company_country_idx" ON "Company"("country");
CREATE TABLE "new_InboxReply" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER,
    "campaignId" INTEGER,
    "mailboxId" INTEGER,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "originalMessage" TEXT,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT,
    "receivedAt" DATETIME NOT NULL,
    "classification" TEXT,
    "sentiment" TEXT,
    "aiSummary" TEXT,
    "suggestedAction" TEXT,
    "extractedEmails" TEXT,
    "extractedData" TEXT,
    "wasForwarded" BOOLEAN NOT NULL DEFAULT false,
    "forwardedAt" DATETIME,
    "wasBlocked" BOOLEAN NOT NULL DEFAULT false,
    "newContactsAdded" INTEGER NOT NULL DEFAULT 0,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isHandled" BOOLEAN NOT NULL DEFAULT false,
    "handledAt" DATETIME,
    "handledNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxReply_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InboxReply_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InboxReply_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InboxReply" ("aiSummary", "campaignId", "classification", "content", "createdAt", "extractedData", "extractedEmails", "forwardedAt", "fromEmail", "handledAt", "handledNote", "id", "isHandled", "isRead", "leadId", "messageId", "newContactsAdded", "originalMessage", "receivedAt", "sentiment", "subject", "suggestedAction", "threadId", "toEmail", "wasBlocked", "wasForwarded") SELECT "aiSummary", "campaignId", "classification", "content", "createdAt", "extractedData", "extractedEmails", "forwardedAt", "fromEmail", "handledAt", "handledNote", "id", "isHandled", "isRead", "leadId", "messageId", "newContactsAdded", "originalMessage", "receivedAt", "sentiment", "subject", "suggestedAction", "threadId", "toEmail", "wasBlocked", "wasForwarded" FROM "InboxReply";
DROP TABLE "InboxReply";
ALTER TABLE "new_InboxReply" RENAME TO "InboxReply";
CREATE UNIQUE INDEX "InboxReply_messageId_key" ON "InboxReply"("messageId");
CREATE INDEX "InboxReply_mailboxId_idx" ON "InboxReply"("mailboxId");
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
    "language" TEXT DEFAULT 'pl',
    "personalization" TEXT,
    "greetingForm" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AKTYWNY',
    "subStatus" TEXT,
    "blockedCampaigns" TEXT,
    "reactivatedAt" DATETIME,
    "lastReactivation" TEXT,
    "inCRM" BOOLEAN NOT NULL DEFAULT false,
    "crmEnteredAt" DATETIME,
    "crmReadyForSales" BOOLEAN NOT NULL DEFAULT false,
    "originalLeadId" INTEGER,
    "source" TEXT,
    "sourceDetails" TEXT,
    "blockedReason" TEXT,
    "blockedAt" DATETIME,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "campaignId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_originalLeadId_fkey" FOREIGN KEY ("originalLeadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("blockedAt", "blockedCampaigns", "blockedReason", "campaignId", "company", "companyCity", "companyCountry", "createdAt", "email", "firstName", "greetingForm", "id", "industry", "isBlocked", "keywords", "language", "lastName", "lastReactivation", "linkedinUrl", "originalLeadId", "personalization", "reactivatedAt", "source", "sourceDetails", "status", "subStatus", "title", "updatedAt", "websiteUrl") SELECT "blockedAt", "blockedCampaigns", "blockedReason", "campaignId", "company", "companyCity", "companyCountry", "createdAt", "email", "firstName", "greetingForm", "id", "industry", "isBlocked", "keywords", "language", "lastName", "lastReactivation", "linkedinUrl", "originalLeadId", "personalization", "reactivatedAt", "source", "sourceDetails", "status", "subStatus", "title", "updatedAt", "websiteUrl" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BlockedCompany_companyName_idx" ON "BlockedCompany"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedCompany_companyName_key" ON "BlockedCompany"("companyName");

-- RedefineIndex
DROP INDEX "sqlite_autoindex_PersonaBrief_1";
CREATE UNIQUE INDEX "PersonaBrief_companyCriteriaId_key" ON "PersonaBrief"("companyCriteriaId");

