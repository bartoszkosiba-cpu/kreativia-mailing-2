# 📊 ANALIZA KAMPANII 4 - Status i Działanie

**Data analizy:** 2025-11-05 19:27

## 🎯 PODSTAWOWE INFORMACJE

### **Kampania:**
- **ID:** 4
- **Nazwa:** "Biura nieruchomości PL - ścianki 03.11.25"
- **Status:** `IN_PROGRESS` ✅
- **Okno czasowe:** 19:00 - 23:55 (Pn-Pt)
- **Odstęp między mailami:** 90 sekund
- **Limit dzienny:** 500 maili/dzień

### **Aktualny czas:**
- **System:** 19:27:31
- **Czy w oknie czasowym?** ✅ TAK (19:00-23:55)

---

## 📈 STATYSTYKI

### **Leady:**
- **Total:** 317 leadów
- **Wysłane (`sent`):** 79 leadów
- **W kolejce (`queued`):** 237 leadów
- **Zaplanowane (`planned`):** 0 leadów

### **Wysłane maile (SendLog):**
- **Total wysłanych:** 91 maili
- **Wysłanych dzisiaj:** 0 maili ❌
- **Ostatni wysłany:** Brak danych (puste wyniki)

### **Kolejka V2:**
- **Total w kolejce:** 0 maili ❌
- **Status:** Kolejka jest pusta!

### **Skrzynki:**
- **Handlowiec:** ID 1
- **Aktywne skrzynki:** 6 skrzynek

---

## 🔍 ANALIZA PROBLEMU

### **Problem 1: Kolejka V2 jest pusta**
- **Fakty:**
  - 237 leadów ma status `queued` (powinny być w kolejce)
  - Kolejka V2 ma 0 maili
  - Kampania jest `IN_PROGRESS`

- **Możliwe przyczyny:**
  1. Kolejka nie została zainicjalizowana
  2. Maile zostały wysłane i usunięte z kolejki
  3. Maile zostały oznaczone jako `cancelled` lub `sent`

### **Problem 2: Brak wysłanych maili dzisiaj**
- **Fakty:**
  - 0 maili wysłanych dzisiaj
  - Kampania jest `IN_PROGRESS`
  - Jest w oknie czasowym (19:27, okno 19:00-23:55)

- **Możliwe przyczyny:**
  1. Kolejka jest pusta → brak maili do wysłania
  2. Skrzynki osiągnęły limit dzienny
  3. Błąd w procesie wysyłki

---

## 🔄 CO POWINNO SIĘ DZIAĆ (Option 4)

### **Krok po kroku:**

1. **Cron uruchamia się co 30 sekund**
   - `processScheduledEmailsV2()` sprawdza kampanie `IN_PROGRESS`

2. **Dla kampanii 4:**
   - `lockEmailForSending(4)` szuka maila w kolejce
   - Jeśli kolejka pusta → `migrateCampaignsWithoutQueue()` inicjalizuje kolejkę

3. **Jeśli mail znaleziony:**
   - Mail jest blokowany (`status = 'sending'`)
   - Slot skrzynki jest rezerwowany (atomowo)
   - Jeśli mail gotowy (`scheduledAt <= now`):
     - Oblicz `correctedTime = (90s - 30s) ± 20% = 48-72s`
     - Uruchom `setTimeout(..., correctedTime)`
   - Jeśli mail w przyszłości:
     - Użyj `timeUntilScheduled` jako `correctedTime`

4. **Po setTimeout:**
   - `sendEmailAfterTimeout()` wysyła mail
   - Mail oznaczony jako `sent` w kolejce
   - `scheduleNextEmailV2()` planuje następny mail

---

## ✅ CO SPRAWDZIĆ

### **1. Czy kolejka jest inicjalizowana?**
```sql
SELECT COUNT(*) FROM CampaignEmailQueueV2 WHERE campaignId = 4;
```
**Oczekiwany wynik:** > 0 (przynajmniej kilka maili)

### **2. Czy są maile w kolejce z statusem `pending`?**
```sql
SELECT COUNT(*) FROM CampaignEmailQueueV2 
WHERE campaignId = 4 AND status = 'pending';
```

### **3. Czy są maile w kolejce z statusem `sending`?**
```sql
SELECT COUNT(*) FROM CampaignEmailQueueV2 
WHERE campaignId = 4 AND status = 'sending';
```

### **4. Czy skrzynki mają dostępne sloty?**
```sql
SELECT email, currentDailySent, dailyEmailLimit 
FROM Mailbox 
WHERE virtualSalespersonId = 1 AND isActive = 1;
```

### **5. Czy cron działa?**
- Sprawdź logi serwera: `[CRON V2]`, `[SENDER V2]`
- Czy są logi z ostatnich 30 sekund?

---

## 🚨 MOŻLIWE PROBLEMY

### **Problem A: Kolejka nie jest inicjalizowana**
- **Objaw:** Kolejka V2 jest pusta mimo 237 leadów w kolejce
- **Rozwiązanie:** Ręcznie uruchom inicjalizację kolejki

### **Problem B: Skrzynki osiągnęły limit**
- **Objaw:** Skrzynki mają `currentDailySent >= dailyEmailLimit`
- **Rozwiązanie:** Sprawdź limity skrzynek i zresetuj jeśli potrzeba

### **Problem C: Kampania jest poza oknem czasowym**
- **Objaw:** Aktualny czas nie jest w oknie 19:00-23:55
- **Status:** ✅ NIE (jest 19:27, okno 19:00-23:55)

### **Problem D: Cron nie działa**
- **Objaw:** Brak logów `[CRON V2]` w ostatnich minutach
- **Rozwiązanie:** Sprawdź czy cron jest uruchomiony

---

## 📝 NASTĘPNE KROKI

1. **Sprawdź czy kolejka jest inicjalizowana**
2. **Sprawdź logi serwera** (czy cron działa)
3. **Sprawdź limity skrzynek** (czy są dostępne sloty)
4. **Sprawdź ostatnie wysłane maile** (kiedy ostatnio wysłano)

---

## 🔧 NARZĘDZIA DO DEBUGOWANIA

### **Sprawdź kolejkę:**
```sql
SELECT id, status, datetime(scheduledAt, 'localtime') as scheduled, 
       datetime(createdAt, 'localtime') as created
FROM CampaignEmailQueueV2 
WHERE campaignId = 4 
ORDER BY scheduledAt ASC 
LIMIT 20;
```

### **Sprawdź ostatnie wysłane:**
```sql
SELECT datetime(createdAt, 'localtime') as sent_time, toEmail 
FROM SendLog 
WHERE campaignId = 4 AND status = 'sent' 
ORDER BY createdAt DESC 
LIMIT 10;
```

### **Sprawdź limity skrzynek:**
```sql
SELECT email, currentDailySent, dailyEmailLimit,
       (dailyEmailLimit - currentDailySent) as remaining
FROM Mailbox 
WHERE virtualSalespersonId = 1 AND isActive = 1;
```

