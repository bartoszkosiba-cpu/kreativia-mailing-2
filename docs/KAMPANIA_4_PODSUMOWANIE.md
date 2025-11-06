# 📊 KAMPANIA 4 - Podsumowanie działania

**Data analizy:** 2025-11-05 19:32:37  
**Status:** `IN_PROGRESS` ✅

---

## ✅ CO DZIAŁA

### **1. Kampania jest aktywna**
- Status: `IN_PROGRESS` ✅
- Okno czasowe: 19:00-23:55 ✅
- Aktualny czas: 19:32 (w oknie) ✅

### **2. Są maile w kolejce**
- 14 maili `pending` ✅
- 1 mail `sending` (zablokowany) ⚠️
- 22 maile `sent` ✅

### **3. Są dostępne skrzynki**
- 6 aktywnych skrzynek ✅
- Wszystkie mają dostępne sloty (40, 39, 46, 50, 50) ✅
- Limity nie są przekroczone ✅

### **4. Maile są zaplanowane**
- `scheduledAt` jest ustawiony (timestamp w milisekundach) ✅
- Maile są planowane w przyszłości (19:32, 19:33, 19:35) ✅

---

## ⚠️ PROBLEMY

### **Problem 1: Maile są planowane w przyszłości**

**Fakty:**
- Mail 534: `scheduledAt = 2025-11-05 19:32:03` (był gotowy o 19:32:03)
- Mail 535: `scheduledAt = 2025-11-05 19:33:19` (za ~1 minutę)
- Mail 536: `scheduledAt = 2025-11-05 19:35:01` (za ~2 minuty)
- Teraz: 19:32:37

**Analiza:**
- Mail 534 był gotowy o 19:32:03, ale teraz jest 19:32:37 → powinien być wysłany
- System szuka maili gdzie `scheduledAt <= now`
- Prisma porównuje `Date` z `Date`, więc powinno działać

**Możliwe przyczyny:**
1. Mail 534 został już wysłany (ale nie widać w SendLog?)
2. `lockEmailForSending` nie znajduje maila (inny problem?)
3. Mail 531 w statusie `sending` blokuje wysyłkę (`sendingInProgress > 0`)

### **Problem 2: 1 mail zablokowany**

**Fakty:**
- Mail 531 ma status `sending`
- `updatedAt` jest NULL (może być problem)
- `unlockStuckEmails()` powinien odblokować maile starsze niż 10 minut

**Rozwiązanie:**
```sql
-- Odblokuj zablokowany mail
UPDATE CampaignEmailQueue 
SET status = 'pending'
WHERE campaignId = 4 
  AND status = 'sending';
```

### **Problem 3: Brak wysłanych maili dzisiaj**

**Fakty:**
- 0 maili wysłanych dzisiaj (5.11.2025)
- Ostatni wysłany mail: brak danych (puste wyniki)

**Możliwe przyczyny:**
1. Kolejka była pusta wcześniej
2. Maile są planowane w przyszłości
3. System nie wysyła z powodu zablokowanego maila

---

## 🔄 JAK DZIAŁA OPCJA 4 (powinno działać)

### **Krok 1: Cron co 30 sekund**
```
Cron uruchamia się co 30 sekund
→ processScheduledEmailsV2()
```

### **Krok 2: Odblokuj zablokowane maile**
```
unlockStuckEmails()
→ Odblokuj maile w statusie 'sending' starsze niż 10 minut
```

### **Krok 3: Dla kampanii 4**
```
lockEmailForSending(4)
→ Sprawdza okno czasowe ✅
→ Pobiera dostępną skrzynkę ✅
→ W transakcji:
   - Sprawdza sendingInProgress ⚠️ (jest 1 mail 'sending')
   - Szuka maili gdzie scheduledAt <= now
   - Jeśli sendingInProgress > 0 → return null ❌
```

