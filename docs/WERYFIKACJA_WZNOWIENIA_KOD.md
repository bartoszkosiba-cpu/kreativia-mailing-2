# ✅ WERYFIKACJA KODU: WZNOWIENIE KAMPANII

**Data:** 2025-11-05  
**Sprawdzenie:** Czy po wznowieniu kampanii wszystko działa poprawnie

---

## 🔍 ANALIZA KODU

### **1. Po wysłaniu maila - `scheduleNextEmailV2()`**

**Lokalizacja:** `campaignEmailSenderV2.ts:1213`

```typescript
await scheduleNextEmailV2(
  campaignId,
  sentAt, // ← Czas wysłania aktualnego maila
  campaign.delayBetweenEmails || 90
);
```

**Co to robi:**
- ✅ `sentAt` = czas wysłania aktualnego maila (np. 20:22:16)
- ✅ `scheduleNextEmailV2()` używa `sentAt` jako `lastSentTime`
- ✅ Oblicza `nextTime` na podstawie `lastSentTime`

**Wniosek:** ✅ **POPRAWNIE** - używa czasu wysłania aktualnego maila

---

### **2. `scheduleNextEmailV2()` - obliczanie `nextTime`**

**Lokalizacja:** `campaignEmailQueueV2.ts:485`

```typescript
export async function scheduleNextEmailV2(
  campaignId: number,
  lastSentTime: Date, // ← Czas ostatniego wysłanego maila (lub aktualnego)
  delayBetweenEmails: number
): Promise<number | null> {
  // Sprawdź czy to 10. mail
  const sentCount = await db.sendLog.count({
    where: { campaignId, status: 'sent' }
  });

  let nextTime = lastSentTime;
  
  if (sentCount > 0 && sentCount % 10 === 0) {
    // Dodaj pauzę 10-15 min
    nextTime = new Date(lastSentTime.getTime() + (actualPauseMinutes * 1000));
  } else {
    // Normalny odstęp między mailami
    nextTime = calculateNextEmailTimeV2(lastSentTime, delayBetweenEmails);
  }
  
  // ... reszta logiki
}
```

**Co to robi:**
- ✅ `lastSentTime` = czas ostatniego wysłanego maila (lub aktualnego)
- ✅ `sentCount` = liczba wszystkich wysłanych maili (od początku kampanii)
- ✅ Jeśli `sentCount % 10 === 0`, dodaje pauzę 10-15 min
- ✅ W przeciwnym razie, oblicza normalny odstęp 30-60s (dla 30s delayBetweenEmails)

**Wniosek:** ✅ **POPRAWNIE** - używa `lastSentTime` do obliczenia `nextTime`

---

### **3. Scenariusz wznowienia**

**Krok 1: Kampania działa (IN_PROGRESS)**
- Mail 10 wysłany: 19:35:43
- `scheduleNextEmailV2(campaignId, 19:35:43, 30)`
- `sentCount = 10`, `10 % 10 === 0` → **pauza 10-15 min**
- Mail 11 zaplanowany na: 19:45:43 - 19:50:43 (10-15 min pauzy) ✅

**Krok 2: User klika PAUZA**
- Status: IN_PROGRESS → PAUSED
- Mail 11 pozostaje `pending`, `scheduledAt = 19:45:43` (lub 19:50:43)

**Krok 3: User klika WZNÓW (20:22:00)**
- Status: PAUSED → SCHEDULED → IN_PROGRESS
- Mail 11 jest gotowy (`scheduledAt <= now()`)
- System wysyła mail 11 o 20:22:16
- Po wysłaniu, wywołuje `scheduleNextEmailV2(campaignId, 20:22:16, 30)`

**Krok 4: Planowanie maila 12**
- `sentCount = 11` (11 maili wysłanych)
- `11 % 10 !== 0` → **nie ma pauzy**
- `nextTime = calculateNextEmailTimeV2(20:22:16, 30)`
- `nextTime = 20:22:16 + 30-60s = 20:22:46 - 20:23:16` ✅

**Wniosek:** ✅ **POPRAWNIE** - po wznowieniu, odstępy są obliczane od czasu wysłania aktualnego maila

---

### **4. Problem z długą przerwą**

