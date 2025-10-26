# HARMONOGRAM WYSYŁKI KAMPANII 📅

## PRZEGLĄD

System automatycznie wysyła kampanie email zgodnie z ustalonym harmonogramem, uwzględniając:
- **Okna czasowe** (np. 9:00-15:00)
- **Dni tygodnia** (Pn-Pt)
- **Limity wysyłki** (maili/h, maili/dzień)
- **Rotację skrzynek** (round-robin)
- **Opóźnienia** między mailami (90s)

### CO URUCHAMIA KAMPANIĘ?

System ma **2 sposoby** uruchomienia kampanii:

#### 1️⃣ **PRZYCISK "Uruchom kampanię"** (dla testów)
- ✅ Max **20 leadów** (zabezpieczenie)
- ✅ Wysyła **NATYCHMIASTOWO** (bez harmonogramu)
- ✅ Dla małych kampanii testowych
- ❌ Nie stosuje harmonogramu (wysyła wszystkie maile od razu)

#### 2️⃣ **HARMONOGRAM** (dla produkcji)
- ✅ Nieograniczona liczba leadów
- ✅ Stosuje harmonogram (okno czasowe, opóźnienia)
- ✅ Może startować **NATYCHMIAST** jeśli `scheduledAt <= teraz`
- ✅ Lub w **PRZYSZŁOŚCI** jeśli `scheduledAt > teraz`

**Uwaga:** Jeśli `scheduledAt` jest puste → status `DRAFT` (nie wysyła)  
**Uwaga:** Jeśli `scheduledAt` jest w przeszłości → status `SCHEDULED` i **STARTUJE NATYCHMIAST** jeśli jest w oknie czasowym!

---

**Cron job sprawdza co 5 minut** czy są kampanie do wysłania:

```typescript
// src/services/emailCron.ts
campaignCronJob = cron.schedule('*/5 * * * *', async () => {
  console.log('[CRON] 📧 Sprawdzam zaplanowane kampanie...');
  await processScheduledCampaign();
});
```

**Cron syntax:** `*/5 * * * *` = co 5 minut

**Kiedy cron się uruchamia:**
- Przy starcie aplikacji (Next.js API)
- Plik: `src/services/startCron.ts` → importowany w `app/api/cron/status/route.ts`

---

## ZASADY DZIAŁANIA

### 1. USTAWIENIA HARMONOGRAMU

Każda kampania ma własny harmonogram definiowany przez pola:

```typescript
// Harmonogram wysyłki
delayBetweenEmails  Int       @default(90)    // Opóźnienie w sekundach (90s = 1.5min)
maxEmailsPerHour    Int       @default(40)    // Max maili na godzinę

// Ustawienia okien czasowych
allowedDays         String    @default("MON,TUE,WED,THU,FRI")  // Dni tygodnia
startHour           Int       @default(9)     // Początek okna (9:00)
endHour             Int       @default(15)    // Koniec okna (15:00)
respectHolidays     Boolean   @default(true)  // Uwzględniaj święta
targetCountries     String?                  // Kraje do sprawdzania świąt (np. "PL,DE,FR")
```

### 2. CYKL WYSYŁKI

System przetwarza kampanie w pętli:

```
1. Sprawdź czy teraz jest dobry moment (okno czasowe + dzień tygodnia)
2. Dla każdego leada:
   a. Sprawdź czy mail już wysłany (zapobieganie duplikatom)
   b. Sprawdź limit dzienny handlowca
   c. Sprawdź czy nadal w oknie czasowym
   d. Pobierz dostępną skrzynkę (round-robin)
   e. Wyślij mail
   f. Czekaj 90s (delayBetweenEmails)
3. Jeśli koniec okna czasowego → pauza, wznowienie jutro
4. Jeśli limit dzienny → pauza, wznowienie jutro
```

### 3. WYBÓR SKRZYNKI (ROUND-ROBIN)

System wybiera skrzynkę na podstawie trzech kryteriów **w tej kolejności**:

1. **Priorytet** (`priority`) - niższa liczba = wyższy priorytet
2. **Data ostatniego użycia** (`lastUsedAt`) - najdawniej użyta = pierwsza
3. **Dostępność** (`dailyEmailLimit - currentDailySent`) - musi mieć wolne miejsce

```typescript
orderBy: [
  { priority: "asc" },      // Najpierw po priorytecie
  { lastUsedAt: "asc" }     // Potem po dacie ostatniego użycia
]

// Wybierz pierwszą skrzynkę która ma wolne miejsce
for (const mailbox of mailboxes) {
  const remaining = mailbox.dailyEmailLimit - mailbox.currentDailySent;
  if (remaining > 0) {
    return mailbox; // ✅ Wybrano
  }
}
```

**Ważne:** Jeśli główna skrzynka handlowca istnieje, jest brana jako pierwsza.

