# PLAN WDROŻENIA SYSTEMU STATUSÓW

## [→] PRZEGLĄD PLANU

**Cel:** Wdrożenie nowego systemu statusów leadów zgodnie z dokumentacją `docs/system-statusy.md`
**Czas realizacji:** 5-7 dni roboczych
**Priorytet:** WYSOKI - fundament systemu hot lead generatora

---

## [→] FAZA 1: PRZYGOTOWANIE BAZY DANYCH (DZIEŃ 1)

### 1.1 Migracja Prisma Schema
**Plik:** `prisma/schema.prisma`
**Zadania:**
- [ ] Dodać nowe pola do modelu `Lead`:
  ```sql
  status            String    @default("AKTYWNY") // AKTYWNY, ZAINTERESOWANY, BLOKADA, CZEKAJ
  subStatus         String?   // ZAINTERESOWANY_CAMPAIGN, BLOKADA_REFUSAL, CZEKAJ_MAYBE, etc.
  blockedCampaigns  String?   // JSON array z ID kampanii [1,2,3]
  reactivatedAt     DateTime? // Kiedy został reaktywowany
  lastReactivation  String?   // Z jakiego statusu został reaktywowany
  ```
- [ ] Usunąć przestarzałe pole `isBlocked` (zastąpione przez `status`)
- [ ] Dodać indeksy dla nowych pól

### 1.2 Migracja Bazy Danych
**Zadania:**
- [ ] Utworzyć migrację Prisma
- [ ] Zaktualizować istniejące dane:
  ```sql
  UPDATE Lead SET status = 'AKTYWNY' WHERE status IS NULL;
  UPDATE Lead SET status = 'BLOKADA' WHERE isBlocked = true;
  ```
- [ ] Przetestować migrację na kopii bazy

### 1.3 Aktualizacja TypeScript Interfaces
**Pliki:** `src/types/`, `app/types/`
**Zadania:**
- [ ] Zaktualizować interfejs `Lead`
- [ ] Dodać typy dla statusów i podstatusów
- [ ] Zaktualizować wszystkie komponenty używające `Lead`

---

## [→] FAZA 2: AKTUALIZACJA AI AGENT (DZIEŃ 2)

### 2.1 Nowa Logika Klasyfikacji
**Plik:** `src/services/aiAgent.ts`
**Zadania:**
- [ ] Zaimplementować logikę dla `MAYBE_LATER` → `CZEKAJ`
- [ ] Zaimplementować logikę dla `REDIRECT` bez emaila → `CZEKAJ_REDIRECT`
- [ ] Dodać obsługę `blockedCampaigns` w akcjach
- [ ] Zaimplementować reaktywację z `BLOKADA` na `ZAINTERESOWANY`

### 2.2 Nowe Akcje AI Agent
**Zadania:**
- [ ] Dodać akcję `PARK` dla `MAYBE_LATER`
- [ ] Dodać akcję `AUTO_FOLLOWUP` dla `CZEKAJ_REDIRECT`
- [ ] Dodać akcję `REACTIVATE` dla reaktywacji
- [ ] Zaktualizować `executeAction()` z nowymi akcjami

### 2.3 Testy AI Agent
**Zadania:**
- [ ] Przetestować każdą klasyfikację AI
- [ ] Sprawdzić poprawność ustawiania statusów
- [ ] Zweryfikować akcje dla każdego przypadku

---

## [→] FAZA 3: LOGIKA WYSYŁKI KAMPANII (DZIEŃ 3)

### 3.1 Funkcja `canSendCampaign`
**Pliki:** `src/services/scheduledSender.ts`, `app/api/campaigns/[id]/send/route.ts`
**Zadania:**
- [ ] Zaimplementować nową logikę wysyłki:
  ```typescript
  const canSendCampaign = (lead, campaignId) => {
    if (lead.status === "BLOKADA") return false;
    if (lead.status === "AKTYWNY") return true;
    if (lead.status === "ZAINTERESOWANY") {
      return !lead.blockedCampaigns.includes(campaignId);
    }
    if (lead.status === "CZEKAJ") {
      return !lead.blockedCampaigns.includes(campaignId);
    }
    return false;
  };
  ```

### 3.2 Aktualizacja Filtrów Leadów
**Pliki:** `app/api/campaigns/[id]/leads/route.ts`, `app/campaigns/[id]/add-leads/page.tsx`
**Zadania:**
- [ ] Zaktualizować filtry w API
- [ ] Zaktualizować UI wyboru leadów
- [ ] Dodać wizualne oznaczenia statusów

### 3.3 Testy Wysyłki
**Zadania:**
- [ ] Przetestować wysyłkę dla każdego statusu
- [ ] Sprawdzić blokowanie follow-upów
- [ ] Zweryfikować logikę nowych kampanii

---

## [→] FAZA 4: INTERFEJS UŻYTKOWNIKA (DZIEŃ 4)

### 4.1 Aktualizacja Funkcji Pomocniczych
**Pliki:** `app/leads/page.tsx`, `app/leads/[id]/page.tsx`
**Zadania:**
- [ ] Zaktualizować `getStatusLabel()` z nowymi statusami
- [ ] Zaktualizować `getStatusColor()` z nowymi kolorami
- [ ] Dodać ikony dla nowych statusów
- [ ] Zaktualizować dropdown w szczegółach leada

### 4.2 Nowe Komponenty UI
**Zadania:**
- [ ] Dodać wizualne oznaczenia podstatusów
- [ ] Zaimplementować akcję "Reaktywuj" dla BLOKADA
- [ ] Dodać informacje o `blockedCampaigns`
- [ ] Zaktualizować tooltips i opisy

