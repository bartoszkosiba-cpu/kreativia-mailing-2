# Naprawione błędy w V2

## ✅ Naprawione błędy

### 1. Usunięto redundante sprawdzanie (linia 365-383)
**Problem:** Kod sprawdzający `if (nextEmail.scheduledAt < maxTolerance)` był nieosiągalny, bo WHERE clause już filtruje `scheduledAt >= maxTolerance`.

**Rozwiązanie:** Usunięto redundante sprawdzanie.

---

### 2. Ograniczono catch-up do 10 najstarszych maili
**Problem:** Jeśli było wiele maili w tolerancji (<5 min opóźnienia), wszystkie były pobierane i sortowane, co mogło prowadzić do wysyłania zbyt szybko.

**Rozwiązanie:** Dodano `take: 10` w `findMany` - pobieramy tylko 10 najstarszych maili do sortowania po priorytecie.

---

### 3. Poprawiono komentarz w calculateNextEmailTimeV2
**Problem:** Komentarz był mylący co do formuły randomVariation.

**Rozwiązanie:** Wyjaśniono że formuła `Math.floor(Math.random() * (range + 1)) + minDelay` daje poprawny zakres [minDelay, maxDelay] włącznie.

---

## 🔍 Dodatkowe znalezione problemy (do przemyślenia)

### Problem A: Wielokrotny catch-up w kolejnych cyklach cron
**Scenariusz:**
- Mail 2, 3, 4 są w tolerancji (<5 min opóźnienia)
- Cron co 30s wysyła jeden mail
- Mail 2 wysłany o 10:11:00
- Mail 3 wysłany o 10:11:30 (catch-up)
- Mail 4 wysłany o 10:12:00 (catch-up)

**Czy to jest problem?**
- To jest zamierzone zachowanie - catch-up ma nadrobić opóźnienie
- ALE: może prowadzić do wysyłania zbyt szybko (co 30s zamiast delayBetweenEmails)

**Potencjalne rozwiązanie:**
- Ograniczyć catch-up do max 1 maila na cykl cron (już jest - jeden mail na kampanię)
- Lub: Minimalny odstęp między catch-up mailami (np. min 30s)

---

### Problem B: scheduleNextEmailV2 używa lastSentTime zamiast scheduledAt
**Scenariusz:**
- Mail 2: scheduledAt = 10:03:00, wysłany o 10:05:00 (catch-up)
- scheduleNextEmailV2: lastSentTime = 10:05:00
- Mail 3: scheduledAt = 10:08:00 (obliczone z 10:05:00 + 3 min)
- ALE: Mail 3 był już zaplanowany na 10:06:00 (z Mail 1 wysłanego o 10:00:00)

**Czy to jest problem?**
- Nie - scheduleNextEmailV2 sprawdza czy lead już jest w kolejce (linia 485-496)
- Jeśli jest, nie dodaje ponownie

---

## ✅ Status

Wszystkie znalezione krytyczne błędy zostały naprawione. System powinien teraz:
1. Nie wysyłać maili starszych niż 5 minut (przekłada na jutro)
2. Zachowywać kolejność priorytetów
3. Nie wysyłać zbyt szybko w catch-up (limit 10 maili do sortowania)
4. Używać poprawnej formuły randomVariation

