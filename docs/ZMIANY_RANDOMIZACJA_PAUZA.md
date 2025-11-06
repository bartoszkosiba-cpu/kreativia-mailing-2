# 📊 ZMIANY: Randomizacja 0-100% + Pauza co 10 maili

**Data:** 2025-11-05

---

## ✅ ZMIANY WPROWADZONE

### **1. Randomizacja odstępów: 0-100% (zamiast ±20%)**

**Dla kampanii z `delayBetweenEmails = 90s`:**

#### **Zaplanowane maile (w przyszłości):**
- **Zakres:** 90s - 180s (90s + 0-100%)
- **Min:** 90s (0% dodatku)
- **Max:** 180s (100% dodatku = 3 minuty)

#### **Gotowe maile (`scheduledAt <= now`):**
- **Zakres:** 60s - 120s ((90s - 30s) + 0-100%)
- **Min:** 60s (0% dodatku)
- **Max:** 120s (100% dodatku = 2 minuty)

**Zmienione pliki:**
- `src/services/campaignEmailQueueV2.ts` - `calculateNextEmailTimeV2()` (linia 20-22)
- `src/services/campaignEmailSenderV2.ts` - `processScheduledEmailsV2()` (linia 1400-1409)
- `src/services/campaignEmailSenderV2.ts` - `recoverStuckEmailsAfterRestart()` (linia 1288-1295)

---

### **2. Pauza co 10 wysłanych maili**

**Funkcjonalność:**
- Po wysłaniu 10., 20., 30., ... maila → automatyczna pauza
- **Pauza:** 10 min + 0-50% = 10-15 minut
- **Randomizacja:** Losowa wartość w zakresie [600s, 900s]

**Przykład:**
- Po 10. mailu: pauza 10-15 min (losowo)
- Po 20. mailu: pauza 10-15 min (losowo)
- Po 30. mailu: pauza 10-15 min (losowo)
- ...

**Zmieniony plik:**
- `src/services/campaignEmailQueueV2.ts` - `scheduleNextEmailV2()` (linia 487-514)

**Logika:**
```typescript
if (sentCount > 0 && sentCount % 10 === 0) {
  // Dodaj pauzę 10-15 min
  const basePauseMinutes = 10; // 10 min
  const randomVariation = 0.5; // 0-50%
  const actualPauseMinutes = [600, 900]s (losowo)
  nextTime = lastSentTime + actualPauseMinutes
} else {
  // Normalny odstęp 90-180s
  nextTime = calculateNextEmailTimeV2(...)
}
```

---

### **3. Wyświetlanie 15 maili zamiast 5**

**Zmiana:**
- Limit wyświetlanych maili w "Ostatnie wysłane maile" zwiększony z 5 na 15

**Zmieniony plik:**
- `app/api/campaigns/[id]/sending-info/route.ts` (linia 69: `take: 15`)

**Lokalizacja w UI:**
- `http://127.0.0.1:3000/campaigns/[id]#wysylka-informacje`
- Sekcja "Ostatnie wysłane maile"

---

## 📊 PRZYKŁADOWY SCENARIUSZ

### **Kampania z `delayBetweenEmails = 90s`:**

**Maile 1-9:**
- Odstępy: 90-180s (losowo)

**Mail 10:**
- Wysłany
- **Pauza:** 10-15 min (losowo, np. 12 min 30s)

**Maile 11-19:**
- Odstępy: 90-180s (losowo)

**Mail 20:**
- Wysłany
- **Pauza:** 10-15 min (losowo, np. 11 min 45s)

**Maile 21-29:**
- Odstępy: 90-180s (losowo)

**Mail 30:**
- Wysłany
- **Pauza:** 10-15 min (losowo)

---

## ✅ WERYFIKACJA

### **Randomizacja:**
- ✅ Zaplanowane: 90-180s (0-100%)
- ✅ Gotowe: 60-120s (0-100%)
- ✅ Recovery: 60-120s (0-100%)

### **Pauza:**
- ✅ Co 10 maili: 10-15 min (0-50%)
- ✅ Log w konsoli: `[QUEUE V2] ⏸️  Pauza co 10 maili: ...`

### **Wyświetlanie:**
- ✅ 15 maili zamiast 5 w UI

---

## 🎯 WYNIK

**System teraz:**
1. Używa szerokiej randomizacji odstępów (0-100%)
2. Dodaje automatyczną pauzę co 10 maili (10-15 min)
3. Wyświetla 15 ostatnich maili w UI

**Korzyści:**
- ✅ Większa różnorodność odstępów (trudniejsze do wykrycia)
- ✅ Naturalne pauzy co 10 maili (mniej podejrzane)
- ✅ Lepsza widoczność ostatnich maili (15 zamiast 5)

