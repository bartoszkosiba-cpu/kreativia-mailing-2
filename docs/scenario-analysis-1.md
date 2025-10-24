# ANALIZA SCENARIUSZY - SCENARIUSZ #1 ✅

## [→] SCENARIUSZ #1: ZAINTERESOWANY - "Proszę o wycenę na usługi IT"

### **KONTEKST:**
- Lead A: `jan@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead A dostał Email #1 z kampanii
- Lead A odpowiada: **"Proszę o wycenę na usługi IT. Jesteśmy zainteresowani współpracą."**

### **PRZEPŁYW PRZEZ SYSTEM:**

**1. AI Agent - Klasyfikacja:**
```typescript
// AI zwraca:
{
  classification: "INTERESTED",
  confidence: 0.95,
  extractedEmails: [],
  extractedData: {
    intent: "request_quote",
    urgency: "medium"
  }
}
```

**2. AI Agent - Logika akcji:**
```typescript
if (classification === "INTERESTED" && campaignId) {
  lead.status = "ZAINTERESOWANY";
  lead.subStatus = "ZAINTERESOWANY_CAMPAIGN";
  lead.blockedCampaigns = [campaignId]; // [1]
  
  actions.push({
    type: "FORWARD",
    priority: "HIGH",
    description: "Odpowiedź na kampanię - przejmij!",
    data: {
      leadId: 123,
      campaignId: 1,
      reason: "request_quote"
    }
  });
}
```

**3. Baza danych - Aktualizacja:**
```sql
UPDATE Lead SET 
  status = 'ZAINTERESOWANY',
  subStatus = 'ZAINTERESOWANY_CAMPAIGN',
  blockedCampaigns = '[1]',
  updatedAt = NOW()
WHERE id = 123;
```

**4. Akcja - FORWARD do handlowca:**
```typescript
// System wysyła powiadomienie do handlowca:
{
  type: "HOT_LEAD",
  leadId: 123,
  leadEmail: "jan@firma.pl",
  campaignId: 1,
  message: "Odpowiedź na kampanię - przejmij!",
  reason: "request_quote",
  priority: "HIGH"
}
```

### **REZULTAT:**
- **Lead A:** `AKTYWNY` → `ZAINTERESOWANY` (ZAINTERESOWANY_CAMPAIGN)
- **Kampania #1:** Lead A NIE dostanie follow-upów (blockedCampaigns: [1])
- **Nowe kampanie:** Lead A MOŻE dostać (blockedCampaigns nie zawiera nowych kampanii)
- **Handlowiec:** Dostaje powiadomienie "Przejmij leada!"

### **STATUS: ✅ GOTOWY**
- Logika statusów: ✅ Poprawna
- Akcje: ✅ Zdefiniowane
- Baza danych: ✅ Zaktualizowana
- AI klasyfikacja: ⏳ Do pracy w następnym etapie

---

## [→] NASTĘPNE SCENARIUSZE DO ANALIZY:
- [ ] Scenariusz #2: ZAINTERESOWANY - Nowy lead bez kampanii
- [ ] Scenariusz #3: NOT_INTERESTED - "Nie jestem zainteresowany"
- [ ] Scenariusz #4: MAYBE_LATER - "Dodaliśmy was do bazy"
- [ ] Scenariusz #5: REDIRECT - Z emailem "zakupy@firma.pl"
- [ ] Scenariusz #6: REDIRECT - Bez emaila "odezwą się"
- [ ] Scenariusz #7: OOO - Z kontaktami "jan.kowalski@firma.pl"
- [ ] Scenariusz #8: OOO - Bez kontaktów "wrócę 16 stycznia"
- [ ] Scenariusz #9: UNSUBSCRIBE - "Usuńcie mnie z listy"
- [ ] Scenariusz #10: BOUNCE - "Delivery failed: User unknown"
