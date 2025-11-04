# 🎯 JAK ZACZĄĆ TESTOWANIE - Praktyczny przewodnik krok po kroku

## 📍 Gdzie to wszystko jest?

### 1️⃣ **Strona główna aplikacji**
```
http://localhost:3000
```
Tutaj widzisz dashboard ze statystykami i szybkimi linkami.

### 2️⃣ **Lista kampanii**
```
http://localhost:3000/campaigns
```
Tutaj widzisz wszystkie kampanie. Kliknij na jedną, żeby ją otworzyć.

### 3️⃣ **Szczegóły kampanii** (TU JEST NOWA FUNKCJONALNOŚĆ!)
```
http://localhost:3000/campaigns/[ID]
```
Np. `http://localhost:3000/campaigns/1`

**W tej stronie znajdziesz zakładkę "Automatyczne odpowiedzi"** - to tam jest cała nowa funkcjonalność!

### 4️⃣ **Kolejka decyzji administratora**
```
http://localhost:3000/material-decisions
```
Tutaj administrator podejmuje decyzje o wysłaniu materiałów (gdy AI nie jest pewne).

---

## 🚀 KROK PO KROKU - Jak przetestować

### KROK 1: Uruchom aplikację

```bash
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"
npm run dev
```

Poczekaj aż zobaczysz:
```
✓ Ready on http://localhost:3000
```

### KROK 2: Znajdź lub utwórz kampanię

**Opcja A: Jeśli masz już kampanię**
1. Otwórz: http://localhost:3000/campaigns
2. Znajdź dowolną kampanię i kliknij na nią

**Opcja B: Utwórz nową kampanię**
1. Otwórz: http://localhost:3000/campaigns/new
2. Wypełnij podstawowe dane (nazwa, treść)
3. Zapisz kampanię

### KROK 3: ZNAJDŹ NOWĄ FUNKCJONALNOŚĆ ⭐

Gdy jesteś w szczegółach kampanii (np. `http://localhost:3000/campaigns/1`):

1. **Zobaczysz zakładki na górze strony:**
   - Raport
   - Handlowiec
   - Leady
   - Harmonogram
   - Treść kampanii
   - Follow-upy
   - Wysyłka
   - **👉 Automatyczne odpowiedzi** ← TO JEST NOWA ZAKŁADKA!
   - Inbox

2. **Kliknij na "Automatyczne odpowiedzi"**

3. **Zobaczysz dwie sekcje:**

   **A) Ustawienia automatycznych odpowiedzi**
   - Checkbox "Włącz automatyczne odpowiedzi z materiałami"
   - Pole "Kontekst kampanii dla AI"
   - Pole "Zasady dla AI" (opcjonalnie)
   - Pole "Opóźnienie wysyłki (minuty)"
   - Przycisk "Zapisz ustawienia"

   **B) Materiały do wysyłki**
   - Lista materiałów (początkowo pusta)
   - Przycisk "+ Dodaj materiał"

---

## 🧪 CO TESTOWAĆ - Plan testów

### TEST 1: Konfiguracja podstawowa (5 minut)

**Co robić:**
1. ✅ Kliknij checkbox "Włącz automatyczne odpowiedzi"
2. ✅ Wypełnij "Kontekst kampanii":
   ```
   Oferujemy meble biurowe. W treści maila pytamy: "Czy mogę przesłać katalog i cennik?"
   ```
3. ✅ Zostaw opóźnienie na 15 minut (domyślne)
4. ✅ Kliknij "Zapisz ustawienia"
5. ✅ Sprawdź czy pojawiło się "✓ Zapisano"

**Co sprawdzić:**
- ✅ Czy checkbox się zaznacza?
- ✅ Czy można zapisać?
- ✅ Czy po odświeżeniu strony ustawienia się zachowują?

---

### TEST 2: Dodawanie materiałów - LINK (3 minuty)

**Co robić:**
1. ✅ Kliknij "+ Dodaj materiał"
2. ✅ Wypełnij formularz:
   - **Nazwa:** `Katalog mebli biurowych 2025`
   - **Typ:** Wybierz `Link do pobrania`
   - **URL:** `https://example.com/katalog.pdf`
   - **Kolejność:** `0`
