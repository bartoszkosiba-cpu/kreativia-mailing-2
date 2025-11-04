# Testy Problem 1: Wysyłka równo co 2 minuty zamiast delayBetweenEmails

## ✅ Co zostało naprawione

1. **Tolerancja 5 minut** - maile starsze niż 5 minut NIE są wysyłane natychmiast
2. **Przekładanie starych maili** - maile starsze niż 5 min są przekładane na jutro
3. **Filtrowanie w zapytaniu** - `scheduledAt >= maxTolerance` w WHERE clause

## 🧪 Scenariusze testowe

### Scenariusz 1: Normalny przepływ (powinno działać OK)
**Warunki:**
- Kampania: `delayBetweenEmails = 180 sekund` (3 minuty)
- Mail 1 wysłany: 10:00:00
- Mail 2 zaplanowany: 10:03:00
- System działa normalnie, brak opóźnień

**Oczekiwane zachowanie:**
- 10:00:00 - Mail 1 wysłany
- 10:00:30 - Cron: Mail 2 jeszcze nie czas (scheduledAt = 10:03:00 > now)
- 10:03:00 - Cron: Mail 2 wysłany ✅
- 10:03:00 - Mail 3 zaplanowany: 10:06:00 (delay 3 min)
- 10:06:00 - Cron: Mail 3 wysłany ✅

**Weryfikacja:** ✅ Powinno działać - brak zmian w normalnym przepływie

---

### Scenariusz 2: Małe opóźnienie (<5 min) - catch-up
**Warunki:**
- Kampania: `delayBetweenEmails = 180 sekund` (3 minuty)
- Mail 1 wysłany: 10:00:00
- Mail 2 zaplanowany: 10:03:00
- System restart: 10:01:00
- System wraca: 10:05:00 (4 minuty opóźnienia)

**Oczekiwane zachowanie:**
- 10:05:00 - Cron:
  - Mail 2: scheduledAt = 10:03:00, now = 10:05:00
  - scheduledAt <= now? ✅
  - scheduledAt >= maxTolerance (10:00:00)? ✅ (10:03:00 >= 10:00:00)
  - **WYSYŁA NATYCHMIAST** ✅ (catch-up w tolerancji)
- 10:05:00 - Mail 3 zaplanowany: 10:08:00 (lastSentTime = 10:05:00 + 3 min)
- 10:08:00 - Cron: Mail 3 wysłany ✅

**Weryfikacja:** ✅ Mail 2 wysłany z opóźnieniem, ale Mail 3 ma prawidłowy delay 3 min

---

### Scenariusz 3: Średnie opóźnienie (5 min dokładnie) - granica
**Warunki:**
- Kampania: `delayBetweenEmails = 180 sekund` (3 minuty)
- Mail 1 wysłany: 10:00:00
- Mail 2 zaplanowany: 10:03:00
- System restart: 10:01:00
- System wraca: 10:08:00 (5 minut opóźnienia dla Mail 2)

**Oczekiwane zachowanie:**
- 10:08:00 - Cron:
  - Mail 2: scheduledAt = 10:03:00, now = 10:08:00
  - scheduledAt <= now? ✅
  - maxTolerance = 10:08:00 - 5 min = 10:03:00
  - scheduledAt >= maxTolerance? ✅ (10:03:00 >= 10:03:00) - GRANICA!
  - **WYSYŁA NATYCHMIAST** ✅ (dokładnie na granicy tolerancji)

**Weryfikacja:** ✅ Mail 2 wysłany (dokładnie 5 min opóźnienia)

---

### Scenariusz 4: Duże opóźnienie (>5 min) - przekładanie na jutro
**Warunki:**
- Kampania: `delayBetweenEmails = 180 sekund` (3 minuty)
- Mail 1 wysłany: 10:00:00
- Mail 2 zaplanowany: 10:03:00
- System restart: 10:01:00
- System wraca: 10:10:00 (7 minut opóźnienia dla Mail 2)

