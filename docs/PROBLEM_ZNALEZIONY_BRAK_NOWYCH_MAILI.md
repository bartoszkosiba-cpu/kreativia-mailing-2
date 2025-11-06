# ❌ PROBLEM ZNALEZIONY: DLACZEGO BRAK NOWYCH MAILI

**Data:** 2025-11-05, 21:20  
**Status:** Problem znaleziony!

---

## 🔍 PROBLEM

### **1. Leady queued:**

**Faktyczne:**
- ✅ **198 leadów** w statusie `queued`
- ✅ **194 leady** są dostępne (nie w kolejce, nie wysłane)
- ✅ **4 leady** są w kolejce (stare maile pending)

**Kolejność leadów:**
- `findFirst` zwraca leady w kolejności `priority ASC`
- **Pierwsze 4 leady** (priority = 999) **są już w kolejce**!
- `scheduleNextEmailV2()` zwraca `null` dla pierwszego leada (bo jest w kolejce)
- System **nie próbuje następnego leada**!

---

## ❌ PRZYCZYNA

### **Problem w `scheduleNextEmailV2()`:**

**Kod:**
```typescript
const nextCampaignLead = await db.campaignLead.findFirst({
  where: {
    campaignId,
    status: "queued",
    // ...
  },
  orderBy: {
    priority: "asc"
  }
});

if (!nextCampaignLead) {
  return null; // ❌ Brak leadów
}

// Sprawdź czy już jest w kolejce
const existing = await db.campaignEmailQueue.findFirst({
  where: {
    campaignId,
    campaignLeadId: nextCampaignLead.id,
    status: { in: ['pending', 'sending'] }
  }
});

if (existing) {
  return null; // ❌ Lead już w kolejce - NIE PRÓBUJE NASTĘPNEGO!
}
```

**Problem:**
- `findFirst` zwraca pierwszego leada (priority = 999)
- Ten lead już jest w kolejce (4 stare maile pending)
- `scheduleNextEmailV2()` zwraca `null`
- System **nie próbuje następnego leada** (który jest dostępny!)

---

## ✅ ROZWIĄZANIE

### **Opcja 1: Rekurencyjne próbowanie leadów**

**Zmienić logikę:**
```typescript
// Próbuj leadów aż znajdziesz dostępnego
let nextCampaignLead = null;
let attempts = 0;
const maxAttempts = 10; // Maksymalna liczba prób

while (!nextCampaignLead && attempts < maxAttempts) {
  const lead = await db.campaignLead.findFirst({
    where: {
      campaignId,
      status: "queued",
      // ...
    },
    orderBy: {
      priority: "asc"
    },
    skip: attempts // Pomijaj już sprawdzone leady
  });

  if (!lead) break;

  // Sprawdź czy jest dostępny
  const existing = await db.campaignEmailQueue.findFirst({
    where: {
      campaignId,
      campaignLeadId: lead.id,
      status: { in: ['pending', 'sending'] }
    }
  });

  if (!existing) {
    nextCampaignLead = lead; // ✅ Znaleziono dostępnego leada
    break;
  }

  attempts++;
}
```

### **Opcja 2: Filtrowanie leadów w zapytaniu**

**Zmienić zapytanie:**
```typescript
// Pobierz leady które NIE są w kolejce
const nextCampaignLead = await db.campaignLead.findFirst({
  where: {
    campaignId,
    status: "queued",
    NOT: {
      // Wyklucz leady które są w kolejce
      id: {
        in: await db.campaignEmailQueue.findMany({
          where: {
            campaignId,
            status: { in: ['pending', 'sending'] }
          },
          select: { campaignLeadId: true }
        }).then(emails => emails.map(e => e.campaignLeadId))
      }
    }
    // ...
  },
  orderBy: {
    priority: "asc"
  }
});
```

---

## 📋 WNIOSEK

### **Problem:**
- ❌ **`scheduleNextEmailV2()` zwraca `null`** dla pierwszego leada (bo jest w kolejce)
- ❌ **System nie próbuje następnego leada** (który jest dostępny!)
- ❌ **194 leady są dostępne**, ale system ich nie używa

### **Rozwiązanie:**
- ✅ **Zmienić logikę** aby próbować następnego leada jeśli pierwszy jest w kolejce
- ✅ **Lub filtrować leady** w zapytaniu (wykluczyć te które są w kolejce)

### **Co naprawić:**
- 🔧 **Dodać rekurencyjne próbowanie leadów** w `scheduleNextEmailV2()`
- 🔧 **Lub zmienić zapytanie** aby wykluczyć leady które są w kolejce

