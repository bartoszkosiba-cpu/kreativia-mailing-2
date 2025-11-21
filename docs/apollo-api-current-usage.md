# Obecne użycie Apollo API - szczegółowa analiza

## Miejsca użycia Apollo API w projekcie

### 1. Wyszukiwanie firm (`searchOrganizations`)
**Plik:** `src/services/apolloService.ts` - `searchOrganizations()`
**Endpoint:** `/v1/organizations/search` lub `/v1/accounts/search`
**Kiedy używamy:**
- Podczas weryfikacji person - wyszukiwanie organizacji Apollo dla firmy
- Podczas pobierania danych firmy z Apollo

**Kredyty:** ✅ **Prawdopodobnie DARMOWE** (nie ma w cenniku)
**Status:** ✅ OK - nie wymaga zmian

---

### 2. Wyszukiwanie pracowników (`searchPeopleFromOrganization`)
**Plik:** `src/services/apolloService.ts` - `searchPeopleFromOrganization()`
**Endpoint:** `/v1/people/search` → fallback `/v1/mixed_people/search`
**Kiedy używamy:**
- Podczas weryfikacji person - pobieranie listy pracowników firmy
- Podczas "Pobierz i zapisz do bazy" - pobieranie pracowników

**Parametry:**
- `organization_ids`, `organization_name`, `q_organization_domains`
- `revealEmails: false` (domyślnie) - ✅ DARMOWE
- `revealEmails: true` - ⚠️ Prawdopodobnie zużywa kredyt

**Kredyty:**
- Bez `reveal_personal_emails`: ✅ DARMOWE (prawdopodobnie)
- Z `reveal_personal_emails: true`: ⚠️ Nie wiemy dokładnie (nie ma w cenniku)
- Fallback `/mixed_people/search` z `include_personal_emails: true`: ⚠️ **1 KREDYT ZA STRONĘ**

**Gdzie używamy z `revealEmails: true`:**
- `app/api/company-selection/personas/fetch-and-save/route.ts` (linia 150-159) - gdy `revealEmails: true`

**Problem:**
- Jeśli `/people/search` nie jest dostępny, fallback używa `/mixed_people/search` z `include_personal_emails: true`
- To zużywa **1 kredyt za stronę**, nawet jeśli nie potrzebujemy emaili dla wszystkich osób

---

### 3. Pobieranie emaila dla pojedynczej osoby (`enrichPerson`)
**Plik:** `src/services/apolloService.ts` - `enrichPerson()`
**Endpoint:** `/v1/people/search` → fallback `/v1/mixed_people/search`
**Kiedy używamy:**
- Przycisk "Pobierz" w tabeli leadów - pobieranie emaila dla jednego leada

**Obecna logika:**
1. Próba `/people/search` z `reveal_personal_emails: true` - ⚠️ Prawdopodobnie 1 kredyt
2. Jeśli błąd 403, fallback do `/mixed_people/search`:
   - Krok 1: Sprawdzenie istnienia (bez `include_personal_emails`) - ✅ DARMOWE
   - Krok 2: Pobranie emaila (z `include_personal_emails: true`) - ⚠️ **1 KREDYT ZA STRONĘ**

**Kredyty:**
- `/people/search` z `reveal_personal_emails: true`: ⚠️ Prawdopodobnie 1 kredyt
- `/mixed_people/search` z `include_personal_emails: true`: ⚠️ **1 KREDYT ZA STRONĘ**

**Problem:**
- Jeśli osoba nie zostanie znaleziona w kroku 2, kredyt został zużyty
- Używamy `per_page: 100`, więc jeśli zwróci 1 stronę = 1 kredyt

---

### 4. Pobieranie emaili dla wielu osób (`enrichPeopleBulk`)
**Plik:** `src/services/apolloService.ts` - `enrichPeopleBulk()`
**Endpoint:** `/v1/people/search`
**Kiedy używamy:**
- Pobieranie emaili dla wielu osób na raz

**Parametry:**
- `person_ids: [id1, id2, ...]`
- `reveal_personal_emails: true`

**Kredyty:**
- ⚠️ Nie wiemy dokładnie (nie ma w cenniku)
- Prawdopodobnie 1 kredyt za osobę

