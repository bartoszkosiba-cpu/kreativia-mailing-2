# ⏸️ ANALIZA PAUZY CO 10 MAILI - OD RESTARTU

**Data:** 2025-11-05  
**Okres:** Od 20:48:18 (po restarcie)  
**Kampania:** 4 - delayBetweenEmails = 60s

---

## 📊 WYSŁANE MAILE OD RESTARTU

### **Statystyki:**
- **Wysłano:** 16 maili (od 20:48:18 do 21:09:38)
- **Total wysłanych (wszystkie):** 130 maili
- **Pierwszy mail:** 20:48:18
- **Ostatni mail:** 21:09:38

---

## ⏸️ PAUZA CO 10 MAILI - ANALIZA

### **Założenia:**
- Po 10., 20., 30., ... mailu (total) → pauza 10-15 min (600-900s)

### **Faktyczne (od restartu):**

**Mail 6 (20:55:12) = 120. mail total:**
- `sentCount = 120`
- `120 % 10 = 0` → **POWINNA BYĆ PAUZA**
- Następny mail (7): 20:56:34
- **Odstęp:** 82.0s (1.37 min) ❌
- **Problem:** NIE BYŁO PAUZY (powinno być 10-15 min)

**Mail 10 (21:02:37) = 124. mail total:**
- `sentCount = 124`
- `124 % 10 = 4` → nie jest wielokrotnością 10
- Następny mail (11): 21:03:58
- **Odstęp:** 80.2s (1.34 min) ✅
- **Wniosek:** To nie jest mail z pauzą (124 nie jest wielokrotnością 10)

**Mail 16 (21:09:38) = 130. mail total:**
- `sentCount = 130`
- `130 % 10 = 0` → **POWINNA BYĆ PAUZA**
- Następny mail: jeszcze nie wysłany
- **Status:** Oczekiwanie na następny mail

---

## ❌ PROBLEM: PAUZA NIE DZIAŁA

### **Problem 1: Po 120. mailu (6. mail od restartu)**
- **Założenia:** Pauza 10-15 min
- **Faktyczne:** 82.0s (1.37 min) ❌
- **Problem:** NIE BYŁO PAUZY

### **Problem 2: Po 130. mailu (16. mail od restartu)**
- **Założenia:** Pauza 10-15 min
- **Faktyczne:** Oczekiwanie na następny mail
- **Status:** Nie wiemy jeszcze czy będzie pauza

---

## 🔍 ANALIZA KODU

### **Logika pauzy:**
```typescript
const sentCount = await db.sendLog.count({
  where: { campaignId, status: 'sent' }
});

if (sentCount > 0 && sentCount % 10 === 0) {
  // Dodaj pauzę 10-15 min
}
```

**Problem:**
- `sentCount` jest liczone PRZED planowaniem następnego maila
- Jeśli wysłano 120. mail → `sentCount = 120` → `120 % 10 === 0` → powinna być pauza
- Ale faktycznie nie było pauzy

**Możliwe przyczyny:**
1. `scheduleNextEmailV2()` nie jest wywoływane po każdym mailu
2. `isWithinSendWindow()` nadpisuje pauzę
3. Logika pauzy nie działa poprawnie

---

## 📊 ODSTĘPY MIĘDZY MAILAMI (OD RESTARTU)

| Mail | Czas | Total | Odstęp (s) | Odstęp (min) | Pauza? |
|------|------|-------|------------|--------------|--------|
| 1 | 20:48:18 | 115 | - | - | - |
| 2 | 20:49:45 | 116 | 86.9 | 1.45 | - |
| 3 | 20:51:36 | 117 | 111.0 | 1.85 | - |
| 4 | 20:53:20 | 118 | 104.0 | 1.73 | - |
| 5 | 20:54:29 | 119 | 69.0 | 1.15 | - |
| 6 | 20:55:12 | 120 | 43.0 | 0.72 | - |
| 7 | 20:56:34 | 121 | 82.0 | 1.37 | ❌ **BRAK PAUZY** (powinno być 10-15 min) |
| 8 | 20:57:41 | 122 | 67.0 | 1.12 | - |
| 9 | 20:59:59 | 123 | 137.4 | 2.29 | - |
| 10 | 21:02:37 | 124 | 158.7 | 2.65 | - |
| 11 | 21:03:58 | 125 | 80.2 | 1.34 | - |
| 12 | 21:04:37 | 126 | 39.5 | 0.66 | - |
| 13 | 21:06:23 | 127 | 105.7 | 1.76 | - |
| 14 | 21:07:15 | 128 | 51.8 | 0.86 | - |
| 15 | 21:08:57 | 129 | 102.1 | 1.70 | - |
| 16 | 21:09:38 | 130 | 41.2 | 0.69 | ❓ **OCZEKIWANIE** (powinna być pauza) |

---

## ❌ WNIOSEK

### **Problem:**
- ❌ **Pauza co 10 maili NIE DZIAŁA**
- Po 120. mailu (6. mail od restartu): 82.0s zamiast 10-15 min
- Po 130. mailu (16. mail od restartu): Oczekiwanie na następny mail

### **Możliwe przyczyny:**
1. `scheduleNextEmailV2()` nie jest wywoływane po każdym mailu
2. `isWithinSendWindow()` nadpisuje pauzę
3. Logika pauzy nie działa poprawnie

### **Co sprawdzić:**
1. Czy `scheduleNextEmailV2()` jest wywoływane po każdym mailu?
2. Czy `isWithinSendWindow()` nadpisuje pauzę?
3. Czy logika pauzy działa poprawnie?

