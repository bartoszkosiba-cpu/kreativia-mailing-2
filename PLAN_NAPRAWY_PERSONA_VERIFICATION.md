# Plan Naprawy Weryfikacji Person

## Analiza Problemów

### 1. **PROBLEM: Prompt nie jest zapisany** ❌
**Status:** `isFromSaved: False` mimo że brief istnieje

**Przyczyna:**
- `upsertPersonaBrief` wywołuje `generateAndSavePrompt`, ale może być błąd który jest ignorowany
- Możliwe że `generateAndSavePrompt` nie działa poprawnie lub nie ma obsługi błędów

**Wpływ:** WYSOKI - prompt jest generowany dynamicznie za każdym razem, co może prowadzić do niespójności

---

### 2. **PROBLEM: AI nie bierze pod uwagę wpływu kadry zarządzającej** ❌
**Przykłady błędów:**
- "Vice President" → negative (powinno być positive)
- "Head of Production" → negative (powinno być positive - to jest "Kierownik produkcji")
- "Senior Project Manager" → negative (powinno być positive - reguła hardcoded)

**Przyczyna:**
- Prompt mówi o "szerzeniu wiedzy wewnątrz firmy", ale AI tego nie stosuje konsekwentnie
- Brak wyraźnych przykładów dla stanowisk kierowniczych wysokiego szczebla
- Reguły hardcoded nie są wystarczająco silne

**Wpływ:** KRYTYCZNY - tracimy kluczowe leady

---

### 3. **PROBLEM: AI nie tłumaczy stanowisk z innych języków** ❌
**Przykłady:**
- "Head of Production" (ang.) nie jest rozpoznawane jako "Kierownik produkcji" (pl.)
- W przyszłości: stanowiska po niemiecku, francusku, etc.

**Przyczyna:**
- AI dostaje tytuły w oryginalnym języku
- Brak instrukcji w prompcie aby AI tłumaczyło tytuły przed analizą
- Brak normalizacji tytułów przed wysłaniem do AI

**Wpływ:** WYSOKI - tracimy leady z firm międzynarodowych

---

### 4. **PROBLEM: AI nie patrzy na kontekst biznesowy z briefu** ❌
**Przykłady:**
- "International Operations Manager" → negative (0.2) mimo że w kontekście produkcji stoisk może mieć wpływ
- "Technical Manager" → negative mimo że "Technical" może oznaczać projektowanie

**Przyczyna:**
- Kontekst biznesowy jest w briefie, ale AI go ignoruje
- Prompt nie kładzie wystarczającego nacisku na kontekst biznesowy
- AI skupia się na literalnym dopasowaniu zamiast na kontekście

**Wpływ:** ŚREDNI-WYSOKI - tracimy potencjalne leady

---

### 5. **PROBLEM: Brak score w odpowiedziach AI** ❌
**Przykłady:**
- "Head of Production" → score: null
- "Senior Project Manager" → score: null
- "Vice President" → score: null

**Przyczyna:**
- AI nie zwraca score mimo że prompt wyraźnie mówi że MUSI
- Brak walidacji i retry jeśli score jest null
- Model `gpt-4o-mini` może mieć problemy z przestrzeganiem instrukcji

**Wpływ:** ŚREDNI - utrudnia debugowanie i analizę

---

## Ocena Największych Problemów

### Ranking według wpływu:

1. **🥇 PROBLEM #2: AI nie bierze pod uwagę wpływu kadry zarządzającej** (KRYTYCZNY)
   - Tracimy najważniejsze leady (VP, Head of Production, Senior PM)
   - Reguły hardcoded nie działają
   - **Rozwiązanie:** Wzmocnić reguły hardcoded + dodać więcej przykładów

2. **🥈 PROBLEM #3: Brak tłumaczenia stanowisk** (WYSOKI)
   - Tracimy leady z firm międzynarodowych
   - Problem będzie się pogłębiał
   - **Rozwiązanie:** Dodać tłumaczenie tytułów przed analizą

3. **🥉 PROBLEM #1: Prompt nie jest zapisany** (WYSOKI)
   - Niespójność w weryfikacji
   - Trudne debugowanie
   - **Rozwiązanie:** Naprawić zapisywanie promptu + dodać logowanie błędów

4. **PROBLEM #4: AI nie patrzy na kontekst biznesowy** (ŚREDNI-WYSOKI)
   - Tracimy potencjalne leady
   - **Rozwiązanie:** Wzmocnić kontekst biznesowy w prompcie

5. **PROBLEM #5: Brak score** (ŚREDNI)
   - Utrudnia debugowanie
   - **Rozwiązanie:** Dodać walidację i retry

---

## Plan Naprawy

### FAZA 1: Naprawa zapisywania promptu (PRIORYTET 1)

**Zadania:**
1. ✅ Sprawdzić dlaczego `generateAndSavePrompt` nie zapisuje promptu
2. ✅ Dodać logowanie błędów w `generateAndSavePrompt`
3. ✅ Dodać wywołanie `regeneratePromptForPersonaCriteria` po `upsertPersonaBrief` w PUT endpoint
4. ✅ Dodać walidację że prompt został zapisany

**Pliki do modyfikacji:**
- `src/services/personaBriefService.ts` - dodać logowanie błędów
- `app/api/company-selection/personas/[id]/chat/route.ts` - dodać wywołanie po zapisaniu briefu

