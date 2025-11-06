# 🚨 PROBLEM: 3 RÓŻNE MAILE DO JEDNEGO LEADA

**Data:** 2025-11-06, 08:50  
**Lead:** bartosz@gmsynergy.com.pl (ID: 733)  
**Problem:** System wysłał 3 różne maile z różnymi Message-ID o tej samej godzinie (07:46:00)

---

## 📊 DANE Z EMAILA

Użytkownik otrzymał 3 maile z różnymi Message-ID:

1. **Message-ID:** `<801e30b7-81d1-9043-b6df-cbb36fe903f8@kreativia.eu>`  
   **Date:** Thu, 06 Nov 2025 07:46:00 +0000

2. **Message-ID:** `<46715e19-f8b3-d3d3-dcc7-afcd804bf27a@kreativia.eu>`  
   **Date:** Thu, 06 Nov 2025 07:46:00 +0000

3. **Message-ID:** `<e3e9f226-4c17-2518-be72-83995d8bf637@kreativia.eu>`  
   **Date:** Thu, 06 Nov 2025 07:46:00 +0000

---

## 📊 DANE Z BAZY

### **SendLog:**
- ✅ Tylko **1 rekord** z Message-ID: `<e3e9f226-4c17-2518-be72-83995d8bf637@kreativia.eu>`
- ❌ **Brak** rekordów dla pozostałych 2 Message-ID

### **MaterialResponse:**
- ✅ Tylko **1 rekord** (status: sent, messageId: `<e3e9f226-4c17-2518-be72-83995d8bf637@kreativia.eu>`)

---

## 🔍 ANALIZA PROBLEMU

### **Co się stało:**

1. **System wysłał 3 różne maile** (nie duplikaty SMTP - różne Message-ID)
2. **Tylko 1 mail został zapisany do SendLog** (2 maile nie zostały zapisane)
3. **Wszystkie 3 maile zostały wysłane o tej samej godzinie** (07:46:00)

### **Możliwe przyczyny:**

#### **1. Równoległe uruchomienie cron (PRZED NAPRAWĄ):**
- Cron uruchamiał się co 2 minuty (`*/2 * * * *`)
- **Brak zabezpieczenia** przed równoległym uruchomieniem (naprawione teraz)
- 3 procesy uruchomiły się równolegle i każdy wysłał mail

#### **2. Atomic update nie działał poprawnie:**
- Kod używa atomic update (`status: 'scheduled'` → `status: 'sending'`)
- Jeśli 3 procesy uruchomiły się **w tym samym momencie**, wszystkie mogły zobaczyć `status: 'scheduled'` i wysłać mail

#### **3. SendLog nie został zapisany dla 2 maili:**
- Kod zapisuje SendLog w `try-catch` (nie przerywa jeśli się nie powiedzie)
- Jeśli 2 procesy próbowały zapisać SendLog **w tym samym momencie**, mogły wystąpić błędy (unique constraint, timeout, itp.)

---

## ✅ CO ZOSTAŁO NAPRAWIONE

### **1. Zabezpieczenie przed równoległym uruchomieniem cron:**

```typescript
let isMaterialResponseCronRunning = false;
const materialResponseCron = cron.schedule('*/2 * * * *', async () => {
  // ✅ ZABEZPIECZENIE: Zapobiega równoległemu uruchomieniu
  if (isMaterialResponseCronRunning) {
    console.log('[CRON] ⚠️ Material Response cron już działa - pomijam');
    return;
  }
  
  isMaterialResponseCronRunning = true;
  try {
    // ... wysyłka ...
  } finally {
    isMaterialResponseCronRunning = false;
  }
});
```

### **2. Atomic update (już było w kodzie):**

```typescript
// ✅ Atomic update: zmień status na 'sending' (zapobiega równoległemu wysłaniu)
await db.materialResponse.update({
  where: { id: response.id },
  data: { status: 'sending' as any }
});
```

---

## ⚠️ CO JESZCZE MOŻE BYĆ PROBLEMEM

### **1. Race condition w atomic update:**

Jeśli 3 procesy uruchomiły się **w tym samym momencie** (przed naprawą), wszystkie mogły:
1. Sprawdzić `status: 'scheduled'` ✅
2. Wysłać mail ✅
3. Zaktualizować `status: 'sending'` ✅

**Problem:** Atomic update nie zapobiega równoległemu wysłaniu, jeśli procesy uruchomiły się **przed** update.

### **2. SendLog nie został zapisany:**

Kod zapisuje SendLog w `try-catch`:
```typescript
try {
  await db.sendLog.create({ ... });
} catch (logError: any) {
  // Nie przerywaj jeśli logowanie się nie powiedzie
  console.warn(`[MATERIAL SENDER] Nie udało się zapisać do SendLog...`);
}
```

**Problem:** Jeśli 2 procesy próbowały zapisać SendLog **w tym samym momencie**, mogły wystąpić błędy (unique constraint, timeout, itp.), ale mail już został wysłany.

---

## ✅ REKOMENDACJE

### **1. Dodaj sprawdzenie przed wysłaniem:**

```typescript
// Sprawdź czy już wysłano mail do tego leada (tego samego dnia)
const existingSent = await db.sendLog.findFirst({
  where: {
    leadId: response.leadId,
    campaignId: response.campaignId,
    createdAt: {
      gte: new Date(new Date().setHours(0, 0, 0, 0)) // Dzisiaj
    }
  }
});

if (existingSent) {
  console.log(`[MATERIAL SENDER] ⚠️ Mail już wysłany do leada ${response.leadId} dzisiaj - pomijam`);
  continue;
}
```

### **2. Użyj transakcji dla atomic update + wysyłka:**

```typescript
await db.$transaction(async (tx) => {
  // 1. Atomic update (tylko jeśli status jest 'scheduled')
  const updated = await tx.materialResponse.updateMany({
    where: { 
      id: response.id,
      status: 'scheduled' // ✅ Tylko jeśli status jest 'scheduled'
    },
    data: { status: 'sending' }
  });
  
  if (updated.count === 0) {
    // Ktoś już zaktualizował status - pomiń
    return;
  }
  
  // 2. Wyślij mail
  const result = await transport.sendMail(mailOptions);
  
  // 3. Zaktualizuj status na 'sent'
  await tx.materialResponse.update({
    where: { id: response.id },
    data: { status: 'sent', sentAt: new Date(), messageId: result.messageId }
  });
  
  // 4. Zapisz do SendLog
  await tx.sendLog.create({ ... });
});
```

---

## 🎯 WNIOSEK

**Problem:** System wysłał 3 różne maile do tego samego leada o tej samej godzinie (przed naprawą).

**Przyczyna:** Równoległe uruchomienie cron (brak zabezpieczenia) + race condition w atomic update.

**Naprawione:** Dodano zabezpieczenie przed równoległym uruchomieniem cron.

**Rekomendacja:** Dodaj sprawdzenie przed wysłaniem (czy już wysłano dzisiaj) + użyj transakcji dla atomic update + wysyłka.

