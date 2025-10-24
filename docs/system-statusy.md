# SYSTEM STATUSÓW - HOT LEAD GENERATOR

## [→] PRZEGLĄD SYSTEMU

**Cel:** Hot Lead Generator - generowanie zainteresowanych leadów, nie CRM
**Sukces:** Lead oznaczony jako "ZAINTERESOWANY" → handlowiec dostaje powiadomienie "przejmij go"

---

## [→] GŁÓWNE STATUSY (3)

### 1. **AKTYWNY** ✅
- **Opis:** Lead nic nie odpisał - od importu do pierwszej odpowiedzi
- **Kolor:** Zielony
- **Ikona:** ✅
- **Kampanie:** ✅ Wszystkie (początkowe + follow-upy)
- **Nowe kampanie:** ✅ TAK
- **Follow-upy:** ✅ TAK
- **Akcja:** Brak - normalna wysyłka

### 2. **ZAINTERESOWANY** 💚
- **Opis:** AI zaklasyfikowała jako zainteresowany (odpowiedź na kampanię lub nowy mail)
- **Kolor:** Ciemnozielony
- **Ikona:** 💚
- **Kampanie:** ❌ NIE (z tej kampanii)
- **Nowe kampanie:** ✅ TAK (inne oferty)
- **Follow-upy:** ❌ NIE (z tej kampanii)
- **Akcja:** 🔥 **FORWARD DO HANDLOWCA** - "Przejmij go!"

### 3. **BLOKADA** 🚫
- **Opis:** Odmowa, odbicie, unsubscribe - trwałe zablokowanie
- **Kolor:** Czerwony
- **Ikona:** 🚫
- **Kampanie:** ❌ NIE
- **Nowe kampanie:** ❌ NIE
- **Follow-upy:** ❌ NIE
- **Akcja:** Brak - całkowicie zablokowany

---

## [→] PODSTATUSY (dla szczegółowej logiki)

### A) ZAINTERESOWANY:
- **ZAINTERESOWANY_CAMPAIGN** - odpowiedź na kampanię
- **ZAINTERESOWANY_NEW** - nowy mail z zainteresowaniem
- **ZAINTERESOWANY_REACTIVATED** - reaktywowany z BLOKADA

### B) BLOKADA:
- **BLOKADA_REFUSAL** - odmowa ("nie jestem zainteresowany")
- **BLOKADA_BOUNCE** - odbicie emaila
- **BLOKADA_UNSUBSCRIBE** - prośba o wypisanie
- **BLOKADA_REDIRECT_COMPLETED** - przekazał kontakt i został zablokowany

### C) CZEKAJ (nowy status):
- **CZEKAJ_MAYBE** - "dodaliśmy do bazy, odezwiemy się"
- **CZEKAJ_REDIRECT_AWAITING_CONTACT** - "przekazałem do odpowiedniego działu" (czeka na kontakt)
- **CZEKAJ_OOO** - out of office (czeka na powrót)
- **CZEKAJ_OOO_WITH_CONTACTS** - OOO z przekazanymi kontaktami zastępczymi

---

## [→] WORKFLOW STATUSÓW

### 1. **NORMALNY CYKL:**
```
Import CSV → AKTYWNY → Kampania → Odpowiedź → NOWY STATUS
```

### 2. **ODPOWIEDZI AI AGENT:**
```
AKTYWNY → Kampania → "Nie jestem zainteresowany" → BLOKADA (BLOKADA_REFUSAL)
AKTYWNY → Kampania → "Proszę o wycenę" → ZAINTERESOWANY (ZAINTERESOWANY_CAMPAIGN)
AKTYWNY → Kampania → "Może w przyszłości" → CZEKAJ (CZEKAJ_MAYBE)
AKTYWNY → Kampania → "Przekazuję do działu X" → CZEKAJ (CZEKAJ_REDIRECT)
AKTYWNY → Kampania → "Wypisz mnie" → BLOKADA (BLOKADA_UNSUBSCRIBE)
AKTYWNY → Kampania → Email odbity → BLOKADA (BLOKADA_BOUNCE)
```

