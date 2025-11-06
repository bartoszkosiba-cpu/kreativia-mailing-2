# PLAN WDROŻENIA OPCJI 4: Cron + setTimeout z korektą

## 📋 PRZEGLĄD

**Opcja 4:** Cron co 30s + setTimeout z korektą czasu  
**Cel:** Idealna randomizacja (72-108s) bez wielokrotności interwału crona

---

## 🔄 OBECNY PRZEPŁYW vs NOWY PRZEPŁYW

### OBECNY PRZEPŁYW:
1. Cron co 10s → `processScheduledEmailsV2()`
2. `processScheduledEmailsV2()` → dla każdej kampanii: `sendNextEmailFromQueue()`
3. `sendNextEmailFromQueue()` → sprawdza `scheduledAt <= now` → **wysyła natychmiast**
4. Po wysłaniu → `scheduleNextEmailV2()` → `scheduledAt = now + random(72-108s)`

**Problem:** Faktyczne odstępy = wielokrotności 10s (72, 82, 92, 102, 112...)

### NOWY PRZEPŁYW (Opcja 4):
1. Cron co 30s → `processScheduledEmailsV2()`
2. `processScheduledEmailsV2()` → dla każdej kampanii:
   - Sprawdź czy są maile gotowe (`scheduledAt <= now`)
   - Jeśli TAK → **lockuj mail** → uruchom `setTimeout(scheduledAt - now - 30s)`
   - Jeśli NIE → pomiń
3. `setTimeout` → po określonym czasie → wyślij mail
4. Po wysłaniu → `scheduleNextEmailV2()` → `scheduledAt = now + random(72-108s)`

**Efekt:** Faktyczne odstępy = dokładnie `scheduledAt` (losowe 72-108s)

---

## 📝 PLAN WDROŻENIA - KROK PO KROKU

### KROK 1: Zmiana częstotliwości crona

**Plik:** `src/services/emailCron.ts`  
**Zmiana:** `*/10 * * * * *` → `*/30 * * * * *`

```typescript
// PRZED:
campaignCronJobV2 = cron.schedule('*/10 * * * * *', async () => { ... });

// PO:
campaignCronJobV2 = cron.schedule('*/30 * * * * *', async () => { ... });
```

**Efekt:** Cron działa co 30s zamiast 10s

---

### KROK 2: Modyfikacja `processScheduledEmailsV2()`

**Plik:** `src/services/campaignEmailSenderV2.ts`

**Obecna logika:**
```typescript
export async function processScheduledEmailsV2() {
  // Dla każdej kampanii IN_PROGRESS:
  const result = await sendNextEmailFromQueue(campaignId); // Wysyła natychmiast
}
```

**Nowa logika:**
```typescript
export async function processScheduledEmailsV2() {
  // Dla każdej kampanii IN_PROGRESS:
  // 1. Sprawdź czy są maile gotowe (scheduledAt <= now)
  // 2. Jeśli TAK → lockuj mail → uruchom setTimeout
  // 3. Jeśli NIE → pomiń
}
```

**Szczegóły implementacji:**
- Użyj `sendNextEmailFromQueue()` tylko do **lockowania** maila (nie wysyłania)
- Zwróć `{ email, locked, reservedMailbox }` z statusem `sending`
- Uruchom `setTimeout` dla zablokowanego maila
- Jeśli `scheduledAt <= now` → `setTimeout(0)` (wysyła natychmiast)
- Jeśli `scheduledAt > now` → `setTimeout(scheduledAt - now)` (wysyła w przyszłości)

---

### KROK 3: Nowa funkcja `sendEmailAfterTimeout()`

**Plik:** `src/services/campaignEmailSenderV2.ts`

**Funkcjonalność:**
```typescript
async function sendEmailAfterTimeout(
  emailId: number,
  campaignId: number,
  reservedMailbox: AvailableMailbox
): Promise<void> {
  // 1. Pobierz zablokowany mail (status: sending)
  // 2. Sprawdź czy kampania nadal IN_PROGRESS
  // 3. Wysyła mail (użyj istniejącego sendSingleEmail)
  // 4. Aktualizuj statusy (sent, CampaignLead)
  // 5. Planuje następny mail (scheduleNextEmailV2)
}
```

