# 📧 Typy Maili w Systemie

## 🎯 **KATEGORIE MAILI W ARCHIWUM**

System automatycznie kategoryzuje wszystkie maile na 5 głównych typów:

### 1. **TESTOWE** (wychodzące/przychodzące)
- **Źródło**: Maile weryfikacyjne skrzynek
- **Wychodzące**: Wysyłane na samą siebie podczas weryfikacji skrzynki (SMTP test)
- **Przychodzące**: Odebrane przez IMAP podczas weryfikacji
- **Charakterystyka**: 
  - campaignId: NULL
  - leadId: NULL
  - Klasyfikacja AI: POMINIĘTA
- **Tabele**: SendLog (wychodzące), InboxReply (przychodzące z classification: INTERNAL_WARMUP)

### 2. **WARMUP** (wychodzące/przychodzące)
- **Źródło**: Maile rozgrzewające między naszymi skrzynkami
- **Wychodzące**: Wysyłane do innych skrzynek w systemie
- **Przychodzące**: Odebrane od innych skrzynek w systemie
- **Charakterystyka**:
  - campaignId: NULL
  - leadId: NULL
  - emailType: "internal"
  - Klasyfikacja AI: POMINIĘTA
- **Tabele**: WarmupEmail (wychodzące), InboxReply (przychodzące z classification: INTERNAL_WARMUP)

### 3. **KAMPANIE WYCHODZĄCE**
- **Źródło**: Wysyłka kampanii do leadów
- **Charakterystyka**:
  - campaignId: Wymagane
  - leadId: Wymagane
  - mailboxId: Skrzynka handlowca
- **Tabele**: SendLog

### 4. **KAMPANIE PRZYCHODZĄCE**
- **Źródło**: Odpowiedzi od leadów które dostały kampanię
- **Charakterystyka**:
  - campaignId: Opcjonalne (z powiązanej kampanii)
  - leadId: Wymagane (lead odpowiada)
  - Klasyfikacja AI: DZIAŁA
- **Typy odpowiedzi**: INTERESTED, NOT_INTERESTED, MAYBE_LATER, REDIRECT, OOO, UNSUBSCRIBE, BOUNCE, OTHER
- **Tabele**: InboxReply

### 5. **OBCE** (tylko przychodzące)
- **Źródło**: Maile bez leada w bazie + maile BOUNCE
- **Charakterystyka**:
  - campaignId: NULL lub może być (dla BOUNCE z kampanii)
  - leadId: NULL lub może być (dla BOUNCE od leada)
  - Klasyfikacja AI: DZIAŁA (dla obcych), BOUNCE (dla odbić)
- **Przykłady**: Spam, nieznane kontakty, maile odrzucone (BOUNCE)
- **Tabele**: InboxReply
- **⚠️ UWAGA**: Maile BOUNCE są kategoryzowane jako "UNKNOWN" w archiwum ze source: "bounce"

---

## 📤 **MAILE WYCHODZĄCE (SendLog)**

### 1. **Mail z Kampanii** 
- **Źródło**: `/api/campaigns/[id]/send`
- **campaignId**: ✅ Wymagane
- **leadId**: ✅ Wymagane
- **mailboxId**: ✅ Skrzynka handlowca
- **status**: `sent`
- **Opis**: Normalna wysyłka kampanii do leadów

### 2. **Mail Testowy z Kampanii**
- **Źródło**: `/api/campaigns/[id]/send` (parametr `testEmail`)
- **campaignId**: ✅ Wymagane
- **leadId**: ✅ Wymagane (testLead z kampanii)
- **mailboxId**: ✅ Skrzynka handlowca
- **status**: `sent`
- **Opis**: Test wysyłki do konkretnego emaila przed pełną kampanią
- **⚠️ UWAGA**: Wyświetla leada z kampanii jako odbiorcę, ale trafia na `testEmail`