---

## PRZYKŁADY DZIAŁANIA

### PRZYKŁAD #1: 50 leadów, 1 skrzynka

**Ustawienia:**
- Okno czasowe: 9:00-15:00 (6 godzin)
- Opóźnienie: 90s między mailami
- Skrzynka: 1 aktywna (limit: 50/dzień)

**Obliczenia:**
- Czas wysyłki: 50 × 90s = 4500s = **75 minut**
- Start: 9:00
- Koniec: **~10:15** ✅

**Co się stanie:**
```
09:00 → Email #1  (skrzynka A)
09:01 → Email #2  (skrzynka A)
09:03 → Email #3  (skrzynka A)
...
10:15 → Email #50 (skrzynka A) ✅ KOŃCZY
```

**Rezultat:** ✅ Wszystkie maile wysłane w tym samym dniu, w oknie czasowym.

---

### PRZYKŁAD #2: 150 leadów, 3 skrzynki

**Ustawienia:**
- Okno czasowe: 9:00-15:00 (6 godzin)
- Opóźnienie: 90s między mailami
- Skrzynki: 
  - Skrzynka A: limit 20, wysłano 5 (pozostało: 15)
  - Skrzynka B: limit 30, wysłano 10 (pozostało: 20)
  - Skrzynka C: limit 15, wysłano 0 (pozostało: 15)

**Obliczenia:**
- Czas wysyłki: 150 × 90s = 13500s = **225 minut = 3.75h** ⚠️
- Start: 9:00
- Koniec: **12:45** ✅

**Co się stanie:**
```
09:00 - 09:30 → Wysyłka przez Skrzynkę A (15 maili) ✅ wyczerpana
09:30 - 10:15 → Wysyłka przez Skrzynkę B (30 maili) ✅ wyczerpana  
10:15 - 10:45 → Wysyłka przez Skrzynkę C (15 maili) ✅ wyczerpana
10:45 - 12:45 → Rotacja: Skrzynka A, B, C naprzemiennie (90 maili) ✅ KOŃCZY
```

**Rezultat:** ✅ Wszystkie maile wysłane w tym samym dniu, system rotuje skrzynkami gdy pierwsze się wyczerpią.

---

### PRZYKŁAD #3: 500 leadów, 2 skrzynki (limit 50/dzień każda)

**Ustawienia:**
- Okno czasowe: 9:00-15:00 (6 godzin)
- Opóźnienie: 90s między mailami
- Skrzynki: 
  - Skrzynka A: limit 50/dzień
  - Skrzynka B: limit 50/dzień

**Obliczenia:**
- Totalne limity: 50 + 50 = **100 maili/dzień**
- Potrzeba: 500 maili
- Dni potrzebne: **5 dni** (500 ÷ 100)

**Co się stanie:**
```
DZIEŃ 1 (9:00-15:00):
09:00 - 11:15 → 100 maili (Skrzynka A: 50, Skrzynka B: 50) ✅ wyczerpane
Status: SCHEDULED (pozostało 400 maili)

DZIEŃ 2 (9:00-15:00):
09:00 - 11:15 → 100 maili (Skrzynka A: 50, Skrzynka B: 50) ✅ wyczerpane
Status: SCHEDULED (pozostało 300 maili)

... (DZIEŃ 3, 4, 5 podobnie)

DZIEŃ 5:
09:00 - 11:15 → 100 maili (Skrzynka A: 50, Skrzynka B: 50) ✅
Status: COMPLETED
```

**Rezultat:** ⏰ Kampania podzielona na **5 dni roboczych**, system automatycznie wznowi następnego dnia.

---

## OGRANICZENIA I PAUZY

System może **wstrzymać wysyłkę** i oznaczyć kampanię jako `SCHEDULED` (wznawia się automatycznie następnego dnia):

### 1. Koniec Okna Czasowego

```typescript
// Jeśli jest 15:00 (koniec okna) a pozostały maile
if (currentHour >= endHour) {
  console.log(`Koniec okna czasowego. Pauza wysyłki.`);
  await db.campaign.update({
    where: { id: campaign.id },
    data: { status: "SCHEDULED" }
  });
  break; // Zatrzymaj wysyłkę
}
```

**Co się stanie:**
- Kampania: `IN_PROGRESS` → `SCHEDULED`
- Wysyłka wznowi się automatycznie jutro o 9:00
- Leady które zostały → dostaną maile jutro

---

### 2. Limit Dzienny Skrzynek

```typescript
// Sprawdź czy skrzynki mają wolne miejsce
const mailbox = await getNextAvailableMailbox(salespersonId);
if (!mailbox) {
  console.log(`Wszystkie skrzynki wyczerpane. Pauza do jutra.`);
  // Oznacz jako SCHEDULED
}
```

