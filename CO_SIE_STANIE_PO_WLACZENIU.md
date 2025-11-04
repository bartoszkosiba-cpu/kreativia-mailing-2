# 📋 CO SIĘ STANIE PO WŁĄCZENIU KAMPANII 3

## 📊 OBECNY STAN:

- **Status:** PAUSED (wstrzymana)
- **Leady w kolejce:** 586 (status: "queued")
- **Leady wysłane:** ~50 (status: "sent")
- **Leady w trakcie:** 0 (status: "sending" - zostaną przywrócone do "queued")

## 🔄 JAK WŁĄCZYĆ KAMPANIĘ:

1. **Otwórz:** `http://127.0.0.1:3000/campaigns/3`
2. **Znajdź przycisk:** "Uruchom według harmonogramu" (zielony)
3. **Kliknij:** Przycisk
4. **System sprawdzi:**
   - ✅ Czy jest w oknie czasowym (dzień, godzina, święta)
   - ✅ Czy są leady do wysłania
   - ✅ Czy są dostępne skrzynki

## ⚙️ CO SIĘ STANIE PO WŁĄCZENIU:

### KROK 1: Zmiana statusu
- Status: `PAUSED` → `SCHEDULED` → `IN_PROGRESS`

### KROK 2: Przygotowanie leadów
- **Dla kampanii PAUSED:** Leady z statusem "sending" zostaną przywrócone do "queued"
- **Dla nowych leadów:** Status "planned" → "queued"

### KROK 3: Atomowe pobranie leada (NOWA LOGIKA ✅)
- System pobierze **JEDEN** lead atomowo z bazy (najstarszy "queued")
- Atomic lock: `queued` → `sending` (tylko jeden proces może to zrobić)

### KROK 4: Sprawdzenia przed wysyłką
- ✅ SendLog check (czy mail już wysłany) - **PRZED** atomic lock
- ✅ Limit dzienny kampanii (maxEmailsPerDay)
- ✅ Limit dzienny handlowca
- ✅ Okno czasowe (czy nadal w oknie)
- ✅ Dostępność skrzynek
- ✅ Delay między mailami (90s ± 20%)

### KROK 5: Wysyłka (jeśli wszystkie warunki OK)
- Wyślij mail przez SMTP
- Zapisz do SendLog (z UNIQUE constraint - zapobiega duplikatom)
- Zmień status: `sending` → `sent`
- Inkrementuj liczniki (handlowiec, skrzynka)

### KROK 6: Zakończenie wywołania
- **Tylko 1 mail na wywołanie cron** ✅
- Następne wywołanie cron (za ~1 minutę) wyśle kolejny mail (jeśli delay minął)

## 🔒 ZABEZPIECZENIA PRZED DUPLIKATAMI:

1. **Atomowe pobieranie leada** - tylko jeden proces może zająć leada
2. **SendLog check przed lock** - szybkie wykrycie duplikatów
3. **SendLog check po lock** - dodatkowa ochrona
4. **UNIQUE constraint w bazie** - ostatnia linia obrony (campaignId, leadId, variantLetter)
5. **Obsługa P2002 error** - jeśli constraint zablokuje duplikat, loguje i kontynuuje

## 📈 PRZYKŁADOWY PRZEBIEG:

```
12:00:00 - Kliknięcie "Uruchom"
12:00:01 - Status: PAUSED → SCHEDULED → IN_PROGRESS
12:00:02 - Atomowe pobranie leada (lead 300, status: queued → sending)
12:00:03 - Sprawdzenia (OK)
12:00:04 - Wysyłka maila (90s ± 20%)
12:00:05 - Status: sending → sent
12:00:05 - Koniec (tylko 1 mail)

12:01:00 - Cron uruchamia się ponownie
12:01:01 - Atomowe pobranie leada (lead 301, status: queued → sending)
12:01:02 - Sprawdzenie delay: minęło 56s, wymagane minimum: 72s → NIE
12:01:03 - Przywróć lead do queued, zakończ

12:02:00 - Cron uruchamia się ponownie
12:02:01 - Atomowe pobranie leada (lead 301, status: queued → sending)
12:02:02 - Sprawdzenie delay: minęło 118s, wymagane minimum: 72s → TAK
12:02:03 - Wysyłka maila
12:02:04 - Status: sending → sent
```

## ⚠️ WAŻNE:

- **Tylko 1 mail na wywołanie cron** (co 1 minutę)
- **Delay:** 90s ± 20% (72s - 108s)
- **Jeśli delay nie minął:** Lead zostanie przywrócony do "queued", następny cron spróbuje ponownie
- **Duplikaty:** Zabezpieczone przez atomic lock + unique constraint

## ✅ GOTOWE DO URUCHOMIENIA!

Kampania jest gotowa z nową logiką odporną na duplikaty.


