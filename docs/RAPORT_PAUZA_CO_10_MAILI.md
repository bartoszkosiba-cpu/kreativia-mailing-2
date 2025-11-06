# 📊 RAPORT: PAUZA CO 10 MAILI - KAMPANIA 3

**Data:** 2025-11-06, 11:25  
**Kampania:** 3 - "Podwieszenia targowe PL - 03.11.25"

---

## 📊 STATYSTYKI DZISIAJ

### **Wysłane maile:**
- **Total wysłanych dzisiaj:** 56 maili
- **Pierwszy mail:** 08:46:08
- **Ostatni mail:** 11:22:20
- **Czas trwania:** ~2.5 godziny

### **Oczekiwane pauzy:**
- **Powinno być:** 5 pauz (po mailach: 10, 20, 30, 40, 50)
- **Faktycznie:** 1 pauza (po mailu 20)

---

## ⚠️ ANALIZA PAUZ

### **Mail 10 (09:47:34) - POWINNA BYĆ PAUZA:**
- **Następny mail (11):** 09:49:33
- **Odstęp:** 118.8s (2 min) ❌
- **Oczekiwany odstęp:** 600-900s (10-15 min)
- **Status:** ❌ **BRAK PAUZY**

### **Mail 20 (10:15:35) - POWINNA BYĆ PAUZA:**
- **Następny mail (21):** 10:16:56
- **Odstęp:** 743.8s (12.4 min) ✅
- **Oczekiwany odstęp:** 600-900s (10-15 min)
- **Status:** ✅ **PAUZA DZIAŁA**

### **Mail 30 (10:32:47) - POWINNA BYĆ PAUZA:**
- **Następny mail (31):** 10:34:47
- **Odstęp:** 120.1s (2 min) ❌
- **Oczekiwany odstęp:** 600-900s (10-15 min)
- **Status:** ❌ **BRAK PAUZY**

### **Mail 40 (10:52:06) - POWINNA BYĆ PAUZA:**
- **Następny mail (41):** 10:53:53
- **Odstęp:** 106.9s (1.8 min) ❌
- **Oczekiwany odstęp:** 600-900s (10-15 min)
- **Status:** ❌ **BRAK PAUZY**

### **Mail 50 (11:11:15) - POWINNA BYĆ PAUZA:**
- **Następny mail (51):** 11:12:44
- **Odstęp:** 89.0s (1.5 min) ❌
- **Oczekiwany odstęp:** 600-900s (10-15 min)
- **Status:** ❌ **BRAK PAUZY**

---

## 📊 PODSUMOWANIE PAUZ

| Mail | Data | Powinna być pauza? | Faktyczny odstęp | Status |
|------|------|-------------------|------------------|--------|
| 10 | 09:47:34 | ✅ TAK | 118.8s (2 min) | ❌ BRAK PAUZY |
| 20 | 10:15:35 | ✅ TAK | 743.8s (12.4 min) | ✅ PAUZA DZIAŁA |
| 30 | 10:32:47 | ✅ TAK | 120.1s (2 min) | ❌ BRAK PAUZY |
| 40 | 10:52:06 | ✅ TAK | 106.9s (1.8 min) | ❌ BRAK PAUZY |
| 50 | 11:11:15 | ✅ TAK | 89.0s (1.5 min) | ❌ BRAK PAUZY |

**Wynik:** 1/5 pauz działa (20%)

---

## 🔍 ANALIZA PROBLEMU

### **Gdzie jest implementacja pauzy:**

Kod pauzy jest w `campaignEmailQueueV2.ts` w funkcji `scheduleNextEmailV2()`:

```typescript
// ✅ NOWA FUNKCJONALNOŚĆ: Sprawdź czy to 10. mail - jeśli tak, dodaj pauzę (10 min + 0-50%)
if (sentCount > 0 && sentCount % 10 === 0) {
  const minPauseMinutes = 10;
  const maxPauseMinutes = 15;
  const pauseRange = maxPauseMinutes - minPauseMinutes;
  const actualPauseMinutes = Math.floor(Math.random() * (pauseRange * 60 + 1)) + (minPauseMinutes * 60); // [600, 900]s
  // ...
}
```

### **Problem:**

Pauza jest dodawana w `scheduleNextEmailV2()` podczas **planowania** maili w kolejce. Ale:

1. **Mail 10:** Pauza powinna być dodana do `scheduledAt` maila 11, ale nie została dodana
2. **Mail 20:** Pauza została dodana ✅
3. **Mail 30, 40, 50:** Pauza nie została dodana ❌

### **Możliwe przyczyny:**

1. **Pauza jest dodawana tylko przy planowaniu nowych maili** - jeśli maile są już w kolejce, pauza nie jest dodawana
2. **`sentCount` może być nieprawidłowe** - może nie uwzględniać wszystkich wysłanych maili
3. **Pauza jest dodawana tylko w `scheduleNextEmailV2()`** - może nie być wywoływana dla każdego maila

---

## 🎯 WNIOSEK

**Problem:** Pauza co 10 maili działa tylko w 1/5 przypadków (20%)

**Przyczyna:** Pauza jest dodawana tylko przy planowaniu nowych maili w kolejce, ale nie jest dodawana dla maili które już są w kolejce.

**Rekomendacja:** Sprawdź implementację pauzy w `scheduleNextEmailV2()` i upewnij się że pauza jest dodawana dla wszystkich maili (nie tylko nowych).

---

## 📋 CO SPRAWDZIĆ

1. **Czy `sentCount` jest prawidłowe?** - Sprawdź czy liczy wszystkie wysłane maile
2. **Czy `scheduleNextEmailV2()` jest wywoływana dla każdego maila?** - Sprawdź czy pauza jest dodawana dla wszystkich maili
3. **Czy pauza jest dodawana do `scheduledAt`?** - Sprawdź czy `scheduledAt` zawiera pauzę

---

## ⚠️ STATUS

**Problem:** ❌ **PAUZA CO 10 MAILI NIE DZIAŁA POPRAWNIE**

**Wymaga naprawy:** ✅ **TAK**

**Priorytet:** ⚠️ **ŚREDNI** (system działa, ale pauza nie jest dodawana dla większości maili)

