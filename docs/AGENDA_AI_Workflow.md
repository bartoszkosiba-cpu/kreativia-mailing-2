## Agenda AI – moduł rekomendacji osób

### 1. Cel modułu
- wykorzystuje istniejące kryteria firm + person, aby zasugerować konkretne osoby z Apollo,
- dostarcza workflow: propozycja → akceptacja → ewentualne pobranie emaila,
- pełna kontrola użytkownika (nic nie pobieramy automatycznie).

### 2. Zakres prac

1. **Zbieranie danych** – wejście: id firmy/kampanii + `personaCriteria`; źródło osób: Apollo (people search).
2. **Silnik rekomendacji** – dopasowanie tytułu do pozytywnych ról, odrzucanie negatywnych, ocena seniority/działu, score + uzasadnienie.
3. **Warstwa API** – endpointy do generowania listy (`POST /api/agenda/recommendations`), podejmowania decyzji (`POST /api/agenda/recommendations/[id]/decision`) i pobierania emaila po akceptacji.
4. **Workflow akceptacji** – statusy: `suggested`, `approved`, `rejected`, `email_fetched`; zapis do bazy; możliwość dodania do kampanii.
5. **Logowanie i audyt** – logi w module `agenda-recommendation`, przechowywanie linku/źródła.

### 3. Model danych

```
model AgendaRecommendation {
  id             Int      @id @default(autoincrement())
  campaignId     Int
  companyId      Int
  leadId         Int?
  externalId     String?
  fullName       String
  title          String
  email          String?
  status         String  @default("suggested")
  confidence     Float?
  reasoning      String?
  sourceUrl      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  decidedBy      String?
  decidedAt      DateTime?
  notes          String?
  metadata       String?
}
```

### 4. Kroki wdrożenia
1. Migracja Prisma (tabela `AgendaRecommendation`).
2. Integracja Apollo (helper zwracający osoby dla firmy).
3. Funkcja dopasowania (ocena stanowiska vs kryteria).
4. API (tworzenie, decyzje, pobieranie emaili po akceptacji).
5. Powiązanie z kampanią (dodawanie leadów po zatwierdzeniu).

### 5. Testy
- jednostkowe: matching ról, konwersja danych,
- integracyjne: generacja → akceptacja → email,
- manualne: UI (lista propozycji, przyciski akcji).
