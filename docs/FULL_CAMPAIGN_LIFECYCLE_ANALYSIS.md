# 📊 ANALIZA PEŁNEGO CYKLU ŻYCIA KAMPANII V2

## 🎯 SCENARIUSZ: Pełny cykl kampanii

**Parametry:**
- Nowa kampania (status: `SCHEDULED`)
- 10 nowych skrzynek (po 10 maili/dzień każda = 100 maili/dzień łącznie)
- 500 leadów do wysłania
- Harmonogram: 9:00-16:00 (poniedziałek-piątek)
- Odstęp: 90s ± 20%
- Start: 12:00 (poniedziałek)

---

## 📅 FAZA 1: Inicjalizacja kampanii (12:00)

### **KROK 1.1: Użytkownik uruchamia kampanię**

```
1. Status: SCHEDULED → IN_PROGRESS
2. Wywołanie: initializeQueueV2(campaignId, bufferSize=20)
```

**Co się dzieje:**

1. **Pobiera kampanię** z ustawieniami (delayBetweenEmails=90s, startHour=9, endHour=16)
2. **Pobiera ostatni wysłany mail** (brak - pierwsza kampania)
3. **Określa startowy czas:** `currentTime = now` (12:00)
4. **Pobiera leady** w statusie 'queued' lub 'planned' (500 leadów)
5. **Sprawdza dostępność skrzynek:**
   ```typescript
   getNextAvailableMailbox(virtualSalespersonId, campaignId)
   ```
   - Znajduje 10 skrzynek
   - Każda ma limit 10 maili/dzień
   - Wszystkie są dostępne (currentDailySent = 0)
   - ✅ **Dostępne skrzynki: TAK**

6. **Dodaje pierwsze 20 maili do kolejki:**
   - Mail 1: scheduledAt = 12:00:00
   - Mail 2: scheduledAt = 12:01:30 (90s + variation)
   - Mail 3: scheduledAt = 12:03:00
   - ...
   - Mail 20: scheduledAt = 12:28:30 (przybliżone)

**Wynik:**
- ✅ 20 maili w kolejce (status: 'pending')
- ✅ 480 leadów pozostaje w statusie 'queued' (nie w kolejce)
- ✅ Kampania status: `IN_PROGRESS`

---

## 📧 FAZA 2: Wysyłka maili (12:00 - 16:00)

### **KROK 2.1: Cron uruchamia się (12:00:30)**

```
processScheduledEmailsV2() → sendNextEmailFromQueue(campaignId)
```

**Co się dzieje:**

1. **Transakcja:**
   - Pobiera Mail 1 (scheduledAt: 12:00:00, status: 'pending')
   - Sprawdza: `12:00:00 <= now (12:00:30)` → ✅ **Jest czas**
   - Sprawdza dynamiczną tolerancję:
     - Brak stuck emails → `maxTolerance = 5 min`
     - `12:00:00 >= 11:55:30` → ✅ **W tolerancji**
   - Sprawdza okno czasowe: `12:00:30` w oknie 9:00-16:00 → ✅
   - Sprawdza catch-up delay: `12:00:00 < 12:00:30` (catch-up), ale brak lastSentLog → ✅
   - Rezerwuje slot skrzynki atomowo (Mailbox 1: currentDailySent = 0 → 1)
   - Blokuje mail (status: 'pending' → 'sending')

2. **Po transakcji:**
   - Sprawdza status kampanii: `IN_PROGRESS` → ✅
   - Wysyła mail przez SMTP
   - Aktualizuje: status → 'sent', sentAt = 12:00:30
   - Wywołuje: `scheduleNextEmailV2()` → dodaje Mail 21 do kolejki

**Wynik:**
- ✅ Mail 1 wysłany
- ✅ Mail 21 dodany do kolejki (scheduledAt: 12:02:00)
- ✅ Mailbox 1: currentDailySent = 1/10

---

### **KROK 2.2: Wysyłka kontynuuje się (12:00:30 - 15:30:00)**

**Co się dzieje:**

- Cron uruchamia się co 30s
- Każdy mail jest wysyłany z opóźnieniem ~90s
- Round-robin: Mailbox 1, 2, 3, ..., 10, 1, 2, ...
- Po każdym mailu: `scheduleNextEmailV2()` dodaje następny lead do kolejki

**Przykład (15:00):**
- Wysłano: ~200 maili (20 z bufora + 180 z scheduleNextEmailV2)
- W kolejce: ~20 maili (pending)
- Mailboxy: każda użyta ~20 razy (currentDailySent = 20/10) ❌ **PROBLEM!**

**❌ PROBLEM: Mailboxy przekraczają limit!**

