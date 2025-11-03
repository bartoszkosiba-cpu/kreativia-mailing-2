CREATE UNIQUE INDEX IF NOT EXISTS "SendLog_campaignId_leadId_variantLetter_unique" ON "SendLog"("campaignId", "leadId", "variantLetter");
