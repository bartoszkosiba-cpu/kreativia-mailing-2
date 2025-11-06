# 📊 ODPOWIEDŹ: Leady Tomasz Malecki i Tomasz Koszyk

**Data analizy:** 2025-11-05 20:15

---

## ✅ ODpowiedź na pytania

### **1. Czy były w kolejce od 19:20 do wysłania?**

✅ **TAK** - były w kolejce CampaignEmailQueue:

**Tomasz Malecki:**
- Utworzony w kolejce: **2025-11-05 19:19:37**
- Zaplanowany na: **2025-11-05 19:36:44**
- Status: `cancelled` (anulowany o 19:37:50)

**Tomasz Koszyk:**
- Utworzony w kolejce: **2025-11-05 19:19:37**
- Zaplanowany na: **2025-11-05 19:37:59**
- Status: `cancelled` (anulowany o 19:37:50)

---

### **2. Dlaczego nie zostały wysłane?**

❌ **NIE zostały wysłane** - zostały anulowane o 19:37:50, zanim zostały wysłane.

**Przyczyna:**
- Kampania została **zatrzymana/przerzucona na SCHEDULED** o 19:37:50
- System automatycznie anuluje wszystkie pending maile gdy kampania nie jest `IN_PROGRESS`
- Maile były zaplanowane na 19:36:44 i 19:37:59, ale zostały anulowane zanim system je wysłał

**Aktualny status kampanii:** `SCHEDULED` (nie `IN_PROGRESS`)

---

### **3. Co się z nimi stanie dalej?**

✅ **PO WZNOWIENIU KAMPANII:**

1. **Status leadów:**
   - Leady pozostają w statusie `queued` w CampaignLead ✅
   - Maile w CampaignEmailQueue są `cancelled` (ale to nie przeszkadza)

2. **Automatyczne dodanie do kolejki:**
   - Gdy kampania zostanie wznowiona (status → `IN_PROGRESS`), system automatycznie:
     - `migrateCampaignsWithoutQueue()` sprawdzi czy są leady w statusie `queued` bez maili w kolejce
     - `initializeQueueV2()` doda leady do kolejki CampaignEmailQueue
     - `scheduleNextEmailV2()` zaplanuje maile z nowymi czasami

3. **Nowe ustawienia:**
   - Odstępy: **90-180s** (randomizacja 0-100%)
   - Pauza co 10 maili: **10-15 min** (jeśli to będzie 10., 20., 30. mail)

4. **Kolejność:**
   - System znajdzie leady w statusie `queued` według `priority`
   - Doda je do kolejki w odpowiedniej kolejności
   - Zaplanuje zgodnie z nowymi ustawieniami

---

## 🔄 SZczegółowy proces

### **Gdy kampania zostanie wznowiona:**

**Krok 1: Cron uruchamia `processScheduledEmailsV2()`**
```
Cron co 30s → processScheduledEmailsV2()
```

**Krok 2: Automatyczna migracja**
```
migrateCampaignsWithoutQueue()
→ Sprawdza kampanie IN_PROGRESS bez maili w kolejce
→ Jeśli są leady w statusie 'queued' → initializeQueueV2()
```

**Krok 3: Inicjalizacja kolejki**
```
initializeQueueV2(campaignId, bufferSize=20)
→ Pobiera leady w statusie 'queued'
→ Dla każdego leada:
   - Sprawdza czy już otrzymał mail (SendLog)
   - Sprawdza czy już jest w kolejce
   - Jeśli nie → dodaje do CampaignEmailQueue
   - Planuje z randomizacją 0-100% (90-180s)
```

**Krok 4: Planowanie maili**
```
scheduleNextEmailV2(campaignId, lastSentTime, delayBetweenEmails)
→ Sprawdza sentCount % 10 === 0 (pauza co 10 maili)
→ Jeśli pauza → dodaje 10-15 min
→ Jeśli nie → normalny odstęp 90-180s
→ Planuje mail w CampaignEmailQueue
```

**Krok 5: Wysyłka**
```
lockEmailForSending(campaignId)
→ Znajduje mail gotowy (scheduledAt <= now)
→ Uruchamia setTimeout z losowym delayem (60-120s dla gotowych)
→ sendEmailAfterTimeout() wysyła mail
```

---

## ✅ PODSUMOWANIE

### **Czy były w kolejce od 19:20?**
- ✅ **TAK** - były w kolejce od 19:19:37
- ✅ Zaplanowane na 19:36:44 i 19:37:59

### **Dlaczego nie zostały wysłane?**
- ❌ **Kampania została zatrzymana** o 19:37:50
- ❌ System anulował pending maile przed wysłaniem
- ❌ Aktualny status: `SCHEDULED` (nie `IN_PROGRESS`)

### **Co się stanie dalej?**
- ✅ **Po wznowieniu kampanii:**
  - System automatycznie doda leady do kolejki
  - Maile zostaną zaplanowane z nowymi ustawieniami (0-100% randomizacja, pauza co 10 maili)
  - Zostaną wysłane zgodnie z planem

### **Czy trzeba coś zrobić ręcznie?**
- ❌ **NIE** - system automatycznie doda leady do kolejki po wznowieniu
- ✅ Wystarczy wznowić kampanię (status → `IN_PROGRESS`)

---

## 🎯 WNIOSKI

**Leady są gotowe do wysłania:**
- ✅ Status: `queued` w CampaignLead
- ✅ Będą automatycznie dodane do kolejki po wznowieniu kampanii
- ✅ Zostaną wysłane z nowymi ustawieniami (randomizacja 0-100%, pauza co 10 maili)

**Nie ma potrzeby ręcznej interwencji** - system automatycznie obsłuży te leady po wznowieniu kampanii.

