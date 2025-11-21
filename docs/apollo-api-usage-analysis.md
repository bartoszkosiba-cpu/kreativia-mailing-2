# Analiza użycia Apollo API w projekcie

## Obecne użycie endpointów Apollo

### 1. `/v1/people/search` 
**Gdzie używamy:**
- `searchPeopleFromOrganization()` - wyszukiwanie pracowników firmy
- `enrichPerson()` - pobieranie danych pojedynczej osoby
- `enrichPeopleBulk()` - pobieranie danych wielu osób

**Parametry:**
- `person_ids: [personId]` - wyszukiwanie po ID osoby
- `organization_ids: [organizationId]` - wyszukiwanie po ID organizacji
- `organization_name` - wyszukiwanie po nazwie organizacji
- `q_organization_domains: [domain]` - wyszukiwanie po domenie
- `reveal_personal_emails: true` - odblokowanie emaili (⚠️ ZUŻYWA KREDYTY)
- `person_details: false` - bez szczegółów (darmowe)

**Problem:** 
- Nie wiemy dokładnie, ile kredytów zużywa `/people/search` z `reveal_personal_emails: true`
- Według dokumentacji Apollo, `/people/search` nie jest wymieniony w cenniku - może być darmowy bez `reveal_personal_emails`
- Z `reveal_personal_emails: true` prawdopodobnie zużywa kredyt

### 2. `/v1/mixed_people/search`
**Gdzie używamy:**
- `searchPeopleViaMixedPeople()` - fallback gdy `/people/search` nie jest dostępny
- `enrichPerson()` - fallback do pobierania emaili

**Parametry:**
- `organization_ids: [organizationId]`
- `q_organization_name`
- `q_company_domains: [domain]`
- `contact_scopes.include_personal_emails: true` - ⚠️ **ZUŻYWA 1 KREDYT ZA STRONĘ**

**Problem:**
- ⚠️ **1 kredyt za stronę zwróconą** - nawet jeśli nie znajdziemy szukanej osoby!
- Używamy `per_page: 100`, więc jeśli zwróci 1 stronę = 1 kredyt
- Jeśli osoba nie zostanie znaleziona, kredyt i tak został zużyty

### 3. `/v1/organizations/search` lub `/v1/accounts/search`
**Gdzie używamy:**
- `searchOrganizations()` - wyszukiwanie firm

**Status:** Prawdopodobnie darmowe (nie ma w cenniku kredytów)

## Problemy i niepotrzebne zużycie kredytów

### Problem 1: `mixed_people/search` zużywa kredyt za stronę
**Obecne zachowanie:**
- Wywołujemy `mixed_people/search` z `include_personal_emails: true`
- Apollo zwraca stronę (nawet jeśli nie ma osoby) = **1 kredyt zużyty**
- Jeśli osoba nie zostanie znaleziona, kredyt został zmarnowany

**Rozwiązanie:**
- Użyj `/mixed_people/api_search` (DARMOWE) do sprawdzania istnienia osoby
- Dopiero gdy znajdziemy osobę, użyj `/people/bulk_match` do pobrania emaila (1 kredyt za nowy email)

### Problem 2: Nie używamy `/people/bulk_match`
**Obecne zachowanie:**
- Używamy `/people/search` z `reveal_personal_emails: true`
- Nie wiemy dokładnie, ile to kosztuje

**Rozwiązanie:**
- Sprawdź, czy mamy dostęp do `/people/bulk_match`
- `/people/bulk_match` zużywa kredyt tylko za **NOWE** emaile (1 kredyt za nowy email)
- Jeśli email już był dostępny, nie zużywa kredytu

### Problem 3: Nie używamy `/mixed_people/api_search`
**Obecne zachowanie:**
- Używamy `/mixed_people/search` do sprawdzania (zużywa kredyt)

**Rozwiązanie:**
- Użyj `/mixed_people/api_search` do sprawdzania istnienia osoby (DARMOWE)
- Zwraca częściowe profile, ale wystarczy do sprawdzenia, czy osoba istnieje

## Rekomendacje

### 1. Sprawdzenie istnienia osoby (DARMOWE)
```typescript
// Użyj /mixed_people/api_search (DARMOWE)
const response = await fetch(`${APOLLO_API_BASE_URL}/mixed_people/api_search`, {
  method: "POST",
  body: JSON.stringify({
    organization_ids: [organizationId],
    // ... inne parametry
  })
});
```

