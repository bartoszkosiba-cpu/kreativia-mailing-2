# ANALIZA BŁĘDÓW W OPACJI 4

## 🔴 KRYTYCZNE BŁĘDY

### BŁĄD 1: Korekta czasu dla maili w przyszłości

**Problem:**
```typescript
// W processScheduledEmailsV2():
const timeUntilScheduled = scheduledAt.getTime() - now.getTime();
const correctedTime = Math.max(0, timeUntilScheduled - 30000); // ❌ ODEJMUJE 30s
```

**Scenariusz:**
- Mail zaplanowany: `scheduledAt = 12:01:30` (90s w przyszłości)
- Cron uruchamia się: `now = 12:00:00`
- `timeUntilScheduled = 90000ms`
- `correctedTime = 90000 - 30000 = 60000ms`
- Mail zostanie wysłany: `12:01:00` (30s za wcześnie!)
- Powinien być wysłany: `12:01:30`

**Ale czekaj:** `lockEmailForSending()` sprawdza `scheduledAt <= now`, więc tylko gotowe maile będą lockowane. Maile w przyszłości nie będą lockowane.

**Wniosek:** To nie jest problem, bo tylko gotowe maile są lockowane.

---

### BŁĄD 2: getNextAvailableMailbox wywoływane W transakcji

**Problem:**
```typescript
// W lockEmailForSending() W TRANSAKCJI:
const availableMailbox = await getNextAvailableMailbox(
  campaign.virtualSalespersonId || 0,
  campaignId
);
```

**Co robi `getNextAvailableMailbox()`:**
1. Pobiera wszystkie skrzynki z bazy
2. Resetuje liczniki (jeśli potrzeba) - `resetMailboxCounter()` - to zapytanie do DB
3. Sprawdza SendLog dla innych kampanii - kolejne zapytanie do DB
4. Wybiera skrzynkę (round-robin)

**Problemy:**
- ❌ **Wolne operacje w transakcji** - resetowanie liczników i sprawdzanie SendLog może być wolne
- ❌ **Może blokować transakcję** - długie zapytania w transakcji
- ❌ **Race condition** - między wywołaniem `getNextAvailableMailbox()` a rezerwacją slotu, skrzynka może się zmienić

**Rozwiązanie:** Przenieść `getNextAvailableMailbox()` POZA transakcję, ale wtedy trzeba sprawdzić czy skrzynka nadal jest dostępna W transakcji.

---

### BŁĄD 3: Rezerwacja slotu - double check

**Problem:**
```typescript
// 1. getNextAvailableMailbox() zwraca skrzynkę (POZA transakcją)
const availableMailbox = await getNextAvailableMailbox(...);

// 2. W transakcji pobieramy skrzynkę z DB
const mailboxForReservation = await tx.mailbox.findUnique({
  where: { id: availableMailbox.id },
  ...
});

// 3. Sprawdzamy limit
if (currentSent >= effectiveLimit) {
  return null;
}

// 4. Rezerwujemy slot
incrementResult = await tx.$executeRaw`UPDATE Mailbox ...`;
```

**Problem:** Między krokiem 1 a 4, skrzynka może się zmienić (ktoś inny może zarezerwować slot).

**Rozwiązanie:** ✅ To jest OK - rezerwacja w SQL jest atomic (`AND currentDailySent < ${effectiveLimit}`), więc jeśli limit został osiągnięty, `incrementResult = 0` i zwracamy `null`.

---

### BŁĄD 4: Korekta czasu - czy to ma sens?

**Analiza:**
- Mail gotowy: `scheduledAt <= now` → `timeUntilScheduled <= 0` → `correctedTime = 0` → ✅ wysyła natychmiast
- Mail w przyszłości: Nie będzie lockowany (bo `scheduledAt <= now` w query)

**Ale czekaj:** Co jeśli mail jest zaplanowany na `now + 1s`? To jest edge case:
- `scheduledAt = 12:00:01`
- `now = 12:00:00`
- Query: `scheduledAt: { lte: now }` → `12:00:01 <= 12:00:00` → `false` → mail nie zostanie zablokowany
- Cron za 30s sprawdzi ponownie → mail będzie gotowy → zostanie zablokowany

**Wniosek:** ✅ To jest OK - maile w przyszłości nie są lockowane, tylko gotowe.

---

### BŁĄD 5: getNextAvailableMailbox() resetuje liczniki w transakcji

**Problem:**
```typescript
// W getNextAvailableMailbox():
for (const mailbox of mailboxes) {
  if (needsReset) {
    await resetMailboxCounter(mailbox.id, mailbox.warmupStatus); // ❌ Zapytanie do DB
  }
}
```

**To jest wywoływane W transakcji w `lockEmailForSending()`!**

