# 🔍 ANALIZA PROBLEMÓW W SYSTEMIE WYSYŁKI MAILI

## 📊 WYKRYTE PROBLEMY:

### ❌ PROBLEM 1: Inbox Processor - brak mailbox
**Lokalizacja:** `src/integrations/inbox/processor.ts`

**Linia:** ~700 (wysyłka do OOO leadów) i ~849 (powiadomienia)

**Problem:**
```typescript
// Wywołanie sendCampaignEmail BEZ mailbox:
await sendCampaignEmail({
  subject: targetCampaign.subject,
  content: content,
  leadEmail: newLead.email,
  // ❌ BRAK mailbox - użyje SMTP z virtualSalesperson!
  salesperson: campaign?.virtualSalespersonId ? { id: campaign.virtualSalespersonId } as any : undefined
});
```

**Wpływ:** 
- Może wysłać jako niewłaściwy FROM (jak w głównym błędzie)
- Nie używa round-robin
- Nie zwiększa licznika mailbox

---

### ⚠️ PROBLEM 2: Race Condition w PAUSED
**Lokalizacja:** `src/services/scheduledSender.ts`

**Problem:**
Pętla wysyłki NIE sprawdza czy status kampanii zmienił się na PAUSED w trakcie wysyłki.

**Przypadek:**
```
1. User klika "Uruchom" → status IN_PROGRESS
2. Pętla zaczyna wysyłać (np. 48 leadów)
3. User klika "Pauza" → status PAUSED w bazie
4. ALE pętla kontynuuje wysyłkę! (nie sprawdza status)
```

**Rozwiązanie:** Dodać sprawdzanie w pętli:
```typescript
for (let i = 0; i < leads.length; i++) {
  const lead = leads[i];
  
  // ✅ NOWE: Sprawdź czy kampania nie została zatrzymana
  const currentCampaign = await db.campaign.findUnique({
    where: { id: campaign.id },
    select: { status: true }
  });
  
  if (currentCampaign?.status === "PAUSED") {
    console.log('[SENDER] Kampania zatrzymana');
    break;
  }
  
  // ... reszta logiki
}
```

---

### ⚠️ PROBLEM 3: Brak sprawdzania czy pętla w ogóle działa
**Lokalizacja:** `src/services/scheduledSender.ts`

**Problem:**
Gdy kampania IN_PROGRESS zostanie ponownie wywołana (np. przez cron), może wystąpić konflikt.

**Przypadek:**
```
1. Kampania działa (IN_PROGRESS) - wysyła 48 leadów
2. Cron wywołuje processScheduledCampaign() co 5 min
3. Bardziej prawdopodobne: getNextScheduledCampaign() zwróci tę samą kampanię
4. Ale jak obsłużyć sytuację gdy już działa?
```

**Obecna logika:** `isCampaignCronTaskRunning` - tylko 1 instance na raz ✅ (OK)

---

### ⚠️ PROBLEM 4: Inbox Processor - brak logu mailboxId
**Lokalizacja:** `src/integrations/inbox/processor.ts:718`

**Problem:**
```typescript
await db.sendLog.create({
  data: {
    campaignId: targetCampaign.id,
    leadId: newLead.id,
    status: "sent",
    messageId: result.messageId
    // ❌ BRAK mailboxId
  }
});
```

---

### ⚠️ PROBLEM 5: Manualna wysyłka - brak sprawdzenia czy kampania już działa
**Lokalizacja:** `app/api/campaigns/[id]/start/route.ts`

**Problem:**
Co jeśli user kliknie "Uruchom" gdy kampania już IN_PROGRESS?

**Obecna logika:**
```typescript
if (campaign.status === "IN_PROGRESS") {
  return { error: "Kampania już działa" };
}
```

✅ **ROZWIĄZANE** - jest walidacja

---

## 📝 PODSUMOWANIE PROBLEMÓW:

| Problem | Lokalizacja | Wpływ | Priorytet |
|---------|-------------|-------|-----------|
| 1. Inbox Processor - brak mailbox | `inbox/processor.ts:700,849` | ❌ Wysoka - może wysyłać jako niewłaściwy FROM | **WYSOKI** |
| 2. Race Condition PAUSED | `scheduledSender.ts:129` | ⚠️ Średni - pętla nie sprawdza status | **ŚREDNI** |
| 3. Brak sprawdzania działania pętli | `scheduledSender.ts` | ✅ Niski - jest zabezpieczenie | **NISKI** |
| 4. Brak logu mailboxId | `inbox/processor.ts:718` | ⚠️ Średni - brak śledzenia | **ŚREDNI** |
| 5. Wysyłka gdy IN_PROGRESS | `start/route.ts` | ✅ Naprawione | **OK** |

---

## 🔧 ZALECANE NAPRAWY:

### 1. NAPRAW: Inbox Processor - dodaj mailbox ⚠️ PILNE
```typescript
// W src/integrations/inbox/processor.ts ~700

// Pobierz dostępną skrzynkę (jeśli campaign ma virtualSalespersonId)
let mailbox = null;
if (campaign?.virtualSalespersonId) {
  mailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
}

// Dodaj mailbox do sendCampaignEmail
await sendCampaignEmail({
  // ...
  mailbox: mailbox || undefined
});

// W sendLog dodaj mailboxId
await db.sendLog.create({
  data: {
    // ...
    mailboxId: mailbox?.id || null
  }
});

// Inkrementuj licznik
if (mailbox) {
  await incrementMailboxCounter(mailbox.id);
}
```

### 2. NAPRAW: Race Condition PAUSED
```typescript
// W src/services/scheduledSender.ts w pętli wysyłki

for (let i = 0; i < leads.length; i++) {
  const lead = leads[i];
  
  // ✅ NOWE: Sprawdź czy kampania nie została zatrzymana
  const currentCampaign = await db.campaign.findUnique({
    where: { id: campaign.id },
    select: { status: true }
  });
  
  if (currentCampaign?.status === "PAUSED") {
    console.log('[SCHEDULED SENDER] Kampania zatrzymana przez użytkownika');
    skippedCount = leads.length - i;
    break;
  }
  
  // ... reszta logiki
}
```

### 3. NAPRAW: Powiadomienia w inbox/processor
```typescript
// W sendNotificationEmail (~849)
// Te powiadomienia to internal - może użyć domyślnego SMTP
// LUB pobrać mailbox jeśli jest dostępne campaign
```

---

**Data analizy:** 2025-10-26  
**Status:** 2 problemy do naprawy (Priorytet: WYSOKI i ŚREDNI)



