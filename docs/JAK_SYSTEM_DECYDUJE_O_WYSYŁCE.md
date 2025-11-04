# 🔍 JAK SYSTEM DECYDUJE O WYSYŁCE MAILI

## 📊 PYTANIE
**Z jakich danych korzysta system, aby wiedzieć czy w danej kampanii może jeszcze wysłać maile i z jakich skrzynek?**

## ✅ ODPOWIEDŹ

System **NIE używa kolumny "Pozostało"** z tabeli UI. Używa **obliczeń na bieżąco** z rzeczywistych danych z bazy danych.

---

## 🎯 SPRAWDZANIE CZY KAMPANIA MOŻE WYSYŁAĆ

### 1. **Limit kampanii (`campaign.maxEmailsPerDay`)**

**Gdzie:** `campaignEmailSenderV2.ts` (linie 291-323)

**Jak działa:**
```typescript
// Sprawdź ile maili już wysłano DZISIAJ dla tej kampanii
const sentToday = await tx.sendLog.count({
  where: {
    campaignId,
    status: 'sent',
    createdAt: { gte: todayStart } // Tylko dzisiaj
  }
});

// Jeśli osiągnięto limit - przekładaj na jutro
if (sentToday >= campaign.maxEmailsPerDay) {
  // Przekładaj email na jutro
  return { email: null, locked: false };
}
```

**Źródło danych:**
- ✅ `SendLog` WHERE `campaignId = X` AND `status = 'sent'` AND `createdAt >= dzisiaj`
- ❌ NIE używa kolumny "Pozostało" z UI

---

## 📬 WYBIERANIE SKRZYNEK

### 2. **Dostępność skrzynek (`getNextAvailableMailbox`)**

**Gdzie:** `mailboxManager.ts` (linie 81-205)

**Jak działa:**

#### KROK 1: Oblicz `effectiveLimit` i `currentSent`

```typescript
// PRZYPADEK 1: Nowa skrzynka (nie w warmup)
if (mailbox.warmupStatus === 'inactive' || mailbox.warmupStatus === 'ready_to_warmup') {
  effectiveLimit = 10; // NEW_MAILBOX_LIMIT
  currentSent = mailbox.currentDailySent; // Z bazy
}

// PRZYPADEK 2: Gotowa skrzynka (nie w warmup)
else {
  effectiveLimit = mailbox.dailyEmailLimit; // Z bazy
  currentSent = mailbox.currentDailySent; // Z bazy
}

// PRZYPADEK 3: Skrzynka w warmup
if (mailbox.warmupStatus === 'warming') {
  const week = getWeekFromDay(mailbox.warmupDay);
  const performanceLimits = await getPerformanceLimits(week);
  
  effectiveLimit = Math.min(
    mailbox.dailyEmailLimit,
    mailbox.warmupDailyLimit,
    performanceLimits.campaign
  );
  
  // Licznik kampanii = wszystkie maile dzisiaj MINUS maile warmup
  currentSent = Math.max(0, mailbox.currentDailySent - mailbox.warmupTodaySent);
}
```

#### KROK 2: Sprawdź czy jest miejsce

```typescript
const remaining = effectiveLimit - currentSent;

if (remaining > 0) {
  // ✅ SKRZYNKA DOSTĘPNA
  return mailbox;
} else {
  // ❌ SKRZYNKA WYCZERPANA - sprawdź następną
  continue;
}
```

**Źródło danych:**
- ✅ `mailbox.currentDailySent` - z bazy danych (aktualizowany atomowo przy każdej wysyłce)
- ✅ `mailbox.dailyEmailLimit` - z bazy danych
- ✅ `mailbox.warmupStatus`, `mailbox.warmupDay`, `mailbox.warmupDailyLimit` - z bazy danych
- ✅ `performanceLimits.campaign` - z ustawień wydajności
- ❌ NIE używa kolumny "Pozostało" z UI

---

## 🔒 ATOMOWA REZERWACJA SLOTU

### 3. **Rezerwacja slotu przed wysłaniem**

**Gdzie:** `campaignEmailSenderV2.ts` (linie 325-378)

**Jak działa:**

```typescript
// Atomowa rezerwacja w transakcji SQL
incrementResult = await tx.$executeRaw`
  UPDATE Mailbox 
  SET currentDailySent = currentDailySent + 1
  WHERE id = ${mailboxId}
  AND currentDailySent < ${effectiveLimit}
`;

// Jeśli 0 rows affected = limit osiągnięty
if (incrementResult === 0) {
  return { email: null, locked: false }; // ❌ Brak miejsca
}
```

**Źródło danych:**
- ✅ Atomowa operacja SQL bezpośrednio na bazie
- ✅ Sprawdza `currentDailySent < effectiveLimit` przed inkrementacją
- ❌ NIE używa kolumny "Pozostało" z UI

---

## 📋 PODSUMOWANIE

### **System używa:**

| Sprawdzenie | Źródło danych | Gdzie w kodzie |
|------------|--------------|----------------|
| **Limit kampanii** | `SendLog.count()` dla dzisiaj | `campaignEmailSenderV2.ts:296-302` |
| **Dostępność skrzynek** | `mailbox.currentDailySent` vs `effectiveLimit` | `mailboxManager.ts:142-201` |
| **Rezerwacja slotu** | Atomowa operacja SQL | `campaignEmailSenderV2.ts:332-337` |

### **System NIE używa:**

- ❌ Kolumna "Pozostało" z tabeli UI
- ❌ Wartości obliczone wcześniej (cache)
- ❌ Wartości z `remainingToday` z `getMailboxStats`

### **Dlaczego?**

1. **Rzeczywiste dane:** System zawsze sprawdza aktualny stan z bazy danych
2. **Atomowość:** Rezerwacja slotu odbywa się atomowo w SQL (zapobiega race conditions)
3. **Wieloprocesowość:** System może działać na wielu procesach - każdy sprawdza stan na bieżąco

---

## 🎯 KOLUMNA "POZOSTAŁO" W UI

**Kolumna "Pozostało" w tabeli UI** jest tylko **informacyjna** - pokazuje użytkownikowi stan skrzynek, ale system jej nie używa do podejmowania decyzji.

**Obliczenie w UI:**
```typescript
remaining = effectiveLimit - currentSent
```

**To jest tylko wizualizacja** - system zawsze sprawdza rzeczywisty stan z bazy danych przed wysłaniem.

---

## ✅ WNIOSEK

System decyduje o wysyłce na podstawie:
1. **Rzeczywistych danych z bazy** (`currentDailySent`, `effectiveLimit`)
2. **Atomowych operacji SQL** (rezerwacja slotu)
3. **Obliczeń na bieżąco** (nie używa cache ani wartości z UI)

**Kolumna "Pozostało" w UI = tylko informacja dla użytkownika, nie używana przez system!**

