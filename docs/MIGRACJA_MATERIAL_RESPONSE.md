# 📋 MIGRACJA: MaterialResponse i PendingMaterialDecision

## 🎯 CEL MIGRACJI

Utworzenie tabel w bazie danych dla modułu automatycznych odpowiedzi z materiałami:
- `MaterialResponse` - wysłane odpowiedzi z materiałami
- `PendingMaterialDecision` - oczekujące decyzje administratora
- `Material` - materiały kampanii (katalogi, cenniki, etc.)

---

## 📊 STRUKTURA TABEL

### **1. MaterialResponse**

**Przeznaczenie:** Wysłane odpowiedzi z materiałami

**Pola:**
- `id` (Int, PK, autoincrement)
- `leadId` (Int, FK → Lead.id)
- `campaignId` (Int, FK → Campaign.id)
- `replyId` (Int, FK → InboxReply.id)
- `materialId` (Int?, nullable, FK → Material.id) - NULL = wszystkie materiały kampanii
- `subject` (String) - Temat maila
- `responseText` (String) - Treść odpowiedzi
- `aiConfidence` (Float?) - Pewność AI (0.0-1.0)
- `aiReasoning` (String?) - Uzasadnienie decyzji AI
- `status` (String) - pending | scheduled | sending | sent | failed
- `scheduledAt` (DateTime?) - Kiedy zaplanowano wysyłkę
- `sentAt` (DateTime?) - Kiedy faktycznie wysłano
- `error` (String?) - Błąd jeśli status = failed
- `mailboxId` (Int?) - Z której skrzynki wysłano (FK → Mailbox.id)
- `messageId` (String?) - ID wiadomości z SMTP
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Indeksy:**
- `[campaignId]`
- `[replyId]`
- `[status]`
- `[scheduledAt, status]` - dla szybkiego wyszukiwania zaplanowanych

---

### **2. PendingMaterialDecision**

**Przeznaczenie:** Oczekujące decyzje administratora

**Pola:**
- `id` (Int, PK, autoincrement)
- `leadId` (Int, FK → Lead.id)
- `campaignId` (Int, FK → Campaign.id)
- `replyId` (Int, FK → InboxReply.id)
- `aiConfidence` (Float) - Pewność AI (0.0-1.0)
- `aiReasoning` (String) - Uzasadnienie decyzji AI
- `leadResponse` (String) - Treść odpowiedzi leada
- `suggestedAction` (String) - SEND | DONT_SEND
- `status` (String) - PENDING | APPROVED | REJECTED
- `decisionNote` (String?) - Notatka administratora
- `decidedBy` (String?) - Kto zdecydował (np. "Administrator")
- `decidedAt` (DateTime?) - Kiedy zdecydowano
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Indeksy:**
- `[campaignId]`
- `[replyId]`
- `[status]`

---

### **3. Material**

**Przeznaczenie:** Materiały kampanii (katalogi, cenniki, załączniki)

**Pola:**
- `id` (Int, PK, autoincrement)
- `campaignId` (Int, FK → Campaign.id)
- `name` (String) - Nazwa materiału
- `type` (String) - LINK | ATTACHMENT
- `url` (String?) - URL dla LINK
- `fileName` (String?) - Nazwa pliku dla ATTACHMENT
- `order` (Int) - Kolejność wyświetlania (0, 1, 2, ...)
- `isActive` (Boolean) - Czy aktywny
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

**Indeksy:**
- `[campaignId]`
- `[campaignId, isActive]` - dla szybkiego wyszukiwania aktywnych

---

## 🔗 RELACJE

### **MaterialResponse:**
- `lead` → Lead (many-to-one)
- `campaign` → Campaign (many-to-one)
- `reply` → InboxReply (many-to-one)
- `material` → Material (many-to-one, optional)

### **PendingMaterialDecision:**
- `lead` → Lead (many-to-one)
- `campaign` → Campaign (many-to-one)
- `reply` → InboxReply (many-to-one)

### **Material:**
- `campaign` → Campaign (many-to-one)

### **Campaign (dodaj relacje):**
- `materials` → Material[] (one-to-many)
- `materialResponses` → MaterialResponse[] (one-to-many)
- `pendingMaterialDecisions` → PendingMaterialDecision[] (one-to-many)

### **InboxReply (dodaj relacje):**
- `materialResponses` → MaterialResponse[] (one-to-many)
- `pendingMaterialDecisions` → PendingMaterialDecision[] (one-to-many)

### **Lead (dodaj relacje):**
- `materialResponses` → MaterialResponse[] (one-to-many)
- `pendingMaterialDecisions` → PendingMaterialDecision[] (one-to-many)

### **Mailbox (dodaj relację):**
- `materialResponses` → MaterialResponse[] (one-to-many)

---

## 📝 MIGRACJA SQL

```sql
-- MaterialResponse
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
  CONSTRAINT "MaterialResponse_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaterialResponse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaterialResponse_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "InboxReply" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaterialResponse_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "MaterialResponse_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MaterialResponse_campaignId_idx" ON "MaterialResponse"("campaignId");
CREATE INDEX "MaterialResponse_replyId_idx" ON "MaterialResponse"("replyId");
CREATE INDEX "MaterialResponse_status_idx" ON "MaterialResponse"("status");
CREATE INDEX "MaterialResponse_scheduledAt_status_idx" ON "MaterialResponse"("scheduledAt", "status");

-- PendingMaterialDecision
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
  CONSTRAINT "PendingMaterialDecision_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PendingMaterialDecision_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PendingMaterialDecision_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "InboxReply" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PendingMaterialDecision_campaignId_idx" ON "PendingMaterialDecision"("campaignId");
CREATE INDEX "PendingMaterialDecision_replyId_idx" ON "PendingMaterialDecision"("replyId");
CREATE INDEX "PendingMaterialDecision_status_idx" ON "PendingMaterialDecision"("status");

-- Material
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
  CONSTRAINT "Material_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Material_campaignId_idx" ON "Material"("campaignId");
CREATE INDEX "Material_campaignId_isActive_idx" ON "Material"("campaignId", "isActive");
```

---

## ✅ CO ZOSTANIE UTWORZONE

1. **3 nowe tabele:**
   - `MaterialResponse` - ~17 kolumn
   - `PendingMaterialDecision` - ~13 kolumn
   - `Material` - ~10 kolumn

2. **Relacje z istniejącymi tabelami:**
   - Campaign → Material[]
   - Campaign → MaterialResponse[]
   - Campaign → PendingMaterialDecision[]
   - Lead → MaterialResponse[]
   - Lead → PendingMaterialDecision[]
   - InboxReply → MaterialResponse[]
   - InboxReply → PendingMaterialDecision[]
   - Mailbox → MaterialResponse[]
   - Material → MaterialResponse[]

3. **Indeksy dla wydajności:**
   - Indeksy na `campaignId`, `replyId`, `status`
   - Złożony indeks na `[scheduledAt, status]` dla MaterialResponse

---

## 🎯 EFEKT

Po migracji:
- ✅ System automatycznych odpowiedzi będzie mógł działać
- ✅ Będzie można tworzyć MaterialResponse i PendingMaterialDecision
- ✅ Będzie można zarządzać materiałami kampanii
- ✅ Historia automatycznych odpowiedzi będzie widoczna w UI

---

## ⚠️ UWAGA

**Nie ma historii z przeszłości:**
- Tabele nie istniały, więc nie ma starych MaterialResponse
- Leady z 3.11 są zainteresowani, ale nie ma historii wysłanych odpowiedzi
- To normalne - system zacznie działać od teraz