**Dlaczego:**
- System rezerwuje slot atomowo przed wysłaniem
- Ale `getNextAvailableMailbox` może zwrócić skrzynkę która już ma currentDailySent = 10
- Atomowa rezerwacja powinna to zapobiec, ale sprawdzam...

**Sprawdzenie kodu:**
```typescript
// W sendNextEmailFromQueue:
if (currentSent >= effectiveLimit) {
  return { email: null, locked: false };
}

// Atomowa rezerwacja:
UPDATE Mailbox SET currentDailySent = currentDailySent + 1
WHERE id = X AND currentDailySent < effectiveLimit
```

**✅ TO JEST OK:** Atomowa rezerwacja zapobiega przekroczeniu limitu

**ALE:** Jeśli `getNextAvailableMailbox` zwróci skrzynkę z currentDailySent = 10, to:
- Sprawdzenie `currentSent >= effectiveLimit` → `10 >= 10` → ✅ **TRUE**
- Zwraca `{ email: null, locked: false }`
- Mail NIE jest wysyłany

**Problem:** Mail pozostaje w kolejce jako 'pending', ale nie jest wysyłany

**Rozwiązanie:** System powinien przekładać maile na jutro gdy brak dostępnych skrzynek

---

### **KROK 2.3: Wyczerpanie slotów (15:30:00)**

**Co się dzieje:**

1. **Mail 200 próbuje wysłać:**
   - `getNextAvailableMailbox()` sprawdza wszystkie skrzynki
   - Wszystkie mają `currentDailySent = 10` (limit osiągnięty)
   - Zwraca: `null`

2. **W sendNextEmailFromQueue:**
   ```typescript
   const availableMailbox = await getNextAvailableMailbox(...);
   if (!availableMailbox) {
     // Brak dostępnych skrzynek
     return { email: null, locked: false };
   }
   ```

3. **Mail pozostaje w kolejce (status: 'pending')**

4. **Cron uruchamia się ponownie (15:30:30):**
   - Próbuje wysłać Mail 200
   - `getNextAvailableMailbox()` → `null`
   - Mail pozostaje w kolejce

**❌ PROBLEM: Maile pozostają w kolejce, ale nie są przekładane na jutro**

**Dlaczego:**
- System nie przekłada maili na jutro gdy brak dostępnych skrzynek
- Maile pozostają w kolejce jako 'pending'
- Cron próbuje wysłać je w kółko, ale zawsze brak slotów

**Rozwiązanie:** System powinien przekładać maile na jutro gdy brak dostępnych skrzynek

---

## ⏸️ FAZA 3: Pauza kampanii (15:30:00)

### **KROK 3.1: Użytkownik wciska pauzę**

```
Status: IN_PROGRESS → PAUSED
```

**Co się dzieje:**

1. **Cron uruchamia się (15:30:30):**
   - Próbuje wysłać Mail 200
   - Transakcja: blokuje mail (status: 'sending')
   - Po transakcji: sprawdza status kampanii
   - Status: `PAUSED` → ✅ **Poprawka Recovery: Mail pozostaje 'pending'** (nie 'cancelled')

2. **Mail 200:**
   - Status: 'sending' → 'pending' (przywrócony)
   - Error: null (wyczyszczony)

3. **Pozostałe maile w kolejce:**
   - Status: 'pending' (nie zmieniony)
   - Są gotowe do wysłania po wznowieniu

**Wynik:**
- ✅ Wysłano: ~200 maili
- ✅ W kolejce: ~300 maili (status: 'pending')
- ✅ Kampania status: `PAUSED`

---

## ▶️ FAZA 4: Wznowienie kampanii (17:00:00)

### **KROK 4.1: Użytkownik wznawia kampanię**

```
Status: PAUSED → IN_PROGRESS
```

**Co się dzieje:**

1. **Cron uruchamia się (17:00:00):**
   - `unlockStuckEmails()` sprawdza maile 'sending' starsze niż 10 min
   - Brak stuck emails (wszystkie są 'pending')

2. **Próbuje wysłać Mail 200:**
   - Sprawdza dynamiczną tolerancję:
     - Brak stuck emails → `maxTolerance = 5 min`
     - Mail 200: scheduledAt = 15:30:00, now = 17:00:00
     - `15:30:00 < 16:55:00` → ❌ **Mail jest starszy niż 5 min!**
   - **Przekłada na jutro o 9:00**

3. **Próbuje wysłać Mail 201:**
   - scheduledAt = 15:31:30
   - `15:31:30 < 16:55:00` → ❌ **Przekłada na jutro**

4. **Wszystkie maile z przerwy są przekładane na jutro!**

**❌ PROBLEM: Maile są przekładane na jutro zamiast wysłać natychmiast**

