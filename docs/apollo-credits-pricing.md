# Apollo API - Cennik kredytów

## Endpointy i koszty kredytów

### Mixed People

#### `/mixed_people/api_search`
- **Kredyty:** ❌ **DARMOWE** (0 kredytów)
- **Zwraca:** Częściowe profile (partial profile)
- **Uwaga:** Aby uzyskać pełne profile, należy wywołać `people/bulk_match`
- **Limit:** Max 100 wyników na stronę

#### `/mixed_people/search`
- **Kredyty:** ⚠️ **1 kredyt / strona zwrócona**
- **Limit:** Max 100 wyników na stronę
- **UWAGA:** Kredyt jest pobierany za każdą zwróconą stronę, nawet jeśli nie znajdziemy szukanej osoby!

### Mixed Companies

#### `/mixed_companies/search`
- **Kredyty:** ⚠️ **1 kredyt / strona zwrócona**
- **Limit:** Max 100 wyników na stronę

### People

#### `/people/match`
- **Kredyty:** 
  - 1 kredyt / **nowy email** zwrócony (net-new email)
  - 1 kredyt / **nowe dane firmograficzne lub demograficzne** wyeksportowane (net-new firmographic or demographic data)
  - 5 kredytów / **nowy numer telefonu** zwrócony (net-new phone number)
- **Uwaga:** Kredyt jest pobierany tylko za **NOWE** dane, które wcześniej nie były dostępne

#### `/people/bulk_match`
- **Kredyty:** 
  - 1 kredyt / **nowy email** zwrócony (net-new email)
  - 1 kredyt / **nowe dane firmograficzne lub demograficzne** wyeksportowane (net-new firmographic or demographic data)
  - 5 kredytów / **nowy numer telefonu** zwrócony (net-new phone number)
- **Uwaga:** Kredyt jest pobierany tylko za **NOWE** dane, które wcześniej nie były dostępne
- **Zastosowanie:** Do pobierania wielu osób na raz

### Organizations

#### `/organizations/enrich`
- **Kredyty:** ⚠️ **1 kredyt / wynik zwrócony**

#### `/organizations/bulk_enrich`
- **Kredyty:** ⚠️ **1 kredyt / firma zwrócona**
- **Limit:** Max 10 wyników na stronę

#### `/organizations/{organization_id}/job_postings`
- **Kredyty:** ⚠️ **1 kredyt / wynik zwrócony**
- **Limit:** Max 10,000 wyników na stronę

## Ważne uwagi

1. **`/mixed_people/search` zużywa kredyt za stronę**, nawet jeśli nie znajdziemy szukanej osoby
2. **`/people/bulk_match` zużywa kredyt tylko za NOWE dane** - jeśli email już był dostępny, nie zużywa kredytu
3. **`/mixed_people/api_search` jest DARMOWE** - można używać do sprawdzania bez kosztów
4. Aby pobrać pełne profile z `/mixed_people/api_search`, należy następnie wywołać `/people/bulk_match`

## Rekomendacje

1. **Do sprawdzania istnienia osoby:** Użyj `/mixed_people/api_search` (DARMOWE)
2. **Do pobierania emaili:** Użyj `/people/bulk_match` (1 kredyt za nowy email)
3. **Unikaj:** `/mixed_people/search` z `include_personal_emails: true` - zużywa kredyt za stronę, nawet jeśli nie znajdziemy osoby

