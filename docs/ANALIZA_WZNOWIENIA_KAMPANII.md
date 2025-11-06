# 🔍 ANALIZA: WZNOWIENIE KAMPANII - CZY DZIAŁA POPRAWNIE?

**Data:** 2025-11-05  
**Problem:** Sprawdzenie czy po wznowieniu kampanii wszystko działa poprawnie

---

## 📋 SCENARIUSZ WZNOWIENIA

### **1. Kampania działa (IN_PROGRESS)**
- Wysyła maile z odstępami 30-60s (dla 30s delayBetweenEmails)
- Po 10. mailu: pauza 10-15 min
- Po 20. mailu: pauza 10-15 min

### **2. User klika PAUZA**
- Status: IN_PROGRESS → PAUSED
- Maile w kolejce pozostają jako `pending` lub `sending`
- `scheduledAt` pozostaje w przyszłości lub w przeszłości

### **3. User klika WZNÓW (Uruchom)**
- Status: PAUSED → SCHEDULED → IN_PROGRESS
- Co się dzieje z mailem w kolejce?

---

## 🔍 ANALIZA KODU

### **1. Wznowienie kampanii (`POST /api/campaigns/[id]/start`)**

**Lokalizacja:** `app/api/campaigns/[id]/start/route.ts`

```typescript
// Ustaw scheduledAt = now(), status = SCHEDULED
await db.campaign.update({
  where: { id: campaignId },
  data: {
    scheduledAt: new Date(),
    status: "SCHEDULED"
  }
});

// Wywołaj processScheduledCampaign() OD RAZU
await processScheduledCampaign();
```

**Co to robi:**
- ✅ Ustawia `scheduledAt = now()`
- ✅ Zmienia status na `SCHEDULED`
- ✅ Wywołuje `processScheduledCampaign()` (który zmienia status na `IN_PROGRESS`)

**Problem:** ❓ Nie wiemy czy `processScheduledCampaign()` inicjalizuje kolejkę dla kampanii PAUSED

---

### **2. Planowanie następnego maila (`scheduleNextEmailV2`)**

**Lokalizacja:** `campaignEmailQueueV2.ts:485`

```typescript
export async function scheduleNextEmailV2(
  campaignId: number,
  lastSentTime: Date,
  delayBetweenEmails: number
): Promise<number | null> {
  // ✅ Sprawdź czy to 10. mail - jeśli tak, dodaj pauzę
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

**Problem:** ❓ Gdzie jest `lastSentTime`? Jak jest obliczane?

---

### **3. Obliczanie `lastSentTime`**

**Lokalizacja:** `campaignEmailSenderV2.ts:1143`

```typescript
// Po wysłaniu maila:
const { scheduleNextEmailV2 } = await import('./campaignEmailQueueV2');
await scheduleNextEmailV2(
  campaignId,
  new Date(), // ← lastSentTime = now() (czas wysłania)
  campaign.delayBetweenEmails
);
```

**Co to robi:**
- ✅ Po wysłaniu maila, wywołuje `scheduleNextEmailV2()` z `lastSentTime = now()`
- ✅ `scheduleNextEmailV2()` używa `lastSentTime` do obliczenia `nextTime`

**Problem:** ❓ Po wznowieniu, pierwszy mail używa `lastSentTime = now()`, ale powinien używać czasu ostatniego wysłanego maila przed pauzą!

---

### **4. Problem z `lastSentTime` po wznowieniu**

**Scenariusz:**
1. Mail 10 wysłany: 19:35:43
2. Mail 11 zaplanowany na: 19:37:15 (po 10. mailu, normalny odstęp)
3. User klika PAUZA: 19:37:00
4. Mail 11 nie został wysłany (kolejka `pending`, `scheduledAt = 19:37:15`)
5. User klika WZNÓW: 20:22:00
6. Mail 11 jest gotowy (`scheduledAt <= now`)
7. System wysyła mail 11
8. Po wysłaniu, wywołuje `scheduleNextEmailV2(campaignId, new Date(), 30)`
9. `lastSentTime = now()` (20:22:16) ❌
10. `scheduleNextEmailV2()` używa `lastSentTime` do obliczenia `nextTime`
11. `sentCount = 11` (11 maili wysłanych)
12. `11 % 10 !== 0` → nie ma pauzy
13. `nextTime = calculateNextEmailTimeV2(20:22:16, 30)` = 20:22:46 - 20:23:16 (30-60s)

**Problem:** ❌ `lastSentTime` powinien być czasem ostatniego wysłanego maila (19:35:43), nie `now()`!

---

### **5. Poprawne obliczanie `lastSentTime`**

**Lokalizacja:** `campaignEmailSenderV2.ts:1143`

**OBECNY KOD:**
```typescript
await scheduleNextEmailV2(
  campaignId,
  new Date(), // ← BŁĄD: używa czasu wysłania, nie ostatniego maila
  campaign.delayBetweenEmails
);
```

**PRAWIDŁOWY KOD:**
```typescript
// Pobierz czas ostatniego wysłanego maila (z SendLog)
const lastSentLog = await db.sendLog.findFirst({
  where: {
    campaignId,
    status: 'sent'
  },
  orderBy: {
    createdAt: 'desc'
  },
  select: {
    createdAt: true
  }
});

