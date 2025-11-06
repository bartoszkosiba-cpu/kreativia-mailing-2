# ✅ PELNA WERYFIKACJA: PAUZA CO 10 MAILI

**Data:** 2025-11-05, 21:15  
**Cel:** Sprawdzenie wszystkich aspektów pauzy co 10 maili

---

## 📊 WERYFIKACJA KODU

### **1. Logika pauzy (`scheduleNextEmailV2`):**

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
  scheduledAt = tomorrow; // Nadpisuje na następny dzień
}
```

**Analiza:**
- ✅ `sentCount` jest liczone poprawnie (wszystkie wysłane maile)
- ✅ Sprawdzenie `sentCount % 10 === 0` jest poprawne
- ✅ Pauza 10-15 min jest obliczana poprawnie
- ⚠️ `isWithinSendWindow()` może nadpisać pauzę jeśli jest poza oknem

---

### **2. Wywołanie `scheduleNextEmailV2()`:**

**Lokalizacja:** `campaignEmailSenderV2.ts:1213`

```typescript
// Po wysłaniu maila:
await scheduleNextEmailV2(
  campaignId,
  sentAt, // Czas wysłania aktualnego maila
  campaign.delayBetweenEmails || 90
);
```

**Analiza:**
- ✅ `scheduleNextEmailV2()` jest wywoływane po każdym mailu
- ✅ Używa `sentAt` jako `lastSentTime` (poprawne)

---

### **3. Sprawdzenie `isWithinSendWindow()`:**

**Lokalizacja:** `campaignEmailQueueV2.ts:596`

```typescript
if (!isWithinSendWindow(scheduledAt, campaign)) {
  scheduledAt = tomorrow; // Nadpisuje na następny dzień
}
```

**Analiza:**
- ⚠️ Jeśli `nextTime` z pauzą jest poza oknem czasowym, `scheduledAt` jest nadpisywane
- ⚠️ Dla okna 19:00-23:55, pauza 10-15 min (21:09:38 + 10-15 min = 21:19-21:24) jest w oknie ✅
- ✅ Nie powinno nadpisać pauzy

---

## 📊 WERYFIKACJA DANYCH

### **1. Maile w kolejce:**

**Sprawdzenie:**
- Czy są nowe maile planowane po restarcie?
- Czy mają prawidłowe `scheduledAt` z pauzą?
- Czy `sentCount` był prawidłowy w momencie planowania?

---

### **2. Mail 130 (ostatni wysłany):**

**Faktyczne:**
- Wysłany: 21:09:38
- `sentCount = 130`
- `130 % 10 = 0` → **POWINNA BYĆ PAUZA**

**Następny mail (131):**
- Powinien być zaplanowany na: 21:19:38 - 21:24:38 (10-15 min później)
- Sprawdzić czy `scheduledAt` jest w tym zakresie

---

### **3. Maile planowane po restarcie:**

**Sprawdzenie:**
- Czy są maile z `createdAt > 20:47:14` (po restarcie)?
- Czy mają prawidłowe `scheduledAt` z pauzą?
- Czy `sentCount` był prawidłowy w momencie planowania?

---

## 🔍 CO SPRAWDZIĆ

1. **Czy są nowe maile planowane po restarcie?**
   - Sprawdzić `createdAt` dla maili w kolejce
   - Jeśli wszystkie są przed restartem, to problem

2. **Czy mail 131 ma pauzę?**
   - Sprawdzić `scheduledAt` dla maila 131
   - Powinien być 21:19-21:24 (10-15 min po 21:09:38)

3. **Czy `sentCount` był prawidłowy?**
   - Sprawdzić `sentCount` w momencie planowania
   - Powinien być 130 (wielokrotność 10)

4. **Czy `isWithinSendWindow()` nadpisuje pauzę?**
   - Sprawdzić czy `scheduledAt` jest w oknie czasowym
   - Jeśli nie, to może być nadpisane

---

## ✅ WERYFIKACJA WYNIKÓW

**Po sprawdzeniu danych, będziemy wiedzieć:**
1. ✅ Czy logika pauzy działa poprawnie (kod)
2. ✅ Czy nowe maile są planowane z pauzą
3. ✅ Czy mail 131 ma pauzę
4. ✅ Czy `isWithinSendWindow()` nadpisuje pauzę

