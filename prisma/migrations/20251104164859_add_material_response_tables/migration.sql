-- CreateTable
CREATE TABLE "Material" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "fileName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Material_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialResponse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "replyId" INTEGER NOT NULL,
    "materialId" INTEGER,
    "subject" TEXT NOT NULL,
    "responseText" TEXT NOT NULL,
    "aiConfidence" REAL,
    "aiReasoning" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "error" TEXT,
    "mailboxId" INTEGER,
    "messageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialResponse_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialResponse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialResponse_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "InboxReply" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialResponse_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaterialResponse_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingMaterialDecision" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "replyId" INTEGER NOT NULL,
    "aiConfidence" REAL NOT NULL,
    "aiReasoning" TEXT NOT NULL,
    "leadResponse" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingMaterialDecision_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingMaterialDecision_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PendingMaterialDecision_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "InboxReply" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Material_campaignId_idx" ON "Material"("campaignId");

-- CreateIndex
CREATE INDEX "Material_campaignId_isActive_idx" ON "Material"("campaignId", "isActive");

-- CreateIndex
CREATE INDEX "MaterialResponse_campaignId_idx" ON "MaterialResponse"("campaignId");

-- CreateIndex
CREATE INDEX "MaterialResponse_replyId_idx" ON "MaterialResponse"("replyId");

-- CreateIndex
CREATE INDEX "MaterialResponse_status_idx" ON "MaterialResponse"("status");

-- CreateIndex
CREATE INDEX "MaterialResponse_scheduledAt_status_idx" ON "MaterialResponse"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "PendingMaterialDecision_campaignId_idx" ON "PendingMaterialDecision"("campaignId");

-- CreateIndex
CREATE INDEX "PendingMaterialDecision_replyId_idx" ON "PendingMaterialDecision"("replyId");

-- CreateIndex
CREATE INDEX "PendingMaterialDecision_status_idx" ON "PendingMaterialDecision"("status");

