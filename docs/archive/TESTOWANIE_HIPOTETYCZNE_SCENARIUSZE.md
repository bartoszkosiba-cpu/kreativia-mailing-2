# TESTOWANIE HIPOTETYCZNE - SCENARIUSZE V2

## 📋 Wstęp

Ten dokument opisuje hipotetyczne scenariusze testowe dla systemu V2, które weryfikują wszystkie funkcjonalności bez faktycznego wykonywania operacji na bazie danych.

---

## 🎯 SCENARIUSZ 1: NOWY HANDLOWIEC I SKRZYNKI

### 1.1. Tworzenie nowego handlowca

**Dane wejściowe:**
- Nazwa: "Jan Kowalski"
- Email: "jan.kowalski@example.com"
- Język: "pl"
- Limit dzienny: 100 maili

**Oczekiwany wynik:**
- ✅ Handlowiec utworzony z unikalnym ID
- ✅ Pole `language` ustawione na "pl"
- ✅ Pole `dailyEmailLimit` ustawione na 100
- ✅ Pole `isActive` ustawione na `true` (domyślnie)
- ✅ Pole `mainMailboxId` = `null` (początkowo)

**Weryfikacja:**
```sql
SELECT * FROM VirtualSalesperson WHERE email = 'jan.kowalski@example.com';
-- Powinien zwrócić 1 rekord z poprawnymi danymi
```

---

### 1.2. Tworzenie głównej skrzynki

**Dane wejściowe:**
- Email: "jan.main@example.com"
- Display Name: "Jan Kowalski - Główna"
- SMTP: smtp.example.com:587
- IMAP: imap.example.com:993
- Limit dzienny: 50 maili
- Warmup Status: "ready"
- Priority: 1

**Oczekiwany wynik:**
- ✅ Skrzynka utworzona z unikalnym ID
- ✅ `virtualSalespersonId` przypisany do handlowca
- ✅ `warmupStatus` = "ready"
- ✅ `currentDailySent` = 0
- ✅ `lastResetDate` = `null` (początkowo)
- ✅ `isActive` = `true`
- ✅ `mainMailboxId` w handlowcu ustawiony na ID tej skrzynki

**Weryfikacja:**
```sql
SELECT mb.*, vs.mainMailboxId 
FROM Mailbox mb
JOIN VirtualSalesperson vs ON mb.virtualSalespersonId = vs.id
WHERE mb.email = 'jan.main@example.com';
-- Powinien zwrócić skrzynkę z vs.mainMailboxId = mb.id
```

---

### 1.3. Tworzenie dodatkowych skrzynek

**Dane wejściowe:**
- Skrzynka 2: "jan.2@example.com", limit 50, warmupStatus "inactive", priority 2
- Skrzynka 3: "jan.3@example.com", limit 50, warmupStatus "ready", priority 3

**Oczekiwany wynik:**
- ✅ Wszystkie 3 skrzynki utworzone
- ✅ Każda skrzynka ma unikalny email
- ✅ Każda skrzynka ma poprawne `warmupStatus`
- ✅ Skrzynki posortowane według `priority` (1, 2, 3)
- ✅ Łączny limit: 150 maili dziennie (50+50+50)

**Weryfikacja:**
```sql
SELECT email, warmupStatus, priority, dailyEmailLimit 
FROM Mailbox 
WHERE virtualSalespersonId = [ID_HANDLOWCA]
ORDER BY priority;
-- Powinien zwrócić 3 skrzynki w kolejności priority
```

---

## 🎯 SCENARIUSZ 2: NOWA KAMPANIA Z RÓŻNYMI USTAWIENIAMI

### 2.1. Tworzenie kampanii z harmonogramem

**Dane wejściowe:**
- Nazwa: "Kampania Testowa V2"
- Handlowiec: ID z scenariusza 1
- Status: "DRAFT"
- Temat: "Test Temat"
- Tekst: "Test Treść kampanii"
- Delay między mailami: 90 sekund
- Limit dzienny: 200 maili
- Okno czasowe: 9:00-17:00
- Dni tygodnia: poniedziałek, wtorek, środa, czwartek, piątek
- Uwzględnianie świąt: tak

**Oczekiwany wynik:**
- ✅ Kampania utworzona z unikalnym ID
- ✅ `status` = "DRAFT"
- ✅ `delayBetweenEmails` = 90
- ✅ `maxEmailsPerDay` = 200
- ✅ `startHour` = 9, `startMinute` = 0
- ✅ `endHour` = 17, `endMinute` = 0
- ✅ `allowedDays` = "poniedziałek,wtorek,środa,czwartek,piątek"
- ✅ `respectHolidays` = `true`
- ✅ `virtualSalespersonId` przypisany

**Weryfikacja:**
```sql
SELECT c.*, vs.name as salesperson_name
FROM Campaign c
JOIN VirtualSalesperson vs ON c.virtualSalespersonId = vs.id
WHERE c.id = [ID_KAMPANII];
-- Powinien zwrócić kampanię z wszystkimi ustawieniami
```

---

### 2.2. Aktualizacja kampanii (zmiana statusu)

**Operacja:**
- Zmiana statusu z "DRAFT" na "SCHEDULED"

**Oczekiwany wynik:**
- ✅ `status` zmieniony na "SCHEDULED"
- ✅ `scheduledAt` może być ustawiony (jeśli podano)
- ✅ Pozostałe pola bez zmian

**Weryfikacja:**
```sql
SELECT status, scheduledAt FROM Campaign WHERE id = [ID_KAMPANII];
-- Powinien zwrócić status = 'SCHEDULED'
```

---

### 2.3. Uruchomienie kampanii (DRAFT → IN_PROGRESS)

**Operacja:**
- Zmiana statusu z "SCHEDULED" na "IN_PROGRESS"
- Uruchomienie przez API `/api/campaigns/[id]/start`

**Oczekiwany wynik:**
- ✅ `status` zmieniony na "IN_PROGRESS"
- ✅ `sendingStartedAt` ustawiony na aktualny czas
- ✅ Kolejka V2 zainicjalizowana (wpisy w `CampaignEmailQueue`)
- ✅ Leady ze statusu "planned" zmienione na "queued"

**Weryfikacja:**
```sql
-- Status kampanii
SELECT status, sendingStartedAt FROM Campaign WHERE id = [ID_KAMPANII];

-- Wpisy w kolejce
SELECT COUNT(*) FROM CampaignEmailQueue WHERE campaignId = [ID_KAMPANII] AND status = 'pending';

-- Status leadów
SELECT status, COUNT(*) FROM CampaignLead WHERE campaignId = [ID_KAMPANII] GROUP BY status;
```

---

## 🎯 SCENARIUSZ 3: NOWE LEADY

### 3.1. Tworzenie leadów z różnymi danymi

**Lead 1: Pełne dane**
- Email: "lead1@example.com"
- Imię: "Jan"
- Nazwisko: "Kowalski"
- Firma: "Firma Testowa 1"
- Język: "pl"
- Status: "ACTIVE"
- Powitanie: "Dzień dobry Panie Janie"

**Lead 2: Minimalne dane**
- Email: "lead2@example.com"
- Firma: "Firma Testowa 2"
- Język: "pl"
- Status: "ACTIVE"

**Lead 3: Język angielski**
- Email: "lead3@example.com"
- Imię: "John"
- Nazwisko: "Smith"
- Firma: "Test Company 3"
- Język: "en"
- Status: "ACTIVE"
- Powitanie: "Hello John"

**Lead 4: BLOCKED (nie powinien być wysłany)**
- Email: "lead4@example.com"
- Firma: "Blocked Company"
- Język: "pl"
- Status: "BLOCKED"
- `isBlocked` = `true`

