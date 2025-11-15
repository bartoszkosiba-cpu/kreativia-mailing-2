# Moduł Klasyfikacji AI Firm

## 🎯 Cel

Automatyczna klasyfikacja firm do specjalizacji używając AI. System zwraca główną specjalizację + 1-2 dodatkowe ze scoringiem 1-5, dzięki czemu firma może być używana w różnych kampaniach.

## 📋 Architektura

### 1. Baza Danych

**Nowa tabela: `CompanyClassification`**
- `id` - ID klasyfikacji
- `companyId` - ID firmy
- `specializationCode` - Kod specjalizacji (np. "WK_TRADESHOW_BUILDER")
- `score` - Scoring 1-5
- `confidence` - Pewność AI 0.0-1.0
- `isPrimary` - Czy to główna specjalizacja
- `reason` - Uzasadnienie klasyfikacji
- `source` - Źródło (AI | MANUAL | RULES)

**Backward Compatibility:**
- Główne pola klasyfikacji (`classificationClass`, `classificationSubClass`) są nadal aktualizowane
- Nowa tabela pozwala na wiele specjalizacji per firma

### 2. Workflow

1. **Import CSV** → Firmy są importowane bez klasyfikacji
2. **Strona Klasyfikacji** → Wybierasz paczki firm do klasyfikacji
3. **AI Klasyfikacja** → AI klasyfikuje firmy w paczkach po 10 naraz
4. **Wyniki** → Firma ma główną specjalizację + alternatywne (score >= 3)

### 3. Dane Wejściowe dla AI

AI używa tylko 2 kolumn:
- **Keywords** - Słowa kluczowe
- **Short Description** (`activityDescription`) - Krótki opis działalności

### 4. Wynik Klasyfikacji

```typescript
{
  primarySpecialization: "WK_TRADESHOW_BUILDER",
  primaryScore: 5, // 1-5
  primaryConfidence: 0.95, // 0.0-1.0
  alternativeSpecializations: [
    {
      code: "WK_EVENT_COMPANY",
      score: 4,
      confidence: 0.8
    }
  ],
  reason: "Firma specjalizuje się w budowie stoisk targowych, ale także organizuje eventy",
  needsReview: false // true jeśli confidence < 0.7
}
```

### 5. Scoring System

- **5**: Idealne dopasowanie, to jest główna działalność firmy
- **4**: Bardzo dobre dopasowanie, firma na pewno działa w tym obszarze
- **3**: Dobre dopasowanie, firma prawdopodobnie działa w tym obszarze
- **2**: Słabe dopasowanie, firma może działać w tym obszarze (nie zapisujemy)
- **1**: Bardzo słabe dopasowanie (nie zapisujemy)

**Tylko specjalizacje z score >= 3 są zapisywane.**

### 6. Strony Modułu

1. **Import** (`/company-selection/import`) - Import CSV
2. **Klasyfikacja AI** (`/company-selection/classify`) - **NOWA** - Automatyczna klasyfikacja paczek firm
3. **Przegląd Bazy** (`/company-selection/overview`) - Przegląd zaklasyfikowanych firm
4. **Zablokowane** (`/company-selection/blocked`) - Firma zablokowane

### 7. API Endpoints

- `POST /api/company-selection/classify` - Klasyfikuje paczki firm
  - Body: `{ companyIds?: number[], importBatchId?: number, market?: string }`
- `GET /api/company-selection/classify?importBatchId=123` - Pobiera statystyki klasyfikacji

### 8. Przykłady Użycia

**Klasyfikacja paczki importu:**
```bash
POST /api/company-selection/classify
{
  "importBatchId": 123
}
```

**Klasyfikacja wybranych firm:**
```bash
POST /api/company-selection/classify
{
  "companyIds": [1, 2, 3, 4, 5]
}
```

## 🔧 Implementacja

### 1. Service: `companyClassificationAI.ts`
- `classifyCompanyWithAI()` - Klasyfikuje firmę przez AI
- `saveClassificationToDatabase()` - Zapisuje klasyfikację do bazy

### 2. API: `/api/company-selection/classify`
- POST - Klasyfikuje paczki firm
- GET - Pobiera statystyki klasyfikacji

### 3. Strona: `/company-selection/classify`
- Lista paczek importów
- Wybór paczek do klasyfikacji
- Uruchomienie klasyfikacji
- Postęp i wyniki

## 📊 Korzyści

1. **Większa dokładność** - AI rozumie kontekst, nie tylko słowa kluczowe
2. **Wiele specjalizacji** - Firma może być używana w różnych kampaniach
3. **Scoring** - Wiesz jak dobrze firma pasuje do specjalizacji
4. **Automatyzacja** - Nie musisz ręcznie klasyfikować 10,000 firm
5. **Czas** - Oszczędność czasu vs ręczna klasyfikacja

## ⚠️ Uwagi

- AI klasyfikuje w paczkach po 10 firm (żeby nie przeciążyć API)
- Małe opóźnienia między firmami (100ms) i paczkami (500ms)
- Tylko firmy z Keywords lub Short Description są klasyfikowane
- Confidence < 0.7 → `needsReview: true`