### 2. Pobieranie emaili (1 kredyt za nowy email)
```typescript
// Użyj /people/bulk_match (1 kredyt za nowy email)
const response = await fetch(`${APOLLO_API_BASE_URL}/people/bulk_match`, {
  method: "POST",
  body: JSON.stringify({
    person_ids: [personId1, personId2, ...],
    // Automatycznie pobiera emaile dla osób, które ich nie mają
  })
});
```

### 3. Wyszukiwanie pracowników (DARMOWE)
```typescript
// Użyj /people/search BEZ reveal_personal_emails (darmowe)
const response = await fetch(`${APOLLO_API_BASE_URL}/people/search`, {
  method: "POST",
  body: JSON.stringify({
    organization_ids: [organizationId],
    person_details: false, // DARMOWE
  })
});
```

## Szczegółowa analiza obecnego użycia

### Miejsce 1: `searchPeopleFromOrganization()`
**Endpoint:** `/v1/people/search`
**Kiedy używamy:**
- Podczas weryfikacji person dla firmy
- Podczas pobierania listy pracowników

**Parametry:**
- `organization_ids`, `organization_name`, `q_organization_domains`
- `revealEmails: false` (domyślnie) - ✅ DARMOWE
- `revealEmails: true` - ⚠️ Prawdopodobnie zużywa kredyt (nie wiemy dokładnie ile)

**Kredyty:**
- Bez `reveal_personal_emails`: ✅ DARMOWE (prawdopodobnie)
- Z `reveal_personal_emails: true`: ⚠️ Nie wiemy dokładnie (nie ma w cenniku)

**Fallback:** `/v1/mixed_people/search` z `include_personal_emails: true` - ⚠️ **1 KREDYT ZA STRONĘ**

### Miejsce 2: `enrichPerson()`
**Endpoint:** `/v1/people/search` → fallback `/v1/mixed_people/search`
**Kiedy używamy:**
- Pobieranie emaila dla pojedynczego leada (przycisk "Pobierz")

**Problem:**
- Używa `/people/search` z `reveal_personal_emails: true` - nie wiemy ile kosztuje
- Fallback używa `/mixed_people/search` z `include_personal_emails: true` - ⚠️ **1 KREDYT ZA STRONĘ**
- Nawet jeśli osoba nie zostanie znaleziona, kredyt został zużyty!

**Kredyty:**
- `/people/search` z `reveal_personal_emails: true`: ⚠️ Nie wiemy (prawdopodobnie 1 kredyt)
- `/mixed_people/search` z `include_personal_emails: true`: ⚠️ **1 KREDYT ZA STRONĘ** (nawet jeśli osoba nie istnieje)

### Miejsce 3: `enrichPeopleBulk()`
**Endpoint:** `/v1/people/search`
**Kiedy używamy:**
- Pobieranie emaili dla wielu osób na raz

**Parametry:**
- `person_ids: [id1, id2, ...]`
- `reveal_personal_emails: true`

**Kredyty:**
- ⚠️ Nie wiemy dokładnie (nie ma w cenniku)

### Miejsce 4: `searchPeopleViaMixedPeople()`
**Endpoint:** `/v1/mixed_people/search`
**Kiedy używamy:**
- Fallback gdy `/people/search` nie jest dostępny
- Podczas weryfikacji person (gdy `revealEmails: true`)

**Parametry:**
- `contact_scopes.include_personal_emails: true` - ⚠️ **1 KREDYT ZA STRONĘ**

**Kredyty:**
- ⚠️ **1 KREDYT ZA STRONĘ** - nawet jeśli nie znajdziemy szukanej osoby!

### Miejsce 5: `searchOrganizations()`
**Endpoint:** `/v1/organizations/search` lub `/v1/accounts/search`
**Kiedy używamy:**
- Wyszukiwanie firm po nazwie/domenie

**Kredyty:**
- ✅ Prawdopodobnie DARMOWE (nie ma w cenniku)

## Główne problemy

### Problem 1: `mixed_people/search` zużywa kredyt za stronę
**Obecne zachowanie:**
- Wywołujemy `/mixed_people/search` z `include_personal_emails: true`
- Apollo zwraca stronę (100 wyników) = **1 kredyt zużyty**
- Jeśli szukana osoba nie jest w tych 100 wynikach, kredyt został zmarnowany

