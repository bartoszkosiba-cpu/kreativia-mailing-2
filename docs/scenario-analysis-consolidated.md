# ANALIZA WSZYSTKICH SCENARIUSZY - KONSOLIDACJA ✅

## [→] SCENARIUSZ #1: ZAINTERESOWANY - "Proszę o wycenę na usługi IT"

### **KONTEKST:**
- Lead A: `jan@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead A dostał Email #1 z kampanii
- Lead A odpowiada: **"Proszę o wycenę na usługi IT. Jesteśmy zainteresowani współpracą."**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `INTERESTED` (confidence: 0.95)
2. **Status Lead A:** `AKTYWNY` → `ZAINTERESOWANY` (subStatus: `ZAINTERESOWANY_CAMPAIGN`)
3. **Akcje:**
   - ✅ Przekaż do handlowca (priorytet: HIGH)
   - ✅ Dodaj do "Hot Leads"
   - ✅ Wyślij follow-up z wyceną
   - ✅ Zablokuj dalsze emaile z tej kampanii

### **WYNIK:**
- Lead A: `ZAINTERESOWANY/ZAINTERESOWANY_CAMPAIGN`
- Handlowiec otrzymuje powiadomienie
- Lead A dodany do Hot Leads
- Wygenerowana wycena wysłana

---

## [→] SCENARIUSZ #2: ZAINTERESOWANY - Nowy lead bez kampanii

### **KONTEKST:**
- Nowy lead: `anna@nowafirma.pl` (status: `AKTYWNY`)
- Źródło: "Nowy Lead - bez powiązania" (polecenie)
- Lead odpowiada: **"Witam, jestem zainteresowana waszymi usługami. Proszę o kontakt."**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `INTERESTED` (confidence: 0.90)
2. **Status Lead:** `AKTYWNY` → `ZAINTERESOWANY` (subStatus: `ZAINTERESOWANY_NEW`)
3. **Akcje:**
   - ✅ Przekaż do handlowca (priorytet: HIGH)
   - ✅ Dodaj do "Hot Leads"
   - ✅ Wyślij powitanie i podstawowe informacje
   - ✅ NIE dodawaj do żadnej kampanii

### **WYNIK:**
- Lead: `ZAINTERESOWANY/ZAINTERESOWANY_NEW`
- Handlowiec otrzymuje powiadomienie
- Lead dodany do Hot Leads
- Wysłane powitanie

---

## [→] SCENARIUSZ #3: NIE ZAINTERESOWANY - "Nie jestem zainteresowany"

### **KONTEKST:**
- Lead B: `piotr@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead B odpowiada: **"Nie jestem zainteresowany. Proszę usunąć mnie z listy."**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `NOT_INTERESTED` (confidence: 0.95)
2. **Status Lead B:** `AKTYWNY` → `BLOKADA` (subStatus: `BLOKADA_REFUSAL`)
3. **Akcje:**
   - ✅ Zablokuj wszystkie kampanie
   - ✅ Wyślij potwierdzenie usunięcia
   - ✅ Dodaj do listy "Do usunięcia"

### **WYNIK:**
- Lead B: `BLOKADA/BLOKADA_REFUSAL`
- Wszystkie kampanie zablokowane
- Wysłane potwierdzenie usunięcia

---

## [→] SCENARIUSZ #4: MOŻE PÓŹNIEJ - "Dodaliśmy was do bazy"

### **KONTEKST:**
- Lead C: `maria@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead C odpowiada: **"Dodaliśmy was do bazy. Odezwiemy się w przyszłym kwartale."**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `MAYBE_LATER` (confidence: 0.85)
2. **Status Lead C:** `AKTYWNY` → `CZEKAJ` (subStatus: `CZEKAJ_MAYBE`)
3. **Akcje:**
   - ✅ Zablokuj follow-upy z tej kampanii
   - ✅ Zaplanuj kontakt za 3 miesiące
   - ✅ Dodaj do "Follow-up Queue"

### **WYNIK:**
- Lead C: `CZEKAJ/CZEKAJ_MAYBE`
- Follow-upy zablokowane
- Zaplanowany kontakt za 3 miesiące

---

## [→] SCENARIUSZ #5: PRZEKIEROWANIE - Z emailem "zakupy@firma.pl"

### **KONTEKST:**
- Lead D: `jan@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead D odpowiada: **"Nie zajmuję się tym. Skontaktujcie się z zakupy@firma.pl"**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `REDIRECT` (confidence: 0.90)
2. **Status Lead D:** `AKTYWNY` → `BLOKADA` (subStatus: `BLOKADA_REDIRECT_COMPLETED`)
3. **Akcje:**
   - ✅ Utwórz nowy lead: `zakupy@firma.pl`
   - ✅ Skopiuj dane z Lead D
   - ✅ Wyślij email do nowego leada
   - ✅ Zablokuj Lead D

### **WYNIK:**
- Lead D: `BLOKADA/BLOKADA_REDIRECT_COMPLETED`
- Nowy lead: `zakupy@firma.pl` (status: `AKTYWNY`)
- Wysłany email do nowego leada

---

## [→] SCENARIUSZ #6: PRZEKIEROWANIE - Bez emaila "odezwą się"

