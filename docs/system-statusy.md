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

### C) CZEKAJ (nowy status):
- **CZEKAJ_MAYBE** - "dodaliśmy do bazy, odezwiemy się"
- **CZEKAJ_REDIRECT** - "przekazałem do odpowiedniego działu"

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

## [→] STRUKTURA BAZY DANYCH

```sql
model Lead {
  // ... istniejące pola ...
  
  status            String    @default("AKTYWNY") // AKTYWNY, ZAINTERESOWANY, BLOKADA, CZEKAJ
  subStatus         String?   // ZAINTERESOWANY_CAMPAIGN, BLOKADA_REFUSAL, CZEKAJ_MAYBE, etc.
  blockedCampaigns  String?   // JSON array z ID kampanii [1,2,3]
  reactivatedAt     DateTime? // Kiedy został reaktywowany
  lastReactivation  String?   // Z jakiego statusu został reaktywowany
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

---

## [→] HISTORIA ZMIAN

### [2024-12-19] - Utworzenie dokumentacji
- Zdefiniowano 3 główne statusy: AKTYWNY, ZAINTERESOWANY, BLOKADA
- Dodano podstatusy dla szczegółowej logiki
- Określono workflow i logikę AI Agent
- Zdefiniowano strukturę bazy danych

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