### 3. **NOWY MAIL (bez kampanii):**
```
Nowy mail → "Proszę o wycenę" → ZAINTERESOWANY (ZAINTERESOWANY_NEW)
```

### 4. **REAKTYWACJA:**
```
BLOKADA → Odpowiedź pozytywna → ZAINTERESOWANY (ZAINTERESOWANY_REACTIVATED)
```

### 5. **SCENARIUSZ OOO Z NOWYMI LEADAMI:**
```
Lead A (AKTYWNY) → Kampania → OOO: "Piszcie do jan.kowalski@firma.pl"
├── Lead A → CZEKAJ (CZEKAJ_OOO_WITH_CONTACTS) - kontynuuje follow-upy
└── Lead B (NOWY) → AKTYWNY - dostaje wszystkie emaile od początku kampanii
```

---

## [→] SZCZEGÓŁOWA LOGIKA AI AGENT

### A) ZAINTERESOWANY:
```typescript
// Z kampanii
if (classification === "INTERESTED" && campaignId) {
  lead.status = "ZAINTERESOWANY";
  lead.subStatus = "ZAINTERESOWANY_CAMPAIGN";
  lead.blockedCampaigns = [campaignId]; // Zablokuj follow-upy z tej kampanii
  forwardToSalesperson(lead, "Odpowiedź na kampanię - przejmij!");
}

// Nowy mail
if (classification === "INTERESTED" && !campaignId) {
  lead.status = "ZAINTERESOWANY";
  lead.subStatus = "ZAINTERESOWANY_NEW";
  lead.blockedCampaigns = []; // Może dostać wszystkie kampanie
  forwardToSalesperson(lead, "Nowy lead - przejmij!");
}
```

### B) CZEKAJ:
```typescript
// "Dodaliśmy do bazy"
if (classification === "MAYBE_LATER") {
  lead.status = "CZEKAJ";
  lead.subStatus = "CZEKAJ_MAYBE";
  lead.blockedCampaigns = [campaignId]; // Zablokuj follow-upy z tej kampanii
  // Brak akcji - czekamy
}

// "Przekazałem do działu"
if (classification === "REDIRECT" && extractedEmails.length === 0) {
  lead.status = "CZEKAJ";
  lead.subStatus = "CZEKAJ_REDIRECT";
  lead.blockedCampaigns = [campaignId]; // Zablokuj follow-upy z tej kampanii
  sendAutoFollowup(lead, "Czy mogę prosić o kontakt do odpowiedniego działu?");
  // Timeout 7 dni → BLOKADA
}
```

### C) BLOKADA:
```typescript
// Odmowa
if (classification === "NOT_INTERESTED") {
  lead.status = "BLOKADA";
  lead.subStatus = "BLOKADA_REFUSAL";
  lead.blockedCampaigns = []; // Zablokuj wszystko
  // Brak akcji - trwale zablokowany
}

// Odbicie
if (classification === "BOUNCE") {
  lead.status = "BLOKADA";
  lead.subStatus = "BLOKADA_BOUNCE";
  lead.blockedCampaigns = []; // Zablokuj wszystko
  // Brak akcji - trwale zablokowany
}
```

