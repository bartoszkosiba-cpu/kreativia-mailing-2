# Szczegółowa Dokumentacja Limitów Kampanii dla Skrzynek

## 📋 Statusy Skrzynek (`warmupStatus`)

Dostępne statusy:
- `inactive` - nieaktywna, nie rozpoczęto warmup
- `dns_pending` - oczekuje na konfigurację DNS
- `ready_to_warmup` - gotowa do rozpoczęcia warmup (DNS OK)
- `warming` - **AKTYWNIE W WARMPIE** (dni 1-30)
- `ready` - **ZAKOŃCZONY WARMPUP** (po 30 dniach)
- `failed` - błąd warmup

---

## 🎯 Limity Kampanii - Szczegółowe Przypadki

### 1️⃣ **Skrzynka NOWA, NIE jest jeszcze w warmupie**
**Status:** `inactive` lub `ready_to_warmup`  
**Lokalizacja kodu:** `queueManager.ts:canSendCampaignEmail()` linia 266-268

**Limit kampanii:**
```typescript
mailbox.currentDailySent < mailbox.dailyEmailLimit
```

**Źródło danych:**
- **`mailbox.dailyEmailLimit`** - ustawione podczas tworzenia skrzynki (parametr `body.dailyEmailLimit` w POST `/api/salespeople/[id]/mailboxes`)
- **Domyślna wartość:** `50` (z schema.prisma)
- **Gdzie ustawiane:** Frontend przy dodawaniu skrzynki w `/salespeople/[id]/mailboxes`

**Sprawdzenie:** `queueManager.ts` linia 267

---

### 2️⃣ **Skrzynka NIE jest nowa, zaznaczona jako GOTOWA**
**Status:** `ready` (po zakończeniu warmup)  
**Lokalizacja kodu:** `queueManager.ts:canSendCampaignEmail()` linia 266-268

**Limit kampanii:**
```typescript
mailbox.currentDailySent < mailbox.dailyEmailLimit
```

**Źródło danych:**
- **`mailbox.dailyEmailLimit`** - wartość w bazie danych dla skrzynki
- **Ustawione przez:** Użytkownik ręcznie lub automatycznie po warmup
- **Po warmup:** Może być automatycznie ustawione przez `update-warmup-limits` (np. 75)

**Sprawdzenie:** `queueManager.ts` linia 267

---

### 3️⃣ **Skrzynka JEST w programie warmup**
**Status:** `warming`  
**Lokalizacja kodu:** `queueManager.ts:canSendCampaignEmail()` linia 251-263

**Limit kampanii:**
```typescript
campaignEmailsSent < config.campaignLimit
```

Gdzie:
- `campaignEmailsSent = mailbox.currentDailySent - mailbox.warmupTodaySent`
- `config.campaignLimit` pochodzi z harmonogramu warmup dla danego dnia

**Źródło danych:**
1. **Harmonogram warmup** (`config.campaignLimit`):
   - Pobierany z: `src/services/warmup/config.ts` → `getWarmupConfig(mailbox.warmupDay)`
   - Może być:
     - **Domyślny:** `WARMUP_SCHEDULE[day - 1].campaignLimit`
     - **Custom:** `CompanySettings.warmupSchedule` (JSON z tabeli ustawień harmonogramu)
   - **Przykład:** Dzień 1 = `5`, Dzień 15 = `20`, Dzień 30 = `20`

2. **Liczniki:**
   - `mailbox.currentDailySent` - WSZYSTKIE maile (warmup + kampanie)
   - `mailbox.warmupTodaySent` - tylko maile warmup
   - Różnica = maile kampanii wysłane dzisiaj

**Sprawdzenie:** `queueManager.ts` linia 262-263

**⚠️ UWAGA:** `mailboxManager.ts` używa innej logiki (Math.min) - patrz poniżej

---

