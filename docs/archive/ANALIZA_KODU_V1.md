# 📋 ANALIZA POZOSTAŁEGO KODU V1

## ✅ **WSZYSTKIE KOD V1 DZIAŁAJĄ RÓWNOLEGLE Z V2**

### **Status:** ⚠️ **V1 NADAL DZIAŁA - RÓWNOLEGLE Z V2**

---

## 1. 📁 **PLIKI V1 KTÓRE ISTNIEJĄ:**

### ✅ **AKTYWNE (Używane przez cron):**
1. **`src/services/campaignEmailSender.ts`** - V1 sender
   - Funkcja: `sendScheduledCampaignEmails()`
   - Używana przez: `emailCron.ts` (linia 151-152)
   - Cron: co 1 minutę (linia 137-188)

2. **`src/services/campaignEmailQueue.ts`** - V1 queue
   - Funkcje: `scheduleNextEmail()`, `initializeCampaignQueue()`, `cancelCampaignQueue()`
   - Używana przez: `campaignEmailSender.ts`, `app/api/campaigns/[id]/start/route.ts` (linia 210)

3. **`src/services/scheduledSender.ts`** - V1 scheduled sender
   - Funkcja: `processScheduledCampaign()` - **NIE JEST UŻYWANA** (importowana ale nie wywoływana)
   - Funkcja: `sendSingleEmail()` - używana przez V2!

### ⚠️ **NIEAKTYWNE (Importowane ale nie wywoływane):**
4. **`processScheduledCampaign()`** z `scheduledSender.ts`
   - Importowany w: `emailCron.ts` (linia 5), `app/api/campaigns/[id]/start/route.ts` (linia 4)
   - **NIE JEST WYWOŁYWANY** - martwy kod

---

## 2. 🔄 **CRONY V1 I V2:**

### **V1 CRON (AKTYWNY):**
```typescript
// emailCron.ts linia 137-188
campaignCronJob = cron.schedule('*/1 * * * *', async () => {
  const { sendScheduledCampaignEmails } = await import('./campaignEmailSender');
  const result = await sendScheduledCampaignEmails(); // V1!
  // ...
});
```

### **V2 CRON (AKTYWNY):**
```typescript
// emailCron.ts linia 197-228
campaignCronJobV2 = cron.schedule('*/30 * * * * *', async () => {
  const result = await processScheduledEmailsV2(); // V2!
  // ...
});
```

**Status:** ✅ **OBA CRONY DZIAŁAJĄ RÓWNOLEGLE**

---

## 3. 📊 **UŻYWANIE:**

### **V1 jest używany przez:**
- ✅ Cron co 1 minutę (`sendScheduledCampaignEmails`)
- ✅ `app/api/campaigns/[id]/start/route.ts` - `cancelCampaignQueue()` (linia 210)

### **V2 jest używany przez:**
- ✅ Cron co 30 sekund (`processScheduledEmailsV2`)
- ✅ `app/api/campaigns/[id]/start/route.ts` - `initializeQueueV2()` (linia 136)

---

## 4. ⚠️ **PROBLEMY:**

### **Problem 1: Duplikacja - Oba systemy działają równolegle**
- V1 może wysyłać maile z `CampaignEmailQueue` (V1)
- V2 wysyła maile z `CampaignEmailQueue` (V2)
- **Ryzyko:** Konflikt jeśli kampania ma maile w obu kolejkach

### **Problem 2: Martwy kod**
- `processScheduledCampaign()` jest importowany ale **NIGDY nie wywoływany**
- Można usunąć

### **Problem 3: Backward compatibility**
- Komentarz w `emailCron.ts` (linia 231-233): "TODO: Usuń po pełnej migracji do V2"
- Ale V1 nadal działa!

---

## 5. 💡 **REKOMENDACJE:**

### **Opcja A: Usuń V1 całkowicie (jeśli wszystkie kampanie są w V2)**
1. ✅ Sprawdź czy wszystkie kampanie używają V2
2. ✅ Usuń cron V1
3. ✅ Usuń `campaignEmailSender.ts` (V1)
4. ✅ Usuń `campaignEmailQueue.ts` (V1) - **UWAGA:** `cancelCampaignQueue()` jest używany w `start/route.ts`
5. ✅ Usuń `processScheduledCampaign()` z `scheduledSender.ts`
6. ✅ Zastąp `cancelCampaignQueue()` w `start/route.ts` funkcją V2

### **Opcja B: Wyłącz V1 (bezpieczne)**
1. ✅ Zakomentuj cron V1
2. ✅ Zostaw kod V1 (na wypadek rollback)
3. ✅ Monitoruj czy V2 działa poprawnie
4. ✅ Po weryfikacji usuń V1

### **Opcja C: Migruj wszystkie kampanie do V2**
1. ✅ Sprawdź które kampanie używają V1
2. ✅ Migruj je do V2
3. ✅ Wyłącz V1
4. ✅ Po weryfikacji usuń V1

---

## 6. 📋 **CHECKLIST PRZED USUNIĘCIEM V1:**

- [ ] Sprawdź czy wszystkie kampanie mają kolejkę V2
- [ ] Sprawdź czy V2 działa poprawnie dla wszystkich kampanii
- [ ] Zastąp `cancelCampaignQueue()` w `start/route.ts` funkcją V2
- [ ] Wyłącz cron V1
- [ ] Monitoruj przez kilka dni
- [ ] Usuń kod V1

---

## 7. 🔍 **SPRAWDZENIE:**

```bash
# Sprawdź czy kampanie mają maile w kolejce V1
SELECT COUNT(*) FROM CampaignEmailQueue WHERE status IN ('pending', 'sending');

# Sprawdź czy kampanie mają maile w kolejce V2
SELECT COUNT(*) FROM CampaignEmailQueue WHERE status IN ('pending', 'sending');
```

**Jeśli V1 ma 0 maili** → można bezpiecznie wyłączyć V1

