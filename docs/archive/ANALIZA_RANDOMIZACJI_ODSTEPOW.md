# ANALIZA RANDOMIZACJI ODSTĘPÓW ±20%

## 📊 DANE Z BAZY DANYCH

### Odstępy między `scheduledAt` (zaplanowane):
- 99s, 95s, 106s, 83s, 102s, 87s, 100s, 108s
- **Zakres:** [83, 108]s
- **Średnia:** 97.5s
- **✅ Randomizacja działa!** Wszystkie wartości w zakresie [72, 108]s

### Odstępy między `sentAt` (rzeczywiste wysłanie):
- 94s, 100s, 105s, 90s, 90s, 94s, 100s, 105s
- **Zakres:** [90, 105]s
- **Średnia:** 97.25s
- **⚠️ Wyglądają równiej** - wielokrotności ~5s (90, 94, 100, 105)

## 🔍 DIAGNOZA

### ✅ Randomizacja działa
- `calculateNextEmailTimeV2()` używa `Math.random()` i generuje losowe wartości [72-108]s
- `scheduledAt` ma różne odstępy ✅

### ⚠️ Problem: Odstępy rzeczywiste wyglądają równiej
- `sentAt` ma bardziej równomierne odstępy [90-105]s
- To może być efekt:
  1. **Cron co 30s** - mail jest wysyłany z opóźnieniem (wielokrotność 30s)
  2. **setTimeout(0)** - może mieć małe opóźnienie, ale to jest OK
  3. **Użycie `sentAt` jako bazę** - jeśli mail jest wysyłany z opóźnieniem, następny mail jest planowany od `sentAt`, nie od `scheduledAt`

## 📝 PRZYKŁAD

**Mail 1:**
- `scheduledAt = 10:07:26` (zaplanowany)
- Wysłany o `sentAt = 10:07:36` (opóźnienie 10s)
- `scheduleNextEmailV2(..., 10:07:36, 90)` → używa `sentAt` jako bazę
- Następny mail: `scheduledAt = 10:07:36 + 89s = 10:09:05`

**Mail 2:**
- `scheduledAt = 10:09:05` (zaplanowany)
- Wysłany o `sentAt = 10:09:11` (opóźnienie 6s)
- Odstęp rzeczywisty: `10:09:11 - 10:07:36 = 95s`
- Następny mail: `scheduledAt = 10:09:11 + 95s = 10:10:46`

**Problem:**
- Jeśli każdy mail jest wysyłany z opóźnieniem, `sentAt` jest późniejszy niż `scheduledAt`
- Następny mail jest planowany od `sentAt`, nie od `scheduledAt`
- To powoduje że odstępy rzeczywiste są większe niż zaplanowane

## 🎯 WNIOSEK

**Randomizacja ±20% DZIAŁA** - `scheduledAt` ma różne odstępy [72-108]s.

**ALE** odstępy rzeczywiste (`sentAt`) wyglądają równiej, bo:
1. Cron co 30s powoduje że `sentAt` jest wielokrotnością ~30s
2. Użycie `sentAt` jako bazę powoduje akumulację opóźnień

**Rozwiązanie:** Używać `scheduledAt` zamiast `sentAt` jako bazę do planowania następnego maila (zgodnie z poprzednią analizą).

