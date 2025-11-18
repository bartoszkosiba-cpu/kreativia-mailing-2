-- Add index on createdAt for faster sorting
CREATE INDEX IF NOT EXISTS "CompanyPersonaCriteria_createdAt_idx" ON "CompanyPersonaCriteria"("createdAt");

