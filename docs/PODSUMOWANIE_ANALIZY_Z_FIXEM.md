# 📊 PODSUMOWANIE ANALIZY KAMPANII 4 + FIX

**Data:** 2025-11-05  
**Okres:** 19:20:00 - 20:29:46

---

## ✅ CO ZROBIONO

1. **Zrestartowano serwer** (był uruchomiony ze starą wersją kodu)
2. **Naprawiono obliczanie opóźnienia dla 30s** (dla delayBetweenEmails = 30s)
3. **Zweryfikowano logikę pauzy** (sprawdzanie dlaczego nie działa)

---

## ⚙️ USTAWIENIA

### **Podstawowe:**
- **delayBetweenEmails:** 30 sekund (zmienione dla testów)
- **Randomizacja:** 0-100%
- **Pauza co 10 maili:** 10-15 min

### **Założenia:**
1. **Zaplanowane maile:** 30-60s (delayBetweenEmails * 2)
2. **Gotowe maile:** 30-30s (fix dla baseDelay <= 0)
3. **Pauza co 10 maili:** 10-15 min (600-900s)

---

## 📊 ANALIZA ODSTĘPÓW (19:20-20:29)

### **Maile 1-11 (19:22-19:37):**
- **Zakres:** 78.2s - 105.3s
- **Średnia:** ~90s
- **Problem:** ❌ Używało starej randomizacji ±20% (był stary kod)

### **Maile 12-27 (20:22-20:29):**
- **Zakres:** 24.8s - 35.7s
- **Średnia:** ~30s
- **Problem:** ❌ Używało cron interval (30s) zamiast randomizacji

**Uwaga:** To były dane PRZED restartem serwera. Po restarcie powinno działać poprawnie.

---

## ⏸️ PAUZA CO 10 MAILI

### **Założenia:**
- Po 10., 20., 30. mailu → pauza 10-15 min

### **Faktyczne (PRZED restartem):**
- **Po 10. mailu:** 92.2s (nie było pauzy)
- **Po 20. mailu:** 34.0s (nie było pauzy)

### **Analiza logiki:**

**Kod:**
```typescript
const sentCount = await db.sendLog.count({
  where: { campaignId, status: 'sent' }
});

if (sentCount > 0 && sentCount % 10 === 0) {
  // Dodaj pauzę 10-15 min
}
```

**Problem:**
- W momencie planowania maila po 10. mailu:
  - `sentCount = 10` (już wysłane)
  - `10 % 10 === 0` → powinna być pauza
  - Ale faktycznie nie było pauzy

**Możliwe przyczyny:**
1. `scheduleNextEmailV2()` nie był wywoływany (może używa innej funkcji)
2. `scheduledAt` jest nadpisywany przez `isWithinSendWindow()` (może resetuje pauzę)
3. Logika nie działa dla pierwszych maili (może `sentCount` jest liczone przed wysłaniem)

**Sprawdzenie:**
- Mail 10: 19:35:43
- Mail 11: 19:37:15
- Odstęp: 92.2s (nie było pauzy)

**Wniosek:**
- Logika wydaje się poprawna, ale może nie działać z powodu:
  - Nadpisywania `scheduledAt` przez `isWithinSendWindow()`
  - Lub `scheduleNextEmailV2()` nie jest wywoływane dla każdego maila

---

## 🔧 FIX DLA 30s

### **Problem:**
- Dla `delayBetweenEmails = 30s`:
  - `baseDelay = 30s - 30s = 0s`
  - `minDelay = 0s`, `maxDelay = 0s`
  - `correctedTime = 0ms` → wysyłka natychmiastowa

### **Rozwiązanie:**
```typescript
const minDelay = baseDelay > 0 
  ? baseDelay 
  : Math.max(30, delayBetweenEmails * 0.5); // Minimum 30s

const maxDelay = baseDelay > 0 
  ? baseDelay * 2 
  : delayBetweenEmails; // delayBetweenEmails jako max
```

### **Dla 30s:**
- **Zaplanowane maile:** 30-60s ✅
- **Gotowe maile:** 30-30s (fixed, ale zawsze jest delay) ✅

---

## 📋 PODSUMOWANIE

### **Ustawienia:**
- ✅ delayBetweenEmails: 30s
- ✅ Randomizacja: 0-100% (30-60s dla zaplanowanych)
- ✅ Pauza co 10 maili: 10-15 min (600-900s)

### **Faktyczne (PRZED restartem):**
- ❌ Randomizacja: 78-105s (stara ±20%) lub 24-35s (cron)
- ❌ Pauza co 10 maili: **NIE DZIAŁA**

### **Po restarcie (OCZEKIWANE):**
- ✅ Randomizacja: 30-60s (dla zaplanowanych), 30s (dla gotowych)
- ❓ Pauza co 10 maili: **DO SPRAWDZENIA** (może wymagać dodatkowego fix)

---

## 🔍 CO DALEJ SPRAWDZIĆ

1. **Pauza co 10 maili:**
   - Sprawdzić czy `scheduleNextEmailV2()` jest wywoływane
   - Sprawdzić czy `isWithinSendWindow()` nie nadpisuje pauzy
   - Sprawdzić logi - czy są komunikaty o pauzie

2. **Randomizacja:**
   - Po restarcie powinno działać (30-60s dla zaplanowanych)
   - Dla gotowych: 30s (fixed, ale zawsze jest delay)

3. **Testy:**
   - Uruchomić kampanię z 30s
   - Sprawdzić czy odstępy są 30-60s
   - Sprawdzić czy pauza działa po 10. mailu

