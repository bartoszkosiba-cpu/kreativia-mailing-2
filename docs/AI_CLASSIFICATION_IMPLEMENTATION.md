# Implementacja Modułu Klasyfikacji AI Firm

## ✅ Co zostało zrobione

### 1. Baza danych
- ✅ Nowa tabela `CompanyClassification` w schema.prisma
- ✅ Relacja many-to-many: Firma → Wiele specjalizacji (ze scoringiem 1-5)
- ✅ Backward compatibility: Główne pola klasyfikacji nadal aktualizowane

### 2. Service AI
- ✅ `src/services/companyClassificationAI.ts`
  - `classifyCompanyWithAI()` - Klasyfikuje firmę przez AI
  - `saveClassificationToDatabase()` - Zapisuje klasyfikację do bazy

### 3. API Endpoint
- ✅ `app/api/company-selection/classify/route.ts`
  - POST - Klasyfikuje paczki firm (po 10 naraz)
  - GET - Pobiera statystyki klasyfikacji

### 4. Strona UI
- ✅ `app/company-selection/classify/page.tsx`
  - Lista paczek importów
  - Wybór paczki do klasyfikacji
  - Uruchomienie klasyfikacji AI
  - Postęp i wyniki

### 5. Menu
- ✅ Link do klasyfikacji AI w głównej stronie company-selection

## 📋 Co jeszcze trzeba zrobić

### 1. Migracja bazy danych
```bash
npx prisma db push --accept-data-loss
```
Lub jeśli chcesz użyć migracji:
```bash
# Zastosuj migrację ręcznie z pliku:
# prisma/migrations/20250112000000_add_company_classifications/migration.sql
sqlite3 prisma/dev.db < prisma/migrations/20250112000000_add_company_classifications/migration.sql
```

### 2. Zintegrować z istniejącym systemem filtrowania
- Zaktualizować `/api/company-selection/list` aby uwzględniało nową tabelę `CompanyClassification`
- Filtrowanie po specjalizacjach powinno działać z nową tabelą

### 3. Testy
- Przetestować klasyfikację na małej próbce firm
- Sprawdzić czy scoring działa poprawnie
- Sprawdzić czy wiele specjalizacji per firma działa

## 🚀 Jak używać

1. **Import CSV** → `/company-selection/import-mass`
2. **Klasyfikacja AI** → `/company-selection/classify`
   - Wybierz paczkę
   - Kliknij "Rozpocznij klasyfikację AI"
3. **Przegląd wyników** → `/company-selection/overview`

## 📊 Przykład użycia

```typescript
// Klasyfikacja przez API
POST /api/company-selection/classify
{
  "importBatchId": 123
}

// Odpowiedź:
{
  "success": true,
  "total": 1000,
  "classified": 950,
  "skipped": 30,
  "errors": 20,
  "message": "Zaklasyfikowano 950 firm, pominięto 30, błędów: 20"
}
```

## 🔧 Konfiguracja

### Zmienne środowiskowe
- `OPENAI_API_KEY` - Klucz API OpenAI (wymagany)

### Parametry klasyfikacji
- `CHUNK_SIZE = 10` - Liczba firm klasyfikowanych naraz
- `CONFIDENCE_THRESHOLD = 0.7` - Próg pewności (poniżej → needsReview)

## ⚠️ Uwagi

1. **Koszt API**: Klasyfikacja 10,000 firm może kosztować ~$50-100 (w zależności od długości opisów)
2. **Czas**: Klasyfikacja 10,000 firm może trwać 30-60 minut (z uwzględnieniem opóźnień)
3. **Ograniczenia**: Tylko firmy z Keywords lub Short Description są klasyfikowane

## 📝 Następne kroki

1. Zastosuj migrację bazy danych
2. Przetestuj klasyfikację na małej próbce
3. Zintegruj z istniejącym systemem filtrowania
4. Usuń stary system klasyfikacji (opcjonalnie, po testach)

