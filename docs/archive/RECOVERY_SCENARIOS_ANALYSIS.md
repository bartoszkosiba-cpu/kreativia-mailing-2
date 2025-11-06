# 📊 ANALIZA SCENARIUSZY ODBUDOWY SYSTEMU V2

## 🎯 SCENARIUSZ 1: Brak internetu przez 1 godzinę

### **Początkowa sytuacja:**
- Kampania działa (status: `IN_PROGRESS`)
- System wysyła maile normalnie co ~90s
- Ostatni mail wysłany: **12:00:00**
- W kolejce: Mail 21 (scheduledAt: 12:01:30), Mail 22 (12:03:00), ...

### **KROK 1: System traci internet (12:00:05)**

**Co się dzieje:**

1. **Cron uruchamia się (12:00:30):**
   ```typescript
   processScheduledEmailsV2() → sendNextEmailFromQueue()
   ```
   - Pobiera Mail 21 (scheduledAt: 12:01:30)
   - Sprawdza: `12:01:30 > now (12:00:30)` → ❌ **Nie jest jeszcze czas**
   - Zwraca: `{ email: null, locked: false }`

2. **Cron uruchamia się ponownie (12:01:00):**
   - Pobiera Mail 21 (scheduledAt: 12:01:30)
   - Sprawdza: `12:01:30 > now (12:01:00)` → ❌ **Nie jest jeszcze czas**
   - Zwraca: `{ email: null, locked: false }`

3. **Cron uruchamia się (12:01:30):**
   - Pobiera Mail 21 (scheduledAt: 12:01:30)
   - Sprawdza: `12:01:30 <= now (12:01:30)` → ✅ **Jest czas**
   - Rezerwuje slot skrzynki atomowo ✅
   - Blokuje mail (status: 'sending') ✅
   - **Próbuje wysłać mail** → ❌ **BŁĄD: Brak internetu**
   - Mail pozostaje w statusie 'sending'
   - **Rezerwacja slotu pozostaje** (currentDailySent++)

4. **Cron uruchamia się (12:02:00):**
   - `unlockStuckEmails()` sprawdza maile w statusie 'sending' starsze niż 10 min
   - Mail 21 jest tylko 30s stary → **NIE odblokowuje**
   - Próbuje wysłać Mail 21 ponownie → ❌ **BŁĄD: Brak internetu**

5. **Cron uruchamia się (12:02:30, 12:03:00, ...):**
   - Mail 21 jest w statusie 'sending' → **Pomijany** (nie jest 'pending')
   - Mail 22, 23, ... są w statusie 'pending' → **Próbują wysłać** → ❌ **BŁĄD: Brak internetu**

### **KROK 2: Internet wraca (13:00:00 = 1h później)**

**Co się dzieje:**

1. **Cron uruchamia się (13:00:00):**
   ```typescript
   unlockStuckEmails() // Wywoływane na początku processScheduledEmailsV2
   ```
   - Sprawdza maile w statusie 'sending' starsze niż 10 min
   - Mail 21: `updatedAt = 12:01:30`, now = 13:00:00
   - Różnica: **58 minut** (> 10 min) → ✅ **ODBLOKOWUJE**
   - Mail 21: status 'sending' → 'pending'

2. **Pobiera Mail 21:**
   ```typescript
   getNextEmailForCampaign()
   ```
   - Mail 21: scheduledAt: 12:01:30, now: 13:00:00
   - Sprawdza: `scheduledAt >= maxTolerance`
   - maxTolerance = now - 5 min = 12:55:00
   - `12:01:30 < 12:55:00` → ❌ **Mail jest starszy niż 5 min!**
   - **Przekłada na jutro o startHour (9:00)**

3. **Pobiera Mail 22:**
   - Mail 22: scheduledAt: 12:03:00, now: 13:00:00
   - `12:03:00 < 12:55:00` → ❌ **Przekłada na jutro**

4. **Pobiera Mail 23:**
   - Mail 23: scheduledAt: 12:04:30, now: 13:00:00
   - `12:04:30 < 12:55:00` → ❌ **Przekłada na jutro**

5. **Wszystkie maile z przerwy są przekładane na jutro!**

### **❌ PROBLEM: Wszystkie maile są przekładane na jutro**

**Dlaczego:**
- `maxTolerance = now - 5 min` = 12:55:00
- Wszystkie maile z 12:00-12:55 są starsze niż 5 min
- Są przekładane na jutro o 9:00

**Czy to jest problem?**
- ⚠️ **TAK** - maile powinny być wysłane natychmiast po powrocie internetu
- ❌ **NIE** - to jest zamierzone (Problem 1 fix) - maile starsze niż 5 min są przekładane

