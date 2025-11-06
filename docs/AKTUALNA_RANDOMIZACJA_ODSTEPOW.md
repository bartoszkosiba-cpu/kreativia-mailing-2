# 📊 AKTUALNA RANDOMIZACJA ODSTĘPÓW

**Data:** 2025-11-05

---

## ✅ OBECNE USTAWIENIE

### **Randomizacja:**
- **Wartość:** `randomVariation = 0.2`
- **Oznaczenie:** **±20%**

---

## 📈 JAK TO DZIAŁA

### **1. Dla maili zaplanowanych (w przyszłości):**
**Lokalizacja:** `campaignEmailQueueV2.ts` - `calculateNextEmailTimeV2()`

```typescript
const randomVariation = 0.2; // ±20%
const minDelay = Math.floor(delayBetweenEmails * (1 - randomVariation)); // 80%
const maxDelay = Math.floor(delayBetweenEmails * (1 + randomVariation)); // 120%
```

**Przykład dla `delayBetweenEmails = 90s`:**
- **Min:** 90s × 0.8 = **72s**
- **Max:** 90s × 1.2 = **108s**
- **Zakres:** 72-108 sekund

---

### **2. Dla maili gotowych (`scheduledAt <= now`):**
**Lokalizacja:** `campaignEmailSenderV2.ts` - `processScheduledEmailsV2()`

```typescript
const randomVariation = 0.2; // ±20%
const baseDelay = delayBetweenEmails - cronInterval; // 90 - 30 = 60s
const minDelay = Math.floor(baseDelay * (1 - randomVariation)); // 80% = 48s
const maxDelay = Math.floor(baseDelay * (1 + randomVariation)); // 120% = 72s
```

**Przykład dla `delayBetweenEmails = 90s`:**
- **Base:** 90s - 30s = **60s**
- **Min:** 60s × 0.8 = **48s**
- **Max:** 60s × 1.2 = **72s**
- **Zakres:** 48-72 sekundy

---

## 📊 PODSUMOWANIE

### **Dla kampanii z `delayBetweenEmails = 90s`:**

| Typ maila | Zakres | Obliczenie |
|-----------|--------|------------|
| **Zaplanowane** | 72-108s | 90s ± 20% |
| **Gotowe** | 48-72s | (90s - 30s) ± 20% |

### **Aktualna wartość:**
- **`randomVariation = 0.2`** = **±20%**

---

## 🔧 GDZIE ZMIENIĆ

### **Miejsca w kodzie:**
1. `src/services/campaignEmailQueueV2.ts` - linia 21
2. `src/services/campaignEmailSenderV2.ts` - linia 1405 (dla gotowych maili)
3. `src/services/campaignEmailSenderV2.ts` - linia 1291 (dla recovery)

### **Przykład zmiany na ±30%:**
```typescript
const randomVariation = 0.3; // zamiast 0.2
```

**Dla 90s:**
- Zaplanowane: 63-117s (zamiast 72-108s)
- Gotowe: 42-78s (zamiast 48-72s)

---

## ✅ OBECNY STAN

**Randomizacja:** **±20%** (`randomVariation = 0.2`)

