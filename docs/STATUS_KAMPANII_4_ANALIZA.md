# 📊 STATUS KAMPANII 4 - Analiza działania

**Data:** 2025-11-05 19:27:31  
**Status kampanii:** `IN_PROGRESS` ✅

---

## 🎯 PODSTAWOWE INFORMACJE

### **Kampania:**
- **Nazwa:** "Biura nieruchomości PL - ścianki 03.11.25"
- **Okno czasowe:** 19:00 - 23:55 (Pn-Pt)
- **Aktualny czas:** 19:27 ✅ (w oknie czasowym)
- **Odstęp:** 90 sekund
- **Limit dzienny:** 500 maili/dzień

---

## 📈 STATYSTYKI

### **Kolejka (`CampaignEmailQueue`):**
- **Total:** 100 maili
- **Pending:** 14 maili ✅ (gotowe do wysłania)
- **Sending:** 1 mail ⚠️ (zablokowany)
- **Sent:** 22 maile ✅
- **Cancelled:** 63 maile ❌

### **Leady (`CampaignLead`):**
- **Total:** 317 leadów
- **Wysłane (`sent`):** 79 leadów
- **W kolejce (`queued`):** 237 leadów
- **Zaplanowane (`planned`):** 0 leadów

### **Wysłane maile (`SendLog`):**
- **Total wysłanych:** 91 maili
- **Wysłanych dzisiaj:** 0 maili ❌

### **Skrzynki:**
- **Aktywne:** 6 skrzynek
- **Dostępne sloty:** 40, 39, 46, 50, 50 (wszystkie poniżej limitu 50) ✅

---

## ⚠️ PROBLEMY ZNALEZIONE

### **Problem 1: `scheduledAt` jest NULL dla pending maili**

**Fakty:**
- 14 maili ma status `pending`
- Wszystkie mają `scheduledAt = NULL` (puste)
- System szuka maili gdzie `scheduledAt <= now`
- Jeśli `scheduledAt` jest NULL → mail nie jest wybierany ❌

**Przykład:**
```sql
SELECT id, status, scheduledAt FROM CampaignEmailQueue 
WHERE campaignId = 4 AND status = 'pending' LIMIT 1;
-- Wynik: scheduledAt = NULL
```

**Rozwiązanie:**
Należy ustawić `scheduledAt` dla pending maili na aktualny czas lub przyszły czas (zgodnie z harmonogramem).

### **Problem 2: 1 mail zablokowany w statusie `sending`**

**Fakty:**
- 1 mail ma status `sending`
- Może być zablokowany od dłuższego czasu (crash procesu)
- System sprawdza `sendingInProgress > 0` i nie wysyła nowych maili jeśli jest zablokowany

**Rozwiązanie:**
Funkcja `unlockStuckEmails()` powinna odblokować maile starsze niż 10 minut.

---

## 🔄 JAK DZIAŁA OPCJA 4 (powinno działać)

### **Krok 1: Cron co 30 sekund**
```typescript
campaignCronJobV2 = cron.schedule('*/30 * * * * *', async () => {
  await processScheduledEmailsV2();
});
```

### **Krok 2: `processScheduledEmailsV2()`**
1. Odblokuj zablokowane maile (`unlockStuckEmails()`)
2. Migruj kampanie bez kolejki (`migrateCampaignsWithoutQueue()`)
3. Dla każdej kampanii `IN_PROGRESS`:
   - `lockEmailForSending(campaignId)` - szuka maila w kolejce

### **Krok 3: `lockEmailForSending()`**
1. Sprawdza okno czasowe ✅ (19:27 w oknie 19:00-23:55)
2. Pobiera dostępną skrzynkę ✅ (6 skrzynek dostępnych)
3. W transakcji:
   - Sprawdza `sendingInProgress` ⚠️ (jest 1 mail `sending`)
   - Szuka maili gdzie `scheduledAt <= now` ❌ (scheduledAt jest NULL)
   - Atomowo blokuje mail i rezerwuje slot

### **Krok 4: Option 4 - setTimeout**
```typescript
if (timeUntilScheduled <= 0) {
  // Mail gotowy - losowy delay 48-72s
  correctedTime = (90s - 30s) ± 20% = 48-72s
} else {
  // Mail w przyszłości
  correctedTime = timeUntilScheduled
}

setTimeout(() => {
  sendEmailAfterTimeout(...);
}, correctedTime);
```

---

## 🚨 DLACZEGO NIE WYSYŁA?

### **Główny problem: `scheduledAt = NULL`**

System szuka maili:
```typescript
where: {
  campaignId,
  status: 'pending',
  scheduledAt: { lte: now }  // ❌ NULL nie pasuje do lte
}
```

**NULL nie jest <= now** → maile nie są wybierane!

### **Dodatkowy problem: 1 mail zablokowany**

```typescript
const sendingInProgress = await tx.campaignEmailQueue.count({
  where: {
    campaignId,
    status: 'sending'
  }
});

if (sendingInProgress > 0) {
  return null; // ❌ Blokuje wysyłkę
}
```

---

## ✅ CO NAPRAWIĆ

### **1. Ustaw `scheduledAt` dla pending maili**

```sql
-- Ustaw scheduledAt na aktualny czas dla pending maili
UPDATE CampaignEmailQueue 
SET scheduledAt = datetime('now', 'localtime')
WHERE campaignId = 4 
  AND status = 'pending' 
  AND scheduledAt IS NULL;
```

### **2. Odblokuj zablokowany mail**

```sql
-- Odblokuj mail zablokowany dłużej niż 10 minut
UPDATE CampaignEmailQueue 
SET status = 'pending'
WHERE campaignId = 4 
  AND status = 'sending'
  AND datetime(updatedAt, 'localtime') < datetime('now', '-10 minutes', 'localtime');
```

### **3. Sprawdź czy cron działa**

Sprawdź logi serwera:
- `[CRON V2]` - czy cron się uruchamia?
- `[SENDER V2]` - czy próbuje wysyłać?
- `[QUEUE V2]` - czy inicjalizuje kolejkę?

---

## 📊 PODSUMOWANIE

### **Co działa:**
- ✅ Kampania jest `IN_PROGRESS`
- ✅ Jest w oknie czasowym (19:27)
- ✅ Są dostępne skrzynki (6 skrzynek, sloty dostępne)
- ✅ Są maile w kolejce (14 pending)

### **Co nie działa:**
- ❌ `scheduledAt` jest NULL dla pending maili
- ⚠️ 1 mail zablokowany w statusie `sending`
- ❌ Brak wysłanych maili dzisiaj

### **Co naprawić:**
1. Ustaw `scheduledAt` dla pending maili
2. Odblokuj zablokowany mail
3. Sprawdź logi cron

---

## 🔧 SKRYPT NAPRAWCZY

```sql
-- 1. Odblokuj zablokowany mail
UPDATE CampaignEmailQueue 
SET status = 'pending', updatedAt = datetime('now', 'localtime')
WHERE campaignId = 4 
  AND status = 'sending';

-- 2. Ustaw scheduledAt dla pending maili (aktualny czas)
UPDATE CampaignEmailQueue 
SET scheduledAt = datetime('now', 'localtime')
WHERE campaignId = 4 
  AND status = 'pending' 
  AND scheduledAt IS NULL;

-- 3. Sprawdź wynik
SELECT status, COUNT(*) as count, 
       MIN(datetime(scheduledAt, 'localtime')) as next_scheduled
FROM CampaignEmailQueue 
WHERE campaignId = 4 
GROUP BY status;
```

