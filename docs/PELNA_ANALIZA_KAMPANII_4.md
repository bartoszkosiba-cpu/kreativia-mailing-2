# 📊 PEŁNA ANALIZA KAMPANII 4 (od 19:20)

**Data analizy:** 2025-11-05  
**Okres:** 19:20:00 - 20:29:46

---

## ⚙️ USTAWIENIA KAMPANII

### **Podstawowe:**
- **delayBetweenEmails:** 90 sekund
- **maxEmailsPerDay:** 500 maili
- **Okno czasowe:** 19:00-23:55 (Pn-Pt)

### **Założenia (po zmianach):**
1. **Randomizacja odstępów:** 0-100% (90s - 180s dla zaplanowanych, 60-120s dla gotowych)
2. **Pauza co 10 maili:** 10-15 minut (600-900s)

---

## 📈 FAKTYCZNE WYSŁANE MAILE

### **Statystyki:**
- **Total wysłanych:** 27 maili
- **Okres:** 19:22:06 - 20:29:46 (67 minut 40 sekund)
- **Pierwszy mail:** 19:22:06
- **Ostatni mail:** 20:29:46

### **Podział:**
- **Maile 1-11:** 19:22:06 - 19:37:15 (przed zatrzymaniem)
- **Przerwa:** 19:37:15 - 20:22:16 (45 minut 1 sekunda) - **KAMPANIA ZATRZYMANA**
- **Maile 12-27:** 20:22:16 - 20:29:46 (po wznowieniu)

---

## 📊 FAKTYCZNE ODSTĘPY

### **Maile 1-11 (19:22-19:37):**

| # | Odstęp (s) | Odstęp (min) | Zakres |
|---|------------|--------------|--------|
| 1-2 | 78.9s | 1.31 min | 72-108s ✅ |
| 2-3 | 105.3s | 1.76 min | 72-108s ✅ |
| 3-4 | 89.6s | 1.49 min | 72-108s ✅ |
| 4-5 | 86.1s | 1.43 min | 72-108s ✅ |
| 5-6 | 101.0s | 1.68 min | 72-108s ✅ |
| 6-7 | 90.1s | 1.50 min | 72-108s ✅ |
| 7-8 | 78.2s | 1.30 min | 72-108s ✅ |
| 8-9 | 98.9s | 1.65 min | 72-108s ✅ |
| 9-10 | 88.8s | 1.48 min | 72-108s ✅ |
| 10-11 | 92.2s | 1.54 min | 72-108s ✅ |

**Analiza:**
- ✅ **Zakres:** 78.2s - 105.3s
- ✅ **Średnia:** ~90s
- ✅ **Zgodność:** Wszystkie w zakresie 72-108s (stara randomizacja ±20%)
- ❌ **Problem:** NIE używa nowej randomizacji 0-100% (powinno być 90-180s)

### **Maile 12-27 (20:22-20:29):**

| # | Odstęp (s) | Odstęp (min) | Zakres |
|---|------------|--------------|--------|
| 11-12 | 2701.6s | 45.03 min | **PAUZA (zatrzymanie)** |
| 12-13 | 24.8s | 0.41 min | ❌ Za krótkie |
| 13-14 | 34.9s | 0.58 min | ❌ Za krótkie |
| 14-15 | 24.8s | 0.41 min | ❌ Za krótkie |
| 15-16 | 35.7s | 0.59 min | ❌ Za krótkie |
| 16-17 | 29.5s | 0.49 min | ❌ Za krótkie |
| 17-18 | 30.0s | 0.50 min | ❌ Za krótkie |
| 18-19 | 30.0s | 0.50 min | ❌ Za krótkie |
| 19-20 | 24.9s | 0.42 min | ❌ Za krótkie |
| 20-21 | 34.0s | 0.57 min | ❌ Za krótkie |
| 21-22 | 26.0s | 0.43 min | ❌ Za krótkie |
| 22-23 | 35.3s | 0.59 min | ❌ Za krótkie |
| 23-24 | 29.9s | 0.50 min | ❌ Za krótkie |
| 24-25 | 29.9s | 0.50 min | ❌ Za krótkie |
| 25-26 | 30.0s | 0.50 min | ❌ Za krótkie |
| 26-27 | 30.1s | 0.50 min | ❌ Za krótkie |

**Analiza:**
- ❌ **Zakres:** 24.8s - 35.7s
- ❌ **Średnia:** ~30s
- ❌ **Problem:** Za krótkie odstępy (powinno być 90-180s)
- ❌ **Problem:** Wygląda jakby używało cron interval (30s) zamiast randomizacji

