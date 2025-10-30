# FLOW HARMONOGRAM - Jak Działa System Wysyłki Kampanii 🔄

## 📋 KAMPANIA #4 - ANALIZA KROK PO KROKU

### Aktualny Stan Kampanii:
- Status: `SCHEDULED`
- scheduledAt: `2025-10-26 16:53:32` (przeszłość)
- allowedDays: `SUN` (niedziela)
- startHour: `9`
- endHour: `23`
- delayBetweenEmails: `30` sekund
- maxEmailsPerHour: `40`

### Dziś (26.10.2025 18:13):
- Dzień tygodnia: Niedziela (SUN) ✅
- Godzina: 18:13 ✅ (w oknie 9-23)
- scheduledAt < teraz ✅ (16:53 < 18:13)

---

## 🔄 CO DZIEJE SIĘ W SYSTEMIE (krok po kroku):

### KROK 1: CRON sprawdza co 5 minut

```typescript
// src/services/emailCron.ts (linia 132-148)
campaignCronJob = cron.schedule('*/5 * * * *', async () => {
  console.log('[CRON] 📧 Sprawdzam zaplanowane kampanie...');
  await processScheduledCampaign();  // ← TUTAJ
});
```

**Cron syntax:** `*/5 * * * *` = co 5 minut (00:00, 00:05, 00:10, 00:15, etc.)

---

### KROK 2: `processScheduledCampaign()` szuka kampanii

```typescript
// src/services/scheduledSender.ts (linia 72-80)
export async function processScheduledCampaign(): Promise<void> {
  console.log('[SCHEDULED SENDER] Sprawdzam zaplanowane kampanie...');
  
  const campaign = await getNextScheduledCampaign();  // ← Pobiera kampanię
  
  if (!campaign) {
    console.log('[SCHEDULED SENDER] Brak zaplanowanych kampanii');
    return;  // KONIEC - brak kampanii do wysłania
  }
```

---

### KROK 3: `getNextScheduledCampaign()` filtruje kampanie

```typescript
// src/services/campaignScheduler.ts (linia 134-150)
export async function getNextScheduledCampaign() {
  const now = new Date();
  
  return await db.campaign.findFirst({
    where: {
      OR: [
        {
          status: "SCHEDULED",        // ← Twoja kampania TUTAJ ✅
          scheduledAt: { lte: now }  // ← 16:53 <= 18:13 ✅
        },
        {
          status: "IN_PROGRESS"      // ← Albo ta w trakcie
        }
      ]
    },
    orderBy: [
      { status: "desc" },
      { scheduledAt: "asc" }
    ]
  });
}
```

**Warunki dla Twojej kampanii:**
- ✅ `status = "SCHEDULED"` → spełnione
- ✅ `scheduledAt <= teraz` → 16:53 <= 18:13 → spełnione
- **Kampania ZOSTANIE ZNALEZIONA** ✅

---

### KROK 4: Walidacja okna czasowego

```typescript
// src/services/scheduledSender.ts (linia 88-102)
// Sprawdź czy teraz jest dobry moment na wysyłkę
const now = new Date();  // np. 18:13, niedziela
const validation = await isValidSendTime(
  now,                  // 18:13
  allowedDays,         // ["SUN"]
  campaign.startHour,  // 9
  campaign.endHour,    // 23
  campaign.respectHolidays,
  targetCountries
);

if (!validation.isValid) {
  console.log(`[SCHEDULED SENDER] Teraz nie jest dobry moment: ${validation.reason}`);
  return;  // ← ZATRZYMANIE - nie jest dobry moment
}
```

**Sprawdzenie `isValidSendTime()`:**

#### 1️⃣ Sprawdź dzień tygodnia
```typescript
const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const dayName = dayNames[date.getDay()];  // SUN (niedziela)

if (!allowedDays.includes(dayName)) {
  return { isValid: false, reason: "Niedozwolony dzień" };
}
// SUN jest w ["SUN"] → OK ✅
```

#### 2️⃣ Sprawdź godziny
```typescript
const hour = date.getHours();  // 18
if (hour < startHour || hour >= endHour) {
  return { isValid: false, reason: "Poza oknem czasowym" };
}
// 18 >= 9 && 18 < 23 → OK ✅
```

#### 3️⃣ Sprawdź święta
```typescript
if (respectHolidays && targetCountries.length > 0) {
  const isHol = await isHoliday(date, targetCountries);
  if (isHol) {
    return { isValid: false, reason: "Święto" };
  }
}
// targetCountries puste lub nie święto → OK ✅
```

**WYNIK:** `isValid = true` → kampania może startować! ✅

---

### KROK 5: Zmiana statusu na IN_PROGRESS

```typescript
// src/services/scheduledSender.ts (linia 104-111)
await db.campaign.update({
  where: { id: campaign.id },
  data: {
    status: "IN_PROGRESS",
    sendingStartedAt: now
  }
});

console.log(`[SCHEDULED SENDER] ✓ Rozpoczynam wysyłkę kampanii ${campaign.name}`);
```

**Status:** `SCHEDULED` → `IN_PROGRESS` ✅

---

### KROK 6: Pętla wysyłki