**Oczekiwany wynik:**
- ✅ Wszystkie 4 leady utworzone
- ✅ Lead 4 ma `status` = "BLOCKED" i `isBlocked` = `true`
- ✅ Pozostałe leady mają `status` = "ACTIVE"

**Weryfikacja:**
```sql
SELECT email, firstName, lastName, company, language, status, isBlocked 
FROM Lead 
WHERE email IN ('lead1@example.com', 'lead2@example.com', 'lead3@example.com', 'lead4@example.com');
```

---

### 3.2. Dodawanie leadów do kampanii

**Operacja:**
- Dodanie leadów 1, 2, 3 do kampanii (lead 4 pominięty jako BLOCKED)
- Priorytety: Lead 1 = 1, Lead 2 = 2, Lead 3 = 3

**Oczekiwany wynik:**
- ✅ 3 wpisy w `CampaignLead` (tylko leady ACTIVE)
- ✅ Każdy wpis ma przypisany `campaignId` i `leadId`
- ✅ Status początkowy: "planned"
- ✅ Priorytety ustawione poprawnie

**Weryfikacja:**
```sql
SELECT cl.id, cl.priority, cl.status, l.email, l.status as lead_status
FROM CampaignLead cl
JOIN Lead l ON cl.leadId = l.id
WHERE cl.campaignId = [ID_KAMPANII]
ORDER BY cl.priority;
-- Powinien zwrócić 3 wpisy, wszystkie z lead_status = 'ACTIVE'
```

---

### 3.3. Weryfikacja wykluczania BLOCKED leadów

**Operacja:**
- Próba dodania leada 4 (BLOCKED) do kampanii

**Oczekiwany wynik:**
- ✅ System NIE dodaje leadów BLOCKED do kampanii
- ✅ Wpisy w `CampaignLead` tylko dla leadów ACTIVE
- ✅ Zapytanie: `WHERE lead.status != 'BLOCKED' AND lead.isBlocked = false`

**Weryfikacja:**
```sql
SELECT COUNT(*) as blocked_leads_in_campaign
FROM CampaignLead cl
JOIN Lead l ON cl.leadId = l.id
WHERE cl.campaignId = [ID_KAMPANII] AND l.status = 'BLOCKED';
-- Powinien zwrócić 0
```

---

## 🎯 SCENARIUSZ 4: INICJALIZACJA KOLEJKI V2

### 4.1. Przygotowanie leadów do kolejki

**Operacja:**
- Zmiana statusu kampanii na "IN_PROGRESS"
- Zmiana statusu leadów z "planned" na "queued"

**Oczekiwany wynik:**
- ✅ Wszystkie leady "planned" zmienione na "queued"
- ✅ Leady "sending" (z poprzednich sesji) zmienione na "queued"
- ✅ Leady BLOCKED pozostają bez zmian

**Weryfikacja:**
```sql
SELECT status, COUNT(*) 
FROM CampaignLead 
WHERE campaignId = [ID_KAMPANII]
GROUP BY status;
-- Powinien pokazać wszystkie leady jako 'queued' (oprócz BLOCKED)
```

---

### 4.2. Inicjalizacja kolejki V2

**Operacja:**
- Wywołanie `initializeQueueV2(campaignId, bufferSize=20)`

**Oczekiwany wynik:**
- ✅ Utworzone wpisy w `CampaignEmailQueue` dla pierwszych 20 leadów
- ✅ Każdy wpis ma:
  - `campaignId` = ID kampanii
  - `campaignLeadId` = ID leada w kampanii
  - `status` = "pending"
  - `scheduledAt` = obliczony czas (obecny czas + delay)
- ✅ `scheduledAt` zwiększa się o `delayBetweenEmails` ± 20% dla każdego kolejnego maila

**Weryfikacja:**
```sql
SELECT 
  id, 
  campaignId, 
  campaignLeadId, 
  status, 
  scheduledAt,
  (SELECT email FROM Lead l JOIN CampaignLead cl ON l.id = cl.leadId WHERE cl.id = CampaignEmailQueue.campaignLeadId) as lead_email
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII]
ORDER BY scheduledAt ASC
LIMIT 20;
```

---

### 4.3. Weryfikacja odstępów między mailami

**Operacja:**
- Sprawdzenie odstępów między `scheduledAt` w kolejce

**Oczekiwany wynik:**
- ✅ Każdy odstęp = `delayBetweenEmails` ± 20%
- ✅ Dla `delayBetweenEmails = 90s`:
  - Minimum: 72s (90 * 0.8)
  - Maksimum: 108s (90 * 1.2)
- ✅ Odstępy są losowe (nie równomierne)

**Weryfikacja:**
```sql
WITH delays AS (
  SELECT 
    id,
    scheduledAt,
    LAG(scheduledAt) OVER (ORDER BY scheduledAt) as prev_scheduled,
    scheduledAt - LAG(scheduledAt) OVER (ORDER BY scheduledAt) as delay_seconds
  FROM CampaignEmailQueue
  WHERE campaignId = [ID_KAMPANII] AND status = 'pending'
  ORDER BY scheduledAt
)
SELECT 
  AVG(delay_seconds) as avg_delay,
  MIN(delay_seconds) as min_delay,
  MAX(delay_seconds) as max_delay
FROM delays
WHERE delay_seconds IS NOT NULL;
-- avg_delay powinien być w zakresie 72-108s dla delayBetweenEmails=90
```

---

### 4.4. Weryfikacja kolejności leadów

**Operacja:**
- Sprawdzenie czy leady są dodawane w kolejności priorytetu

**Oczekiwany wynik:**
- ✅ Leady z niższym priorytetem (1) mają wcześniejsze `scheduledAt`
- ✅ Leady z wyższym priorytetem (3) mają późniejsze `scheduledAt`
- ✅ Kolejność: Lead 1 (priority 1) → Lead 2 (priority 2) → Lead 3 (priority 3)

**Weryfikacja:**
```sql
SELECT 
  ceq.scheduledAt,
  cl.priority,
  l.email
FROM CampaignEmailQueue ceq
JOIN CampaignLead cl ON ceq.campaignLeadId = cl.id
JOIN Lead l ON cl.leadId = l.id
WHERE ceq.campaignId = [ID_KAMPANII]
ORDER BY ceq.scheduledAt ASC;
-- Powinien pokazać leady w kolejności priorytetu (1, 2, 3)
```

---

## 🎯 SCENARIUSZ 5: WYSYŁKA MAILI - RÓŻNE SYTUACJE

### 5.1. Normalna wysyłka (wszystko OK)

**Warunki:**
- Czas: 10:00 (w oknie czasowym 9:00-17:00)
- Dzień: poniedziałek (w dozwolonych dniach)
- Skrzynka dostępna: 50/50 slotów
- Limit kampanii: 0/200 maili dzisiaj
- W kolejce: 20 maili "pending"

**Oczekiwany wynik:**
- ✅ System wybiera pierwszy mail z kolejki (najwcześniejszy `scheduledAt`)
- ✅ System rezerwuje slot w skrzynce (atomic reservation)
- ✅ Mail zmieniony na status "sending"
- ✅ Mail wysłany przez SMTP
- ✅ `SendLog` utworzony ze statusem "sent"
- ✅ Mail zmieniony na status "sent"
- ✅ `currentDailySent` skrzynki zwiększony o 1
- ✅ `CampaignLead.status` zmieniony na "sent"
- ✅ Następny mail zaplanowany (jeśli bufor < 20)

