# Instrukcja Testowania Napraw Weryfikacji Person

## Krok 1: Restart serwera (jeśli działa)

Jeśli serwer działa, zrestartuj go aby załadować nowe zmiany:

```bash
# Zatrzymaj serwer (Ctrl+C w terminalu gdzie działa)
# Następnie uruchom ponownie:
npm run dev
```

---

## Krok 2: Test zapisywania promptu

### 2.1. Sprawdź czy istnieje brief dla personaCriteriaId=24

1. Otwórz: `http://localhost:3000/company-selection/personas/24`
2. Sprawdź czy widzisz "Brief strategiczny" - jeśli tak, przejdź do kroku 2.2
3. Jeśli nie ma briefu, musisz najpierw wygenerować brief przez chat

### 2.2. Wymuś regenerację promptu

**Opcja A: Przez edycję briefu**
1. Edytuj brief (zmień coś w tekście)
2. Zapisz zmiany
3. Prompt powinien zostać automatycznie wygenerowany

**Opcja B: Przez API (szybsze)**
```bash
# W terminalu:
curl -X GET "http://localhost:3000/api/company-selection/personas/24/prompt" | python3 -m json.tool
```

Sprawdź w odpowiedzi:
- `"isFromSaved": true` - ✅ Prompt jest zapisany
- `"isFromSaved": false` - ❌ Prompt nie jest zapisany (sprawdź logi)

### 2.3. Sprawdź logi serwera

W terminalu gdzie działa serwer, szukaj:
- `[personaBriefService] ✅ Zapisano prompt dla ID: 24` - ✅ Sukces
- `[personaBriefService] ❌ Błąd generowania promptu` - ❌ Błąd

---

## Krok 3: Test weryfikacji person z różnymi stanowiskami

### 3.1. Przygotuj testowe stanowiska

Przetestuj z następującymi stanowiskami (powinny być pozytywne):

1. **"Head of Production"** → powinno być: ✅ Positive (100%)
2. **"Senior Project Manager"** → powinno być: ✅ Positive (100%)
3. **"Vice President"** → powinno być: ✅ Positive (100%)
4. **"International Operations Manager"** → powinno być: ⚠️ Positive (50-70%) lub Negative (w zależności od kontekstu)
5. **"Kierownik Projektu"** → powinno być: ✅ Positive (100%)
6. **"Starszy Kierownik Projektu"** → powinno być: ✅ Positive (100%)

### 3.2. Wykonaj weryfikację

1. Otwórz: `http://localhost:3000/company-selection/verify-personas/12`
2. Wybierz kryteria: "Podwieszenia targowe - persony 13" (ID: 24)
3. Zaznacz firmę która ma persony z powyższymi stanowiskami
4. Kliknij "Zweryfikuj stanowiska"
5. Poczekaj na zakończenie weryfikacji

### 3.3. Sprawdź wyniki

1. Kliknij na firmę w tabeli
2. Sprawdź klasyfikację dla każdego stanowiska:
   - Czy "Head of Production" jest pozytywne?
   - Czy "Senior Project Manager" jest pozytywne?
   - Czy "Vice President" jest pozytywne?
   - Czy wszystkie mają score (nie "brak")?

### 3.4. Sprawdź zapisane decyzje

1. Otwórz: `http://localhost:3000/company-selection/personas/24`
2. Przejdź do zakładki "Zapisane decyzje"
3. Sprawdź czy stanowiska zostały zapisane:
   - "Head of Production" → powinno być w cache jako Positive
   - "Senior Project Manager" → powinno być w cache jako Positive
   - "Vice President" → powinno być w cache jako Positive
4. Sprawdź czy wszystkie mają score (nie null)

---

## Krok 4: Test tłumaczenia stanowisk

### 4.1. Test z angielskimi stanowiskami

Przetestuj z firmą która ma angielskie tytuły:
- "Head of Production" → powinno być rozpoznane jako "Kierownik produkcji" (Positive)
- "Vice President" → powinno być rozpoznane jako "Wiceprezes" (Positive)

### 4.2. Sprawdź logi AI

W logach serwera szukaj:
- Czy AI otrzymuje instrukcje o tłumaczeniu?
- Czy w odpowiedzi AI są uzasadnienia które wskazują na rozpoznanie synonimów?

---

## Krok 5: Test kontekstu biznesowego

### 5.1. Sprawdź czy kontekst jest w prompcie

