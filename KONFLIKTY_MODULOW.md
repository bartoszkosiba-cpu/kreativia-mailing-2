# 🚨 KONFLIKTY MODUŁÓW - ANALIZA I NAPRAWY

**Data:** 2025-11-02  
**Status:** ❌ KRYTYCZNE PROBLEMY WYKRYTE

---

## ❌ PROBLEM 1: `blockedCampaigns` NIE JEST ZAPISYWANY

### Lokalizacja:
- `src/services/emailAgentAI.ts:468-528` - funkcja `updateLeadStatus`
- `src/services/materialResponseSender.ts:162-174` - ustawianie statusu

### Problem:
Gdy lead odpowiada **INTERESTED** z prośbą o materiały:
1. Email Agent AI ustawia `shouldBlockCampaigns: [campaignId]` w analizie
2. **ALE `updateLeadStatus` NIE zapisuje tego do `blockedCampaigns` w bazie!**
3. Lead może dostać follow-up z tej samej kampanii ❌

### Wpływ:
- Lead który dostał automatyczną odpowiedź z materiałami **MOŻE dostać follow-up z tej samej kampanii**
- Narusza regułę: "Lead INTERESTED nie dostaje follow-upów z tej samej kampanii"

---

## ❌ PROBLEM 2: Follow-up Manager NIE SPRAWDZA `blockedCampaigns`

### Lokalizacja:
- `app/api/campaigns/[id]/follow-up/route.ts:104-128`

### Problem:
Funkcja filtruje leadów tylko na podstawie:
- `lead.isBlocked` (zablokowani)
- `leadReply.classification` (tylko OOO lub brak odpowiedzi)

**ALE NIE sprawdza:**
- `lead.blockedCampaigns` - czy lead ma zablokowaną tę kampanię
- `lead.status === 'ZAINTERESOWANY'` - czy lead jest zainteresowany

### Wpływ:
- Lead ZAINTERESOWANY MOŻE być dodany do follow-upu z tej samej kampanii ❌
- Nawet jeśli odpowiedział INTERESTED!

---

## ❌ PROBLEM 3: Material Response Sender NIE ZAPISUJE `blockedCampaigns`

### Lokalizacja:
- `src/services/materialResponseSender.ts:162-174`

### Problem:
Gdy `scheduleMaterialResponse` aktualizuje status leada na `ZAINTERESOWANY`:
- Ustawia `status: 'ZAINTERESOWANY'`
- Ustawia `subStatus: 'ZAINTERESOWANY_CAMPAIGN'`
- **ALE NIE zapisuje `blockedCampaigns: [campaignId]`**

### Wpływ:
- Lead który dostał automatyczną odpowiedź MOŻE dostać follow-up ❌

---

## ✅ ROZWIĄZANIA

### Naprawa 1: Zapisz `blockedCampaigns` w `emailAgentAI.ts`

```typescript
// src/services/emailAgentAI.ts
private static async updateLeadStatus(
  leadId: number, 
  status: LeadStatus, 
  subStatus?: LeadSubStatus,
  campaignId?: number | null,
  shouldBlockCampaigns?: number[] // ✅ NOWY PARAMETR
): Promise<void> {
  // ... existing code ...
  
  // ✅ Pobierz aktualne blockedCampaigns
  const currentLead = await db.lead.findUnique({
    where: { id: leadId },
    select: { blockedCampaigns: true }
  });
  
  // ✅ Połącz nowe z istniejącymi (unikaj duplikatów)
  let blockedCampaignsArray: number[] = [];
  if (currentLead?.blockedCampaigns) {
    try {
      blockedCampaignsArray = JSON.parse(currentLead.blockedCampaigns);
    } catch (e) {
      blockedCampaignsArray = [];
    }
  }
  
  if (shouldBlockCampaigns && shouldBlockCampaigns.length > 0) {
    blockedCampaignsArray = [...new Set([...blockedCampaignsArray, ...shouldBlockCampaigns])];
  }
  
  await db.lead.update({
    where: { id: leadId },
    data: {
      status,
      subStatus,
      blockedCampaigns: blockedCampaignsArray.length > 0 
        ? JSON.stringify(blockedCampaignsArray) 
        : null, // ✅ ZAPISZ blockedCampaigns
      // ... rest of data ...
    }
  });
  
  // ... rest of code ...
}
```

### Naprawa 2: Przekaż `shouldBlockCampaigns` do `updateLeadStatus`

```typescript
// src/services/emailAgentAI.ts
case 'FORWARD':
  await this.updateLeadStatus(
    reply.lead.id, 
    analysis.leadStatus, 
    analysis.leadSubStatus, 
    reply.campaignId,
    analysis.shouldBlockCampaigns // ✅ PRZEKAŻ blockedCampaigns
  );
  break;
```

### Naprawa 3: Zapisz `blockedCampaigns` w `materialResponseSender.ts`

```typescript
// src/services/materialResponseSender.ts
await db.lead.update({
  where: { id: reply.lead.id },
  data: {
    status: 'ZAINTERESOWANY',
    subStatus: 'ZAINTERESOWANY_CAMPAIGN',
    blockedCampaigns: reply.campaignId 
      ? JSON.stringify([reply.campaignId]) 
      : null, // ✅ ZAPISZ blockedCampaigns
    // ... rest of data ...
  }
});
```

### Naprawa 4: Sprawdź `blockedCampaigns` w Follow-up Manager

```typescript
// app/api/campaigns/[id]/follow-up/route.ts
const leadsForFollowUp = allLeads.filter(lead => {
  // Pomijaj zablokowanych
  if (lead.isBlocked || lead.status === 'BLOKADA') {
    return false;
  }
  
  // ✅ NOWE: Pomijaj ZAINTERESOWANY z tej kampanii
  if (lead.status === 'ZAINTERESOWANY') {
    // Sprawdź czy kampania jest zablokowana
    let blockedCampaignsArray: number[] = [];
    if (lead.blockedCampaigns) {
      try {
        blockedCampaignsArray = JSON.parse(lead.blockedCampaigns);
      } catch (e) {
        blockedCampaignsArray = [];
      }
    }
    
    if (blockedCampaignsArray.includes(campaignId)) {
      console.log(`[FOLLOW-UP] Pomijam ${lead.email} - kampania zablokowana (ZAINTERESOWANY)`);
      return false;
    }
  }
  
  // ... rest of logic ...
});
```

---

## 📊 WPŁYW NA PRODUKCJĘ

### Ryzyko:
- ⚠️ **ŚREDNIE-WYSOKIE**: Lead który dostał automatyczną odpowiedź MOŻE dostać follow-up z tej samej kampanii
- To może być mylące dla leada (dostaje 2 emaile zamiast 1)
- Nie wpływa na działanie systemu, ale na user experience

### Priorytet naprawy:
- **WYSOKI** - należy naprawić przed pierwszą kampanią

---

## ✅ CHECKLIST NAPRAW

- [x] Naprawa 1: `updateLeadStatus` zapisuje `blockedCampaigns` ✅
- [x] Naprawa 2: Przekazanie `shouldBlockCampaigns` do `updateLeadStatus` ✅
- [x] Naprawa 3: `materialResponseSender` zapisuje `blockedCampaigns` ✅
- [x] Naprawa 4: Follow-up manager sprawdza `blockedCampaigns` ✅
- [ ] Test: Lead INTERESTED nie dostaje follow-upu z tej samej kampanii (wymaga testowania)

---

**Status:** ✅ **NAPRAWIONE - GOTOWE DO TESTOWANIA**