**Co się stanie:**
- Jeśli WSZYSTKIE skrzynki osiągną limit (`currentDailySent >= dailyEmailLimit`)
- Kampania: `IN_PROGRESS` → `SCHEDULED`
- Wysyłka wznowi się jutro (liczniki resetują się o północy)

---

### 3. Weekend / Święto

```typescript
// Sprawdź czy dziś to dzień roboczy
const allowedDays = ["MON", "TUE", "WED", "THU", "FRI"];
if (!allowedDays.includes(currentDay)) {
  return { isValid: false, reason: "Niedozwolony dzień" };
}
```

**Co się stanie:**
- W sobotę/niedzielę: kampania nie wysyła
- System automatycznie wznowi w poniedziałek o 9:00

---

### 4. Brak Aktywnych Skrzynek

```typescript
// Jeśli wszystkie skrzynki są nieaktywne
const mailboxes = await db.mailbox.findMany({
  where: { virtualSalespersonId, isActive: true }
});

if (mailboxes.length === 0) {
  console.log(`❌ Brak aktywnych skrzynek - przerywam wysyłkę`);
  // Zwróć błąd
}
```

**Co się stanie:**
- ❌ Błąd: "Brak aktywnych skrzynek mailowych"
- Kampania **zatrzymana** - wymaga ręcznej interwencji

---

## FORMULY OBLICZEŃ

### Czas Wysyłki

```
totalSeconds = liczba_leadów × opóźnienie_w_sekundach
totalHours = totalSeconds ÷ 3600
businessDays = ceil(totalHours ÷ godzin_w_oknie)
```

**Przykład:**
```
200 leadów × 90s = 18000s = 5h
5h ÷ 6h (9:00-15:00) = 1 dzień ✅
```

### Potrzebne Dni

```
dzienny_limit = sum(limit_skrzynka_1, limit_skrzynka_2, ...)
potrzebne_dni = ceil(liczba_leadów ÷ dzienny_limit)
```

**Przykład:**
```
2 skrzynki × 50/dzień = 100 maili/dzień
500 leadów ÷ 100 = 5 dni ⏰
```

---

## STAN KAMPANII

Kampanie mogą być w następujących stanach:

- **DRAFT** - Szkic, nie wysyłana
- **SCHEDULED** - Zaplanowana, czeka na start
- **IN_PROGRESS** - W trakcie wysyłki
- **PAUSED** - Wstrzymana (ręczna pauza)
- **COMPLETED** - Zakończona (wszystkie maile wysłane)
- **CANCELLED** - Anulowana

**Automatyczne przejścia:**
```
SCHEDULED → IN_PROGRESS (start wysyłki)
IN_PROGRESS → SCHEDULED (koniec okna czasowego / limit)
IN_PROGRESS → COMPLETED (wszystkie maile wysłane)
```

---

## ROTACJA SKRZYNEK - SZCZEGÓŁY

### Przykład Rotacji (3 skrzynki)

Masz 3 aktywne skrzynki:
- **Skrzynka A**: limit 50, wysłano 10, priorytet 1
- **Skrzynka B**: limit 50, wysłano 20, priorytet 2  
- **Skrzynka C**: limit 50, wysłano 45, priorytet 3

**Kolejność wyboru:**
1. **Skrzynka A** (priorytet 1, pozostało 40)
2. **Skrzynka B** (priorytet 2, pozostało 30)
3. **Skrzynka C** (priorytet 3, pozostało 5) ← prawie wyczerpana

**Co się stanie przy 100 mailach:**
```
Mail 1-40:   Skrzynka A ✅ (wyczerpana - 50/50)
Mail 41-70:  Skrzynka B ✅ (wyczerpana - 50/50)
Mail 71-75:  Skrzynka C ✅ (wyczerpana - 50/50)
Mail 76-100: BŁĄD ❌ (wszystkie skrzynki wyczerpane, pauza)
```

---

## PORADY I NAJLEPSZE PRAKTYKI

### ✅ SKUTECZNE WYSYŁANIE

1. **Wiele skrzynek = szybsza wysyłka**
   - 1 skrzynka 50/dzień → 50 maili/dzień
   - 3 skrzynki 50/dzień → 150 maili/dzień ✅

2. **Priorytetyzacja skrzynek**
   - Skrzynka główna (mainMailbox) = priorytet 1
   - Skrzynki backup = priorytet 2, 3, 4...

3. **Okno czasowe realistyczne**
   - 9:00-15:00 = 6h = 240 maili/max (40/h × 6h)
   - Jeśli masz 500 leadów → będzie trwało 2+ dni

### ❌ CZEGO UNIKAĆ

1. **Za wysokie limity na skrzynkę**
   - 200 maili/dzień na 1 skrzynkę = ryzyko blokady przez providera
   - Lepiej: 50-100/dzień na skrzynkę ✅

