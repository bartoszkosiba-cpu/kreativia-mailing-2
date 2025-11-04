# 📊 ANALIZA ATOMOWEJ REZERWACJI SLOTU SKRZYNKI

## 🎯 CEL

Atomowa rezerwacja slotu skrzynki przed zablokowaniem maila, aby wyeliminować race condition w ramach jednej kampanii.

---

## ✅ CZY TO NAPRAWI PROBLEM?

### **Problem do rozwiązania:**
- Dwa maile z tej samej kampanii mogą jednocześnie zobaczyć dostępną skrzynkę (1 slot)
- Oba próbują wysłać
- **Wynik:** 2 maile z 1 skrzynki (limit przekroczony!)

### **Rozwiązanie - Atomowa rezerwacja:**
```typescript
// W transakcji PRZED zablokowaniem maila:
const incrementResult = await db.$executeRaw`
  UPDATE Mailbox 
  SET currentDailySent = currentDailySent + 1
  WHERE id = ${mailboxId}
  AND currentDailySent < dailyEmailLimit
`;

if (incrementResult === 0) {
  // Limit osiągnięty - nie blokuj maila
  return { email: null, locked: false };
}
```

### **Dlaczego to działa:**
1. ✅ **Atomic operation** - tylko jeden proces może zarezerwować slot
2. ✅ **Conditional update** - `WHERE currentDailySent < dailyEmailLimit` zapobiega przekroczeniu
3. ✅ **Rows affected** - jeśli 0, znaczy że limit już osiągnięty
4. ✅ **Przed zablokowaniem maila** - eliminuje race condition

**Wniosek:** ✅ **TAK, to naprawi problem**

---

## ⚠️ POTENCJALNE SKUTKI UBOCZNE

### **1. Skrzynki w warmup**

**Problem:**
- Warmup używa `warmupTodaySent` (dla warmup maili)
- Kampanie używają `currentDailySent` (dla kampanii maili)
- Skrzynka w warmup może wysyłać i warmup i kampanie

**Analiza:**
```typescript
// Warmup zwiększa:
warmupTodaySent: { increment: 1 }  // Tylko dla warmup
currentDailySent: { increment: 1 }  // Dla wszystkich

// Kampanie zwiększają:
currentDailySent: { increment: 1 }  // Tylko currentDailySent
```

**Rezerwacja dla kampanii:**
```typescript
// Musimy sprawdzić właściwy limit w zależności od statusu warmup
if (mailbox.warmupStatus === 'warming') {
  // Limit kampanii = min(dailyEmailLimit, warmupDailyLimit, performanceLimits.campaign)
  // Licznik = currentDailySent - warmupTodaySent
  effectiveLimit = Math.min(...);
  currentSent = currentDailySent - warmupTodaySent;
} else {
  effectiveLimit = dailyEmailLimit;
  currentSent = currentDailySent;
}

// Rezerwacja:
UPDATE Mailbox 
SET currentDailySent = currentDailySent + 1
WHERE id = ${mailboxId}
AND currentDailySent < ${effectiveLimit}  // ❌ PROBLEM: to nie uwzględnia warmupTodaySent!
```

**Problem:** ❌ **Rezerwacja nie uwzględnia warmupTodaySent!**

**Rozwiązanie:**
```typescript
// Dla skrzynek w warmup musimy sprawdzić:
// currentDailySent - warmupTodaySent < effectiveLimit

// Ale SQLite nie wspiera takiego warunku w UPDATE
// Musimy użyć bardziej złożonego warunku:

// Opcja 1: Sprawdź w JavaScript przed rezerwacją
const mailbox = await db.mailbox.findUnique({
  where: { id: mailboxId },
  select: { warmupStatus, currentDailySent, warmupTodaySent, ... }
});

if (mailbox.warmupStatus === 'warming') {
  const campaignSent = mailbox.currentDailySent - mailbox.warmupTodaySent;
  if (campaignSent >= effectiveLimit) {
    return { email: null, locked: false };
  }
}

// Opcja 2: Użyj bardziej złożonego warunku SQL
// (ale to może być skomplikowane)

// Opcja 3: Rezerwuj tylko dla skrzynek NIE w warmup
// (ale to ogranicza funkcjonalność)
```

**Wniosek:** ⚠️ **Trzeba uwzględnić warmup w rezerwacji**

---

### **2. Błąd wysyłki po rezerwacji**

