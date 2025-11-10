# 🚀 PLAN IMPLEMENTACJI MODUŁU CRM

## 📋 ZAŁOŻENIA

### Niezależność od Prospekting:
- ✅ Prospekting działa jak dotychczas (bez zmian)
- ✅ Status `ZAINTERESOWANY` pozostaje bez zmian
- ✅ Automatyczne odpowiedzi działają jak dotychczas
- ✅ CRM to **dodatkowy layer** nad istniejącym systemem

### Przepływ leadów:
```
Lead odpowiada → AI: INTERESTED
  ├─ Automatyczne odpowiedzi (jak dotychczas) ✅
  └─ Dodanie do CRM (NOWE) ✅
  
Lead w statusie ZAINTERESOWANY:
  - W module Mailing: widoczny jako "Zainteresowany" (jak dotychczas)
  - W module CRM: widoczny jako lead do nurturing
  - Oba moduły działają równolegle
```

---

## 🎯 FAZA 1: Podstawowa infrastruktura (2-3 dni)

### 1.1. Przełącznik modułów w Navbar
- ✅ Dodanie przełącznika "MAILING" | "CRM" obok logo
- ✅ Zmiana menu nawigacji w zależności od wybranego modułu
- ✅ Przechowywanie wyboru w localStorage/session

### 1.2. Rozszerzenie statusu Lead
- ✅ Dodanie pola `inCRM: Boolean @default(false)` do modelu Lead
- ✅ Dodanie pola `crmEnteredAt: DateTime?` - kiedy trafił do CRM
- ✅ **NIE zmieniamy** statusu `ZAINTERESOWANY` - pozostaje bez zmian

### 1.3. Automatyczne dodawanie do CRM
- ✅ Gdy AI klasyfikuje jako `INTERESTED` → automatycznie ustaw `inCRM = true`
- ✅ W `emailAgentAI.ts` - po ustawieniu statusu `ZAINTERESOWANY` dodaj flagę CRM

### 1.4. Podstawowy dashboard CRM
- ✅ Strona `/crm` lub `/crm/dashboard`
- ✅ Widok leadów z `inCRM = true`
- ✅ Podstawowe statystyki (liczba leadów w CRM)

**Pliki do utworzenia/modyfikacji:**
- `app/components/Navbar.tsx` - przełącznik modułów
- `prisma/schema.prisma` - rozszerzenie Lead
- `app/crm/page.tsx` - dashboard CRM
- `app/crm/layout.tsx` - layout dla modułu CRM
- `src/services/emailAgentAI.ts` - automatyczne dodawanie do CRM

---

## 🎯 FAZA 2: Lista leadów w CRM (1-2 dni)

### 2.1. Strona `/crm/leads`
- ✅ Lista leadów z `inCRM = true`
- ✅ Filtry: status, data dodania, gotowość do handlowca
- ✅ Kolumny: Imię, Email, Firma, Data dodania, Status w CRM, Akcje

### 2.2. Szczegóły leada w CRM
- ✅ Strona `/crm/leads/[id]`
- ✅ Historia komunikacji (odpowiedzi, wysłane emaile)
- ✅ Informacje o leadzie
- ✅ Przycisk "Przekaż do handlowca" (już jest w module Mailing)

**Pliki do utworzenia:**
- `app/crm/leads/page.tsx` - lista leadów
- `app/crm/leads/[id]/page.tsx` - szczegóły leada
- `app/crm/components/LeadList.tsx` - komponent listy
- `app/crm/components/LeadDetails.tsx` - komponent szczegółów

---

## 🎯 FAZA 3: Sekwencje CRM - podstawowa struktura (2-3 dni)