**Alternatywa:**
- Możemy zwiększyć `maxTolerance` do np. 1h dla catch-up po restarcie
- Ale to może powodować problemy z delayBetweenEmails

---

## 🎯 SCENARIUSZ 2: Pauza + ponowienie po 2h

### **Początkowa sytuacja:**
- Kampania działa (status: `IN_PROGRESS`)
- System wysyła maile normalnie
- Ostatni mail wysłany: **12:00:00**
- W kolejce: Mail 21 (scheduledAt: 12:01:30), Mail 22 (12:03:00), ...

### **KROK 1: Użytkownik wciska pauzę (12:00:30)**

**Co się dzieje:**

1. **Status kampanii zmieniony na `PAUSED`**

2. **Cron uruchamia się (12:01:00):**
   ```typescript
   processScheduledEmailsV2() → sendNextEmailFromQueue()
   ```
   - Pobiera Mail 21 (scheduledAt: 12:01:30)
   - Sprawdza: `12:01:30 > now (12:01:00)` → ❌ **Nie jest jeszcze czas**
   - Zwraca: `{ email: null, locked: false }`

3. **Cron uruchamia się (12:01:30):**
   - Pobiera Mail 21 (scheduledAt: 12:01:30)
   - Sprawdza: `12:01:30 <= now (12:01:30)` → ✅ **Jest czas**
   - Rezerwuje slot skrzynki atomowo ✅
   - Blokuje mail (status: 'sending') ✅
   - **PO transakcji:**
     ```typescript
     currentCampaign = await db.campaign.findUnique({ status: true })
     ```
     - Status: `PAUSED` → ❌ **Kampania nie jest aktywna**
     - Mail oznaczony jako 'cancelled'
     - **Rezerwacja slotu pozostaje** (currentDailySent++)
     - Zwraca: `{ success: true, mailSent: false }`

4. **Cron uruchamia się (12:02:00, 12:02:30, ...):**
   - Mail 21 jest w statusie 'cancelled' → **Pomijany**
   - Mail 22, 23, ... są w statusie 'pending'
   - Próbuje wysłać → **Status PAUSED** → Mail oznaczony jako 'cancelled'

### **KROK 2: Użytkownik ponawia kampanię (14:00:00 = 2h później)**

**Co się dzieje:**

1. **Status kampanii zmieniony na `IN_PROGRESS`**

2. **Cron uruchamia się (14:00:00):**
   ```typescript
   unlockStuckEmails()
   ```
   - Sprawdza maile w statusie 'sending' starsze niż 10 min
   - Mail 21: `updatedAt = 12:01:30`, now = 14:00:00
   - Różnica: **118 minut** (> 10 min) → ✅ **ODBLOKOWUJE**
   - Mail 21: status 'sending' → 'pending'
   - **ALE Mail 21 jest już 'cancelled'!** → Nie odblokowuje

3. **Pobiera Mail 22:**
   - Mail 22: scheduledAt: 12:03:00, now: 14:00:00
   - Sprawdza: `scheduledAt >= maxTolerance`
   - maxTolerance = now - 5 min = 13:55:00
   - `12:03:00 < 13:55:00` → ❌ **Mail jest starszy niż 5 min!**
   - **Przekłada na jutro o startHour (9:00)**

4. **Wszystkie maile są przekładane na jutro!**

### **❌ PROBLEM: Maile są przekładane na jutro**

**Dlaczego:**
- Maile są starsze niż 5 min (maxTolerance)
- Są przekładane na jutro

**Czy to jest problem?**
- ⚠️ **TAK** - maile powinny być wysłane natychmiast po wznowieniu
- ❌ **NIE** - to jest zamierzone (Problem 1 fix)

---

## 🔍 ANALIZA PROBLEMÓW

### **Problem 1: maxTolerance = 5 min jest za krótkie dla recovery**

**Scenariusz:**
- System traci internet na 1h
- Wszystkie maile z przerwy są starsze niż 5 min
- Są przekładane na jutro zamiast wysłać natychmiast

**Rozwiązanie:**
- Zwiększyć `maxTolerance` do np. 2h dla catch-up po restarcie
- LUB: Dodać specjalną logikę dla recovery (po unlockStuckEmails)

### **Problem 2: Maile 'cancelled' podczas PAUSED**

**Scenariusz:**
- Mail jest zablokowany (status: 'sending')
- Status kampanii zmieniony na PAUSED
- Mail oznaczony jako 'cancelled'
- Po wznowieniu: Mail jest 'cancelled', nie 'sending'
- `unlockStuckEmails` nie odblokowuje 'cancelled'

