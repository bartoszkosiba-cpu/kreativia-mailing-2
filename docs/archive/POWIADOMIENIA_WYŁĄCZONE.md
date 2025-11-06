# WYŁĄCZONE POWIADOMIENIA

## ✅ WŁĄCZONE (JEDYNE POWIADOMIENIE)

### 1. **Powiadomienia o zainteresowanych leadach** (`interestedLeadNotifier.ts`)
- **Status:** ✅ WŁĄCZONE
- **Kiedy:** Natychmiast gdy AI wykryje zainteresowanie (klasyfikacja `INTERESTED`)
- **Odbiorcy:** `salespersonEmail` + `forwardEmail` (administrator)

---

## ❌ WYŁĄCZONE

### 2. **Powiadomienia o zablokowanych kontaktach** (`processor.ts`)
- **Status:** ❌ WYŁĄCZONE
- **Kiedy:** UNSUBSCRIBE lub NOT_INTERESTED
- **Powód wyłączenia:** Można zobaczyć w UI (Inbox, statusy leadów)
- **Miejsce w kodzie:** `src/integrations/inbox/processor.ts` (linie 358-367 i 400-413)

### 3. **Powiadomienia o nowych kontaktach OOO** (`processor.ts`)
- **Status:** ❌ WYŁĄCZONE
- **Kiedy:** Lead na urlopie podaje kontakty zastępcze
- **Powód wyłączenia:** Można zobaczyć w UI (nowe leady z tagiem "OOO Zastępca")
- **Miejsce w kodzie:** `src/integrations/inbox/processor.ts` (linie 907-925)

### 4. **Dzienny raport** (`dailyReportEmail.ts`)
- **Status:** ❌ WYŁĄCZONE
- **Kiedy:** Codziennie o 18:00
- **Powód wyłączenia:** Można zobaczyć w UI (dashboard, statystyki kampanii i handlowców)
- **Miejsce w kodzie:** `src/services/emailCron.ts` (linie 272-287)

### 5. **Przypomnienia o zainteresowanych leadach** (`notificationReminderCron.ts`)
- **Status:** ❌ WYŁĄCZONE
- **Kiedy:** Powtarzane przypomnienia o niepotwierdzonych zainteresowanych
- **Powód wyłączenia:** Problemy z masową wysyłką, użytkownik nie potrzebuje
- **Miejsce w kodzie:** `src/services/startCron.ts` (linia 18)

---

## 📝 PODSUMOWANIE

**Aktywne powiadomienia:** TYLKO 1
- ✅ Powiadomienia o zainteresowanych leadach (instant)

**Wyłączone powiadomienia:** 5
- ❌ Przypomnienia o zainteresowanych
- ❌ Powiadomienia o zablokowanych kontaktach
- ❌ Powiadomienia o nowych kontaktach OOO
- ❌ Dzienny raport

**Wszystkie informacje są dostępne w UI:**
- Inbox → wszystkie odpowiedzi
- Leady → statusy i szczegóły
- Dashboard → statystyki na żywo
- Kampanie → szczegóły każdej kampanii

