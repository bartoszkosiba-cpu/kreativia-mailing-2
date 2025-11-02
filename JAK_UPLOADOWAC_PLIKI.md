# 📎 Jak dodać załącznik z dysku

## 🎯 Krok po kroku

### 1. Znajdź formularz dodawania materiału

1. Otwórz kampanię: `http://localhost:3000/campaigns/[ID]`
2. Kliknij zakładkę **"Automatyczne odpowiedzi"**
3. W sekcji "Materiały do wysyłki" kliknij **"+ Dodaj materiał"**

### 2. Wypełnij podstawowe dane

- **Nazwa materiału*** - np. "Katalog podwieszeń targowych 2025"
- **Typ*** - wybierz **"Załącznik (plik)"**

### 3. Wybierz plik z dysku

Pojawi się pole **"Wybierz plik z dysku"**:

1. Kliknij przycisk **"Choose File"** lub **"Wybierz plik"**
2. W oknie wybierz plik z dysku (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF)
3. Kliknij **"Otwórz"**

**Co zobaczysz:**
- ✓ Wybrano: `[nazwa pliku]` (X.XX MB) - zielony komunikat
- Nazwa pliku zostanie automatycznie wypełniona

### 4. Opcjonalnie: Podaj ścieżkę ręcznie

Jeśli plik jest **już na serwerze**, możesz podać ścieżkę ręcznie:
- W polu "Ścieżka pliku (opcjonalnie)" wpisz np. `uploads/materials/stary-plik.pdf`

**UWAGA:** Jeśli wybrałeś plik z dysku, system automatycznie go uploaduje i ignoruje ścieżkę ręczną.

### 5. Kliknij "Dodaj"

System:
1. **Uploaduje plik** na serwer (do `uploads/materials/`)
2. **Zapisuje materiał** w bazie danych
3. **Pokazuje** materiał na liście

**Podczas uploadu:**
- Przycisk zmieni się na "Uploadowanie..."
- Możesz zobaczyć status w polu pod plikiem

---

## ✅ Obsługiwane formaty plików

- **PDF:** `.pdf`
- **Word:** `.doc`, `.docx`
- **Excel:** `.xls`, `.xlsx`
- **Obrazy:** `.jpg`, `.jpeg`, `.png`, `.gif`

**Maksymalny rozmiar:** 50 MB

---

## 📍 Gdzie pliki są zapisywane?

Pliki są zapisywane w katalogu:
```
[projekt]/uploads/materials/
```

**Przykład:**
- Plik: `katalog-2025.pdf`
- Zostanie zapisany jako: `uploads/materials/[ID_KAMPANII]_[TIMESTAMP]_katalog-2025.pdf`
- W bazie zapisze się: `materials/[ID_KAMPANII]_[TIMESTAMP]_katalog-2025.pdf`

**Dlaczego unikalna nazwa?**
- Zapobiega konfliktom jeśli wiele kampanii ma plik o tej samej nazwie
- Zawiera timestamp dla bezpieczeństwa

---

## 🔍 Sprawdzenie czy plik został zapisany

### W interfejsie:
- Materiał powinien pojawić się na liście
- Powinien mieć badge "📎 Załącznik"

### W terminalu serwera:
Powinieneś zobaczyć:
```
[UPLOAD] Plik zapisany: /ścieżka/do/uploads/materials/filename
[UPLOAD] Ścieżka względna: materials/filename (X bytes)
```

### W bazie danych:
```bash
sqlite3 prisma/dev.db "SELECT id, name, type, filePath, fileName, fileSize FROM CampaignMaterial WHERE campaignId = [ID];"
```

### Na dysku:
```bash
ls -lh uploads/materials/
```

---

## ⚠️ Rozwiązywanie problemów

### Problem: Nie mogę wybrać pliku

**Sprawdź:**
- Czy typ jest ustawiony na "Załącznik (plik)"?
- Czy przeglądarka nie blokuje JavaScript?

### Problem: Upload się nie udaje

**Sprawdź:**
- Czy plik nie jest większy niż 50 MB?
- Czy format jest obsługiwany?
- Sprawdź konsolę przeglądarki (F12 → Console)
- Sprawdź terminal serwera - czy są błędy?

**Możliwe błędy:**
- "Plik jest zbyt duży" → Zmniejsz plik lub użyj linku zamiast załącznika
- "Błąd podczas uploadu pliku" → Sprawdź uprawnienia katalogu `uploads/materials/`

### Problem: Plik został uploadowany, ale nie wysyła się

**Sprawdź:**
- Czy plik istnieje na serwerze: `ls uploads/materials/`
- Czy ścieżka w bazie jest poprawna
- Sprawdź logi przy wysyłce - system automatycznie szuka pliku w różnych miejscach

---

## 💡 Wskazówki

1. **Dla dużych plików** - lepiej użyj LINK (Google Drive, Dropbox) niż upload
2. **Dla małych plików** (do 10 MB) - upload jest w porządku
3. **Unikalne nazwy** - system automatycznie tworzy unikalne nazwy, więc nie musisz się martwić o konflikty
4. **Backup plików** - pamiętaj o backupie katalogu `uploads/` - pliki nie są w bazie, tylko na dysku

---

## 🔄 Co się dzieje po dodaniu materiału?

1. **Plik jest zapisany** na serwerze w `uploads/materials/`
2. **Materiał jest zapisany** w bazie (`CampaignMaterial`)
3. **Gdy lead prosi o materiały:**
   - System znajduje plik na serwerze
   - Dołącza go do maila jako załącznik
   - Wysyła do leada

---

Gotowe! Teraz możesz uploadować pliki bezpośrednio z dysku! 🎯