**Przykład:**
- Szukamy osoby `63d7e20c3ad30800015da253` w organizacji `tori-expo.com`
- Apollo zwraca 100 osób, ale nie ma naszej osoby
- **1 kredyt zużyty, email nie pobrany**

### Problem 2: Nie używamy `/mixed_people/api_search` (DARMOWE)
**Obecne zachowanie:**
- Używamy `/mixed_people/search` do sprawdzania (zużywa kredyt)

**Rozwiązanie:**
- Użyj `/mixed_people/api_search` do sprawdzania (DARMOWE)
- Zwraca częściowe profile, ale wystarczy do sprawdzenia istnienia

### Problem 3: Nie używamy `/people/bulk_match`
**Obecne zachowanie:**
- Używamy `/people/search` z `reveal_personal_emails: true`
- Nie wiemy dokładnie, ile to kosztuje

**Rozwiązanie:**
- Użyj `/people/bulk_match` do pobierania emaili
- Zużywa kredyt tylko za **NOWE** emaile (1 kredyt za nowy email)
- Jeśli email już był dostępny, nie zużywa kredytu

### Problem 4: Niepotrzebne zużycie kredytów
**Przykład z `enrichPerson()`:**
1. Wywołujemy `/people/search` z `reveal_personal_emails: true` - ⚠️ 1 kredyt (prawdopodobnie)
2. Jeśli błąd 403, fallback do `/mixed_people/search` z `include_personal_emails: true` - ⚠️ 1 kredyt za stronę
3. Jeśli osoba nie zostanie znaleziona, **2 kredyty zmarnowane**

## Plan działania

### Krok 1: Sprawdź dostępność endpointów
1. Sprawdź, czy mamy dostęp do `/mixed_people/api_search` (DARMOWE)
2. Sprawdź, czy mamy dostęp do `/people/bulk_match` (1 kredyt za nowy email)

### Krok 2: Zrefaktoruj `enrichPerson()`
**Nowa logika:**
1. Sprawdź istnienie przez `/mixed_people/api_search` (DARMOWE) lub `/people/search` bez `reveal_personal_emails` (DARMOWE)
2. Jeśli osoba istnieje, użyj `/people/bulk_match` do pobrania emaila (1 kredyt za nowy email)
3. Jeśli `/people/bulk_match` nie jest dostępny, użyj `/people/search` z `reveal_personal_emails: true` jako fallback

**Oszczędność:**
- Obecnie: 1-2 kredyty (nawet jeśli osoba nie istnieje)
- Po poprawce: 0 kredytów (jeśli osoba nie istnieje), 1 kredyt (tylko za nowy email)

### Krok 3: Zrefaktoruj `searchPeopleFromOrganization()`
**Nowa logika:**
- Zawsze używaj `/people/search` bez `reveal_personal_emails` (DARMOWE)
- Jeśli potrzebne emaile, użyj `/people/bulk_match` osobno dla wybranych osób

**Oszczędność:**
- Obecnie: 1 kredyt za stronę (jeśli `revealEmails: true`)
- Po poprawce: 0 kredytów (wyszukiwanie), 1 kredyt za nowy email (tylko gdy potrzebny)

### Krok 4: Zrefaktoruj `searchPeopleViaMixedPeople()`
**Nowa logika:**
- Używaj `/mixed_people/api_search` zamiast `/mixed_people/search` (DARMOWE)
- Do pobierania emaili użyj `/people/bulk_match` osobno

**Oszczędność:**
- Obecnie: 1 kredyt za stronę
- Po poprawce: 0 kredytów (wyszukiwanie), 1 kredyt za nowy email (tylko gdy potrzebny)

### Krok 5: Zrefaktoruj `enrichPeopleBulk()`
**Nowa logika:**
- Użyj `/people/bulk_match` zamiast `/people/search` z `reveal_personal_emails: true`
- Zużywa kredyt tylko za NOWE emaile

**Oszczędność:**
- Obecnie: 1 kredyt za osobę (prawdopodobnie)
- Po poprawce: 1 kredyt za nowy email (jeśli email już był dostępny, nie zużywa kredytu)