### 3. **Mail Weryfikacyjny Skrzynki**
- **Źródło**: `/api/mailboxes/verify`
- **campaignId**: ❌ NULL
- **leadId**: ❌ NULL
- **mailboxId**: ✅ Skrzynka zweryfikowana
- **status**: `sent`
- **Opis**: Automatyczny mail testowy wysyłany na samą siebie (SMTP + IMAP)
- **toEmail**: `mailbox.email` (sam do siebie)

### 4. **Mail Warmup Internal**
- **Źródło**: Warmup Queue (`WarmupEmail`)
- **campaignId**: ❌ NULL
- **leadId**: ❌ NULL
- **mailboxId**: ✅ Skrzynka w warmup
- **status**: `sent`
- **Opis**: Mail TYLKO do innych skrzynek w systemie (innych handlowców) - warmup między naszymi skrzynkami
- **emailType**: `internal`
- **⚠️ USTALENIE**: Nie wysyłamy warmup do zewnętrznych skrzynek

---

## 📥 **MAILE PRZYCHODZĄCE (InboxReply)**

### 1. **Odpowiedź INTERESTED (Zainteresowany)**
- **classification**: `INTERESTED`
- **sentiment**: `positive`
- **leadId**: ✅ lub ❌ (może być nowy kontakt)
- **Akcja**: 
  - Forward do handlowca
  - Zmiana statusu leada → `ZAINTERESOWANY`
  - Email do `forwardEmail` z CompanySettings

### 2. **Odpowiedź NOT_INTERESTED (Nie zainteresowany)**
- **classification**: `NOT_INTERESTED`
- **sentiment**: `negative`
- **leadId**: ✅ Wymagane
- **Akcja**: 
  - Zmiana statusu leada → `BLOCKED`
  - Dodanie powodu → `BLOKADA_REFUSAL`

### 3. **Odpowiedź MAYBE_LATER (Może później)**
- **classification**: `MAYBE_LATER`
- **sentiment**: `neutral`
- **leadId**: ✅ Wymagane
- **Akcja**: 
  - Zmiana statusu leada → `PARKED`
  - Dodanie powodu → `CZEKAJ_MAYBE`

### 4. **Odpowiedź REDIRECT (Przekierowanie Z emailem)**
- **classification**: `REDIRECT`
- **extractedEmails**: ✅ Array emaili
- **leadId**: ✅ Wymagane
- **Akcja**: 
  - Dodanie nowych leadów dla każdy extractedEmail
  - Zmiana statusu oryginalnego leada → `REDIRECTED`

### 5. **Odpowiedź REDIRECT (Przekierowanie BEZ emaila)**
- **classification**: `REDIRECT`
- **extractedEmails**: ❌ Pusty array []
- **leadId**: ✅ Wymagane
- **Akcja**: 
  - Zmiana statusu leada → `AWAITING_CONTACT`
  - Wysłanie AUTO_FOLLOWUP (czeka 7 dni na odpowiedź)
  - Po odpowiedzi z emailem → dodanie nowego leada
  - Po odmowie/timeout → `PARKED`

### 6. **Odpowiedź OOO (Out of Office)**
- **classification**: `OOO`
- **extractedEmails**: ✅ Array emaili zastępców
- **leadId**: ✅ Wymagane
- **Akcja**: 
  - Dodanie nowych leadów dla zastępców
  - Zmiana statusu oryginalnego leada → `OOO`
  - Dodanie notatki z datami OOO

### 7. **Odpowiedź UNSUBSCRIBE (Wypisanie)**
- **classification**: `UNSUBSCRIBE`
- **sentiment**: `negative`
- **leadId**: ✅ Wymagane
- **Akcja**: 
  - Zmiana statusu leada → `BLOCKED`
  - Dodanie powodu → `BLOKADA_UNSUBSCRIBE`

### 8. **Odpowiedź BOUNCE (Odbicie)**
- **classification**: `BOUNCE`
- **sentiment**: `negative`
- **leadId**: ✅ Wymagane
- **Akcja**: 
  - Zmiana statusu leada → `BOUNCED`
  - Dodanie powodu → `BLOKADA_BOUNCE`

