CREATE TABLE "CompanyTagScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "tagCode" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "explanation" TEXT,
    "source" TEXT NOT NULL DEFAULT 'AI_TAGGER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyTagScore_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CompanyTagScore_companyId_tagCode_key" ON "CompanyTagScore" ("companyId", "tagCode");
CREATE INDEX "CompanyTagScore_tagCode_idx" ON "CompanyTagScore" ("tagCode");