---

## ⏸️ PAUZA CO 10 MAILI

### **Założenia:**
- Po 10., 20., 30. mailu → pauza 10-15 min (600-900s)

### **Faktyczne:**

**Po 10. mailu (19:35:43 → 19:37:15):**
- **Odstęp:** 92.2s (1.54 min)
- ❌ **NIE było pauzy** (powinno być 10-15 min)
- ❌ **Problem:** Pauza nie zadziałała

**Po 11. mailu (19:37:15 → 20:22:16):**
- **Odstęp:** 2701.6s (45.03 min)
- ✅ **Była długa pauza** (ale to była przerwa w kampanii, nie pauza co 10 maili)

**Po 20. mailu (20:26:11 → 20:26:45):**
- **Odstęp:** 34.0s (0.57 min)
- ❌ **NIE było pauzy** (powinno być 10-15 min)
- ❌ **Problem:** Pauza nie zadziałała

---

## ❌ PROBLEMY ZNALEZIONE

### **Problem 1: Randomizacja 0-100% NIE DZIAŁA**

**Założenia:**
- Zaplanowane: 90-180s (0-100%)
- Gotowe: 60-120s (0-100%)

**Faktyczne:**
- Maile 1-11: 78-105s (stara randomizacja ±20%)
- Maile 12-27: 24-35s (cron interval 30s)

**Przyczyna:**
- System używa starych ustawień lub nie załadował nowych zmian
- Możliwe że serwer nie został zrestartowany po zmianach

### **Problem 2: Pauza co 10 maili NIE DZIAŁA**

**Założenia:**
- Po 10., 20., 30. mailu → pauza 10-15 min

**Faktyczne:**
- Po 10. mailu: 92.2s (NIE było pauzy)
- Po 20. mailu: 34.0s (NIE było pauzy)

**Przyczyna:**
- Logika `sentCount % 10 === 0` sprawdza się PO wysłaniu maila
- Ale `scheduleNextEmailV2()` jest wywoływane PO wysłaniu, więc `sentCount` już zawiera wysłany mail
- Jeśli wysłano 10. mail → `sentCount = 10`, `10 % 10 === 0` → powinna być pauza
- Ale faktycznie nie było pauzy - może logika nie działa?

### **Problem 3: Odstępy po wznowieniu są za krótkie**

**Faktyczne:**
- 24-35s (cron interval 30s)

**Przyczyna:**
- Możliwe że używa `setTimeout` z `correctedTime = 0` dla gotowych maili
- Albo cron uruchamia od razu wysyłkę zamiast odliczania

---

## 🔍 ANALIZA PRZYCZYN

### **Dlaczego randomizacja 0-100% nie działa?**

**Możliwe przyczyny:**
1. Serwer nie został zrestartowany po zmianach
2. Kod używa starej wersji (cache)
3. Funkcja `calculateNextEmailTimeV2()` nie jest używana
4. System używa innej logiki dla gotowych maili

### **Dlaczego pauza co 10 maili nie działa?**

**Możliwe przyczyny:**
1. Logika `sentCount % 10 === 0` nie działa poprawnie
2. `scheduleNextEmailV2()` nie jest wywoływane
3. Pauza jest dodawana, ale `scheduledAt` jest nadpisywany przez `isWithinSendWindow()`

---

## ✅ PODSUMOWANIE

### **Ustawienia:**
- ✅ delayBetweenEmails: 90s
- ✅ Randomizacja: 0-100% (90-180s) - **ZAŁOŻENIA**
- ✅ Pauza co 10 maili: 10-15 min - **ZAŁOŻENIA**

### **Faktyczne:**
- ❌ Randomizacja: 78-105s (stara ±20%) lub 24-35s (cron interval)
- ❌ Pauza co 10 maili: **NIE DZIAŁA** (brak pauzy po 10. i 20. mailu)

### **Problemy:**
1. ❌ Randomizacja 0-100% **NIE DZIAŁA**
2. ❌ Pauza co 10 maili **NIE DZIAŁA**
3. ❌ Odstępy po wznowieniu za krótkie (24-35s zamiast 90-180s)

---

## 🔧 CO NAPRAWIĆ

1. **Sprawdzić czy serwer został zrestartowany** po zmianach
2. **Sprawdzić logikę pauzy** - dlaczego nie działa
3. **Sprawdzić logikę randomizacji** - dlaczego używa starych wartości
4. **Sprawdzić logi** - czy są błędy w `scheduleNextEmailV2()` lub `calculateNextEmailTimeV2()`