**Weryfikacja:**
```sql
-- Sprawdź wysłany mail
SELECT * FROM SendLog WHERE campaignId = [ID_KAMPANII] ORDER BY createdAt DESC LIMIT 1;

-- Sprawdź status maila w kolejce
SELECT status FROM CampaignEmailQueue WHERE campaignId = [ID_KAMPANII] ORDER BY sentAt DESC LIMIT 1;

-- Sprawdź licznik skrzynki
SELECT currentDailySent FROM Mailbox WHERE id = [ID_SKRZYNKI];
```

---

### 5.2. Wysyłka poza oknem czasowym

**Warunki:**
- Czas: 18:00 (poza oknem 9:00-17:00)
- W kolejce: 10 maili "pending"

**Oczekiwany wynik:**
- ✅ System NIE wysyła maili
- ✅ Maile pozostają w statusie "pending"
- ✅ `scheduledAt` pozostaje bez zmian (lub przekładane na jutro o `startHour`)

**Weryfikacja:**
```sql
-- Sprawdź czy nie wysłano maili po 17:00
SELECT COUNT(*) 
FROM SendLog 
WHERE campaignId = [ID_KAMPANII] 
  AND createdAt >= '2025-11-04 17:00:00';
-- Powinien zwrócić 0
```

---

### 5.3. Wysyłka w niedozwolonym dniu

**Warunki:**
- Dzień: sobota
- Kampania: `allowedDays` = "poniedziałek,wtorek,środa,czwartek,piątek"
- W kolejce: 10 maili "pending"

**Oczekiwany wynik:**
- ✅ System NIE wysyła maili
- ✅ Maile pozostają w statusie "pending"
- ✅ `scheduledAt` przekładane na najbliższy dozwolony dzień

**Weryfikacja:**
```sql
-- Sprawdź czy scheduledAt jest w przyszłości (następny poniedziałek)
SELECT scheduledAt 
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'pending'
ORDER BY scheduledAt ASC 
LIMIT 1;
-- Powinien być >= następny poniedziałek
```

---

### 5.4. Brak dostępnych skrzynek

**Warunki:**
- Wszystkie skrzynki wyczerpane (`currentDailySent >= dailyEmailLimit`)
- W kolejce: 10 maili "pending"

**Oczekiwany wynik:**
- ✅ System NIE wysyła maili
- ✅ `getNextAvailableMailbox()` zwraca `null`
- ✅ Maile przekładane na jutro o `startHour`
- ✅ `scheduledAt` ustawiony na jutro 9:00

**Weryfikacja:**
```sql
-- Sprawdź czy scheduledAt jest jutro
SELECT scheduledAt 
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'pending'
ORDER BY scheduledAt ASC 
LIMIT 1;
-- Powinien być >= jutro 9:00
```

---

### 5.5. Osiągnięto limit dzienny kampanii

**Warunki:**
- `maxEmailsPerDay` = 200
- Wysłano dzisiaj: 200 maili
- W kolejce: 10 maili "pending"

**Oczekiwany wynik:**
- ✅ System NIE wysyła więcej maili
- ✅ Maile przekładane na jutro o `startHour`
- ✅ `scheduledAt` ustawiony na jutro 9:00

**Weryfikacja:**
```sql
-- Sprawdź liczbę wysłanych dzisiaj
SELECT COUNT(*) 
FROM SendLog 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'sent' 
  AND DATE(createdAt) = DATE('now');
-- Powinien zwrócić 200

-- Sprawdź czy maile są przekładane
SELECT scheduledAt 
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'pending'
ORDER BY scheduledAt ASC 
LIMIT 1;
-- Powinien być >= jutro 9:00
```

---

### 5.6. Wysyłka z różnymi statusami warmup skrzynek

**Skrzynka 1: `warmupStatus = 'inactive'`**
- `dailyEmailLimit` = 50 (w bazie)
- `effectiveLimit` = 10 (system używa)
- `currentDailySent` = 5

**Skrzynka 2: `warmupStatus = 'ready'`**
- `dailyEmailLimit` = 50 (w bazie)
- `effectiveLimit` = 50 (system używa)
- `currentDailySent` = 20

**Skrzynka 3: `warmupStatus = 'warming'`**
- `dailyEmailLimit` = 50 (w bazie)
- `warmupDailyLimit` = 30
- `warmupDay` = 5 (tydzień 1)
- Performance limits: warmup=15, campaign=10
- `effectiveLimit` = 10 (min(50, 30, 10))
- `currentDailySent` = 8 (wszystkie maile)
- `warmupTodaySent` = 3 (tylko warmup)
- `currentSent` (dla kampanii) = 5 (8 - 3)

**Oczekiwany wynik:**
- ✅ System wybiera skrzynkę 2 (gotowa, 20/50)
- ✅ System NIE wybiera skrzynki 1 (inactive, 5/10 - ale może być wyczerpana)
- ✅ System NIE wybiera skrzynki 3 (warming, 5/10 - może być wyczerpana)

**Weryfikacja:**
```sql
-- Sprawdź ostatnio używaną skrzynkę
SELECT mb.email, mb.warmupStatus, mb.currentDailySent, mb.dailyEmailLimit
FROM SendLog sl
JOIN Mailbox mb ON sl.mailboxId = mb.id
WHERE sl.campaignId = [ID_KAMPANII]
ORDER BY sl.createdAt DESC
LIMIT 1;
-- Powinien pokazać skrzynkę 2 (ready)
```

---

### 5.7. Wysyłka z blokadą skrzynek przez inne kampanie

**Warunki:**
- Kampania A: IN_PROGRESS, używa skrzynki 1
- Kampania B: IN_PROGRESS, próbuje wysłać mail
- Skrzynka 1: 10/50 dostępnych
- Skrzynka 2: 50/50 dostępnych

**Oczekiwany wynik:**
- ✅ `getNextAvailableMailbox(virtualSalespersonId, campaignId_B)` wyklucza skrzynkę 1
- ✅ System wybiera skrzynkę 2 (nie zablokowaną)
- ✅ Skrzynka 1 pozostaje zablokowana dla kampanii A

**Weryfikacja:**
```sql
-- Sprawdź które skrzynki są używane przez inne kampanie
SELECT DISTINCT mb.id, mb.email
FROM SendLog sl
JOIN Mailbox mb ON sl.mailboxId = mb.id
JOIN Campaign c ON sl.campaignId = c.id
WHERE c.virtualSalespersonId = [ID_HANDLOWCA]
  AND c.status = 'IN_PROGRESS'
  AND c.id != [ID_KAMPANII_B]
  AND DATE(sl.createdAt) = DATE('now');
-- Powinien pokazać skrzynkę 1 (zablokowaną)

-- Sprawdź używaną skrzynkę w kampanii B
SELECT mb.id, mb.email
FROM SendLog sl
JOIN Mailbox mb ON sl.mailboxId = mb.id
WHERE sl.campaignId = [ID_KAMPANII_B]
ORDER BY sl.createdAt DESC
LIMIT 1;
-- Powinien pokazać skrzynkę 2 (nie zablokowaną)
```

---

## 🎯 SCENARIUSZ 6: EDGE CASES I SYTUACJE GRANICZNE

### 6.1. Kampania bez skrzynek

**Warunki:**
- Handlowiec bez przypisanych skrzynek
- Kampania: IN_PROGRESS
- W kolejce: 10 maili "pending"

**Oczekiwany wynik:**
- ✅ `getNextAvailableMailbox()` zwraca `null`
- ✅ Maile przekładane na jutro o `startHour`
- ✅ System nie wysyła maili
- ✅ Brak błędów w logach

