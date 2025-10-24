# ANALIZA SCENARIUSZY - SCENARIUSZ #9 ✅

## [→] SCENARIUSZ #9: UNSUBSCRIBE - "Usuńcie mnie z listy"

### **KONTEKST:**
- Lead A: `jan@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead A odpowiada: **"Proszę usunąć mnie z listy mailingowej. Nie chcę otrzymywać więcej maili."**

### **PRZEPŁYW PRZEZ SYSTEM:**

**1. AI Agent - Klasyfikacja:**
```typescript
// AI zwraca:
{
  classification: "UNSUBSCRIBE",
  confidence: 0.95,
  extractedEmails: [],
  extractedData: {
    intent: "unsubscribe_request",
    request: "remove_from_list"
  }
}
```

**2. AI Agent - Logika akcji:**
```typescript
if (classification === "UNSUBSCRIBE") {
  lead.status = "BLOKADA";
  lead.subStatus = "BLOKADA_UNSUBSCRIBE";
  lead.blockedCampaigns = []; // Zablokuj wszystko
  
  // Brak akcji - trwale zablokowany
}
```

**3. Baza danych - Aktualizacja:**
```sql
UPDATE Lead SET 
  status = 'BLOKADA',
  subStatus = 'BLOKADA_UNSUBSCRIBE',
  blockedCampaigns = '[]',
  updatedAt = NOW()
WHERE id = 123;
```

### **REZULTAT:**
- **Lead A:** `AKTYWNY` → `BLOKADA` (BLOKADA_UNSUBSCRIBE)
- **Kampanie:** Lead A NIE dostanie żadnych kampanii (blockedCampaigns: [])
- **Akcja:** Brak - trwale zablokowany

---

## [→] SCENARIUSZ REAKTYWACJI Z BLOKADA

### **KONTEKST REAKTYWACJI:**
- Lead A: `jan@firma.pl` (status: `BLOKADA` - BLOKADA_UNSUBSCRIBE)
- Lead A pisze: **"Przepraszam za wcześniejszą odmowę. Teraz jesteśmy zainteresowani współpracą."**

### **PRZEPŁYW PRZEZ SYSTEM REAKTYWACJI:**

**1. AI Agent - Klasyfikacja:**
```typescript
// AI zwraca:
{
  classification: "INTERESTED",
  confidence: 0.90,
  extractedEmails: [],
  extractedData: {
    intent: "reactivation_interest",
    previousStatus: "BLOKADA_UNSUBSCRIBE"
  }
}
```

**2. AI Agent - Logika reaktywacji:**
```typescript
if (classification === "INTERESTED" && lead.status === "BLOKADA") {
  // Reaktywuj leada
  lead.status = "ZAINTERESOWANY";
  lead.subStatus = "ZAINTERESOWANY_REACTIVATED";
  lead.blockedCampaigns = []; // Może dostać wszystkie kampanie
  lead.reactivatedAt = new Date();
  lead.lastReactivation = "BLOKADA_UNSUBSCRIBE";
  
  actions.push({
    type: "FORWARD",
    priority: "HIGH",
    description: "Lead reaktywowany - przejmij!",
    data: {
      leadId: lead.id,
      reason: "reactivation_interest",
      previousStatus: "BLOKADA_UNSUBSCRIBE"
    }
  });
}
```

**3. Baza danych - Aktualizacja reaktywacji:**
```sql
UPDATE Lead SET 
  status = 'ZAINTERESOWANY',
  subStatus = 'ZAINTERESOWANY_REACTIVATED',
  blockedCampaigns = '[]',
  reactivatedAt = NOW(),
  lastReactivation = 'BLOKADA_UNSUBSCRIBE',
  updatedAt = NOW()
WHERE id = 123;
```

### **REZULTAT REAKTYWACJI:**
- **Lead A:** `BLOKADA` → `ZAINTERESOWANY` (ZAINTERESOWANY_REACTIVATED)
- **Kampanie:** Lead A MOŻE dostać wszystkie kampanie
- **Handlowiec:** Dostaje powiadomienie "Lead reaktywowany - przejmij!"

### **STATUS: ✅ GOTOWY**
- Logika statusów: ✅ Poprawna
- Akcje: ✅ Zdefiniowane
- Baza danych: ✅ Zaktualizowana
- Reaktywacja: ✅ Zdefiniowana
- AI klasyfikacja: ⏳ Do pracy w następnym etapie

---

## [→] NASTĘPNE SCENARIUSZE DO ANALIZY:
- [x] Scenariusz #1: ZAINTERESOWANY - "Proszę o wycenę na usługi IT" ✅
- [x] Scenariusz #2: ZAINTERESOWANY - Nowy lead bez kampanii ✅
- [x] Scenariusz #3: NOT_INTERESTED - "Nie jestem zainteresowany" ✅
- [x] Scenariusz #4: MAYBE_LATER - "Dodaliśmy was do bazy" ✅
- [x] Scenariusz #5: REDIRECT - Z emailem "zakupy@firma.pl" ✅
- [x] Scenariusz #6: REDIRECT - Bez emaila "odezwą się" ✅
- [x] Scenariusz #7: OOO - Z kontaktami "jan.kowalski@firma.pl" ✅
- [x] Scenariusz #8: OOO - Bez kontaktów "wrócę 16 stycznia" ✅
- [x] Scenariusz #9: UNSUBSCRIBE - "Usuńcie mnie z listy" ✅
- [ ] Scenariusz #10: BOUNCE - "Delivery failed: User unknown"