**Scenariusz:**
1. Rezerwacja slotu się udała (currentDailySent++)
2. Wysyłka maila się nie powiedzie (błąd SMTP)
3. Co się dzieje z licznikiem?

**Analiza warmup:**
```typescript
// Warmup NIE cofa rezerwacji przy błędzie!
// Jeśli wysyłka się nie powiedzie, licznik pozostaje zwiększony
// To jest zamierzone - slot został zarezerwowany, nawet jeśli wysyłka się nie powiodła
```

**Czy to jest problem?**
- ✅ **NIE** - slot został zarezerwowany, nawet jeśli wysyłka się nie powiodła
- ✅ **To jest OK** - zapobiega wielokrotnym próbom wysyłki tego samego maila
- ✅ **Mail pozostaje w kolejce** - może być ponowiony później

**Wniosek:** ✅ **OK - nie cofamy rezerwacji przy błędzie**

---

### **3. Konflikt z innymi systemami**

**Systemy które używają mailbox:**
1. **Warmup** - używa atomowej rezerwacji (warmupTodaySent)
2. **V2 Campaign** - chce użyć atomowej rezerwacji (currentDailySent)
3. **V1 Campaign** (scheduledSender) - używa `incrementMailboxCounter` (PO wysłaniu)
4. **Inbox Processor** - używa `incrementMailboxCounter` (PO wysłaniu)

**Analiza:**
- ✅ **Warmup** - używa `warmupTodaySent`, nie konfliktuje z `currentDailySent`
- ⚠️ **V1 Campaign** - używa `incrementMailboxCounter` PO wysłaniu (nie atomowo)
- ⚠️ **Inbox Processor** - używa `incrementMailboxCounter` PO wysłaniu (nie atomowo)

**Problem:** 
- V2 użyje atomowej rezerwacji (PRZED)
- V1 użyje `incrementMailboxCounter` (PO)
- **Może być race condition między V1 a V2!**

**Rozwiązanie:**
- ✅ **V2 używa atomowej rezerwacji** - zabezpiecza przed race condition
- ⚠️ **V1 nadal używa starego systemu** - ale to jest OK bo:
  - V1 będzie usunięty po migracji
  - V1 i V2 nie powinny działać równolegle (ale mogą jeśli użytkownik ma stare kampanie)

**Wniosek:** ⚠️ **Możliwy konflikt V1/V2, ale to jest OK podczas migracji**

---

### **4. Złożoność limitu dla warmup**

**Problem:**
- Skrzynka w warmup ma złożoną logikę limitów:
  - `dailyEmailLimit` (globalny)
  - `warmupDailyLimit` (warmup)
  - `performanceLimits.campaign` (z ustawień)
  - `currentDailySent` (wszystkie maile)
  - `warmupTodaySent` (tylko warmup)

**Obliczanie limitu kampanii:**
```typescript
effectiveLimit = Math.min(
  mailbox.dailyEmailLimit,
  mailbox.warmupDailyLimit,
  performanceLimits.campaign
);

currentSent = Math.max(0, mailbox.currentDailySent - mailbox.warmupTodaySent);
remaining = effectiveLimit - currentSent;
```

**Rezerwacja:**
```typescript
// Musimy sprawdzić czy:
// (currentDailySent - warmupTodaySent) < effectiveLimit

// Ale SQLite nie wspiera takiego warunku w UPDATE
// Musimy sprawdzić w JavaScript przed rezerwacją
```

**Wniosek:** ⚠️ **Trzeba sprawdzić warmup status przed rezerwacją**

---

## 🔧 PROPOZYCJA IMPLEMENTACJI

### **Krok 1: Sprawdź warmup status PRZED rezerwacją**

```typescript
// W transakcji przed zablokowaniem maila:
const mailboxForReservation = await tx.mailbox.findUnique({
  where: { id: mailboxId },
  select: {
    id: true,
    warmupStatus: true,
    currentDailySent: true,
    warmupTodaySent: true,
    dailyEmailLimit: true,
    warmupDailyLimit: true
  }
});

if (!mailboxForReservation) {
  return { email: null, locked: false };
}

// Oblicz właściwy limit i currentSent
let effectiveLimit: number;
let currentSent: number;

if (mailboxForReservation.warmupStatus === 'warming') {
  const week = getWeekFromDay(mailbox.warmupDay || 0);
  const performanceLimits = await getPerformanceLimits(week);
  
  effectiveLimit = Math.min(
    mailboxForReservation.dailyEmailLimit,
    mailboxForReservation.warmupDailyLimit,
    performanceLimits.campaign
  );
  
  currentSent = Math.max(0, 
    mailboxForReservation.currentDailySent - mailboxForReservation.warmupTodaySent
  );
} else {
  effectiveLimit = mailboxForReservation.dailyEmailLimit;
  currentSent = mailboxForReservation.currentDailySent;
}

// Sprawdź czy jest miejsce
if (currentSent >= effectiveLimit) {
  return { email: null, locked: false };
}

// Krok 2: Atomowa rezerwacja
const incrementResult = await tx.$executeRaw`
  UPDATE Mailbox 
  SET currentDailySent = currentDailySent + 1
  WHERE id = ${mailboxId}
  AND currentDailySent = ${mailboxForReservation.currentDailySent}