1. Otwórz: `http://localhost:3000/company-selection/personas/24`
2. Przejdź do zakładki "Prompt do analizy"
3. Sprawdź czy na początku promptu jest:
   - "⚠️ KRYTYCZNE - ZAWSZE NAJPIERW"
   - "KONTEKST BIZNESOWY I BRIEF STRATEGICZNY"
   - Kontekst biznesowy z briefu

### 5.2. Test z "Operations Manager"

"International Operations Manager" w kontekście produkcji stoisk targowych:
- Powinien być rozpoznany jako potencjalnie pozytywny (ma wpływ na produkcję)
- Sprawdź czy AI uwzględnia kontekst biznesowy w uzasadnieniu

---

## Krok 6: Test walidacji score

### 6.1. Sprawdź czy wszystkie decyzje mają score

1. Po weryfikacji, sprawdź wyniki
2. Każda decyzja powinna mieć score (nie "brak" lub null)
3. Sprawdź logi serwera - nie powinno być błędów o brakującym score

### 6.2. Sprawdź logi

W logach serwera szukaj:
- `"Brak score w odpowiedzi AI - używam domyślnego"` - ⚠️ Ostrzeżenie (ale powinno działać)
- `"Niektóre wyniki nie mają score po walidacji"` - ❌ Błąd (nie powinno się zdarzyć)

---

## Krok 7: Test cache

### 7.1. Wykonaj weryfikację ponownie

1. Wykonaj weryfikację dla tej samej firmy ponownie
2. Sprawdź logi - powinny być komunikaty:
   - `"Cache hit - użyto zapisanej decyzji"` - ✅ Cache działa
   - `"Wszystkie stanowiska były w cache"` - ✅ Wszystko z cache

### 7.2. Sprawdź czy cache jest używany

W logach serwera szukaj:
- `"Weryfikacja przez AI"` - tylko dla nowych stanowisk
- `"Cache hit"` - dla stanowisk które były już weryfikowane

---

## Checklist testowania

### ✅ Zapisywanie promptu
- [ ] Prompt jest zapisany (`isFromSaved: true`)
- [ ] W logach jest komunikat o zapisaniu promptu
- [ ] Prompt jest dostępny w zakładce "Prompt do analizy"

### ✅ Tłumaczenie stanowisk
- [ ] "Head of Production" → Positive (rozpoznane jako "Kierownik produkcji")
- [ ] "Senior Project Manager" → Positive
- [ ] "Vice President" → Positive
- [ ] Synonimy są rozpoznawane

### ✅ Reguły hardcoded
- [ ] VP, Head of, Director są zawsze pozytywne
- [ ] Project Manager (wszystkie wersje) są pozytywne
- [ ] Designer (wszystkie wersje) są pozytywne

### ✅ Kontekst biznesowy
- [ ] Kontekst jest na początku promptu
- [ ] AI uwzględnia kontekst w decyzjach
- [ ] "Operations Manager" jest oceniany w kontekście produkcji

### ✅ Walidacja score
- [ ] Wszystkie decyzje mają score (nie null)
- [ ] W logach nie ma błędów o brakującym score
- [ ] Domyślny score jest używany gdy brak

### ✅ Cache
- [ ] Cache jest używany dla powtarzających się stanowisk
- [ ] Cache jest zapisywany po weryfikacji
- [ ] Cache ma score dla wszystkich decyzji

---

## Co zrobić jeśli coś nie działa?

### Problem: Prompt nie jest zapisany

1. Sprawdź logi serwera - szukaj błędów
2. Sprawdź czy brief istnieje (musi mieć `summary`)
3. Sprawdź czy `generateAndSavePrompt` jest wywoływane

### Problem: Stanowiska są błędnie klasyfikowane

1. Sprawdź prompt w zakładce "Prompt do analizy"
2. Sprawdź czy kontekst biznesowy jest w prompcie
3. Sprawdź logi AI - czy otrzymuje poprawne instrukcje
4. Jeśli problemy się utrzymują, rozważyć upgrade do `gpt-4o`

### Problem: Brak score

1. Sprawdź logi - powinny być ostrzeżenia
2. System powinien użyć domyślnego score
3. Jeśli problem się utrzymuje, sprawdź odpowiedź AI

---

## Następne kroki po testach

1. **Jeśli wszystko działa:** ✅ Gotowe!
2. **Jeśli są problemy:**
   - Sprawdź logi serwera
   - Sprawdź odpowiedzi AI
   - Rozważ upgrade do `gpt-4o` jeśli problemy się utrzymują

