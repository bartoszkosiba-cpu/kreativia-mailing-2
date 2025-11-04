# Analiza Problemów V2 - Wykryte Problemy i Poprawki

## Problem 1: Wysyłka równo co 2 minuty zamiast delayBetweenEmails

### Analiza
- ✅ Cron V2 działa co 30 sekund - OK
- ✅ `calculateNextEmailTimeV2` używa `delayBetweenEmails ± 20%` - OK
- ⚠️ **PROBLEM**: W `getNextEmailForCampaign` używa `scheduledAt: { lte: now }` - jeśli mail jest "po czasie", zostanie wysłany natychmiast (catch-up)
- ⚠️ **PROBLEM**: Jeśli cron działa co 30s, a delay to np. 90s, to mail może być wysłany zbyt wcześnie jeśli `scheduledAt` już minął

### Skutek
- Jeśli system ma opóźnienie (np. restart), wszystkie "przeterminowane" maile zostaną wysłane natychmiast w odstępach 30s (częstotliwość cron), a nie zgodnie z `delayBetweenEmails`

### Poprawka
- Dodać sprawdzanie czy `scheduledAt` nie jest zbyt daleko w przeszłości (max 5 min tolerancji)
- Lub: Nie wysyłać maili jeśli `scheduledAt` jest starsze niż 5 minut (zaplanować ponownie)

---

## Problem 2: Pominięcie okna wysyłki (startHour/endHour)

### Analiza
- ✅ W `sendNextEmailFromQueue` jest sprawdzanie okna czasowego PRZED wysłaniem (linie 128-160)
- ✅ W `scheduleNextEmailV2` jest `isWithinSendWindow` - sprawdza przed dodaniem do kolejki
- ⚠️ **PROBLEM**: W `initializeQueueV2` jest `isWithinSendWindow`, ale jeśli `nextTime` jest poza oknem, planuje na jutro używając `setPolishTime` - ale może być problem z timezone
- ⚠️ **PROBLEM**: Jeśli mail jest w kolejce z `scheduledAt` w przyszłości, ale poza oknem czasowym, `getNextEmailForCampaign` może go pobrać jeśli `scheduledAt <= now` (ale nie sprawdza okna w `getNextEmailForCampaign`)

### Skutek
- Mail może być zaplanowany na jutro o `startHour`, ale jeśli `scheduledAt` jest w przyszłości (np. 23:00), a okno kończy się o 17:00, mail zostanie wysłany w nocy gdy `scheduledAt <= now`

### Poprawka
- `getNextEmailForCampaign` NIE sprawdza okna czasowego - tylko `scheduledAt <= now`
- Sprawdzanie okna jest w `sendNextEmailFromQueue` - ale to może być za późno jeśli mail już jest wybrany
- **ROZWIĄZANIE**: Sprawdzić okno czasowe w `getNextEmailForCampaign` lub zaplanować ponownie jeśli poza oknem

---

## Problem 3: Wysyłanie 2 maili (duplikaty)

### Analiza
- ✅ Jest sprawdzanie duplikatu w `sendLog` (linie 87-126)
- ✅ Jest `lockEmail` z atomic update (linie 332-353)
- ⚠️ **PROBLEM**: Race condition między `getNextEmailForCampaign` a `lockEmail`:
  1. Proces A: `getNextEmailForCampaign` → zwraca mail ID=1
  2. Proces B: `getNextEmailForCampaign` → zwraca ten sam mail ID=1 (bo jeszcze nie zablokowany)
  3. Proces A: `lockEmail(1)` → success
  4. Proces B: `lockEmail(1)` → fail (już zablokowany), ale może już mieć dane maila w pamięci
- ⚠️ **PROBLEM**: Jeśli `lockEmail` zwróci `false`, proces zwraca `{ success: true, mailSent: false }` - ale może być sytuacja gdzie proces już zaczął przetwarzać mail przed lockiem

### Skutek
- Dwa procesy mogą wysłać ten sam mail jednocześnie (choć `lockEmail` powinien to zapobiec)

### Poprawka
- `lockEmail` używa atomic update - powinno być OK
- Ale może być problem jeśli `getNextEmailForCampaign` jest wywoływane równolegle
- **ROZWIĄZANIE**: Dodać `SELECT FOR UPDATE` w `getNextEmailForCampaign` lub użyć transakcji

---

## DODATKOWE PROBLEMY

### Problem 4: Brak sprawdzania statusu kampanii
- W `sendNextEmailFromQueue` jest zakomentowane sprawdzanie statusu (linie 74-83)
- **POPRAWKA**: Włączyć sprawdzanie statusu `IN_PROGRESS` przed wysłaniem

### Problem 5: `scheduleNextEmailV2` nie sprawdza czy lead już otrzymał mail
- Sprawdza tylko czy jest w `CampaignEmailQueue`, ale nie sprawdza `SendLog`
- **POPRAWKA**: Dodać sprawdzanie `SendLog` przed dodaniem do kolejki

---

## REKOMENDOWANE POPRAWKI

1. **Dodać tolerancję w `getNextEmailForCampaign`**: Nie pobierać maili starszych niż 5 minut (zaplanować ponownie)
2. **Sprawdzić okno czasowe w `getNextEmailForCampaign`**: Lub zaplanować ponownie jeśli poza oknem
3. **Włączyć sprawdzanie statusu kampanii**: Przed wysłaniem
4. **Dodać sprawdzanie `SendLog` w `scheduleNextEmailV2`**: Przed dodaniem do kolejki
5. **Dodać transakcję w `getNextEmailForCampaign`**: `SELECT FOR UPDATE` aby zapobiec race condition