**Oczekiwane zachowanie:**
- 10:10:00 - Cron:
  - Mail 2: scheduledAt = 10:03:00, now = 10:10:00
  - scheduledAt <= now? ✅
  - maxTolerance = 10:10:00 - 5 min = 10:05:00
  - scheduledAt >= maxTolerance? ❌ (10:03:00 < 10:05:00)
  - **PRZEKŁADA NA JUTRO** o 9:00 (startHour)
  - Mail 2: scheduledAt = jutro 9:00
- 10:10:00 - Cron: Mail 2 nie jest wysyłany (zaplanowany na jutro)
- Jutro 9:00 - Cron: Mail 2 wysłany ✅

**Weryfikacja:** ✅ Mail 2 przekładany na jutro, nie wysyłany z opóźnieniem

---

### Scenariusz 5: Bardzo duże opóźnienie (godziny) - problem z kolejnością
**Warunki:**
- Kampania: `delayBetweenEmails = 180 sekund` (3 minuty)
- Mail 1 wysłany: 10:00:00
- Mail 2 zaplanowany: 10:03:00 (priority 1)
- Mail 3 zaplanowany: 10:06:00 (priority 2)
- Mail 4 zaplanowany: 10:09:00 (priority 3)
- System restart: 10:01:00
- System wraca: 15:00:00 (5 godzin opóźnienia!)

**Oczekiwane zachowanie:**
- 15:00:00 - Cron:
  - Mail 2: scheduledAt = 10:03:00, now = 15:00:00
  - maxTolerance = 14:55:00
  - scheduledAt < maxTolerance? ✅ (10:03:00 < 14:55:00)
  - **PRZEKŁADA NA JUTRO** o 9:00
  - Mail 3: scheduledAt = 10:06:00, now = 15:00:00
  - scheduledAt < maxTolerance? ✅ (10:06:00 < 14:55:00)
  - **PRZEKŁADA NA JUTRO** o 9:00
  - Mail 4: scheduledAt = 10:09:00, now = 15:00:00
  - scheduledAt < maxTolerance? ✅ (10:09:00 < 14:55:00)
  - **PRZEKŁADA NA JUTRO** o 9:00
- Wszystkie maile: scheduledAt = jutro 9:00
- Jutro 9:00 - Cron:
  - Pobiera maile z scheduledAt = 9:00
  - Sortuje: scheduledAt (wszystkie 9:00), potem priority
  - Mail 2 (priority 1) wysłany pierwszy ✅
  - Mail 3 (priority 2) wysłany drugi ✅
  - Mail 4 (priority 3) wysłany trzeci ✅

**Weryfikacja:** ✅ Kolejność priorytetów zachowana

---

### Scenariusz 6: Problem - czy nie wysyła zbyt szybko?
**Warunki:**
- Kampania: `delayBetweenEmails = 180 sekund` (3 minuty)
- Cron działa: co 30 sekund
- Mail 1 wysłany: 10:00:00
- Mail 2 zaplanowany: 10:03:00
- System restart: 10:01:00
- System wraca: 10:02:00 (2 minuty opóźnienia)

**Potencjalny problem:**
- 10:02:00 - Cron: Mail 2 jeszcze nie czas (scheduledAt = 10:03:00 > now)
- 10:02:30 - Cron: Mail 2 jeszcze nie czas
- 10:03:00 - Cron: Mail 2 wysłany ✅
- 10:03:00 - Mail 3 zaplanowany: 10:06:00 (delay 3 min)
- 10:03:30 - Cron: Mail 3 jeszcze nie czas
- 10:06:00 - Cron: Mail 3 wysłany ✅

**Weryfikacja:** ✅ Powinno działać - delayBetweenEmails jest zachowany

---

### Scenariusz 7: Problem - czy catch-up nie psuje delayBetweenEmails?
**Warunki:**
- Kampania: `delayBetweenEmails = 180 sekund` (3 minuty)
- Mail 1 wysłany: 10:00:00
- Mail 2 zaplanowany: 10:03:00
- System restart: 10:01:00
- System wraca: 10:05:00 (4 min opóźnienia - w tolerancji)

