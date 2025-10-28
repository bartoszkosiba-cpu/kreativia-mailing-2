-- CreateIndex
CREATE INDEX "SendLog_campaignId_leadId_status_idx" ON "SendLog"("campaignId", "leadId", "status");