---

### FAZA 2: Tłumaczenie stanowisk (PRIORYTET 2)

**Zadania:**
1. ✅ Dodać funkcję tłumaczenia tytułów przed wysłaniem do AI
2. ✅ Dodać instrukcję w prompcie aby AI tłumaczyło tytuły przed analizą
3. ✅ Dodać normalizację tytułów (lowercase, trim, etc.)
4. ✅ Przetestować z różnymi językami (PL, EN, DE, FR)

**Pliki do modyfikacji:**
- `src/services/personaVerificationAI.ts` - dodać tłumaczenie tytułów
- `src/services/personaVerificationAI.ts` - dodać instrukcję w prompcie

**Rozwiązanie:**
```typescript
// Przed wysłaniem do AI, przetłumacz tytuły
const translateTitle = async (title: string, targetLang: string = "pl"): Promise<string> => {
  // Użyj AI do tłumaczenia tytułu
  // Lub użyj biblioteki tłumaczeń
};
```

---

### FAZA 3: Wzmocnienie reguł hardcoded (PRIORYTET 3)

**Zadania:**
1. ✅ Dodać więcej przykładów stanowisk kierowniczych w prompcie
2. ✅ Wzmocnić regułę "szerzenia wiedzy wewnątrz firmy"
3. ✅ Dodać reguły dla:
   - Vice President, VP
   - Head of [Department]
   - Senior [Role]
   - Director, Managing Director
4. ✅ Dodać więcej przykładów w sekcji "PRZYKŁADY KLASYFIKACJI"

**Pliki do modyfikacji:**
- `src/services/personaVerificationAI.ts` - sekcja "STANOWISKA ZAWSZE POZYTYWNE"

**Przykłady do dodania:**
- "Vice President" → positive (100%) - kadra zarządzająca może szerzyć wiedzę
- "Head of Production" → positive (100%) - to jest "Kierownik produkcji"
- "Senior Project Manager" → positive (100%) - reguła hardcoded dla Project Manager

---

### FAZA 4: Wzmocnienie kontekstu biznesowego (PRIORYTET 4)

**Zadania:**
1. ✅ Przenieść kontekst biznesowy na początek promptu
2. ✅ Dodać więcej przykładów jak kontekst biznesowy wpływa na decyzje
3. ✅ Dodać instrukcję: "Zawsze najpierw sprawdź kontekst biznesowy przed klasyfikacją"
4. ✅ Dodać przykłady:
   - "Operations Manager" w kontekście produkcji stoisk → positive
   - "Technical Manager" w kontekście projektowania → positive

**Pliki do modyfikacji:**
- `src/services/personaVerificationAI.ts` - sekcja "KONTEKST BIZNESOWY"

---

### FAZA 5: Walidacja score (PRIORYTET 5)

**Zadania:**
1. ✅ Dodać walidację że score jest zawsze zwracany
2. ✅ Dodać retry jeśli score jest null
3. ✅ Dodać domyślny score (0.5) jeśli AI nie zwróci
4. ✅ Dodać logowanie gdy score jest null

**Pliki do modyfikacji:**
- `src/services/personaVerificationAI.ts` - funkcja `verifyEmployeesWithAI`

---

## Ocena: Co jest największym problemem?

### Odpowiedź: **KOMBINACJA PROBLEMÓW**

1. **Największy problem:** **Brak tłumaczenia stanowisk + słabe reguły hardcoded**
   - Te dwa problemy razem powodują że tracimy najwięcej leadów
   - "Head of Production" nie jest rozpoznawane jako "Kierownik produkcji"
   - "Senior Project Manager" nie jest rozpoznawane jako "Project Manager"

2. **Drugi największy problem:** **Prompt nie jest zapisany**
   - Niespójność w weryfikacji
   - Trudne debugowanie
   - Może prowadzić do różnych wyników przy każdym uruchomieniu

3. **Trzeci największy problem:** **Model gpt-4o-mini może być za słaby**
   - Nie przestrzega instrukcji (brak score)
   - Nie rozpoznaje synonimów
   - Nie stosuje reguł hardcoded konsekwentnie

**Rekomendacja:**
- Najpierw naprawić tłumaczenie stanowisk i wzmocnić reguły hardcoded (FAZA 2 + 3)
- Potem naprawić zapisywanie promptu (FAZA 1)
- Jeśli to nie pomoże, rozważyć upgrade do `gpt-4o` dla weryfikacji (koszt: ~400 zł za 10k decyzji)

---

## Harmonogram

1. **Dzień 1:** FAZA 1 (naprawa zapisywania promptu) + FAZA 5 (walidacja score)
2. **Dzień 2:** FAZA 2 (tłumaczenie stanowisk) + FAZA 3 (wzmocnienie reguł)
3. **Dzień 3:** FAZA 4 (wzmocnienie kontekstu) + testy
4. **Dzień 4:** Testy końcowe + optymalizacja

---

## Metryki Sukcesu

- ✅ Prompt jest zapisany (`isFromSaved: true`)
- ✅ Wszystkie decyzje mają score (brak null)
- ✅ "Head of Production" → positive
- ✅ "Senior Project Manager" → positive
- ✅ "Vice President" → positive
- ✅ Tytuły są tłumaczone przed analizą
- ✅ Kontekst biznesowy jest uwzględniany w decyzjach

