-- CreateTable PersonaBrief
CREATE TABLE "PersonaBrief" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyCriteriaId" INTEGER NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "decisionGuidelines" TEXT,
    "targetProfiles" TEXT,
    "avoidProfiles" TEXT,
    "additionalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonaBrief_companyCriteriaId_fkey" FOREIGN KEY ("companyCriteriaId") REFERENCES "CompanyPersonaCriteria" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonaBrief_companyCriteriaId_key" UNIQUE ("companyCriteriaId")
);