### **Krok 4: Option 4 - setTimeout**
```
Jeśli mail znaleziony:
  if (scheduledAt <= now):
    correctedTime = (90s - 30s) ± 20% = 48-72s
  else:
    correctedTime = timeUntilScheduled
  
  setTimeout(() => {
    sendEmailAfterTimeout(...);
  }, correctedTime);
```

---

## 🚨 DLACZEGO NIE WYSYŁA?

### **Główny problem: Mail zablokowany**

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

**Mail 531 w statusie `sending` blokuje całą kampanię!**

---

## ✅ CO NAPRAWIĆ

### **1. Odblokuj zablokowany mail**

```sql
-- Odblokuj mail zablokowany
UPDATE CampaignEmailQueue 
SET status = 'pending', updatedAt = datetime('now', 'localtime')
WHERE campaignId = 4 
  AND status = 'sending';
```

### **2. Sprawdź czy cron działa**

Sprawdź logi serwera:
- `[CRON V2]` - czy cron się uruchamia?
- `[SENDER V2]` - czy próbuje wysyłać?
- `[SENDER V2] 🔓 Odblokowano` - czy odblokowuje maile?

### **3. Sprawdź czy maile są gotowe**

```sql
-- Sprawdź maile gotowe do wysłania
SELECT id, datetime(scheduledAt/1000, 'unixepoch', 'localtime') as scheduled,
       datetime('now', 'localtime') as now,
       CASE WHEN scheduledAt <= strftime('%s', 'now') * 1000 THEN 'READY' ELSE 'FUTURE' END as status
FROM CampaignEmailQueue 
WHERE campaignId = 4 
  AND status = 'pending'
ORDER BY scheduledAt ASC
LIMIT 5;
```

---

## 📊 PODSUMOWANIE

### **Co działa:**
- ✅ Kampania jest `IN_PROGRESS`
- ✅ Jest w oknie czasowym
- ✅ Są dostępne skrzynki
- ✅ Są maile w kolejce (14 pending)
- ✅ Maile są zaplanowane (scheduledAt ustawiony)

### **Co nie działa:**
- ❌ 1 mail zablokowany w statusie `sending` → blokuje całą kampanię
- ❌ Brak wysłanych maili dzisiaj
- ⚠️ Maile są planowane w przyszłości (ale to jest OK)

### **Co naprawić:**
1. **Odblokuj zablokowany mail** (główny problem)
2. Sprawdź logi cron
3. Sprawdź czy maile są gotowe do wysłania

---

## 🔧 SKRYPT NAPRAWCZY

```sql
-- 1. Odblokuj zablokowany mail (GŁÓWNY PROBLEM)
UPDATE CampaignEmailQueue 
SET status = 'pending', updatedAt = datetime('now', 'localtime')
WHERE campaignId = 4 
  AND status = 'sending';

-- 2. Sprawdź wynik
SELECT status, COUNT(*) as count
FROM CampaignEmailQueue 
WHERE campaignId = 4 
GROUP BY status;

-- 3. Sprawdź maile gotowe do wysłania
SELECT id, datetime(scheduledAt/1000, 'unixepoch', 'localtime') as scheduled,
       CASE WHEN scheduledAt <= strftime('%s', 'now') * 1000 THEN 'READY' ELSE 'FUTURE' END as status
FROM CampaignEmailQueue 
WHERE campaignId = 4 
  AND status = 'pending'
ORDER BY scheduledAt ASC
LIMIT 5;
```

---

## ✅ PO NAPRAWIE

Po odblokowaniu maila, system powinien:
1. Cron uruchomi się co 30 sekund
2. `unlockStuckEmails()` odblokuje zablokowane maile
3. `lockEmailForSending(4)` znajdzie mail gotowy (`scheduledAt <= now`)
4. Uruchomi `setTimeout` z losowym delayem (48-72s)
5. `sendEmailAfterTimeout()` wyśle mail
6. System zaplanuje następny mail

**Oczekiwany wynik:** Maile będą wysyłane co ~48-72 sekundy (z randomizacją).