**Dlaczego:**
- `maxTolerance = 5 min` jest za krótkie dla przerwy 1.5h
- System nie wykrywa recovery (brak stuck emails w statusie 'sending')

**Rozwiązanie:** System powinien wykrywać recovery również dla długich przerw (np. sprawdzać ostatni wysłany mail)

---

### **KROK 4.2: Wysyłka kontynuuje się (17:00:00 - 16:00:00 następnego dnia)**

**Co się dzieje:**

- System próbuje wysłać maile
- Wszystkie skrzynki mają `currentDailySent = 10` (limit osiągnięty)
- `getNextAvailableMailbox()` → `null`
- Maile pozostają w kolejce

**Wynik:**
- ✅ Wysłano: ~200 maili (dzisiaj)
- ✅ W kolejce: ~300 maili (status: 'pending', scheduledAt: jutro 9:00)
- ✅ Kampania status: `IN_PROGRESS`

---

## 🌅 FAZA 5: Nowy dzień - reset skrzynek (00:00:00)

### **KROK 5.1: Reset liczników**

**Co się dzieje:**

1. **Cron uruchamia się (00:00:00):**
   - `processScheduledEmailsV2()` wywołuje `getNextAvailableMailbox()`
   - `getNextAvailableMailbox()` sprawdza `lastResetDate`:
     ```typescript
     const needsReset = !mailbox.lastResetDate || !isTodayPL(mailbox.lastResetDate);
     if (needsReset) {
       await resetMailboxCounter(mailbox.id, mailbox.warmupStatus);
     }
     ```
   - Wszystkie skrzynki: `lastResetDate` ≠ dzisiaj → ✅ **Reset**
   - Każda skrzynka: `currentDailySent = 0`, `lastResetDate = dzisiaj`

2. **Próbuje wysłać Mail 200:**
   - scheduledAt = jutro 9:00:00
   - now = 00:00:00
   - `9:00:00 > 00:00:00` → ❌ **Nie jest jeszcze czas**
   - Zwraca: `{ email: null, locked: false }`

**Wynik:**
- ✅ Wszystkie skrzynki zresetowane (currentDailySent = 0)
- ✅ Maile w kolejce (scheduledAt: 9:00:00)

---

### **KROK 5.2: Wysyłka wznawia się (9:00:00)**

**Co się dzieje:**

1. **Cron uruchamia się (9:00:00):**
   - Próbuje wysłać Mail 200
   - scheduledAt = 9:00:00, now = 9:00:00
   - `9:00:00 <= 9:00:00` → ✅ **Jest czas**
   - Sprawdza dynamiczną tolerancję:
     - Brak stuck emails → `maxTolerance = 5 min`
     - `9:00:00 >= 8:55:00` → ✅ **W tolerancji**
   - Sprawdza okno czasowe: `9:00:00` w oknie 9:00-16:00 → ✅
   - Rezerwuje slot skrzynki (Mailbox 1: currentDailySent = 0 → 1)
   - Wysyła mail

2. **Kontynuuje wysyłkę:**
   - Mail 201, 202, 203, ...
   - Round-robin: Mailbox 1, 2, 3, ..., 10
   - Każdy mail: `scheduleNextEmailV2()` dodaje następny lead

**Wynik:**
- ✅ Wysyłka kontynuuje się normalnie
- ✅ Wysłano: ~200 + 100 = ~300 maili (łącznie)
- ✅ W kolejce: ~200 maili (status: 'pending')
- ✅ Pozostało: ~200 leadów (status: 'queued')

---

## 🔄 FAZA 6: Cykl się powtarza

### **KROK 6.1: Wyczerpanie slotów (ponownie)**

**Co się dzieje:**

- System wysyła maile do wyczerpania slotów
- Wszystkie skrzynki: `currentDailySent = 10`
- `getNextAvailableMailbox()` → `null`
- Maile pozostają w kolejce

**Wynik:**
- ✅ Wysłano: ~300 maili (łącznie)
- ✅ W kolejce: ~200 maili (status: 'pending', scheduledAt: jutro 9:00)

---

### **KROK 6.2: Nowy dzień (ponownie)**

**Co się dzieje:**

- Reset skrzynek
- Wysyłka wznawia się o 9:00
- Kontynuuje do wyczerpania slotów

**Wynik:**
- ✅ Wysłano: ~300 + 100 = ~400 maili (łącznie)
- ✅ W kolejce: ~100 maili

---

### **KROK 6.3: Zakończenie kampanii**

**Co się dzieje:**

- Wysłano wszystkie 500 maili
- `scheduleNextEmailV2()` zwraca `null` (brak więcej leadów)
- Kolejka jest pusta
- Kampania status: `IN_PROGRESS` (może być zmieniony na `COMPLETED` ręcznie)

