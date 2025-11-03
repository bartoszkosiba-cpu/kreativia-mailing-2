# ✅ PROSTA LOGIKA WYSYŁKI - ODYPORNA NA AWARIE

## 🎯 GŁÓWNA ZASADA
**Cron co 1 minutę → wysyła TYLKO JEDEN mail (jeśli delay minął)**

---

## 📋 ALGORYTM (CO 1 MINUTĘ):

```
1. Pobierz kampanie IN_PROGRESS
2. Dla każdej kampanii:
   
   A. ODŚWIEŻ USTAWIENIA KAMPANII (na wypadek zmiany okna czasowego)
   
   B. Sprawdź czy jest w oknie czasowym (z aktualnymi ustawieniami)
      → Jeśli NIE: zatrzymaj kampanię (status -> SCHEDULED)
   
   C. Pobierz JEDEN najstarszy lead ze statusem "queued" (ORDER BY createdAt ASC, LIMIT 1)
      → Jeśli brak: kontynuuj do następnej kampanii
   
   D. ATOMOWA BLOKADA: queued -> sending (updateMany WHERE status='queued')
      → Jeśli count=0: inny proces już zajął → kontynuuj do następnej kampanii
   
   E. SPRAWDŹ SENDLOG (czy mail już wysłany)
      → Jeśli TAK: przywróć sending -> queued, kontynuuj
      → Jeśli NIE: kontynuuj
   
   F. SPRAWDŹ TIMEOUT (jeśli sending > 10 minut → prawdopodobnie przerwane)
      → Sprawdź SendLog raz jeszcze (na wypadek że zapisał się później)
      → Jeśli nadal brak → przywróć sending -> queued
   
   G. Sprawdź delay od ostatniego maila w kampanii
      → Jeśli NIE minął: przywróć sending -> queued, kontynuuj
      → Jeśli minął: kontynuuj
   
   H. Sprawdź limity (mailbox, handlowiec, kampania)
      → Jeśli brak: przywróć sending -> queued, zatrzymaj kampanię
      → Jeśli OK: kontynuuj
   
   I. WYŚLIJ MAIL
      → Zapisz do SendLog
      → Aktualizuj sending -> sent
      → Inkrementuj liczniki
   
   J. KONIEC (tylko 1 mail na wywołanie cron)
```

---

## ✅ ODPORNOŚĆ NA AWARIE:

### SCENARIUSZ 1: Serwer zatrzymuje się PRZED wysyłką
- Lead: "queued" → OK, zostanie wysłany po powrocie

### SCENARIUSZ 2: Serwer zatrzymuje się W TRAKCIE wysyłki (po atomowej blokadzie)
- Lead: "sending"
- Po powrocie:
  - Sprawdza SendLog → jeśli mail wysłany → pomija ✅
  - Sprawdza timeout → jeśli >10 min → przywraca queued
  - Jeśli SendLog pusty → wysyła (ale to oznacza że mail się nie wysłał)

### SCENARIUSZ 3: Serwer zatrzymuje się PO wysłaniu (przed zapisaniem SendLog)
- Lead: "sending"
- Mail: WYSŁANY (SMTP)
- SendLog: PUSTY (błąd)
- Po powrocie:
  - Sprawdza SendLog → pusty ❌
  - Wysyła duplikat ❌ **TO JEST PROBLEM!**

**ROZWIĄZANIE:** Dodać sprawdzanie w SendLog PRZED przywróceniem do queued:
- Jeśli sending > 10 min → sprawdź SendLog + sprawdź czy messageId już istnieje
- Jeśli messageId istnieje → mail już wysłany, oznacz jako sent

### SCENARIUSZ 4: Serwer zatrzymuje się na 1h w środku dnia
- Kampania: IN_PROGRESS
- Leady: "queued" (gotowe)
- Po powrocie:
  - Sprawdza okno czasowe → jeśli minęło → zatrzymuje kampanię ✅
  - Jeśli w oknie → kontynuuje wysyłkę ✅
  - Delay się przeliczy automatycznie ✅

### SCENARIUSZ 5: Serwer zatrzymuje się NA NOC (okno czasowe się skończyło)
- Po powrocie rano:
  - Sprawdza okno czasowe → jeśli nie jest w oknie → zatrzymuje ✅
  - Następnego dnia: cron znajdzie kampanię SCHEDULED → kontynuuje ✅

---

## 🔧 ULEPSZENIA:

1. **Timeout dla "sending":**
   - Jeśli sending > 10 minut → przywróć do queued (ale sprawdź SendLog PRZED)

2. **Sprawdzanie messageId:**
   - Po wysłaniu maila zapisuj messageId do SendLog
   - Przy przywracaniu "sending" sprawdź czy messageId już istnieje (na wypadek że SendLog zapisał się później)

3. **Logowanie:**
   - Zapisuj kiedy lead został zmieniony na "sending"
   - Dzięki temu możemy obliczyć timeout

---

## ❌ PROBLEMY DO ROZWIĄZANIA:

1. **Race condition w SendLog:**
   - Mail wysłany, ale SendLog nie zapisany → duplikat
   - **ROZWIĄZANIE:** Sprawdzać SendLog PRZED przywróceniem queued, nie PO

2. **Timeout detection:**
   - Jak wykryć że "sending" jest za długo?
   - **ROZWIĄZANIE:** Dodać `sendingStartedAt` timestamp do CampaignLead

3. **Częstotliwość cron:**
   - Co 1 minutę jest OK dla precyzji, ale może być zbyt często
   - **ALTERNATYWA:** Co 30 sekund? (ale to może być zbyt agresywne)

