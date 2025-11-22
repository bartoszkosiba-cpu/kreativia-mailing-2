# Weryfikacja modułu "Kryteria weryfikacji firm"

## 📋 Podsumowanie

Moduł został zaimplementowany zgodnie z wymaganiami - podobnie do modułu "Personas", ale z warstwą briefu strategicznego dla kryteriów weryfikacji firm.

---

## ✅ CO ZOSTAŁO ZROBIONE

### 1. **Model bazy danych**
- ✅ `CompanyVerificationBrief` - model w `schema.prisma`
- ✅ Relacja `CompanyVerificationCriteria.brief` (1:1)
- ✅ Migracja bazy danych wykonana (`prisma db push`)
- ✅ Prisma Client wygenerowany

### 2. **Service Layer**
- ✅ `src/services/companyVerificationBriefService.ts`
  - `getCompanyVerificationBrief()` - pobiera brief
  - `upsertCompanyVerificationBrief()` - zapisuje/aktualizuje brief
  - Parsowanie JSON arrays (decisionGuidelines, targetCompanies, avoidCompanies)

### 3. **API Endpoints**

#### ✅ GET `/api/company-selection/criteria/chat?criteriaId=X`
- Rozpoczyna rozmowę z agentem AI
- Generuje pierwsze pytanie jeśli historia jest pusta
- Zapisuje początkową historię rozmowy

#### ✅ POST `/api/company-selection/criteria/chat`
- Wysyła wiadomość do agenta
- Aktualizuje historię rozmowy
- Zwraca `shouldGenerateCriteria` gdy agent jest gotowy

#### ✅ PUT `/api/company-selection/criteria/chat`
- **KROK 1**: Generuje brief strategiczny (jeśli nie istnieje)
  - Używa GPT-4o do generowania briefu
  - Parsuje JSON response
  - Zapisuje przez `upsertCompanyVerificationBrief()`
- **KROK 2**: Generuje `criteriaText` na podstawie:
  - **PRIORYTET 1**: Brief strategiczny
  - **PRIORYTET 2**: Historia rozmowy
- Aktualizuje `CompanyVerificationCriteria` z wygenerowanymi kryteriami

#### ✅ GET `/api/company-selection/criteria/[id]/brief`
- Pobiera brief dla danego criteriaId
- Zwraca `null` jeśli brief nie istnieje

#### ✅ GET `/api/company-selection/criteria/[id]/prompt`
- Rekonstruuje pełny prompt używany w weryfikacji
- **PRIORYTET 1**: Brief strategiczny (jeśli istnieje)
- **PRIORYTET 2**: Szczegółowe kryteria (`criteriaText`)
- Obsługuje wybór modelu (gpt-4o-mini / gpt-4o)

### 4. **Frontend UI**

#### ✅ Lista kryteriów (`/company-selection/criteria`)
- Wyświetla wszystkie kryteria w tabeli
- Przycisk "+ Utwórz nowe kryteria"
- Generuje unikalną nazwę (np. "Nowe kryteria weryfikacji 1")

#### ✅ Szczegóły kryteriów (`/company-selection/criteria/[id]`)

**Zakładki:**
- ✅ **Podgląd** - wyświetla:
  - Nazwa i opis
  - **Brief strategiczny** (z informacją o PRIORYTET 1)
  - Progi pewności
  - Tekst kryteriów
  - Słowa kluczowe (qualified/rejected)
  - Przyciski: Powiel, Usuń

- ✅ **Czat z agentem** - zawiera:
  - Historia rozmowy
  - Pole do wpisywania wiadomości
  - Automatyczne rozpoczęcie rozmowy (jeśli historia pusta)
  - Przycisk "Wygeneruj kryteria teraz" (gdy `shouldGenerateCriteria`)

- ✅ **Prompt do analizy** - zawiera:
  - Wybór modelu AI (GPT-4o Mini / GPT-4o)
  - Pełny prompt używany w weryfikacji
  - Automatyczne ładowanie przy przełączeniu zakładki

**Ekran z nazwą:**
- ✅ Wyświetla się gdy nazwa jest domyślna
- ✅ Wymaga podania nazwy przed rozpoczęciem rozmowy
- ✅ Automatycznie przełącza na zakładkę "Czat" po zapisaniu

### 5. **Logika Flow**

#### ✅ Tworzenie nowych kryteriów:
1. Użytkownik klika "+ Utwórz nowe kryteria"
2. System generuje unikalną nazwę (np. "Nowe kryteria weryfikacji 1")
3. Tworzy rekord w bazie z domyślnymi wartościami
4. Przekierowuje do `/company-selection/criteria/[id]`

#### ✅ Nadanie nazwy:
1. System wykrywa domyślną nazwę
2. Wyświetla ekran z prośbą o nazwę
3. Użytkownik wpisuje nazwę i zapisuje
4. System aktualizuje nazwę w bazie
5. Automatycznie przełącza na zakładkę "Czat"

#### ✅ Rozmowa z agentem:
1. System automatycznie rozpoczyna rozmowę (GET `/api/company-selection/criteria/chat`)
2. Agent zadaje pierwsze pytanie
3. Użytkownik odpowiada (POST `/api/company-selection/criteria/chat`)
4. Agent odpowiada dynamicznie (bez sztywnego zestawu pytań)
5. Gdy agent ma wystarczające informacje, proponuje kryteria
6. System ustawia `shouldGenerateCriteria = true`
7. Pojawia się przycisk "Wygeneruj kryteria teraz"