### D) CZEKAJ - OOO Z NOWYMI LEADAMI:
```typescript
// OOO z kontaktami zastępczymi
if (classification === "OOO" && extractedEmails.length > 0) {
  // Lead A → CZEKAJ (kontynuuje follow-upy)
  lead.status = "CZEKAJ";
  lead.subStatus = "CZEKAJ_OOO_WITH_CONTACTS";
  lead.blockedCampaigns = [campaignId]; // Zablokuj follow-upy z tej kampanii
  
  // Utwórz nowe leady (Lead B, C, D...)
  for (const email of extractedEmails) {
    await createDerivativeLead({
      originalLeadId: lead.id,
      email: email,
      source: "OOO_RESPONSE",
      status: "AKTYWNY",
      // Skopiuj dane z oryginalnego leada
      company: lead.company,
      companyCity: lead.companyCity,
      companyCountry: lead.companyCountry,
      industry: lead.industry,
      // Wygeneruj nowe powitanie
      greetingForm: await generateGreeting(email, lead.language)
    });
  }
}

// OOO bez kontaktów - standardowa logika
if (classification === "OOO" && extractedEmails.length === 0) {
  lead.status = "CZEKAJ";
  lead.subStatus = "CZEKAJ_OOO";
  // Brak akcji - czekamy na powrót
}
```

---

## [→] LOGIKA WYSYŁKI

```typescript
const canSendCampaign = (lead, campaignId) => {
  // BLOKADA - nigdy
  if (lead.status === "BLOKADA") return false;
  
  // AKTYWNY - zawsze
  if (lead.status === "AKTYWNY") return true;
  
  // ZAINTERESOWANY - tylko nowe kampanie
  if (lead.status === "ZAINTERESOWANY") {
    return !lead.blockedCampaigns.includes(campaignId);
  }
  
  // CZEKAJ - tylko nowe kampanie
  if (lead.status === "CZEKAJ") {
    return !lead.blockedCampaigns.includes(campaignId);
  }
  
  return false;
};
```

---

## [→] FUNKCJA TWORZENIA LEADÓW POCHODNYCH

```typescript
async function createDerivativeLead({
  originalLeadId,
  email,
  source,
  status,
  company,
  companyCity,
  companyCountry,
  industry,
  greetingForm
}) {
  // Sprawdź czy lead już istnieje
  const existingLead = await db.lead.findUnique({
    where: { email }
  });
  
  if (existingLead) {
    // Aktualizuj istniejący lead
    return await db.lead.update({
      where: { id: existingLead.id },
      data: {
        status: "AKTYWNY",
        originalLeadId,
        source,
        company: company || existingLead.company,
        companyCity: companyCity || existingLead.companyCity,
        companyCountry: companyCountry || existingLead.companyCountry,
        industry: industry || existingLead.industry,
        greetingForm: greetingForm || existingLead.greetingForm
      }
    });
  }
  
  // Utwórz nowy lead
  const newLead = await db.lead.create({
    data: {
      email,
      status,
      originalLeadId,
      source,
      company,
      companyCity,
      companyCountry,
      industry,
      greetingForm,
      language: "pl" // Domyślny język
    }
  });
  
  // Dodaj do kampanii z wysokim priorytetem
  await db.campaignLead.create({
    data: {
      campaignId: originalCampaignId,
      leadId: newLead.id,
      priority: 1, // Wysoki priorytet - wyślij jako pierwszy!
      addedAt: new Date()
    }
  });
  
  // Natychmiastowa wysyłka pierwszego emaila
  if (!campaign.scheduledAt) {
    await sendCampaignEmail(newLead, campaign, "IMMEDIATE");
  }
  
  return newLead;
}
```

---

## [→] STRUKTURA BAZY DANYCH

```sql
model Lead {
  // ... istniejące pola ...
  
  // STATUSY I LOGIKA:
  status            String    @default("AKTYWNY") // AKTYWNY, ZAINTERESOWANY, BLOKADA, CZEKAJ
  subStatus         String?   // ZAINTERESOWANY_CAMPAIGN, BLOKADA_REFUSAL, CZEKAJ_MAYBE, etc.
  blockedCampaigns  String?   // JSON array z ID kampanii [1,2,3]
  reactivatedAt     DateTime? // Kiedy został reaktywowany
  lastReactivation  String?   // Z jakiego statusu został reaktywowany
  
  // POWIĄZANIA I ŹRÓDŁA:
  originalLeadId    Int?      // ID leada który "stworzył" tego leada (OOO, REDIRECT)
  originalLead      Lead?     @relation("LeadDerivatives", fields: [originalLeadId], references: [id])
  derivativeLeads   Lead[]    @relation("LeadDerivatives")
  source            String?   // "CSV_IMPORT", "OOO_RESPONSE", "REDIRECT_RESPONSE", "UNATTACHED"
  sourceDetails     String?   // JSON z dodatkowymi informacjami
}
```

