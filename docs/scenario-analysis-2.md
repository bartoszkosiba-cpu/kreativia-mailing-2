# ANALIZA SCENARIUSZY - SCENARIUSZ #2 ✅

## [→] SCENARIUSZ #2: ZAINTERESOWANY - Nowy lead bez kampanii

### **KONTEKST:**
- Lead A: `nowy@firma.pl` (status: `AKTYWNY`)
- Kampania: **BRAK** (nowy mail z zewnątrz)
- Lead A odpowiada: **"Witam, słyszałem o waszych usługach od znajomego. Proszę o kontakt."**

### **PRZEPŁYW PRZEZ SYSTEM:**

**1. AI Agent - Klasyfikacja:**
```typescript
// AI zwraca:
{
  classification: "INTERESTED",
  confidence: 0.90,
  extractedEmails: [],
  extractedData: {
    intent: "new_lead_inquiry",
    source: "referral"
  }
}
```

**2. AI Agent - Logika akcji:**
```typescript
if (classification === "INTERESTED" && !campaignId) {
  lead.status = "ZAINTERESOWANY";
  lead.subStatus = "ZAINTERESOWANY_NEW";
  lead.blockedCampaigns = []; // Może dostać wszystkie kampanie
  
  actions.push({
    type: "FORWARD",
    priority: "HIGH",
    description: "Nowy lead - przejmij!",
    data: {
      leadId: 456,
      reason: "new_lead_inquiry",
      source: "referral"
    }
  });
}
```

**3. Baza danych - Aktualizacja:**
```sql
UPDATE Lead SET 
  status = 'ZAINTERESOWANY',
  subStatus = 'ZAINTERESOWANY_NEW',
  blockedCampaigns = '[]',
  updatedAt = NOW()
WHERE id = 456;
```

**4. Akcja - FORWARD do handlowca:**
```typescript
// System wysyła powiadomienie do handlowca:
{
  type: "HOT_LEAD",
  leadId: 456,
  leadEmail: "nowy@firma.pl",
  message: "Nowy lead - przejmij!",
  reason: "new_lead_inquiry",
  source: "referral",
  priority: "HIGH"
}
```

### **REZULTAT:**
- **Lead A:** `AKTYWNY` → `ZAINTERESOWANY` (ZAINTERESOWANY_NEW)
- **Kampanie:** Lead A MOŻE dostać wszystkie kampanie (blockedCampaigns: [])
- **Handlowiec:** Dostaje powiadomienie "Nowy lead - przejmij!"

### **RÓŻNICE WZGLĘDEM SCENARIUSZA #1:**
- **subStatus:** `ZAINTERESOWANY_CAMPAIGN` vs `ZAINTERESOWANY_NEW`
- **blockedCampaigns:** `[1]` vs `[]` (pusty)
- **reason:** `request_quote` vs `new_lead_inquiry`
- **source:** brak vs `referral`

### **STATUS: ✅ GOTOWY**
- Logika statusów: ✅ Poprawna
- Akcje: ✅ Zdefiniowane
- Baza danych: ✅ Zaktualizowana
- AI klasyfikacja: ⏳ Do pracy w następnym etapie

---

## [→] NASTĘPNE SCENARIUSZE DO ANALIZY:
- [x] Scenariusz #1: ZAINTERESOWANY - "Proszę o wycenę na usługi IT" ✅
- [x] Scenariusz #2: ZAINTERESOWANY - Nowy lead bez kampanii ✅
- [ ] Scenariusz #3: NOT_INTERESTED - "Nie jestem zainteresowany"
- [ ] Scenariusz #4: MAYBE_LATER - "Dodaliśmy was do bazy"
- [ ] Scenariusz #5: REDIRECT - Z emailem "zakupy@firma.pl"
- [ ] Scenariusz #6: REDIRECT - Bez emaila "odezwą się"
- [ ] Scenariusz #7: OOO - Z kontaktami "jan.kowalski@firma.pl"
- [ ] Scenariusz #8: OOO - Bez kontaktów "wrócę 16 stycznia"
- [ ] Scenariusz #9: UNSUBSCRIBE - "Usuńcie mnie z listy"
- [ ] Scenariusz #10: BOUNCE - "Delivery failed: User unknown"
