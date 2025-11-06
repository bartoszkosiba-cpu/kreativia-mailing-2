# 🎯 KONCEPCJA MODUŁU CRM - Kreativia CRM

## 📋 PRZEGLĄD SYSTEMU

**Cel:** Rozszerzenie aplikacji o moduł CRM do prowadzenia ciepłych leadów przed przekazaniem do handlowca.

**Architektura:** Aplikacja składa się z dwóch głównych modułów:
1. **Kreativia Mailing** - Cold outreach, prospecting
2. **Kreativia CRM** - Nurturing ciepłych leadów, automatyczne sekwencje

---

## 🏗️ STRUKTURA NAWIGACJI

### Obecna struktura:
```
[Kreativia] [MAILING]
  └─ Menu nawigacji (Kampanie, Leady, Handlowcy, etc.)
```

### Nowa struktura:
```
[Kreativia] [MAILING] | [CRM]
  ├─ Moduł Mailing (istniejące menu)
  └─ Moduł CRM (nowe menu)
```

### Przełączanie między modułami:
- **Przełącznik modułów** w lewym górnym rogu (obok logo)
- Wybór modułu zmienia:
  - Menu nawigacji
  - Dashboard
  - Filtry leadów (domyślnie tylko odpowiednie statusy)
  - Widok i funkcjonalności

---

## 📊 NOWY STATUS: `CRM_NURTURING`

### Definicja:
Lead z umiarkowanym zainteresowaniem, który wymaga nurturing przed przekazaniem do handlowca.

### Kiedy lead trafia do CRM?

**Scenariusz 1: INTERESTED → Rozdzielenie**
```
Lead odpowiada → AI klasyfikuje: INTERESTED
  ├─ HOT (wyraźna prośba o wycenę/spotkanie) → ZAINTERESOWANY → FORWARD do handlowca
  └─ WARM (prośba o więcej info, materiały) → CRM_NURTURING → Sekwencja CRM
```

**Scenariusz 2: Lead odpowiada w CRM**
```
Lead w CRM_NURTURING → Odpowiedź na email
  ├─ Konkretne pytanie/wycena → CRM_NURTURING → FORWARD do handlowca
  ├─ Odpowiedź pozytywna → CRM_NURTURING → Kontynuuj sekwencję
  └─ Brak odpowiedzi → CRM_NURTURING → Automatyczne przypomnienie
```

### Sub-statusy CRM:
- `CRM_NURTURING_NEW` - Właśnie trafił do CRM
- `CRM_NURTURING_ACTIVE` - W trakcie sekwencji
- `CRM_NURTURING_AWAITING_RESPONSE` - Wysłał email, czeka na odpowiedź
- `CRM_NURTURING_READY_FOR_SALES` - Gotowy do przekazania (AI wykryło zwiększone zainteresowanie)

---

## 🔄 WORKFLOW PRZEPŁYWU LEADÓW

### Prze flow z INTERESTED:

```
1. Lead odpowiada na kampanię → AI: INTERESTED

2. AI analizuje poziom zainteresowania:
   ├─ HOT signals:
   │   ├─ "Proszę o wycenę"
   │   ├─ "Chciałbym umówić spotkanie"
   │   ├─ "Kiedy możemy rozpocząć?"
   │   └─ → Status: ZAINTERESOWANY → FORWARD do handlowca
   │
   └─ WARM signals:
       ├─ "Wyślijcie więcej informacji"
       ├─ "Proszę o materiały/katalog"
       ├─ "Interesuje mnie wasza oferta"
       └─ → Status: CRM_NURTURING → Rozpocznij sekwencję CRM
```

### Workflow w CRM:

```
1. Lead trafia do CRM_NURTURING

2. Automatyczna sekwencja CRM:
   ├─ Email #1: Wysyłka materiałów (jeśli prosił)
   ├─ Email #2: Follow-up po 3-5 dniach (jeśli nie odpowiada)
   ├─ Email #3: Przypomnienie po 7-10 dniach
   └─ Email #4: Ostatnia próba po 14 dniach

3. Jeśli lead odpowiada:
   ├─ Konkretne pytanie → FORWARD do handlowca
   ├─ Pozytywna odpowiedź → Kontynuuj sekwencję (dostosuj)
   └─ Negatywna odpowiedź → Status: MAYBE_LATER lub BLOKADA

4. Jeśli lead NIE odpowiada:
   └─ Po 30 dniach → Status: PARKED (reaktywalny ręcznie)
```

