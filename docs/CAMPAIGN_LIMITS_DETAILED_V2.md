# Szczegółowa Dokumentacja Limitów Kampanii - WERSJA POPRAWIONA

## 📋 **Przypadek 1: Nowa skrzynka, NIE jest jeszcze w warmupie**

### Status: `inactive` lub `ready_to_warmup`

### ⚠️ **WAŻNE - SĄ DWIE RÓŻNE FUNKCJE SPRAWDZAJĄCE:**

#### **A) `queueManager.ts` → `canSendCampaignEmail()`** (linia 266-268)
```typescript
const canSend = mailbox.currentDailySent < mailbox.dailyEmailLimit;
```
**Limit kampanii:** `mailbox.dailyEmailLimit`
- **Źródło:** Parametr przy tworzeniu skrzynki
- **Domyślna wartość w formularzu:** `50` (linia 287 w `mailboxes/page.tsx`)
- **Możliwość zmiany:** Użytkownik ustawia ręcznie w formularzu dodawania skrzynki

#### **B) `mailboxManager.ts` → `getNextAvailableMailbox()`** (linia 157-166)
```typescript
const week = getWeekFromDay(0); // Tydzień 1 dla skrzynek bez warmup
const performanceLimits = await getPerformanceLimits(week);

effectiveLimit = Math.min(
  mailbox.dailyEmailLimit,
  performanceLimits.campaign  // ⚠️ TO DODATKOWE OGRANICZENIE!
);
```
**Limit kampanii:** `Math.min(mailbox.dailyEmailLimit, performanceLimits.campaign)`

**Źródła danych:**
1. `mailbox.dailyEmailLimit` - z formularza (domyślnie 50)
2. **`performanceLimits.campaign`** - z ustawień wydajności:
   - **Gdzie:** `CompanySettings.warmupPerformanceSettings` (JSON)
   - **Edycja:** Strona `/settings/performance` → "Ustawienia wydajności skrzynek"
   - **Domyślna wartość:** `10` dla tygodnia 1 (linia 46, 54, 60 w `mailboxManager.ts`)
   - **Domyślna wartość w UI:** Tydzień 1 = `10` (linia 14 w `performance/page.tsx`)

**Faktyczny limit:** `Math.min(50, 10) = 10` ⚠️

---

## 📊 **Kompletna Tabela Limitów**

| Przypadek | Status | Funkcja | Limit kampanii | Źródło 1 | Źródło 2 | Faktyczny limit |
|-----------|--------|---------|----------------|----------|----------|-----------------|
| **1. Nowa, nie w warmup** | `inactive`/`ready_to_warmup` | `queueManager.canSendCampaignEmail` | `dailyEmailLimit` | Formularz (domyślnie **50**) | - | **50** (lub ustawione ręcznie) |
| **1. Nowa, nie w warmup** | `inactive`/`ready_to_warmup` | `mailboxManager.getNextAvailableMailbox` | `Math.min(dailyEmailLimit, performanceLimits.campaign)` | Formularz (50) | **Ustawienia wydajności** (domyślnie **10**) | **10** ⚠️ |
| **2. Gotowa (nie nowa)** | `ready` | `queueManager.canSendCampaignEmail` | `dailyEmailLimit` | Wartość w bazie | - | Wartość w bazie |
| **2. Gotowa (nie nowa)** | `ready` | `mailboxManager.getNextAvailableMailbox` | `Math.min(dailyEmailLimit, performanceLimits.campaign)` | Baza danych | **Ustawienia wydajności** (10) | **10** lub mniej ⚠️ |
| **3. W warmup** | `warming` | `queueManager.canSendCampaignEmail` | `config.campaignLimit` | **Harmonogram warmup** (dzień 1-30) | - | Z harmonogramu (np. 5, 20) |
| **3. W warmup** | `warming` | `mailboxManager.getNextAvailableMailbox` | `Math.min(dailyEmailLimit, warmupDailyLimit, performanceLimits.campaign)` | Baza | Warmup config | **Ustawienia wydajności** | **BŁĄD - nie używa campaignLimit!** |
| **4. Zakończyła warmup** | `ready` | `queueManager.canSendCampaignEmail` | `dailyEmailLimit` | Wartość w bazie | - | Wartość w bazie |

---

## 🔍 **Dokładne Źródła Danych**

### 1. `mailbox.dailyEmailLimit`
- **Ustawiane:** W formularzu dodawania/edycji skrzynki (`/salespeople/[id]/mailboxes`)
- **Domyślna wartość w formularzu:** `50` (linia 287 w `page.tsx`)
- **Domyślna wartość w schemacie:** `50` (schema.prisma)
- **Gdzie w kodzie:** `app/salespeople/[id]/mailboxes/page.tsx:287`

### 2. `performanceLimits.campaign` (TYLKO w `mailboxManager.ts`)
- **Źródło:** `CompanySettings.warmupPerformanceSettings` (JSON)
- **Struktura:** `[{week: 1, warmup: 15, campaign: 10}, ...]`
- **Domyślna wartość:** `10` dla tygodnia 1 (jeśli brak ustawień)
- **Edycja:** Strona `/settings/performance` → "Ustawienia wydajności skrzynek"
- **Gdzie w kodzie:** 
  - Pobieranie: `src/services/mailboxManager.ts:40-62`
  - Użycie: `src/services/mailboxManager.ts:163` (dla skrzynek nie w warmup)
  - UI edycji: `app/settings/performance/page.tsx:14`

### 3. `config.campaignLimit` (TYLKO dla warmup)
- **Źródło:** Harmonogram warmup (30 dni)
- **Może być:**
  - Domyślny: `src/services/warmup/config.ts` → `WARMUP_SCHEDULE[day].campaignLimit`
  - Custom: `CompanySettings.warmupSchedule` (JSON z tabeli)
- **Edycja:** Strona `/warmup` → "Ustawienia harmonogramu"
- **Przykłady:** Dzień 1 = 5, Dzień 15 = 20, Dzień 30 = 20

---

## ⚠️ **Wykryte Niespójności:**

1. **`queueManager.ts`** NIE sprawdza `performanceLimits.campaign` dla skrzynek nie w warmup
2. **`mailboxManager.ts`** sprawdza `performanceLimits.campaign` i ogranicza limit do **10** (domyślnie)
3. **`mailboxManager.ts`** dla warmup używa `warmupDailyLimit` zamiast `campaignLimit` z harmonogramu

**Konsekwencje:**
- Jeśli używasz `queueManager` → limit = 50 (lub ustawione ręcznie)
- Jeśli używasz `mailboxManager` → limit = **10** (ograniczone przez performanceLimits)

---

## 🎯 **Odpowiedź na pytanie:**

**Dla przypadku 1 (nowa skrzynka, nie w warmup):**

Limit **10** pochodzi z:
- **`CompanySettings.warmupPerformanceSettings`** → Tydzień 1 → `campaign: 10`
- **Gdzie edytować:** `/settings/performance` → "Ustawienia wydajności skrzynek"
- **Używane przez:** TYLKO `mailboxManager.ts` (nie `queueManager.ts`!)

Jeśli w formularzu masz limit 50, ale faktyczny limit to 10, to znaczy że `mailboxManager.getNextAvailableMailbox()` ogranicza go do wartości z ustawień wydajności.