**Wynik:**
- ✅ Wysłano: 500 maili
- ✅ Kolejka: pusta
- ✅ Kampania: zakończona

---

## 🔍 ZIDENTYFIKOWANE PROBLEMY

### **❌ Problem 1: Maile nie są przekładane na jutro gdy brak dostępnych skrzynek**

**Scenariusz:**
- Wszystkie skrzynki mają `currentDailySent = 10` (limit osiągnięty)
- `getNextAvailableMailbox()` zwraca `null`
- Mail pozostaje w kolejce jako 'pending'
- Cron próbuje wysłać go w kółko, ale zawsze brak slotów

**Rozwiązanie:**
- System powinien przekładać maile na jutro gdy brak dostępnych skrzynek
- Sprawdzać `getNextAvailableMailbox()` przed planowaniem
- Jeśli brak slotów, przekładać na jutro o `startHour`

---

### **❌ Problem 2: Dynamiczna tolerancja nie wykrywa recovery po pauzie**

**Scenariusz:**
- Kampania PAUSED przez 1.5h
- Wszystkie maile są 'pending' (nie 'sending')
- Po wznowieniu: brak stuck emails w statusie 'sending'
- `maxTolerance = 5 min` (nie wykryto recovery)
- Maile są przekładane na jutro zamiast wysłać natychmiast

**Rozwiązanie:**
- System powinien sprawdzać ostatni wysłany mail (SendLog)
- Jeśli od ostatniego maila minęło > 1h, użyć dłuższej tolerancji (2h)

---

### **✅ Poprawka Recovery działa dla 'sending' emails**

**Scenariusz:**
- Mail zablokowany (status: 'sending') podczas braku internetu
- Po 10 min: `unlockStuckEmails()` odblokowuje
- System wykrywa stuck emails → `maxTolerance = 120 min`
- Mail jest wysyłany natychmiast

**Wynik:** ✅ Działa poprawnie

---

## 🎯 REKOMENDACJE

### **Priorytet 1: Przekładanie maili na jutro gdy brak dostępnych skrzynek**

**Lokalizacja:** `campaignEmailSenderV2.ts` - `sendNextEmailFromQueue()`

**Rozwiązanie:**
```typescript
// Po sprawdzeniu dostępności skrzynki:
const availableMailbox = await getNextAvailableMailbox(...);
if (!availableMailbox) {
  // Brak dostępnych skrzynek - przekładaj na jutro
  const { setPolishTime, getPolishTime } = await import('@/utils/polishTime');
  const nowPL = getPolishTime();
  const tomorrowPL = new Date(nowPL);
  tomorrowPL.setDate(tomorrowPL.getDate() + 1);
  const newScheduledAt = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
  
  await db.campaignEmailQueue.update({
    where: { id: nextEmail.id },
    data: { scheduledAt: newScheduledAt }
  });
  
  return { success: true, mailSent: false };
}
```

---

### **Priorytet 2: Wykrywanie recovery po długich przerwach (pauza)**

**Lokalizacja:** `campaignEmailQueueV2.ts` i `campaignEmailSenderV2.ts` - dynamiczna tolerancja

**Rozwiązanie:**
```typescript
// Sprawdź ostatni wysłany mail (SendLog)
const lastSentLog = await db.sendLog.findFirst({
  where: { campaignId, status: 'sent' },
  orderBy: { createdAt: 'desc' }
});

if (lastSentLog) {
  const timeSinceLastMail = Math.floor((now.getTime() - new Date(lastSentLog.createdAt).getTime()) / 1000);
  
  // Jeśli od ostatniego maila minęło > 1h, to prawdopodobnie recovery
  if (timeSinceLastMail > 3600) {
    maxToleranceMinutes = 120; // 2h
  }
}
```

---

## 📊 PODSUMOWANIE

### **Co działa dobrze:**
- ✅ Inicjalizacja kolejki
- ✅ Atomowa rezerwacja slotów
- ✅ Round-robin skrzynek
- ✅ Reset liczników dziennych
- ✅ Dynamiczna tolerancja dla stuck emails
- ✅ Poprawka Recovery dla PAUSED (maile pozostają 'pending')

### **Co wymaga poprawy:**
- ❌ Przekładanie maili na jutro gdy brak dostępnych skrzynek
- ❌ Wykrywanie recovery po długich przerwach (pauza > 1h)

---

## 🎯 NASTĘPNE KROKI

1. **Zaimplementować przekładanie maili na jutro gdy brak dostępnych skrzynek**
2. **Rozszerzyć dynamiczną tolerancję o sprawdzanie ostatniego wysłanego maila**
3. **Przetestować pełny cykl życia kampanii**

