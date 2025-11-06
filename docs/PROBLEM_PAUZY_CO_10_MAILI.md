# ❌ PROBLEM: PAUZA CO 10 MAILI NIE DZIAŁA

**Data:** 2025-11-05  
**Problem:** Po 120. mailu (6. mail od restartu) NIE BYŁO PAUZY

---

## 📊 FAKTYCZNE DANE

### **Mail 6 (20:55:12) = 120. mail total:**
- `sentCount = 120`
- `120 % 10 = 0` → **POWINNA BYĆ PAUZA**
- **Następny mail (7):** 20:56:34
- **Odstęp:** 82.0s (1.37 min) ❌
- **Problem:** NIE BYŁO PAUZY (powinno być 10-15 min = 600-900s)

---

## 🔍 ANALIZA KODU

### **Logika pauzy (`scheduleNextEmailV2`):**

```typescript
const sentCount = await db.sendLog.count({
  where: { campaignId, status: 'sent' }
});

if (sentCount > 0 && sentCount % 10 === 0) {
  // Dodaj pauzę 10-15 min
  nextTime = new Date(lastSentTime.getTime() + (actualPauseMinutes * 1000));
} else {
  // Normalny odstęp
  nextTime = calculateNextEmailTimeV2(lastSentTime, delayBetweenEmails);
}

// Sprawdź czy czas jest w oknie wysyłki
if (!isWithinSendWindow(scheduledAt, campaign)) {
  // Jeśli poza oknem, zaplanuj na następny dzień
  scheduledAt = tomorrow;
}
```

**Problem:**
- `sentCount` jest liczone PRZED planowaniem następnego maila
- Jeśli wysłano 120. mail → `sentCount = 120` → `120 % 10 === 0` → powinna być pauza
- `nextTime` jest obliczane z pauzą (10-15 min)
- Ale `isWithinSendWindow()` może nadpisać `scheduledAt` jeśli jest poza oknem

**Możliwe przyczyny:**
1. `sentCount` jest liczone w złym momencie (po wysłaniu maila, nie przed)
2. `isWithinSendWindow()` nadpisuje pauzę
3. `scheduleNextEmailV2()` nie jest wywoływane po każdym mailu

---

## 🔍 ANALIZA MOMENTU WYWOŁANIA

### **Kiedy `scheduleNextEmailV2()` jest wywoływane?**

**Lokalizacja:** `campaignEmailSenderV2.ts:1213`

```typescript
// Po wysłaniu maila:
await scheduleNextEmailV2(
  campaignId,
  sentAt, // Czas wysłania aktualnego maila
  campaign.delayBetweenEmails || 90
);
```

**Co się dzieje:**
1. Mail 120 jest wysyłany: 20:55:12
2. Po wysłaniu, wywołuje `scheduleNextEmailV2(campaignId, 20:55:12, 60)`
3. `sentCount = 120` (120 maili wysłanych)
4. `120 % 10 === 0` → powinna być pauza
5. `nextTime = 20:55:12 + 10-15 min = 21:05:12 - 21:10:12`
6. `isWithinSendWindow(21:05:12)` → powinno być OK (19:00-23:55)
7. `scheduledAt = 21:05:12` (z pauzą)

**Problem:** ❓ Dlaczego mail 7 był wysłany 20:56:34 (82s później) zamiast 21:05:12 (10 min później)?

---

## ❌ MOŻLIWE PRZYCZYNY

### **Przyczyna 1: `sentCount` jest liczone w złym momencie**

**Problem:**
- `sentCount` jest liczone PRZED planowaniem następnego maila
- Ale w momencie gdy mail jest wysyłany, `sentCount` już nie jest wielokrotnością 10?

**Sprawdzenie:**
- Mail 120 wysłany: 20:55:12
- `sentCount = 120` (120 maili wysłanych)
- `120 % 10 === 0` → powinna być pauza
- Mail 121 wysłany: 20:56:34
- `sentCount = 121` (121 maili wysłanych)
- `121 % 10 = 1` → nie jest wielokrotnością 10

**Wniosek:** ✅ `sentCount` jest liczone poprawnie (120 maili przed planowaniem maila 121)

---

### **Przyczyna 2: `isWithinSendWindow()` nadpisuje pauzę**

**Problem:**
- `nextTime` jest obliczane z pauzą (21:05:12)
- Ale `isWithinSendWindow()` może nadpisać `scheduledAt` jeśli jest poza oknem

**Sprawdzenie:**
- `nextTime = 21:05:12` (z pauzą)
- Okno czasowe: 19:00-23:55
- `isWithinSendWindow(21:05:12)` → powinno być OK (jest w oknie)

**Wniosek:** ✅ `isWithinSendWindow()` nie powinno nadpisać pauzy (21:05:12 jest w oknie)

---

### **Przyczyna 3: `scheduleNextEmailV2()` nie jest wywoływane po każdym mailu**

**Problem:**
- Może `scheduleNextEmailV2()` nie jest wywoływane po mailu 120?

**Sprawdzenie:**
- Mail 120 wysłany: 20:55:12
- Mail 121 wysłany: 20:56:34 (82s później)
- Jeśli `scheduleNextEmailV2()` nie był wywoływany, mail 121 mógł być zaplanowany wcześniej

**Wniosek:** ❓ Możliwe że `scheduleNextEmailV2()` nie jest wywoływane po każdym mailu, lub mail 121 był zaplanowany wcześniej (przed mail 120)

---

## 🔍 CO SPRAWDZIĆ

1. **Czy `scheduleNextEmailV2()` jest wywoływane po mailu 120?**
   - Sprawdzić logi (jeśli są dostępne)
   - Sprawdzić czy mail 121 był zaplanowany przed mail 120

2. **Czy mail 121 był zaplanowany wcześniej?**
   - Sprawdzić `scheduledAt` dla maila 121 w `CampaignEmailQueue`
   - Jeśli był zaplanowany przed mail 120, to mógł być wysłany bez pauzy

3. **Czy `isWithinSendWindow()` nadpisuje pauzę?**
   - Sprawdzić czy `nextTime` z pauzą jest w oknie czasowym
   - Jeśli nie, to `scheduledAt` jest nadpisywane na następny dzień

---

## ✅ REKOMENDACJA

**Sprawdzić:**
1. Czy mail 121 był zaplanowany wcześniej (przed mail 120)?
2. Czy `scheduleNextEmailV2()` jest wywoływane po każdym mailu?
3. Czy `isWithinSendWindow()` nadpisuje pauzę?

**Jeśli problem:**
- Mail 121 był zaplanowany wcześniej → to jest problem (kolejność planowania)
- `scheduleNextEmailV2()` nie jest wywoływane → to jest problem (logika)
- `isWithinSendWindow()` nadpisuje pauzę → to jest problem (logika)

