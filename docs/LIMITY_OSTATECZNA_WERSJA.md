# Limity Kampanii - Ostateczna Wersja (Po Naprawie)

## 📋 **Zasady:**

### **Przypadek 1: Nowa skrzynka, NIE w warmup**
**Status:** `inactive` lub `ready_to_warmup`  
**Limit kampanii:** **STAŁE 10** maili dziennie  
**Źródło:** Stała wartość (do zmiany w kodzie lub ustawieniach)  
**Uwaga:** Dopóki nie włączy warmup, limit = 10

### **Przypadek 2: Gotowa skrzynka (nie nowa)**
**Status:** `ready` (nie w warmup)  
**Limit kampanii:** `mailbox.dailyEmailLimit`  
**Źródło:** Wartość ustawiona na skrzynce (w formularzu)

### **Przypadek 3: Skrzynka W WARMPIE** ✅
**Status:** `warming`  
**Limit kampanii:** `performanceLimits.campaign` z **`/settings/performance`**  
**Limit warmup:** `performanceLimits.warmup` z **`/settings/performance`**  
**Źródło:** `/settings/performance` → Tydzień 1-5 (w zależności od dnia warmup)

**USTAWIANE W:** `/settings/performance` (TYLKO to miejsce!)
- Maile warmup dziennie (między skrzynkami)
- Maile kampanii dziennie

### **Przypadek 4: Zakończyła warmup**
**Status:** `ready` (po warmup)  
**Limit kampanii:** `mailbox.dailyEmailLimit`  
**Źródło:** Wartość ustawiona na skrzynce (może być automatycznie ustawiona po warmup)

---

## 🎯 **Zmiany do wprowadzenia:**

1. ✅ `mailboxManager.ts` - używa `performanceLimits` dla warmup (już tak jest!)
2. ❌ `queueManager.ts` - obecnie używa harmonogramu, powinno używać `performanceLimits`
3. ❌ Harmonogram warmup (`/warmup` → "Ustawienia harmonogramu") - **DO USUNIĘCIA** (duplikacja)
4. ✅ Przypadek 1: Stałe 10 maili dziennie

---

## 🔧 **Do naprawienia:**

### 1. `queueManager.ts:canSendCampaignEmail()`
Obecnie używa: `config.campaignLimit` z harmonogramu  
Powinno używać: `performanceLimits.campaign` z ustawień wydajności

### 2. Usunąć harmonogram warmup
- Usunąć UI: `/warmup` → "Ustawienia harmonogramu"  
- Usunąć API: `/api/warmup/schedule`
- Usunąć pole: `CompanySettings.warmupSchedule`

### 3. Przypadek 1 - stałe 10
- Ustawić stałą wartość 10 dla skrzynek nie w warmup (dopóki nie zaczną warmup)


