# 🔍 ANALIZA DUPLIKATÓW AUTOMATYCZNYCH ODPOWIEDZI

**Data:** 2025-11-06, 08:50  
**Problem:** Użytkownik dostał 2x i 3x te same automatyczne odpowiedzi

---

## 📊 SPRAWDZENIE DANYCH

### **1. MaterialResponse:**
- ✅ **jakub.drag@berrylife.pl:** 1 rekord (status: sent, sentAt: 08:46:09)
- ✅ **bartosz@gmsynergy.com.pl:** 1 rekord (status: sent, sentAt: 08:46:08)
- ✅ **Brak duplikatów** w MaterialResponse

### **2. SendLog:**
- ✅ **jakub.drag@berrylife.pl:** 1 mail (messageId: `<2ba5bc88-6a0c-03d4-3b05-23ab1edfd275@kreativia.eu>`, sent: 08:46:09)
- ✅ **bartosz@gmsynergy.com.pl:** 1 mail (messageId: `<e3e9f226-4c17-2518-be72-83995d8bf637@kreativia.eu>`, sent: 08:46:08)
- ✅ **Brak duplikatów** w SendLog (każdy messageId jest unikalny)

### **3. Wnioski:**
- ✅ **System wysłał tylko 1 mail do każdego leada** (brak duplikatów w bazie)
- ⚠️ **Użytkownik dostał 2x i 3x te same maile** (problem może być po stronie SMTP lub klienta email)

---

## 🔍 MOŻLIWE PRZYCZYNY

### **1. Problem z BCC:**
- Kod dodaje administratora do BCC (`mailOptions.bcc = companySettings.forwardEmail`)
- Jeśli SMTP wysyła BCC wielokrotnie, użytkownik może dostać duplikaty

### **2. Problem z cron job:**
- Cron job uruchamia się co 2 minuty (`*/2 * * * *`)
- Jeśli cron uruchamia się równolegle (brak zabezpieczenia), może wysłać duplikaty

### **3. Problem z atomic update:**
- Kod używa atomic update (`status: 'sending'` → `status: 'sent'`)
- Jeśli atomic update nie działa poprawnie, może wysłać duplikaty

### **4. Problem z SMTP:**
- SMTP może wysyłać maile wielokrotnie (retry, timeout, itp.)
- Klient email może pokazywać duplikaty (cache, synchronizacja)

---

## ✅ ZABEZPIECZENIA W KODZIE

### **1. Atomic update:**
```typescript
// ✅ Atomic update: zmień status na 'sending' (zapobiega równoległemu wysłaniu)
await db.materialResponse.update({
  where: { id: response.id },
  data: { status: 'sending' as any }
});
```

### **2. Sprawdzenie statusu przed wysłaniem:**
```typescript
// ✅ SPRAWDŹ czy status nie został już zmieniony
const currentResponse = await db.materialResponse.findUnique({
  where: { id: response.id },
  select: { status: true }
});

if (!currentResponse || currentResponse.status !== 'scheduled') {
  console.log(`[MATERIAL SENDER] ⚠️ MaterialResponse ${response.id} już został przetworzony - pomijam`);
  continue;
}
```

### **3. Sprawdzenie statusu przed aktualizacją:**
```typescript
// ✅ Aktualizuj MaterialResponse na 'sent' (tylko jeśli status jest 'sending')
await db.materialResponse.update({
  where: { id: response.id, status: 'sending' }, // ✅ Dodatkowa ochrona
  data: {
    status: 'sent',
    sentAt: new Date(),
    mailboxId: mailbox.id,
    messageId: result.messageId
  }
});
```

---

## 🔍 CO SPRAWDZIĆ

### **1. Czy cron job może uruchamiać się równolegle?**
- Sprawdź czy jest zabezpieczenie przed równoległym uruchomieniem
- Sprawdź logi - czy cron uruchamia się wielokrotnie w tym samym czasie

### **2. Czy atomic update działa poprawnie?**
- Sprawdź czy są MaterialResponse z statusem 'sending' (stuck)
- Sprawdź logi - czy są błędy przy atomic update

### **3. Czy SMTP wysyła duplikaty?**
- Sprawdź logi SMTP - czy są retry/timeout
- Sprawdź czy klient email pokazuje duplikaty (cache, synchronizacja)

---

## ✅ REKOMENDACJE

### **1. Dodaj zabezpieczenie przed równoległym uruchomieniem cron:**
```typescript
let isMaterialResponseCronRunning = false;

const materialResponseCron = cron.schedule('*/2 * * * *', async () => {
  if (isMaterialResponseCronRunning) {
    console.log('[MATERIAL SENDER] ⚠️ Cron już działa - pomijam');
    return;
  }
  
  isMaterialResponseCronRunning = true;
  try {
    await processMaterialResponses();
  } finally {
    isMaterialResponseCronRunning = false;
  }
});
```

### **2. Dodaj sprawdzenie duplikatów przed wysłaniem:**
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

### **3. Sprawdź logi SMTP:**
- Sprawdź czy SMTP wysyła duplikaty
- Sprawdź czy klient email pokazuje duplikaty (cache, synchronizacja)

---

## 🎯 WNIOSEK

**✅ System wysłał tylko 1 mail do każdego leada** (brak duplikatów w bazie)

**⚠️ Problem może być:**
1. **SMTP wysyła duplikaty** (retry, timeout, itp.)
2. **Klient email pokazuje duplikaty** (cache, synchronizacja)
3. **Brak zabezpieczenia przed równoległym uruchomieniem cron** (może wysłać duplikaty)

**Rekomendacja:** Dodaj zabezpieczenie przed równoległym uruchomieniem cron i sprawdź logi SMTP.

