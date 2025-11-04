# Problem 1: Wysyłka równo co 2 minuty zamiast delayBetweenEmails

## 📋 Co to był za problem?

**Symptom:** Maile były wysyłane w równych odstępach czasu (np. co 2 minuty), niezależnie od ustawienia `delayBetweenEmails` w kampanii.

**Przykład:**
- Kampania ma `delayBetweenEmails = 180 sekund` (3 minuty)
- Oczekiwanie: maile co ~3 minuty (z wariacją ±20%)
- Rzeczywistość: maile wysyłane co 2 minuty (częstotliwość cron)

## 🔍 Dlaczego to występowało?

### Scenariusz 1: System działał normalnie

```
Czas: 10:00:00 - Mail 1 wysłany
Czas: 10:00:30 - Cron (nie ma maili do wysłania, scheduledAt = 10:03:00)
Czas: 10:01:00 - Cron (nie ma maili do wysłania, scheduledAt = 10:03:00)
Czas: 10:01:30 - Cron (nie ma maili do wysłania, scheduledAt = 10:03:00)
Czas: 10:02:00 - Cron (nie ma maili do wysłania, scheduledAt = 10:03:00)
Czas: 10:02:30 - Cron (nie ma maili do wysłania, scheduledAt = 10:03:00)
Czas: 10:03:00 - Cron → Mail 2 wysłany ✅
```

**W tym scenariuszu działało OK** - cron działa co 30s, ale mail jest wysyłany dopiero gdy `scheduledAt <= now`.

### Scenariusz 2: System miał opóźnienie (restart, błąd, etc.)

**PRZED POPRAWKĄ:**

```typescript
// getNextEmailForCampaign (PRZED)
const nextEmail = await db.campaignEmailQueue.findFirst({
  where: {
    campaignId,
    status: 'pending',
    scheduledAt: { lte: now } // ⚠️ PROBLEM: Brak ograniczenia dla starych maili
  }
});
```

**Co się działo:**

```
10:00:00 - Mail 1 wysłany, Mail 2 zaplanowany na 10:03:00
10:01:00 - System restart / błąd / opóźnienie
10:05:00 - System wraca online

10:05:00 - Cron:
  - Mail 2: scheduledAt = 10:03:00, now = 10:05:00
  - scheduledAt <= now ✅ → WYSYŁA NATYCHMIAST

10:05:30 - Cron:
  - Mail 3: scheduledAt = 10:06:00 (zostało obliczone po Mail 2)
  - scheduledAt <= now? ❌ → Nie wysyła
  - ALE: scheduleNextEmailV2 już dodał Mail 4 na 10:08:00 (opóźnienie 2 min zamiast 3!)

10:06:00 - Cron:
  - Mail 3: scheduledAt = 10:06:00, now = 10:06:00
  - scheduledAt <= now ✅ → WYSYŁA

10:06:30 - Cron:
  - Mail 4: scheduledAt = 10:08:00
  - scheduledAt <= now? ❌ → Nie wysyła

10:08:00 - Cron:
  - Mail 4: scheduledAt = 10:08:00, now = 10:08:00
  - scheduledAt <= now ✅ → WYSYŁA
```

**Efekt:** Maile wysyłane co 2 minuty zamiast 3, bo:
1. Mail 2 został wysłany z opóźnieniem (catch-up)
2. `scheduleNextEmailV2` obliczył następny mail na podstawie `lastSentTime = 10:05:00` (nie 10:03:00)
3. Kolejne maile były planowane zbyt blisko siebie

### Scenariusz 3: Wielokrotne opóźnienia

```
10:00:00 - Mail 1 wysłany
10:03:00 - Mail 2 zaplanowany
10:10:00 - System wraca (7 minut opóźnienia)

10:10:00 - Cron:
  - Mail 2: scheduledAt = 10:03:00, now = 10:10:00
  - scheduledAt <= now ✅ → WYSYŁA NATYCHMIAST
  - scheduleNextEmailV2: lastSentTime = 10:10:00, delay = 180s
  - Mail 3: scheduledAt = 10:13:00

10:10:30 - Cron:
  - Mail 3: scheduledAt = 10:13:00, now = 10:10:30
  - scheduledAt <= now? ❌ → Nie wysyła

10:13:00 - Cron:
  - Mail 3: scheduledAt = 10:13:00, now = 10:13:00
  - scheduledAt <= now ✅ → WYSYŁA
  - scheduleNextEmailV2: lastSentTime = 10:13:00, delay = 180s
  - Mail 4: scheduledAt = 10:16:00
```

**Problem:** Jeśli opóźnienie było duże, system próbował "nadrobić" opóźnienie, wysyłając maile zbyt szybko.

## ✅ Rozwiązanie

### 1. Dodano tolerancję dla starych maili

**PO POPRAWCE:**

```typescript
// getNextEmailForCampaign (PO)
const { getPolishTime } = await import('@/utils/polishTime');
const now = getPolishTime();

// ✅ POPRAWKA: Tolerancja 5 minut - nie wysyłaj maili starszych niż 5 minut
const maxToleranceMinutes = 5;
const maxTolerance = new Date(now.getTime() - maxToleranceMinutes * 60 * 1000);

const nextEmail = await db.campaignEmailQueue.findFirst({
  where: {
    campaignId,
    status: 'pending',
    scheduledAt: { 
      lte: now, // Tylko maile które już powinny być wysłane
      gte: maxTolerance // ✅ NIE wysyłaj maili starszych niż 5 min
    }
  }
});
```

