# Changelog - Kreativia Mailing 2

## [2025-10-26] - Poprawka archiwum i kategoryzacji maili

### 🔧 Poprawki techniczne

#### 1. Naprawa kategoryzacji BOUNCE w archiwum
- **Problem**: Maile BOUNCE były kategoryzowane jako CAMPAIGN w archiwum
- **Rozwiązanie**: Dodano specjalną obsługę klasyfikacji BOUNCE → emailType: UNKNOWN, source: bounce
- **Plik**: `app/api/archive/route.ts`

#### 2. Usunięcie external warmup
- **Problem**: System miał logikę do wysyłania warmup do zewnętrznych skrzynek (seed emails)
- **Rozwiązanie**: 
  - Usunięto `SEED_EMAILS` z konfiguracji
  - Usunięto `warmupSeedEmails` z modelu Mailbox
  - Warmup działa TYLKO między naszymi skrzynkami (internal)
- **Pliki**: 
  - `src/services/warmup/config.ts`
  - `src/services/warmup/scheduler.ts`
  - `src/services/warmupManager.ts`
  - `app/api/admin/reset-warmup-history/route.ts`
  - `prisma/schema.prisma`

#### 3. Poprawka zapisywania maili przychodzących
- **Problem**: Maile przychodzące nie trafiały do archiwum
- **Rozwiązanie**: 
  - Dodano poprawne mapowanie `toEmail` w procesorze
  - Wszystkie maile (campaign, test, warmup, bounce) trafiają do archiwum
- **Plik**: `src/integrations/inbox/processor.ts`

### 📝 Dokumentacja

#### Nowa dokumentacja email-types.md
- **Lokalizacja**: `docs/email-types.md`
- **Zawartość**: Pełna dokumentacja wszystkich typów maili w systemie
- **Kategorie**: TESTOWE, WARMUP, KAMPANIE WYCHODZĄCE, KAMPANIE PRZYCHODZĄCE, OBCE
- **Szczegóły**: 
  - Źródło każdego typu maila
  - Charakterystyka (campaignId, leadId, mailboxId)
  - Klasyfikacja AI
  - Tabele w bazie danych
  - Logika WEWNĘTRZNE vs ZEWNĘTRZNE

### ✅ Testowanie

Potwierdzono działanie:
- ✅ Pobieranie maili przychodzących przez cron
- ✅ Zapisywanie maili do InboxReply
- ✅ Klasyfikacja AI działa poprawnie
- ✅ Wszystkie typy maili trafiają do archiwum z poprawną kategorią
- ✅ BOUNCE kategoryzowane jako UNKNOWN ze source: bounce
- ✅ Test weryfikacyjny skrzynki trafia do archiwum
- ✅ Warmup tylko między naszymi skrzynkami

### 🗄️ Zmiany w bazie danych

```sql
-- Usunięto kolumnę z modelu Mailbox
-- warmupSeedEmails (nie używana)

-- Dodano opcjonalność dla campaignId i leadId w SendLog
ALTER TABLE "SendLog" ALTER COLUMN "campaignId" TYPE INTEGER;
ALTER TABLE "SendLog" ALTER COLUMN "leadId" TYPE INTEGER;
```

### 📦 Backup

Utworzono backup: `Kreativia Mailing 2-backup-20251026-011124`

---

## [2025-01-25] - Aktualizacja UI i funkcjonalności leadów

### ✨ Nowe funkcjonalności

#### 1. Edycja powitania w szczegółach leada
- **Lokalizacja**: `/leads/[id]`
- **Funkcjonalność**: 
  - Wyświetlanie pola `greetingForm` w szczegółach leada
  - Inline editing - możliwość edycji bezpośrednio na stronie
  - Zapisywanie zmian przez API endpoint `/api/leads/[id]/greeting`
- **Pliki**:
  - `app/leads/[id]/page.tsx` - dodano sekcję "Powitanie" z edycją inline
  - `app/api/leads/[id]/greeting/route.ts` - nowy endpoint PATCH do aktualizacji powitania

#### 2. Historia statusów leada
- **Lokalizacja**: `/leads/[id]` - sekcja "Historia statusów"
- **Funkcjonalność**:
  - Automatyczne zapisywanie zmian statusu w tabeli `LeadStatusHistory`
  - Wyświetlanie historii zmian statusu z datami i powodami
  - Wsparcie dla reaktywacji leadów
