-- CreateTable
CREATE TABLE "InterestedLeadNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "replyId" INTEGER NOT NULL,
    "leadId" INTEGER NOT NULL,
    "campaignId" INTEGER,
    "salespersonEmail" TEXT,
    "notifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterestedLeadNotification_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "InboxReply" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterestedLeadNotification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterestedLeadNotification_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyName" TEXT NOT NULL DEFAULT 'Kreativia',
    "address" TEXT,
    "logoBase64" TEXT,
    "disclaimerPl" TEXT,
    "disclaimerEn" TEXT,
    "disclaimerDe" TEXT,
    "disclaimerFr" TEXT,
    "legalFooter" TEXT,
    "forwardEmail" TEXT,
    "warmupPerformanceSettings" TEXT,
    "reminderIntervalDays" INTEGER NOT NULL DEFAULT 3,
    "maxReminderCount" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("address", "companyName", "createdAt", "disclaimerDe", "disclaimerEn", "disclaimerFr", "disclaimerPl", "forwardEmail", "id", "legalFooter", "logoBase64", "updatedAt", "warmupPerformanceSettings") SELECT "address", "companyName", "createdAt", "disclaimerDe", "disclaimerEn", "disclaimerFr", "disclaimerPl", "forwardEmail", "id", "legalFooter", "logoBase64", "updatedAt", "warmupPerformanceSettings" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InterestedLeadNotification_leadId_idx" ON "InterestedLeadNotification"("leadId");

-- CreateIndex
CREATE INDEX "InterestedLeadNotification_replyId_idx" ON "InterestedLeadNotification"("replyId");

-- CreateIndex
CREATE INDEX "InterestedLeadNotification_status_idx" ON "InterestedLeadNotification"("status");

-- CreateIndex
CREATE INDEX "InterestedLeadNotification_salespersonEmail_idx" ON "InterestedLeadNotification"("salespersonEmail");
