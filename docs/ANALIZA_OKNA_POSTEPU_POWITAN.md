# Analiza okna postępu generowania powitań

## 📋 **Kiedy się pojawia:**

1. **Przy kliknięciu "Wygeneruj powitania":**
   - Wywołuje `handleSendNotifications()`
   - Sprawdza ile leadów bez powitań spełnia filtry
   - Pojawia się modal NATYCHMIAST (przed rozpoczęciem procesu)
   - Pokazuje początkowy stan: 0%, "Rozpoczynam..."

## 📊 **Co pokazuje:**

### **Informacje wyświetlane:**
- **Postęp procentowy** (`percentage`) - pasek postępu
- **Batch: X / Y** - aktualny batch z wszystkich batchy
- **Leady: X / Y** - przetworzone leady z wszystkich leadów
- **Szacowany czas** (`estimatedTime`) - obliczany na podstawie prędkości przetwarzania

### **Stany:**
- `processing` - w trakcie przetwarzania (zielony pasek)
- `completed` - zakończone (zielony pasek)
- `error` - błąd (czerwony pasek)

## 🔄 **Jak działa odświeżanie:**

1. **Polling (co 2 sekundy):**
   - `setInterval` wywołuje `checkGreetingProgress(progressId)` co 2 sekundy
   - Pobiera dane z `/api/leads/prepare-greetings-batch?progressId=...`
   - Aktualizuje stan `greetingProgress`

2. **Źródło danych:**
   - API przechowuje postęp w `Map<string, ProgressData>` (pamięć serwera)
   - Każdy batch aktualizuje postęp przez `updateProgress()`
   - Dane są dostępne przez endpoint GET z `progressId`

3. **Czy w czasie rzeczywistym?**
   - ❌ NIE w pełnym czasie rzeczywistym
   - ✅ Polling co 2 sekundy (delay między sprawdzeniami)
   - ⚠️ Dane aktualizowane są PO zakończeniu każdego batch (25 leadów)
   - ⚠️ Jeśli batch trwa dłużej, nie widzisz postępu w trakcie batcha

## ❌ **Kiedy znika:**

1. **Automatycznie:**
   - Gdy `status === 'completed'` → znika po 3 sekundach (linia 400)
   - Timeout po 10 minutach (bezpieczeństwo) - linia 505

2. **Ręcznie:**
   - Przycisk "Zamknij" gdy status = 'completed'

3. **Przy błędzie:**
   - `setGreetingProgress(null)` przy błędzie API

## ⚠️ **Problemy:**

1. **Opóźnienie w aktualizacji:**
   - Postęp aktualizowany jest PO każdym batch (25 leadów)
   - Jeśli batch trwa długo (np. 30 sekund), nie widzisz postępu przez 30 sekund

2. **Polling co 2 sekundy:**
   - Może być zbyt często (obciążenie serwera)
   - Lub zbyt rzadko (użytkownik nie widzi szybkich zmian)

3. **Brak informacji o błędach:**
   - API zwraca `errors` w odpowiedzi, ale nie są wyświetlane w UI

4. **Nie czyści się interval:**
   - Jeśli użytkownik zamknie stronę podczas procesu, interval może pozostać aktywny

5. **Dane z pamięci serwera:**
   - Po restarcie serwera dane postępu znikają (Map w pamięci)

## 💡 **Możliwe poprawki:**

1. ✅ Dodać wyświetlanie błędów w oknie
2. ✅ Zwiększyć częstotliwość polling (np. co 1 sekundę)
3. ✅ Dodać przycisk "Anuluj" podczas procesu
4. ✅ Wyczyścić interval przy unmount komponentu
5. ✅ Dodać informację o aktualnie przetwarzanym leadzie


