-- CreateTable
CREATE TABLE "VirtualSalesperson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "language" TEXT NOT NULL DEFAULT 'pl',
    "markets" TEXT,
    "mainMailboxId" INTEGER,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapUser" TEXT,
    "imapPass" TEXT,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "dailyEmailLimit" INTEGER NOT NULL DEFAULT 150,
    "currentDailySent" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" DATETIME,
    "realSalespersonEmail" TEXT,
    "realSalespersonName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VirtualSalesperson_mainMailboxId_fkey" FOREIGN KEY ("mainMailboxId") REFERENCES "Mailbox" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
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
    "maxEmailsPerHour" INTEGER NOT NULL DEFAULT 40,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_virtualSalespersonId_fkey" FOREIGN KEY ("virtualSalespersonId") REFERENCES "VirtualSalesperson" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "CampaignVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_savedContentId_fkey" FOREIGN KEY ("savedContentId") REFERENCES "SavedContent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_parentCampaignId_fkey" FOREIGN KEY ("parentCampaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lead" (
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

-- CreateTable
CREATE TABLE "SendLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER,
    "leadId" INTEGER,
    "mailboxId" INTEGER,
    "messageId" TEXT,
    "threadId" TEXT,
    "subject" TEXT,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SendLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SendLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SendLog_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxReply" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER,
    "campaignId" INTEGER,
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
    CONSTRAINT "InboxReply_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignLead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "leadId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "priority" INTEGER NOT NULL DEFAULT 999,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CampaignLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LeadTag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadTag_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LeadTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanySettings" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AIRules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classification" TEXT NOT NULL,
    "pattern" TEXT,
    "keywords" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "AIChatHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userMessage" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "rulesCreated" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT
);