---

## 🚫 ZABLOKOWANIE KAMPANII PROSPEKTINGOWYCH

### Zasada:
**Lead w CRM_NURTURING NIE powinien dostawać kampanii prospectingowych.**

### Implementacja:
```typescript
// W logice wysyłki kampanii
if (lead.status === 'CRM_NURTURING') {
  // ❌ NIE wysyłaj kampanii prospectingowych
  // ✅ TAK wysyłaj sekwencje CRM (specjalne kampanie typu "CRM")
}
```

### Wyjątki:
- Lead może być reaktywowany ręcznie do prospecting (zmiana statusu na AKTYWNY)
- Lead może być przekazany do handlowca (zmiana statusu na ZAINTERESOWANY)

---

## 📧 SEKWENCJE CRM - KAMPANIE "CIEPŁE"

### Nowy typ kampanii: `CRM_SEQUENCE`

**Różnice od kampanii prospectingowych:**
- ✅ Tylko dla leadów w statusie `CRM_NURTURING`
- ✅ Personalizowane na podstawie historii komunikacji
- ✅ Automatyczne przypomnienia (jeśli lead nie odpowiada)
- ✅ AI-powered odpowiedzi na pytania
- ✅ Tracking engagement (otwarcia, kliknięcia)

### Struktura sekwencji:

```typescript
interface CRMSequence {
  id: number;
  name: string; // "Sekwencja dla ciepłych leadów"
  steps: CRMSequenceStep[];
  isActive: boolean;
}

interface CRMSequenceStep {
  id: number;
  order: number; // Kolejność w sekwencji
  delayDays: number; // Opóźnienie od poprzedniego kroku
  triggerCondition: 'SEND_IMMEDIATELY' | 'NO_RESPONSE' | 'CUSTOM';
  emailTemplate: string; // Personalizowany template
  subject: string;
  canSkip: boolean; // Czy można pominąć jeśli lead odpowie
}
```

### Przykładowa sekwencja:

```
Lead trafia do CRM → Sekwencja "Ciepłe leady"

Krok 1 (Dzień 0):
  - Wysyłka materiałów (jeśli prosił)
  - Template: "Dziękuję za zainteresowanie, oto nasze materiały..."
  - Trigger: SEND_IMMEDIATELY

Krok 2 (Dzień 5):
  - Follow-up z pytaniem
  - Template: "Chciałem sprawdzić czy materiały były pomocne..."
  - Trigger: NO_RESPONSE (jeśli nie odpowiedział na Krok 1)

Krok 3 (Dzień 12):
  - Przypomnienie z case study
  - Template: "Oto przykład jak pomogliśmy podobnej firmie..."
  - Trigger: NO_RESPONSE

Krok 4 (Dzień 20):
  - Ostatnia próba z promocją
  - Template: "Mamy specjalną ofertę dla firm takich jak Państwa..."
  - Trigger: NO_RESPONSE

Po 30 dniach bez odpowiedzi:
  - Status: PARKED
  - Można reaktywować ręcznie
```

---

## 🤖 AI-POWERED ODPOWIEDZI W CRM

### Automatyczne odpowiedzi na pytania:

**Gdy lead odpowiada w CRM z pytaniem:**
1. AI analizuje pytanie
2. AI generuje odpowiedź (na podstawie materiałów kampanii, kontekstu)
3. System wysyła odpowiedź (z opcjonalną akceptacją administratora)
4. Jeśli pytanie wymaga handlowca → FORWARD

### Przykłady:
- Pytanie: "Jaki jest czas realizacji?" → AI generuje odpowiedź z materiałów
- Pytanie: "Ile kosztuje?" → FORWARD do handlowca (konkretne zapytanie)
- Pytanie: "Czy macie referencje w branży X?" → AI generuje odpowiedź z case studies

---

## 📈 LEAD SCORING (OPCJONALNE)

### System punktacji leadów w CRM:

**Czynniki zwiększające score:**
- ✅ Otwiera emaile (engagement)
- ✅ Klika w linki
- ✅ Odpowiada na emaile
- ✅ Pobiera materiały
- ✅ Zadał konkretne pytanie