**Rozwiązanie:**
- Po wznowieniu kampanii, przekonwertuj 'cancelled' na 'pending'
- LUB: Podczas PAUSED, nie oznaczaj jako 'cancelled', tylko 'pending'

### **Problem 3: Rezerwacja slotu pozostaje przy błędzie**

**Scenariusz:**
- Mail zablokowany, slot zarezerwowany
- Wysyłka się nie powiedzie (brak internetu)
- Mail pozostaje w 'sending', slot pozostaje zarezerwowany
- Po 10 min: Mail odblokowany, ale slot pozostaje zarezerwowany

**Rozwiązanie:**
- To jest OK - slot został zarezerwowany, nawet jeśli wysyłka się nie powiodła
- Zgodnie z warmup - nie cofamy rezerwacji

---

## ✅ PROPOZOWANE ROZWIĄZANIA

### **Rozwiązanie 1: Zwiększ maxTolerance dla recovery**

```typescript
// W getNextEmailForCampaign:
const maxToleranceMinutes = 5; // Dla normalnych maili
const recoveryToleranceMinutes = 120; // 2h dla recovery

// Sprawdź czy są zablokowane maile (po restarcie)
const stuckEmails = await db.campaignEmailQueue.findMany({
  where: {
    campaignId,
    status: 'sending',
    updatedAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) } // Starsze niż 10 min
  }
});

// Jeśli są zablokowane maile, użyj dłuższej tolerancji
const maxTolerance = stuckEmails.length > 0
  ? new Date(now.getTime() - recoveryToleranceMinutes * 60 * 1000)
  : new Date(now.getTime() - maxToleranceMinutes * 60 * 1000);
```

### **Rozwiązanie 2: Przekonwertuj 'cancelled' na 'pending' po wznowieniu**

```typescript
// W processScheduledEmailsV2, przed unlockStuckEmails:
// Jeśli kampania była PAUSED i teraz jest IN_PROGRESS, przekonwertuj 'cancelled' na 'pending'
const campaignsResumed = await db.campaign.findMany({
  where: {
    status: 'IN_PROGRESS',
    // Możemy dodać pole lastPausedAt do śledzenia
  }
});

for (const campaign of campaignsResumed) {
  await db.campaignEmailQueue.updateMany({
    where: {
      campaignId: campaign.id,
      status: 'cancelled',
      error: { contains: 'Kampania nie jest aktywna' }
    },
    data: {
      status: 'pending'
    }
  });
}
```

### **Rozwiązanie 3: Nie przekładaj maili na jutro jeśli są w catch-up**

```typescript
// W getNextEmailForCampaign:
// Jeśli mail jest catch-up (scheduledAt < now), sprawdź czy jest w oknie czasowym
if (nextEmail.scheduledAt < now) {
  // Mail jest catch-up
  // Sprawdź czy jest w oknie czasowym
  if (isWithinSendWindow(now, campaign)) {
    // Jesteśmy w oknie - NIE przekładaj na jutro, tylko wysyłaj natychmiast
    // (ale z uwzględnieniem delayBetweenEmails)
  } else {
    // Poza oknem - przekładaj na jutro
  }
}
```

---

## 📊 PODSUMOWANIE

### **Scenariusz 1: Brak internetu 1h**

| Krok | Status | Działanie |
|------|--------|-----------|
| 12:00:05 | Internet zrywa | Mail 21 zablokowany, wysyłka się nie powiedzie |
| 12:01:30-13:00:00 | Brak internetu | Maile próbują wysłać → błąd |
| 13:00:00 | Internet wraca | unlockStuckEmails odblokowuje Mail 21 |
| 13:00:00 | Recovery | Mail 21 jest starszy niż 5 min → **Przekładany na jutro** ❌ |

**Problem:** ❌ Wszystkie maile są przekładane na jutro zamiast wysłać natychmiast

---

### **Scenariusz 2: Pauza + ponowienie po 2h**

| Krok | Status | Działanie |
|------|--------|-----------|
| 12:00:30 | Pauza | Status: PAUSED |
| 12:01:30 | Mail 21 próbuje wysłać | Status PAUSED → Mail oznaczony jako 'cancelled' |
| 12:02:00-14:00:00 | Kampania PAUSED | Maile są 'cancelled' |
| 14:00:00 | Ponowienie | Status: IN_PROGRESS |
| 14:00:00 | Recovery | Maile są 'cancelled' → **NIE odblokowane** ❌ |
| 14:00:00 | Recovery | Maile są starsze niż 5 min → **Przekładane na jutro** ❌ |