const lastSentTime = lastSentLog ? new Date(lastSentLog.createdAt) : new Date();

await scheduleNextEmailV2(
  campaignId,
  lastSentTime, // ← POPRAWKA: używa czasu ostatniego maila
  campaign.delayBetweenEmails
);
```

**Co to daje:**
- ✅ Po wznowieniu, `lastSentTime = czas ostatniego maila przed pauzą`
- ✅ Odstępy są obliczane od ostatniego maila, nie od czasu wznowienia
- ✅ Pauza co 10 maili działa poprawnie (bo `sentCount` jest liczone od początku)

---

## ❌ PROBLEMY ZNALEZIONE

### **Problem 1: `lastSentTime` używa `now()` zamiast czasu ostatniego maila**

**Lokalizacja:** `campaignEmailSenderV2.ts:1143`

**Efekt:**
- Po wznowieniu, odstępy są obliczane od czasu wznowienia, nie od ostatniego maila
- Jeśli ostatni mail był 2 godziny temu, a wznowiono teraz, to odstęp będzie 30-60s (błędny)

**Rozwiązanie:**
- Pobierz `lastSentTime` z `SendLog` (ostatni wysłany mail)

---

### **Problem 2: Pauza co 10 maili może nie działać po wznowieniu**

**Analiza:**
- `sentCount` jest liczone od początku kampanii (wszystkie wysłane maile)
- Jeśli wysłano 10 maili przed pauzą, a wznowiono po 2 godzinach:
  - `sentCount = 10` (przed wysłaniem 11. maila)
  - `10 % 10 === 0` → powinna być pauza
  - Ale po wysłaniu 11. maila, `sentCount = 11`, `11 % 10 !== 0` → nie ma pauzy

**Wniosek:**
- ✅ Pauza działa poprawnie (sprawdza się PRZED planowaniem następnego maila)
- ✅ `sentCount` jest liczone od początku kampanii (wszystkie maile)

---

### **Problem 3: Gotowe maile po wznowieniu**

**Scenariusz:**
- Mail 11 zaplanowany na: 19:37:15
- User klika PAUZA: 19:37:00
- Mail 11 pozostaje `pending`, `scheduledAt = 19:37:15`
- User klika WZNÓW: 20:22:00
- Mail 11 jest gotowy (`scheduledAt <= now()`)
- System używa logiki dla gotowych maili:
  - `baseDelay = 30s - 30s = 0s`
  - `minDelay = 30s` (fix), `maxDelay = 30s`
  - `correctedTime = 30s`
  - Wysyłka za 30s ✅

**Wniosek:**
- ✅ Gotowe maile po wznowieniu działają poprawnie (używają fix dla 30s)

---

## ✅ CO DZIAŁA POPRAWNIE

1. ✅ **Pauza co 10 maili:** `sentCount` jest liczone od początku kampanii
2. ✅ **Gotowe maile:** Używają fix dla 30s (baseDelay <= 0)
3. ✅ **Status kampanii:** PAUSED → SCHEDULED → IN_PROGRESS działa

---

## ❌ CO NAPRAWIĆ

1. ❌ **`lastSentTime`:** Używa `now()` zamiast czasu ostatniego maila
2. ❓ **Sprawdzenie:** Czy `isWithinSendWindow()` nie nadpisuje pauzy?

---

## 🔧 REKOMENDACJA

**Naprawić `lastSentTime` w `campaignEmailSenderV2.ts:1143`:**

```typescript
// Pobierz czas ostatniego wysłanego maila
const lastSentLog = await db.sendLog.findFirst({
  where: {
    campaignId,
    status: 'sent'
  },
  orderBy: {
    createdAt: 'desc'
  },
  select: {
    createdAt: true
  }
});

const lastSentTime = lastSentLog ? new Date(lastSentLog.createdAt) : new Date();

await scheduleNextEmailV2(
  campaignId,
  lastSentTime, // ← POPRAWKA
  campaign.delayBetweenEmails
);
```

**Co to daje:**
- ✅ Po wznowieniu, odstępy są obliczane od ostatniego maila
- ✅ Pauza co 10 maili działa poprawnie
- ✅ Randomizacja działa poprawnie