**Czynniki zmniejszające score:**
- ❌ Nie otwiera emaili
- ❌ Nie odpowiada
- ❌ Negatywna odpowiedź

**Akcje na podstawie score:**
- Score > 80 → FORWARD do handlowca (gotowy)
- Score 50-80 → Kontynuuj sekwencję
- Score < 50 → Zwiększ częstotliwość przypomnień

---

## 🎨 INTERFEJS UŻYTKOWNIKA

### Moduł CRM - Dashboard:

```
┌─────────────────────────────────────────┐
│  Kreativia CRM                          │
├─────────────────────────────────────────┤
│                                         │
│  📊 Statystyki:                         │
│  - Leadów w CRM: 45                    │
│  - Gotowych do przekazania: 12         │
│  - W trakcie sekwencji: 28             │
│  - Oczekujących na odpowiedź: 5        │
│                                         │
│  📧 Sekwencje CRM:                     │
│  - Aktywne: 3                          │
│  - W trakcie wysyłki: 28 leadów       │
│                                         │
│  🔔 Do akcji:                          │
│  - 12 leadów gotowych do handlowca     │
│  - 5 pytań wymagających odpowiedzi AI  │
│                                         │
└─────────────────────────────────────────┘
```

### Menu nawigacji CRM:

```
CRM
├─ Dashboard
├─ Leady w CRM (filtr: status = CRM_NURTURING)
├─ Sekwencje CRM
│   ├─ Lista sekwencji
│   ├─ Tworzenie sekwencji
│   └─ Szablony emaili
├─ Odpowiedzi AI
│   ├─ Kolejka odpowiedzi
│   └─ Historia odpowiedzi
└─ Raporty CRM
    ├─ Konwersja CRM → Handlowiec
    ├─ Czas w CRM
    └─ Engagement tracking
```

---

## 🗄️ STRUKTURA BAZY DANYCH

### Nowe tabele:

```prisma
// Sekwencje CRM
model CRMSequence {
  id              Int      @id @default(autoincrement())
  name            String
  description     String?
  isActive        Boolean  @default(true)
  steps           CRMSequenceStep[]
  leads           Lead[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Kroki w sekwencji
model CRMSequenceStep {
  id              Int      @id @default(autoincrement())
  sequenceId      Int
  sequence        CRMSequence @relation(fields: [sequenceId], references: [id])
  order           Int      // Kolejność
  delayDays       Int      @default(0) // Opóźnienie w dniach
  triggerCondition String  // SEND_IMMEDIATELY, NO_RESPONSE, CUSTOM
  subject         String
  emailTemplate   String
  canSkip         Boolean  @default(false)
  createdAt       DateTime @default(now())
}

// Leady w sekwencji CRM
model CRMLeadSequence {
  id              Int      @id @default(autoincrement())
  leadId          Int
  lead            Lead     @relation(fields: [leadId], references: [id])
  sequenceId      Int
  sequence        CRMSequence @relation(fields: [sequenceId], references: [id])
  currentStep     Int      @default(0) // Aktualny krok
  nextSendDate    DateTime? // Kiedy wysłać następny email
  isPaused        Boolean  @default(false)
  pausedReason    String?
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Odpowiedzi AI w CRM
model CRMResponse {
  id              Int      @id @default(autoincrement())
  leadId          Int
  lead            Lead     @relation(fields: [leadId], references: [id])
  replyId         Int?     // Jeśli odpowiada na konkretną odpowiedź leada
  question        String   // Pytanie leada
  aiResponse      String   // Wygenerowana odpowiedź AI
  status          String   // PENDING, APPROVED, SENT, REJECTED
  approvedBy      Int?     // ID administratora
  approvedAt      DateTime?
  sentAt          DateTime?
  createdAt       DateTime @default(now())
}

// Tracking engagement w CRM
model CRMEngagement {
  id              Int      @id @default(autoincrement())
  leadId          Int
  lead            Lead     @relation(fields: [leadId], references: [id])
  emailId         Int?     // ID wysłanego emaila
  eventType       String   // OPEN, CLICK, REPLY, DOWNLOAD
  eventData       String?  // JSON z dodatkowymi danymi
  createdAt       DateTime @default(now())
}
```

