# ANALIZA SCENARIUSZY - SCENARIUSZ #5 ✅

## [→] SCENARIUSZ #5: REDIRECT - Z emailem "zakupy@firma.pl"

### **KONTEKST:**
- Lead A: `jan@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead A odpowiada: **"Przekazuję państwa ofertę do działu zakupów. Proszę pisać na: zakupy@firma.pl"**

### **PRZEPŁYW PRZEZ SYSTEM:**

**1. AI Agent - Klasyfikacja:**
```typescript
// AI zwraca:
{
  classification: "REDIRECT",
  confidence: 0.95,
  extractedEmails: ["zakupy@firma.pl"],
  extractedData: {
    intent: "redirect_with_contact",
    department: "zakupy"
  }
}
```

**2. AI Agent - Logika akcji:**
```typescript
if (classification === "REDIRECT" && extractedEmails.length > 0) {
  // Lead A zostaje zablokowany - wykonał swoje zadanie
  lead.status = "BLOKADA";
  lead.subStatus = "BLOKADA_REDIRECT_COMPLETED";
  lead.blockedCampaigns = []; // Zablokuj wszystko
  
  // Utwórz nowe leady z wysokim priorytetem
  for (const email of extractedEmails) {
    actions.push({
      type: "ADD_LEAD",
      priority: "HIGH",
      description: `Dodaj nowy lead: ${email}`,
      data: {
        email: email,
        cloneFromLeadId: lead.id,
        campaignId: campaignId,
        source: "REDIRECT_RESPONSE",
        priority: 1 // WYSOKI PRIORYTET!
      }
    });
  }
  
  // Wyślij odpowiedź z podziękowaniem
  actions.push({
    type: "SEND_RESPONSE",
    priority: "MEDIUM",
    description: "Wyślij podziękowanie za przekazanie kontaktu",
    data: {
      leadId: lead.id,
      message: "Dziękujemy za przekazanie kontaktu"
    }
  });
}
```

**3. Baza danych - Aktualizacja:**
```sql
-- Lead A zostaje zablokowany
UPDATE Lead SET 
  status = 'BLOKADA',
  subStatus = 'BLOKADA_REDIRECT_COMPLETED',
  blockedCampaigns = '[]',
  updatedAt = NOW()
WHERE id = 123;

-- Lead B zostaje utworzony z wysokim priorytetem
INSERT INTO Lead (
  email, status, originalLeadId, source, 
  company, companyCity, companyCountry, industry, greetingForm
) VALUES (
  'zakupy@firma.pl', 'AKTYWNY', 123, 'REDIRECT_RESPONSE',
  'Firma A', 'Warszawa', 'Polska', 'IT', 'Dzień dobry'
);

-- Dodaj do kampanii z wysokim priorytetem
INSERT INTO CampaignLead (
  campaignId, leadId, priority, addedAt
) VALUES (
  1, [newLeadId], 1, NOW() -- priority: 1 = WYSOKI PRIORYTET
);
```

### **REZULTAT:**
- **Lead A:** `AKTYWNY` → `BLOKADA` (BLOKADA_REDIRECT_COMPLETED)
- **Lead B:** Nowy lead `zakupy@firma.pl` → `AKTYWNY` z `priority: 1`
- **Kampanie:** Lead B dostaje wszystkie emaile od początku z wysokim priorytetem
- **Powiązanie:** Lead B.originalLeadId = Lead A.id
- **Odpowiedź:** "Dziękujemy za przekazanie kontaktu"

### **STATUS: ✅ GOTOWY**
- Logika statusów: ✅ Poprawna
- Akcje: ✅ Zdefiniowane
- Baza danych: ✅ Zaktualizowana
- AI klasyfikacja: ⏳ Do pracy w następnym etapie
