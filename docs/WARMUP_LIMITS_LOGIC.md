# Logika Limitów Warmup i Kampanii

## 🎯 Podstawowe założenia

Harmonogram warmup ma **DWA typy limitów** dla każdego dnia (1-30):

1. **`dailyLimit`** - limit maili **warmup** dziennie (między skrzynkami systemowymi)
2. **`campaignLimit`** - limit maili z **kampanii** dziennie dla skrzynek w warmupie

## 📊 Przykładowy harmonogram

```typescript
// Dzień 1: 15 maili warmup, 5 maili z kampanii
{ day: 1, dailyLimit: 15, campaignLimit: 5 }

// Dzień 15: 30 maili warmup, 20 maili z kampanii  
{ day: 15, dailyLimit: 30, campaignLimit: 20 }

// Dzień 30: 30 maili warmup, 20 maili z kampanii
{ day: 30, dailyLimit: 30, campaignLimit: 20 }
```

## 🔍 Jak działa sprawdzanie limitów?

### Dla skrzynek W WARMPIE (`warmupStatus === 'warming'`):

**W `queueManager.ts` - funkcja `canSendCampaignEmail()`:**
- Pobiera konfigurację dla danego dnia: `getWarmupConfig(mailbox.warmupDay)`
- **Używa `config.campaignLimit`** z harmonogramu
- Sprawdza: `campaignEmailsSent < config.campaignLimit`
- Gdzie: `campaignEmailsSent = currentDailySent - warmupTodaySent`

**W `mailboxManager.ts` - funkcja `getNextAvailableMailbox()`:**
- **Używa `Math.min(3 limity)`**:
  1. `mailbox.dailyEmailLimit` (ustawienie skrzynki)
  2. `mailbox.warmupDailyLimit` (limit z konfiguracji warmup dla danego dnia)
  3. `performanceLimits.campaign` (ustawienia wydajności)
- **Problem**: Nie używa bezpośrednio `campaignLimit` z harmonogramu!

### Dla skrzynek NIE W WARMPIE (`warmupStatus !== 'warming'`):

**W `queueManager.ts`:**
- Używa normalnego limitu: `mailbox.currentDailySent < mailbox.dailyEmailLimit`

**W `mailboxManager.ts`:**
- Używa `Math.min(2 limity)`:
  1. `mailbox.dailyEmailLimit`
  2. `performanceLimits.campaign`

## ⚠️ Wykryte niespójności

1. **`queueManager.ts`** używa `campaignLimit` z harmonogramu warmup ✅
2. **`mailboxManager.ts`** używa `warmupDailyLimit` (zamiast `campaignLimit`) ❌

## 🎯 Odpowiedzi na pytania:

### 1. Czy ustawienia warmup wpływają na możliwą ilość maili przy wysyłce z kampanii?

**TAK** - dla skrzynek w warmupie:
- Limit kampanii zależy od **`campaignLimit`** w harmonogramie dla danego dnia warmup
- Np. dzień 1 = max 5 maili kampanii, dzień 15 = max 20 maili kampanii

### 2. Jeśli skrzynka jest nowa i jest w trybie warmup, jaki bierze limit?

**Dla kampanii:**
- `campaignLimit` z harmonogramu dla aktualnego dnia warmup
- Np. jeśli `warmupDay = 1` → `campaignLimit = 5` maili kampanii dziennie

**Dla warmup (między skrzynkami):**
- `dailyLimit` z harmonogramu dla aktualnego dnia warmup  
- Np. jeśli `warmupDay = 1` → `dailyLimit = 15` maili warmup dziennie

### 3. Jeśli skrzynka jest "gotowa" (nie w warmup), jaki limit?

- Używa normalnego `mailbox.dailyEmailLimit` ustawionego dla skrzynki
- Może być ograniczony przez `performanceLimits.campaign` (ustawienia wydajności)

## 📝 Podsumowanie

| Status skrzynki | Limit kampanii | Limit warmup |
|----------------|----------------|--------------|
| `warming` (dzień 1) | `campaignLimit` (5) | `dailyLimit` (15) |
| `warming` (dzień 15) | `campaignLimit` (20) | `dailyLimit` (30) |
| `ready` (nie w warmup) | `dailyEmailLimit` | - |

## 🔧 Zalecana naprawa

`mailboxManager.ts` powinien używać `campaignLimit` z harmonogramu dla skrzynek w warmupie, podobnie jak `queueManager.ts`.


