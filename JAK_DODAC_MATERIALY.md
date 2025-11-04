# 📎 Jak dodać materiały (linki i załączniki)

## Krok 1: Znajdź sekcję materiałów

1. Otwórz kampanię: `http://localhost:3000/campaigns/[ID]`
2. Kliknij zakładkę **"Automatyczne odpowiedzi"**
3. Przewiń w dół do sekcji **"Materiały do wysyłki"**

## Krok 2: Kliknij przycisk "+ Dodaj materiał"

W sekcji "Materiały do wysyłki" powinien być przycisk:
```
+ Dodaj materiał
```

**Jeśli go nie widzisz:**
- Sprawdź czy jesteś w zakładce "Automatyczne odpowiedzi"
- Odśwież stronę (Ctrl+R / Cmd+R)
- Jeśli nadal nie ma, sprawdź konsolę przeglądarki (F12) czy są błędy

## Krok 3: Wypełnij formularz

Po kliknięciu pojawi się formularz z polami:

### Podstawowe pola:
- **Nazwa materiału*** - np. "Katalog podwieszeń targowych 2025"
- **Typ*** - wybierz:
  - **"Link do pobrania"** - jeśli masz URL do pliku online
  - **"Załącznik (plik)"** - jeśli masz plik na serwerze

### Dla typu "Link do pobrania":
- **URL*** - pełny adres, np.:
  - `https://example.com/katalog.pdf`
  - `https://drive.google.com/file/d/xxx/view`
  - `https://dropbox.com/s/xxx/katalog.pdf`

### Dla typu "Załącznik (plik)":
- **Ścieżka pliku*** - gdzie plik jest na serwerze, np.:
  - `uploads/materials/cennik.pdf`
  - `public/katalogi/katalog.pdf`
- **Nazwa pliku** (opcjonalnie) - jak będzie wyświetlana, np. `cennik-2025.pdf`

### Opcjonalne:
- **Kolejność** - numer kolejności (0, 1, 2...) - określa kolejność wysyłki

## Przykłady:

### Przykład 1: Link do Google Drive
```
Nazwa: Katalog podwieszeń targowych 2025
Typ: Link do pobrania
URL: https://drive.google.com/file/d/1abc123xyz/view?usp=sharing
Kolejność: 0
```

### Przykład 2: Link do własnej strony
```
Nazwa: Cennik podwieszeń targowych
Typ: Link do pobrania  
URL: https://kreativia.eu/materiały/cennik-podwieszen.pdf
Kolejność: 1
```

### Przykład 3: Załącznik z serwera
```
Nazwa: Instrukcja montażu
Typ: Załącznik (plik)
Ścieżka pliku: uploads/materials/instrukcja-montaz.pdf
Nazwa pliku: instrukcja-montaz-2025.pdf
Kolejność: 2
```

## Krok 4: Kliknij "Dodaj"

Po wypełnieniu kliknij przycisk **"Dodaj"** na dole formularza.

## Krok 5: Sprawdź czy się dodało

Materiał powinien pojawić się na liście poniżej formularza.

**Wygląd materiału:**
- Nazwa
- Badge z typem: 🔗 Link lub 📎 Załącznik
- URL (dla linków) lub nazwa pliku (dla załączników)
- Przyciski: Edytuj, Deaktywuj, Usuń

---

## ⚠️ Rozwiązywanie problemów

### Problem: "Brak materiałów" ale nie ma przycisku

**Rozwiązanie:**
1. Sprawdź konsolę przeglądarki (F12 → Console)
2. Sprawdź czy są błędy w Network (F12 → Network → próbuj dodać)
3. Odśwież stronę

**Lub użyj tego przycisku (który powinien być widoczny):**
- W sekcji "Materiały do wysyłki" powinien być przycisk "+ Dodaj materiał" na górze sekcji

### Problem: Nie mogę zapisać materiału

**Sprawdź:**
- Czy wszystkie wymagane pola są wypełnione?
- Czy dla typu LINK podałeś URL?
- Czy dla typu ATTACHMENT podałeś ścieżkę?

### Problem: Materiał się nie zapisuje

**Sprawdź w terminalu serwera:**
- Czy są błędy przy zapisie?
- Sprawdź logi: `[MATERIALS] Błąd tworzenia materiału...`

**Sprawdź w bazie:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM CampaignMaterial WHERE campaignId = [ID];"
```

---

## 📍 Gdzie oglądać odpowiedzi?

### Opcja 1: Inbox kampanii (zalecane)
```
http://localhost:3000/campaigns/[ID]/inbox
```

Lub w kampanii kliknij zakładkę **"Inbox"** - tam zobaczysz wszystkie odpowiedzi z tej kampanii.

### Opcja 2: Globalny inbox
```
http://localhost:3000/inbox
```

Tam zobaczysz odpowiedzi ze wszystkich kampanii.

### Co zobaczysz:
- Odpowiedzi leadów (treść maila)
- Klasyfikacja AI (INTERESTED, NOT_INTERESTED, itp.)
- Podsumowanie AI
- Status (przetworzone/nieprzetworzone)

### Jeśli lead prosi o materiały:
- Zobaczysz że odpowiedź została sklasyfikowana jako INTERESTED
- Jeśli system rozpoznał prośbę o materiały → zostanie dodane do kolejki decyzji

---

## 📋 Kolejka decyzji - gdzie sprawdzić?

### Strona kolejki:
```
http://localhost:3000/material-decisions
```

Lub z dashboardu: kliknij **"Decyzje materiałów"** w Quick Actions.

### Co tam zobaczysz:
- Lista odpowiedzi które wymagają decyzji
- Treść odpowiedzi leada
- Uzasadnienie AI (dlaczego rozpoznał prośbę)
- Pewność AI (w %)
- Przyciski: **"Zatwierdź - Wyślij materiały"** lub **"Odrzuć"**

### Jak działa:
1. Lead prosi o materiały → AI rozpoznaje
2. System **automatycznie dodaje do kolejki** (nie wysyła od razu!)
3. Administrator sprawdza kolejkę
4. Administrator **zatwierdza** → materiały są wysyłane po 15 minutach
5. Administrator **odrzuca** → nie wysyła, tylko forward do handlowca

---

## ✅ Checklist

- [ ] Widzę sekcję "Materiały do wysyłki"
- [ ] Widzę przycisk "+ Dodaj materiał"
- [ ] Mogę dodać materiał typu LINK
- [ ] Mogę dodać materiał typu ATTACHMENT
- [ ] Materiał pojawia się na liście po dodaniu
- [ ] Wiem gdzie oglądać odpowiedzi (/campaigns/[ID]/inbox)
- [ ] Wiem gdzie jest kolejka decyzji (/material-decisions)

---

## 💡 Wskazówki

1. **Lepiej używać LINK niż ATTACHMENT** - linki są prostsze w obsłudze
2. **Dla Google Drive:** Udostępnij link jako "Każdy z linkiem może przeglądać"
3. **Dla Dropbox:** Wygeneruj link do pobrania
4. **Dla własnej strony:** Upewnij się że plik jest dostępny publicznie

---

**Gotowe!** Teraz masz materiały skonfigurowane i wiesz gdzie wszystko sprawdzać! 🎯