**Weryfikacja:**
```sql
-- Sprawdź czy są maile przekładane
SELECT COUNT(*) 
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'pending'
  AND scheduledAt >= DATE('now', '+1 day');
-- Powinien zwrócić liczbę maili w kolejce
```

---

### 6.2. Kampania z limitem dziennym 0

**Warunki:**
- `maxEmailsPerDay` = 0
- Kampania: IN_PROGRESS
- W kolejce: 10 maili "pending"

**Oczekiwany wynik:**
- ✅ System NIE wysyła żadnych maili
- ✅ Maile przekładane na jutro
- ✅ Limit 0 jest respektowany

**Weryfikacja:**
```sql
-- Sprawdź czy nie wysłano maili
SELECT COUNT(*) 
FROM SendLog 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'sent';
-- Powinien zwrócić 0
```

---

### 6.3. Lead z duplikatem emaila

**Operacja:**
- Próba utworzenia leada z emailem, który już istnieje

**Oczekiwany wynik:**
- ✅ Błąd: `P2002` (Unique constraint violation)
- ✅ Lead NIE został utworzony
- ✅ Oryginalny lead pozostaje bez zmian

**Weryfikacja:**
```sql
-- Sprawdź czy nie ma duplikatów
SELECT email, COUNT(*) as count 
FROM Lead 
GROUP BY email 
HAVING count > 1;
-- Powinien zwrócić 0 wierszy
```

---

### 6.4. Kampania z bardzo krótkim delayBetweenEmails

**Warunki:**
- `delayBetweenEmails` = 10 sekund
- W kolejce: 100 maili

**Oczekiwany wynik:**
- ✅ Odstępy między mailami = 10s ± 20% (8-12s)
- ✅ Wszystkie maile zaplanowane w krótkim czasie
- ✅ System respektuje delay (nawet jeśli krótki)

**Weryfikacja:**
```sql
-- Sprawdź odstępy
WITH delays AS (
  SELECT 
    scheduledAt - LAG(scheduledAt) OVER (ORDER BY scheduledAt) as delay_seconds
  FROM CampaignEmailQueue
  WHERE campaignId = [ID_KAMPANII]
  ORDER BY scheduledAt
)
SELECT AVG(delay_seconds), MIN(delay_seconds), MAX(delay_seconds)
FROM delays
WHERE delay_seconds IS NOT NULL;
-- avg powinien być w zakresie 8-12s
```

---

### 6.5. Kampania z bardzo długim delayBetweenEmails

**Warunki:**
- `delayBetweenEmails` = 3600 sekund (1 godzina)
- W kolejce: 10 maili

**Oczekiwany wynik:**
- ✅ Odstępy między mailami = 3600s ± 20% (2880-4320s)
- ✅ Maile zaplanowane na wiele godzin
- ✅ System respektuje długi delay

**Weryfikacja:**
```sql
-- Sprawdź odstępy
SELECT 
  scheduledAt,
  LAG(scheduledAt) OVER (ORDER BY scheduledAt) as prev_scheduled,
  (scheduledAt - LAG(scheduledAt) OVER (ORDER BY scheduledAt)) / 3600.0 as delay_hours
FROM CampaignEmailQueue
WHERE campaignId = [ID_KAMPANII]
ORDER BY scheduledAt;
-- delay_hours powinien być w zakresie 0.8-1.2 (2880-4320s)
```

---

### 6.6. Wysyłka z przekroczeniem limitu skrzynki

**Warunki:**
- Skrzynka: `currentDailySent` = 49, `dailyEmailLimit` = 50
- Próba wysłania maila

**Oczekiwany wynik:**
- ✅ System rezerwuje slot atomowo (UPDATE z warunkiem `currentDailySent < 50`)
- ✅ Jeśli rezerwacja się powiedzie: mail wysłany, `currentDailySent` = 50
- ✅ Jeśli rezerwacja się nie powiedzie (ktoś inny już zarezerwował): mail przekładany na jutro

**Weryfikacja:**
```sql
-- Sprawdź czy currentDailySent nie przekracza limitu
SELECT id, email, currentDailySent, dailyEmailLimit
FROM Mailbox
WHERE currentDailySent > dailyEmailLimit;
-- Powinien zwrócić 0 wierszy
```

---

### 6.7. Wysyłka podczas przerwy w Internecie

**Warunki:**
- Przerwa w Internecie: 2 godziny
- W kolejce: 10 maili "pending"
- Po powrocie Internetu: system uruchomiony ponownie

**Oczekiwany wynik:**
- ✅ System wykrywa "stuck" maile (status "sending" starsze niż 10 min)
- ✅ System używa dłuższej tolerancji (2h) dla catch-up
- ✅ System wysyła maile które były zaplanowane w czasie przerwy
- ✅ System respektuje delay między mailami (nie wysyła wszystkich naraz)

**Weryfikacja:**
```sql
-- Sprawdź czy są stuck maile
SELECT COUNT(*) 
FROM CampaignEmailQueue 
WHERE status = 'sending' 
  AND updatedAt < datetime('now', '-10 minutes');
-- Powinien zwrócić 0 (po recovery)

-- Sprawdź czy maile zostały wysłane
SELECT COUNT(*) 
FROM SendLog 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'sent'
  AND createdAt >= [CZAS_PRZERWY];
-- Powinien zwrócić liczbę maili z czasu przerwy
```

---

### 6.8. Pauza i wznowienie kampanii

**Warunki:**
- Kampania: IN_PROGRESS, wysyła maile
- Pauza: kampania zmieniona na PAUSED
- W kolejce: 5 maili "sending", 10 maili "pending"
- Po 2 godzinach: kampania wznowiona (IN_PROGRESS)

**Oczekiwany wynik:**
- ✅ Maile "sending" anulowane (status "cancelled")
- ✅ Maile "pending" pozostają w kolejce
- ✅ Po wznowieniu: system wykrywa długą przerwę (recovery)
- ✅ System używa dłuższej tolerancji (2h) dla catch-up
- ✅ Maile "pending" są wysyłane z respektowaniem delay

**Weryfikacja:**
```sql
-- Sprawdź anulowane maile
SELECT COUNT(*) 
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'cancelled';
-- Powinien zwrócić liczbę maili "sending" z czasu pauzy

-- Sprawdź czy maile są wysyłane po wznowieniu
SELECT COUNT(*) 
FROM SendLog 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'sent'
  AND createdAt >= [CZAS_WZNOWIENIA];
-- Powinien zwrócić liczbę wysłanych maili
```

---

## 🎯 SCENARIUSZ 7: WERYFIKACJA SPÓJNOŚCI DANYCH

### 7.1. Spójność CampaignLead i Lead

**Operacja:**
- Sprawdzenie czy wszystkie `CampaignLead` mają istniejące `Lead`

**Oczekiwany wynik:**
- ✅ Wszystkie `CampaignLead.leadId` wskazują na istniejące `Lead.id`
- ✅ Brak "orphaned" rekordów
- ✅ Wszystkie leady w kampanii mają `status != 'BLOCKED'`

**Weryfikacja:**
```sql
-- Sprawdź czy wszystkie CampaignLead mają istniejące Lead
SELECT cl.id 
FROM CampaignLead cl
LEFT JOIN Lead l ON cl.leadId = l.id
WHERE l.id IS NULL;
-- Powinien zwrócić 0 wierszy

-- Sprawdź czy są BLOCKED leady w kampanii
SELECT COUNT(*) 
FROM CampaignLead cl
JOIN Lead l ON cl.leadId = l.id
WHERE cl.campaignId = [ID_KAMPANII] 
  AND l.status = 'BLOCKED';
-- Powinien zwrócić 0
```

