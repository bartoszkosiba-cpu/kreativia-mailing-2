# ANALIZA POWIADOMIEŃ - KTORĘ SĄ POTRZEBNE?

## ✅ POTWIERDZONE (POTRZEBNE)

### 1. **Powiadomienia o zainteresowanych leadach** (`interestedLeadNotifier.ts`)
- **Kiedy:** Natychmiast gdy AI wykryje zainteresowanie (klasyfikacja `INTERESTED`)
- **Co zawiera:** 
  - Dane leada (imię, nazwisko, firma, email)
  - Treść odpowiedzi
  - Link do podglądu w systemie
  - Przycisk "POTWIERDZAM" (dla handlowca)
- **Odbiorcy:** `salespersonEmail` + `forwardEmail` (administrator)
- **Status:** ✅ WŁĄCZONE - POTRZEBNE

---

## ❓ DO PRZEMYŚLENIA

### 2. **Powiadomienia o zablokowanych kontaktach** (`processor.ts`)
- **Kiedy:** 
  - `UNSUBSCRIBE` - ktoś chce się wypisać
  - `NOT_INTERESTED` - ktoś jasno odmawia ("nie jestem zainteresowany")
- **Co zawiera:**
  - Email leada
  - Firma
  - Treść odpowiedzi
- **Odbiorcy:** `forwardEmail` (administrator)
- **Gdzie można to zobaczyć w UI:**
  - Inbox → wszystkie odpowiedzi są widoczne
  - Leady → status `BLOCKED` z powodem
  - Kampanie → lista leadów z statusami
- **Pytanie:** Czy powiadomienie email jest potrzebne, skoro można to zobaczyć w UI?
- **Status:** ⚠️ WŁĄCZONE - DO PRZEMYŚLENIA

### 3. **Powiadomienia o nowych kontaktach OOO** (`processor.ts`)
- **Kiedy:** Lead jest na urlopie i podaje kontakty zastępcze (np. "piszcie do jan@firma.pl")
- **Co zawiera:**
  - Oryginalny kontakt (email, firma)
  - Lista nowo dodanych kontaktów (zastępcy)
  - Skopiowane tagi
- **Odbiorcy:** `forwardEmail` (administrator)
- **Gdzie można to zobaczyć w UI:**
  - Leady → nowe leady są widoczne w liście
  - Tagi → leady mają tag "OOO Zastępca"
- **Pytanie:** Czy powiadomienie email jest potrzebne, skoro można to zobaczyć w UI?
- **Status:** ⚠️ WŁĄCZONE - DO PRZEMYŚLENIA

### 4. **Dzienny raport** (`dailyReportEmail.ts`)
- **Kiedy:** Codziennie o 18:00 (polski czas)
- **Co zawiera:**
  - Podsumowanie: wysłane maile, odpowiedzi, zainteresowani
  - Statystyki kampanii (wysłane, odpowiedzi, zainteresowani, unsubscribe, OOO)
  - Statystyki handlowców (wysłane, pozostało, odpowiedzi, zainteresowani, aktywne kampanie)
- **Odbiorcy:** `forwardEmail` (administrator)
- **Gdzie można to zobaczyć w UI:**
  - Dashboard → statystyki na żywo
  - Kampanie → szczegóły każdej kampanii
  - Handlowcy → statystyki każdego handlowca
- **Pytanie:** Czy dzienny raport email jest potrzebny, skoro można to zobaczyć w UI?
- **Status:** ⚠️ WŁĄCZONE - DO PRZEMYŚLENIA

---

## 📧 TO NIE SĄ POWIADOMIENIA (to są maile do leadów)

### 5. **Automatyczne odpowiedzi z materiałami** (`materialResponseSender.ts`)
- **To:** Maile wysyłane do leadów (zainteresowanych) z materiałami
- **Status:** ✅ DZIAŁA - to nie powiadomienie, tylko funkcjonalność biznesowa

### 6. **Automatyczne follow-upy** (`autoFollowUpManager.ts`)
- **To:** Maile wysyłane do leadów (czekających na kontakt)
- **Status:** ✅ DZIAŁA - to nie powiadomienie, tylko funkcjonalność biznesowa

---

## 💡 MOJA PROPOZYCJA

### ZACHOWAJ:
1. ✅ **Powiadomienia o zainteresowanych leadach** - POTRZEBNE (natychmiastowe powiadomienie o hot leadzie)

### WYŁĄCZ (można zobaczyć w UI):
2. ❌ **Powiadomienia o zablokowanych kontaktach** - NIE POTRZEBNE
   - Wszystko jest widoczne w Inbox
   - Statusy leadów są widoczne w UI
   - Nie wymaga natychmiastowej akcji

3. ❌ **Powiadomienia o nowych kontaktach OOO** - NIE POTRZEBNE
   - Nowe leady są widoczne w liście
   - Można je zobaczyć w UI (tag "OOO Zastępca")
   - Nie wymaga natychmiastowej akcji

4. ❌ **Dzienny raport** - NIE POTRZEBNE
   - Wszystkie statystyki są w UI
   - Raport jest tylko podsumowaniem tego co już widać
   - Można sprawdzić kiedy chcesz w UI

### ALTERNATYWNA OPCJA (jeśli chcesz):
- **Dzienny raport** - możesz wyłączyć, ale jeśli chcesz mieć podsumowanie w skrzynce (bez logowania do systemu), możesz zostawić

---

## ❓ PYTANIA DO CIEBIE:

1. **Czy potrzebujesz powiadomień o zablokowanych kontaktach?**
   - Czy sprawdzasz to w UI na bieżąco?
   - Czy potrzebujesz emaila o każdym UNSUBSCRIBE/NOT_INTERESTED?

2. **Czy potrzebujesz powiadomień o nowych kontaktach OOO?**
   - Czy sprawdzasz to w UI?
   - Czy potrzebujesz emaila o każdym dodaniu zastępców?

3. **Czy potrzebujesz dziennego raportu?**
   - Czy logujesz się do systemu codziennie?
   - Czy wolisz mieć podsumowanie w skrzynce (bez logowania)?

4. **Czy są jakieś inne powiadomienia które chciałbyś mieć?**
   - Np. alerty o błędach wysyłki?
   - Np. alerty o problemach ze skrzynkami?
   - Np. alerty o przekroczeniu limitów?

