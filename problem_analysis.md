# ANALIZA PROBLEMU - DLACZEGO AI BŁĘDNIE KLASYFIKUJE PERSONY

## OBECNY PRZEPŁYW WERYFIKACJI

1. **Reguły w kodzie** (`classifyPersonByRules`) - sprawdzane PRZED AI
   - Jeśli reguła pasuje → używa reguły, NIE idzie do AI
   - Jeśli reguła NIE pasuje → idzie do AI

2. **AI weryfikacja** (`verifyEmployeesWithAI`)
   - Sprawdza cache
   - Jeśli nie ma w cache → wysyła do OpenAI
   - Zapisuje wynik do cache

3. **Priorytety decyzji**:
   - Reguły (najwyższy priorytet)
   - AI (jeśli brak reguły)
   - Domyślnie: negative

---

## GŁÓWNE PROBLEMY

### 1. ❌ BRAK TWARDYCH REGUŁ DLA OCZYWISTYCH PRZYPADKÓW

**Problem**: 
- `GLOBAL_POSITIVE_KEYWORDS` zawiera tylko: "sales", "designer", "account manager"
- **BRAK**: "project manager", "ceo", "managing director", "key account manager"
- Więc te stanowiska idą do AI, a AI interpretuje je różnie

**Przykłady błędów**:
- "Project Manager" → raz pozytywne, raz negatywne
- "CEO" → raz pozytywne, raz negatywne
- "Key Account Manager" → negatywne, ale "Account Manager" pozytywne

**Rozwiązanie**:
- Dodać do `GLOBAL_POSITIVE_KEYWORDS`: "project manager", "ceo", "managing director", "general manager", "key account manager"
- Lub dodać twarde reguły w `classifyPersonByRules` dla tych stanowisk

---

### 2. ❌ AI JEST ZBYT "KREATYWNE" - INTERPRETUJE RÓŻNIE

**Problem**:
- AI dostaje te same tytuły, ale daje różne odpowiedzi
- Prompt jest zbyt ogólny: "Jeśli rola nie pasuje do żadnej definicji, oceń możliwość użycia produktu..."
- AI może interpretować "Project Manager" jako pozytywne lub negatywne w zależności od kontekstu

**Przykłady**:
- "Project Manager" w BWS Expo → negatywne (błąd)
- "Project Manager" w innych firmach → pozytywne (poprawne)

**Rozwiązanie**:
- Dodać twarde reguły PRZED AI dla oczywistych przypadków
- Poprawić prompt - bardziej precyzyjne instrukcje
- Dodać przykłady w prompcie: "Project Manager = zawsze positive"

---

### 3. ❌ CACHE MOŻE ZAWIERAĆ BŁĘDNE DECYZJE

**Problem**:
- Jeśli pierwsza weryfikacja była błędna, cache zapisuje błąd
- Kolejne weryfikacje używają błędnego cache
- Cache nie jest walidowany - może zawierać niespójne decyzje

**Przykłady**:
- "Project Manager" w BWS Expo → pierwsza weryfikacja błędna (negative) → zapisane w cache
- Kolejne "Project Manager" w innych firmach → używa cache → błąd

**Rozwiązanie**:
- Dodać walidację cache - sprawdzać czy decyzja jest logiczna
- Dodać możliwość nadpisania cache przez reguły
- Wyczyścić cache przy zmianie kryteriów

---

### 4. ❌ BRAK PRIORYTETÓW W REGUŁACH

**Problem**:
- Reguły są zbyt ogólne
- AI może ignorować reguły jeśli uzna, że "kontekst sugeruje inaczej"
- Brak twardych reguł typu "ZAWSZE pozytywne" vs "może być pozytywne"

**Rozwiązanie**:
- Dodać priorytety do reguł
- Twarde reguły (zawsze pozytywne/negatywne) → nie idą do AI
- Miękkie reguły (wskazówki) → idą do AI, ale z kontekstem

---

### 5. ❌ PROMPT DLA AI JEST ZBYT OGÓLNY

**Problem**:
- Prompt mówi: "Jeśli rola nie pasuje do żadnej definicji, oceń możliwość użycia produktu..."
- AI może interpretować to różnie
- Brak konkretnych przykładów: "Project Manager = zawsze positive"

**Rozwiązanie**:
- Dodać konkretne przykłady w prompcie
- Dodać listę "Zawsze pozytywne" i "Zawsze negatywne"
- Poprawić instrukcje - bardziej precyzyjne

---

## PROPOZOWANE ROZWIĄZANIA

### Rozwiązanie 1: DODAĆ TWARDЕ REGUŁY DLA OCZYWISTYCH PRZYPADKÓW

