-- CreateTable: CompanyPersonaCriteria
CREATE TABLE "CompanyPersonaCriteria" (
    "id"                 INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyCriteriaId"  INTEGER NOT NULL,
    "name"               TEXT NOT NULL,
    "description"        TEXT,
    "positiveRoles"      TEXT NOT NULL,
    "negativeRoles"      TEXT NOT NULL,
    "conditionalRules"   TEXT,
    "language"           TEXT,
    "chatHistory"        TEXT,
    "lastUserMessage"    TEXT,
    "lastAIResponse"     TEXT,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL,
    "createdBy"          TEXT,
    "updatedBy"          TEXT,
    CONSTRAINT "CompanyPersonaCriteria_companyCriteriaId_fkey" FOREIGN KEY ("companyCriteriaId") REFERENCES "CompanyVerificationCriteria" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CompanyPersonaCriteria_companyCriteriaId_key" ON "CompanyPersonaCriteria" ("companyCriteriaId");

-- AlterTable: Campaign (add personaCriteriaId with FK)
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Campaign" (
    "id"                   INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name"                 TEXT NOT NULL,
    "description"          TEXT,
    "subject"              TEXT,
    "text"                 TEXT,
    "jobDescription"       TEXT,
    "postscript"           TEXT,
    "linkText"             TEXT,
    "linkUrl"              TEXT,
    "gmailLabel"           TEXT,
    "dailyLimit"           INTEGER NOT NULL DEFAULT 200,
    "virtualSalespersonId" INTEGER,
    "contentVersionId"     INTEGER,
    "savedContentId"       INTEGER,
    "status"               TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt"          DATETIME,
    "sendingStartedAt"     DATETIME,
    "sendingCompletedAt"   DATETIME,
    "delayBetweenEmails"   INTEGER NOT NULL DEFAULT 90,
    "maxEmailsPerDay"      INTEGER NOT NULL DEFAULT 500,
    "allowedDays"          TEXT NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
    "startHour"            INTEGER NOT NULL DEFAULT 9,
    "startMinute"          INTEGER NOT NULL DEFAULT 0,
    "endHour"              INTEGER NOT NULL DEFAULT 15,
    "endMinute"            INTEGER NOT NULL DEFAULT 0,
    "respectHolidays"      BOOLEAN NOT NULL DEFAULT true,
    "targetCountries"      TEXT,
    "isFollowUp"           BOOLEAN NOT NULL DEFAULT false,
    "parentCampaignId"     INTEGER,
    "followUpSequence"     INTEGER,
    "followUpDays"         INTEGER NOT NULL DEFAULT 7,
    "queuePriority"        INTEGER NOT NULL DEFAULT 999,
    "estimatedStartDate"   DATETIME,
    "estimatedEndDate"     DATETIME,
    "abTestEnabled"        BOOLEAN NOT NULL DEFAULT false,
    "abTestMode"           TEXT,
    "subjectB"             TEXT,
    "textB"                TEXT,
    "jobDescriptionB"      TEXT,
    "postscriptB"          TEXT,
    "linkTextB"            TEXT,
    "linkUrlB"             TEXT,
    "autoReplyEnabled"           BOOLEAN NOT NULL DEFAULT false,
    "autoReplyContext"           TEXT,
    "autoReplyRules"             TEXT,
    "autoReplyDelayMinutes"      INTEGER NOT NULL DEFAULT 15,
    "autoReplyContent"           TEXT,
    "autoReplyGuardianTemplate"  TEXT,
    "autoReplyGuardianTitle"     TEXT,
    "autoReplyIncludeGuardian"   BOOLEAN NOT NULL DEFAULT false,
    "autoReplyGuardianIntroText" TEXT,
    "personaCriteriaId"          INTEGER,
    "createdAt"                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                  DATETIME NOT NULL,
    CONSTRAINT "Campaign_virtualSalespersonId_fkey" FOREIGN KEY ("virtualSalespersonId") REFERENCES "VirtualSalesperson" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "CampaignVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_savedContentId_fkey" FOREIGN KEY ("savedContentId") REFERENCES "SavedContent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_parentCampaignId_fkey" FOREIGN KEY ("parentCampaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_personaCriteriaId_fkey" FOREIGN KEY ("personaCriteriaId") REFERENCES "CompanyPersonaCriteria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Campaign" (
    "id", "name", "description", "subject", "text", "jobDescription", "postscript", "linkText", "linkUrl", "gmailLabel",
    "dailyLimit", "virtualSalespersonId", "contentVersionId", "savedContentId", "status", "scheduledAt", "sendingStartedAt",
    "sendingCompletedAt", "delayBetweenEmails", "maxEmailsPerDay", "allowedDays", "startHour", "startMinute", "endHour",
    "endMinute", "respectHolidays", "targetCountries", "isFollowUp", "parentCampaignId", "followUpSequence", "followUpDays",
    "queuePriority", "estimatedStartDate", "estimatedEndDate", "abTestEnabled", "abTestMode", "subjectB", "textB", "jobDescriptionB",
    "postscriptB", "linkTextB", "linkUrlB", "autoReplyEnabled", "autoReplyContext", "autoReplyRules", "autoReplyDelayMinutes",
    "autoReplyContent", "autoReplyGuardianTemplate", "autoReplyGuardianTitle", "autoReplyIncludeGuardian", "autoReplyGuardianIntroText",
    "personaCriteriaId", "createdAt", "updatedAt"
)
SELECT
    "id", "name", "description", "subject", "text", "jobDescription", "postscript", "linkText", "linkUrl", "gmailLabel",
    "dailyLimit", "virtualSalespersonId", "contentVersionId", "savedContentId", "status", "scheduledAt", "sendingStartedAt",
    "sendingCompletedAt", "delayBetweenEmails", "maxEmailsPerDay", "allowedDays", "startHour", "startMinute", "endHour",
    "endMinute", "respectHolidays", "targetCountries", "isFollowUp", "parentCampaignId", "followUpSequence", "followUpDays",
    "queuePriority", "estimatedStartDate", "estimatedEndDate", "abTestEnabled", "abTestMode", "subjectB", "textB", "jobDescriptionB",
    "postscriptB", "linkTextB", "linkUrlB", "autoReplyEnabled", "autoReplyContext", "autoReplyRules", "autoReplyDelayMinutes",
    "autoReplyContent", "autoReplyGuardianTemplate", "autoReplyGuardianTitle", "autoReplyIncludeGuardian", "autoReplyGuardianIntroText",
    NULL, "createdAt", "updatedAt"
FROM "Campaign";

DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";

CREATE INDEX "Campaign_personaCriteriaId_idx" ON "Campaign" ("personaCriteriaId");

PRAGMA foreign_keys=ON;

