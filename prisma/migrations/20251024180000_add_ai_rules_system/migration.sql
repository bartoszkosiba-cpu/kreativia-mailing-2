-- Migration: Add AI Rules System
-- Description: Add AI rules management tables for dynamic classification rules

-- Create AIRules table
CREATE TABLE "AIRules" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "classification" TEXT NOT NULL,
  "pattern" TEXT,
  "keywords" TEXT NOT NULL, -- JSON array of keywords
  "confidence" REAL NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT
);

-- Create AIChatHistory table
CREATE TABLE "AIChatHistory" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userMessage" TEXT NOT NULL,
  "aiResponse" TEXT NOT NULL,
  "rulesCreated" TEXT, -- JSON array of rule IDs
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT
);

-- Create indexes for better performance
CREATE INDEX "AIRules_classification_idx" ON "AIRules"("classification");
CREATE INDEX "AIRules_isActive_idx" ON "AIRules"("isActive");
CREATE INDEX "AIRules_priority_idx" ON "AIRules"("priority");
CREATE INDEX "AIChatHistory_createdAt_idx" ON "AIChatHistory"("createdAt");

-- Insert default static rules (will be managed by application)
INSERT INTO "AIRules" ("id", "classification", "keywords", "confidence", "priority", "description", "isActive") VALUES
('static-interested-1', 'INTERESTED', '["proszę o wycenę", "jestem zainteresowany", "chcę więcej informacji", "proszę o ofertę"]', 0.9, 100, 'Podstawowe słowa kluczowe dla zainteresowania', true),
('static-not-interested-1', 'NOT_INTERESTED', '["nie jestem zainteresowany", "nie potrzebuję", "nie dziękuję", "nie chcę"]', 0.95, 100, 'Podstawowe słowa kluczowe dla odmowy', true),
('static-maybe-later-1', 'MAYBE_LATER', '["może później", "nie teraz", "dodaliśmy do bazy", "odezwiemy się"]', 0.8, 90, 'Słowa kluczowe dla miękkiej odmowy', true),
('static-redirect-1', 'REDIRECT', '["przekazuję", "przekazałem", "skontaktujcie się z", "proszę pisać na"]', 0.85, 90, 'Słowa kluczowe dla przekierowania', true),
('static-ooo-1', 'OOO', '["jestem na urlopie", "wracam", "nieobecny", "out of office"]', 0.9, 90, 'Słowa kluczowe dla OOO', true),
('static-unsubscribe-1', 'UNSUBSCRIBE', '["usuńcie mnie", "wypiszcie", "nie chcę otrzymywać", "stop"]', 0.95, 100, 'Słowa kluczowe dla wypisania', true),
('static-bounce-1', 'BOUNCE', '["delivery failed", "user unknown", "mailbox full", "invalid"]', 0.99, 100, 'Słowa kluczowe dla odbicia', true);
