# Podsumowanie dostępnych danych z Apollo API

## Endpoint: `/v1/accounts/search`
✅ **Wyszukiwanie firm/kont (organizacji)**
- Podstawowe dane firmy: nazwa, domena, website
- Lokalizacja: miasto, kraj, adres
- Dane biznesowe: liczba pracowników, branża, rok założenia
- Linki: LinkedIn, Twitter, Facebook
- Numery telefonów
- Market cap, giełda (jeśli publiczna)

## Endpoint: `/v1/people/search`
✅ **Wyszukiwanie osób (darmowe - bez emaili)**
- Podstawowe dane: imię, nazwisko, stanowisko
- Organizacja: nazwa firmy, ID organizacji
- Email status: `verified`, `guessed`, `unavailable` (DARMOWE - status bez pobierania emaila)
- LinkedIn, Twitter, GitHub, Facebook
- Lokalizacja: miasto, stan, kraj
- Headline (nagłówek z LinkedIn)
- Photo URL

❌ **Email jest zablokowany** - nawet z `reveal_personal_emails=true`
- Email: `email_not_unlocked@domain.com`
- `revealed_for_current_team: true` - ale email nadal zablokowany

## PROBLEM: Brak dostępu do endpointów do odblokowania emaili

Obecny dostęp API:
- ✅ `/v1/accounts/search` - wyszukiwanie firm
- ✅ `/v1/people/search` - wyszukiwanie osób (bez emaili)

Brak dostępu do:
- ❌ `/v1/people/{id}` (GET) - pobieranie pojedynczej osoby
- ❌ `/v1/people/bulk` (POST) - pobieranie wielu osób
- ❌ `/v1/people/enrich` (POST) - wzbogacanie danych

## ROZWIĄZANIE:

**Opcja 1: Dodać dostęp do endpointów do odblokowania emaili**
- W ustawieniach Apollo API dodać dostęp do:
  - `/v1/people/{id}` (GET)
  - `/v1/people/bulk` (POST)
  - LUB `/v1/people/enrich` (POST)

**Opcja 2: Użyć `/v1/people/search` z `reveal_personal_emails=true`**
- Testowane, ale nadal nie działa - email pozostaje zablokowany
- Może wymagać innych parametrów lub uprawnień

## Co można zrobić TERAZ (bez dodatkowych uprawnień):

1. **Wyszukiwanie firm** - ✅ Działa przez `/v1/accounts/search`
2. **Wyszukiwanie osób** - ✅ Działa przez `/v1/people/search` (bez emaili)
3. **Sprawdzanie statusu emaila** - ✅ Działa (email_status: verified/guessed/unavailable)
4. **Pobieranie emaili** - ❌ NIE DZIAŁA (wymaga dodatkowych uprawnień)

## Rekomendacja:

Dodać dostęp do `/v1/people/{id}` lub `/v1/people/bulk` w ustawieniach Apollo API, żeby móc pobierać emaile dla wybranych osób.

