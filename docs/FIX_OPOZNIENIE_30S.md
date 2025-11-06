# 🔧 FIX: Obliczanie opóźnienia dla delayBetweenEmails = 30s

**Data:** 2025-11-05  
**Problem:** Dla `delayBetweenEmails = 30s`, gotowe maile miały `baseDelay = 0s` → brak randomizacji

---

## ❌ PROBLEM

### **Dla delayBetweenEmails = 30s:**

**Zaplanowane maile:**
- ✅ `minDelay = 30s`, `maxDelay = 60s` → zakres 30-60s (działa)

**Gotowe maile:**
- ❌ `baseDelay = 30s - 30s = 0s`
- ❌ `minDelay = 0s`, `maxDelay = 0s`
- ❌ `correctedTime = 0ms` → wysyłka natychmiastowa (cron decyduje)
- ❌ **Brak randomizacji!**

---

## ✅ ROZWIĄZANIE

### **Zmieniona logika:**

```typescript
const baseDelay = delayBetweenEmails - cronInterval; // 30 - 30 = 0s

// ⚠️ FIX: Jeśli baseDelay <= 0, użyj minimum delay
const minDelay = baseDelay > 0 
  ? baseDelay 
  : Math.max(30, delayBetweenEmails * 0.5); // Minimum 30s lub 50% delayBetweenEmails

const maxDelay = baseDelay > 0 
  ? baseDelay * 2 
  : delayBetweenEmails; // Jeśli baseDelay <= 0, użyj delayBetweenEmails jako max
```

### **Dla delayBetweenEmails = 30s:**

**Gotowe maile:**
- `baseDelay = 0s` (≤ 0)
- `minDelay = Math.max(30, 30 * 0.5) = 30s` ✅
- `maxDelay = 30s` ✅
- **Zakres:** 30-30s (fixed delay, ale zawsze jest delay)

**Dla delayBetweenEmails = 60s:**

**Gotowe maile:**
- `baseDelay = 60s - 30s = 30s` (> 0)
- `minDelay = 30s` ✅
- `maxDelay = 60s` ✅
- **Zakres:** 30-60s (randomizacja działa)

---

## 📊 PRZYKŁADY

### **delayBetweenEmails = 30s:**

**Zaplanowane maile:**
- Zakres: 30-60s ✅

**Gotowe maile:**
- Zakres: 30-30s (fixed 30s) ✅
- **Zawsze będzie 30s delay** (nie natychmiastowa wysyłka)

### **delayBetweenEmails = 90s:**

**Zaplanowane maile:**
- Zakres: 90-180s ✅

**Gotowe maile:**
- Zakres: 60-120s ✅
- **Randomizacja działa**

---

## 🔧 ZMIANY W KODZIE

1. **`processScheduledEmailsV2()`** - główna logika dla gotowych maili
2. **`recoverStuckEmailsAfterRestart()`** - recovery dla stuck maili

**Oba miejsca używają teraz tej samej logiki:**
```typescript
const minDelay = baseDelay > 0 
  ? baseDelay 
  : Math.max(30, delayBetweenEmails * 0.5);
const maxDelay = baseDelay > 0 
  ? baseDelay * 2 
  : delayBetweenEmails;
```

---

## ✅ WYNIK

**Dla delayBetweenEmails = 30s:**
- ✅ Zaplanowane maile: 30-60s (randomizacja)
- ✅ Gotowe maile: 30s (fixed, ale zawsze jest delay)
- ✅ **Brak natychmiastowej wysyłki** (cron nie decyduje o czasie)

**Dla delayBetweenEmails > 30s:**
- ✅ Zaplanowane maile: delayBetweenEmails - delayBetweenEmails*2 (randomizacja)
- ✅ Gotowe maile: (delayBetweenEmails - 30s) - (delayBetweenEmails - 30s)*2 (randomizacja)
- ✅ **Randomizacja działa poprawnie**

