-- Create IndustrySpecializationRule table
CREATE TABLE IF NOT EXISTS "IndustrySpecializationRule" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "industry" TEXT NOT NULL,
    "specializationCode" TEXT NOT NULL,
    "score" REAL DEFAULT 5,
    "explanation" TEXT,
    "source" TEXT DEFAULT 'MANUAL',
    "status" TEXT DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IndustrySpecializationRule_industry_idx"
  ON "IndustrySpecializationRule"("industry");
CREATE INDEX IF NOT EXISTS "IndustrySpecializationRule_industry_specialization_idx"
  ON "IndustrySpecializationRule"("industry", "specializationCode");
CREATE INDEX IF NOT EXISTS "IndustrySpecializationRule_status_idx"
  ON "IndustrySpecializationRule"("status");

-- Create IndustryMappingSuggestion table
CREATE TABLE IF NOT EXISTS "IndustryMappingSuggestion" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "industry" TEXT NOT NULL,
    "specializationCode" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "explanation" TEXT,
    "evidence" TEXT,
    "status" TEXT DEFAULT 'PENDING',
    "createdBy" TEXT DEFAULT 'AI',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IndustryMappingSuggestion_industry_idx"
  ON "IndustryMappingSuggestion"("industry");
CREATE INDEX IF NOT EXISTS "IndustryMappingSuggestion_status_idx"
  ON "IndustryMappingSuggestion"("status");
