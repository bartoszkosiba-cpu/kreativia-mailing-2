# Weryfikacja limitów - wszystkie przypadki ✅

## ✅ **PRZYPADEK 1: Nowa skrzynka (inactive/ready_to_warmup)**

**Limit:**
- ✅ `10` maili dziennie (stałe)
- **Miejsce:** `queueManager.ts:canSendCampaignEmail()` (295-299), `mailboxManager.ts` (158-162)

**Licznik:**
- ✅ `mailbox.currentDailySent`
- **Zwiększanie:** `incrementMailboxCounter()` → `currentDailySent++`
- **Reset:** `resetMailboxCounter()` → `currentDailySent = 0` (co nowy dzień)

**Status:** ✅ POPRAWNIE

---

## ✅ **PRZYPADEK 2 i 4: Gotowa skrzynka (ready, nie w warmup)**

**Limit:**
- ✅ `mailbox.dailyEmailLimit` (ustawione na skrzynce)
- **Miejsce:** `queueManager.ts:canSendCampaignEmail()` (301-303), `mailboxManager.ts` (164-167)

**Licznik:**
- ✅ `mailbox.currentDailySent`
- **Zwiększanie:** `incrementMailboxCounter()` → `currentDailySent++`
- **Reset:** `resetMailboxCounter()` → `currentDailySent = 0` (co nowy dzień)

**Status:** ✅ POPRAWNIE

---

## ✅ **PRZYPADEK 3: W warmup (warming)**

### **Limit kampanii:**
- ✅ `performanceLimits.campaign` z `/settings/performance` (według tygodnia)
- ✅ `Math.min(dailyEmailLimit, warmupDailyLimit, campaignLimit)` w `mailboxManager.ts`
- **Miejsce:** `queueManager.ts:canSendCampaignEmail()` (250-293), `mailboxManager.ts` (143-157)

### **Limit warmup:**
- ✅ `performanceLimits.warmup` z `/settings/performance` (według tygodnia)
- ✅ Ustawiane w `mailbox.warmupDailyLimit` przez `warmup/tracker.ts`

### **Mapowanie tygodni:**
- ✅ Tydzień 1: dni 1-7
- ✅ Tydzień 2: dni 8-14
- ✅ Tydzień 3: dni 15-21
- ✅ Tydzień 4: dni 22-28
- ✅ Tydzień 5: dni 29-35

### **Licznik kampanii:**
- ✅ `currentDailySent - warmupTodaySent` (wszystkie maile minus warmup)
- **Miejsce:** `queueManager.ts` (291), `mailboxManager.ts` (157) ✅ NAPRAWIONE
- **Zwiększanie:** `incrementMailboxCounter()` → `currentDailySent++` ✅ NAPRAWIONE
- **Reset:** `resetMailboxCounter()` → `currentDailySent = 0` (co nowy dzień)

### **Licznik warmup:**
- ✅ `mailbox.warmupTodaySent`
- **Zwiększanie:** `warmup/sender.ts` → `warmupTodaySent++`
- **Reset:** `warmup/tracker.ts:resetDailyCounters()` → `warmupTodaySent = 0` (codziennie o 00:00)

### **Łączny licznik (currentDailySent):**
- ✅ Zawiera WSZYSTKIE maile dzisiaj (warmup + kampanie)
- ✅ Warmup: zwiększa `warmupTodaySent` + `currentDailySent` (warmup/sender.ts)
- ✅ Kampanie: zwiększa tylko `currentDailySent` (mailboxManager.ts) ✅ NAPRAWIONE

**Status:** ✅ POPRAWNIE (naprawione)

---

## 📊 **Podsumowanie zmian:**

### ✅ **Naprawione:**
1. `mailboxManager.ts:getNextAvailableMailbox()` - używa `currentDailySent - warmupTodaySent` dla kampanii w warmup
2. `mailboxManager.ts:incrementMailboxCounter()` - zawsze zwiększa `currentDailySent` (dla kampanii), nie sprawdza warmup status

### ✅ **Działają poprawnie:**
- Resetowanie liczników (wszystkie przypadki)
- Mapowanie tygodni warmup
- Pobieranie limitów z `/settings/performance`
- Liczniki warmup (osobny system)

**WSZYSTKIE PRZYPADKI TERAZ DZIAŁAJĄ POPRAWNIE! ✅**