#### ✅ Generowanie kryteriów:
1. Użytkownik klika "Wygeneruj kryteria teraz"
2. System wywołuje PUT `/api/company-selection/criteria/chat`
3. **KROK 1**: Generuje brief strategiczny (jeśli nie istnieje)
4. **KROK 2**: Generuje `criteriaText` na podstawie briefu + rozmowy
5. Aktualizuje `CompanyVerificationCriteria`
6. Przełącza na zakładkę "Podgląd"
7. Brief pojawia się w sekcji "Brief strategiczny"

#### ✅ Wyświetlanie promptu:
1. Użytkownik przełącza na zakładkę "Prompt do analizy"
2. System ładuje prompt (GET `/api/company-selection/criteria/[id]/prompt`)
3. Prompt zawiera:
   - **PRIORYTET 1**: Brief strategiczny (jeśli istnieje)
   - **PRIORYTET 2**: Szczegółowe kryteria
4. Użytkownik może zmienić model (GPT-4o Mini / GPT-4o)

---

## 🔍 PORÓWNANIE Z MODUŁEM PERSONAS

### Podobieństwa:
- ✅ Warstwa briefu strategicznego
- ✅ Chat z agentem AI
- ✅ Automatyczne generowanie briefu z rozmowy
- ✅ Prompt używa briefu jako PRIORYTET 1
- ✅ Wybór modelu AI (GPT-4o Mini / GPT-4o)
- ✅ Zakładka "Prompt do analizy"

### Różnice (zgodnie z wymaganiami):
- ✅ Brief w Criteria **NIE jest edytowalny ręcznie** (w Personas jest edytowalny)
- ✅ Brief jest generowany **automatycznie** z rozmowy
- ✅ Brief jest **read-only** w UI

---

## ⚠️ POTENCJALNE PROBLEMY / DO SPRAWDZENIA

### 1. **Ekran z nazwą**
- ✅ Implementacja istnieje
- ⚠️ **DO TESTOWANIA**: Czy poprawnie wykrywa domyślne nazwy?
- ⚠️ **DO TESTOWANIA**: Czy automatycznie przełącza na chat po zapisaniu?

### 2. **Automatyczne rozpoczęcie rozmowy**
- ✅ Implementacja istnieje (useEffect w `page.tsx`)
- ⚠️ **DO TESTOWANIA**: Czy działa gdy przełączamy się na zakładkę "Czat"?
- ⚠️ **DO TESTOWANIA**: Czy nie uruchamia się wielokrotnie?

### 3. **Generowanie briefu**
- ✅ Implementacja istnieje w PUT endpoint
- ⚠️ **DO TESTOWANIA**: Czy brief jest generowany poprawnie?
- ⚠️ **DO TESTOWANIA**: Czy brief jest używany w prompt/route.ts?

### 4. **Prompt z briefem**
- ✅ Implementacja istnieje
- ⚠️ **DO TESTOWANIA**: Czy prompt zawiera brief jako PRIORYTET 1?
- ⚠️ **DO TESTOWANIA**: Czy działa z różnymi modelami?

### 5. **UI - Brief w zakładce View**
- ✅ Implementacja istnieje
- ⚠️ **DO TESTOWANIA**: Czy brief jest wyświetlany poprawnie?
- ⚠️ **DO TESTOWANIA**: Czy pokazuje komunikat gdy brief nie istnieje?

---

## 📝 CO JESZCZE TRZEBA ZROBIĆ

### 1. **Testy funkcjonalne** ⚠️ PRIORYTET
- [ ] Test pełnego flow: tworzenie -> nazwa -> chat -> generowanie -> brief -> prompt
- [ ] Test automatycznego rozpoczęcia rozmowy
- [ ] Test generowania briefu
- [ ] Test wyświetlania briefu w UI
- [ ] Test promptu z briefem

### 2. **Obsługa błędów** (opcjonalne ulepszenia)
- [ ] Obsługa błędów generowania briefu (obecnie tylko logowanie)
- [ ] Obsługa błędów parsowania JSON briefu
- [ ] Komunikaty błędów dla użytkownika

### 3. **Optymalizacje** (opcjonalne)
- [ ] Cache promptu w briefu (pole `generatedPrompt` istnieje, ale nie jest używane)
- [ ] Regeneracja briefu przy zmianie rozmowy (jak w Personas)

### 4. **Dokumentacja** (opcjonalne)
- [ ] Dokumentacja API endpoints
- [ ] Dokumentacja flow użytkownika

---

## 🎯 STATUS IMPLEMENTACJI

### ✅ ZROBIONE (100%)
- Model bazy danych
- Service layer
- Wszystkie API endpoints
- Frontend UI (wszystkie zakładki)
- Logika flow
- Integracja z briefem

### ⚠️ DO TESTOWANIA (0%)
- Pełny flow użytkownika
- Automatyczne rozpoczęcie rozmowy
- Generowanie briefu
- Wyświetlanie briefu
- Prompt z briefem

### 📋 OPCJONALNE ULEPSZENIA (0%)
- Obsługa błędów
- Cache promptu
- Regeneracja briefu
- Dokumentacja

---

## 🚀 NASTĘPNE KROKI

1. **PRZETESTOWAĆ** pełny flow na `http://localhost:3000/company-selection/criteria`
2. **ZWERYFIKOWAĆ** czy wszystkie funkcje działają poprawnie
3. **NAPRAWIĆ** ewentualne błędy znalezione podczas testów
4. **OPCJONALNIE**: Dodać ulepszenia z sekcji "Co jeszcze trzeba zrobić"

---

## 📊 PODSUMOWANIE

**Status:** ✅ **IMPLEMENTACJA ZAKOŃCZONA**

Wszystkie wymagane funkcje zostały zaimplementowane. Moduł jest gotowy do testowania. Głównym zadaniem jest teraz przetestowanie pełnego flow i naprawa ewentualnych błędów.

