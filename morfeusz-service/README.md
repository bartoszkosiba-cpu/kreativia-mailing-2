# Morfeusz 2 - Microserwis Odmiany Imion

Microserwis do odmiany polskich imion używając Morfeusza 2 (słownik SGJP).

## 🚀 Instalacja

```bash
# Zainstaluj zależności
pip install -r requirements.txt

# Uruchom serwis
python main.py
```

Serwis będzie dostępny na: `http://localhost:8000`

## 📚 API Endpoints

### POST /vocative
Pobiera formę wołacza dla podanego imienia.

**Request:**
```json
{
  "firstName": "Piotr",
  "language": "pl"
}
```

**Response:**
```json
{
  "vocative": "Piotrze",
  "gender": "M",
  "greeting": "Dzień dobry Panie Piotrze",
  "confidence": 0.9
}
```

### GET /health
Sprawdzenie stanu serwisu.

### GET /
Informacje o serwisie.

## 🌍 Obsługiwane języki

- **pl** - Polski (Morfeusz 2 + reguły fallback)
- **de** - Niemiecki (per nazwisko)
- **en** - Angielski (bez odmiany)
- **fr** - Francuski (bez odmiany)

## 🔧 Przykłady użycia

```bash
# Test polskiego imienia
curl -X POST "http://localhost:8000/vocative" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Anna", "language": "pl"}'

# Test niemieckiego
curl -X POST "http://localhost:8000/vocative" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Schmidt", "language": "de"}'
```

## 📝 Logika działania

1. **Morfeusz 2** - analiza morfologiczna polskich imion
2. **Fallback** - proste reguły dla obcych/rzadkich imion
3. **Generowanie powitania** - "Dzień dobry Panie/Pani [odmiana]"
4. **Confidence** - poziom pewności (0.0 - 1.0)

## 🐳 Docker (opcjonalnie)

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py .
EXPOSE 8000

CMD ["python", "main.py"]
```