- **Pliki**:
  - `prisma/schema.prisma` - dodano model `LeadStatusHistory`
  - `app/api/leads/[id]/status/route.ts` - rozszerzono o zapisywanie historii
  - `app/api/leads/[id]/status-history/route.ts` - nowy endpoint GET do pobierania historii
  - `src/components/StatusManager.tsx` - dodano wyświetlanie historii statusów

#### 3. Generowanie powitan przez ChatGPT
- **Lokalizacja**: `/leads` - przycisk "Wygeneruj powitania"
- **Funkcjonalność**:
  - Batch processing - przetwarzanie leadów w grupach po 10
  - Progress bar z informacjami o postępie (procent, batch, czas)
  - Automatyczne generowanie spersonalizowanych powitan dla leadów bez `greetingForm`
  - Retry mechanism dla błędów API
- **Pliki**:
  - `app/leads/page.tsx` - dodano modal z progress barem
  - `app/api/leads/prepare-greetings-batch/route.ts` - endpoint do batch processingu
  - `src/services/chatgptService.ts` - serwis do komunikacji z ChatGPT API

### 🎨 Zmiany UI

#### 1. Usunięcie emoji
- Usunięto emoji z następujących elementów:
  - Status "NO_GREETING" (brak odmiany)
  - Przycisk "Import CSV"
  - Przycisk "Wygeneruj powitania"
  - Przycisk "Usuń" w tabeli leadów
  - Sekcja "Powitanie" w szczegółach leada
  - Badge "ZABLOKOWANY"
  - Komunikaty w `StatusManager`

