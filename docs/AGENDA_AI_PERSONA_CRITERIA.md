## Agenda AI – wymagania i model danych dla person

### 1. Kontekst

- Obecnie Chat.AI prowadzi użytkownika przez kwalifikację firm i zapisuje wynik w `CompanyVerificationCriteria`.
- Agenda AI ma korzystać z tego samego kontekstu, ale dodatkowo znać listę person (stanowisk) pasujących do kampanii.
- Cele: rekomendacje stanowisk tylko z firm "qualified" oraz pełna kontrola nad tym, jakie role są akceptowane/odrzucane.

### 2. Wymagania biznesowe

1. **Dwustopniowa rozmowa** – najpierw definicja kryteriów firm (jak dziś), potem szczegółowe ustalenia dotyczące person.
2. **Pozytywne/negatywne persony** – możliwość zapisania zarówno tego, kogo szukamy (np. Project Manager, Founder), jak i kogo unikamy (marketing, finanse, juniorzy).
3. **Dodatkowe atrybuty** – możliwość określenia minimalnej seniority, działów, słów kluczowych do wyszukiwania i słów kluczowych do wykluczenia.
4. **Strategie dopasowania** – możliwość oznaczenia wyjątków (np. "production worker" tylko jeśli tytuł zawiera "manager").
5. **Ślad audytowy** – zapisywanie historii rozmowy oraz wersjonowanie reguł (kto i kiedy zmienił).
6. **Jedna konfiguracja na kampanię / projekt prospectingu** – persony powiązane z kampanią lub konfiguracją weryfikacji firmowej.

### 3. Proponowane rozszerzenia modelu danych

#### 3.1. Nowa tabela `CompanyPersonaCriteria`

| Kolumna | Typ | Opis |
| --- | --- | --- |
| `id` | Int @id @default(autoincrement()) | Klucz główny |
| `companyCriteriaId` | Int | FK do `CompanyVerificationCriteria.id` (powiązanie person z zestawem kryteriów firmowych) |
| `name` | String | Nazwa konfiguracji (np. "Osoby decyzyjne – stoiska targowe") |
| `description` | String? | Krótki opis |
| `positiveRoles` | Json | Lista akceptowanych stanowisk (struktura poniżej) |
| `negativeRoles` | Json | Lista odrzucanych stanowisk |
| `conditionalRules` | Json | Reguły warunkowe (np. "production" + "manager") |
| `language` | String? | Preferowany język rozmowy (opcjonalnie) |
| `createdAt`, `updatedAt` | DateTime | Ślad czasowy |
| `createdBy`, `updatedBy` | String? | Identyfikacja użytkownika |

#### 3.2. Struktura obiektów JSON

```jsonc
positiveRoles: [
  {
    "label": "Project Manager",
    "matchType": "contains", // contains | exact | regex | embedding
    "keywords": ["project manager", "pm", "kierownik projektu"],
    "departments": ["operations", "production"],
    "minSeniority": "mid", // junior | mid | senior | director | executive
    "confidence": 0.9 // jak mocno chcemy priorytetować
  },
  {
    "label": "Founder / Owner",
    "matchType": "contains",
    "keywords": ["owner", "founder", "właściciel"],
    "minSeniority": "executive"
  }
]

negativeRoles: [
  {
    "label": "Marketing",
    "keywords": ["marketing", "growth", "digital"],
    "departments": ["marketing"],
    "confidence": 0.95
  },
  {
    "label": "Finance",
    "keywords": ["finance", "accounting", "księgowość"],
    "departments": ["finance"]
  }
]

conditionalRules: [
  {
    "rule": "include",
    "whenAll": ["production", "manager"],
    "unless": ["assistant", "junior"],
    "notes": "Produkcja tylko jeżeli stanowisko ma rangę managerską"
  }
]
```

#### 3.3. Relacja z kampaniami

- W `Campaign` dodajemy FK `personaCriteriaId` (opcjonalne). Kampania może korzystać z konkretnego zestawu person.
- Alternatywnie kampania może posiadać własną kopię reguł (jeśli chcemy mieć różne persony dla różnych kampanii mimo wspólnego kryterium firmy).

### 4. Przepływ danych

1. **Rozmowa z Chat.AI**: po definicji firm uruchamiamy moduł „persony” – chat zapisuje strukturę w `CompanyPersonaCriteria`.
2. **Agenda AI**: otrzymuje (firma + personaCriteria) i generuje listę kandydatów z Apollo wraz z typem dopasowania (positive/conditional/odrzucony).
3. **UI**: pokazuje listę rekomendowanych osób, prosi o zatwierdzenie pobrania kontaktu.
4. **Manualne feedbacki**: sprzedaż może oznaczyć osobę jako trafioną/nie i system zapisuje to w `AgendaRecommendation` (nowa tabela).

### 5. Kolejne kroki

1. Przygotować migracje Prisma dla `CompanyPersonaCriteria` (oraz ewentualnie kolumny w `Campaign`).
2. Zaprojektować API (GET/POST/PUT) do zarządzania personami.
3. Rozszerzyć Chat.AI o etap rozmowy „persony” (wykorzystanie nowego serwisu).
4. Przygotować moduł Agenda AI wykorzystujący zapisane reguły.
5. Testy integracyjne: scenariusze firma → persony → rekomendacje.