**Zmiany w kodzie**:
1. Rozszerzyć `GLOBAL_POSITIVE_KEYWORDS`:
   ```typescript
   const GLOBAL_POSITIVE_KEYWORDS = [
     "sales",
     "sprzeda",
     "business development",
     "account manager",
     "key account",  // ✅ DODANE
     "account executive",
     "project manager",  // ✅ DODANE
     "ceo",  // ✅ DODANE
     "chief executive",  // ✅ DODANE
     "managing director",  // ✅ DODANE
     "general manager",  // ✅ DODANE (opcjonalnie)
     "designer",
     "design",
     "projektant",
     "grafik",
     "visual designer",
     "3d designer",
   ];
   ```

2. Dodać funkcję `isAlwaysPositiveTitle`:
   ```typescript
   function isAlwaysPositiveTitle(title: string): boolean {
     const titleLower = title.toLowerCase();
     const alwaysPositive = [
       "project manager",
       "ceo",
       "chief executive",
       "managing director",
       "general manager",
       "key account manager",
     ];
     return alwaysPositive.some(keyword => titleLower.includes(keyword));
   }
   ```

**Efekt**: Te stanowiska będą zawsze pozytywne, nie pójdą do AI

---

### Rozwiązanie 2: POPRAWIĆ PROMPT DLA AI

**Zmiany w prompcie**:
1. Dodać sekcję "Zawsze pozytywne":
   ```
   STANOWISKA ZAWSZE POZYTYWNE (nie wymagają analizy):
   - Project Manager (wszystkie wersje: Senior, Junior, International, Chief)
   - CEO, Chief Executive Officer, Managing Director
   - Key Account Manager, Account Manager
   - Wszystkie stanowiska zawierające "sales" lub "sprzedaż"
   - Wszystkie stanowiska zawierające "designer", "design", "grafik", "projektant"
   ```

2. Dodać przykłady:
   ```
   PRZYKŁADY:
   - "Project Manager" → ZAWSZE positive (100%)
   - "Senior Project Manager" → ZAWSZE positive (100%)
   - "CEO" → ZAWSZE positive (100%)
   - "Key Account Manager" → ZAWSZE positive (100%)
   ```

**Efekt**: AI będzie bardziej precyzyjne w ocenie

---

### Rozwiązanie 3: DODAĆ WALIDACJĘ CACHE

**Zmiany w kodzie**:
1. Dodać funkcję `validateCacheDecision`:
   ```typescript
   function validateCacheDecision(title: string, decision: string): boolean {
     // Jeśli tytuł jest "zawsze pozytywny", ale cache ma "negative" → błąd
     if (isAlwaysPositiveTitle(title) && decision === "negative") {
       return false; // Cache jest błędny
     }
     return true;
   }
   ```

2. W `getCachedTitleDecision` - sprawdzać walidację:
   ```typescript
   const cached = await getCachedTitleDecision(cacheKey);
   if (cached && validateCacheDecision(person.title, cached.decision)) {
     // Użyj cache
   } else {
     // Cache jest błędny, weryfikuj przez AI
   }
   ```

**Efekt**: Błędne cache nie będą używane

---

### Rozwiązanie 4: DODAĆ PRIORYTETY DO REGUŁ

**Zmiany w kodzie**:
1. Dodać typ `RulePriority`:
   ```typescript
   type RulePriority = "hard" | "soft";
   ```

2. Twarde reguły (hard) → zawsze używane, nie idą do AI
3. Miękkie reguły (soft) → wskazówki dla AI

**Efekt**: Lepsza kontrola nad klasyfikacją

---

## REKOMENDOWANE DZIAŁANIA (PRIORYTET)

### 🚨 NATYCHMIAST (krytyczne):
1. **Dodać "project manager", "ceo", "managing director", "key account manager" do `GLOBAL_POSITIVE_KEYWORDS`**
   - To rozwiąże większość błędów
   - Te stanowiska nie będą szły do AI
   - Zawsze będą pozytywne

2. **Wyczyścić cache dla błędnych decyzji**
   - Usunąć cache dla "Project Manager", "CEO" które są negatywne
   - Pozwolić systemowi na ponowną weryfikację

### ⚠️ KRÓTKOTERMINOWO (1-2 dni):
3. **Poprawić prompt dla AI**
   - Dodać sekcję "Zawsze pozytywne"
   - Dodać przykłady
   - Bardziej precyzyjne instrukcje

4. **Dodać walidację cache**
   - Sprawdzać czy cache jest logiczny
   - Odrzucać błędne cache

### 📋 DŁUGOTERMINOWO (opcjonalnie):
5. **Dodać priorytety do reguł**
6. **Dodać monitoring błędów klasyfikacji**
7. **Dodać możliwość ręcznej korekty decyzji**

---

## PODSUMOWANIE

**Główny problem**: Brak twardych reguł dla oczywistych przypadków → AI interpretuje różnie → niespójności

**Główne rozwiązanie**: Dodać twarde reguły PRZED AI dla oczywistych stanowisk (Project Manager, CEO, etc.)

**Efekt**: System będzie bardziej precyzyjny i spójny, mniej błędów, szybsze działanie (mniej wywołań AI)

