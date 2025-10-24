# ANALIZA SCENARIUSZY - SCENARIUSZ #4 ✅

## [→] SCENARIUSZ #4: MAYBE_LATER - "Dodaliśmy was do bazy"

### **KONTEKST:**
- Lead A: `jan@firma.pl` (status: `AKTYWNY`)
- Kampania: "Oferta IT" (ID: 1)
- Lead A odpowiada: **"Dziękuję za ofertę. Dodaliśmy was do naszej bazy i odezwiemy się jak będziemy potrzebować."**

### **PRZEPŁYW PRZEZ SYSTEM:**

**1. AI Agent - Klasyfikacja:**
```typescript
// AI zwraca:
{
  classification: "MAYBE_LATER",
  confidence: 0.90,
  extractedEmails: [],
  extractedData: {
    intent: "soft_refusal",
    timeline: "indefinite"
  }
}
```

**2. AI Agent - Logika akcji:**
```typescript
if (classification === "MAYBE_LATER") {
  lead.status = "CZEKAJ";
  lead.subStatus = "CZEKAJ_MAYBE";
  lead.blockedCampaigns = [campaignId]; // Zablokuj follow-upy z tej kampanii
  
  // Brak akcji - czeka na reaktywację ręczną
}
```

**3. Baza danych - Aktualizacja:**
```sql
UPDATE Lead SET 
  status = 'CZEKAJ',
  subStatus = 'CZEKAJ_MAYBE',
  blockedCampaigns = '[1]',
  updatedAt = NOW()
WHERE id = 123;
```

### **REZULTAT:**
- **Lead A:** `AKTYWNY` → `CZEKAJ` (CZEKAJ_MAYBE)
- **Kampania #1:** Lead A NIE dostanie follow-upów (blockedCampaigns: [1])
- **Nowe kampanie:** Lead A MOŻE dostać (blockedCampaigns nie zawiera nowych kampanii)
- **Akcja:** Brak - czeka na reaktywację ręczną

### **STATUS: ✅ GOTOWY**
- Logika statusów: ✅ Poprawna
- Akcje: ✅ Zdefiniowane (brak akcji)
- Baza danych: ✅ Zaktualizowana
- AI klasyfikacja: ⏳ Do pracy w następnym etapie

---

## [→] NASTĘPNE SCENARIUSZE DO ANALIZY:
- [x] Scenariusz #1: ZAINTERESOWANY - "Proszę o wycenę na usługi IT" ✅
- [x] Scenariusz #2: ZAINTERESOWANY - Nowy lead bez kampanii ✅
- [x] Scenariusz #3: NOT_INTERESTED - "Nie jestem zainteresowany" ✅
- [x] Scenariusz #4: MAYBE_LATER - "Dodaliśmy was do bazy" ✅
- [ ] Scenariusz #5: REDIRECT - Z emailem "zakupy@firma.pl"
- [ ] Scenariusz #6: REDIRECT - Bez emaila "odezwą się"
- [ ] Scenariusz #7: OOO - Z kontaktami "jan.kowalski@firma.pl"
- [ ] Scenariusz #8: OOO - Bez kontaktów "wrócę 16 stycznia"
- [ ] Scenariusz #9: UNSUBSCRIBE - "Usuńcie mnie z listy"
- [ ] Scenariusz #10: BOUNCE - "Delivery failed: User unknown"
