# SPRAWDZANIE STATUSU KAMPANII 📊

## 📊 **ANALIZA KAMPANII #4:**

### **Status:** `DRAFT` (szkic) ❌

**Co to znaczy:**
- ❌ Kampania NIE BĘDZIE wysyłana automatycznie
- ✅ Można ją edytować
- 📝 To tylko szkic

### **Dlaczego nie ruszyła?**

**1. Status = DRAFT**
- Cron sprawdza tylko kampanie `SCHEDULED` lub `IN_PROGRESS`
- Twoja kampania ma status `DRAFT` → pomijana ❌

**2. scheduledAt = NULL (puste)**
- System wymaga ustawienia `scheduledAt` 
- Nawet gdybyś zmienił status na `SCHEDULED`, bez `scheduledAt` nie uruchomi ❌

**3. Dziś: Niedziela (SUN)** ✅
- `allowedDays = SUN` → OK ✅
- Godzina: 18:03 (w oknie 9-23) → OK ✅

**Jak uruchomić NATYCHMIAST:**
```sql
-- W SQLite
UPDATE Campaign 
SET status = 'SCHEDULED', 
    scheduledAt = datetime('now')  -- Teraz!
WHERE id = 4;
```

**Lub w UI:**
1. Kliknij "Edytuj harmonogram"
2. Ustaw `scheduledAt` na **teraz** (lub 5 minut temu)
3. Kliknij "Zapisz"
4. Kampania startuje przy następnym sprawdzeniu cron (max 5 min)

### ✅ **URUCHOMIONE RĘCZNIE (26.10.2025 18:03):**
```sql
-- Wykonane w SQLite
UPDATE Campaign 
SET status = 'SCHEDULED', 
    scheduledAt = datetime('now', '-10 minutes')  -- 10 minut temu
WHERE id = 4;
```

**Status teraz:** `SCHEDULED` ✅  
**scheduledAt:** `2025-10-26 16:53:32` (przeszłość) ✅  
**Co dalej:** Cron sprawdzi kampanię w ciągu **max 5 minut**

---

## ⚠️ **DIAGNOZA TERAZ (26.10.2025 18:13):**

**Status kampanii:** `SCHEDULED` ✅  
**scheduledAt:** `2025-10-26 16:53:32` (~1.5h temu) ✅  
**sendingStartedAt:** puste ❌ (kampania NIE STARTUJE!)

**Harmonogram:**
- Dni: `SUN` (niedziela) ✅ Dziś jest niedziela!
- Godziny: `9:00-23:00` ✅ Teraz 18:13, jest w oknie!
- **WSZYSTKO OK, POWINNO DZIAŁAĆ!**

**Dlaczego nie startuje?**

1. ❌ **Aplikacja nie działa** → sprawdź czy `npm run dev` działa na porcie 3000
2. ❌ **Cron nie startuje** → sprawdź logi czy jest: `[CRON] ✓ Campaign cron uruchomiony`
3. ❌ **Kampania została odrzucona** → sprawdź czy nie ma błędów w logach

**Sprawdź w konsoli (terminal gdzie działa npm run dev):**
```
[CRON] 📧 Sprawdzam zaplanowane kampanie...
[SCHEDULED SENDER] Sprawdzam zaplanowane kampanie...
```

**Jeśli NIE MA tych logów:** Aplikacja lub cron nie działa!

---

## Baza danych jest w `./prisma/dev.db` (5.5MB)

## JAK PRZYGOTOWAĆ BAZĘ?

1. **Uruchom migrację Prisma:**
```bash
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"
npx prisma migrate dev
```

2. **Wygeneruj klienta Prisma:**
```bash
npx prisma generate
```

## JAK SPRAWDZIĆ STATUS KAMPANII?

### 1. W Terminalu (SQLite)

```bash
# Pokaż wszystkie kampanie
sqlite3 dev.db "SELECT id, name, status, scheduledAt FROM Campaign ORDER BY id DESC;"

# Pokaż szczegóły konkretnej kampanii
sqlite3 dev.db "SELECT * FROM Campaign WHERE id = 1;"

# Pokaż kampanie w trakcie wysyłki
sqlite3 dev.db "SELECT id, name, status, sendingStartedAt FROM Campaign WHERE status = 'IN_PROGRESS';"

# Pokaż zaplanowane kampanie
sqlite3 dev.db "SELECT id, name, status, scheduledAt FROM Campaign WHERE status = 'SCHEDULED';"
```

### 2. W UI (Aplikacja Next.js)

1. Uruchom serwer: `npm run dev`
2. Wejdź na: `http://localhost:3000/campaigns`
3. Lista kampanii pokazuje status każdej

**Statusy w UI:**
- 🟢 `SCHEDULED` - Zaplanowana, czeka na start
- 🟡 `IN_PROGRESS` - W trakcie wysyłki
- 🟢 `COMPLETED` - Zakończona
- 🔴 `PAUSED` - Wstrzymana
- 🔴 `CANCELLED` - Anulowana

### 3. W Logach (Console/Terminal)

Gdy aplikacja działa, zobaczysz logi:

```bash
[CRON] 📧 Sprawdzam zaplanowane kampanie...
[SCHEDULED SENDER] Znaleziono kampanię: Test 50 (ID: 1)
[SCHEDULED SENDER] ✓ Rozpoczynam wysyłkę kampanii Test 50
[MAILBOX] Wybrano skrzynkę: skrzynka@firma.pl
[SCHEDULED SENDER] ✓ Wysłano 1/50
```

## JAKIE STATUSY MAJĄ KAMPANIE?

| Status | Opis | Co robić |
|--------|------|----------|
| `DRAFT` | Szkic | Nie wysyła się, można edytować |
| `SCHEDULED` | Zaplanowana | Czeka na czas wysyłki (co 5 min cron sprawdza) |
| `IN_PROGRESS` | W trakcie | Wysyła maile teraz |
| `PAUSED` | Wstrzymana | Zatrzymana ręcznie, można wznowić |
| `COMPLETED` | Zakończona | Wszystkie maile wysłane |
| `CANCELLED` | Anulowana | Nie będzie wysyłana |

## JAK DZIAŁA HARMONOGRAM?

1. **Cron job** sprawdza co **5 minut** (`*/5 * * * *`)
2. Znajduje kampanie ze statusem `SCHEDULED` 
3. Sprawdza czy teraz jest dobry moment (okno czasowe)
4. Jeśli TAK → rozpoczyna wysyłkę
5. Jeśli NIE → czeka na następne sprawdzenie (5 min)

## DIAGNOZA PROBLEMÓW

### Kampania nie wysyła się?

Sprawdź:
```sql
-- 1. Czy kampania ma status SCHEDULED?
SELECT id, name, status FROM Campaign WHERE name LIKE '%test%';

-- 2. Czy scheduledAt jest w przeszłości?
SELECT id, name, status, scheduledAt, 
       datetime('now') as now,
       scheduledAt <= datetime('now') as can_start
FROM Campaign 
WHERE status = 'SCHEDULED';
```

### Kampania zatrzymała się w połowie?

Sprawdź logi:
```bash
# W terminalu gdzie działa npm run dev
grep "SCHEDULED SENDER" your_log_file.txt
```

---

**Data utworzenia:** 2025-01-26  
**Plik:** `docs/campaign-scheduler.md` (pełna dokumentacja)

