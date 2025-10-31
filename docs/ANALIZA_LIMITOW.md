# Analiza limitów maili - wszystkie przypadki

## 🔍 **Sprawdzanie każdego przypadku:**

### **PRZYPADEK 1: Nowa skrzynka (inactive/ready_to_warmup)**

**Miejsce w kodzie:**
- `queueManager.ts:canSendCampaignEmail()` (295-299)
- `mailboxManager.ts:getNextAvailableMailbox()` (158-162)

**Limit dzienny:**
- ✅ STAŁE 10 maili dziennie

**Licznik użyty:**
- ✅ `mailbox.currentDailySent`

**Reset licznika:**
- ✅ `resetMailboxCounter()` resetuje `currentDailySent = 0`

**Problem:**
- ❓ Brak - wygląda OK

---

### **PRZYPADEK 2 i 4: Gotowa skrzynka (ready, nie w warmup)**

**Miejsce w kodzie:**
- `queueManager.ts:canSendCampaignEmail()` (301-303)
- `mailboxManager.ts:getNextAvailableMailbox()` (164-167)

**Limit dzienny:**
- ✅ `mailbox.dailyEmailLimit` (ustawione na skrzynce)

**Licznik użyty:**
- ✅ `mailbox.currentDailySent`

**Reset licznika:**
- ✅ `resetMailboxCounter()` resetuje `currentDailySent = 0`

**Problem:**
- ❓ Brak - wygląda OK

---

### **PRZYPADEK 3: W warmup (warming)** ⚠️

**Miejsce w kodzie:**
- `queueManager.ts:canSendCampaignEmail()` (250-293)
- `mailboxManager.ts:getNextAvailableMailbox()` (143-155)

**Limit dzienny kampanii:**
- ✅ `performanceLimits.campaign` z `/settings/performance` (według tygodnia)
- ✅ `Math.min(dailyEmailLimit, warmupDailyLimit, campaign)` w `mailboxManager.ts`

**Limit dzienny warmup:**
- ✅ `performanceLimits.warmup` z `/settings/performance` (według tygodnia)
- ✅ Ustawiane w `mailbox.warmupDailyLimit` przez `warmup/tracker.ts`

**Mapowanie tygodni:**
- ✅ `getWeekFromDay()`:
  - Tydzień 1: dni 1-7
  - Tydzień 2: dni 8-14
  - Tydzień 3: dni 15-21
  - Tydzień 4: dni 22-28
  - Tydzień 5: dni 29-35

**Licznik kampanii:**
- ✅ `queueManager.ts`: `campaignEmailsSent = currentDailySent - warmupTodaySent` ✅ POPRAWNIE
- ❌ `mailboxManager.ts`: `currentSent = mailbox.warmupTodaySent` ❌ BŁĄD! To licznik warmup!

**Licznik warmup:**
- ✅ `mailbox.warmupTodaySent`

**Reset liczników:**
- ✅ `resetDailyCounters()` (warmup/tracker.ts) resetuje `warmupTodaySent = 0` codziennie o 00:00
- ✅ `resetMailboxCounter()` resetuje `currentDailySent = 0` gdy nowy dzień

**PROBLEM:**
- ❌ W `mailboxManager.ts:getNextAvailableMailbox()` dla warmup używa `currentSent = mailbox.warmupTodaySent` zamiast `currentDailySent - warmupTodaySent`
- To powoduje że używa licznika warmup jako licznika kampanii!

---

## 📊 **Podsumowanie:**

### ✅ **Działają poprawnie:**
1. Przypadek 1 - limit i licznik OK
2. Przypadek 2 i 4 - limit i licznik OK
3. Przypadek 3 - `queueManager.ts` - licznik kampanii OK
4. Resetowanie liczników - OK dla wszystkich przypadków
5. Mapowanie tygodni - OK

### ❌ **PROBLEM:**
- `mailboxManager.ts` dla warmup używa złego licznika (warmupTodaySent zamiast campaignEmailsSent)


