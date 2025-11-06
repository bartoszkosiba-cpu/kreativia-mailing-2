# 📊 ANALIZA LEADÓW NIE WYSŁANYCH

**Leady:** Tomasz Malecki, Tomasz Koszyk  
**Data analizy:** 2025-11-05 20:15

---

## 🔍 FAKTY

### **Status w CampaignLead:**
- **Tomasz Malecki:** `queued` ✅ (w kolejce do wysłania)
- **Tomasz Koszyk:** `queued` ✅ (w kolejce do wysłania)

### **Status w CampaignEmailQueue:**
- **Ostatnie wpisy:** `cancelled` ❌
- **Utworzone:** 2025-11-05 19:19:37
- **Zaplanowane:** 
  - Tomasz Malecki: 2025-11-05 19:36:44
  - Tomasz Koszyk: 2025-11-05 19:37:59
- **Anulowane:** 2025-11-05 19:37:50

### **Status w SendLog:**
- **Brak wpisów** ❌ (nie zostały wysłane)

### **Status kampanii:**
- Sprawdzam...

---

## ❓ DLACZEGO NIE ZOSTAŁY WYSŁANE?

### **Możliwe przyczyny:**

1. **Kampania została zatrzymana (PAUSED)**
   - Jeśli kampania została zatrzymana o 19:37:50, system anuluje wszystkie pending maile
   - Maile były zaplanowane na 19:36:44 i 19:37:59, ale zostały anulowane o 19:37:50

2. **Kampania została anulowana (CANCELLED)**
   - System automatycznie anuluje wszystkie pending maile

3. **Błąd w procesie wysyłki**
   - Maile zostały zaplanowane, ale nie zostały wysłane przed anulowaniem

---

## 🔄 CO SIĘ STANIE DALEJ?

### **Jeśli kampania jest PAUSED:**
- ✅ Leady pozostają w statusie `queued` w CampaignLead
- ✅ Maile w CampaignEmailQueue są `cancelled`
- ✅ **Po wznowieniu kampanii:**
  - System automatycznie doda te leady do kolejki (przez `migrateCampaignsWithoutQueue()`)
  - `scheduleNextEmailV2()` znajdzie leady w statusie `queued` i doda je do kolejki
  - Maile zostaną zaplanowane z nowymi czasami (z uwzględnieniem randomizacji 0-100% i pauzy co 10 maili)

### **Jeśli kampania jest IN_PROGRESS:**
- ✅ System automatycznie doda leady do kolejki (przez `migrateCampaignsWithoutQueue()`)
- ✅ Maile zostaną zaplanowane i wysłane

### **Jeśli kampania jest CANCELLED:**
- ❌ Leady pozostaną w statusie `queued`, ale nie będą wysłane
- ❌ System nie doda ich do kolejki

---

## ✅ WNIOSKI

### **Czy były w kolejce od 19:20?**
- ✅ **TAK** - były w kolejce CampaignEmailQueue od 19:19:37
- ✅ Zaplanowane na 19:36:44 i 19:37:59
- ❌ **NIE zostały wysłane** - anulowane o 19:37:50

### **Dlaczego nie zostały wysłane?**
- ⚠️ **Prawdopodobnie kampania została zatrzymana** przed wysłaniem
- System automatycznie anuluje pending maile gdy kampania jest PAUSED/CANCELLED

### **Co się stanie dalej?**
- ✅ **Po wznowieniu kampanii:**
  - System automatycznie doda te leady do kolejki
  - Maile zostaną zaplanowane z nowymi czasami
  - Zostaną wysłane zgodnie z nowymi ustawieniami (randomizacja 0-100%, pauza co 10 maili)

---

## 🔧 JAK SPRAWDZIĆ

### **1. Sprawdź status kampanii:**
```sql
SELECT status FROM Campaign WHERE id = 4;
```

### **2. Sprawdź czy są leady w kolejce:**
```sql
SELECT COUNT(*) FROM CampaignLead 
WHERE campaignId = 4 AND status = 'queued';
```

### **3. Sprawdź czy system doda je do kolejki:**
- Po wznowieniu kampanii, `migrateCampaignsWithoutQueue()` automatycznie doda leady do kolejki
- `scheduleNextEmailV2()` znajdzie leady w statusie `queued` i zaplanuje maile

---

## 📝 REKOMENDACJA

**Jeśli kampania jest PAUSED:**
1. ✅ Wznow kampanię (status → IN_PROGRESS)
2. ✅ System automatycznie doda leady do kolejki
3. ✅ Maile zostaną zaplanowane i wysłane

**Jeśli kampania jest IN_PROGRESS:**
1. ✅ System automatycznie doda leady do kolejki (przez `migrateCampaignsWithoutQueue()`)
2. ✅ Maile zostaną zaplanowane i wysłane

**Jeśli chcesz ręcznie dodać do kolejki:**
- Możesz użyć API `/api/campaigns/4/reinit-queue` (jeśli istnieje)