**Uwagi:**
- Używa istniejącego kodu z `sendNextEmailFromQueue()` (KROK 7-8)
- Nie trzeba blokować ponownie (już zablokowany)
- Nie trzeba rezerwować skrzynki (już zarezerwowana)

---

### KROK 4: Obsługa ujemnych czasów

**Plik:** `src/services/campaignEmailSenderV2.ts`

**Logika:**
```typescript
const now = getPolishTime();
const timeUntilScheduled = scheduledAt.getTime() - now.getTime(); // ms

if (timeUntilScheduled <= 0) {
  // Mail już przeterminowany → wysyła natychmiast
  setTimeout(() => sendEmailAfterTimeout(...), 0);
} else {
  // Mail w przyszłości → korekta czasu (30s)
  const correctedTime = Math.max(0, timeUntilScheduled - 30000); // -30s
  setTimeout(() => sendEmailAfterTimeout(...), correctedTime);
}
```

**Efekt:**
- Catch-up maile (stare) → wysyła natychmiast
- Maile w przyszłości → wysyła dokładnie w `scheduledAt` (korekta 30s)

---

### KROK 5: Obsługa locków w DB

**Plik:** `src/services/campaignEmailSenderV2.ts`

**Logika:**
```typescript
// PRZED setTimeout:
const result = await sendNextEmailFromQueue(campaignId); // Lockuje mail atomowo
if (!result.locked) {
  return; // Ktoś inny już zablokował
}

// Uruchom setTimeout (mail już zablokowany)
setTimeout(() => {
  sendEmailAfterTimeout(result.email.id, campaignId, result.reservedMailbox);
}, correctedTime);
```

**Efekt:**
- Tylko jeden proces może zablokować mail
- Jeśli lock się nie udał → pomiń (ktoś inny już wysyła)
- Po `setTimeout` → wysyła mail (już zablokowany)

---

### KROK 6: Obsługa restartu serwera

**Plik:** `src/services/campaignEmailSenderV2.ts`

**Funkcja:** `recoverStuckEmailsAfterRestart()`

**Logika:**
```typescript
export async function recoverStuckEmailsAfterRestart(): Promise<void> {
  // Znajdź maile w statusie 'sending' (zablokowane przed restartem)
  const stuckEmails = await db.campaignEmailQueue.findMany({
    where: {
      status: 'sending',
      updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } // Starsze niż 10 min
    },
    include: { ... }
  });

  for (const email of stuckEmails) {
    const now = getPolishTime();
    const timeUntilScheduled = email.scheduledAt.getTime() - now.getTime();

    if (timeUntilScheduled <= 0) {
      // Mail już przeterminowany → wysyła natychmiast
      await sendEmailAfterTimeout(email.id, email.campaignId, ...);
    } else {
      // Mail w przyszłości → uruchom setTimeout
      setTimeout(() => {
        sendEmailAfterTimeout(email.id, email.campaignId, ...);
      }, Math.max(0, timeUntilScheduled - 30000));
    }
  }
}
```

**Wywołanie:** Przy starcie serwera (w `emailCron.ts` lub `server.ts`)

**Efekt:** Recovery po restarcie - wszystkie zablokowane maile są obsłużone

---

## 🔍 ANALIZA POTENCJALNYCH PROBLEMÓW

### PROBLEM 1: Ujemne czasy
**Scenariusz:** `scheduledAt = 00:01:00`, cron uruchamia się `00:01:30`  
**Obliczenie:** `setTimeout(00:01:00 - 00:01:30 - 30s = -60s)`  
**Rozwiązanie:** Jeśli wynik < 0 → `setTimeout(0)` → wysyła natychmiast  
**Status:** ✅ ROZWIĄZANE

---

### PROBLEM 2: Race condition (wiele setTimeout)
**Scenariusz:** 2 maile gotowe, cron uruchamia się jednocześnie  
**Obliczenie:** Oba mogą uruchomić setTimeout  
**Rozwiązanie:** Locki w DB przed setTimeout (`status: sending`)  
**Status:** ✅ ROZWIĄZANE