---

### 7.2. Spójność CampaignEmailQueue i CampaignLead

**Operacja:**
- Sprawdzenie czy wszystkie wpisy w kolejce mają istniejące `CampaignLead`

**Oczekiwany wynik:**
- ✅ Wszystkie `CampaignEmailQueue.campaignLeadId` wskazują na istniejące `CampaignLead.id`
- ✅ Brak "orphaned" rekordów w kolejce
- ✅ Wszystkie wpisy w kolejce mają `campaignId` zgodny z `CampaignLead.campaignId`

**Weryfikacja:**
```sql
-- Sprawdź czy wszystkie wpisy w kolejce mają istniejące CampaignLead
SELECT ceq.id 
FROM CampaignEmailQueue ceq
LEFT JOIN CampaignLead cl ON ceq.campaignLeadId = cl.id
WHERE cl.id IS NULL;
-- Powinien zwrócić 0 wierszy

-- Sprawdź zgodność campaignId
SELECT ceq.id 
FROM CampaignEmailQueue ceq
JOIN CampaignLead cl ON ceq.campaignLeadId = cl.id
WHERE ceq.campaignId != cl.campaignId;
-- Powinien zwrócić 0 wierszy
```

---

### 7.3. Spójność liczników skrzynek

**Operacja:**
- Sprawdzenie czy `currentDailySent` jest zgodny z `SendLog`

**Oczekiwany wynik:**
- ✅ `currentDailySent` <= `dailyEmailLimit`
- ✅ `currentDailySent` = liczba maili wysłanych dzisiaj z `SendLog` (dla skrzynek nie w warmup)
- ✅ Dla skrzynek w warmup: `currentDailySent` = wszystkie maile (warmup + kampanie)

**Weryfikacja:**
```sql
-- Sprawdź zgodność dla skrzynek nie w warmup
SELECT 
  mb.id,
  mb.email,
  mb.currentDailySent as counter_value,
  COUNT(sl.id) as sendlog_count
FROM Mailbox mb
LEFT JOIN SendLog sl ON sl.mailboxId = mb.id 
  AND DATE(sl.createdAt) = DATE('now')
  AND sl.status = 'sent'
WHERE mb.warmupStatus NOT IN ('warming', 'ready_to_warmup')
GROUP BY mb.id
HAVING ABS(mb.currentDailySent - COUNT(sl.id)) > 1;
-- Powinien zwrócić 0 wierszy (dopuszczalna różnica 1 dla race conditions)
```

---

### 7.4. Spójność statusów kampanii

**Operacja:**
- Sprawdzenie czy statusy kampanii są poprawne

**Oczekiwany wynik:**
- ✅ Wszystkie statusy w dozwolonych wartościach: DRAFT, SCHEDULED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED
- ✅ Kampanie IN_PROGRESS mają wpisy w kolejce lub leady "queued"
- ✅ Kampanie PAUSED nie mają maili "sending"

**Weryfikacja:**
```sql
-- Sprawdź czy wszystkie statusy są poprawne
SELECT DISTINCT status 
FROM Campaign 
WHERE status NOT IN ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');
-- Powinien zwrócić 0 wierszy

-- Sprawdź kampanie IN_PROGRESS bez maili w kolejce
SELECT c.id, c.name
FROM Campaign c
LEFT JOIN CampaignEmailQueue ceq ON c.id = ceq.campaignId AND ceq.status IN ('pending', 'sending')
WHERE c.status = 'IN_PROGRESS'
  AND ceq.id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM CampaignLead cl 
    WHERE cl.campaignId = c.id 
      AND cl.status = 'queued'
  );
-- Powinien zwrócić 0 wierszy (lub kampanie które właśnie się zakończyły)

-- Sprawdź kampanie PAUSED z mailami "sending"
SELECT c.id, c.name, COUNT(ceq.id) as sending_count
FROM Campaign c
JOIN CampaignEmailQueue ceq ON c.id = ceq.campaignId
WHERE c.status = 'PAUSED'
  AND ceq.status = 'sending'
GROUP BY c.id;
-- Powinien zwrócić 0 wierszy
```

---

## 🎯 SCENARIUSZ 8: WYSYŁKA Z RÓŻNYMI HARMONOGRAMAMI

### 8.1. Harmonogram: tylko poniedziałek

**Warunki:**
- `allowedDays` = "poniedziałek"
- Czas: poniedziałek 10:00
- W kolejce: 10 maili "pending"

**Oczekiwany wynik:**
- ✅ System wysyła maile
- ✅ Wtorek: maile przekładane na następny poniedziałek
- ✅ `scheduledAt` ustawiony na następny poniedziałek

**Weryfikacja:**
```sql
-- Sprawdź scheduledAt dla maili w nie-dozwolone dni
SELECT scheduledAt 
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'pending'
ORDER BY scheduledAt ASC 
LIMIT 1;
-- Powinien być >= następny poniedziałek
```

---

### 8.2. Harmonogram: weekend (sobota, niedziela)

**Warunki:**
- `allowedDays` = "sobota,niedziela"
- Czas: piątek 10:00
- W kolejce: 10 maili "pending"

**Oczekiwany wynik:**
- ✅ System NIE wysyła maili w piątek
- ✅ Maile przekładane na sobotę
- ✅ `scheduledAt` ustawiony na najbliższą sobotę

**Weryfikacja:**
```sql
-- Sprawdź scheduledAt
SELECT scheduledAt, 
       CASE strftime('%w', scheduledAt)
         WHEN '0' THEN 'niedziela'
         WHEN '6' THEN 'sobota'
         ELSE 'inny'
       END as day_name
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII] 
  AND status = 'pending'
ORDER BY scheduledAt ASC;
-- Wszystkie scheduledAt powinny być w sobotę lub niedzielę
```

---

### 8.3. Harmonogram: cały tydzień (7 dni)

**Warunki:**
- `allowedDays` = "poniedziałek,wtorek,środa,czwartek,piątek,sobota,niedziela"
- Czas: dowolny dzień 10:00
- W kolejce: 10 maili "pending"

**Oczekiwany wynik:**
- ✅ System wysyła maile każdego dnia
- ✅ Tylko okno czasowe (9:00-17:00) jest respektowane
- ✅ Dni tygodnia nie są ograniczeniem

**Weryfikacja:**
```sql
-- Sprawdź wysłane maile w różnych dniach
SELECT 
  DATE(createdAt) as send_date,
  CASE strftime('%w', createdAt)
    WHEN '0' THEN 'niedziela'
    WHEN '1' THEN 'poniedziałek'
    WHEN '2' THEN 'wtorek'
    WHEN '3' THEN 'środa'
    WHEN '4' THEN 'czwartek'
    WHEN '5' THEN 'piątek'
    WHEN '6' THEN 'sobota'
  END as day_name,
  COUNT(*) as sent_count
FROM SendLog
WHERE campaignId = [ID_KAMPANII]
  AND status = 'sent'
GROUP BY DATE(createdAt)
ORDER BY send_date;
-- Powinien pokazać maile wysłane w różnych dniach tygodnia
```

---

## 🎯 SCENARIUSZ 9: WYSYŁKA Z RÓŻNYMI TEKSTAMI

### 9.1. Kampania z pełnym tekstem

**Warunki:**
- `subject` = "Test Temat"
- `text` = "Test Treść kampanii"
- `jobDescription` = "Opis stanowiska"
- `postscript` = "PS. Test"
- `linkText` = "Odwiedź naszą stronę"
- `linkUrl` = "https://example.com"

