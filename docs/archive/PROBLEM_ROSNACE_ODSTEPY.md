# PROBLEM: ROSNĄCE ODSTĘPY MIĘDZY MAILAMI

## 🔴 PROBLEM

**Objaw:** Odstępy między mailami zwiększają się z każdym kolejnym mailem.

## 📊 ANALIZA

### Obecna logika:

1. **Mail 1:**
   - `scheduledAt = 12:01:30.050` (zaplanowany czas)
   - Wysłany o `sentAt = 12:02:00.100` (rzeczywisty czas, opóźnienie ~30s)
   - `scheduleNextEmailV2(..., sentAt, 90)` → używa `sentAt` jako bazę
   - Następny mail: `scheduledAt = 12:02:00.100 + 90s = 12:03:30.100`

2. **Mail 2:**
   - `scheduledAt = 12:03:30.100` (zaplanowany czas)
   - Wysłany o `sentAt = 12:04:00.150` (rzeczywisty czas, opóźnienie ~30s)
   - `scheduleNextEmailV2(..., sentAt, 90)` → używa `sentAt` jako bazę
   - Następny mail: `scheduledAt = 12:04:00.150 + 90s = 12:05:30.150`

3. **Odstęp rzeczywisty:**
   - Mail 1 → Mail 2: `12:03:30.100 - 12:02:00.100 = 90.1s`
   - Mail 2 → Mail 3: `12:05:30.150 - 12:04:00.150 = 90.15s`
   - Mail 3 → Mail 4: `90.2s`
   - **Odstępy rosną!**

## 🔍 PRZYCZYNA

**Kod w `sendEmailAfterTimeout()`:**
```typescript
const sentAt = new Date(); // Rzeczywisty czas wysyłki
await scheduleNextEmailV2(
  campaignId,
  sentAt, // ❌ PROBLEM: Używa rzeczywistego czasu
  campaign.delayBetweenEmails || 90
);
```

**Problem:**
- `scheduleNextEmailV2()` używa `sentAt` (rzeczywisty czas) jako bazę do obliczenia następnego `scheduledAt`
- Jeśli mail jest wysyłany z opóźnieniem (np. `setTimeout(0)` opóźnia się), `sentAt` jest późniejszy niż `scheduledAt`
- Następny mail jest planowany od `sentAt`, nie od `scheduledAt`
- To powoduje akumulację opóźnień i rosnące odstępy

## ✅ ROZWIĄZANIE

**Zmienić `sendEmailAfterTimeout()` aby używał `scheduledAt` zamiast `sentAt`:**

```typescript
// Pobierz scheduledAt z maila PRZED wysłaniem
const emailScheduledAt = nextEmail.scheduledAt;

// Po wysłaniu:
const sentAt = new Date();

// Użyj scheduledAt jako bazę (nie sentAt)
await scheduleNextEmailV2(
  campaignId,
  emailScheduledAt, // ✅ Użyj zaplanowanego czasu, nie rzeczywistego
  campaign.delayBetweenEmails || 90
);
```

**Wyjątek (catch-up):**
- Jeśli mail był bardzo stary (np. `scheduledAt` był w przeszłości o więcej niż 5 min), użyj `sentAt` aby nadrobić zaległości

## 📝 UWAGI

- To rozwiązanie zachowa stałe odstępy między mailami
- Jeśli mail jest wysyłany z opóźnieniem, następny mail nadal będzie zaplanowany od `scheduledAt`, nie od `sentAt`
- To zapobiegnie akumulacji opóźnień