3. ✅ Kliknij "Dodaj"

**Co sprawdzić:**
- ✅ Czy materiał pojawił się na liście?
- ✅ Czy widzisz typ "🔗 Link"?
- ✅ Czy widzisz URL jako klikalny link?

---

### TEST 3: Dodawanie materiałów - ZAŁĄCZNIK (3 minuty)

**Co robić:**
1. ✅ Kliknij "+ Dodaj materiał" ponownie
2. ✅ Wypełnij formularz:
   - **Nazwa:** `Cennik mebli biurowych`
   - **Typ:** Wybierz `Załącznik (plik)`
   - **Ścieżka pliku:** `uploads/materials/cennik.pdf`
   - **Nazwa pliku:** `cennik.pdf`
   - **Kolejność:** `1`
3. ✅ Kliknij "Dodaj"

**Co sprawdzić:**
- ✅ Czy materiał pojawił się na liście?
- ✅ Czy widzisz typ "📎 Załącznik"?
- ✅ Czy widzisz nazwę pliku?

---

### TEST 4: Edycja i usuwanie materiałów (3 minuty)

**Co robić:**
1. ✅ Kliknij "Edytuj" przy dowolnym materiale
2. ✅ Zmień nazwę
3. ✅ Kliknij "Zapisz zmiany"
4. ✅ Kliknij "Usuń" przy innym materiale
5. ✅ Potwierdź usunięcie

**Co sprawdzić:**
- ✅ Czy edycja działa?
- ✅ Czy usuwanie działa?
- ✅ Czy lista się aktualizuje?

---

### TEST 5: Deaktywacja materiału (1 minuta)

**Co robić:**
1. ✅ Kliknij "Deaktywuj" przy materiale
2. ✅ Sprawdź czy zmienił się wygląd (szary, nieaktywny)
3. ✅ Kliknij "Aktywuj" ponownie

**Co sprawdzić:**
- ✅ Czy deaktywacja działa?
- ✅ Czy materiał wygląda inaczej?

---

### TEST 6: Kolejka decyzji administratora (sprawdzenie UI)

**Co robić:**
1. ✅ Otwórz: http://localhost:3000/material-decisions
2. ✅ Sprawdź czy strona się ładuje

**Co sprawdzić:**
- ✅ Czy strona się otwiera?
- ✅ Jeśli nie ma decyzji, czy widzisz komunikat "Brak oczekujących decyzji"?
- ✅ Czy wygląd jest czytelny?

**UWAGA:** Na razie nie będzie żadnych decyzji, bo system jeszcze nie przetworzył odpowiedzi INTERESTED. To normalne!

---

## 🔍 GDZIE SPRAWDZIĆ CZY DZIAŁA - Logi i baza danych

### Sprawdź w Terminalu (gdzie działa `npm run dev`)

**Szukaj tych logów:**
- `[EMAIL AGENT AI] Sprawdzam czy to prośba o materiały...`
- `[MATERIAL SENDER] Planuję wysyłkę materiałów...`
- `[CRON] ✓ Wysłano X odpowiedzi z materiałami`

### Sprawdź w bazie danych

Otwórz nowy terminal (nie zamykaj `npm run dev`):

```bash
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"
```

**1. Sprawdź czy kampania ma włączony auto-reply:**
```bash
sqlite3 prisma/dev.db "SELECT id, name, autoReplyEnabled FROM Campaign WHERE id = 1;"
```
Powinno pokazać: `autoReplyEnabled = 1`

**2. Sprawdź czy kampania ma materiały:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM CampaignMaterial WHERE campaignId = 1;"
```
Powinno pokazać materiały które dodałeś.

**3. Sprawdź czy są jakieś zaplanowane wysyłki:**
```bash
sqlite3 prisma/dev.db "SELECT id, leadId, status, scheduledAt FROM MaterialResponse;"
```

**4. Sprawdź kolejkę decyzji:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM PendingMaterialDecision WHERE status = 'PENDING';"
```

