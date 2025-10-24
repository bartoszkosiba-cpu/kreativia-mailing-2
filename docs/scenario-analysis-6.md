# ANALIZA SCENARIUSZY - SCENARIUSZ #6 ✅

## [→] SCENARIUSZ #6: REDIRECT - Bez emaila "odezwą się"

### **KONTEKST:**
- Lead A: `jan@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead A odpowiada: **"Przekazuję państwa ofertę do odpowiedniego działu. Odezwą się do państwa."**

### **PRZEPŁYW PRZEZ SYSTEM:**

**1. AI Agent - Klasyfikacja:**
```typescript
// AI zwraca:
{
  classification: "REDIRECT",
  confidence: 0.90,
  extractedEmails: [], // BRAK EMAILA
  extractedData: {
    intent: "redirect_without_contact",
    promise: "they_will_contact"
  }
}
```

**2. AI Agent - Logika akcji:**
```typescript
if (classification === "REDIRECT" && extractedEmails.length === 0) {
  // Lead A czeka na kontakt
  lead.status = "CZEKAJ";
  lead.subStatus = "CZEKAJ_REDIRECT_AWAITING_CONTACT";
  lead.blockedCampaigns = [campaignId]; // Zablokuj follow-upy z tej kampanii
  
  // Wyślij AUTO_FOLLOWUP z prośbą o kontakt
  actions.push({
    type: "AUTO_FOLLOWUP",
    priority: "MEDIUM",
    description: "Wyślij follow-up z prośbą o kontakt",
    data: {
      leadId: lead.id,
      message: "Dziękujemy za przekazanie. Czy możemy prosić o kontakt do odpowiedniej osoby?",
      timeout: 7 // dni
    }
  });
}
```

**3. Baza danych - Aktualizacja:**
```sql
UPDATE Lead SET 
  status = 'CZEKAJ',
  subStatus = 'CZEKAJ_REDIRECT_AWAITING_CONTACT',
  blockedCampaigns = '[1]',
  updatedAt = NOW()
WHERE id = 123;
```

**4. AUTO_FOLLOWUP po 7 dniach:**
```typescript
// Jeśli Lead A odpowie z emailem:
if (response.extractedEmails.length > 0) {
  // Przejdź do scenariusza #5 (REDIRECT z emailem)
  // Utwórz nowe leady i zablokuj Lead A
}

// Jeśli Lead A nie odpowie:
if (timeout) {
  lead.status = "BLOKADA";
  lead.subStatus = "BLOKADA_REDIRECT_NO_RESPONSE";
  // Wyślij: "Dziękujemy, polecamy się"
}
```

### **REZULTAT:**
- **Lead A:** `AKTYWNY` → `CZEKAJ` (CZEKAJ_REDIRECT_AWAITING_CONTACT)
- **Kampania #1:** Lead A NIE dostanie follow-upów (blockedCampaigns: [1])
- **AUTO_FOLLOWUP:** "Czy możemy prosić o kontakt do odpowiedniej osoby?" (7 dni)
- **Timeout:** Jeśli nie odpowie → `BLOKADA` + "Dziękujemy, polecamy się"

### **STATUS: ✅ GOTOWY**
- Logika statusów: ✅ Poprawna
- Akcje: ✅ Zdefiniowane
- Baza danych: ✅ Zaktualizowana
- AI klasyfikacja: ⏳ Do pracy w następnym etapie
