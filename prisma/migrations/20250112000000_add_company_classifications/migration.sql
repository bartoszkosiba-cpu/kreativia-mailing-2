-- Create table for multiple specializations per company with AI scoring
CREATE TABLE "CompanyClassification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "specializationCode" TEXT NOT NULL,
    "score" INTEGER NOT NULL, -- 1-5 scoring
    "confidence" REAL, -- 0.0-1.0 confidence from AI
    "isPrimary" BOOLEAN NOT NULL DEFAULT false, -- Main specialization
    "reason" TEXT, -- AI explanation
    "source" TEXT NOT NULL DEFAULT 'AI', -- AI | MANUAL | RULES
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    
    CONSTRAINT "CompanyClassification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CompanyClassification_companyId_specializationCode_key" ON "CompanyClassification"("companyId", "specializationCode");
CREATE INDEX "CompanyClassification_companyId_idx" ON "CompanyClassification"("companyId");
CREATE INDEX "CompanyClassification_specializationCode_idx" ON "CompanyClassification"("specializationCode");
CREATE INDEX "CompanyClassification_isPrimary_idx" ON "CompanyClassification"("isPrimary");
CREATE INDEX "CompanyClassification_score_idx" ON "CompanyClassification"("score");

