# 🎯 OPCJE DLA DELAY WYSYŁKI

## OPCJA A: STAŁY DELAY (PROSTY) ✅ **ZALECANY DLA ODYPOORNOŚCI**

```
1. Zawsze użyj: delay = 90s ±20% (losowo)
2. Nie próbuj równomiernie rozkładać
3. Jeśli limit dzienny osiągnięty → zatrzymaj kampanię
4. Jeśli okno czasowe się skończyło → zatrzymaj kampanię
5. Następnego dnia → wznowij automatycznie
```

**Zalety:**
- ✅ Prosty i zrozumiały
- ✅ Odporny na awarie (nie trzeba przeliczać)
- ✅ Przewidywalny

**Wady:**
- ❌ Maile mogą być skoncentrowane na początku dnia (jeśli limit pozwala)
- ❌ Jeśli jest dużo czasu i mało maili → wysyła szybko (90s)

---

## OPCJA B: ADAPTACYJNY DELAY (RÓWNOMIERNY ROZKŁAD)

```
1. Bazowy delay: 90s ±20%
2. Oblicz: ile maili zostało dzisiaj vs ile czasu pozostało
3. Jeśli obliczysz że trzeba wysłać szybciej → użyj bazowego (90s)
4. Jeśli obliczysz że można wysłać wolniej → zwiększ delay (max 2x = 180s)
5. Równomiernie rozłóż maile w oknie czasowym
```

**Przykład:**
- 50 maili do wysłania
- 5 godzin pozostało (9:00-14:00)
- Obliczenie: 5h = 18000s / 50 maili = 360s na mail
- Ale max to 2x bazowego (180s)
- Delay: 180s ±20% (zamiast 90s)

**Zalety:**
- ✅ Równomierny rozkład maili w ciągu dnia
- ✅ Lepsze wykorzystanie okna czasowego
- ✅ Maile nie są skupione na początku

**Wady:**
- ⚠️ Trzeba przeliczać po awarii (może być błędne)
- ⚠️ Bardziej skomplikowany kod
- ⚠️ Jeśli awaria trwała 1h → przeliczenie może być nieprecyzyjne

---

## 🎯 REKOMENDACJA:

**Dla stabilności i odporności na awarie → OPCJA A (stały delay)**

Ale jeśli chcesz równomierny rozkład → OPCJA B z zabezpieczeniem:
- Po awarii zawsze resetuj do bazowego delay (90s)
- Przeliczaj dopiero po 10 minutach stabilnej pracy
- Maksymalny delay = 2x bazowego (nie więcej)

---

## ❓ PYTANIE:

**Co wolisz?**
1. **Prosty stały delay** (90s ±20%) - odporny na awarie
2. **Adaptacyjny delay** (90s-180s) - równomierny rozkład

