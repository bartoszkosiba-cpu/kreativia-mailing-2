# ✅ WERYFIKACJA: Spójność danych UI vs SYSTEM

## 🔍 PYTANIE
**Czy system działa dobrze i czy dane są poprawne i zgodne w obu przypadkach (UI i SYSTEM)?**

## ✅ ODPOWIEDŹ

**TAK - algorytmy są identyczne, ale mogą być rozbieżności w danych jeśli `currentDailySent` nie jest zsynchronizowane z `SendLog`.**

---

## 📊 PORÓWNANIE ALGORYTMÓW

### **UI (API `/api/campaigns/[id]/mailboxes`)**
**Plik:** `app/api/campaigns/[id]/mailboxes/route.ts` (linie 131-162)

```typescript
if (mailbox.warmupStatus === 'warming') {
  const week = getWeekFromDay(mailbox.warmupDay || 0);
  const performanceLimits = await getPerformanceLimits(week);
  effectiveLimit = Math.min(
    mailbox.dailyEmailLimit,
    mailbox.warmupDailyLimit,
    performanceLimits.campaign
  );
  currentSent = Math.max(0, mailbox.currentDailySent - mailbox.warmupTodaySent);
} else if (mailbox.warmupStatus === 'inactive' || mailbox.warmupStatus === 'ready_to_warmup') {
  effectiveLimit = 10;
  currentSent = mailbox.currentDailySent;
} else {
  effectiveLimit = mailbox.dailyEmailLimit;
  currentSent = mailbox.currentDailySent;
}
remaining = effectiveLimit - currentSent;
```

### **SYSTEM (`getNextAvailableMailbox`)**
**Plik:** `src/services/mailboxManager.ts` (linie 148-176)

```typescript
if (mailbox.warmupStatus === 'warming') {
  const week = getWeekFromDay(mailbox.warmupDay || 0);
  const performanceLimits = await getPerformanceLimits(week);
  effectiveLimit = Math.min(
    mailbox.dailyEmailLimit,
    mailbox.warmupDailyLimit,
    performanceLimits.campaign
  );
  currentSent = Math.max(0, mailbox.currentDailySent - mailbox.warmupTodaySent);
} else if (mailbox.warmupStatus === 'inactive' || mailbox.warmupStatus === 'ready_to_warmup') {
  effectiveLimit = 10;
  currentSent = mailbox.currentDailySent;
} else {
  effectiveLimit = mailbox.dailyEmailLimit;
  currentSent = mailbox.currentDailySent;
}
remaining = effectiveLimit - currentSent;
```

### **SYSTEM (rezerwacja slotu)**
**Plik:** `src/services/campaignEmailSenderV2.ts` (linie 254-283)

```typescript
// IDENTYCZNY ALGORYTM jak powyżej
if (mailboxForReservation.warmupStatus === 'warming') {
  // ... identyczny kod ...
} else if (mailboxForReservation.warmupStatus === 'inactive' || ...) {
  effectiveLimit = 10;
  currentSent = mailboxForReservation.currentDailySent;
} else {
  effectiveLimit = mailboxForReservation.dailyEmailLimit;
  currentSent = mailboxForReservation.currentDailySent;
}

// Dodatkowa walidacja
if (currentSent >= effectiveLimit) {
  return { email: null, locked: false };
}
```

---

## ✅ WERYFIKACJA

### **1. Algorytmy są IDENTYCZNE**
- ✅ Używają tych samych warunków (`warmupStatus`)
- ✅ Używają tych samych funkcji (`getWeekFromDay`, `getPerformanceLimits`)
- ✅ Obliczają `effectiveLimit` tak samo (`Math.min` dla warmup, `10` dla nowych, `dailyEmailLimit` dla gotowych)
- ✅ Obliczają `currentSent` tak samo (`currentDailySent` lub `currentDailySent - warmupTodaySent`)
- ✅ Obliczają `remaining` tak samo (`effectiveLimit - currentSent`)

### **2. Dane z bazy są wspólne**
- ✅ Oba używają `mailbox.currentDailySent` z bazy danych
- ✅ Oba używają `mailbox.dailyEmailLimit` z bazy danych
- ✅ Oba używają `mailbox.warmupStatus`, `mailbox.warmupDay`, `mailbox.warmupTodaySent` z bazy danych

