# ANALIZA SCENARIUSZY - SCENARIUSZ #7 ✅

## [→] SCENARIUSZ #7: OOO - Z kontaktami "jan.kowalski@firma.pl"

### **KONTEKST:**
- Lead A: `jan@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead A odpowiada: **"Jestem na urlopie do 15 stycznia. Pod moją nieobecność proszę pisać do jan.kowalski@firma.pl"**

### **PRZEPŁYW PRZEZ SYSTEM:**

**1. AI Agent - Klasyfikacja:**
```typescript
// AI zwraca:
{
  classification: "OOO",
  confidence: 0.95,
  extractedEmails: ["jan.kowalski@firma.pl"],
  extractedData: {
    intent: "out_of_office_with_contact",
    returnDate: "15 stycznia",
    contacts: [
      {
        email: "jan.kowalski@firma.pl",
        firstName: "Jan",
        lastName: "Kowalski"
      }
    ]
  }
}
```

**2. AI Agent - Logika akcji:**
```typescript
if (classification === "OOO" && extractedEmails.length > 0) {
  // Lead A zostaje bez zmian - kontynuuje normalnie
  lead.status = "AKTYWNY"; // BEZ ZMIANY
  lead.blockedCampaigns = []; // Może dostać wszystkie kampanie
  
  // Utwórz nowe leady z wysokim priorytetem
  for (const email of extractedEmails) {
    actions.push({
      type: "ADD_LEAD",
      priority: "HIGH",
      description: `Dodaj zastępcę z OOO: ${email}`,
      data: {
        email: email,
        cloneFromLeadId: lead.id,
        campaignId: campaignId,
        source: "OOO_RESPONSE",
        priority: 1 // WYSOKI PRIORYTET!
      }
    });
  }
}
```

**3. Baza danych - Aktualizacja:**
```sql
-- Lead A pozostaje bez zmian
-- Lead B zostaje utworzony z wysokim priorytetem
INSERT INTO Lead (
  email, status, originalLeadId, source, 
  company, companyCity, companyCountry, industry, greetingForm
) VALUES (
  'jan.kowalski@firma.pl', 'AKTYWNY', 123, 'OOO_RESPONSE',
  'Firma A', 'Warszawa', 'Polska', 'IT', 'Dzień dobry Panie Janie'
);

-- Dodaj do kampanii z wysokim priorytetem
INSERT INTO CampaignLead (
  campaignId, leadId, priority, addedAt
) VALUES (
  1, [newLeadId], 1, NOW() -- priority: 1 = WYSOKI PRIORYTET
);
```

### **REZULTAT:**
- **Lead A:** `AKTYWNY` → `AKTYWNY` (bez zmiany - kontynuuje normalnie)
- **Lead B:** Nowy lead `jan.kowalski@firma.pl` → `AKTYWNY` z `priority: 1`
- **Kampanie:** Lead B dostaje wszystkie emaile od początku z wysokim priorytetem
- **Powiązanie:** Lead B.originalLeadId = Lead A.id

### **STATUS: ✅ GOTOWY**
- Logika statusów: ✅ Poprawna
- Akcje: ✅ Zdefiniowane
- Baza danych: ✅ Zaktualizowana
- AI klasyfikacja: ⏳ Do pracy w następnym etapie

---

## [→] NASTĘPNE SCENARIUSZE DO ANALIZY:
- [x] Scenariusz #1: ZAINTERESOWANY - "Proszę o wycenę na usługi IT" ✅
- [x] Scenariusz #2: ZAINTERESOWANY - Nowy lead bez kampanii ✅
- [x] Scenariusz #3: NOT_INTERESTED - "Nie jestem zainteresowany" ✅
- [x] Scenariusz #4: MAYBE_LATER - "Dodaliśmy was do bazy" ✅
- [ ] Scenariusz #5: REDIRECT - Z emailem "zakupy@firma.pl" (do uporządkowania)
- [ ] Scenariusz #6: REDIRECT - Bez emaila "odezwą się" (do uporządkowania)
- [x] Scenariusz #7: OOO - Z kontaktami "jan.kowalski@firma.pl" ✅
- [ ] Scenariusz #8: OOO - Bez kontaktów "wrócę 16 stycznia"
- [ ] Scenariusz #9: UNSUBSCRIBE - "Usuńcie mnie z listy"
- [ ] Scenariusz #10: BOUNCE - "Delivery failed: User unknown"