`;

if (incrementResult === 0) {
  // Ktoś inny już zarezerwował - to OK
  return { email: null, locked: false };
}
```

**Problem:** ❌ **Optimistic locking (currentDailySent = X) może nie działać jeśli wiele procesów**

**Lepsze rozwiązanie:**
```typescript
// Użyj prostego warunku (bez warmup check w SQL):
const incrementResult = await tx.$executeRaw`
  UPDATE Mailbox 
  SET currentDailySent = currentDailySent + 1
  WHERE id = ${mailboxId}
  AND currentDailySent < ${effectiveLimit}
`;

// Ale to nie uwzględnia warmupTodaySent dla skrzynek w warmup!
```

**Najlepsze rozwiązanie:**
```typescript
// Dla skrzynek NIE w warmup - proste:
if (mailboxForReservation.warmupStatus !== 'warming') {
  const incrementResult = await tx.$executeRaw`
    UPDATE Mailbox 
    SET currentDailySent = currentDailySent + 1
    WHERE id = ${mailboxId}
    AND currentDailySent < ${effectiveLimit}
  `;
  
  if (incrementResult === 0) {
    return { email: null, locked: false };
  }
} else {
  // Dla skrzynek w warmup - sprawdź w JavaScript
  // (nie można w SQLite łatwo)
  // Ale możemy użyć optimistic locking:
  const campaignSent = mailboxForReservation.currentDailySent - mailboxForReservation.warmupTodaySent;
  
  if (campaignSent >= effectiveLimit) {
    return { email: null, locked: false };
  }
  
  // Rezerwuj atomowo (ale bez sprawdzania warmup w SQL)
  const incrementResult = await tx.$executeRaw`
    UPDATE Mailbox 
    SET currentDailySent = currentDailySent + 1
    WHERE id = ${mailboxId}
    AND currentDailySent = ${mailboxForReservation.currentDailySent}
  `;
  
  if (incrementResult === 0) {
    // Ktoś inny już zarezerwował - sprawdź ponownie
    return { email: null, locked: false };
  }
}
```

---

## ✅ PODSUMOWANIE WERYFIKACJI

### **Czy naprawi problem?**
✅ **TAK** - atomowa rezerwacja eliminuje race condition

### **Czy wpłynie negatywnie?**

| Aspekt | Status | Uwagi |
|--------|--------|-------|
| Warmup | ⚠️ UWAGA | Trzeba uwzględnić warmupTodaySent w rezerwacji |
| Błąd wysyłki | ✅ OK | Nie cofamy rezerwacji (zgodnie z warmup) |
| V1 konflikt | ⚠️ MOŻLIWY | Ale OK podczas migracji |
| Złożoność | ⚠️ ŚREDNIA | Trzeba sprawdzić warmup status przed rezerwacją |

### **Rekomendacja:**

✅ **IMPLEMENTUJ** atomową rezerwację, ale:
1. ✅ Sprawdź warmup status PRZED rezerwacją
2. ✅ Dla skrzynek w warmup - sprawdź w JavaScript (campaignSent < effectiveLimit)
3. ✅ Dla skrzynek NIE w warmup - użyj prostego warunku SQL
4. ✅ Nie cofaj rezerwacji przy błędzie (zgodnie z warmup)
5. ⚠️ Uwaga na konflikt V1/V2 (ale to tymczasowe podczas migracji)

---

## 🎯 FINALNA WERYFIKACJA

**Czy to naprawi problem?** ✅ **TAK**

**Czy wpłynie negatywnie?** ⚠️ **MINIMALNIE** - trzeba uwzględnić warmup, ale to jest do zrobienia

**Czy warto implementować?** ✅ **TAK** - eliminuje race condition, a komplikacja jest minimalna