---

### PROBLEM 3: Restart serwera (timeouty znikają)
**Scenariusz:** `setTimeout(60s)`, ale serwer restartuje się po 30s  
**Obliczenie:** Timeout zniknął, mail nie został wysłany  
**Rozwiązanie:** Recovery przy starcie - sprawdź maile `sending`  
**Status:** ✅ ROZWIĄZANE

---

### PROBLEM 4: Korekta czasu (30s)
**Scenariusz:** Cron się spóźnia (35s zamiast 30s)  
**Obliczenie:** `setTimeout(scheduledAt - now - 35s)`  
**Rozwiązanie:** Używamy rzeczywistego czasu (`now`), nie zakładamy 30s  
**Status:** ✅ ROZWIĄZANE

---

### PROBLEM 5: Zablokowane maile (status: sending)
**Scenariusz:** Mail zablokowany, ale setTimeout nie działa  
**Obliczenie:** Mail zostaje w statusie `sending`  
**Rozwiązanie:** `unlockStuckEmails()` już mamy (odblokowuje po 10 min)  
**Status:** ✅ ROZWIĄZANE

---

### PROBLEM 6: Wiele kampanii jednocześnie
**Scenariusz:** 5 kampanii, każda ma mail gotowy  
**Obliczenie:** 5 setTimeout jednocześnie  
**Rozwiązanie:** Każdy mail ma własny setTimeout, locki w DB  
**Status:** ✅ ROZWIĄZANE

---

## ✅ SPRAWDZENIE DLA KAMPANII 3, 4 I NOWYCH

### KAMPANIA 3:
- **Status:** `PAUSED` (może być `IN_PROGRESS`)
- **Maile w kolejce:** `scheduledAt` w DB (już istnieją)
- **Działanie:**
  - Cron sprawdza `scheduledAt <= now`
  - Jeśli TAK → `setTimeout`
  - Jeśli NIE → pomiń
- **Czy działa?** ✅ TAK - działa dla każdej kampanii (uniwersalna logika)

---

### KAMPANIA 4:
- **Status:** `PAUSED` (może być `IN_PROGRESS`)
- **Maile w kolejce:** `scheduledAt` w DB (już istnieją)
- **Działanie:**
  - Cron sprawdza `scheduledAt <= now`
  - Jeśli TAK → `setTimeout`
  - Jeśli NIE → pomiń
- **Czy działa?** ✅ TAK - działa dla każdej kampanii (uniwersalna logika)

---

### NOWE KAMPANIE:
- **Status:** `IN_PROGRESS` (po starcie)
- **Inicjalizacja:** `initializeQueueV2()` → `scheduledAt` w DB (losowy 72-108s)
- **Działanie:**
  - Cron sprawdza `scheduledAt <= now`
  - Jeśli TAK → `setTimeout`
  - Jeśli NIE → pomiń
- **Czy działa?** ✅ TAK - działa tak samo jak dla istniejących

---

## 🎯 EDGE CASES

### EDGE CASE 1: Mail bardzo stary (catch-up)
**Scenariusz:** `scheduledAt = 00:00:00`, cron uruchamia się `00:10:00`  
**Obliczenie:** `setTimeout(00:00:00 - 00:10:00 - 30s = -630s)`  
**Rozwiązanie:** Jeśli < 0 → `setTimeout(0)` → wysyła natychmiast  
**Status:** ✅ OBSŁUŻONE

---

### EDGE CASE 2: Mail zaplanowany w przyszłości
**Scenariusz:** `scheduledAt = 00:05:00`, cron uruchamia się `00:01:00`  
**Obliczenie:** `setTimeout(00:05:00 - 00:01:00 - 30s = 210s)`  
**Rozwiązanie:** `setTimeout(210s)` → wysyła o `00:05:00`  
**Status:** ✅ OBSŁUŻONE

---

