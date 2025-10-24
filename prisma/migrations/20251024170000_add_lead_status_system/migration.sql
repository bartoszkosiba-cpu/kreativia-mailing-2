-- Migration: Add Lead Status System
-- Description: Add new status system fields to Lead model

-- Add new status and sub-status fields
ALTER TABLE "Lead" ADD COLUMN "subStatus" TEXT;
ALTER TABLE "Lead" ADD COLUMN "blockedCampaigns" TEXT; -- JSON array of campaign IDs
ALTER TABLE "Lead" ADD COLUMN "reactivatedAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "lastReactivation" TEXT;

-- Add lead relationship fields
ALTER TABLE "Lead" ADD COLUMN "originalLeadId" INTEGER;
ALTER TABLE "Lead" ADD COLUMN "source" TEXT; -- CSV_IMPORT, OOO_RESPONSE, REDIRECT_RESPONSE, UNATTACHED
ALTER TABLE "Lead" ADD COLUMN "sourceDetails" TEXT; -- JSON with additional info

-- Update default status from NO_GREETING to AKTYWNY
-- Note: This will be handled in the application layer to avoid data loss

-- Add foreign key constraint for originalLeadId
-- Note: SQLite doesn't support adding foreign key constraints to existing tables
-- This will be handled in the application layer

-- Update existing status values to new system
UPDATE "Lead" SET "status" = 'AKTYWNY' WHERE "status" = 'ACTIVE';
UPDATE "Lead" SET "status" = 'BLOKADA' WHERE "status" = 'BLOCKED';
UPDATE "Lead" SET "status" = 'BLOKADA' WHERE "status" = 'INACTIVE';
UPDATE "Lead" SET "status" = 'TEST' WHERE "status" = 'TEST';

-- Set subStatus for existing leads
UPDATE "Lead" SET "subStatus" = 'BLOKADA_REFUSAL' WHERE "status" = 'BLOKADA' AND "blockedReason" = 'UNSUBSCRIBE';
UPDATE "Lead" SET "subStatus" = 'BLOKADA_BOUNCE' WHERE "status" = 'BLOKADA' AND "blockedReason" = 'BOUNCE';
UPDATE "Lead" SET "subStatus" = 'BLOKADA_REFUSAL' WHERE "status" = 'BLOKADA' AND "blockedReason" = 'SPAM';

-- Set source for existing leads
UPDATE "Lead" SET "source" = 'CSV_IMPORT' WHERE "source" IS NULL;
