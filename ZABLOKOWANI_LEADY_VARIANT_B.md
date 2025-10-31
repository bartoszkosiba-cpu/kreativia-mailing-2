# ✅ WDROŻENIE VARIANT B - Zablokowani Leadzi

## 📋 CO ZOSTAŁO WDROŻONE:

### 1. ✅ Filtr przy dodawaniu leadów
**Plik:** `app/api/campaigns/[id]/leads/route.ts` (linia 177-188)

**Zmiana:**
- Dodano sprawdzanie statusu leadów przed dodaniem
- Blokuje leadów ze statusem `BLOCKED` lub `BLOKADA`
- Zwraca błąd 400 z listą zablokowanych leadów

**Rezultat:**
```
❌ Nie można dodać X zablokowanych leadów do kampanii.
   Ledy zostały odblokowane lub usunięte.
```

---

### 2. ✅ Automatyczne usuwanie z kampanii
**Plik:** `app/api/leads/[id]/status/route.ts` (linia 54-60)

**Zmiana:**
- Przy zmianie statusu na `BLOKADA` - automatycznie usuwa leada ze wszystkich kampanii
- Loguje liczbę usuniętych powiązań

**Rezultat:**
```
Lead ID:123 usunięty z 3 kampanii (status: BLOKADA)
```

---

## 🔍 JAK DZIAŁA TERAZ:

### Scenariusz 1: Próba dodania zablokowanego leada

**User:** Klika "Dodaj leadów" → wybiera zablokowanego

**System:**
1. GET leadów → filtruje zablokowanych (linia 77 w add-leads/page.tsx)
2. User nie widzi zablokowanych w liście

**Jeśli jednak API call:**
```typescript
POST /api/campaigns/8/leads
{ leadIds: [123] } // status: BLOCKED
```

**Odpowiedź:**
```json
{
  "error": "Nie można dodać 1 zablokowanych leadów do kampanii. Ledy zostały odblokowane lub usunięte.",
  "blockedLeads": [{
    "id": 123,
    "email": "zablokowany@example.pl",
    "status": "BLOCKED"
  }]
}
```

---

### Scenariusz 2: Lead zablokowany podczas kampanii

**User:** 
1. Dodaje leada do kampanii (AKTYWNY)
2. Kampania rusza
3. Lead dostaje mail i odpowiada: "NOT_INTERESTED"
4. AI zmienia status na BLOKADA

**System (inbox/processor.ts linia 340-343):**
```typescript
// Lead zablokowany przez odpowiedź
await db.lead.update({
  where: { id: currentLead.id },
  data: { status: "BLOCKED" }
});

// ✅ USUŃ ZE WSZYSTKICH KAMPANII
await db.campaignLead.deleteMany({
  where: { leadId: currentLead.id }
});
```

**Rezultat:**
- Lead usunięty z kampanii automatycznie
- Nie będzie więcej wysyłek do tego leada

---

### Scenariusz 3: Manualne zablokowanie leada

**User:** 
1. Otwiera leadówkę
2. Zmienia status na "BLOKADA"
3. Zapisuje

**System (status/route.ts linia 54-60):**
```typescript
if (status === 'BLOKADA') {
  // ✅ USUŃ ZE WSZYSTKICH KAMPANII
  const deletedCampaignLeads = await db.campaignLead.deleteMany({
    where: { leadId: leadId }
  });
  console.log(`Lead usunięty z ${deletedCampaignLeads.count} kampanii`);
}
```

**Rezultat:**
- Lead usunięty ze wszystkich kampanii
- Nie dostanie więcej maili

---

## ⚠️ CO JEST CHRONIONE:

### Przed wdrożeniem:
- ❌ Można było dodać zablokowanego leada (przez API)
- ❌ Zablokowany lead zostawał w kampanii
- ❌ Manualne zablokowanie nie usuwało z kampanii

### Po wdrożeniu:
- ✅ NIE można dodać zablokowanego (błąd 400)
- ✅ Automatyczne usuwanie przy AI (inbox/processor)
- ✅ Automatyczne usuwanie przy manualnym (status/route)
- ✅ Filtr w UI już był

---

## 🧪 TESTY:

### Test 1: Próba dodania zablokowanego przez UI
```
1. Otwórz kampanię
2. Kliknij "Dodaj leadów"
3. Wybierz tag
4. ❌ Zablokowany lead NIE będzie na liście (filtr linia 77)
```

### Test 2: Próba dodania przez API
```bash
POST /api/campaigns/8/leads
{ "leadIds": [123] } # status: BLOCKED

# Oczekiwane: 400 Bad Request
```

### Test 3: Zablokowanie leada w kampanii
```
1. Lead w kampanii → odeślej mail "nie jestem zainteresowany"
2. AI zmieni status na BLOKADA
3. ✅ Lead usunięty z kampanii automatycznie
```

### Test 4: Manualne zablokowanie
```
1. Zmień status leada na BLOKADA w UI
2. ✅ Lead usunięty z wszystkich kampanii
```

---

**Data wdrożenia:** 2025-10-26  
**Status:** ✅ Zaimplementowane, gotowe do testów



