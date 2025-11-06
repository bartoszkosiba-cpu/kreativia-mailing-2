# 📊 OBLICZANIE OPÓŹNIENIA W HARMONOGRAMIE

**Dla kampanii z `delayBetweenEmails = 30s`**

---

## ⚙️ USTAWIENIA

### **Podstawowe:**
- **delayBetweenEmails:** 30 sekund (zmienione dla testów)
- **Randomizacja:** 0-100%
- **Pauza co 10 maili:** 10-15 min

---

## 📈 OBLICZANIE ODSTĘPÓW

### **1. Dla zaplanowanych maili (w przyszłości):**

**Lokalizacja:** `campaignEmailQueueV2.ts` - `calculateNextEmailTimeV2()`

```typescript
const minDelay = delayBetweenEmails; // 30s (0% dodatku)
const maxDelay = delayBetweenEmails * 2; // 60s (100% dodatku)
const actualDelay = Math.floor(Math.random() * (range + 1)) + minDelay; // [30, 60]s
```

**Dla 30s:**
- **Zakres:** 30-60 sekund
- **Min:** 30s (0% dodatku)
- **Max:** 60s (100% dodatku)

---

### **2. Dla gotowych maili (`scheduledAt <= now`):**

**Lokalizacja:** `campaignEmailSenderV2.ts` - `processScheduledEmailsV2()`

```typescript
const baseDelay = delayBetweenEmails - cronInterval; // 30 - 30 = 0s
const minDelay = baseDelay; // 0s (0% dodatku)
const maxDelay = baseDelay * 2; // 0s (100% dodatku)
```

**Dla 30s:**
- **Base:** 30s - 30s = **0s** ⚠️
- **Zakres:** 0-0s ⚠️
- **Problem:** Jeśli `delayBetweenEmails = cronInterval`, to `baseDelay = 0` → brak randomizacji!

---

## ⚠️ PROBLEM Z 30s

### **Dla gotowych maili:**
- `baseDelay = 30s - 30s = 0s`
- `minDelay = 0s`
- `maxDelay = 0s`
- **Wynik:** `correctedTime = 0ms` → wysyłka natychmiastowa (cron decyduje o czasie)

### **Dla zaplanowanych maili:**
- `minDelay = 30s`
- `maxDelay = 60s`
- **Zakres:** 30-60s ✅ (poprawne)

---

## 🔧 ROZWIĄZANIE

### **Opcja 1: Zwiększ `delayBetweenEmails`**
- Minimum powinno być > 30s (np. 60s)
- Wtedy `baseDelay = 60s - 30s = 30s` → zakres 30-60s dla gotowych

### **Opcja 2: Zmień logikę dla gotowych maili**
- Zamiast `baseDelay - cronInterval`, użyj `delayBetweenEmails` bezpośrednio
- Wtedy `minDelay = 30s`, `maxDelay = 60s` dla gotowych

### **Opcja 3: Minimum delay dla gotowych**
- Jeśli `baseDelay <= 0`, użyj `minDelay = 30s` (minimum)
- Wtedy zawsze będzie jakiś delay

---

## 📊 DLA 30s (OBECNE ZACHOWANIE)

### **Zaplanowane maile:**
- **Zakres:** 30-60s ✅
- **Randomizacja:** Działa poprawnie

### **Gotowe maile:**
- **Zakres:** 0s ⚠️
- **Problem:** Brak randomizacji, wysyłka natychmiastowa (cron decyduje)
- **Wynik:** Odstępy będą równe cron interval (30s)

---

## ✅ REKOMENDACJA

**Dla testów z 30s:**
- Zaplanowane maile: 30-60s ✅ (działa)
- Gotowe maile: 0s ⚠️ (problem - brak randomizacji)

**Rozwiązanie:**
- Zmień logikę dla gotowych maili aby używała `delayBetweenEmails` bezpośrednio
- Lub ustaw minimum delay (np. 30s) jeśli `baseDelay <= 0`

