# Analiza Duplikacji Limitów Warmup

## 🔍 **DWA RÓŻNE SYSTEMY:**

### 1️⃣ **Harmonogram Warmup** (`/warmup` → "Ustawienia harmonogramu")
- **Struktura:** 30 dni, każdy dzień ma:
  - `dailyLimit` - maile warmup
  - `campaignLimit` - maile kampanii
- **Przechowywane:** `CompanySettings.warmupSchedule` (JSON)
- **UI edycji:** `/warmup` → "Ustawienia harmonogramu"
- **Używany przez:**
  - ✅ `queueManager.ts:canSendCampaignEmail()` - dla skrzynek W WARMPIE
  - ✅ `warmup/scheduler.ts` - planowanie maili warmup
  - ✅ `warmup/tracker.ts` - zarządzanie dniami warmup

### 2️⃣ **Ustawienia Wydajności** (`/settings/performance`)
- **Struktura:** 5 tygodni, każdy tydzień ma:
  - `warmup` - maile warmup
  - `campaign` - maile kampanii
- **Przechowywane:** `CompanySettings.warmupPerformanceSettings` (JSON)
- **UI edycji:** `/settings/performance`
- **Używany przez:**
  - ⚠️ `mailboxManager.ts:getNextAvailableMailbox()` - dla skrzynek W WARMPIE I NIE W WARMPIE
  - Problem: Używa `warmupDailyLimit` zamiast `campaignLimit` z harmonogramu!

---

## ⚠️ **PROBLEM DUPLIKACJI:**

### Dla skrzynek W WARMPIE (`warming`):

**`queueManager.ts`:**
```typescript
config.campaignLimit  // Z harmonogramu warmup (30 dni)
```

**`mailboxManager.ts`:**
```typescript
Math.min(
  mailbox.dailyEmailLimit,
  mailbox.warmupDailyLimit,      // ❌ Złe - to limit warmup, nie kampanii!
  performanceLimits.campaign      // ❌ Z ustawień wydajności (tygodnie)
)
```

**Powinno być:**
```typescript
Math.min(
  mailbox.dailyEmailLimit,
  config.campaignLimit            // ✅ Z harmonogramu warmup
)
```

---

## 📊 **Porównanie:**

| Parametr | Harmonogram Warmup | Ustawienia Wydajności |
|----------|-------------------|----------------------|
| **Struktura** | 30 dni (dzień po dniu) | 5 tygodni (tydzień po tygodniu) |
| **Gdzie edytować** | `/warmup` → "Ustawienia harmonogramu" | `/settings/performance` |
| **Dla warmup** | ✅ Używany w `queueManager` | ❌ NIE używany poprawnie |
| **Dla nie-warmup** | ❌ Nie używany | ✅ Używany w `mailboxManager` |

---

## 🎯 **WNIOSEK:**

**TAK, to duplikacja!** Mamy dwa różne systemy ustawiania limitów:
1. Harmonogram warmup (30 dni) - dla skrzynek W WARMPIE
2. Ustawienia wydajności (5 tygodni) - dla skrzynek NIE W WARMPIE i... błędnie też dla warmup

**Problemy:**
1. `mailboxManager.ts` nie używa `campaignLimit` z harmonogramu dla warmup
2. Dwa różne miejsca edycji dla podobnych danych
3. Niespójność - różne źródła danych dla tego samego przypadku

**Rozwiązanie:**
- Usunąć `warmupPerformanceSettings` 
- Wszystko przejść na harmonogram warmup (30 dni)
- Dla skrzynek nie w warmup: użyć harmonogramu z `warmupDay = 0` lub specjalnej wartości