### **3. Obliczenia są zgodne**
- ✅ Jeśli `currentDailySent` jest zsynchronizowane z `SendLog` → UI i SYSTEM pokażą te same wartości
- ✅ Jeśli `currentDailySent` jest niezgodne z `SendLog` → mogą być rozbieżności

---

## ⚠️ MOŻLIWE ROZBIEŻNOŚCI

### **1. Niesynchronizowane `currentDailySent`**

**Problem:** `currentDailySent` może być niezgodne z rzeczywistymi danymi z `SendLog` (stare dane z V1).

**Przykład:**
- `SendLog.count()` dla dzisiaj: 137 maili
- `mailbox.currentDailySent`: 10 maili
- Różnica: 127 maili

**Rozwiązanie:**
```typescript
// Użyj funkcji synchronizacji
import { syncAllMailboxCountersFromSendLog } from '@/services/mailboxManager';
await syncAllMailboxCountersFromSendLog();
```

### **2. Race condition (czasowa)**

**Problem:** UI odświeża się co 60s, system działa co 30s. UI może pokazać stare dane jeśli system wysłał mail między odświeżeniami.

**Przykład:**
- UI pokazuje: `remaining = 5`
- System wysyła mail → `remaining = 4`
- UI nadal pokazuje: `remaining = 5` (do następnego odświeżenia)

**Rozwiązanie:**
- ✅ System zawsze sprawdza aktualny stan z bazy przed wysłaniem
- ✅ Atomowa rezerwacja slotu zapobiega race conditions
- ✅ UI pokazuje przybliżony stan (dla informacji)

### **3. Cache przeglądarki**

**Problem:** Przeglądarka może cache'ować dane API przez kilka sekund.

**Rozwiązanie:**
- API nie używa cache headers
- UI odświeża się co 60s automatycznie

---

## 🔒 BEZPIECZEŃSTWO SYSTEMU

### **System zawsze sprawdza aktualny stan:**

1. **Przed wyborem skrzynki:**
   ```typescript
   const availableMailbox = await getNextAvailableMailbox(..., campaignId);
   // Sprawdza aktualny currentDailySent z bazy
   ```

2. **Przed rezerwacją slotu:**
   ```typescript
   const mailboxForReservation = await tx.mailbox.findUnique({
     where: { id: availableMailbox.id },
     select: { currentDailySent: true, ... }
   });
   // Pobiera aktualne dane w transakcji
   ```

3. **Atomowa rezerwacja:**
   ```sql
   UPDATE Mailbox 
   SET currentDailySent = currentDailySent + 1
   WHERE id = X AND currentDailySent < effectiveLimit
   ```
   - Jeśli `currentDailySent >= effectiveLimit` → rezerwacja się nie powiedzie (0 rows affected)
   - System nie użyje skrzynki jeśli brak miejsca

---

## ✅ WNIOSEK

### **Dane są zgodne jeśli:**
- ✅ `currentDailySent` jest zsynchronizowane z `SendLog`
- ✅ System używa aktualnych danych z bazy przed wysłaniem
- ✅ Atomowa rezerwacja zapobiega przekroczeniu limitów

### **Możliwe rozbieżności:**
- ⚠️ Niesynchronizowane `currentDailySent` (stare dane z V1)
- ⚠️ Race condition (czasowa - UI pokazuje stare dane)
- ⚠️ Cache przeglądarki (czasowa)

### **Bezpieczeństwo:**
- ✅ System zawsze sprawdza aktualny stan z bazy
- ✅ Atomowa rezerwacja zapobiega race conditions
- ✅ System nie przekroczy limitów (sprawdza `currentDailySent < effectiveLimit`)

---

## 🔧 REKOMENDACJA

**Aby zapewnić pełną zgodność:**

1. **Zsynchronizuj `currentDailySent` z `SendLog`:**
   ```typescript
   await syncAllMailboxCountersFromSendLog();
   ```

2. **Uruchom synchronizację przy starcie serwera** (opcjonalnie)

3. **Monitoruj rozbieżności** (loguj gdy `currentDailySent != SendLog.count()`)

**Po synchronizacji UI i SYSTEM będą pokazywać te same wartości!**