```typescript
// src/services/scheduledSender.ts (linia 129-211)
for (let i = 0; i < leads.length; i++) {
  const lead = leads[i];
  
  // Sprawdź czy mail już wysłany
  const alreadySent = await db.sendLog.findFirst({
    where: {
      campaignId: campaign.id,
      leadId: lead.id,
      status: "sent"
    }
  });
  
  if (alreadySent) {
    continue;  // Pomiń duplikaty
  }
  
  // Sprawdź czy nadal w oknie czasowym (co każdy mail!)
  const checkTime = new Date();
  const timeCheck = await isValidSendTime(...);
  
  if (!timeCheck.isValid) {
    // Koniec okna czasowego! Pauza, wznowi jutro
    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "SCHEDULED" }
    });
    break;
  }
  
  // Wysyłaj mail
  const result = await sendSingleEmail(campaign, lead, companySettings);
  
  // Czekaj 30s przed następnym
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

**Co się dzieje:**
- Mail #1 → Czekaj 30s
- Mail #2 → Czekaj 30s
- ...
- Mail #48 → DONE

**Czas trwania:** 48 leadów × 30s = 1440s = **24 minuty** ✅

---

## ❓ DLACZEGO TWOJA KAMPANIA NIE STARTUJE?

### Sprawdź co się dzieje:

1. **Czy aplikacja działa?**
   ```bash
   ps aux | grep "node.*next"
   ```

2. **Czy cron został uruchomiony?**
   
   W konsoli powinno być:
   ```
   [CRON] ✓ Campaign cron uruchomiony (sprawdzanie co 5 minut)
   ```

3. **Czy są logi sprawdzania kampanii?**
   
   Powinny się pojawić co 5 minut:
   ```
   [CRON] 📧 Sprawdzam zaplanowane kampanie...
   [SCHEDULED SENDER] Sprawdzam zaplanowane kampanie...
   ```

### Możliwe przyczyny:

#### A) **Aplikacja nie działa**
```bash
# Sprawdź
cd "Kreativia Mailing 2"
npm run dev
```

#### B) **Cron nie został uruchomiony**
Cron uruchamia się w `src/services/startCron.ts` przy starcie aplikacji:
```typescript
import '@/services/startCron'; // ← To importuje w app/api/cron/status/route.ts
```

#### C) **Kampania została znaleziona ale odrzucona**
Jeśli są logi:
```
[SCHEDULED SENDER] Znaleziono kampanię: Kampania taniny 1
[SCHEDULED SENDER] Teraz nie jest dobry moment: [przyczyna]
```

To znaczy że `isValidSendTime()` zwróciła `false` (ale w Twoim przypadku Wszystko OK ✅).

---

## ✅ CO MUSI SIĘ STĄD DZIEJE:

1. **Cron sprawdza co 5 minut** → `[CRON] 📧 Sprawdzam...`
2. **Znajduje Twoją kampanię** → `[SCHEDULED SENDER] Znaleziono kampanię: Kampania taniny 1`
3. **Walidacja OK** (SUN, 9-23, godzina 18:13) → `isValid = true`
4. **Zmiana statusu** → `SCHEDULED` → `IN_PROGRESS`
5. **Start wysyłki** → `[SCHEDULED SENDER] ✓ Rozpoczynam wysyłkę...`
6. **Wysyłka 48 maili** po 30s każdy (24 minuty)
7. **Koniec** → status `COMPLETED`

---

## 🎯 TEST: JAK SPRAWDZIĆ CZY SYSTEM DZIAŁA

### 1. Sprawdź czy aplikacja działa:
```bash
curl http://localhost:3000/api/cron/status
```

### 2. Sprawdź logi:
```bash
# Terminal gdzie działa npm run dev
# Powinieneś widzieć co 5 minut:
[CRON] 📧 Sprawdzam zaplanowane kampanie...
[SCHEDULED SENDER] Sprawdzam zaplanowane kampanie...
[SCHEDULED SENDER] Brak zaplanowanych kampanii  # ← Jeśli cron działa ale nie ma kampanii
```

### 3. Sprawdź status w bazie:
```bash
sqlite3 prisma/dev.db "SELECT status, sendingStartedAt FROM Campaign WHERE id = 4;"
```

Jeśli `sendingStartedAt` zmieni się na timestamp → **kampania wystartowała!** ✅

---

## 📝 PODSUMOWANIE FLOW:

```
CRON (co 5 min)
  ↓
processScheduledCampaign()
  ↓
getNextScheduledCampaign() → znajdź kampanię
  ↓ (znaleziono kampanię #4)
isValidSendTime() → waliduj okno czasowe
  ↓ (OK: SUN, 9-23, godzina 18:13)
Zmiana statusu: SCHEDULED → IN_PROGRESS
  ↓
Wysyłka maili (pętla)
  ↓ (co każdy mail)
isValidSendTime() → czy nadal w oknie?
  ↓ (jeśli NIE → pauza, wznowi jutro)
Zmiana statusu: IN_PROGRESS → COMPLETED
```

---

**Data:** 2025-10-26 18:13  
**Status kampanii #4:** SCHEDULED (oczekuje na cron)