#### 2. Stylizacja przycisku "Usuń"
- **Lokalizacja**: `/leads` - tabela leadów
- **Zmiany**:
  - Zmiana koloru z czerwonego na szary (#6c757d)
  - Zwiększenie odstępu między "Szczegóły" a "Usuń" (8px → 16px)
  - Dodanie hover effect (ciemniejszy szary #5a6268)
  - Usunięcie klasy CSS, dodanie inline styles

#### 3. Refaktoryzacja StatusManager
- **Lokalizacja**: `src/components/StatusManager.tsx`
- **Zmiany**:
  - Zastąpienie Tailwind CSS classes inline styles
  - Użycie CSS variables dla spójności z resztą aplikacji
  - Inlining komponentów `StatusBadge` i `StatusSelector`
  - Dopasowanie stylu do strony `/archive`

#### 4. Stylizacja strony szczegółów leada
- **Lokalizacja**: `/leads/[id]`
- **Zmiany**:
  - Nowy header z nazwą leada i opisem
  - Przycisk "Wróć" ze stylizacją zgodną z `/archive`
  - Przycisk zawsze prowadzi do `/leads` (zamiast `document.referrer`)
  - Usunięcie starego tytułu `<h1>Szczegóły kontaktu</h1>`

### 🔧 Poprawki techniczne

#### 1. Naprawa generowania powitan
- **Problem**: Przycisk "Wygeneruj powitania" nie wywoływał właściwego endpointu
- **Rozwiązanie**: Przekierowano na `/api/leads/prepare-greetings-batch`
- **Problem**: Tylko leady z bieżącej strony były przetwarzane (paginacja)
- **Rozwiązanie**: Dodano parametr `withoutGreetings=true` do API, pobieranie wszystkich leadów bez powitan

#### 2. Naprawa mapowania wyników ChatGPT
- **Problem**: Wyniki ChatGPT nie odpowiadały właściwym leadom
- **Rozwiązanie**:
  - Poprawiono dostęp do `chatgptResults[i].greetingForm` zamiast `chatgptResults[i]`
  - Dodano weryfikację długości `chatgptResults` vs `leadsToProcess`
  - Zachowanie kolejności leadów w `firstNames` i `lastNames` (bez filtrowania pustych)

#### 3. Naprawa progress baru importu CSV
- **Problem**: Progress bar nie działał podczas importu CSV
- **Rozwiązanie**: Zmiana portu w `updateProgress` z 3002 na 3000

#### 4. Naprawa zmiany statusu leada
- **Problem**: API endpoint oczekiwał angielskich nazw statusów, frontend wysyłał polskie
- **Rozwiązanie**: 
  - Aktualizacja API do akceptowania polskich statusów (AKTYWNY, BLOKADA, CZEKAJ, TEST, ZAINTERESOWANY)
  - Dodanie obsługi `subStatus` w API

#### 5. Naprawa bazy danych
- **Problem**: `DATABASE_URL` wskazywał na `./dev.db` zamiast `./prisma/dev.db`
- **Rozwiązanie**: Poprawiono ścieżkę w `.env`
- **Problem**: Tabela `LeadStatusHistory` nie była rozpoznawana przez Prisma Client
- **Rozwiązanie**: Uruchomiono `npx prisma generate` po dodaniu modelu

### 📁 Nowe pliki

```
app/api/leads/[id]/greeting/route.ts          - PATCH endpoint do aktualizacji powitania
app/api/leads/[id]/status-history/route.ts    - GET endpoint do pobierania historii statusów
```

### 📝 Zmodyfikowane pliki

```
app/leads/[id]/page.tsx                       - Dodano edycję powitania, nowy header, stylizację
app/leads/page.tsx                            - Zmiana nazwy przycisku, usunięcie emoji, progress bar
app/api/leads/[id]/status/route.ts            - Polskie statusy, subStatus, zapisywanie historii
app/api/leads/prepare-greetings-batch/route.ts - Poprawki mapowania wyników
app/api/leads/route.ts                        - Dodano parametr withoutGreetings
app/api/leads/import/route.ts                 - Poprawka portu w updateProgress
src/components/StatusManager.tsx              - Refaktoryzacja do inline styles, historia statusów
src/services/chatgptService.ts                - Weryfikacja wyników, fallback do domyślnych powitan
prisma/schema.prisma                          - Dodano model LeadStatusHistory
.env                                          - Poprawiono DATABASE_URL
```

### 🗄️ Zmiany w bazie danych

```sql
-- Nowa tabela
CREATE TABLE "LeadStatusHistory" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "leadId" INTEGER NOT NULL,
  "oldStatus" TEXT,
  "oldSubStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "newSubStatus" TEXT,
  "reason" TEXT,
  "changedBy" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadStatusHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indeksy
CREATE INDEX "LeadStatusHistory_leadId_idx" ON "LeadStatusHistory"("leadId");
CREATE INDEX "LeadStatusHistory_createdAt_idx" ON "LeadStatusHistory"("createdAt");
CREATE INDEX "LeadStatusHistory_newStatus_idx" ON "LeadStatusHistory"("newStatus");

-- Dodano relację w modelu Lead
-- statusHistory LeadStatusHistory[]
```

### 🧪 Testowanie

Wszystkie funkcjonalności zostały przetestowane:
- ✅ Edycja powitania w szczegółach leada
- ✅ Generowanie powitan przez ChatGPT z progress barem
- ✅ Import CSV z progress barem
- ✅ Zmiana statusu leada z zapisywaniem historii
- ✅ Wyświetlanie historii statusów
- ✅ Stylizacja przycisków i komponentów
- ✅ Nawigacja "Wróć" na stronie szczegółów leada

### 🐛 Znane problemy

Brak znanych problemów.

### 📚 Dokumentacja techniczna

#### API Endpoints

**PATCH `/api/leads/[id]/greeting`**
- Body: `{ greetingForm: string | null }`
- Response: `{ message: string, greetingForm: string | null }`

**GET `/api/leads/[id]/status-history`**
- Response: `{ history: LeadStatusHistory[] }`

**PATCH `/api/leads/[id]/status`**
- Body: `{ status: string, subStatus?: string, blockedReason?: string }`
- Akceptowane statusy: AKTYWNY, BLOKADA, CZEKAJ, TEST, ZAINTERESOWANY
- Response: `{ message: string, lead: Lead }`

**POST `/api/leads/prepare-greetings-batch`**
- Body: `{ leadIds: number[] }`
- Response (streaming): Progress updates

**GET `/api/leads/prepare-greetings-batch?importId=<id>`**
- Response: `{ status: string, progress: number, ... }`

**GET `/api/leads?withoutGreetings=true`**
- Response: `{ leads: Lead[], total: number }`

#### CSS Variables

Aplikacja używa CSS variables zdefiniowanych w `app/globals.css`:
- `--gray-50`, `--gray-100`, ..., `--gray-900` - kolory szare
- `--spacing-xs`, `--spacing-sm`, ..., `--spacing-2xl` - odstępy
- `--radius` - border radius
- `--primary`, `--success`, `--danger`, `--warning` - kolory akcji

### 🔄 Migracja

Aby zaktualizować istniejącą instalację:

```bash
# 1. Aktualizuj bazę danych
npx prisma db push

# 2. Wygeneruj Prisma Client
npx prisma generate

# 3. Zrestartuj serwer
npm run dev
```

### 👥 Autorzy

- Bartosz Kosiba
- AI Assistant (Claude Sonnet 4.5)

### 📅 Data

25 stycznia 2025

