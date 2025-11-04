# 📖 INSTRUKCJA WŁĄCZENIA KAMPANII 3

## 🔍 OBECNY STAN:

- **Status:** PAUSED (wstrzymana)
- **Leady w kolejce:** 586 (gotowe do wysłania)
- **Leady wysłane:** 45 (już otrzymały mail)
- **Delay:** 90s ± 20% (72s - 108s między mailami)

## 🚀 JAK WŁĄCZYĆ:

### KROK 1: Otwórz kampanię
```
http://127.0.0.1:3000/campaigns/3
```

### KROK 2: Znajdź przycisk "Uruchom według harmonogramu"
- Przycisk jest **zielony**
- Widoczny gdy status = PAUSED, SCHEDULED lub DRAFT
- Znajduje się w sekcji **"Uruchomienie według harmonogramu"**

### KROK 3: Kliknij przycisk
- System sprawdzi czy jest w oknie czasowym
- Jeśli TAK → kampania uruchomi się **OD RAZU**

## ⚙️ CO SIĘ STANIE (KROK PO KROKU):

### 1️⃣ Zmiana statusu
```
PAUSED → SCHEDULED → IN_PROGRESS
```
- Występuje automatycznie po kliknięciu przycisku

### 2️⃣ Przygotowanie leadów
- Leady z statusem "sending" → "queued" (przywrócenie)
- Leady z statusem "planned" → "queued" (aktywacja)

### 3️⃣ Atomowe pobranie leada (NOWA LOGIKA ✅)
```
- Pobierz JEDEN lead (najstarszy "queued")
- Atomic lock: queued → sending
- Tylko jeden proces może to zrobić!
```

### 4️⃣ Sprawdzenia
- ✅ SendLog (czy mail już wysłany)
- ✅ Limit dzienny kampanii (500 maili/dzień)
- ✅ Limit dzienny handlowca
- ✅ Okno czasowe (czy nadal w oknie)
- ✅ Dostępność skrzynek
- ✅ Delay między mailami (min 72s)

### 5️⃣ Wysyłka (jeśli wszystko OK)
```
- SMTP wysyła mail
- SendLog.create (z UNIQUE constraint)
- Status: sending → sent
- Inkrementuj liczniki
```

### 6️⃣ Koniec wywołania
- **Tylko 1 mail na wywołanie cron**
- Następny cron (za ~1 minutę) wyśle kolejny mail

## 🔒 ZABEZPIECZENIA PRZED DUPLIKATAMI:

1. ✅ **Atomowe pobieranie leada** - tylko jeden proces może zająć
2. ✅ **SendLog check PRZED lock** - szybkie wykrycie
3. ✅ **SendLog check PO lock** - dodatkowa ochrona
4. ✅ **UNIQUE constraint** - (campaignId, leadId, variantLetter)
5. ✅ **P2002 error handling** - jeśli constraint zablokuje duplikat

## 📊 PRZYKŁADOWY PRZEBIEG:

```
Teraz: 12:50
Status: PAUSED
Leady: 586 w kolejce

→ Kliknięcie "Uruchom"

12:50:01 - Status: PAUSED → SCHEDULED → IN_PROGRESS
12:50:02 - Atomowe pobranie leada (lead 300)
12:50:03 - Sprawdzenia: OK
12:50:04 - Wysyłka maila
12:50:05 - Status: sent
12:50:05 - Koniec (tylko 1 mail)

12:51:00 - Cron uruchamia się
12:51:01 - Atomowe pobranie leada (lead 301)
12:51:02 - Delay check: minęło 57s, wymagane 72s → NIE
12:51:03 - Przywróć do queued, zakończ

12:52:00 - Cron uruchamia się
12:52:01 - Atomowe pobranie leada (lead 301)
12:52:02 - Delay check: minęło 117s, wymagane 72s → TAK ✅
12:52:03 - Wysyłka maila
12:52:04 - Status: sent
```

## ⚠️ WAŻNE:

- **Tylko 1 mail na wywołanie cron** (co 1 minutę)
- **Jeśli delay nie minął:** Lead wraca do "queued", następny cron spróbuje ponownie
- **Duplikaty:** Zabezpieczone przez 5 warstw ochrony ✅
- **Monitorowanie:** Sprawdź zakładkę "Wysyłka" aby zobaczyć postęp

## ✅ GOTOWE!

Kampania jest gotowa z nową logiką odporną na duplikaty.