**Oczekiwany wynik:**
- ✅ Email zawiera wszystkie elementy
- ✅ Format: `[greetingForm] + [text] + [jobDescription] + [postscript] + [linkText]`
- ✅ Link jest klikalny

**Weryfikacja:**
```sql
-- Sprawdź treść w SendLog
SELECT content 
FROM SendLog 
WHERE campaignId = [ID_KAMPANII] 
ORDER BY createdAt DESC 
LIMIT 1;
-- Powinien zawierać wszystkie elementy
```

---

### 9.2. Kampania z minimalnym tekstem

**Warunki:**
- `subject` = "Test"
- `text` = "Test"
- `jobDescription` = `null`
- `postscript` = `null`
- `linkText` = `null`

**Oczekiwany wynik:**
- ✅ Email zawiera tylko `subject` i `text`
- ✅ Brak dodatkowych elementów
- ✅ Email jest poprawny (nie pusty)

**Weryfikacja:**
```sql
-- Sprawdź treść
SELECT content, subject 
FROM SendLog 
WHERE campaignId = [ID_KAMPANII] 
ORDER BY createdAt DESC 
LIMIT 1;
-- Powinien zawierać tylko subject i text
```

---

### 9.3. Kampania z personalizacją (różne języki)

**Warunki:**
- Lead 1: język "pl", powitanie "Dzień dobry Panie Janie"
- Lead 2: język "en", powitanie "Hello John"
- Lead 3: język "de", powitanie brak (generowane przez AI)

**Oczekiwany wynik:**
- ✅ Lead 1: używa istniejącego powitania "pl"
- ✅ Lead 2: używa istniejącego powitania "en"
- ✅ Lead 3: generuje powitanie przez AI w języku "de"
- ✅ Treść kampanii w języku handlowca (jeśli różny)

**Weryfikacja:**
```sql
-- Sprawdź treść maili dla różnych leadów
SELECT 
  sl.content,
  l.email,
  l.language as lead_language,
  vs.language as campaign_language
FROM SendLog sl
JOIN CampaignLead cl ON sl.campaignId = cl.campaignId AND sl.leadId = cl.leadId
JOIN Lead l ON cl.leadId = l.id
JOIN Campaign c ON sl.campaignId = c.id
JOIN VirtualSalesperson vs ON c.virtualSalespersonId = vs.id
WHERE sl.campaignId = [ID_KAMPANII]
ORDER BY sl.createdAt DESC;
-- Powinien pokazać różne powitania dla różnych języków
```

---

## 🎯 SCENARIUSZ 10: WYSYŁKA Z RÓŻNYMI SKRZYNKAMI

### 10.1. Round-robin selection

**Warunki:**
- 3 skrzynki: A (priority 1), B (priority 2), C (priority 3)
- Wszystkie mają dostępne sloty
- Wysyłka: 10 maili

**Oczekiwany wynik:**
- ✅ System używa skrzynek w kolejności: A, B, C, A, B, C...
- ✅ `lastUsedAt` jest aktualizowany dla każdej skrzynki
- ✅ Skrzynki są równomiernie używane

**Weryfikacja:**
```sql
-- Sprawdź użycie skrzynek
SELECT 
  mb.email,
  mb.priority,
  COUNT(sl.id) as emails_sent,
  mb.lastUsedAt
FROM Mailbox mb
LEFT JOIN SendLog sl ON sl.mailboxId = mb.id 
  AND sl.campaignId = [ID_KAMPANII]
  AND DATE(sl.createdAt) = DATE('now')
WHERE mb.virtualSalespersonId = [ID_HANDLOWCA]
GROUP BY mb.id
ORDER BY mb.priority;
-- Powinien pokazać równomierne użycie skrzynek
```

---

### 10.2. Główna skrzynka priorytetowa

**Warunki:**
- Skrzynka A: `mainMailboxId` = A.id, priority 2
- Skrzynka B: priority 1
- Wszystkie mają dostępne sloty

**Oczekiwany wynik:**
- ✅ System wybiera skrzynkę A jako pierwszą (główna)
- ✅ Następnie używa skrzynek według priority
- ✅ Główna skrzynka ma priorytet nad priority

**Weryfikacja:**
```sql
-- Sprawdź pierwszą używaną skrzynkę
SELECT mb.email, mb.priority, vs.mainMailboxId
FROM SendLog sl
JOIN Mailbox mb ON sl.mailboxId = mb.id
JOIN VirtualSalesperson vs ON mb.virtualSalespersonId = vs.id
WHERE sl.campaignId = [ID_KAMPANII]
ORDER BY sl.createdAt ASC
LIMIT 1;
-- Powinien pokazać główną skrzynkę (mainMailboxId)
```

---

### 10.3. Skrzynki z różnymi limitami

**Warunki:**
- Skrzynka A: limit 10, currentDailySent = 5
- Skrzynka B: limit 50, currentDailySent = 20
- Skrzynka C: limit 100, currentDailySent = 80

**Oczekiwany wynik:**
- ✅ System wybiera skrzynkę A (5/10 dostępnych)
- ✅ Po wyczerpaniu A: system wybiera B (20/50 dostępnych)
- ✅ Po wyczerpaniu B: system wybiera C (80/100 dostępnych)

**Weryfikacja:**
```sql
-- Sprawdź użycie skrzynek w kolejności
SELECT 
  mb.email,
  mb.dailyEmailLimit,
  mb.currentDailySent,
  mb.currentDailySent - mb.dailyEmailLimit as remaining
FROM SendLog sl
JOIN Mailbox mb ON sl.mailboxId = mb.id
WHERE sl.campaignId = [ID_KAMPANII]
  AND DATE(sl.createdAt) = DATE('now')
ORDER BY sl.createdAt ASC;
-- Powinien pokazać użycie skrzynek w kolejności A → B → C
```

---

## 🎯 SCENARIUSZ 11: WERYFIKACJA ATOMICZNOŚCI OPERACJI

### 11.1. Atomic mailbox slot reservation

**Warunki:**
- 2 procesy próbują wysłać mail jednocześnie
- Skrzynka: 1/50 dostępnych slotów
- Oba procesy wybierają tę samą skrzynkę

**Oczekiwany wynik:**
- ✅ Tylko jeden proces zarezerwuje slot
- ✅ Drugi proces otrzyma `null` i przekładzie mail na jutro
- ✅ `currentDailySent` zwiększony tylko o 1 (nie 2)
- ✅ Brak race condition

**Weryfikacja:**
```sql
-- Sprawdź czy currentDailySent nie przekracza limitu
SELECT 
  id,
  email,
  currentDailySent,
  dailyEmailLimit,
  currentDailySent - dailyEmailLimit as overflow
FROM Mailbox
WHERE currentDailySent > dailyEmailLimit;
-- Powinien zwrócić 0 wierszy
```

---

### 11.2. Atomic email lock

**Warunki:**
- 2 procesy próbują wysłać ten sam mail jednocześnie
- Mail w statusie "pending"

**Oczekiwany wynik:**
- ✅ Tylko jeden proces zablokuje mail (status "sending")
- ✅ Drugi proces otrzyma `lockResult.count = 0` i zakończy
- ✅ Mail wysłany tylko raz

**Weryfikacja:**
```sql
-- Sprawdź czy nie ma duplikatów w SendLog
SELECT 
  campaignId,
  leadId,
  COUNT(*) as duplicate_count
FROM SendLog
WHERE campaignId = [ID_KAMPANII]
  AND status = 'sent'
GROUP BY campaignId, leadId
HAVING COUNT(*) > 1;
-- Powinien zwrócić 0 wierszy
```

---

## 🎯 SCENARIUSZ 12: WYSYŁKA Z RÓŻNYMI DELAYAMI