**Co się teraz dzieje:**

```
10:00:00 - Mail 1 wysłany, Mail 2 zaplanowany na 10:03:00
10:01:00 - System restart / błąd / opóźnienie
10:05:00 - System wraca online

10:05:00 - Cron:
  - Mail 2: scheduledAt = 10:03:00, now = 10:05:00
  - scheduledAt <= now? ✅
  - scheduledAt >= maxTolerance (10:00:00)? ✅ (10:03:00 >= 10:00:00)
  - WYSYŁA ✅ (jest w tolerancji 5 min)

10:05:30 - Cron:
  - Mail 3: scheduledAt = 10:08:00 (obliczone po Mail 2)
  - scheduledAt <= now? ❌ → Nie wysyła

10:08:00 - Cron:
  - Mail 3: scheduledAt = 10:08:00, now = 10:08:00
  - scheduledAt <= now? ✅
  - scheduledAt >= maxTolerance (10:03:00)? ✅
  - WYSYŁA ✅
```

### 2. Jeśli mail jest zbyt stary, zaplanuj ponownie

```typescript
// ✅ POPRAWKA Problem 1: Jeśli mail jest zbyt stary (>5 min), zaplanuj ponownie
if (nextEmail && nextEmail.scheduledAt < maxTolerance) {
  const { setPolishTime } = await import('@/utils/polishTime');
  const nowPL = getPolishTime();
  const tomorrowPL = new Date(nowPL);
  tomorrowPL.setDate(tomorrowPL.getDate() + 1);
  const newScheduledAt = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
  
  await db.campaignEmailQueue.update({
    where: { id: nextEmail.id },
    data: {
      scheduledAt: newScheduledAt
    }
  });
  
  console.log(`[QUEUE V2] ⏰ Mail ${nextEmail.id} zbyt stary (>${maxToleranceMinutes} min) - zaplanowano ponownie na ${newScheduledAt.toISOString()}`);
  return null; // Nie zwracaj tego maila - będzie zaplanowany na jutro
}
```

**Scenariusz z bardzo starym mailem:**

```
10:00:00 - Mail 1 wysłany, Mail 2 zaplanowany na 10:03:00
10:01:00 - System restart / błąd
15:00:00 - System wraca online (5 godzin opóźnienia!)

15:00:00 - Cron:
  - Mail 2: scheduledAt = 10:03:00, now = 15:00:00
  - scheduledAt <= now? ✅
  - scheduledAt >= maxTolerance (14:55:00)? ❌ (10:03:00 < 14:55:00)
  - Mail jest zbyt stary → ZAPLANUJ PONOWNIE NA JUTRO o 9:00
  - Mail 2: scheduledAt = jutro 9:00

15:00:30 - Cron:
  - Mail 2: scheduledAt = jutro 9:00, now = 15:00:30
  - scheduledAt <= now? ❌ → Nie wysyła (zostanie na jutro)
```

## 🎯 Dlaczego to rozwiązuje problem?

1. **Tolerancja 5 minut:** Maile opóźnione o max 5 minut są wysyłane (catch-up), ale nie są zbyt stare
2. **Przekładanie starych maili:** Maile starsze niż 5 minut są przekładane na jutro, zamiast wysyłania ich "w catch-up"
3. **Zachowanie delayBetweenEmails:** Kolejne maile są planowane z prawidłowym `delayBetweenEmails`, nie z częstotliwością cron

## 📊 Porównanie: Przed vs Po

### PRZED (Problem):
```
10:00:00 - Mail 1
10:05:00 - System wraca (5 min opóźnienia)
10:05:00 - Mail 2 (catch-up, opóźniony o 2 min)
10:07:00 - Mail 3 (opóźniony o 2 min zamiast 3!)
10:09:00 - Mail 4 (opóźniony o 2 min zamiast 3!)
```
**Efekt:** Maile co 2 minuty zamiast 3

### PO (Rozwiązanie):
```
10:00:00 - Mail 1
10:05:00 - System wraca (5 min opóźnienia)
10:05:00 - Mail 2 (catch-up, w tolerancji 5 min)
10:08:00 - Mail 3 (prawidłowy delay 3 min)
10:11:00 - Mail 4 (prawidłowy delay 3 min)
```
**Efekt:** Maile co ~3 minuty (zgodnie z delayBetweenEmails)

## 🔧 Gdzie są zmiany?

1. **`campaignEmailQueueV2.ts`** - funkcja `getNextEmailForCampaign`:
   - Linia 296-299: Dodano tolerancję 5 minut
   - Linia 317-319: Filtrowanie `scheduledAt >= maxTolerance`
   - Linia 347-366: Sprawdzanie czy mail jest zbyt stary i przekładanie na jutro

## ✅ Testowanie

Aby przetestować:
1. Ustaw kampanię z `delayBetweenEmails = 180` (3 minuty)
2. Zatrzymaj system na 10 minut
3. Włącz system
4. Obserwuj logi - maile powinny być przekładane na jutro jeśli starsze niż 5 min
5. Maile w tolerancji 5 min powinny być wysyłane z prawidłowym delay

