# 📋 JAK ZOBACZYĆ LOGI SERWERA

## 🖥️ GDZIE SĄ LOGI?

Logi są wyświetlane w **terminalu/konsoli** gdzie uruchomiony jest serwer Next.js.

### 1️⃣ **Terminal gdzie uruchomiono `npm run dev`**

Jeśli uruchomiłeś serwer komendą:
```bash
npm run dev
```

To **w tym samym terminalu** zobaczysz wszystkie logi:
```
[CRON] 📧 Sprawdzam kolejkę kampanii...
[CAMPAIGN SENDER] 🔍 Opóźnione maile: 37, wysyłam max 5 maili
[CAMPAIGN SENDER] ✅ Mail wysłany!
```

### 2️⃣ **Jak znaleźć terminal?**

**W Cursor/VS Code:**
- Otwórz panel terminala (Terminal → New Terminal)
- Albo naciśnij `` Ctrl+` `` (backtick)
- Zobaczysz terminal gdzie działa `npm run dev`

**W systemowym terminalu:**
- Jeśli uruchomiłeś `npm run dev` w osobnym oknie terminala
- Przełącz się do tego okna
- Albo uruchom nowy terminal i sprawdź procesy:
  ```bash
  ps aux | grep "next dev"
  ```

### 3️⃣ **Co szukać w logach?**

**Kluczowe logi do sprawdzenia:**

1. **Cron działa:**
   ```
   [CRON] 📧 Sprawdzam kolejkę kampanii... (start: ...)
   ```

2. **Catch-up działa:**
   ```
   [CAMPAIGN SENDER] 🔍 Opóźnione maile: 37, wysyłam max 5 maili
   ```

3. **Maile są wysyłane:**
   ```
   [CAMPAIGN SENDER] ⚠️ Mail opóźniony... - wysyłam catch-up
   [CAMPAIGN SENDER] ✅ Mail wysłany!
   [CRON] ✅ Wysłano 5 mail(i) z kolejki
   ```

4. **Błędy:**
   ```
   [CAMPAIGN SENDER] ❌ Błąd...
   [CRON] ✗ Błąd wysyłki kampanii...
   ```

## 🔍 SPRAWDZENIE CZY CRON DZIAŁA

### Opcja 1: Sprawdź logi
W terminalu szukaj:
```
[CRON] ✓ Campaign cron uruchomiony
```

### Opcja 2: Sprawdź przez API
```bash
curl http://localhost:3000/api/cron/status
```

### Opcja 3: Sprawdź w kodzie
Endpoint `/api/cron/status` powinien pokazać czy cron działa.

## 📝 ZAPISYWANIE LOGÓW DO PLIKU

Jeśli chcesz zapisać logi do pliku:

```bash
# Uruchom serwer i zapisz logi do pliku
npm run dev 2>&1 | tee server.log

# Albo tylko do pliku (bez wyświetlania)
npm run dev > server.log 2>&1
```

Potem możesz sprawdzić:
```bash
tail -f server.log        # Podgląd na żywo
grep "CAMPAIGN SENDER" server.log   # Szukaj konkretnych logów
```

## 🎯 SZYBKA WERYFIKACJA

**Sprawdź czy serwer działa:**
```bash
curl http://localhost:3000/api/campaigns/4/sending-info
```

**Sprawdź logi w czasie rzeczywistym:**
- Otwórz terminal gdzie działa `npm run dev`
- Poczekaj 1-2 minuty
- Zobaczysz logi cron co minutę

## ⚠️ TYPOWE PROBLEMY

### Problem: "Nie widzę logów"
**Rozwiązanie:**
- Sprawdź czy serwer działa: `curl http://localhost:3000`
- Sprawdź czy jest w terminalu: `ps aux | grep "next dev"`
- Uruchom ponownie: `npm run dev`

### Problem: "Cron nie działa"
**Rozwiązanie:**
- Sprawdź czy `startEmailCron()` jest wywołane
- Sprawdź endpoint `/api/cron/status`
- Sprawdź logi przy starcie serwera: `[CRON] ✓ Campaign cron uruchomiony`

### Problem: "Maile nie są wysyłane"
**Rozwiązanie:**
- Sprawdź logi: `[CAMPAIGN SENDER]`
- Sprawdź czy są opóźnione maile: `[CAMPAIGN SENDER] 🔍 Opóźnione maile: X`
- Sprawdź czy są błędy: `[CAMPAIGN SENDER] ❌`





