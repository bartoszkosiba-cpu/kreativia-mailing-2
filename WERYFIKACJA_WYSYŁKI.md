# ✅ WERYFIKACJA WSZYSTKICH MIEJSC WYSYŁKI

## 📊 ANALIZA WSZYSTKICH WYWOŁAŃ sendCampaignEmail:

### 1. ✅ `src/services/scheduledSender.ts` (linia 50-66)
```typescript
// Pobiera mailbox (round-robin)
let mailbox = null;
if (campaign.virtualSalespersonId) {
  mailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
  // ...
}

const result = await sendCampaignEmail({
  // ...
  mailbox: mailbox || undefined, // ✅ MA MAILBOX
});
// ... zapisuje mailboxId w SendLog
```
**Status:** ✅ **NAPRAWIONE** - używa mailbox

---

### 2. ✅ `src/integrations/inbox/processor.ts` (linia 707-723)
```typescript
// Pobiera mailbox (round-robin)
let mailbox = null;
if (targetCampaign.virtualSalespersonId) { // ✅ TERAZ UŻYWA TARGETCAMPAIGN
  mailbox = await getNextAvailableMailbox(targetCampaign.virtualSalespersonId);
}

const result = await sendCampaignEmail({
  // ...
  mailbox: mailbox || undefined, // ✅ MA MAILBOX
});
// ... zapisuje mailboxId w SendLog
```
**Status:** ✅ **NAPRAWIONE** - używa mailbox (właśnie poprawione)

---

### 3. ❌ `src/integrations/inbox/processor.ts` (linia 866-871) - sendNotificationEmail
```typescript
async function sendNotificationEmail(to, subject, message, originalEmail) {
  await sendCampaignEmail({
    subject: `[Kreativia Mailing] ${subject}`,
    content: message,
    leadEmail: to,
    leadLanguage: 'pl',
    // ❌ BRAK mailbox, salesperson, campaign
  });
}
```
**Status:** ❌ **BRAK MAILBOX** - to maile internal/powiadomienia, więc OK (używa domyślnego SMTP)

---

### 4. ✅ `app/api/campaigns/[id]/send/route.ts` (linia 114-139)
```typescript
// Pobiera mailbox (round-robin) - linia 82-90
let mailbox = null;
if (campaign.virtualSalespersonId) {
  mailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
  // ...
}

const result = await sendCampaignEmail({
  subject: campaign.subject,
  content: personalizedContent,
  // ...
  mailbox: mailbox || undefined, // ✅ MA MAILBOX
});
// ... zapisuje mailboxId w SendLog (linia 142-152)
```
**Status:** ✅ **MA MAILBOX** - OK

---

### 5. ✅ `app/api/campaigns/[id]/send/route.ts` (linia 249-274)
```typescript
// Pobiera mailbox (round-robin) - linia 208-225
let mailbox = null;
if (campaign.virtualSalespersonId) {
  mailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
  // ...
}

const result = await sendCampaignEmail({
  subject: campaign.subject,
  // ...
  mailbox: mailbox || undefined, // ✅ MA MAILBOX
});
// ... zapisuje mailboxId w SendLog (linia 277-287)
```
**Status:** ✅ **MA MAILBOX** - OK

---

## 🎯 PODSUMOWANIE:

| Miejsce | Ma mailbox? | Status |
|---------|-------------|--------|
| `scheduledSender.ts` | ✅ TAK | ✅ **OK** |
| `inbox/processor.ts` (OOO) | ✅ TAK | ✅ **OK** (właśnie naprawione) |
| `inbox/processor.ts` (notification) | ❌ NIE | ⚠️ **OK** (internal mail) |
| `send/route.ts` (test) | ✅ TAK | ✅ **OK** |
| `send/route.ts` (mass) | ✅ TAK | ✅ **OK** |

---

## ⚠️ UWAGA - JEDEN PROBLEM:

### sendNotificationEmail (linia 866-871)
**Lokalizacja:** `src/integrations/inbox/processor.ts`

**Problem:** Nie przekazuje mailbox parameter

**Czy to problem?** 
- **NIE** - te maile to internal powiadomienia (wysyłane do forwardEmail)
- Używają domyślnego SMTP z ustawień firmowych
- Nie są to maile kampanii - nie potrzebują round-robin
- **Można zostawić jak jest**

**Jeśli chcesz naprawić:**
```typescript
async function sendNotificationEmail(to, subject, message, originalEmail) {
  // Pobierz domyślny mailbox z ustawień
  const settings = await db.companySettings.findFirst();
  const defaultMailbox = // ... pobierz default mailbox
  
  await sendCampaignEmail({
    subject: `[Kreativia Mailing] ${subject}`,
    content: message,
    leadEmail: to,
    leadLanguage: 'pl',
    mailbox: defaultMailbox || undefined, // Opcjonalne
  });
}
```

**Ale to nie jest konieczne** - te maile działają OK jako internal.

---

## ✅ WNIOSEK:

**Wszystkie maile kampanii mają mailbox parameter** ✅

Tylko internal powiadomienia nie mają - i to jest OK.

**Status:** ✅ **WSZYSTKO POPRAWIONE**



