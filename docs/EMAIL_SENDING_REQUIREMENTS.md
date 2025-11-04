# 📋 WYMAGANIA I WYZWANIA - SYSTEM WYSYŁKI MAILI

## 🎯 CEL DOKUMENTU
Ten dokument opisuje wymagania, wyzwania i problemy obecnego systemu wysyłki maili w kampaniach. Ma służyć jako podstawa do przeprojektowania i zbudowania nowego, niezawodnego systemu.

---

## 📊 OBECNE PROBLEMY I NIEDOMAGANIA

### 1. ❌ Duplikaty maili
- **Problem**: Ten sam lead otrzymuje wiele identycznych maili
- **Przyczyna**: Race conditions w cron jobs, brak prawidłowej synchronizacji
- **Częstotliwość**: Występuje regularnie, szczególnie przy wysokim obciążeniu
- **Skutek**: Utrata reputacji domen, blokady przez providerów email

### 2. ⏰ Nieprzewidywalne opóźnienia
- **Problem**: Maile nie są wysyłane zgodnie z harmonogramem
- **Obecna logika**: Dynamiczne obliczanie opóźnień, skomplikowane algorytmy
- **Skutek**: Niezgodność między planowanym a rzeczywistym czasem wysyłki
- **User feedback**: "Harmonogram ciągle się przesuwa"

### 3. 🔄 Problemy z odzyskiwaniem po restarcie
- **Problem**: Po restarcie serwera system nie kontynuuje wysyłki poprawnie
- **Obecny stan**: Logika odzyskiwania jest skomplikowana i nie zawsze działa
- **Skutek**: Przerwy w wysyłce, brak kontynuacji

### 4. 📈 Skalowalność
- **Problem**: System nie radzi sobie z wieloma kampaniami jednocześnie
- **Limity**: Cron job przetwarza tylko jedną kampanię na raz
- **Skutek**: Wąskie gardło, opóźnienia w wysyłce

### 5. 🗄️ Niespójność danych w bazie
- **Problem**: `CampaignEmailQueue` czasem nie jest synchronizowane z rzeczywistością
- **Skutek**: Puste kolejki mimo aktywnych kampanii, konieczność ręcznej naprawy

### 6. 🔍 Brak przejrzystości
- **Problem**: Trudno zrozumieć co się dzieje w systemie
- **Skutek**: Trudne debugowanie, brak zaufania do systemu

---

## ✅ WYMAGANIA FUNKCJONALNE

### 1. Wysyłka według harmonogramu
- **RF-001**: System musi wysyłać maile zgodnie z ustawieniami kampanii:
  - Okno czasowe (startHour:startMinute - endHour:endMinute)
  - Dozwolone dni tygodnia
  - Opóźnienie między mailami (delayBetweenEmails ± 20%)
  - Maksymalna liczba maili dziennie (per kampania i per skrzynka)

### 2. Wielokampaniowość
- **RF-002**: System musi obsługiwać wiele kampanii jednocześnie
- **RF-003**: Każda kampania może mieć różne okna czasowe i limity
- **RF-004**: Maile nie mogą być wysyłane z tej samej skrzynki w tym samym czasie

### 3. Limitowanie skrzynek
- **RF-005**: Każda skrzynka ma dzienny limit maili (globalny - wszystkie kampanie)
- **RF-006**: System musi sprawdzać dostępność skrzynki przed wysyłką
- **RF-007**: Warmup maile są liczone osobno, ale wpływają na globalny limit

### 4. Bezpieczeństwo i niezawodność
- **RF-008**: **ZERO duplikatów** - ten sam lead nie może otrzymać tego samego maila dwa razy
- **RF-009**: System musi być odporny na restarty serwera
- **RF-010**: W przypadku błędu, system musi retryować z backoff
- **RF-011**: Atomic operations - tylko jeden proces może wysłać maila do leada

### 5. Odzyskiwanie po przerwie
- **RF-012**: Po restarcie serwera, system musi kontynuować wysyłkę od miejsca, gdzie się zatrzymał
- **RF-013**: Nie pomijamy maili - kontynuujemy od następnego w kolejce
- **RF-014**: Nie "nadrabiamy" zaległości - wysyłamy tylko w dozwolonym oknie czasowym

