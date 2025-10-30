-- AlterTable
ALTER TABLE "SendLog" ADD COLUMN "variantLetter" TEXT;

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_virtualSalespersonId_fkey" FOREIGN KEY ("virtualSalespersonId") REFERENCES "VirtualSalesperson" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "CampaignVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_savedContentId_fkey" FOREIGN KEY ("savedContentId") REFERENCES "SavedContent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_parentCampaignId_fkey" FOREIGN KEY ("parentCampaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("allowedDays", "contentVersionId", "createdAt", "dailyLimit", "delayBetweenEmails", "description", "endHour", "endMinute", "estimatedEndDate", "estimatedStartDate", "followUpDays", "followUpSequence", "gmailLabel", "id", "isFollowUp", "jobDescription", "linkText", "linkUrl", "maxEmailsPerDay", "name", "parentCampaignId", "postscript", "queuePriority", "respectHolidays", "savedContentId", "scheduledAt", "sendingCompletedAt", "sendingStartedAt", "startHour", "startMinute", "status", "subject", "targetCountries", "text", "updatedAt", "virtualSalespersonId") SELECT "allowedDays", "contentVersionId", "createdAt", "dailyLimit", "delayBetweenEmails", "description", "endHour", "endMinute", "estimatedEndDate", "estimatedStartDate", "followUpDays", "followUpSequence", "gmailLabel", "id", "isFollowUp", "jobDescription", "linkText", "linkUrl", "maxEmailsPerDay", "name", "parentCampaignId", "postscript", "queuePriority", "respectHolidays", "savedContentId", "scheduledAt", "sendingCompletedAt", "sendingStartedAt", "startHour", "startMinute", "status", "subject", "targetCountries", "text", "updatedAt", "virtualSalespersonId" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