---

## [→] INTERFEJS UŻYTKOWNIKA

### A) Kolory i ikony:
- **AKTYWNY** - Zielony ✅
- **ZAINTERESOWANY** - Ciemnozielony 💚
- **BLOKADA** - Czerwony 🚫
- **CZEKAJ** - Żółty ⏳

### B) Akcje:
- **ZAINTERESOWANY** - "Przejmij leada" (forward do handlowca)
- **CZEKAJ** - "Wyślij follow-up" (dla CZEKAJ_REDIRECT)
- **BLOKADA** - "Reaktywuj" (zmiana na AKTYWNY)

### C) OOO - Powiązania leadów:
- **Lead A (CZEKAJ_OOO_WITH_CONTACTS)** - pokaż utworzone leady pochodne
- **Lead B (AKTYWNY)** - pokaż z jakiego OOO pochodzi

---

## [→] HISTORIA ZMIAN

### [2024-12-19] - Utworzenie dokumentacji
- Zdefiniowano 3 główne statusy: AKTYWNY, ZAINTERESOWANY, BLOKADA
- Dodano podstatusy dla szczegółowej logiki
- Określono workflow i logikę AI Agent
- Zdefiniowano strukturę bazy danych

### [2024-12-19] - Scenariusz OOO z nowymi leadami
- Dodano podstatus: `CZEKAJ_OOO_WITH_CONTACTS`
- Utworzono funkcję `createDerivativeLead()` dla leadów pochodnych
- Dodano powiązania: `originalLeadId` i `derivativeLeads`
- Zdefiniowano logikę: Lead A → CZEKAJ, Lead B → AKTYWNY (wszystkie emaile od początku)
- Dodano nowe pola w bazie: `source`, `sourceDetails`

---

## [→] PLAN WDROŻENIA

**Szczegółowy plan implementacji:** [docs/plan-wdrozenia-statusow.md](./plan-wdrozenia-statusow.md)

### FAZY WDROŻENIA:
1. **FAZA 1:** Przygotowanie bazy danych (DZIEŃ 1)
2. **FAZA 2:** Aktualizacja AI Agent (DZIEŃ 2)
3. **FAZA 3:** Logika wysyłki kampanii (DZIEŃ 3)
4. **FAZA 4:** Interfejs użytkownika (DZIEŃ 4)
5. **FAZA 5:** System AUTO_FOLLOWUP (DZIEŃ 5)
6. **FAZA 6:** Testy i walidacja (DZIEŃ 6)
7. **FAZA 7:** Wdrożenie i monitoring (DZIEŃ 7)

### KRYTERIA SUKCESU:
- [ ] Wszystkie statusy działają zgodnie z dokumentacją
- [ ] AI Agent poprawnie klasyfikuje i podejmuje akcje
- [ ] System wysyłki respektuje nowe reguły
- [ ] UI wyświetla statusy i pozwala na zarządzanie
- [ ] 0 błędów TypeScript, wszystkie testy przechodzą
- [ ] Handlowcy otrzymują powiadomienia o ZAINTERESOWANY

### UWAGI:
- System skupia się na generowaniu zainteresowanych leadów
- Kluczowe: forward do handlowca dla ZAINTERESOWANY
- Ważne: blokowanie follow-upów z tej samej kampanii
- Reaktywacja: zablokowany lead może się odmyślić