### 9. **Odpowiedź OTHER (Inne)**
- **classification**: `OTHER`
- **sentiment**: neutral/positive/negative
- **leadId**: ✅ lub ❌
- **Akcja**: 
  - Forward do handlowca (jeśli forwardEmail jest ustawiony)
  - Brak automatycznych akcji

### 10. **Mail INTERNAL_WARMUP (Wewnętrzny - Warmup)**
- **classification**: `INTERNAL_WARMUP`
- **sentiment**: ❌ NULL
- **leadId**: ❌ NULL
- **campaignId**: ❌ NULL
- **Opis**: Mail wewnętrzny od innej skrzynki (warmup) - NIE wymaga przetwarzania AI
- **Akcja**: 
  - Tylko zapis do InboxReply
  - Brak akcji AI

---

## 📊 **STATYSTYKI W ARCHIWUM**

### Filtrowanie po Typie:
- **sent** - Wszystkie wysłane (SendLog)
- **received** - Wszystkie odebrane (InboxReply)
- **warmup** - Maile warmup (WarmupEmail)

### Filtrowanie po Klasiefikacji (InboxReply):
- `INTERESTED`
- `NOT_INTERESTED`
- `MAYBE_LATER`
- `REDIRECT`
- `OOO`
- `UNSUBSCRIBE`
- `BOUNCE`
- `OTHER`
- `INTERNAL_WARMUP`

### Filtrowanie po Statusie:
- Wysłane: `sent`, `queued`, `failed`
- Odebrane: wszystkie statusy z klasyfikacji

---

## 🎯 **KLUCZOWE RÓŻNICE**

| Typ Maila | campaignId | leadId | mailboxId | Tabela |
|-----------|------------|--------|-----------|--------|
| Kampania | ✅ | ✅ | ✅ | SendLog |
| Test Kampanii | ✅ | ✅ | ✅ | SendLog |
| Weryfikacja | ❌ | ❌ | ✅ | SendLog |
| Warmup Internal | ❌ | ❌ | ✅ | WarmupEmail |
| Odpowiedź | ❌/✅ | ❌/✅ | ✅ | InboxReply |
| Warmup Odebrany | ❌ | ❌ | ✅ | InboxReply |

---

## 📝 **WAŻNE UWAGI**

1. **Maile warmup** są zapisywane w osobnej tabeli `WarmupEmail` dla lepszej separacji
2. **Maile weryfikacyjne** używają `NULL` dla campaignId/leadId aby uniknąć mylących danych
3. **Maile testowe z kampanii** używają placeholder leada ale wysyłają na `testEmail`
4. **Wszystkie maile** są widoczne w archiwum (`/archive`)
5. **Klasyfikacja AI** działa tylko dla maili z zewnątrz (nie dla INTERNAL_WARMUP)
6. **⚠️ Warmup TYLKO między naszymi skrzynkami** - nie wysyłamy warmup do zewnętrznych skrzynek

---

## 🎯 **LOGIKA WEWNĘTRZNE vs ZEWNĘTRZNE**

### **MAILE WEWNĘTRZNE** (między naszymi skrzynkami)

**Wychodzące:**
- ✅ Test weryfikacyjny (sam do siebie)
- ✅ Warmup Internal (do innych skrzynek w systemie)

**Przychodzące:**
- ✅ INTERNAL_WARMUP (od innych skrzynek w systemie)

**Charakterystyka:**
- campaignId: NULL
- leadId: NULL
- Klasyfikacja AI: POMINIĘTA (interne maile nie wymagają AI)

### **MAILE ZEWNĘTRZNE** (do/z leadów)

**Wychodzące:**
- ✅ Kampanie (do leadów)
- ✅ Test kampanii (do testowego emaila)

**Przychodzące:**
- ✅ Odpowiedzi od leadów (INTERESTED, NOT_INTERESTED, OOO, REDIRECT, etc.)

**Charakterystyka:**
- campaignId: Wymagane dla kampanii
- leadId: Wymagane dla kampanii
- Klasyfikacja AI: DZIAŁA (analiza odpowiedzi)