### 4️⃣ **Skrzynka ZAKOŃCZYŁA warmup**
**Status:** `ready`  
**Lokalizacja kodu:** `queueManager.ts:canSendCampaignEmail()` linia 266-268

**Limit kampanii:**
```typescript
mailbox.currentDailySent < mailbox.dailyEmailLimit
```

**Źródło danych:**
- **`mailbox.dailyEmailLimit`** - wartość w bazie danych
- **Po zakończeniu warmup:** Może być automatycznie zaktualizowane (np. do 75) przez funkcję `update-warmup-limits`
- **Lub ręcznie ustawione** przez użytkownika

**Sprawdzenie:** `queueManager.ts` linia 267

---

## ⚠️ **NIESPÓJNOŚCI W KODZIE**

### W `queueManager.ts` (funkcja `canSendCampaignEmail`):
- ✅ Dla `warming`: używa `config.campaignLimit` z harmonogramu
- ✅ Dla innych: używa `mailbox.dailyEmailLimit`

### W `mailboxManager.ts` (funkcja `getNextAvailableMailbox`):
- ❌ Dla `warming` lub `ready_to_warmup`: używa `Math.min(3 limity)`:
  1. `mailbox.dailyEmailLimit`
  2. `mailbox.warmupDailyLimit` 
  3. `performanceLimits.campaign` (z `warmupPerformanceSettings`)
  
- ✅ Dla innych: używa `Math.min(2 limity)`:
  1. `mailbox.dailyEmailLimit`
  2. `performanceLimits.campaign`

**Problem:** `mailboxManager.ts` NIE używa `campaignLimit` z harmonogramu warmup!

---

## 📊 Podsumowanie Limitów

| Status | Funkcja sprawdzająca | Limit kampanii | Źródło danych |
|--------|---------------------|----------------|---------------|
| `inactive` | `queueManager.canSendCampaignEmail` | `mailbox.dailyEmailLimit` | Parametr przy tworzeniu (domyślnie 50) |
| `ready_to_warmup` | `queueManager.canSendCampaignEmail` | `mailbox.dailyEmailLimit` | Parametr przy tworzeniu (domyślnie 50) |
| `warming` | `queueManager.canSendCampaignEmail` | `config.campaignLimit` | **Harmonogram warmup** (dzień 1-30) |
| `ready` | `queueManager.canSendCampaignEmail` | `mailbox.dailyEmailLimit` | Wartość w bazie (może być automatycznie ustawiona po warmup) |

---

## 🔍 Dokładne Źródła Danych

### `mailbox.dailyEmailLimit`
- **Tworzenie skrzynki:** Parametr `body.dailyEmailLimit` w POST `/api/salespeople/[id]/mailboxes`
- **Domyślna wartość:** `50` (z schema.prisma)
- **Możliwość zmiany:** Ręcznie przez użytkownika w UI

### `config.campaignLimit` (dla warmup)
- **Domyślny harmonogram:** `src/services/warmup/config.ts` → `WARMUP_SCHEDULE[day].campaignLimit`
- **Custom harmonogram:** `CompanySettings.warmupSchedule` (JSON) → `getWarmupSchedule()` → `getWarmupConfig(day)`
- **Edycja:** Tabela w `/warmup` → "Ustawienia harmonogramu"

### `performanceLimits.campaign`
- **Źródło:** `CompanySettings.warmupPerformanceSettings` (JSON)
- **Struktura:** `[{week: 1, warmup: 15, campaign: 10}, ...]`
- **Edycja:** Strona `/settings/performance`

---

## 🐛 **Znaleziony Problem**

`mailboxManager.ts` używa innej logiki niż `queueManager.ts`:
- `mailboxManager` używa `warmupDailyLimit` (limit warmup, nie kampanii!)
- Powinien używać `campaignLimit` z harmonogramu dla skrzynek w warmupie

**Naprawa wymagana:** `mailboxManager.ts` linia 143-155


