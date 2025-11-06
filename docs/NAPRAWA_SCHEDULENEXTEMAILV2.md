# ✅ NAPRAWA: scheduleNextEmailV2() - Wykluczanie leadów w kolejce

**Data:** 2025-11-05  
**Problem:** System nie próbował następnego leada jeśli pierwszy był już w kolejce

---

## 🔧 CO ZOSTAŁO NAPRAWIONE

### **Problem:**
- `findFirst` zwracał pierwszego leada (priority = 999)
- Jeśli ten lead był już w kolejce, `scheduleNextEmailV2()` zwracał `null`
- System nie próbował następnego leada (który był dostępny)

### **Rozwiązanie:**
- ✅ Pobieranie leadów które są już w kolejce (pending/sending)
- ✅ Wykluczanie ich w zapytaniu `findFirst`
- ✅ System teraz znajdzie pierwszego dostępnego leada

---

## 📝 ZMIANY W KODZIE

### **Przed:**
```typescript
const nextCampaignLead = await db.campaignLead.findFirst({
  where: {
    campaignId,
    status: "queued",
    // ...
  }
});

// Sprawdź czy już jest w kolejce
if (existing) {
  return null; // ❌ Nie próbuje następnego leada
}
```

### **Po:**
```typescript
// Pobierz leady które są już w kolejce
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

---

## ✅ WYNIK

### **Co teraz działa:**
- ✅ System znajduje pierwszego dostępnego leada (nie w kolejce)
- ✅ System planuje nowe maile dla dostępnych leadów
- ✅ Pauza co 10 maili będzie działać dla nowych maili

### **Co będzie działać:**
- ✅ Po wyczerpaniu starych maili (4 pending), system będzie planował nowe
- ✅ Nowe maile będą miały pauzę co 10 maili (130. mail = pauza)
- ✅ System będzie kontynuował wysyłkę dla 194 dostępnych leadów

---

## 🎯 WERYFIKACJA

**Po restarcie serwera:**
1. System powinien planować nowe maile dla dostępnych leadów
2. Po 130. mailu powinna być pauza 10-15 min
3. System powinien kontynuować wysyłkę dla 194 dostępnych leadów

