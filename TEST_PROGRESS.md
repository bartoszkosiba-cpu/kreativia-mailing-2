# 🧪 Test Wskaźnika Postępu

## Aby przetestować wskaźnik postępu:

### 1. Otwórz stronę importu
```
http://localhost:3000/import
```

### 2. Otwórz konsolę przeglądarki (F12)
- W Chrome/Edge: F12 → zakładka "Console"
- W Firefox: F12 → zakładka "Konsola"

### 3. Wybierz plik CSV z wieloma leadami (np. 50+)
- Im więcej leadów, tym dłużej trwa import
- Im dłużej trwa, tym lepiej widać pasek postępu

### 4. Kliknij "Zapisz leady"

### 5. Co powinieneś zobaczyć:

#### W Konsoli przeglądarki:
```
[FRONTEND] Rozpoczynam import 50 leadów...
[FRONTEND] Pierwsze 3 leady: [...]
[FRONTEND] Tag ID: 1
[FRONTEND] Odpowiedź serwera: status 200
[FRONTEND] Wynik importu: {...}
[FRONTEND] Ustawiam importId: import_1760601988527_ef9afxuim
[ImportProgress] Rozpoczynam śledzenie importu: import_1760601988527_ef9afxuim
[ImportProgress] Postęp: 0% Inicjalizacja importu...
[ImportProgress] Postęp: 10% Zapisywanie leadów... (10/50)
[ImportProgress] Postęp: 20% Zapisywanie leadów... (20/50)
...
[ImportProgress] Postęp: 100% Zakończono! Dodano: 50, Zaktualizowano: 0, Pominięto: 0
[ImportProgress] Import zakończony!
[ImportProgress] Ukrywam wskaźnik
```

#### Na ekranie:
1. **Modal z półprzezroczystym tłem** (czarny, 50% przezroczystości)
2. **Biała karta** w centrum z:
   - Nagłówkiem "Import leadów"
   - Licznikiem "10/50" (aktualizuje się)
   - **Czerwonym paskiem postępu** (rośnie od 0% do 100%)
   - Procentem "20%" pod paskiem
   - Tekstem "Zapisywanie leadów... (20/50)"
   - Czasem: "Uplynęło: 15s, Pozostało: 35s"
   - Spinnerem (kółko ładowania)
3. **Po zakończeniu:**
   - Zielony tekst "✅ Import zakończony!"
   - Modal znika po 5 sekundach

### 6. Jeśli NIE widzisz modala:

#### Sprawdź konsolę:
- Czy są błędy JavaScript?
- Czy `importId` jest ustawiony?
- Czy `[ImportProgress]` logi się pojawiają?

#### Sprawdź z-index:
Modal powinien mieć `z-50`, być na wierzchu wszystkiego.

#### Sprawdź czy import nie jest za szybki:
- Dla 1-5 leadów: import trwa ~3-5 sekund (można nie zauważyć)
- Dla 20+ leadów: import trwa ~30-60 sekund (widoczny pasek)
- Dla 100+ leadów: import trwa 2-3 minuty (świetnie widoczny)

## Szybki test API (bez UI):

```bash
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kreativia Mailing"

python3 << 'EOF'
import requests
import time

# Przygotuj dane
leads = [{"firstName": f"User{i}", "lastName": f"Test{i}", 
          "email": f"user{i}@test.com", "company": f"Company{i}",
          "keywords": "Tech", "companyCity": "Warsaw", 
          "companyCountry": "Poland"} for i in range(30)]

# Wyślij
res = requests.post('http://localhost:3000/api/leads/import',
                   json={'leads': leads, 'tagId': 1})
if res.ok:
    result = res.json()
    import_id = result['importId']
    print(f"Import ID: {import_id}")
    
    # Śledź postęp
    for _ in range(20):
        time.sleep(1)
        p = requests.get(f'http://localhost:3000/api/leads/import/progress?importId={import_id}').json()
        print(f"{p['percentage']}% - {p['currentStep']}")
        if p['isComplete']:
            break
EOF
```

## Możliwe problemy:

### 1. "Nic nie widzę"
- Import może być za szybki (test z 1-2 leadami)
- **Rozwiązanie:** Użyj pliku CSV z 50+ leadami

### 2. "Błąd w konsoli: Module not found"
- Problem z importem komponentu
- **Rozwiązanie:** Sprawdź czy plik `app/components/ImportProgress.tsx` istnieje

### 3. "Modal się nie pokazuje"
- `importId` nie jest ustawiony
- **Rozwiązanie:** Sprawdź czy API zwraca `importId` w odpowiedzi

### 4. "Modal się pokazuje ale brak paska postępu"
- Problem z pobieraniem danych z API
- **Rozwiązanie:** Sprawdź logi w konsoli, czy endpoint `/api/leads/import/progress` działa

### 5. "Pasek postępu nie rośnie"
- Backend nie raportuje postępu
- **Rozwiązanie:** Sprawdź logi serwera Next.js

## Debug:

Jeśli coś nie działa, dodaj w `app/import/page.tsx`:

```typescript
console.log('importId state:', importId);
```

I w `app/components/ImportProgress.tsx`:

```typescript
console.log('isVisible:', isVisible, 'progress:', progress);
```

## Oczekiwany rezultat:

✅ Modal pojawia się natychmiast po kliknięciu "Zapisz leady"
✅ Pasek postępu rośnie od 0% do 100%
✅ Tekst aktualizuje się co sekundę
✅ Po zakończeniu pokazuje "✅ Import zakończony!"
✅ Modal znika po 5 sekundach