### 6. Zarządzanie kolejką
- **RF-015**: System musi utrzymywać kolejkę przyszłych maili do wysłania
- **RF-016**: Kolejka musi być aktualizowana dynamicznie (usuwanie wysłanych, dodawanie nowych)
- **RF-017**: Kolejka musi być spójna z rzeczywistym stanem wysyłki

### 7. Monitorowanie i raportowanie
- **RF-018**: System musi logować wszystkie operacje wysyłki
- **RF-019**: Musi być możliwość sprawdzenia statusu każdego maila
- **RF-020**: UI musi pokazywać rzeczywisty stan wysyłki (nie przesuwający się harmonogram)

### 8. Wydajność
- **RF-021**: System musi obsługiwać setki maili dziennie
- **RF-022**: Cron job nie może blokować się na długo
- **RF-023**: Zapytania do bazy muszą być optymalne

---

## 🔧 WYZWANIA TECHNICZNE

### 1. Race Conditions
- **Problem**: Wiele procesów cron może próbować wysłać ten sam mail
- **Rozwiązanie wymagane**: Atomic locking (np. `UPDATE ... WHERE status='pending' AND id=...`)

### 2. Synchronizacja czasu
- **Problem**: Wszystkie obliczenia czasu muszą być w polskim czasie (Europe/Warsaw)
- **Rozwiązanie wymagane**: Spójne użycie timezone w całym systemie

### 3. Zarządzanie kolejką
- **Problem**: Kolejka musi być aktualizowana na bieżąco
- **Rozwiązanie wymagane**: Clear state machine dla statusów maili

### 4. Skalowalność cron
- **Problem**: Cron job uruchamia się co 1 minutę, ale może przetwarzać wiele kampanii
- **Rozwiązanie wymagane**: Przetwarzanie wielu kampanii w jednym cyklu cron lub parallel processing

### 5. Atomic operations
- **Problem**: Wiele operacji musi być atomic (fetch + lock + send)
- **Rozwiązanie wymagane**: Database transactions + unique constraints

---

## 💡 PROPOZYCJE ROZWIĄZAŃ

### OPCJA A: Prosta kolejka z atomowym przetwarzaniem (RECOMMENDED)
**Zasada działania:**
1. Kolejka `CampaignEmailQueue` zawiera wszystkie zaplanowane maile z dokładnym `scheduledAt`
2. Cron job (co 30-60s) przetwarza wszystkie kampanie, ale dla każdej:
   - Pobiera **jeden** mail z `status='pending'` i `scheduledAt <= now()`
   - **Atomowo** zmienia status na `sending`
   - Wysyła mail
   - Zmienia status na `sent` lub `failed`
3. Po wysłaniu, natychmiast planuje następny mail dla tej kampanii

**Zalety:**
- ✅ Prosta logika
- ✅ Atomic operations
- ✅ Łatwe odzyskiwanie (status='sending' → 'pending')
- ✅ Skalowalne (można przetwarzać wiele kampanii równolegle)

**Wady:**
- ⚠️ Wymaga częstszych wywołań cron (co 30-60s)

### OPCJA B: Worker pool z job queue
**Zasada działania:**
1. Użycie biblioteki job queue (np. BullMQ, Bull)
2. Każdy mail to osobny job z `delay` do czasu wysyłki
3. Worker pool przetwarza jobs równolegle

**Zalety:**
- ✅ Automatyczne retry, backoff
- ✅ Built-in monitoring
- ✅ Skalowalne

**Wady:**
- ⚠️ Wymaga Redis (dodatkowa zależność)
- ⚠️ Większa złożoność

### OPCJA C: Event-driven z setTimeout
**Zasada działania:**
1. Po wysłaniu maila, `setTimeout` planuje następny
2. Każdy mail ma własny timer

**Zalety:**
- ✅ Precyzyjne timingi

**Wady:**
- ❌ Tracisz timery przy restarcie
- ❌ Trudne zarządzanie wieloma timerami
- ❌ Brak persistencji

---

## 📐 PROPOZOWANA ARCHITEKTURA (OPCJA A)