---

## ⚠️ CO MOŻE NIE DZIAŁAĆ (i jak to sprawdzić)

### Problem 1: Nie widzę zakładki "Automatyczne odpowiedzi"

**Sprawdź:**
- Czy jesteś w szczegółach kampanii? (nie na liście)
- Czy kampania istnieje?
- Odśwież stronę (Ctrl+R / Cmd+R)

**Sprawdź w konsoli przeglądarki (F12):**
- Czy są błędy JavaScript?

### Problem 2: Nie mogę zapisać ustawień

**Sprawdź:**
- Czy serwer działa? (czy widzisz logi w terminalu?)
- Otwórz konsolę przeglądarki (F12) → Network → sprawdź czy request się wysyła
- Czy pojawia się błąd?

**Sprawdź w terminalu serwera:**
- Czy są błędy przy zapisie?

### Problem 3: Materiały się nie zapisują

**Sprawdź:**
- Czy wszystkie wymagane pola są wypełnione?
- Czy dla typu LINK podałeś URL?
- Czy dla typu ATTACHMENT podałeś ścieżkę pliku?

**Sprawdź w bazie:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM CampaignMaterial WHERE campaignId = 1;"
```

### Problem 4: Strona `/material-decisions` nie istnieje

**Sprawdź:**
- Czy serwer działa?
- Sprawdź czy plik istnieje: `app/material-decisions/page.tsx`
- Sprawdź logi w terminalu

---

## 🎯 CO DALEJ - Test pełnego flow

Gdy już masz skonfigurowaną kampanię z materiałami, możesz przetestować pełny flow:

1. **Lead otrzymuje maila** z kampanii
2. **Lead odpowiada** z prośbą o materiały (np. "Tak, proszę przesłać katalog")
3. **System automatycznie:**
   - Analizuje odpowiedź przez AI
   - Jeśli pewność ≥80% → planuje automatyczną wysyłkę
   - Jeśli pewność 60-79% → dodaje do kolejki administratora
4. **Administrator sprawdza kolejkę** → `/material-decisions`
5. **Cron automatycznie wysyła** materiały po 15 minutach

**Jak to przetestować?**
- Utworzę osobny dokument jak symulować odpowiedź leada
- Albo możesz poczekać na prawdziwą odpowiedź z kampanii

---

## 📝 Checklist - Co już przetestowałeś?

Oznacz co już sprawdziłeś:

**Konfiguracja:**
- [ ] Widzę zakładkę "Automatyczne odpowiedzi"
- [ ] Mogę włączyć auto-reply
- [ ] Mogę zapisać ustawienia
- [ ] Ustawienia się zachowują po odświeżeniu

**Materiały:**
- [ ] Mogę dodać materiał typu LINK
- [ ] Mogę dodać materiał typu ATTACHMENT
- [ ] Mogę edytować materiał
- [ ] Mogę usunąć materiał
- [ ] Mogę deaktywować/aktywować materiał

**Kolejka:**
- [ ] Strona `/material-decisions` się otwiera
- [ ] Widzę interfejs (nawet jeśli pusty)

**Baza danych:**
- [ ] Kampania ma `autoReplyEnabled = 1`
- [ ] Materiały są zapisane w bazie

---

## 🆘 Gdzie szukać pomocy?

**1. Logi serwera** - terminal gdzie działa `npm run dev`
**2. Konsola przeglądarki** - F12 → Console i Network
**3. Baza danych** - SQLite przez terminal
**4. Dokumentacja** - `TEST_AUTOMATYCZNE_ODPOWIEDZI.md`

---

## 🚀 Gotowy? Zaczynamy!

1. ✅ Uruchom: `npm run dev`
2. ✅ Otwórz: http://localhost:3000/campaigns
3. ✅ Kliknij na kampanię
4. ✅ Kliknij zakładkę "Automatyczne odpowiedzi"
5. ✅ Zacznij testować!

**Masz pytania?** Sprawdź logi, konsolę przeglądarki lub bazę danych!