-- CreateTable
CREATE TABLE "Mailbox" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "virtualSalespersonId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "smtpUser" TEXT NOT NULL,
    "smtpPass" TEXT NOT NULL,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL,
    "imapUser" TEXT NOT NULL,
    "imapPass" TEXT NOT NULL,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "dailyEmailLimit" INTEGER NOT NULL DEFAULT 50,
    "currentDailySent" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mailboxType" TEXT NOT NULL DEFAULT 'new',
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "verificationError" TEXT,
    "verificationDate" DATETIME,
    "lastVerificationTest" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 999,
    "totalEmailsSent" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "warmupStatus" TEXT NOT NULL DEFAULT 'inactive',
    "warmupStartDate" DATETIME,
    "warmupDay" INTEGER NOT NULL DEFAULT 0,
    "warmupCompletedAt" DATETIME,
    "warmupDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "warmupTodaySent" INTEGER NOT NULL DEFAULT 0,
    "dnsSetupCompleted" BOOLEAN NOT NULL DEFAULT false,
    "mxRecordStatus" TEXT,
    "spfRecordStatus" TEXT,
    "dkimRecordStatus" TEXT,
    "dmarcRecordStatus" TEXT,
    "dnsLastCheckedAt" DATETIME,
    "deliverabilityScore" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" REAL NOT NULL DEFAULT 0.0,
    "openRate" REAL NOT NULL DEFAULT 0.0,
    "replyRate" REAL NOT NULL DEFAULT 0.0,
    "spamScore" REAL NOT NULL DEFAULT 0.0,
    "warmupPhase" TEXT NOT NULL DEFAULT 'silent',
    "warmupInternalEmails" INTEGER NOT NULL DEFAULT 0,
    "warmupTestEmails" INTEGER NOT NULL DEFAULT 0,
    "warmupIssues" TEXT,
    "lastWarmupAlert" DATETIME,
    "lastWarmupEmailAt" DATETIME,
    "nextWarmupEmailAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mailbox_virtualSalespersonId_fkey" FOREIGN KEY ("virtualSalespersonId") REFERENCES "VirtualSalesperson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetAudience" TEXT,
    "markets" TEXT,
    "iconEmoji" TEXT DEFAULT '📦',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conversationHistory" TEXT,
    "lastAIResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CampaignTheme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productGroupId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conversationHistory" TEXT,
    "briefingData" TEXT,
    "lastAIResponse" TEXT,
    "targetAudience" TEXT,
    "problemStatement" TEXT,
    "mainArguments" TEXT,
    "callToAction" TEXT,
    "language" TEXT DEFAULT 'pl',
    "toneOfVoice" TEXT,
    "emailLength" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "briefingProgress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignTheme_productGroupId_fkey" FOREIGN KEY ("productGroupId") REFERENCES "ProductGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignThemeId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "variantLetter" TEXT,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "aiRationale" TEXT,
    "aiModel" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userFeedback" TEXT,
    "userRating" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignVersion_campaignThemeId_fkey" FOREIGN KEY ("campaignThemeId") REFERENCES "CampaignTheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedContent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productGroupId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pl',
    "notes" TEXT,
    "tags" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedContent_productGroupId_fkey" FOREIGN KEY ("productGroupId") REFERENCES "ProductGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIPersonaConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "configHistory" TEXT,
    "lastUserMessage" TEXT,
    "lastAIResponse" TEXT,
    "globalRules" TEXT,
    "groupSpecificRules" TEXT,
    "generatedPrompt" TEXT,
    "promptVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT DEFAULT 'system',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AITokenUsage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "operation" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" REAL NOT NULL DEFAULT 0.0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WarmupEmail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mailboxId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "sentAt" DATETIME,
    "errorMessage" TEXT,
    "wasOpened" BOOLEAN NOT NULL DEFAULT false,
    "wasReplied" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" DATETIME,
    "repliedAt" DATETIME,
    "warmupDay" INTEGER NOT NULL,
    "warmupPhase" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarmupEmail_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WarmupQueue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mailboxId" INTEGER NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "emailType" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "error" TEXT,
    "warmupDay" INTEGER NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarmupQueue_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadStatusHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER NOT NULL,
    "oldStatus" TEXT,
    "oldSubStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "newSubStatus" TEXT,
    "reason" TEXT,
    "changedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadStatusHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VirtualSalesperson_email_key" ON "VirtualSalesperson"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InboxReply_messageId_key" ON "InboxReply"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignLead_campaignId_leadId_key" ON "CampaignLead"("campaignId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeadTag_leadId_tagId_key" ON "LeadTag"("leadId", "tagId");

-- CreateIndex
CREATE INDEX "Holiday_countryCode_year_idx" ON "Holiday"("countryCode", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_countryCode_key" ON "Holiday"("date", "countryCode");

-- CreateIndex
CREATE INDEX "AIRules_classification_idx" ON "AIRules"("classification");

-- CreateIndex
CREATE INDEX "AIRules_isActive_idx" ON "AIRules"("isActive");

-- CreateIndex
CREATE INDEX "AIRules_priority_idx" ON "AIRules"("priority");

-- CreateIndex
CREATE INDEX "AIChatHistory_createdAt_idx" ON "AIChatHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mailbox_email_key" ON "Mailbox"("email");

-- CreateIndex
CREATE INDEX "Mailbox_virtualSalespersonId_idx" ON "Mailbox"("virtualSalespersonId");

-- CreateIndex
CREATE INDEX "Mailbox_isActive_currentDailySent_idx" ON "Mailbox"("isActive", "currentDailySent");

-- CreateIndex
CREATE INDEX "Mailbox_warmupStatus_idx" ON "Mailbox"("warmupStatus");

-- CreateIndex
CREATE INDEX "Mailbox_dnsSetupCompleted_idx" ON "Mailbox"("dnsSetupCompleted");

-- CreateIndex
CREATE INDEX "CampaignTheme_productGroupId_idx" ON "CampaignTheme"("productGroupId");

-- CreateIndex
CREATE INDEX "CampaignTheme_status_idx" ON "CampaignTheme"("status");

-- CreateIndex
CREATE INDEX "CampaignVersion_campaignThemeId_status_idx" ON "CampaignVersion"("campaignThemeId", "status");

-- CreateIndex
CREATE INDEX "CampaignVersion_status_idx" ON "CampaignVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignVersion_campaignThemeId_versionNumber_type_variantLetter_key" ON "CampaignVersion"("campaignThemeId", "versionNumber", "type", "variantLetter");

-- CreateIndex
CREATE INDEX "SavedContent_productGroupId_idx" ON "SavedContent"("productGroupId");

-- CreateIndex
CREATE INDEX "SavedContent_type_language_idx" ON "SavedContent"("type", "language");

-- CreateIndex
CREATE INDEX "SavedContent_isActive_isFavorite_idx" ON "SavedContent"("isActive", "isFavorite");

-- CreateIndex
CREATE INDEX "WarmupEmail_mailboxId_idx" ON "WarmupEmail"("mailboxId");

-- CreateIndex
CREATE INDEX "WarmupEmail_type_idx" ON "WarmupEmail"("type");

-- CreateIndex
CREATE INDEX "WarmupEmail_status_idx" ON "WarmupEmail"("status");

-- CreateIndex
CREATE INDEX "WarmupEmail_warmupDay_idx" ON "WarmupEmail"("warmupDay");

-- CreateIndex
CREATE INDEX "WarmupQueue_mailboxId_idx" ON "WarmupQueue"("mailboxId");

-- CreateIndex
CREATE INDEX "WarmupQueue_scheduledAt_status_idx" ON "WarmupQueue"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "WarmupQueue_status_idx" ON "WarmupQueue"("status");

-- CreateIndex
CREATE INDEX "LeadStatusHistory_leadId_idx" ON "LeadStatusHistory"("leadId");

-- CreateIndex
CREATE INDEX "LeadStatusHistory_createdAt_idx" ON "LeadStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "LeadStatusHistory_newStatus_idx" ON "LeadStatusHistory"("newStatus");
