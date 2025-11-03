# ✅ WERYFIKACJA LOGIKI OBLICZANIA DELAY

**Data:** 2025-11-03  
**Status:** 🔍 WERYFIKACJA PRZED NAPRAWĄ

---

## 📋 ROZUMIENIE LOGIKI

### Twoja logika (jak powinno być):

1. **Oblicz dostępność dzisiaj:**
   - 10 skrzynek × 10 maili każda = 100 maili dzisiaj
   - LUB: Suma `remainingToday` ze wszystkich skrzynek

2. **Oblicz pozostały czas w oknie:**
   - Okno: 9:00-15:00 = 6h = 360 minut = 21600 sekund
   - Z marginesem 1h: 5h = 18000 sekund

3. **Oblicz delay:**
   - Delay = `pozostały czas (sekundy) / dostępne maile dzisiaj`
   - Przykład: 18000s ÷ 100 maili = 180 sekund = 3 minuty

4. **Dodaj losowość ±20%:**
   - Min: 180s × 0.8 = 144 sekundy
   - Max: 180s × 1.2 = 216 sekund
   - Średnio: ~180 sekund

---

## ⚠️ PROBLEM W OBECNEJ IMPLEMENTACJI

### Problem 1: `calculateTodayCapacity` jest źle napisana

```typescript
// BŁĘDNE (linia 122-130 w dynamicEstimator.ts)
for (const mailbox of mailboxes) {
  const available = await getNextAvailableMailbox(virtualSalespersonId);
  
  if (available && available.id === mailbox.id) {
    totalCapacity += available.remainingToday; // ❌ Zawsze zwróci tę samą skrzynkę!
  }
}
```

**Problem:** `getNextAvailableMailbox` zwraca tylko PIERWSZĄ dostępną skrzynkę, więc dla każdej iteracji zwróci tę samą skrzynkę. Nie zsumuje wszystkich skrzynek!

**Powinno być:** Sprawdzić `remainingToday` bezpośrednio dla każdej skrzynki (tak jak robi `getNextAvailableMailbox` wewnątrz).

### Problem 2: `scheduledSender.ts` używa `remainingInLoop` zamiast `calculateTodayCapacity`

```typescript
// BŁĘDNE (linia 607)
const remainingInLoop = leads.length - i - 1;
const optimalDelay = Math.floor(msRemaining / Math.max(1, remainingInLoop));
```

**Problem:** Oblicza na podstawie ile leadów zostało w TEJ iteracji pętli, a nie ile maili MOŻE wysłać dzisiaj.

---

## ✅ ROZWIĄZANIE

### Naprawa 1: Popraw `calculateTodayCapacity`

Muszę stworzyć funkcję która:
- Pobiera wszystkie skrzynki
- Dla każdej skrzynki oblicza `remainingToday` (używając tej samej logiki co `getNextAvailableMailbox`)
- Sumuje wszystkie `remainingToday`
- Zwraca sumę (albo `Math.min(sum, campaignDailyLimit)`)

### Naprawa 2: Użyj `calculateTodayCapacity` w `scheduledSender.ts`

Zamiast:
```typescript
const remainingInLoop = leads.length - i - 1;
```

Powinno być:
```typescript
const { emailsPerDay } = await calculateTodayCapacity(
  campaign.virtualSalespersonId, 
  campaign.maxEmailsPerDay
);
const optimalDelay = Math.floor(secondsRemaining / Math.max(1, emailsPerDay));
```

---

## 🎯 PRZYKŁAD OBLICZENIA

**Dane:**
- 10 skrzynek, każda z limitem 10 maili dziennie
- Obecnie wysłano: 7 maili total (różne skrzynki)
- Pozostało: 93 maile (10×10 - 7)
- Okno czasowe: 9:00-15:00 (z marginesem 1h = 5h = 18000 sekund)
- Obecna godzina: 10:43

**Obliczenie:**
```
Delay = 18000 sekund ÷ 93 maile = 193 sekundy (≈3.2 minuty)
Z ±20%: 155-232 sekundy (≈2.6-3.9 minuty)
```

**To zgadza się z Twoim przykładem:**
- 100 maili ÷ 5h = 20 maili/h = 1 mail co 3 minuty = 180 sekund ✅

---

## ✅ POTWIERDZENIE

Rozumiem Twoją logikę:
1. ✅ Oblicz dostępność dzisiaj na podstawie SKRZYNEK (nie leadów w pętli)
2. ✅ Oblicz delay na podstawie: `czas w oknie / dostępne maile dzisiaj`
3. ✅ Dodaj losowość ±20%
4. ✅ Użyj tego delay do opóźnienia między mailami

**Czy mogę teraz naprawić kod?**