### EDGE CASE 3: Restart podczas setTimeout
**Scenariusz:** `setTimeout(60s)`, restart po 30s  
**Rozwiązanie:** Recovery przy starcie - sprawdź `scheduledAt`  
**Status:** ✅ OBSŁUŻONE

---

### EDGE CASE 4: Wiele instancji serwera
**Scenariusz:** 2 instancje, ten sam mail  
**Rozwiązanie:** Locki w DB (`status: sending`)  
**Status:** ✅ OBSŁUŻONE

---

### EDGE CASE 5: Kampania PAUSED podczas setTimeout
**Scenariusz:** `setTimeout(60s)`, kampania `PAUSED` po 30s  
**Rozwiązanie:** Sprawdź status przed wysyłką (już mamy w `sendNextEmailFromQueue`)  
**Status:** ✅ OBSŁUŻONE

---

### EDGE CASE 6: Brak dostępnych skrzynek
**Scenariusz:** Mail gotowy, ale brak skrzynek  
**Rozwiązanie:** Mail przekładany na jutro (już mamy w `sendNextEmailFromQueue`)  
**Status:** ✅ OBSŁUŻONE

---

### EDGE CASE 7: Limit kampanii osiągnięty
**Scenariusz:** Mail gotowy, ale `maxEmailsPerDay` osiągnięty  
**Rozwiązanie:** Mail przekładany na jutro (już mamy w `sendNextEmailFromQueue`)  
**Status:** ✅ OBSŁUŻONE

---

### EDGE CASE 8: Poza oknem czasowym
**Scenariusz:** Mail gotowy, ale poza `startHour-endHour`  
**Rozwiązanie:** Mail przekładany na jutro (już mamy w `sendNextEmailFromQueue`)  
**Status:** ✅ OBSŁUŻONE

---

## 📊 PORÓWNANIE: PRZED vs PO WDROŻENIU

| Aspekt | PRZED (Cron 10s) | PO (Opcja 4) |
|--------|------------------|--------------|
| **Randomizacja** | Wielokrotności 10s (72, 82, 92...) | Losowe 72-108s |
| **Faktyczne odstępy** | 72, 82, 92, 102, 112... | 72, 98, 74, 105, 83... |
| **Częstotliwość crona** | Co 10s | Co 30s |
| **Opóźnienia** | 0-10s (opóźnienie crona) | 0s (korekta czasu) |
| **Wykrywalność** | Wykrywalne (wielokrotności) | Niewykrywalne (losowe) |
| **Efektywność** | Częste sprawdzenia (co 10s) | Rzadsze sprawdzenia (co 30s) |

---

## 🚀 KROKI WDROŻENIA

1. ✅ **Backup:** Utwórz backup projektu i bazy danych
2. ✅ **Testy:** Przetestuj na lokalnym środowisku
3. ✅ **Implementacja:** Zaimplementuj kroki 1-6
4. ✅ **Weryfikacja:** Sprawdź czy działa dla kampanii 3, 4 i nowych
5. ✅ **Deploy:** Wdróż na produkcję

---

## ⚠️ UWAGI

1. **Nie trzeba migrować danych** - `scheduledAt` już istnieje w DB
2. **Nie trzeba zmieniać UI** - wszystko działa jak wcześniej
3. **Backward compatible** - istniejące kampanie działają bez zmian
4. **Recovery automatyczny** - po restarcie wszystkie maile są obsłużone

---

## ✅ WNIOSEK

**Opcja 4 działa dla:**
- ✅ Kampanii 3 (istniejąca)
- ✅ Kampanii 4 (istniejąca)
- ✅ Nowych kampanii

**Wszystkie edge cases są obsłużone:**
- ✅ Ujemne czasy → wysyła natychmiast
- ✅ Race condition → locki w DB
- ✅ Restart → recovery przy starcie
- ✅ Wielokrotność instancji → locki w DB
- ✅ PAUSED → sprawdzenie statusu
- ✅ Brak skrzynek → przekładanie na jutro
- ✅ Limit kampanii → przekładanie na jutro
- ✅ Poza oknem → przekładanie na jutro

**Potencjalne problemy są rozwiązane.**