### 3.1. Tabele w bazie danych
```prisma
model CRMSequence {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  isActive    Boolean  @default(true)
  steps       CRMSequenceStep[]
  leadSequences CRMLeadSequence[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CRMSequenceStep {
  id            Int      @id @default(autoincrement())
  sequenceId    Int
  sequence      CRMSequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  order         Int      // Kolejność w sekwencji
  delayDays     Int      @default(0) // Opóźnienie w dniach od poprzedniego kroku
  triggerCondition String  // SEND_IMMEDIATELY, NO_RESPONSE
  subject       String
  emailTemplate String   // Może zawierać {firstName}, {company}, etc.
  canSkip       Boolean  @default(false) // Czy można pominąć jeśli lead odpowie
  createdAt     DateTime @default(now())
}

model CRMLeadSequence {
  id          Int      @id @default(autoincrement())
  leadId      Int      @unique // Jeden lead = jedna sekwencja
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  sequenceId  Int
  sequence    CRMSequence @relation(fields: [sequenceId], references: [id])
  currentStep Int      @default(0) // Aktualny krok (0 = jeszcze nie rozpoczęto)
  nextSendDate DateTime? // Kiedy wysłać następny email
  isPaused    Boolean  @default(false)
  pausedReason String?
  startedAt   DateTime @default(now())
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 3.2. UI do tworzenia sekwencji
- ✅ Strona `/crm/sequences`
- ✅ Lista sekwencji
- ✅ Tworzenie/edycja sekwencji
- ✅ Dodawanie kroków do sekwencji

**Pliki do utworzenia:**
- `app/crm/sequences/page.tsx` - lista sekwencji
- `app/crm/sequences/new/page.tsx` - tworzenie sekwencji
- `app/crm/sequences/[id]/page.tsx` - edycja sekwencji
- `app/crm/components/SequenceEditor.tsx` - edytor sekwencji
- `app/crm/components/StepEditor.tsx` - edytor kroku

---

## 🎯 FAZA 4: Automatyczne przypisanie sekwencji (1-2 dni)

### 4.1. Domyślna sekwencja dla nowych leadów
- ✅ Gdy lead trafia do CRM (`inCRM = true`) → automatycznie przypisz domyślną sekwencję
- ✅ Utworzenie `CRMLeadSequence` z `currentStep = 0`
- ✅ Ustawienie `nextSendDate` na `now()` (jeśli pierwszy krok ma `SEND_IMMEDIATELY`)

### 4.2. Konfiguracja domyślnej sekwencji
- ✅ W ustawieniach CRM: wybór domyślnej sekwencji
- ✅ Możliwość zmiany sekwencji dla konkretnego leada

**Pliki do utworzenia/modyfikacji:**
- `src/services/crmSequenceManager.ts` - logika przypisywania sekwencji
- `app/crm/settings/page.tsx` - ustawienia CRM (domyślna sekwencja)
- `src/services/emailAgentAI.ts` - wywołanie przypisania sekwencji

---

## 🎯 FAZA 5: Automatyczna wysyłka kroków sekwencji (2-3 dni)

### 5.1. Cron job do wysyłki
- ✅ Nowy cron job: `processCRMSequences()` - uruchamiany co godzinę
- ✅ Znajduje leady z `nextSendDate <= now()` i `isPaused = false`
- ✅ Wysyła email z aktualnego kroku
- ✅ Aktualizuje `currentStep` i `nextSendDate` na następny krok

### 5.2. Logika wysyłki
- ✅ Sprawdza `triggerCondition`:
  - `SEND_IMMEDIATELY` → wysyłaj od razu
  - `NO_RESPONSE` → sprawdź czy lead odpowiedział (brak odpowiedzi w ostatnich X dniach)
- ✅ Personalizacja emaila (`{firstName}`, `{company}`, etc.)
- ✅ Zapisywanie do `SendLog` (jak w prospecting)

### 5.3. Obsługa odpowiedzi
- ✅ Jeśli lead odpowiada → sprawdź `canSkip` w kroku
- ✅ Jeśli `canSkip = true` → pomiń pozostałe kroki tego typu
- ✅ Jeśli `canSkip = false` → kontynuuj sekwencję

**Pliki do utworzenia:**
- `src/services/crmSequenceManager.ts` - logika wysyłki
- `src/services/cron/crmSequences.ts` - cron job
- `src/services/startCron.ts` - dodanie nowego cron joba

---

## 🎯 FAZA 6: AI odpowiedzi w CRM (2-3 dni)

### 6.1. Tabela odpowiedzi AI
```prisma
model CRMResponse {
  id          Int      @id @default(autoincrement())
  leadId      Int
  lead        Lead     @relation(fields: [leadId], references: [id])
  replyId     Int?     // ID odpowiedzi leada (InboxReply)
  question    String   // Pytanie leada
  aiResponse  String   // Wygenerowana odpowiedź AI
  status      String   // PENDING, APPROVED, SENT, REJECTED
  approvedBy  Int?     // ID administratora
  approvedAt  DateTime?
  sentAt      DateTime?
  createdAt   DateTime @default(now())
}
```

### 6.2. Automatyczne wykrywanie pytań
- ✅ Gdy lead w CRM odpowiada → AI sprawdza czy to pytanie
- ✅ Jeśli pytanie → generuje odpowiedź i dodaje do kolejki `CRMResponse` (status: PENDING)

### 6.3. Kolejka odpowiedzi
- ✅ Strona `/crm/responses` - lista odpowiedzi do akceptacji
- ✅ Akceptacja/odrzucenie/edycja odpowiedzi
- ✅ Automatyczna wysyłka po akceptacji

**Pliki do utworzenia:**
- `app/crm/responses/page.tsx` - kolejka odpowiedzi
- `src/services/crmResponseGenerator.ts` - generowanie odpowiedzi AI
- `src/integrations/inbox/processor.ts` - wykrywanie pytań dla leadów w CRM

---

## 🎯 FAZA 7: Przekazanie do handlowca (1 dzień)

### 7.1. Automatyczne wykrywanie gotowości
- ✅ AI analizuje odpowiedzi leada w CRM
- ✅ Jeśli wykryje konkretne zapytanie (wycena, spotkanie) → automatycznie oznacza jako gotowy
- ✅ Dodanie pola `crmReadyForSales: Boolean` do Lead

### 7.2. Ręczne przekazanie
- ✅ Przycisk "Przekaż do handlowca" w szczegółach leada
- ✅ Usuwa leada z CRM (`inCRM = false`) lub pozostawia (do decyzji)

**Pliki do utworzenia/modyfikacji:**
- `src/services/crmResponseGenerator.ts` - wykrywanie gotowości
- `app/crm/components/LeadDetails.tsx` - przycisk przekazania
- `app/api/crm/leads/[id]/forward/route.ts` - endpoint przekazania

---

## 🎯 FAZA 8: Blokada kampanii prospectingowych (1 dzień)

### 8.1. Filtrowanie w wysyłce kampanii
- ✅ W logice wysyłki kampanii: sprawdź `lead.inCRM === true`
- ✅ Jeśli `true` → pomiń leada (nie wysyłaj kampanii prospectingowych)
- ✅ **UWAGA:** Lead nadal może być w innych kampaniach (jeśli zostanie ręcznie dodany)

**Pliki do modyfikacji:**
- `src/services/campaignSender.ts` - dodanie filtra `inCRM`
- `app/api/campaigns/[id]/send/route.ts` - filtrowanie leadów

---

## 📝 KROK PO KROKU - CO ROBIĆ TERAZ

### Krok 1: Przełącznik modułów (Najprostsze, żeby zobaczyć efekt)
1. Modyfikuj `app/components/Navbar.tsx`:
   - Dodaj przełącznik "MAILING" | "CRM"
   - Dodaj state dla wybranego modułu
   - Zmień menu nawigacji w zależności od modułu

2. Utwórz podstawowy layout CRM:
   - `app/crm/layout.tsx` - layout dla modułu CRM
   - `app/crm/page.tsx` - podstawowy dashboard

### Krok 2: Rozszerzenie bazy danych
1. Zmodyfikuj `prisma/schema.prisma`:
   - Dodaj `inCRM: Boolean @default(false)` do Lead
   - Dodaj `crmEnteredAt: DateTime?` do Lead

2. Utwórz migrację:
   ```bash
   npx prisma migrate dev --name add_crm_fields
   ```

### Krok 3: Automatyczne dodawanie do CRM
1. Modyfikuj `src/services/emailAgentAI.ts`:
   - Po ustawieniu statusu `ZAINTERESOWANY` → ustaw `inCRM = true`
   - Ustaw `crmEnteredAt = now()`

### Krok 4: Lista leadów w CRM
1. Utwórz `app/crm/leads/page.tsx`:
   - Pobierz leady z `inCRM = true`
   - Wyświetl listę

---

## 🎨 PRZYKŁADOWE PLIKI

### Navbar z przełącznikiem:
```tsx
// app/components/Navbar.tsx
const [currentModule, setCurrentModule] = useState<'MAILING' | 'CRM'>('MAILING');

