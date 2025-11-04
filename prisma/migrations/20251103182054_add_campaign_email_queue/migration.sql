-- CreateTable
CREATE TABLE "CampaignEmailQueue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "campaignLeadId" INTEGER NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignEmailQueue_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignEmailQueue_campaignLeadId_fkey" FOREIGN KEY ("campaignLeadId") REFERENCES "CampaignLead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CampaignEmailQueue_campaignId_idx" ON "CampaignEmailQueue"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignEmailQueue_campaignLeadId_idx" ON "CampaignEmailQueue"("campaignLeadId");

-- CreateIndex
CREATE INDEX "CampaignEmailQueue_scheduledAt_status_idx" ON "CampaignEmailQueue"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "CampaignEmailQueue_status_idx" ON "CampaignEmailQueue"("status");


