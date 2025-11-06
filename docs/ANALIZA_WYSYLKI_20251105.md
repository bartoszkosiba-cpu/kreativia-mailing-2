# 📊 ANALIZA WYSYŁKI - 2025-11-05

**Data analizy:** 2025-11-05, 21:10  
**Kampania:** 4 - "Biura nieruchomości PL - ścianki 03.11.25"

---

## 📈 STATUS KAMPANII

### **Podstawowe informacje:**
- **Status:** IN_PROGRESS ✅
- **delayBetweenEmails:** 60 sekund (NIE 30s jak wcześniej mówiono!)
- **maxEmailsPerDay:** 500
- **Okno czasowe:** 19:00-23:55

---

## 📊 STATYSTYKI WYSYŁKI

### **Wysłane maile:**
- **Total wysłanych:** 128 maili
- **Dzisiaj:** 60 maili (od 00:11:47 do 21:07:15)
- **Pierwszy mail dzisiaj:** 00:11:47
- **Ostatni mail:** 21:07:15

### **Kolejka:**
- **Total w kolejce:** 140 maili
- **Pending:** 6 maili
- **Sending:** 0 maili
- **Sent:** 58 maili (w kolejce)
- **Najwcześniejszy zaplanowany:** 2025-11-05 00:08:06
- **Najpóźniejszy zaplanowany:** 2025-11-05 21:15:11

---

## 📊 ODSTĘPY MIĘDZY MAILAMI

### **Ostatnie 10 maili:**

| Czas 1 | Czas 2 | Odstęp (s) | Odstęp (min) |
|--------|--------|------------|--------------|
| 21:07:15 | 21:06:23 | 52.0s | 0.87 min |
| 21:06:23 | 21:04:37 | 106.0s | 1.77 min |
| 21:04:37 | 21:03:58 | 39.0s | 0.65 min |
| 21:03:58 | 21:02:37 | 81.0s | 1.35 min |
| 21:02:37 | 20:59:59 | 158.0s | 2.63 min |
| 20:59:59 | 20:57:41 | 138.0s | 2.30 min |
| 20:57:41 | 20:56:34 | 67.0s | 1.12 min |
| 20:56:34 | 20:55:12 | 82.0s | 1.37 min |
| 20:55:12 | 20:54:29 | 43.0s | 0.72 min |

### **Statystyki (ostatnie 20 maili):**
- **Min odstęp:** ~39s
- **Max odstęp:** ~158s
- **Średni odstęp:** ~80s

### **Analiza:**
- ✅ **Zakres:** 39-158s (dla delayBetweenEmails = 60s, powinno być 60-120s)
- ✅ **Średnia:** ~80s (blisko 60s)
- ⚠️ **Problem:** Niektóre odstępy są za długie (158s = 2.63 min)
- ⚠️ **Problem:** Niektóre odstępy są za krótkie (39s < 60s)

---

## ⏸️ PAUZA CO 10 MAILI

### **Status:**
- **Wysłano:** 128 maili
- **Następny mail:** 129. mail
- **Status:** "Normalny odstęp" (nie pauza)

### **Analiza:**
- `128 % 10 = 8` → nie jest wielokrotnością 10
- `129 % 10 = 9` → nie jest wielokrotnością 10
- `130 % 10 = 0` → **130. mail powinien mieć pauzę**

**Wniosek:** ✅ Pauza co 10 maili działa poprawnie (sprawdza się PRZED planowaniem)

---

## 📬 SKRZYNKI MAILOWE

### **Status:**
- **Total skrzynek:** 6 skrzynek
- **Dostępne:** 1 skrzynka ✅
- **Wyczerpane:** 5 skrzynek ❌

### **Problem:**
- ⚠️ **5 z 6 skrzynek jest wyczerpanych** (osiągnęły dzienny limit)
- ✅ **1 skrzynka jest dostępna** (może wysyłać dalej)

**Wniosek:** System może kontynuować wysyłkę, ale tylko z 1 skrzynki, co może spowolnić wysyłkę.

---

## ❌ PROBLEMY ZNALEZIONE

### **Problem 1: Niektóre odstępy są za długie**

**Faktyczne:**
- Max odstęp: 158s (2.63 min)
- Dla delayBetweenEmails = 60s, powinno być 60-120s

**Możliwe przyczyny:**
1. Brak dostępnych skrzynek (5 z 6 wyczerpanych)
2. System czeka na dostępność skrzynki
3. `isWithinSendWindow()` opóźnia wysyłkę

---

### **Problem 2: Niektóre odstępy są za krótkie**

**Faktyczne:**
- Min odstęp: 39s (< 60s)
- Dla delayBetweenEmails = 60s, powinno być 60-120s

**Możliwe przyczyny:**
1. Gotowe maile (`scheduledAt <= now`) używają fix dla 30s (a nie 60s)
2. System wysyła maile natychmiast jeśli są gotowe

**Sprawdzenie:**
- Dla delayBetweenEmails = 60s:
  - `baseDelay = 60s - 30s = 30s`
  - `minDelay = 30s`, `maxDelay = 60s`
  - **Zakres:** 30-60s ✅

**Wniosek:** ✅ **To jest poprawne!** Gotowe maile używają zakresu 30-60s (dla delayBetweenEmails = 60s).

---

### **Problem 3: Brak gotowych maili w kolejce**

**Faktyczne:**
- 0 gotowych maili (`scheduledAt <= now`)
- Wszystkie maile są zaplanowane w przyszłości

**Możliwe przyczyny:**
1. Wszystkie maile zostały już wysłane lub zaplanowane
2. System nie planuje nowych maili (brak dostępnych leadów)
3. System czeka na dostępność skrzynek

**Sprawdzenie:**
- 140 maili w kolejce
- 6 pending, 0 sending, 58 sent
- Najwcześniejszy zaplanowany: 2025-11-05 00:08:06 (w przeszłości!)
- Najpóźniejszy zaplanowany: 2025-11-05 21:15:11 (w przyszłości)

**Problem:** ❌ Maile zaplanowane na 00:08:06 (w przeszłości) powinny być gotowe!

---

## ✅ CO DZIAŁA POPRAWNIE

1. ✅ **Kampania działa:** Status IN_PROGRESS
2. ✅ **Wysyłka działa:** Wysłano 60 maili dzisiaj
3. ✅ **Pauza co 10 maili:** Działa poprawnie (sprawdza się PRZED planowaniem)
4. ✅ **Randomizacja:** Działa (zakres 39-158s, średnia ~80s)
5. ✅ **Skrzynki:** 1 skrzynka dostępna (może kontynuować)

---

## ❌ CO NIE DZIAŁA POPRAWNIE

1. ❌ **Gotowe maile:** Maile zaplanowane na 00:08:06 (w przeszłości) nie są wysyłane
2. ❌ **Długie odstępy:** Niektóre odstępy są za długie (158s > 120s)
3. ⚠️ **Skrzynki:** 5 z 6 skrzynek wyczerpanych (może spowolnić wysyłkę)

---

## 🔍 CO SPRAWDZIĆ DALEJ

1. **Dlaczego maile zaplanowane na 00:08:06 nie są wysyłane?**
   - Czy są w statusie `pending`?
   - Czy `isWithinSendWindow()` je blokuje?
   - Czy brak dostępnych skrzynek je blokuje?

2. **Dlaczego odstępy są za długie?**
   - Czy system czeka na dostępność skrzynek?
   - Czy `isWithinSendWindow()` opóźnia wysyłkę?

3. **Czy system planuje nowe maile?**
   - Czy `scheduleNextEmailV2()` jest wywoływane?
   - Czy są dostępni leady do wysłania?