2. **Za niskie opóźnienia**
   - 30s między mailami = 120 maili/h → może być wykryte jako spam
   - Rekomendacja: 90s (40 maili/h) ✅

3. **Brak monitoringu**
   - Sprawdzaj logi wysyłki w `/campaigns/[id]/outbox`
   - Obserwuj metryki deliverability (bouncerate, opens)

---

## MONITORING I LOGI

### Sprawdź Status Kampanii w Bazie

```bash
# SQLite (terminal)
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"
sqlite3 dev.db "SELECT id, name, status, scheduledAt, delayBetweenEmails, startHour, endHour FROM Campaign ORDER BY id DESC;"
```

**Kolory statusów:**
- `DRAFT` - Szkic (nie wysyłana)
- `SCHEDULED` - Zaplanowana (czeka na start)
- `IN_PROGRESS` - W trakcie wysyłki
- `COMPLETED` - Zakończona
- `PAUSED` - Wstrzymana (ręczna pauza)
- `CANCELLED` - Anulowana

### Sprawdź Postęp Kampanii w UI

```bash
# W UI: /campaigns/[id]/outbox
```

**Co widzisz:**
- Ile maili wysłano vs planowane
- Status wysyłki (IN_PROGRESS, SCHEDULED)
- Które skrzynki są używane
- Błędy (jeśli występują)

### Logi Console

```javascript
[CRON] 📧 Sprawdzam zaplanowane kampanie...
[SCHEDULED SENDER] Sprawdzam zaplanowane kampanie...
[SCHEDULED SENDER] Znaleziono kampanię: Test 50 (ID: 1)
[MAILBOX] Wybrano skrzynkę: skrzynka@firma.pl (pozostało: 45/50)
[SCHEDULED SENDER] ✓ Wysłano 1/50 do jan@firma.pl
[SCHEDULED SENDER] Czekam 90s przed następnym mailem...
...
[SCHEDULED SENDER] 🎉 Kampania zakończona: 50 sukces, 0 błędów
```

---

## FAQ

### P: Czy mogę zmienić harmonogram w trakcie wysyłki?

**Odpowiedź:** TAK, ale wymaga ręcznej interwencji:
1. Oznacz kampanię jako `PAUSED` 
2. Zmień ustawienia (okno czasowe, opóźnienie, etc.)
3. Oznacz jako `SCHEDULED` - wznowi się z nowymi ustawieniami

### P: Co jeśli skrzynka się wyczerpie w połowie dnia?

**Odpowiedź:** System automatycznie przejdzie do kolejnej skrzynki (round-robin). Jeśli WSZYSTKIE skrzynki się wyczerpią → pauza do jutra.

### P: Czy system wysyła w weekend?

**Odpowiedź:** NIE (domyślnie). Domyślne ustawienie: `allowedDays = "MON,TUE,WED,THU,FRI"`. Możesz zmienić w ustawieniach kampanii.

### P: Jak przyspieszyć wysyłkę?

**Odpowiedź:**
1. ✅ Dodaj więcej skrzynek (rotacja)
2. ✅ Zwiększ dzienny limit per skrzynka
3. ✅ Skróć opóźnienie (90s → 60s, ryzyko!)
4. ✅ Wydłuż okno czasowe (15:00 → 17:00)

### P: Co jeśli uruchomię kampanię PO godzinie jej okna czasowego?

**Odpowiedź:** ❌ **NIE ZACZNIE WYSYŁAĆ**.

Przykład:
- Godzina: **17:00**
- Kampania okno: **9:00-13:00**
- Co się stanie: System sprawdzi `isValidSendTime()` przed startem

```typescript
const validation = await isValidSendTime(now, ...);
// 17:00 < 9:00 || 17:00 >= 13:00 → true (poza oknem)

if (!validation.isValid) {
  console.log('Teraz nie jest dobry moment: poza oknem czasowym');
  return; // NIE WYSYŁA, po prostu kończy
}
```

**Wynik:** 
- Kampania pozostanie `SCHEDULED` 
- **Automatycznie wznowi się jutro o 9:00** (jeśli jutro to dzień roboczy)
- W międzyczasie nic się nie stanie - po prostu czeka na właściwy moment

**Alternatywa:** Jeśli chcesz uruchomić natychmiast → zmień okno czasowe na `9:00-18:00` (obejmie 17:00).

---

## KOD ŹRÓDŁOWY

Główne pliki implementacji:

- `src/services/scheduledSender.ts` - pętla wysyłki
- `src/services/mailboxManager.ts` - rotacja skrzynek
- `src/services/campaignScheduler.ts` - walidacja okien czasowych
- `app/api/campaigns/[id]/send/route.ts` - endpoint wysyłki

---

**Ostatnia aktualizacja:** 2025-01-26  
**Wersja:** 1.0