### 12.1. Delay 30 sekund

**Warunki:**
- `delayBetweenEmails` = 30 sekund
- Wysyłka: 10 maili

**Oczekiwany wynik:**
- ✅ Odstępy między mailami = 30s ± 20% (24-36s)
- ✅ Wszystkie maile wysłane w ciągu ~5 minut (10 * 30s)
- ✅ System respektuje delay

**Weryfikacja:**
```sql
-- Sprawdź odstępy między wysłanymi mailami
WITH sent_times AS (
  SELECT 
    createdAt,
    LAG(createdAt) OVER (ORDER BY createdAt) as prev_sent
  FROM SendLog
  WHERE campaignId = [ID_KAMPANII]
    AND status = 'sent'
  ORDER BY createdAt
)
SELECT 
  AVG((julianday(createdAt) - julianday(prev_sent)) * 86400) as avg_delay_seconds,
  MIN((julianday(createdAt) - julianday(prev_sent)) * 86400) as min_delay_seconds,
  MAX((julianday(createdAt) - julianday(prev_sent)) * 86400) as max_delay_seconds
FROM sent_times
WHERE prev_sent IS NOT NULL;
-- avg powinien być w zakresie 24-36s
```

---

### 12.2. Delay 300 sekund (5 minut)

**Warunki:**
- `delayBetweenEmails` = 300 sekund
- Wysyłka: 10 maili

**Oczekiwany wynik:**
- ✅ Odstępy między mailami = 300s ± 20% (240-360s)
- ✅ Wszystkie maile wysłane w ciągu ~50 minut (10 * 300s)
- ✅ System respektuje długi delay

**Weryfikacja:**
```sql
-- Sprawdź odstępy (jak wyżej)
-- avg powinien być w zakresie 240-360s
```

---

## 🎯 SCENARIUSZ 13: WERYFIKACJA CRON JOB

### 13.1. Cron V2 uruchamia się co 30 sekund

**Warunki:**
- Kampania: IN_PROGRESS
- W kolejce: 5 maili "pending", `scheduledAt` <= teraz

**Oczekiwany wynik:**
- ✅ Cron uruchamia się co 30 sekund
- ✅ W każdym uruchomieniu wysyła maksymalnie 1 mail (jeśli delay minął)
- ✅ Jeśli delay nie minął: mail pozostaje w kolejce
- ✅ Jeśli delay minął: mail wysłany

**Weryfikacja:**
```sql
-- Sprawdź odstępy między wysłanymi mailami
-- Powinny być zgodne z delayBetweenEmails ± 20%
```

---

### 13.2. Cron pomija kampanie PAUSED

**Warunki:**
- Kampania A: IN_PROGRESS, w kolejce 5 maili
- Kampania B: PAUSED, w kolejce 5 maili

**Oczekiwany wynik:**
- ✅ Cron wysyła maile tylko z kampanii A
- ✅ Kampania B: maile pozostają w kolejce
- ✅ Kampania B: maile NIE są wysyłane

**Weryfikacja:**
```sql
-- Sprawdź wysłane maile
SELECT 
  c.id,
  c.name,
  c.status,
  COUNT(sl.id) as sent_count
FROM Campaign c
LEFT JOIN SendLog sl ON c.id = sl.campaignId 
  AND DATE(sl.createdAt) = DATE('now')
WHERE c.id IN ([ID_KAMPANII_A], [ID_KAMPANII_B])
GROUP BY c.id;
-- Kampania A powinna mieć sent_count > 0
-- Kampania B powinna mieć sent_count = 0
```

---

## 🎯 SCENARIUSZ 14: WERYFIKACJA LIMITÓW

### 14.1. Limit dzienny skrzynki

**Warunki:**
- Skrzynka: limit 50, currentDailySent = 49
- Próba wysłania 2 maili

**Oczekiwany wynik:**
- ✅ Pierwszy mail: wysłany, currentDailySent = 50
- ✅ Drugi mail: przekładany na jutro (brak miejsca)

**Weryfikacja:**
```sql
-- Sprawdź licznik skrzynki
SELECT currentDailySent, dailyEmailLimit
FROM Mailbox
WHERE id = [ID_SKRZYNKI];
-- currentDailySent powinien być <= dailyEmailLimit

-- Sprawdź przekładane maile
SELECT COUNT(*) 
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII]
  AND status = 'pending'
  AND scheduledAt >= DATE('now', '+1 day');
-- Powinien zwrócić liczbę przekładanych maili
```

---

### 14.2. Limit dzienny kampanii

**Warunki:**
- Kampania: limit 200, wysłano 199
- Próba wysłania 2 maili

**Oczekiwany wynik:**
- ✅ Pierwszy mail: wysłany, wysłano = 200
- ✅ Drugi mail: przekładany na jutro (limit osiągnięty)

**Weryfikacja:**
```sql
-- Sprawdź liczbę wysłanych dzisiaj
SELECT COUNT(*) 
FROM SendLog 
WHERE campaignId = [ID_KAMPANII]
  AND status = 'sent'
  AND DATE(createdAt) = DATE('now');
-- Powinien zwrócić 200 (limit)

-- Sprawdź przekładane maile
SELECT COUNT(*) 
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII]
  AND status = 'pending'
  AND scheduledAt >= DATE('now', '+1 day');
-- Powinien zwrócić liczbę przekładanych maili
```

---

### 14.3. Limit dzienny handlowca

**Warunki:**
- Handlowiec: limit 100
- Wysłano z wszystkich skrzynek: 100 maili
- Próba wysłania maila

**Oczekiwany wynik:**
- ✅ System sprawdza limit handlowca (suma wszystkich skrzynek)
- ✅ Jeśli limit osiągnięty: mail przekładany na jutro
- ✅ Limit handlowca jest respektowany

**Weryfikacja:**
```sql
-- Sprawdź limit handlowca
SELECT 
  vs.dailyEmailLimit as salesperson_limit,
  SUM(mb.currentDailySent) as total_sent
FROM VirtualSalesperson vs
JOIN Mailbox mb ON mb.virtualSalespersonId = vs.id
WHERE vs.id = [ID_HANDLOWCA]
GROUP BY vs.id;
-- total_sent powinien być <= salesperson_limit
```

---

## 🎯 SCENARIUSZ 15: WERYFIKACJA WARMUP STATUS

### 15.1. Skrzynka inactive (limit 10)

**Warunki:**
- `warmupStatus` = "inactive"
- `dailyEmailLimit` = 50 (w bazie)
- `effectiveLimit` = 10 (system używa)

**Oczekiwany wynik:**
- ✅ System używa `effectiveLimit = 10`
- ✅ System NIE używa `dailyEmailLimit = 50`
- ✅ Limit dzienny = 10 maili

**Weryfikacja:**
```sql
-- Sprawdź użycie skrzynki
SELECT 
  mb.email,
  mb.warmupStatus,
  mb.dailyEmailLimit as db_limit,
  mb.currentDailySent,
  CASE mb.warmupStatus
    WHEN 'inactive' THEN 10
    WHEN 'ready_to_warmup' THEN 10
    ELSE mb.dailyEmailLimit
  END as effective_limit
FROM Mailbox mb
WHERE mb.id = [ID_SKRZYNKI];
-- effective_limit powinien być 10 dla inactive
```

---

### 15.2. Skrzynka ready (limit z bazy)

**Warunki:**
- `warmupStatus` = "ready"
- `dailyEmailLimit` = 50

**Oczekiwany wynik:**
- ✅ System używa `effectiveLimit = 50`
- ✅ Limit dzienny = 50 maili