### 4.3 Strona Hot Leads
**Plik:** `app/hot-leads/page.tsx` (NOWY)
**Zadania:**
- [ ] Utworzyć stronę dla ZAINTERESOWANY leadów
- [ ] Dodać filtry i sortowanie
- [ ] Zaimplementować akcję "Przejmij leada"
- [ ] Dodać do nawigacji

---

## [→] FAZA 5: SYSTEM AUTO_FOLLOWUP (DZIEŃ 5)

### 5.1 Implementacja AUTO_FOLLOWUP
**Plik:** `src/services/autoFollowup.ts` (NOWY)
**Zadania:**
- [ ] Utworzyć serwis do wysyłania auto follow-upów
- [ ] Zaimplementować timeout 7 dni dla `CZEKAJ_REDIRECT`
- [ ] Dodać szablony wiadomości (PL, EN, DE, FR)
- [ ] Zintegrować z systemem cron

### 5.2 Cron Job dla AUTO_FOLLOWUP
**Plik:** `src/services/emailCron.ts`
**Zadania:**
- [ ] Dodać cron job sprawdzający `CZEKAJ_REDIRECT`
- [ ] Zaimplementować logikę timeout → `BLOKADA`
- [ ] Dodać logowanie i monitoring

### 5.3 Testy AUTO_FOLLOWUP
**Zadania:**
- [ ] Przetestować wysyłkę auto follow-upów
- [ ] Sprawdzić timeout i przejście do BLOKADA
- [ ] Zweryfikować obsługę odpowiedzi

---

## [→] FAZA 6: TESTY I WALIDACJA (DZIEŃ 6)

### 6.1 Testy Integracyjne
**Zadania:**
- [ ] Przetestować pełny workflow od importu do reaktywacji
- [ ] Sprawdzić wszystkie kombinacje statusów i akcji
- [ ] Zweryfikować poprawność danych w bazie

### 6.2 Testy Wydajności
**Zadania:**
- [ ] Sprawdzić wydajność nowych zapytań do bazy
- [ ] Przetestować system z dużą liczbą leadów
- [ ] Zoptymalizować indeksy jeśli potrzeba

### 6.3 Testy UI/UX
**Zadania:**
- [ ] Przetestować wszystkie ekrany z nowymi statusami
- [ ] Sprawdzić responsywność i użyteczność
- [ ] Zweryfikować komunikaty i błędy

---

## [→] FAZA 7: WDROŻENIE I MONITORING (DZIEŃ 7)

### 7.1 Przygotowanie do Wdrożenia
**Zadania:**
- [ ] Utworzyć backup bazy danych
- [ ] Przygotować plan rollback
- [ ] Zaktualizować dokumentację

### 7.2 Wdrożenie
**Zadania:**
- [ ] Wykonać migrację bazy danych
- [ ] Wdrożyć nowy kod
- [ ] Uruchomić system i sprawdzić działanie

### 7.3 Monitoring
**Zadania:**
- [ ] Monitorować logi systemu
- [ ] Sprawdzać poprawność klasyfikacji AI
- [ ] Kontrolować wydajność

---

## [→] ZADANIA DODATKOWE

### A) Dokumentacja
- [ ] Zaktualizować `docs/system-statusy.md` po każdej zmianie
- [ ] Dodać przykłady użycia w dokumentacji
- [ ] Utworzyć przewodnik migracji dla użytkowników

### B) Logowanie i Monitoring
- [ ] Dodać szczegółowe logi dla nowych statusów
- [ ] Zaimplementować metryki skuteczności
- [ ] Dodać alerty dla błędów

### C) Optymalizacja
- [ ] Zoptymalizować zapytania do bazy danych
- [ ] Dodać cache dla często używanych danych
- [ ] Zaimplementować lazy loading gdzie potrzeba

---

## [→] KRYTERIA SUKCESU

### Funkcjonalne
- [ ] Wszystkie statusy działają zgodnie z dokumentacją
- [ ] AI Agent poprawnie klasyfikuje i podejmuje akcje
- [ ] System wysyłki respektuje nowe reguły
- [ ] UI wyświetla statusy i pozwala na zarządzanie

### Techniczne
- [ ] 0 błędów TypeScript
- [ ] Wszystkie testy przechodzą
- [ ] Wydajność nie uległa pogorszeniu
- [ ] Baza danych jest spójna

### Biznesowe
- [ ] Handlowcy otrzymują powiadomienia o ZAINTERESOWANY
- [ ] System nie wysyła niepotrzebnych follow-upów
- [ ] Reaktywacja działa poprawnie
- [ ] Raporty pokazują poprawne dane

---

## [→] RYZYKA I MITIGACJA

### Ryzyko: Błędy w migracji bazy danych
**Mitigacja:** Backup przed migracją, testy na kopii, plan rollback

### Ryzyko: Problemy z wydajnością
**Mitigacja:** Testy wydajności, optymalizacja zapytań, monitoring

### Ryzyko: Błędy w logice AI Agent
**Mitigacja:** Szczegółowe testy, logowanie, możliwość ręcznej korekty

### Ryzyko: Problemy z UI/UX
**Mitigacja:** Testy użytkownika, iteracyjne poprawki, feedback

---

## [→] NASTĘPNE KROKI

1. **DZIEŃ 1:** Rozpocząć od migracji bazy danych
2. **DZIEŃ 2:** Zaimplementować nową logikę AI Agent
3. **DZIEŃ 3:** Zaktualizować system wysyłki kampanii
4. **DZIEŃ 4:** Poprawić interfejs użytkownika
5. **DZIEŃ 5:** Dodać system AUTO_FOLLOWUP
6. **DZIEŃ 6:** Przeprowadzić testy i walidację
7. **DZIEŃ 7:** Wdrożyć i monitorować

**Czy chcesz rozpocząć implementację od Fazy 1?** 🚀
