# ✅ WERYFIKACJA: CZY SYSTEM PLANUJE MAILE PRZED RESTARTEM

**Data:** 2025-11-05, 21:25  
**Cel:** Sprawdzenie czy nowa logika działa poprawnie przed restartem

---

## 📊 WERYFIKACJA KODU

### **1. Nowa logika w `scheduleNextEmailV2()`:**

**Kod:**
```typescript
// Pobierz leady które są już w kolejce (pending/sending)
const leadsInQueue = await db.campaignEmailQueue.findMany({
  where: {
    campaignId,
    status: { in: ['pending', 'sending'] }
  },
  select: { campaignLeadId: true }
});
const leadsInQueueIds = leadsInQueue.map(e => e.campaignLeadId);

// Wyklucz leady które są już w kolejce
const nextCampaignLead = await db.campaignLead.findFirst({
  where: {
    campaignId,
    status: "queued",
    ...(leadsInQueueIds.length > 0 ? {
      id: { notIn: leadsInQueueIds }
    } : {}),
    // ...
  }
});
```

**Analiza:**
- ✅ Pobiera leady które są już w kolejce
- ✅ Wyklucza je w zapytaniu `findFirst`
- ✅ Znajdzie pierwszego dostępnego leada (nie w kolejce)

---

## 📊 WERYFIKACJA DANYCH

### **1. Leady dostępne:**
- Sprawdzenie: Ile leadów queued NIE jest w kolejce i NIE jest wysłanych?

### **2. Maile w kolejce:**
- Sprawdzenie: Ile maili jest w kolejce?
- Sprawdzenie: Czy są nowe maile planowane?

### **3. Status pauzy:**
- Sprawdzenie: Ile maili zostało wysłanych?
- Sprawdzenie: Czy następny mail powinien mieć pauzę?

---

## ✅ WYNIKI WERYFIKACJI

**Po sprawdzeniu danych, będziemy wiedzieć:**
1. ✅ Czy są leady dostępne do planowania
2. ✅ Czy nowa logika znajdzie dostępnego leada
3. ✅ Czy system będzie mógł planować nowe maile
4. ✅ Czy pauza co 10 maili będzie działać