**Problemy:**
- ❌ **Długie operacje w transakcji** - resetowanie liczników dla wielu skrzynek
- ❌ **Może blokować transakcję** - jeśli resetowanie jest wolne
- ❌ **Zwiększa ryzyko timeout** - transakcja może być zbyt długa

**Rozwiązanie:** Przenieść `getNextAvailableMailbox()` POZA transakcję, ale wtedy trzeba zwalidować skrzynkę W transakcji.

---

### BŁĄD 6: setTimeout używa zmiennych z closure

**Problem:**
```typescript
setTimeout(() => {
  sendEmailAfterTimeout(
    lockResult.email.id,
    campaign.id,
    lockResult.reservedMailbox
  );
}, correctedTime);
```

**`lockResult.reservedMailbox`** to obiekt z `getNextAvailableMailbox()`, który może być nieaktualny po `setTimeout`.

**Ale:** W `sendEmailAfterTimeout()` sprawdzamy czy skrzynka istnieje i mamy fallback, więc to jest OK.

---

## 🟡 MŚNIEJSZE PROBLEMY

### Problem 7: Brak sprawdzenia czy mail został już wysłany

**W `lockEmailForSending()`:**
- Sprawdzamy `status: 'pending'` i `scheduledAt <= now`
- Ale NIE sprawdzamy czy mail został już wysłany (duplikat)

**Rozwiązanie:** ✅ To jest OK - sprawdzamy duplikat w `sendEmailAfterTimeout()`.

---

### Problem 8: Recovery używa innej logiki

**W `recoverStuckEmailsAfterRestart()`:**
```typescript
const correctedTime = Math.max(0, timeUntilScheduled - 30000);
```

**To jest takie samo jak w głównej logice, więc OK.**

---

## ✅ CO JEST OK

1. ✅ Atomic lock maila w transakcji
2. ✅ Atomic rezerwacja slotu skrzynki
3. ✅ Sprawdzenie duplikatów w `sendEmailAfterTimeout()`
4. ✅ Sprawdzenie statusu kampanii przed wysyłką
5. ✅ Fallback dla brakującej skrzynki
6. ✅ Obsługa ujemnych czasów (`Math.max(0, ...)`)

---

## 🔧 DO NAPRAWY

### Poprawka 1: Przenieść `getNextAvailableMailbox()` POZA transakcję

**Przed:**
```typescript
const result = await db.$transaction(async (tx) => {
  // ...
  const availableMailbox = await getNextAvailableMailbox(...); // ❌ W transakcji
  // ...
});
```

**Po:**
```typescript
// Przed transakcją
const availableMailbox = await getNextAvailableMailbox(...);

if (!availableMailbox) {
  return null;
}

// W transakcji - sprawdź czy skrzynka nadal jest dostępna
const result = await db.$transaction(async (tx) => {
  // Pobierz skrzynkę z DB i sprawdź limit
  const mailboxForReservation = await tx.mailbox.findUnique({
    where: { id: availableMailbox.id },
    ...
  });
  
  // Sprawdź limit i zarezerwuj atomowo
  // ...
});
```

---

### Poprawka 2: Uprościć korektę czasu

**Obecna logika:**
```typescript
const correctedTime = Math.max(0, timeUntilScheduled - 30000);
```

**Problem:** Odejmowanie 30s nie ma sensu dla gotowych maili (timeUntilScheduled <= 0).

**Rozwiązanie:** 
```typescript
// Jeśli mail jest gotowy (scheduledAt <= now), wysyła natychmiast
// Jeśli mail jest w przyszłości (nie powinno się zdarzyć, ale na wszelki wypadek), użyj scheduledAt - now
const correctedTime = timeUntilScheduled <= 0 ? 0 : Math.max(0, timeUntilScheduled);
```

**ALE:** Jeśli `scheduledAt <= now` jest sprawdzane w query, to `timeUntilScheduled` zawsze będzie <= 0, więc `correctedTime` zawsze będzie 0. Można uprościć:
```typescript
const correctedTime = 0; // Mail jest gotowy, wysyła natychmiast
```

**Ale czekaj:** Korekta 30s była po to, żeby kompensować opóźnienie crona. Jeśli cron uruchamia się co 30s, a mail jest gotowy, to może być opóźnienie do 30s. Ale jeśli mail jest gotowy, to i tak powinien wyjść natychmiast.

**Wniosek:** Korekta 30s nie ma sensu dla gotowych maili. Można uprościć do `correctedTime = 0`.

---

## 🎯 WNIOSEK

**Główny problem:** `getNextAvailableMailbox()` wywoływane W transakcji - może być wolne i blokować transakcję.

**Rozwiązanie:** Przenieść `getNextAvailableMailbox()` POZA transakcję, a w transakcji tylko walidować i rezerwować slot.