// Przełącznik obok logo
<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
  <button onClick={() => setCurrentModule('MAILING')}>MAILING</button>
  <button onClick={() => setCurrentModule('CRM')}>CRM</button>
</div>

// Menu zależne od modułu
{currentModule === 'MAILING' ? (
  // Istniejące menu
) : (
  // Menu CRM
  [
    { href: '/crm', label: 'Dashboard' },
    { href: '/crm/leads', label: 'Leady' },
    { href: '/crm/sequences', label: 'Sekwencje' },
    { href: '/crm/responses', label: 'Odpowiedzi AI' }
  ]
)}
```

### Automatyczne dodawanie do CRM:
```typescript
// src/services/emailAgentAI.ts
case 'INTERESTED':
  // ... istniejąca logika ...
  
  // Dodaj do CRM
  await db.lead.update({
    where: { id: lead.id },
    data: {
      inCRM: true,
      crmEnteredAt: new Date()
    }
  });
  
  break;
```

---

## ✅ CHECKLIST IMPLEMENTACJI

### Faza 1 (Podstawowa infrastruktura):
- [ ] Przełącznik modułów w Navbar
- [ ] Rozszerzenie modelu Lead (inCRM, crmEnteredAt)
- [ ] Migracja bazy danych
- [ ] Automatyczne dodawanie do CRM przy INTERESTED
- [ ] Podstawowy dashboard `/crm`

### Faza 2 (Lista leadów):
- [ ] Strona `/crm/leads`
- [ ] Szczegóły leada `/crm/leads/[id]`
- [ ] Filtry i sortowanie

### Faza 3 (Sekwencje - struktura):
- [ ] Tabele: CRMSequence, CRMSequenceStep, CRMLeadSequence
- [ ] Migracja bazy danych
- [ ] UI do tworzenia sekwencji

### Faza 4 (Przypisanie sekwencji):
- [ ] Automatyczne przypisanie domyślnej sekwencji
- [ ] Ustawienia CRM (domyślna sekwencja)

### Faza 5 (Wysyłka sekwencji):
- [ ] Cron job do wysyłki
- [ ] Logika wysyłki kroków
- [ ] Personalizacja emaili
- [ ] Obsługa odpowiedzi

### Faza 6 (AI odpowiedzi):
- [ ] Tabela CRMResponse
- [ ] Wykrywanie pytań
- [ ] Generowanie odpowiedzi AI
- [ ] Kolejka odpowiedzi

### Faza 7 (Przekazanie do handlowca):
- [ ] Automatyczne wykrywanie gotowości
- [ ] Ręczne przekazanie

### Faza 8 (Blokada prospecting):
- [ ] Filtr w wysyłce kampanii (pomijaj `inCRM = true`)

---

## 🚀 ZACZYNAMY?

**Proponuję zacząć od Fazy 1** - to da nam:
- ✅ Widoczny efekt (przełącznik modułów)
- ✅ Podstawową infrastrukturę
- ✅ Możliwość testowania przepływu

**Czy zaczynamy implementację?**