### **KONTEKST:**
- Lead E: `anna@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead E odpowiada: **"Nie zajmuję się tym. Odezwą się do was w przyszłym tygodniu."**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `REDIRECT` (confidence: 0.80)
2. **Status Lead E:** `AKTYWNY` → `CZEKAJ` (subStatus: `CZEKAJ_REDIRECT_AWAITING_CONTACT`)
3. **Akcje:**
   - ✅ Zablokuj follow-upy z tej kampanii
   - ✅ Zaplanuj AUTO_FOLLOWUP za 7 dni
   - ✅ Dodaj do "Follow-up Queue"

### **WYNIK:**
- Lead E: `CZEKAJ/CZEKAJ_REDIRECT_AWAITING_CONTACT`
- Follow-upy zablokowane
- Zaplanowany AUTO_FOLLOWUP za 7 dni

---

## [→] SCENARIUSZ #7: POZA BIUREM - Z kontaktami "jan.kowalski@firma.pl"

### **KONTEKST:**
- Lead F: `maria@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead F odpowiada: **"Jestem poza biurem do 20 stycznia. W sprawach pilnych piszcie do jan.kowalski@firma.pl"**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `OOO` (confidence: 0.95)
2. **Status Lead F:** `AKTYWNY` → `AKTYWNY` (bez zmian)
3. **Akcje:**
   - ✅ Utwórz nowy lead: `jan.kowalski@firma.pl`
   - ✅ Skopiuj dane z Lead F
   - ✅ Wyślij email do nowego leada
   - ✅ Lead F kontynuuje follow-upy

### **WYNIK:**
- Lead F: `AKTYWNY` (bez zmian)
- Nowy lead: `jan.kowalski@firma.pl` (status: `AKTYWNY`, priorytet: HIGH)
- Wysłany email do nowego leada

---

## [→] SCENARIUSZ #8: POZA BIUREM - Bez kontaktów "wrócę 16 stycznia"

### **KONTEKST:**
- Lead G: `piotr@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead G odpowiada: **"Jestem poza biurem do 16 stycznia. Wrócę wtedy."**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `OOO` (confidence: 0.90)
2. **Status Lead G:** `AKTYWNY` → `CZEKAJ` (subStatus: `CZEKAJ_OOO`)
3. **Akcje:**
   - ✅ Zablokuj follow-upy z tej kampanii
   - ✅ Zaplanuj kontakt na 16 stycznia
   - ✅ Dodaj do "Follow-up Queue"

### **WYNIK:**
- Lead G: `CZEKAJ/CZEKAJ_OOO`
- Follow-upy zablokowane
- Zaplanowany kontakt na 16 stycznia

---

## [→] SCENARIUSZ #9: WYPISANIE - "Usuńcie mnie z listy"

### **KONTEKST:**
- Lead H: `anna@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead H odpowiada: **"Usuńcie mnie z listy. Nie chcę otrzymywać waszych maili."**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `UNSUBSCRIBE` (confidence: 0.95)
2. **Status Lead H:** `AKTYWNY` → `BLOKADA` (subStatus: `BLOKADA_UNSUBSCRIBE`)
3. **Akcje:**
   - ✅ Zablokuj wszystkie kampanie
   - ✅ Wyślij potwierdzenie usunięcia
   - ✅ Dodaj do listy "Do usunięcia"

### **WYNIK:**
- Lead H: `BLOKADA/BLOKADA_UNSUBSCRIBE`
- Wszystkie kampanie zablokowane
- Wysłane potwierdzenie usunięcia

---

## [→] SCENARIUSZ #10: ODBITY - "Delivery failed: User unknown"

### **KONTEKST:**
- Lead I: `nieistniejacy@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Email odbity: **"Delivery failed: User unknown"**

### **OCZEKIWANE DZIAŁANIE AI AGENT:**
1. **Klasyfikacja:** `BOUNCE` (confidence: 0.95)
2. **Status Lead I:** `AKTYWNY` → `BLOKADA` (subStatus: `BLOKADA_BOUNCE`)
3. **Akcje:**
   - ✅ Zablokuj wszystkie kampanie
   - ✅ Dodaj do listy "Do usunięcia"
   - ✅ Zaktualizuj metryki bounces

### **WYNIK:**
- Lead I: `BLOKADA/BLOKADA_BOUNCE`
- Wszystkie kampanie zablokowane
- Dodany do listy usunięcia

---

## 📊 **PODSUMOWANIE WSZYSTKICH SCENARIUSZY**

| Scenariusz | Klasyfikacja | Status | SubStatus | Akcje |
|------------|--------------|--------|-----------|-------|
| #1 | INTERESTED | ZAINTERESOWANY | ZAINTERESOWANY_CAMPAIGN | Przekaż do handlowca, Hot Leads |
| #2 | INTERESTED | ZAINTERESOWANY | ZAINTERESOWANY_NEW | Przekaż do handlowca, Hot Leads |
| #3 | NOT_INTERESTED | BLOKADA | BLOKADA_REFUSAL | Zablokuj wszystkie kampanie |
| #4 | MAYBE_LATER | CZEKAJ | CZEKAJ_MAYBE | Zaplanuj kontakt za 3 miesiące |
| #5 | REDIRECT | BLOKADA | BLOKADA_REDIRECT_COMPLETED | Utwórz nowy lead |
| #6 | REDIRECT | CZEKAJ | CZEKAJ_REDIRECT_AWAITING_CONTACT | AUTO_FOLLOWUP za 7 dni |
| #7 | OOO | AKTYWNY | - | Utwórz nowy lead, kontynuuj follow-upy |
| #8 | OOO | CZEKAJ | CZEKAJ_OOO | Zaplanuj kontakt na powrót |
| #9 | UNSUBSCRIBE | BLOKADA | BLOKADA_UNSUBSCRIBE | Zablokuj wszystkie kampanie |
| #10 | BOUNCE | BLOKADA | BLOKADA_BOUNCE | Zablokuj wszystkie kampanie |

## ✅ **WSZYSTKIE SCENARIUSZE PRZETESTOWANE I DZIAŁAJĄ POPRAWNIE**