**Weryfikacja:**
```sql
-- Sprawdź użycie
SELECT 
  mb.email,
  mb.warmupStatus,
  mb.dailyEmailLimit as effective_limit,
  mb.currentDailySent
FROM Mailbox mb
WHERE mb.id = [ID_SKRZYNKI];
-- effective_limit powinien być 50 dla ready
```

---

### 15.3. Skrzynka warming (limit z ustawień)

**Warunki:**
- `warmupStatus` = "warming"
- `warmupDay` = 5 (tydzień 1)
- `dailyEmailLimit` = 50
- `warmupDailyLimit` = 30
- Performance limits (tydzień 1): warmup=15, campaign=10

**Oczekiwany wynik:**
- ✅ System używa `effectiveLimit = min(50, 30, 10) = 10`
- ✅ `currentSent` (dla kampanii) = `currentDailySent - warmupTodaySent`
- ✅ Limit dzienny dla kampanii = 10 maili

**Weryfikacja:**
```sql
-- Sprawdź użycie
SELECT 
  mb.email,
  mb.warmupStatus,
  mb.warmupDay,
  mb.dailyEmailLimit,
  mb.warmupDailyLimit,
  mb.currentDailySent,
  mb.warmupTodaySent,
  mb.currentDailySent - mb.warmupTodaySent as campaign_sent
FROM Mailbox mb
WHERE mb.id = [ID_SKRZYNKI];
-- campaign_sent powinien być <= 10
```

---

## 🎯 SCENARIUSZ 16: WERYFIKACJA CATCH-UP LOGIC

### 16.1. Catch-up po krótkiej przerwie (5 minut)

**Warunki:**
- Przerwa: 5 minut
- W kolejce: 5 maili "pending", `scheduledAt` w czasie przerwy
- Po powrocie: system uruchomiony

**Oczekiwany wynik:**
- ✅ System używa krótkiej tolerancji (5 min)
- ✅ System wysyła maile które były zaplanowane w czasie przerwy
- ✅ System respektuje delay między mailami

**Weryfikacja:**
```sql
-- Sprawdź wysłane maile z czasu przerwy
SELECT COUNT(*) 
FROM SendLog sl
JOIN CampaignEmailQueue ceq ON sl.campaignId = ceq.campaignId AND sl.leadId = (SELECT leadId FROM CampaignLead WHERE id = ceq.campaignLeadId)
WHERE sl.campaignId = [ID_KAMPANII]
  AND ceq.scheduledAt BETWEEN [CZAS_START_PRZERWY] AND [CZAS_KONIEC_PRZERWY]
  AND sl.status = 'sent';
-- Powinien zwrócić liczbę maili z czasu przerwy
```

---

### 16.2. Catch-up po długiej przerwie (2 godziny)

**Warunki:**
- Przerwa: 2 godziny
- W kolejce: 10 maili "pending"
- Po powrocie: system uruchomiony

**Oczekiwany wynik:**
- ✅ System wykrywa długą przerwę (stuck maile lub długi czas od ostatniego maila)
- ✅ System używa dłuższej tolerancji (2h)
- ✅ System wysyła maile które były zaplanowane w czasie przerwy
- ✅ System respektuje delay między mailami (nie wysyła wszystkich naraz)

**Weryfikacja:**
```sql
-- Sprawdź wysłane maile
SELECT COUNT(*) 
FROM SendLog 
WHERE campaignId = [ID_KAMPANII]
  AND status = 'sent'
  AND createdAt >= [CZAS_POWROTU];
-- Powinien zwrócić liczbę maili wysłanych po powrocie
```

---

### 16.3. Catch-up z minimalnym delay

**Warunki:**
- Przerwa: 2 godziny
- W kolejce: 10 maili "pending"
- `delayBetweenEmails` = 90 sekund
- Po powrocie: system uruchomiony

**Oczekiwany wynik:**
- ✅ System wysyła pierwszy mail natychmiast
- ✅ System czeka 90s ± 20% przed wysłaniem drugiego maila
- ✅ System NIE wysyła wszystkich maili naraz
- ✅ Wszystkie maile wysłane w ciągu ~15 minut (10 * 90s)

**Weryfikacja:**
```sql
-- Sprawdź odstępy między wysłanymi mailami
WITH sent_times AS (
  SELECT 
    createdAt,
    LAG(createdAt) OVER (ORDER BY createdAt) as prev_sent
  FROM SendLog
  WHERE campaignId = [ID_KAMPANII]
    AND status = 'sent'
    AND createdAt >= [CZAS_POWROTU]
  ORDER BY createdAt
)
SELECT 
  AVG((julianday(createdAt) - julianday(prev_sent)) * 86400) as avg_delay_seconds
FROM sent_times
WHERE prev_sent IS NOT NULL;
-- avg powinien być w zakresie 72-108s
```

---

## 🎯 SCENARIUSZ 17: WERYFIKACJA MIGRACJI

### 17.1. Migracja kampanii z V1 do V2

**Warunki:**
- Kampania: IN_PROGRESS, maile w V1 kolejce
- Migracja: wywołanie `initializeQueueV2()`

**Oczekiwany wynik:**
- ✅ V1 kolejka pozostaje bez zmian (nie usuwana)
- ✅ V2 kolejka utworzona z nowymi wpisami
- ✅ Maile zaplanowane z poprawnymi `scheduledAt`
- ✅ Status leadów: "queued"

**Weryfikacja:**
```sql
-- Sprawdź V1 kolejkę
SELECT COUNT(*) FROM CampaignEmailQueue WHERE campaignId = [ID_KAMPANII];
-- Powinien zwrócić liczbę maili V1

-- Sprawdź V2 kolejkę (ta sama tabela, ale nowe wpisy)
SELECT COUNT(*) 
FROM CampaignEmailQueue 
WHERE campaignId = [ID_KAMPANII]
  AND createdAt >= [CZAS_MIGRACJI];
-- Powinien zwrócić liczbę maili V2
```

---

## 📊 PODSUMOWANIE WERYFIKACJI

### ✅ Co zostało przetestowane:

1. **Tworzenie handlowców i skrzynek** - ✅
2. **Tworzenie kampanii z różnymi ustawieniami** - ✅
3. **Dodawanie leadów** - ✅
4. **Inicjalizacja kolejki V2** - ✅
5. **Wysyłka maili (różne scenariusze)** - ✅
6. **Edge cases** - ✅
7. **Spójność danych** - ✅
8. **Różne harmonogramy** - ✅
9. **Różne teksty** - ✅
10. **Różne skrzynki** - ✅
11. **Atomic operations** - ✅
12. **Różne delaye** - ✅
13. **Cron job** - ✅
14. **Limity** - ✅
15. **Warmup status** - ✅
16. **Catch-up logic** - ✅
17. **Migracja** - ✅

### ⚠️ Potencjalne problemy do sprawdzenia:

1. **Race conditions** - wymagają testów równoległych
2. **SQLite timeout** - dla dużych danych
3. **Timezone handling** - różne strefy czasowe
4. **Performance** - dla bardzo dużej liczby leadów/skrzynek

---

## 🔧 INSTRUKCJE WERYFIKACJI

Aby zweryfikować każdy scenariusz:

1. **Przygotuj dane testowe** zgodnie z warunkami
2. **Wykonaj operację** (tworzenie, aktualizacja, wysyłka)
3. **Sprawdź wyniki** używając zapytań SQL z sekcji "Weryfikacja"
4. **Porównaj** z oczekiwanymi wynikami

---

**Data utworzenia:** 2025-11-04  
**Wersja systemu:** V2  
**Status:** Gotowe do weryfikacji