### Rozszerzenie modelu Lead:

```prisma
model Lead {
  // ... istniejące pola ...
  
  // CRM fields
  status          String   @default("AKTYWNY") // Dodaj: CRM_NURTURING
  subStatus       String?  // Dodaj: CRM_NURTURING_NEW, CRM_NURTURING_ACTIVE, etc.
  
  // CRM relations
  crmSequence     CRMLeadSequence?
  crmResponses    CRMResponse[]
  crmEngagements  CRMEngagement[]
  
  // CRM metadata
  crmEnteredAt    DateTime? // Kiedy trafił do CRM
  crmReadyForSales Boolean  @default(false) // Czy gotowy do przekazania
  crmScore         Int?     // Lead scoring (0-100)
}
```

---

## 🚀 PLAN IMPLEMENTACJI (FAZY)

### Faza 1: Podstawowa struktura (2-3 dni)
- ✅ Dodanie statusu `CRM_NURTURING` do systemu
- ✅ Rozszerzenie Navbar o przełącznik modułów
- ✅ Podstawowy dashboard CRM
- ✅ Tabela `CRMSequence` i `CRMSequenceStep`

### Faza 2: Sekwencje emaili (3-4 dni)
- ✅ Tworzenie sekwencji CRM (UI)
- ✅ Automatyczna wysyłka kroków sekwencji
- ✅ Logika przypomnień (NO_RESPONSE)
- ✅ Tracking wysyłki

### Faza 3: AI odpowiedzi (2-3 dni)
- ✅ Integracja AI do generowania odpowiedzi
- ✅ Kolejka odpowiedzi do akceptacji
- ✅ Automatyczna wysyłka odpowiedzi

### Faza 4: Zaawansowane funkcje (3-4 dni)
- ✅ Lead scoring
- ✅ Engagement tracking
- ✅ Raporty CRM
- ✅ Automatyczna eskalacja do handlowca

### Faza 5: Integracja z Mailing (2 dni)
- ✅ Zablokowanie kampanii prospectingowych dla leadów w CRM
- ✅ Przepływ INTERESTED → CRM_NURTURING vs ZAINTERESOWANY
- ✅ Reaktywacja z CRM do prospecting

---

## ❓ PYTANIA DO ROZSTRZYGNIĘCIA

1. **Kampanie dla ciepłych leadów:**
   - Czy tworzymy osobny typ kampanii "CRM" czy używamy istniejących?
   - Czy sekwencje CRM to osobne "kampanie" czy zupełnie inny mechanizm?

2. **Częstotliwość przypomnień:**
   - Jak często przypominać (3, 5, 7 dni)?
   - Ile maksymalnie przypomnień przed PARKED?

3. **AI odpowiedzi:**
   - Czy zawsze wymagają akceptacji administratora?
   - Czy niektóre typy odpowiedzi mogą być automatyczne?

4. **Przekazanie do handlowca:**
   - Automatyczne (gdy AI wykryje konkretne zapytanie)?
   - Ręczne (administrator decyduje)?
   - Mieszane (automatyczne + ręczna akceptacja)?

5. **Reaktywacja:**
   - Czy lead z CRM może wrócić do prospecting (AKTYWNY)?
   - Czy tylko do handlowca (ZAINTERESOWANY)?

---

## 📝 PODSUMOWANIE

**Moduł CRM będzie:**
- ✅ Prowadził ciepłe leady przed przekazaniem do handlowca
- ✅ Automatycznie przypominał się jeśli lead nie odpowiada
- ✅ Personalizował komunikację na podstawie historii
- ✅ Odpowiadał na pytania (AI-powered)
- ✅ Blokował kampanie prospectingowe dla leadów w CRM
- ✅ Miał własne sekwencje emaili dostosowane do ciepłych leadów

**Korzyści:**
- 🎯 Więcej leadów przekazanych do handlowca (po "rozgrzaniu")
- ⏱️ Oszczędność czasu handlowca (mniej "zimnych" leadów)
- 📈 Wyższa konwersja (leady są lepiej przygotowane)
- 🤖 Automatyzacja nurturing (mniej ręcznej pracy)

---

**Status:** 📋 KONCEPCJA - DO DYSKUSJI I ROZWIĄZANIA PYTAN