**Potencjalny problem:**
- 10:05:00 - Cron: Mail 2 wysłany (catch-up)
- 10:05:00 - scheduleNextEmailV2: lastSentTime = 10:05:00
- Mail 3: scheduledAt = 10:08:00 (10:05:00 + 3 min) ✅
- **ALE:** Jeśli system ma więcej przeterminowanych maili, czy wszystkie są wysyłane zbyt szybko?

**Weryfikacja:** ⚠️ Potencjalny problem - jeśli jest wiele maili w tolerancji, mogą być wysyłane szybko

---

## ⚠️ Potencjalne problemy

### Problem A: Wielokrotne catch-up w jednym cyklu cron
**Scenariusz:**
- Mail 2: scheduledAt = 10:03:00, opóźnienie 2 min (w tolerancji)
- Mail 3: scheduledAt = 10:06:00, opóźnienie 2 min (w tolerancji)
- Mail 4: scheduledAt = 10:09:00, opóźnienie 2 min (w tolerancji)
- System wraca: 10:11:00

**Co się może stać:**
- 10:11:00 - Cron: Mail 2, Mail 3, Mail 4 - wszystkie w tolerancji
- `getNextEmailForCampaign` zwraca Mail 2 (najstarszy)
- Mail 2 wysłany
- `scheduleNextEmailV2`: lastSentTime = 10:11:00
- Mail 5: scheduledAt = 10:14:00
- **ALE:** Mail 3 i Mail 4 są nadal w kolejce!
- Następny cron (10:11:30): Mail 3 wysłany (catch-up)
- **PROBLEM:** Mail 3 i Mail 4 są wysyłane zbyt szybko (co 30s zamiast 3 min)

**Czy to jest problem?** 
- TAK - jeśli jest wiele maili w tolerancji, są wysyłane szybko w catch-up
- ALE: to jest zamierzone - catch-up ma nadrobić opóźnienie
- **Pytanie:** Czy catch-up powinien być ograniczony do 1 maila na cykl cron?

---

### Problem B: Czy filtrowanie w WHERE jest wystarczające?
**Kod:**
```typescript
scheduledAt: { 
  lte: now,
  gte: maxTolerance
}
```

**Potencjalny problem:**
- Jeśli `now = 10:10:00`, `maxTolerance = 10:05:00`
- Mail z `scheduledAt = 10:03:00` NIE zostanie pobrany (10:03:00 < 10:05:00) ✅
- Mail z `scheduledAt = 10:05:00` zostanie pobrany (10:05:00 >= 10:05:00) ✅
- Mail z `scheduledAt = 10:07:00` zostanie pobrany (10:07:00 >= 10:05:00) ✅

**Weryfikacja:** ✅ Filtrowanie w WHERE jest poprawne

---

### Problem C: Czy sprawdzanie `nextEmail.scheduledAt < maxTolerance` jest redundante?
**Kod:**
```typescript
// WHERE clause już filtruje
scheduledAt: { gte: maxTolerance }

// Ale potem jeszcze sprawdzam
if (nextEmail.scheduledAt < maxTolerance) {
  // przekładam na jutro
}
```

**Czy to jest potrzebne?**
- Teoretycznie NIE - WHERE już filtruje
- ALE: może być edge case gdzie `nextEmail` jest null, ale chcemy sprawdzić inne maile?
- **Weryfikacja:** ⚠️ Może być redundante, ale bezpieczne

---

## 🎯 Testy do wykonania

1. **Test 1:** Normalny przepływ - sprawdź czy delayBetweenEmails jest zachowany
2. **Test 2:** Opóźnienie <5 min - sprawdź catch-up
3. **Test 3:** Opóźnienie >5 min - sprawdź przekładanie na jutro
4. **Test 4:** Wielokrotne catch-up - sprawdź czy nie psuje delayBetweenEmails
5. **Test 5:** Kolejność priorytetów - sprawdź przy przekładaniu na jutro

