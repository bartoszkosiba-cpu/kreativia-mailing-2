# 📊 Wskaźnik Postępu Importu

## Opis

System wskaźnika postępu importu leadów z wizualizacją na żywo, szacowanym czasem zakończenia i obsługą błędów.

## Struktura

### 1. Backend API

#### `/api/leads/import/progress` - Endpoint śledzenia postępu

**GET** - Pobiera aktualny postęp importu
```
GET /api/leads/import/progress?importId=import_123
```

Odpowiedź:
```json
{
  "importId": "import_123",
  "total": 100,
  "processed": 45,
  "percentage": 45,
  "currentStep": "Zapisywanie leadów... (45/100)",
  "elapsed": 30,
  "remainingTime": 37,
  "errors": [],
  "isComplete": false
}
```

**POST** - Aktualizuje postęp importu (wewnętrzne)
```json
{
  "importId": "import_123",
  "total": 100,
  "processed": 45,
  "currentStep": "Zapisywanie leadów...",
  "error": "Opcjonalny błąd"
}
```

### 2. Modyfikacje w `/api/leads/import`

Endpoint importu został rozszerzony o:
- Generowanie unikalnego `importId`
- Raportowanie postępu w kluczowych momentach
- Zwracanie `importId` w odpowiedzi

Kroki raportowania:
1. **Inicjalizacja** - `"Inicjalizacja importu..."`
2. **Sprawdzanie API** - `"Sprawdzanie ChatGPT API..."`
3. **Przygotowanie** - `"Przygotowywanie imion do odmiany..."`
4. **Odmiana** - `"Pobieranie odmian przez ChatGPT dla X imion..."`
5. **Zapis** - `"Zapisywanie leadów... (X/Y)"` (co 10 leadów)
6. **Zakończenie** - `"Zakończono! Dodano: X, Zaktualizowano: Y, Pominięto: Z"`

### 3. Komponent Frontend - `ImportProgress.tsx`

**Lokalizacja:** `app/components/ImportProgress.tsx`

**Props:**
```typescript
interface ImportProgressProps {
  importId: string | null;        // ID importu do śledzenia
  onComplete?: (result: any) => void;  // Callback po zakończeniu
  onError?: (error: string) => void;   // Callback w przypadku błędu
}
```

**Funkcje:**
- Automatyczne odpytywanie API co 1 sekundę
- Wizualizacja postępu (pasek, procenty)
- Wyświetlanie aktualnego kroku
- Licznik czasu (upłynęło/pozostało)
- Wyświetlanie błędów
- Auto-ukrywanie po zakończeniu (3s)
- Animacja ładowania

**Wygląd:**
- Modal z półprzezroczystym tłem
- Biała karta z zaokrąglonymi rogami
- Czerwony pasek postępu (brand color)
- Czytelne fonty i odstępy
- Responsywny design

## Integracja w `app/import/page.tsx`

```typescript
// 1. Import komponentu
import ImportProgress from "../components/ImportProgress";

// 2. Stan dla importId
const [importId, setImportId] = useState<string | null>(null);

// 3. Po wysłaniu importu
const result = await fetch("/api/leads/import", { ... });
if (result.ok) {
  const data = await result.json();
  setImportId(data.importId); // Uruchom śledzenie
}

// 4. Callbacki
const handleImportComplete = (result: any) => {
  // Zakończono import
  setImportId(null);
  setIsProcessing(false);
};

const handleImportError = (error: string) => {
  // Błąd importu
  setImportId(null);
  setIsProcessing(false);
};

// 5. Renderowanie
<ImportProgress 
  importId={importId}
  onComplete={handleImportComplete}
  onError={handleImportError}
/>
```

## Dane techniczne

### Przechowywanie postępu
- **Aktualnie:** W pamięci serwera (`Map`)
- **Dla produkcji:** Rozważyć Redis lub bazę danych
- **Czyszczenie:** Automatyczne po 1 godzinie

### Wydajność
- Polling co 1 sekundę (optymalne dla UX)
- Aktualizacje postępu co 10 leadów (zmniejsza liczbę wywołań)
- Szacowany czas oparty na średnim czasie przetwarzania

### Obliczenia czasu
```typescript
// Czas upłynięty
elapsed = currentTime - startTime

// Średni czas na element
avgTimePerItem = elapsed / processed

// Pozostały czas
remainingTime = avgTimePerItem * (total - processed)
```

## Testowanie

### Test z konsoli (Python):
```python
import requests
import time

# Wyślij import
response = requests.post('http://localhost:3000/api/leads/import', 
    json={'leads': [...], 'tagId': 1})
result = response.json()
import_id = result['importId']

# Śledź postęp
while True:
    progress = requests.get(f'http://localhost:3000/api/leads/import/progress?importId={import_id}').json()
    print(f"{progress['percentage']}% - {progress['currentStep']}")
    if progress['isComplete']:
        break
    time.sleep(1)
```

### Test z przeglądarki:
1. Otwórz `http://localhost:3000/import`
2. Wybierz plik CSV z leadami
3. Wybierz tag
4. Kliknij "Zapisz leady"
5. Obserwuj wskaźnik postępu

## Możliwe rozszerzenia

### Krótkoterminowe:
- [ ] Przycisk "Anuluj" dla długich importów
- [ ] Dźwięk po zakończeniu
- [ ] Szczegółowe logi w rozwijanym panelu

### Długoterminowe:
- [ ] WebSocket zamiast pollingu (real-time)
- [ ] Historia importów
- [ ] Podgląd przetworzonych leadów na żywo
- [ ] Eksport raportu z importu (PDF)
- [ ] Równoległe importy (kolejka)

## Diagram przepływu

```
┌──────────────┐
│   Frontend   │
│  (import UI) │
└──────┬───────┘
       │
       │ POST /api/leads/import { leads: [...] }
       ▼
┌──────────────┐
│   Backend    │─────► Generuje importId
│    (API)     │─────► Inicjalizuje postęp
└──────┬───────┘
       │
       │ { importId: "123", ... }
       ▼
┌──────────────┐
│ ImportProgress│◄──── GET /api/leads/import/progress?importId=123
│  (Component) │       (co 1 sekundę)
└──────┬───────┘
       │
       │ { percentage: 45%, currentStep: "...", ... }
       ▼
┌──────────────┐
│  User sees:  │
│  ▓▓▓▓▓░░░░░  │ 45%
│ "Zapisywanie │
│  leadów..."  │
└──────────────┘
```

## Status
✅ Zaimplementowane
✅ Przetestowane
✅ Gotowe do użycia

**Data:** 2025-10-16
**Wersja:** 1.0