### State Machine dla maila
```
pending → sending → sent
                ↓
             failed
```

### Flow wysyłki
1. **Inicjalizacja kampanii**:
   - Kampania startuje → `initializeQueue()` planuje pierwsze N maili
   - Każdy mail ma `scheduledAt = lastSent + delay`

2. **Cron job (co 30-60s)**:
   ```
   FOR EACH active campaign:
     - Find next mail: scheduledAt <= now() AND status='pending'
     - Atomic lock: UPDATE ... SET status='sending' WHERE id=... AND status='pending'
     - If locked successfully:
       - Check mailbox availability
       - Send email
       - Update status: 'sending' → 'sent'/'failed'
       - Schedule next email for this campaign
   ```

3. **Planowanie następnego maila**:
   - Po wysłaniu, oblicz `nextScheduledAt = now() + delay ± 20%`
   - Jeśli `nextScheduledAt` jest w oknie czasowym → dodaj do kolejki
   - Jeśli poza oknem → zaplanuj na następny dzień

### Database Schema
```sql
CampaignEmailQueue:
  - id
  - campaignId
  - campaignLeadId
  - scheduledAt (precise timestamp)
  - status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
  - sentAt
  - error
  - INDEX(status, scheduledAt) -- dla szybkiego wyszukiwania
  - UNIQUE(campaignId, campaignLeadId) -- jeden mail per lead w kampanii
```

---

## 🎯 PRIORYTETY IMPLEMENTACJI

### FAZA 1: Podstawy (MUST HAVE)
1. ✅ Prosta kolejka z `scheduledAt`
2. ✅ Atomic locking (`pending` → `sending`)
3. ✅ Sprawdzenie duplikatów przed wysyłką
4. ✅ Podstawowe logowanie

### FAZA 2: Niezawodność (MUST HAVE)
5. ✅ Odzyskiwanie po restarcie (status='sending' → 'pending')
6. ✅ Obsługa błędów i retry
7. ✅ Sprawdzanie dostępności skrzynek

### FAZA 3: Optymalizacja (SHOULD HAVE)
8. ✅ Przetwarzanie wielu kampanii równolegle
9. ✅ Optymalizacja zapytań do bazy
10. ✅ Monitoring i alerting

---

## 📝 NOTATKI Z IMPLEMENTACJI

### Problem z obecną implementacją
- Zbyt skomplikowana logika dynamicznego obliczania opóźnień
- Brak spójności między `CampaignEmailQueue` a rzeczywistym stanem
- Cron job przetwarza tylko jedną kampanię na raz
- Race conditions przy równoczesnym dostępie

### Lekcje wyciągnięte
1. **KISS (Keep It Simple, Stupid)** - prosta logika jest lepsza niż skomplikowana
2. **Atomic operations** - zawsze używaj atomic locking
3. **Single source of truth** - jeden punkt prawdy dla stanu maila
4. **Idempotency** - każda operacja musi być idempotentna (można powtórzyć)

---

## ❓ OTWARTE PYTANIA

1. **Częstotliwość cron**:
   - Co 30s? 60s? 2 min?
   - Zależy od minimalnego opóźnienia między mailami?

2. **Buffer size**:
   - Ile maili planować z góry? (np. 10, 50, 100?)
   - Czy planować na cały dzień czy tylko na kilka godzin?

3. **Retry logic**:
   - Ile prób retry?
   - Jaki backoff? (exponential?)

4. **Monitoring**:
   - Jakie metryki śledzić?
   - Jakie alerty?

---

## 📚 DODATKOWE MATERIAŁY

### Obecne pliki kluczowe:
- `src/services/campaignEmailSender.ts` - główna logika wysyłki
- `src/services/campaignEmailQueue.ts` - zarządzanie kolejką
- `src/services/scheduledSender.ts` - stara logika (do usunięcia?)
- `src/services/emailCron.ts` - cron job

### Biblioteki używane:
- `node-cron` - cron jobs
- `prisma` - ORM
- `nodemailer` - wysyłka maili

---

**Data utworzenia**: 2025-11-04
**Status**: W trakcie prac koncepcyjnych
**Następny krok**: Przedyskutowanie propozycji i wybór ostatecznego podejścia