**Problem:** ❌ Maile 'cancelled' nie są odblokowane, a te które są 'pending' są przekładane

---

## ✅ ZAIMPLEMENTOWANE ROZWIĄZANIA

### **✅ Poprawka 1: Dynamiczna tolerancja dla recovery** (Zaimplementowane)

**Problem:** 5 min tolerancja jest za krótka dla recovery po długiej przerwie

**Rozwiązanie:**
- Sprawdź czy są zablokowane maile w statusie 'sending' starsze niż 10 min
- Jeśli tak → użyj dłuższej tolerancji (120 min / 2h)
- Jeśli nie → użyj normalnej tolerancji (5 min)

**Lokalizacja:**
- `campaignEmailQueueV2.ts` - funkcja `getNextEmailForCampaign()`
- `campaignEmailSenderV2.ts` - funkcja `sendNextEmailFromQueue()` (w transakcji)

**Działanie:**
```typescript
// Sprawdź czy są zablokowane maile (po restarcie/recovery)
const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
const stuckEmailsCount = await db.campaignEmailQueue.count({
  where: {
    campaignId,
    status: 'sending',
    updatedAt: { lt: tenMinutesAgo }
  }
});

// Dynamiczna tolerancja
const maxToleranceMinutes = stuckEmailsCount > 0 ? 120 : 5;
```

---

### **✅ Poprawka 2: Nie oznaczaj jako 'cancelled' dla PAUSED** (Zaimplementowane)

**Problem:** Maile 'cancelled' podczas PAUSED nie są odblokowane po wznowieniu

**Rozwiązanie:**
- Podczas PAUSED: nie oznaczaj maili jako 'cancelled', tylko przywróć do 'pending'
- Dla innych statusów (CANCELLED, COMPLETED): oznacz jako 'cancelled'

**Lokalizacja:**
- `campaignEmailSenderV2.ts` - funkcja `sendNextEmailFromQueue()` (po transakcji)

**Działanie:**
```typescript
if (status === 'PAUSED') {
  // Przywróć do pending, nie 'cancelled'
  await db.campaignEmailQueue.update({
    where: { id: nextEmail.id },
    data: { 
      status: 'pending',
      error: null
    }
  });
} else {
  // Dla innych statusów oznacz jako 'cancelled'
  await db.campaignEmailQueue.update({
    where: { id: nextEmail.id },
    data: { 
      status: 'cancelled', 
      error: `Kampania nie jest aktywna (status: ${status})` 
    }
  });
}
```

---

### **⚠️ Problem 3: Rezerwacja slotu pozostaje przy błędzie** (Zamierzone zachowanie)

**Status:** ✅ To jest OK - zgodnie z warmup, nie cofamy rezerwacji slotu nawet jeśli wysyłka się nie powiodła.

---

## 🎯 AKTUALIZOWANE SCENARIUSZE

### **Scenariusz 1: Brak internetu 1h** (Z POPRAWKĄ)

| Krok | Status | Działanie |
|------|--------|-----------|
| 12:00:05 | Internet zrywa | Mail 21 zablokowany, wysyłka się nie powiedzie |
| 12:01:30-13:00:00 | Brak internetu | Maile próbują wysłać → błąd |
| 13:00:00 | Internet wraca | unlockStuckEmails odblokowuje Mail 21 |
| 13:00:00 | Recovery | ✅ **Wykryto stuck emails → maxTolerance = 120 min** |
| 13:00:00 | Recovery | ✅ **Mail 21 jest w tolerancji (12:01:30 >= 11:00:00)** → Wysyłany natychmiast |

**Wynik:** ✅ Maile są wysyłane natychmiast po powrocie internetu (z uwzględnieniem delayBetweenEmails)

---

### **Scenariusz 2: Pauza + ponowienie po 2h** (Z POPRAWKĄ)

| Krok | Status | Działanie |
|------|--------|-----------|
| 12:00:30 | Pauza | Status: PAUSED |
| 12:01:30 | Mail 21 próbuje wysłać | ✅ **Status PAUSED → Mail pozostaje 'pending'** (nie 'cancelled') |
| 12:02:00-14:00:00 | Kampania PAUSED | Maile pozostają 'pending' |
| 14:00:00 | Ponowienie | Status: IN_PROGRESS |
| 14:00:00 | Recovery | ✅ **Wykryto stuck emails → maxTolerance = 120 min** |
| 14:00:00 | Recovery | ✅ **Maile są 'pending' → Wysyłane natychmiast** |

**Wynik:** ✅ Maile są wysyłane natychmiast po wznowieniu (z uwzględnieniem delayBetweenEmails)