**Scenariusz:**
- Mail 10 wysłany: 19:35:43
- Mail 11 zaplanowany na: 19:45:43 (10-15 min pauzy)
- User klika PAUZA: 19:40:00
- User klika WZNÓW: 20:22:00 (42 min później)
- Mail 11 jest gotowy (`scheduledAt <= now()`)
- System wysyła mail 11 o 20:22:16
- `scheduleNextEmailV2(campaignId, 20:22:16, 30)`
- `nextTime = 20:22:46 - 20:23:16` (30-60s)

**Problem:** ❓ Odstęp między mailami 10 i 12 wynosi ~47 min (nie 30-60s)

**Rozwiązanie:** ✅ **To jest poprawne!** Mail 11 był zaplanowany na 19:45:43, ale został wysłany 20:22:16 (z powodu pauzy). Odstęp między mailami 10 i 12 jest długi, ale to jest spowodowane długą przerwą w kampanii, nie błędem w kodzie.

---

### **5. Pauza co 10 maili po wznowieniu**

**Scenariusz:**
- Mail 10 wysłany: 19:35:43
- `sentCount = 10`, `10 % 10 === 0` → **pauza 10-15 min**
- Mail 11 zaplanowany na: 19:45:43 - 19:50:43
- User klika PAUZA: 19:40:00
- User klika WZNÓW: 20:22:00
- Mail 11 wysłany: 20:22:16
- `sentCount = 11`, `11 % 10 !== 0` → **nie ma pauzy**
- Mail 12 zaplanowany na: 20:22:46 - 20:23:16 (30-60s)

**Wniosek:** ✅ **POPRAWNIE** - pauza co 10 maili działa poprawnie (sprawdza się PRZED planowaniem następnego maila)

---

### **6. Randomizacja po wznowieniu**

**Dla zaplanowanych maili:**
- `calculateNextEmailTimeV2(20:22:16, 30)`
- `minDelay = 30s`, `maxDelay = 60s`
- `nextTime = 20:22:16 + 30-60s = 20:22:46 - 20:23:16` ✅

**Dla gotowych maili (po wznowieniu):**
- Mail 11: `scheduledAt = 19:45:43` (w przeszłości)
- System używa logiki dla gotowych maili:
  - `baseDelay = 30s - 30s = 0s`
  - `minDelay = 30s` (fix), `maxDelay = 30s`
  - `correctedTime = 30s`
  - Wysyłka za 30s ✅

**Wniosek:** ✅ **POPRAWNIE** - randomizacja działa poprawnie

---

## ✅ WERYFIKACJA: WSZYSTKO DZIAŁA POPRAWNIE

### **1. `lastSentTime` po wznowieniu**
- ✅ Używa `sentAt` (czas wysłania aktualnego maila)
- ✅ Poprawnie oblicza `nextTime` na podstawie `lastSentTime`

### **2. Pauza co 10 maili**
- ✅ `sentCount` jest liczone od początku kampanii
- ✅ Sprawdza się PRZED planowaniem następnego maila
- ✅ Działa poprawnie po wznowieniu

### **3. Randomizacja**
- ✅ Zaplanowane maile: 30-60s (dla 30s delayBetweenEmails)
- ✅ Gotowe maile: 30s (fix dla baseDelay <= 0)
- ✅ Działa poprawnie po wznowieniu

### **4. Długie przerwy**
- ✅ Jeśli kampania była wstrzymana przez długi czas, odstępy są obliczane od czasu wznowienia
- ✅ To jest poprawne zachowanie (kampania nie powinna "nadrabiać" zaległości)

---

## 📋 PODSUMOWANIE

### **✅ CO DZIAŁA POPRAWNIE:**

1. ✅ **`lastSentTime`:** Używa `sentAt` (czas wysłania aktualnego maila)
2. ✅ **Pauza co 10 maili:** Działa poprawnie (sprawdza się PRZED planowaniem)
3. ✅ **Randomizacja:** Działa poprawnie (30-60s dla zaplanowanych, 30s dla gotowych)
4. ✅ **Wznowienie:** Odstępy są obliczane od czasu wznowienia (poprawne zachowanie)

### **❌ PROBLEMY NIE ZNALEZIONE:**

- ✅ Wszystko działa poprawnie!

---

## 🎯 WNIOSEK

**Po wznowieniu kampanii wszystko działa poprawnie:**

1. ✅ Odstępy są obliczane od czasu wysłania aktualnego maila
2. ✅ Pauza co 10 maili działa poprawnie
3. ✅ Randomizacja działa poprawnie
4. ✅ Gotowe maile używają fix dla 30s (baseDelay <= 0)

**Nie ma potrzeby wprowadzania zmian!**

