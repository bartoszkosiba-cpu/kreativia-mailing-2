# 📊 PODSUMOWANIE WYSYŁKI - 2025-11-05, 21:10

**Kampania:** 4 - "Biura nieruchomości PL - ścianki 03.11.25"

---

## ✅ CO DZIAŁA

### **1. Kampania działa**
- ✅ Status: IN_PROGRESS
- ✅ Wysyłka aktywna

### **2. Wysyłka maili**
- ✅ Wysłano 128 maili total
- ✅ Wysłano 60 maili dzisiaj (00:11:47 - 21:07:15)
- ✅ Ostatni mail: 21:07:15 (3 minuty temu)

### **3. Randomizacja odstępów**
- ✅ Zakres: 29.9s - 1112.3s (średnia 126.5s)
- ✅ Dla delayBetweenEmails = 60s, oczekiwany zakres: 60-120s
- ⚠️ Niektóre odstępy są za długie (> 120s)

### **4. Pauza co 10 maili**
- ✅ Wysłano 128 maili
- ✅ Następny mail (129.) = normalny odstęp
- ✅ 130. mail = pauza 10-15 min

### **5. Skrzynki**
- ✅ 1 skrzynka dostępna (może kontynuować)
- ⚠️ 5 skrzynek wyczerpanych (osiągnęły limit)

---

## ❌ CO NIE DZIAŁA

### **Problem 1: Stuck email (sending)**

**Faktyczne:**
- 1 mail w statusie `sending` od 21:07:51
- Czas: ~3 minuty temu

**Problem:**
- ⚠️ Mail może być stuck (zablokowany)
- Może blokować kolejne wysyłki

**Rozwiązanie:**
- Sprawdzić `unlockStuckEmails()` - czy działa?
- Czy mail ma błąd?

---

### **Problem 2: Brak gotowych maili w kolejce**

**Faktyczne:**
- 0 gotowych maili (`scheduledAt <= now`)
- 5 pending maili (wszystkie w przyszłości)

**Problem:**
- ❌ System nie planuje nowych maili
- ❌ Możliwe że brak dostępnych leadów
- ❌ Możliwe że system czeka na dostępność skrzynek

**Sprawdzenie:**
- Czy są leady w statusie `queued`?
- Czy `scheduleNextEmailV2()` jest wywoływane?

---

### **Problem 3: Niektóre odstępy są za długie**

**Faktyczne:**
- Max odstęp: 1112.3s (18.5 min!)
- Dla delayBetweenEmails = 60s, oczekiwany zakres: 60-120s

**Możliwe przyczyny:**
1. Brak dostępnych skrzynek (5 z 6 wyczerpanych)
2. System czeka na dostępność skrzynki
3. `isWithinSendWindow()` opóźnia wysyłkę
4. Długa przerwa w kampanii (pauza)

**Sprawdzenie:**
- Czy odstępy > 120s są spowodowane brakiem skrzynek?
- Czy są dłuższe przerwy między mailami?

---

### **Problem 4: Niektóre odstępy są za krótkie**

**Faktyczne:**
- Min odstęp: 29.9s (< 60s)
- Dla delayBetweenEmails = 60s, oczekiwany zakres: 60-120s

**Możliwe przyczyny:**
1. Gotowe maile (`scheduledAt <= now`) używają zakresu 30-60s (fix dla baseDelay <= 0)
2. To jest poprawne zachowanie dla gotowych maili

**Wniosek:**
- ✅ **To jest poprawne!** Gotowe maile używają zakresu 30-60s (dla delayBetweenEmails = 60s).

---

## 🔍 SZCZEGÓŁY

### **Kolejka:**
- **Total:** 140 maili
- **Pending:** 5 maili (wszystkie w przyszłości)
- **Sending:** 1 mail (może być stuck)
- **Sent:** 58 maili (w kolejce)
- **Cancelled:** 76 maili

### **Leady:**
- Sprawdzić czy są leady w statusie `queued`
- Sprawdzić czy `scheduleNextEmailV2()` jest wywoływane

### **Stuck email:**
- 1 mail w statusie `sending` od 21:07:51
- Może blokować kolejne wysyłki
- Sprawdzić `unlockStuckEmails()`

---

## 📋 REKOMENDACJE

### **1. Sprawdzić stuck email**
- Sprawdzić czy mail ma błąd
- Sprawdzić czy `unlockStuckEmails()` działa
- Jeśli mail jest stuck, odblokować go

### **2. Sprawdzić dlaczego nie ma gotowych maili**
- Sprawdzić czy są leady w statusie `queued`
- Sprawdzić czy `scheduleNextEmailV2()` jest wywoływane
- Sprawdzić czy system czeka na dostępność skrzynek

### **3. Sprawdzić długie odstępy**
- Sprawdzić czy są spowodowane brakiem skrzynek
- Sprawdzić czy są dłuższe przerwy między mailami
- Sprawdzić czy `isWithinSendWindow()` opóźnia wysyłkę

---

## ✅ WNIOSEK

**Co działa:**
- ✅ Kampania działa
- ✅ Wysyłka maili działa
- ✅ Randomizacja działa (z drobnymi problemami)
- ✅ Pauza co 10 maili działa

**Co nie działa:**
- ❌ Stuck email (sending)
- ❌ Brak gotowych maili w kolejce
- ❌ Niektóre odstępy są za długie

**Co sprawdzić:**
- 🔍 Stuck email
- 🔍 Dlaczego nie ma gotowych maili
- 🔍 Długie odstępy

