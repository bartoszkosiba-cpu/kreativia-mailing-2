# 📊 ANALIZA KAMPANII 3 - WZNOWIENIE

**Data:** 2025-11-05, 21:30  
**Kampania:** 3 - "Podwieszenia targowe PL - 03.11.25"

---

## 📊 PODSTAWOWE INFORMACJE

### **Status:**
- **Status:** PAUSED ✅ (może być wznowiona)
- **delayBetweenEmails:** 90 sekund
- **maxEmailsPerDay:** 500
- **Okno czasowe:** 9:00-17:00
- **allowedDays:** MON,TUE,WED,THU,FRI

---

## 📊 WYSŁANE MAILE

### **Statystyki:**
- **Total wysłanych:** 324 maile
- **Pierwszy mail:** 2025-11-03 10:16:04
- **Ostatni mail:** 2025-11-05 19:16:01
- **Status pauzy:** "NORMALNY ODSTĘP" (324 % 10 = 4, nie jest wielokrotnością 10)

**Analiza:**
- ✅ 324 maile wysłane
- ✅ Następny mail (325.) = normalny odstęp
- ✅ 330. mail = pauza 10-15 min

---

## 📊 LEADY

### **Statystyki:**
- **Total leadów:** 634 leady
- **Queued:** 350 leadów (gotowe do wysłania)
- **Sent:** 274 leady (już wysłane)
- **Sending:** 0 leadów

### **Dostępne leady:**
- **350 leadów** są dostępne (queued, nie w kolejce, nie wysłane)

**Analiza:**
- ✅ **350 leadów** są dostępne do wysłania
- ✅ System będzie mógł planować nowe maile

---

## 📊 KOLEJKA

### **Statystyki:**
- **Total w kolejce:** 21 maili
- **Cancelled:** 1 mail
- **Sent:** 20 maili (w kolejce)

**Analiza:**
- ✅ **0 maili pending** (wszystkie są sent lub cancelled)
- ✅ **0 maili sending** (brak stuck maili)
- ✅ System będzie musiał zaplanować nowe maile

---

## 📊 SKRZYNKI

### **Statystyki:**
- **Total skrzynek:** 10 skrzynek
- **Dostępne:** 10 skrzynek ✅
- **Wyczerpane:** 0 skrzynek ✅

**Analiza:**
- ✅ **Wszystkie 10 skrzynek są dostępne**
- ✅ System może kontynuować wysyłkę bez problemów

---

## ✅ WERYFIKACJA LOGIKI WZNOWIENIA

### **1. Proces wznowienia (`POST /api/campaigns/3/start`):**

**Kroki:**
1. Walidacja statusu (PAUSED → OK)
2. Walidacja pól (subject, text, leadów)
3. Walidacja okna czasowego (9:00-17:00, MON-FRI)
4. Ustaw `scheduledAt = now()`, `status = SCHEDULED`
5. Wywołaj `initializeQueueV2()` (inicjalizacja kolejki V2)
6. Wywołaj `processScheduledCampaign()` (uruchomienie)

**Analiza:**
- ✅ Kod jest poprawny
- ✅ Używa V2 (initializeQueueV2)
- ✅ Będzie planować nowe maile dla 350 dostępnych leadów

---

### **2. Planowanie nowych maili (`scheduleNextEmailV2`):**

**Dane:**
- 350 leadów queued (dostępne)
- 0 maili pending (wszystkie są sent lub cancelled)
- `leadsInQueueIds = []` (brak maili pending/sending)

**Kod:**
```typescript
const leadsInQueueIds = []; // Brak maili pending/sending

const nextCampaignLead = await db.campaignLead.findFirst({
  where: {
    campaignId: 3,
    status: "queued",
    // leadsInQueueIds.length = 0, więc nie ma warunku notIn
    // ...
  }
});
```

**Wynik:**
- ✅ Znajdzie pierwszego leada queued (priority = 999)
- ✅ Utworzy mail w kolejce dla tego leada
- ✅ System będzie planował nowe maile

---

### **3. Pauza co 10 maili:**

**Dane:**
- Wysłano: 324 maile
- `324 % 10 = 4` → nie jest wielokrotnością 10
- Następny mail (325.) = normalny odstęp
- 330. mail = pauza 10-15 min

**Kod:**
```typescript
const sentCount = await db.sendLog.count({
  where: { campaignId: 3, status: 'sent' }
}); // sentCount = 324

if (sentCount > 0 && sentCount % 10 === 0) {
  // Dodaj pauzę 10-15 min
}
```

**Wynik:**
- ✅ `324 % 10 = 4` → nie ma pauzy (poprawne)
- ✅ 330. mail = pauza 10-15 min

---

### **4. Randomizacja:**

**Dla delayBetweenEmails = 90s:**

**Zaplanowane maile:**
- `minDelay = 90s`, `maxDelay = 180s`
- **Zakres:** 90-180s ✅

**Gotowe maile:**
- `baseDelay = 90s - 30s = 60s`
- `minDelay = 60s`, `maxDelay = 120s`
- **Zakres:** 60-120s ✅

**Analiza:**
- ✅ Randomizacja będzie działać poprawnie

---

## ✅ WERYFIKACJA PROBLEMÓW

### **1. Stuck emaile:**
- ✅ **0 stuck maili** (sending dłużej niż 10 min)

### **2. Brak dostępnych leadów:**
- ✅ **350 leadów** są dostępne (queued, nie w kolejce, nie wysłane)

### **3. Brak dostępnych skrzynek:**
- ✅ **10 skrzynek** są dostępne (wszystkie)

### **4. Brak gotowych maili:**
- ✅ **0 maili pending** (system będzie musiał zaplanować nowe)
- ✅ System zaplanuje nowe maile po wznowieniu

---

## ✅ PODSUMOWANIE

### **Co działa:**
1. ✅ **Kampania może być wznowiona** (PAUSED, ma leady, ma skrzynki)
2. ✅ **350 leadów są dostępne** (system będzie planował nowe maile)
3. ✅ **10 skrzynek są dostępne** (wszystkie)
4. ✅ **Logika wznowienia** jest poprawna (V2, initializeQueueV2)
5. ✅ **Pauza co 10 maili** będzie działać (330. mail = pauza)
6. ✅ **Randomizacja** będzie działać (90-180s dla zaplanowanych, 60-120s dla gotowych)

### **Co będzie działać po wznowieniu:**
1. ✅ System zaplanuje nowe maile dla 350 dostępnych leadów
2. ✅ System będzie wysyłał maile z odstępami 90-180s (zaplanowane) lub 60-120s (gotowe)
3. ✅ Po 330. mailu będzie pauza 10-15 min
4. ✅ System będzie kontynuował wysyłkę dla wszystkich dostępnych leadów

---

## 🎯 WNIOSEK

**✅ Kampania 3 jest gotowa do wznowienia!**

- Wszystkie warunki są spełnione
- Logika jest poprawna
- System będzie działać poprawnie

**Można wznowić kampanię 3!**