**Problem:**
- Nie używamy `/people/bulk_match`, które zużywa kredyt tylko za NOWE emaile

---

### 5. Fallback wyszukiwania (`searchPeopleViaMixedPeople`)
**Plik:** `src/services/apolloService.ts` - `searchPeopleViaMixedPeople()`
**Endpoint:** `/v1/mixed_people/search`
**Kiedy używamy:**
- Fallback gdy `/people/search` nie jest dostępny
- Podczas weryfikacji person (gdy `revealEmails: true`)

**Parametry:**
- `contact_scopes.include_personal_emails: true` - ⚠️ **1 KREDYT ZA STRONĘ**

**Kredyty:**
- ⚠️ **1 KREDYT ZA STRONĘ** - nawet jeśli nie znajdziemy szukanej osoby!

**Problem:**
- Zawsze ustawiamy `include_personal_emails: true`, nawet gdy nie potrzebujemy emaili
- Nie używamy `/mixed_people/api_search`, które jest DARMOWE

---

## Podsumowanie problemów

### Problem 1: `mixed_people/search` zużywa kredyt za stronę
**Lokalizacja:**
- `searchPeopleViaMixedPeople()` - zawsze z `include_personal_emails: true`
- `enrichPerson()` - fallback z `include_personal_emails: true`

**Koszt:**
- 1 kredyt za stronę (100 wyników)
- Nawet jeśli nie znajdziemy szukanej osoby

**Rozwiązanie:**
- Użyj `/mixed_people/api_search` do sprawdzania (DARMOWE)
- Użyj `/people/bulk_match` do pobierania emaili (1 kredyt za nowy email)

### Problem 2: Nie używamy `/people/bulk_match`
**Lokalizacja:**
- `enrichPerson()` - używa `/people/search` lub `/mixed_people/search`
- `enrichPeopleBulk()` - używa `/people/search`

**Koszt:**
- Prawdopodobnie 1 kredyt za osobę (nawet jeśli email już był dostępny)

**Rozwiązanie:**
- Użyj `/people/bulk_match` - zużywa kredyt tylko za NOWE emaile

### Problem 3: Niepotrzebne zużycie kredytów
**Przykład z `enrichPerson()`:**
1. `/people/search` z `reveal_personal_emails: true` - 1 kredyt (prawdopodobnie)
2. Fallback `/mixed_people/search` z `include_personal_emails: true` - 1 kredyt za stronę
3. Jeśli osoba nie zostanie znaleziona, **2 kredyty zmarnowane**

**Rozwiązanie:**
- Najpierw sprawdź istnienie (DARMOWE)
- Dopiero potem pobierz email (1 kredyt za nowy email)

---

## Rekomendowane zmiany

### Zmiana 1: Użyj `/mixed_people/api_search` do sprawdzania
**Zamiast:** `/mixed_people/search` z `include_personal_emails: true`
**Użyj:** `/mixed_people/api_search` (DARMOWE)

**Korzyść:**
- 0 kredytów za sprawdzanie istnienia osoby
- Zwraca częściowe profile, wystarczy do sprawdzenia

### Zmiana 2: Użyj `/people/bulk_match` do pobierania emaili
**Zamiast:** `/people/search` z `reveal_personal_emails: true`
**Użyj:** `/people/bulk_match` (1 kredyt za nowy email)

**Korzyść:**
- 1 kredyt tylko za NOWE emaile
- Jeśli email już był dostępny, nie zużywa kredytu

### Zmiana 3: Dwuetapowe pobieranie emaili
**Krok 1:** Sprawdź istnienie (DARMOWE)
**Krok 2:** Pobierz email tylko jeśli osoba istnieje (1 kredyt za nowy email)

**Korzyść:**
- 0 kredytów jeśli osoba nie istnieje
- 1 kredyt tylko za nowy email

---

## Szacunkowe oszczędności

### Obecne zużycie (przykład: pobieranie emaila dla 1 osoby)
- Jeśli osoba istnieje: 1-2 kredyty
- Jeśli osoba nie istnieje: 1-2 kredyty (zmarnowane)

### Po poprawkach
- Jeśli osoba istnieje: 1 kredyt (tylko za nowy email)
- Jeśli osoba nie istnieje: 0 kredytów

### Oszczędność: 50-100% w zależności od przypadku

