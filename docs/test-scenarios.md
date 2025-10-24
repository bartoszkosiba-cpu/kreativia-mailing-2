# TEST SCENARIUSZY - ODPOWIEDZI OD LEADÓW

## [→] 10 RÓŻNYCH ODPOWIEDZI NA KAMPANIE

### **1. ZAINTERESOWANY - Bezpośrednie zapytanie**
```
"Proszę o wycenę na usługi IT. Jesteśmy zainteresowani współpracą."
```
**Oczekiwany status:** `ZAINTERESOWANY` (ZAINTERESOWANY_CAMPAIGN)
**Akcja:** FORWARD do handlowca

### **2. ZAINTERESOWANY - Nowy lead bez kampanii**
```
"Witam, słyszałem o waszych usługach od znajomego. Proszę o kontakt."
```
**Oczekiwany status:** `ZAINTERESOWANY` (ZAINTERESOWANY_NEW)
**Akcja:** FORWARD do handlowca

### **3. NOT_INTERESTED - Kategoryczna odmowa**
```
"Nie jestem zainteresowany. Proszę usunąć mnie z listy mailingowej."
```
**Oczekiwany status:** `BLOKADA` (BLOKADA_REFUSAL)
**Akcja:** Brak - trwale zablokowany

### **4. MAYBE_LATER - Miękka odmowa**
```
"Dziękuję za ofertę. Dodaliśmy was do naszej bazy i odezwiemy się jak będziemy potrzebować."
```
**Oczekiwany status:** `CZEKAJ` (CZEKAJ_MAYBE)
**Akcja:** Brak - czeka na reaktywację ręczną

### **5. REDIRECT - Z emailem**
```
"Przekazuję państwa ofertę do działu zakupów. Proszę pisać na: zakupy@firma.pl"
```
**Oczekiwany status:** 
- Lead A → `AKTYWNY` (kontynuuje)
- Lead B → `AKTYWNY` (nowy lead z emailem zakupy@firma.pl)

### **6. REDIRECT - Bez emaila**
```
"Przekazuję państwa ofertę do odpowiedniego działu. Odezwą się do państwa."
```
**Oczekiwany status:** `CZEKAJ` (CZEKAJ_REDIRECT)
**Akcja:** AUTO_FOLLOWUP - "Czy mogę prosić o kontakt do odpowiedniego działu?"

### **7. OOO - Z kontaktami zastępczymi**
```
"Jestem na urlopie do 15 stycznia. Pod moją nieobecność proszę pisać do jan.kowalski@firma.pl"
```
**Oczekiwany status:**
- Lead A → `CZEKAJ` (CZEKAJ_OOO_WITH_CONTACTS)
- Lead B → `AKTYWNY` (nowy lead z emailem jan.kowalski@firma.pl)

### **8. OOO - Bez kontaktów**
```
"Jestem na urlopie do 15 stycznia. Wrócę 16 stycznia."
```
**Oczekiwany status:** `CZEKAJ` (CZEKAJ_OOO)
**Akcja:** Brak - czeka na powrót

### **9. UNSUBSCRIBE - Prośba o wypisanie**
```
"Proszę usunąć mnie z listy mailingowej. Nie chcę otrzymywać więcej maili."
```
**Oczekiwany status:** `BLOKADA` (BLOKADA_UNSUBSCRIBE)
**Akcja:** Brak - trwale zablokowany

### **10. BOUNCE - Email odbity**
```
"Delivery failed: User unknown"
```
**Oczekiwany status:** `BLOKADA` (BLOKADA_BOUNCE)
**Akcja:** Brak - trwale zablokowany

---

## [→] DODATKOWE SCENARIUSZE TESTOWE

### **11. REAKTYWACJA - Z BLOKADA do ZAINTERESOWANY**
```
"Przepraszam za wcześniejszą odmowę. Teraz jesteśmy zainteresowani współpracą."
```
**Oczekiwany status:** `ZAINTERESOWANY` (ZAINTERESOWANY_REACTIVATED)
**Akcja:** FORWARD do handlowca

### **12. OOO - Z wieloma kontaktami**
```
"Jestem na urlopie. Proszę pisać do: jan.kowalski@firma.pl, maria.nowak@firma.pl"
```
**Oczekiwany status:**
- Lead A → `CZEKAJ` (CZEKAJ_OOO_WITH_CONTACTS)
- Lead B → `AKTYWNY` (jan.kowalski@firma.pl)
- Lead C → `AKTYWNY` (maria.nowak@firma.pl)

### **13. REDIRECT - Z wieloma emailami**
```
"Przekazuję do działu zakupów: zakupy@firma.pl i technicznego: tech@firma.pl"
```
**Oczekiwany status:**
- Lead A → `AKTYWNY` (kontynuuje)
- Lead B → `AKTYWNY` (zakupy@firma.pl)
- Lead C → `AKTYWNY` (tech@firma.pl)

### **14. MAYBE_LATER - Z konkretnym terminem**
```
"Dziękuję za ofertę. Skontaktujemy się w marcu 2025."
```
**Oczekiwany status:** `CZEKAJ` (CZEKAJ_MAYBE)
**Akcja:** Brak - czeka na reaktywację ręczną

### **15. ZAINTERESOWANY - Z pytaniami**
```
"Jesteśmy zainteresowani. Jakie są wasze ceny? Jaki jest czas realizacji?"
```
**Oczekiwany status:** `ZAINTERESOWANY` (ZAINTERESOWANY_CAMPAIGN)
**Akcja:** FORWARD do handlowca

---

## [→] INSTRUKCJE TESTOWANIA

1. **Prześlij każdą odpowiedź** przez system AI Agent
2. **Sprawdź klasyfikację** - czy AI poprawnie rozpoznał typ
3. **Sprawdź status leada** - czy został ustawiony zgodnie z oczekiwaniami
4. **Sprawdź akcje** - czy zostały wykonane odpowiednie akcje
5. **Sprawdź nowe leady** - czy zostały utworzone (dla OOO/REDIRECT)
6. **Sprawdź powiązania** - czy originalLeadId jest ustawiony poprawnie

---

## [→] OCZEKIWANE WYNIKI

| Odpowiedź | Klasyfikacja AI | Status Lead A | Status Lead B | Akcja |
|-----------|----------------|---------------|---------------|-------|
| 1. Zainteresowany | INTERESTED | ZAINTERESOWANY | - | FORWARD |
| 2. Nowy lead | INTERESTED | ZAINTERESOWANY | - | FORWARD |
| 3. Odmowa | NOT_INTERESTED | BLOKADA | - | Brak |
| 4. Może później | MAYBE_LATER | CZEKAJ | - | Brak |
| 5. Redirect z emailem | REDIRECT | AKTYWNY | AKTYWNY | Utwórz Lead B |
| 6. Redirect bez emaila | REDIRECT | CZEKAJ | - | AUTO_FOLLOWUP |
| 7. OOO z kontaktami | OOO | CZEKAJ | AKTYWNY | Utwórz Lead B |
| 8. OOO bez kontaktów | OOO | CZEKAJ | - | Brak |
| 9. Unsubscribe | UNSUBSCRIBE | BLOKADA | - | Brak |
| 10. Bounce | BOUNCE | BLOKADA | - | Brak |
