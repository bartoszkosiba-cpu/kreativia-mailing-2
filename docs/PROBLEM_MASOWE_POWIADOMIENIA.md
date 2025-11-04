# 🔍 ANALIZA PROBLEMU: MASOWE POWIADOMIENIA

## ❌ CO SIĘ STAŁO?

### **Problem: Pętla błędów w `migrateCampaignsWithoutQueue()`**

**Sekwencja zdarzeń:**

1. **Cron V2 działa co 30 sekund** (`processScheduledEmailsV2()`)
   - Wywoływany przez `campaignCronJobV2` w `emailCron.ts` (linia 197)
   - Wzorzec: `*/30 * * * * *` = co 30 sekund

2. **W każdym cyklu cron wywołuje `migrateCampaignsWithoutQueue()`** (linia 751)
   - Sprawdza kampanie `IN_PROGRESS` które nie mają maili w kolejce
   - Dla każdej takiej kampanii wywołuje `initializeQueueV2()`

3. **Problem: SQLite Timeout przy `initializeQueueV2()`**
   - Kampania 4 (lub inna) jest `IN_PROGRESS`
   - Próbuje dodać 20 maili do kolejki (bufferSize = 20)
   - SQLite timeout przy operacji `db.campaignEmailQueue.create()` (linia 244)
   - Błąd: `Operations timed out after N/A`

4. **Błąd jest logowany wielokrotnie:**
   ```typescript
   // W initializeQueueV2() - linia 269
   console.error(`[QUEUE V2] ❌ Błąd inicjalizacji kolejki:`, error.message);
   
   // W migrateCampaignsWithoutQueue() - linia 693 (przed poprawką)
   console.error(`[SENDER V2] ❌ Błąd migracji kampanii ${campaign.id}: ${migrationError.message}`);
   ```

5. **Pętla:**
   - 30 sekund później → znowu próba migracji → znowu błąd → znowu logi
   - 30 sekund później → znowu próba migracji → znowu błąd → znowu logi
   - **Setki razy w ciągu godziny!**

---

## 📊 PRZYKŁADOWY PRZEPŁYW

```
00:00:00 - Cron V2 start
00:00:00 - migrateCampaignsWithoutQueue() → Znaleziono kampanię 4 bez kolejki
00:00:00 - initializeQueueV2(4) → SQLite timeout ❌
00:00:00 - console.error("[QUEUE V2] ❌ Błąd...")
00:00:00 - console.error("[SENDER V2] ❌ Błąd migracji...")

00:00:30 - Cron V2 start (ponownie)
00:00:30 - migrateCampaignsWithoutQueue() → Znaleziono kampanię 4 bez kolejki (znowu!)
00:00:30 - initializeQueueV2(4) → SQLite timeout ❌ (znowu!)
00:00:30 - console.error("[QUEUE V2] ❌ Błąd...") (znowu!)
00:00:30 - console.error("[SENDER V2] ❌ Błąd migracji...") (znowu!)

00:01:00 - Cron V2 start (ponownie)
00:01:00 - migrateCampaignsWithoutQueue() → Znaleziono kampanię 4 bez kolejki (znowu!)
00:01:00 - initializeQueueV2(4) → SQLite timeout ❌ (znowu!)
...i tak dalej...

W ciągu 1 godziny = 120 wywołań cron = 120 błędów = SETKI POWIADOMIEŃ!
```

---

## ✅ ROZWIĄZANIE (Zaimplementowane)

### **Zabezpieczenie przed spamem błędów:**

1. **Mapa błędów migracji:**
   ```typescript
   const failedMigrationAttempts = new Map<number, number>();
   // campaignId -> timestamp ostatniego błędu
   ```

2. **Sprawdzanie przed próbą migracji:**
   ```typescript
   const lastFailedAttempt = failedMigrationAttempts.get(campaign.id);
   if (lastFailedAttempt && (now - lastFailedAttempt) < MIGRATION_RETRY_DELAY) {
     // Pomiń - już próbowaliśmy i był błąd (nie spamuj logów)
     continue;
   }
   ```

3. **Zapisywanie błędu:**
   ```typescript
   catch (migrationError: any) {
     failedMigrationAttempts.set(campaign.id, now); // Zapisz timestamp
     console.error(`[SENDER V2] ❌ Błąd migracji...`);
   }
   ```

4. **Czyszczenie po sukcesie:**
   ```typescript
   if (added > 0) {
     failedMigrationAttempts.delete(campaign.id); // Usuń z listy błędów
   }
   ```

---

## 🎯 EFEKT

**PRZED poprawką:**
- Kampania z błędem → próba co 30s → 120 błędów/godzinę → **SETKI POWIADOMIEŃ**

**PO poprawce:**
- Kampania z błędem → próba → błąd → zapis w mapie → **pomijana przez 1h** → tylko **1 błąd/godzinę**

---

## 📝 DLACZEGO SQLite TIMEOUT?

**Możliwe przyczyny:**

1. **Duża ilość danych:**
   - Kampania ma 371 leadów w kolejce (campaign 3)
   - `initializeQueueV2()` próbuje dodać 20 maili
   - Operacja `db.campaignEmailQueue.create()` dla każdego maila
   - SQLite może być wolne przy dużej ilości danych

2. **Złożone zapytania:**
   - `initializeQueueV2()` wykonuje wiele zapytań:
     - `db.campaign.findUnique()` (z include)
     - `db.sendLog.findMany()` (dla wszystkich wysłanych maili)
     - `db.campaignEmailQueue.findMany()` (dla istniejących maili w kolejce)
     - `db.campaignLead.findMany()` (dla wszystkich leadów)
     - `db.campaignEmailQueue.create()` (dla każdego maila w pętli)

3. **SQLite limitations:**
   - SQLite może być wolne przy dużych operacjach
   - Brak optymalizacji indeksów
   - Możliwe lock contention

---

## 🔧 MOŻLIWE DALSZE POPRAWKI

1. **Batch inserts zamiast pojedynczych `create()`:**
   ```typescript
   await db.campaignEmailQueue.createMany({
     data: queueItems.map(item => ({ ... }))
   });
   ```

2. **Zwiększenie timeoutu SQLite:**
   ```typescript
   // W prisma/schema.prisma lub connection string
   ?timeout=30000
   ```

3. **Optymalizacja zapytań:**
   - Użycie `select` zamiast `include` (tylko potrzebne pola)
   - Paginacja dla dużych zbiorów danych

4. **Dodanie indeksów:**
   ```sql
   CREATE INDEX idx_campaign_email_queue_campaign_status 
   ON CampaignEmailQueue(campaignId, status);
   ```

---

## ✅ OBECNY STAN

- ✅ Zabezpieczenie przed spamem błędów (1h cooldown)
- ✅ Lepsze logowanie błędów
- ⚠️ SQLite timeout nadal może występować (ale tylko raz na godzinę)

