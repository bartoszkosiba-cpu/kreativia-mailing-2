# INNE PROBLEMY Z DATAMI W SYSTEMIE

## 🔍 ZNALEZIONE PROBLEMY

### **1. emailCron.ts - Cleanup (linia 238-240)**

**Problem:**
```typescript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(0, 0, 0, 0);
```

**Co jest nie tak:**
- Używa `new Date()` który zwraca datę w lokalnym czasie systemu
- Nie używa `getStartOfTodayPL()` lub `getPolishTime()`
- Może obliczyć "wczoraj" w błędnej strefie czasowej

**Wpływ:**
- Cleanup może usuwać wpisy w złym czasie
- Może usuwać wpisy które powinny zostać

**Rozwiązanie:**
```typescript
const { getStartOfTodayPL } = await import('@/utils/polishTime');
const startOfTodayPL = getStartOfTodayPL();
const yesterdayPL = new Date(startOfTodayPL);
yesterdayPL.setDate(yesterdayPL.getDate() - 1);
yesterdayPL.setHours(0, 0, 0, 0);
```

---

### **2. queueManager.ts - calculateEstimatedDates (linia 101, 114, 118)**

**Problem:**
```typescript
let estimatedStart = new Date();
// ...
let estimatedEnd = new Date(estimatedStart);
// ...
estimatedEnd.setDate(estimatedEnd.getDate() + 1);
```

**Co jest nie tak:**
- Używa `new Date()` bez uwzględnienia polskiego czasu
- Obliczenia dat mogą być w błędnej strefie czasowej

**Wpływ:**
- Szacowane daty kampanii mogą być błędne
- Może wpływać na planowanie kampanii

**Rozwiązanie:**
```typescript
const { getPolishTime } = await import('@/utils/polishTime');
let estimatedStart = getPolishTime();
// ...
```

---

### **3. warmup/tracker.ts - advanceWarmupDays (linia 66)**

**Problem:**
```typescript
const today = new Date();
```

**Co jest nie tak:**
- Używa `new Date()` bez uwzględnienia polskiego czasu
- Obliczenia dni warmup mogą być błędne

**Wpływ:**
- Dni warmup mogą być błędnie obliczone
- Może wpływać na limity warmup

**Rozwiązanie:**
```typescript
const { getPolishTime } = await import('@/utils/polishTime');
const today = getPolishTime();
```

---

### **4. campaignEmailQueueV2.ts - przekładanie maili (linia 419-420)**

**Problem:**
```typescript
const nowPL = getPolishTime();
const tomorrowPL = new Date(nowPL);
tomorrowPL.setDate(tomorrowPL.getDate() + 1);
```

**Co jest nie tak:**
- Używa `getPolishTime()` ✅ (dobrze)
- Ale potem `setDate()` może mieć problemy z timezone

**Wpływ:**
- Maile mogą być przekładane na błędny dzień

**Status:**
- ⚠️ Potencjalny problem - warto sprawdzić

---

## 📊 PRIORYTET NAPRAW

1. **WYSOKI:** emailCron.ts - cleanup (może usuwać w złym czasie)
2. **ŚREDNI:** queueManager.ts - calculateEstimatedDates (szacowane daty)
3. **ŚREDNI:** warmup/tracker.ts - advanceWarmupDays (dni warmup)
4. **NISKI:** campaignEmailQueueV2.ts - przekładanie maili (może działać poprawnie)

---

## ✅ CO DZIAŁA POPRAWNIE

1. ✅ `resetMailboxCounter()` - używa `getStartOfTodayPL()`
2. ✅ `resetDailyCounters()` - używa `getStartOfTodayPL()`
3. ✅ `getNextAvailableMailbox()` - używa `getStartOfTodayPL()` i `isTodayPL()`
4. ✅ `syncMailboxCounterFromSendLog()` - używa `getStartOfTodayPL()`
5. ✅ `campaignEmailSenderV2.ts` - używa `getStartOfTodayPL()` dla limitów

---

**Data analizy:** 2025-11-04  
**Status:** ⚠️ Wymaga naprawy

