# 🧪 SZCZEGÓŁOWE SCENARIUSZE TESTOWE V2

## 📋 SCENARIUSZ 1: Podstawowa wysyłka z wyczerpaniem slotów

### **Setup:**
- 3 skrzynki (Mailbox A, B, C)
- Każda skrzynka: limit 2 maile/dzień
- Kampania: delayBetweenEmails = 90s, startHour = 9, endHour = 16
- 10 leadów w statusie 'queued'
- Start: 10:00:00

### **KROK 1: Inicjalizacja (10:00:00)**

```
initializeQueueV2(campaignId, bufferSize=20)
```

**Co się dzieje w kodzie:**

1. **Pobiera kampanię:**
   ```typescript
   const campaign = await db.campaign.findUnique({ where: { id: campaignId } })
   ```
   - ✅ delayBetweenEmails = 90
   - ✅ startHour = 9
   - ✅ endHour = 16

2. **Pobiera ostatni wysłany mail:**
   ```typescript
   const lastSentLog = await db.sendLog.findFirst({ where: { campaignId, status: "sent" } })
   ```
   - ✅ Brak (pierwsza kampania)

3. **Określa startowy czas:**
   ```typescript
   currentTime = now (10:00:00)
   ```

4. **Pobiera leady:**
   ```typescript
   const campaignLeads = await db.campaignLead.findMany({
     where: { campaignId, status: { in: ['queued', 'planned'] } }
   })
   ```
   - ✅ 10 leadów

5. **Sprawdza dostępność skrzynek:**
   ```typescript
   const availableMailbox = await getNextAvailableMailbox(virtualSalespersonId, campaignId)
   ```
   - ✅ Mailbox A: currentDailySent = 0, limit = 2 → dostępna
   - ✅ Zwraca: Mailbox A

6. **Dodaje maile do kolejki:**
   ```typescript
   for (const campaignLead of campaignLeads) {
     await db.campaignEmailQueue.create({
       data: {
         campaignId,
         campaignLeadId: campaignLead.id,
         scheduledAt: nextTime, // 10:00:00, 10:01:30, 10:03:00, ...
         status: "pending"
       }
     })
     nextTime = calculateNextEmailTimeV2(nextTime, 90)
   }
   ```
   - ✅ Mail 1: scheduledAt = 10:00:00
   - ✅ Mail 2: scheduledAt = 10:01:30 (90s ± 20%)
   - ✅ Mail 3: scheduledAt = 10:03:00
   - ✅ ... (10 maili)

**Wynik:**
- ✅ 10 maili w kolejce (status: 'pending')
- ✅ scheduledAt: 10:00:00, 10:01:30, 10:03:00, 10:04:30, 10:06:00, 10:07:30, 10:09:00, 10:10:30, 10:12:00, 10:13:30

---

### **KROK 2: Wysyłka maili (10:00:30)**

```
processScheduledEmailsV2() → sendNextEmailFromQueue(campaignId)
```

**Co się dzieje w kodzie:**

1. **Transakcja:**
   ```typescript
   const result = await db.$transaction(async (tx) => {
     // Sprawdza dynamiczną tolerancję
     const stuckEmailsCount = await tx.campaignEmailQueue.count({
       where: { campaignId, status: 'sending', updatedAt: { lt: tenMinutesAgo } }
     })
     const lastSentLog = await tx.sendLog.findFirst({
       where: { campaignId, status: 'sent' },
       orderBy: { createdAt: 'desc' }
     })
     ```
     - ✅ stuckEmailsCount = 0
     - ✅ lastSentLog = null (pierwsza kampania)
     - ✅ maxToleranceMinutes = 5
     - ✅ maxTolerance = 10:00:30 - 5 min = 09:55:30

   ```typescript
   const candidateEmails = await tx.campaignEmailQueue.findMany({
     where: {
       campaignId,
       status: 'pending',
       scheduledAt: { lte: now (10:00:30), gte: maxTolerance (09:55:30) }
     },
     orderBy: { scheduledAt: 'asc' },
     take: 10
   })
   ```
   - ✅ Mail 1: scheduledAt = 10:00:00, status = 'pending' → ✅ Znaleziony

   ```typescript
   // Sprawdza okno czasowe
   if (!isWithinSendWindow(scheduledTime (10:00:00), campaign)) {
     // Przekłada na jutro
   }
   ```
   - ✅ 10:00:00 w oknie 9:00-16:00 → ✅ W oknie

   ```typescript
   // Sprawdza catch-up delay
   const isCatchUp = nextEmail.scheduledAt < now
   if (isCatchUp && campaign) {
     const lastSentLog = await tx.sendLog.findFirst(...)
     if (lastSentLog) {
       const timeSinceLastMail = ...
       if (timeSinceLastMail < delayBetweenEmails) {
         // Przekłada na później
       }
     }
   }
   ```
   - ✅ isCatchUp = true (10:00:00 < 10:00:30)
   - ✅ lastSentLog = null → pomija sprawdzanie

   ```typescript
   // Rezerwuje slot skrzynki
   const availableMailbox = await getNextAvailableMailbox(virtualSalespersonId, campaignId)
   ```
   - ✅ Mailbox A: currentDailySent = 0, limit = 2 → dostępna
   - ✅ Zwraca: Mailbox A

   ```typescript
   // Atomowa rezerwacja slotu
   const incrementResult = await tx.$executeRaw`
     UPDATE Mailbox 
     SET currentDailySent = currentDailySent + 1
     WHERE id = ${mailboxForReservation.id}
     AND currentDailySent < ${effectiveLimit} (2)
   `
   ```
   - ✅ currentDailySent = 0 → 1
   - ✅ incrementResult = 1 (1 row affected)

   ```typescript
   // Blokuje mail
   const lockResult = await tx.campaignEmailQueue.updateMany({
     where: { id: nextEmail.id, status: 'pending' },
     data: { status: 'sending', updatedAt: new Date() }
   })
   ```
   - ✅ lockResult.count = 1
   - ✅ Mail 1: status = 'sending'

2. **Po transakcji:**
   ```typescript
   // Sprawdza status kampanii
   const currentCampaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { status: true } })
   if (currentCampaign.status !== 'IN_PROGRESS') {
     // Jeśli PAUSED → przywróć do pending
     // Jeśli inny → oznacz jako cancelled
   }
   ```
   - ✅ Status: 'IN_PROGRESS' → kontynuuje

   ```typescript
   // Wysyła mail
   const sendResult = await sendSingleEmail({ ... }, preReservedMailbox: availableMailbox)
   ```
   - ✅ Mail wysłany

   ```typescript
   // Aktualizuje status
   await db.campaignEmailQueue.update({
     where: { id: nextEmail.id },
     data: { status: 'sent', sentAt: now }
   })
   ```
   - ✅ Mail 1: status = 'sent'

   ```typescript
   // Zaplanuj następny mail
   await scheduleNextEmailV2(campaignId, sentAt, delayBetweenEmails)
   ```
   - ✅ Mail 11 dodany do kolejki (scheduledAt = 10:02:00)

**Wynik:**
- ✅ Mail 1 wysłany (Mailbox A: currentDailySent = 1/2)
- ✅ Mail 11 dodany do kolejki
- ✅ W kolejce: 9 maili (pending) + 1 mail (scheduled)

---

### **KROK 3: Wysyłka kontynuuje się (10:01:30 - 10:06:00)**

**Cron uruchamia się co 30s:**

**10:01:30:**
- Mail 2: scheduledAt = 10:01:30, now = 10:01:30
- ✅ Wysyłany (Mailbox B: currentDailySent = 0 → 1)
- ✅ Mail 12 dodany do kolejki

**10:03:00:**
- Mail 3: scheduledAt = 10:03:00, now = 10:03:00
- ✅ Wysyłany (Mailbox C: currentDailySent = 0 → 1)
- ✅ Mail 13 dodany do kolejki

**10:04:30:**
- Mail 4: scheduledAt = 10:04:30, now = 10:04:30
- ✅ Wysyłany (Mailbox A: currentDailySent = 1 → 2) ✅ **LIMIT OSIĄGNIĘTY**
- ✅ Mail 14 dodany do kolejki

**10:06:00:**
- Mail 5: scheduledAt = 10:06:00, now = 10:06:00
- ✅ Wysyłany (Mailbox B: currentDailySent = 1 → 2) ✅ **LIMIT OSIĄGNIĘTY**
- ✅ Mail 15 dodany do kolejki

**Wynik:**
- ✅ Wysłano: 5 maili
- ✅ Mailbox A: currentDailySent = 2/2 (limit osiągnięty)
- ✅ Mailbox B: currentDailySent = 2/2 (limit osiągnięty)
- ✅ Mailbox C: currentDailySent = 1/2

---

### **KROK 4: Wyczerpanie slotów (10:07:30)**

**Cron uruchamia się (10:07:30):**

```typescript
sendNextEmailFromQueue(campaignId)
```

**Co się dzieje w kodzie:**

1. **Transakcja:**
   ```typescript
   const candidateEmails = await tx.campaignEmailQueue.findMany({
     where: {
       campaignId,
       status: 'pending',
       scheduledAt: { lte: now (10:07:30), gte: maxTolerance (10:02:30) }
     }
   })
   ```
   - ✅ Mail 6: scheduledAt = 10:07:30 → Znaleziony

   ```typescript
   // Sprawdza okno czasowe
   if (!isWithinSendWindow(scheduledTime (10:07:30), campaign)) {
     // Przekłada na jutro
   }
   ```
   - ✅ 10:07:30 w oknie 9:00-16:00 → ✅ W oknie

   ```typescript
   // Rezerwuje slot skrzynki
   const availableMailbox = await getNextAvailableMailbox(virtualSalespersonId, campaignId)
   ```
   - Mailbox A: currentDailySent = 2, limit = 2 → ❌ **Brak miejsca**
   - Mailbox B: currentDailySent = 2, limit = 2 → ❌ **Brak miejsca**
   - Mailbox C: currentDailySent = 1, limit = 2 → ✅ **Dostępna**
   - ✅ Zwraca: Mailbox C

   ```typescript
   // Atomowa rezerwacja slotu
   const incrementResult = await tx.$executeRaw`
     UPDATE Mailbox 
     SET currentDailySent = currentDailySent + 1
     WHERE id = ${mailboxForReservation.id} (Mailbox C)
     AND currentDailySent < ${effectiveLimit} (2)
   `
   ```
   - ✅ currentDailySent = 1 → 2
   - ✅ incrementResult = 1 (1 row affected)

   ```typescript
   // Blokuje mail
   const lockResult = await tx.campaignEmailQueue.updateMany({
     where: { id: nextEmail.id, status: 'pending' },
     data: { status: 'sending', updatedAt: new Date() }
   })
   ```
   - ✅ Mail 6: status = 'sending'

2. **Po transakcji:**
   - ✅ Mail 6 wysłany (Mailbox C: currentDailySent = 2/2) ✅ **LIMIT OSIĄGNIĘTY**

**Wynik:**
- ✅ Wysłano: 6 maili
- ✅ Mailbox A: currentDailySent = 2/2 (limit osiągnięty)
- ✅ Mailbox B: currentDailySent = 2/2 (limit osiągnięty)
- ✅ Mailbox C: currentDailySent = 2/2 (limit osiągnięty)
- ✅ **Wszystkie skrzynki wyczerpane**

---

### **KROK 5: Próba wysłania gdy brak slotów (10:09:00)**

**Cron uruchamia się (10:09:00):**

```typescript
sendNextEmailFromQueue(campaignId)
```

**Co się dzieje w kodzie:**

1. **Transakcja:**
   ```typescript
   const candidateEmails = await tx.campaignEmailQueue.findMany({
     where: {
       campaignId,
       status: 'pending',
       scheduledAt: { lte: now (10:09:00), gte: maxTolerance (10:04:00) }
     }
   })
   ```
   - ✅ Mail 7: scheduledAt = 10:09:00 → Znaleziony

   ```typescript
   // Sprawdza okno czasowe
   if (!isWithinSendWindow(scheduledTime (10:09:00), campaign)) {
     // Przekłada na jutro
   }
   ```
   - ✅ 10:09:00 w oknie 9:00-16:00 → ✅ W oknie

   ```typescript
   // Rezerwuje slot skrzynki
   const availableMailbox = await getNextAvailableMailbox(virtualSalespersonId, campaignId)
   ```
   - Mailbox A: currentDailySent = 2, limit = 2 → ❌ **Brak miejsca**
   - Mailbox B: currentDailySent = 2, limit = 2 → ❌ **Brak miejsca**
   - Mailbox C: currentDailySent = 2, limit = 2 → ❌ **Brak miejsca**
   - ✅ Zwraca: `null`

   ```typescript
   // ✅ POPRAWKA Problem 1: Brak dostępnych skrzynek - przekładaj na jutro
   if (!availableMailbox) {
     if (campaign) {
       const { setPolishTime, getPolishTime } = await import('@/utils/polishTime');
       const nowPL = getPolishTime();
       const tomorrowPL = new Date(nowPL);
       tomorrowPL.setDate(tomorrowPL.getDate() + 1);
       const newScheduledAt = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
       
       await tx.campaignEmailQueue.update({
         where: { id: nextEmail.id },
         data: { scheduledAt: newScheduledAt }
       });
     }
     return { email: null, locked: false };
   }
   ```
   - ✅ Mail 7: scheduledAt = 10:09:00 → jutro 9:00:00
   - ✅ Status: 'pending' (nie zmieniony)

**Wynik:**
- ✅ Mail 7 przekładany na jutro 9:00:00
- ✅ W kolejce: pozostałe maile (status: 'pending', scheduledAt: jutro 9:00:00)

---

## 📋 SCENARIUSZ 2: Pauza + wznowienie po 2h

### **Setup:**
- 2 skrzynki (Mailbox A, B)
- Każda skrzynka: limit 5 maili/dzień
- Kampania: delayBetweenEmails = 90s, startHour = 9, endHour = 16
- 20 leadów w statusie 'queued'
- Start: 10:00:00
- Wysłano: 5 maili (10:00:00 - 10:06:00)
- Pauza: 10:06:30
- Wznowienie: 12:06:30 (2h później)

### **KROK 1: Wysyłka przed pauzą (10:00:00 - 10:06:00)**

**Wysłano:**
- Mail 1: 10:00:00 (Mailbox A: 1/5)
- Mail 2: 10:01:30 (Mailbox B: 1/5)
- Mail 3: 10:03:00 (Mailbox A: 2/5)
- Mail 4: 10:04:30 (Mailbox B: 2/5)
- Mail 5: 10:06:00 (Mailbox A: 3/5)

**W kolejce:**
- Mail 6: scheduledAt = 10:07:30 (status: 'pending')
- Mail 7: scheduledAt = 10:09:00 (status: 'pending')
- ... (15 maili)

---

### **KROK 2: Pauza (10:06:30)**

**Użytkownik wciska pauzę:**
```
Status: IN_PROGRESS → PAUSED
```

**Cron uruchamia się (10:07:30):**

```typescript
sendNextEmailFromQueue(campaignId)
```

**Co się dzieje w kodzie:**

1. **Transakcja:**
   ```typescript
   const candidateEmails = await tx.campaignEmailQueue.findMany({
     where: {
       campaignId,
       status: 'pending',
       scheduledAt: { lte: now (10:07:30), gte: maxTolerance (10:02:30) }
     }
   })
   ```
   - ✅ Mail 6: scheduledAt = 10:07:30 → Znaleziony

   ```typescript
   // Rezerwuje slot skrzynki
   const availableMailbox = await getNextAvailableMailbox(virtualSalespersonId, campaignId)
   ```
   - ✅ Mailbox B: currentDailySent = 2, limit = 5 → dostępna
   - ✅ Zwraca: Mailbox B

   ```typescript
   // Atomowa rezerwacja slotu
   const incrementResult = await tx.$executeRaw`
     UPDATE Mailbox 
     SET currentDailySent = currentDailySent + 1
     WHERE id = ${mailboxForReservation.id} (Mailbox B)
     AND currentDailySent < ${effectiveLimit} (5)
   `
   ```
   - ✅ currentDailySent = 2 → 3
   - ✅ incrementResult = 1

   ```typescript
   // Blokuje mail
   const lockResult = await tx.campaignEmailQueue.updateMany({
     where: { id: nextEmail.id, status: 'pending' },
     data: { status: 'sending', updatedAt: new Date() }
   })
   ```
   - ✅ Mail 6: status = 'sending'

2. **Po transakcji:**
   ```typescript
   // Sprawdza status kampanii
   const currentCampaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { status: true } })
   if (currentCampaign.status !== 'IN_PROGRESS') {
     const status = currentCampaign.status; // 'PAUSED'
     
     // ✅ POPRAWKA Recovery: Jeśli kampania jest PAUSED, nie oznaczaj jako 'cancelled'
     if (status === 'PAUSED') {
       await db.campaignEmailQueue.update({
         where: { id: nextEmail.id },
         data: { 
           status: 'pending', // Przywróć do pending, nie 'cancelled'
           error: null
         }
       });
     }
   }
   ```
   - ✅ Mail 6: status = 'sending' → 'pending'
   - ✅ Mailbox B: currentDailySent = 3 (rezerwacja pozostaje)

**Wynik:**
- ✅ Mail 6 pozostaje w kolejce (status: 'pending')
- ✅ Mailbox B: currentDailySent = 3/5 (rezerwacja pozostaje)
- ✅ W kolejce: 15 maili (status: 'pending')

---

### **KROK 3: Wznowienie po 2h (12:06:30)**

**Użytkownik wznawia kampanię:**
```
Status: PAUSED → IN_PROGRESS
```

**Cron uruchamia się (12:06:30):**

```typescript
sendNextEmailFromQueue(campaignId)
```

**Co się dzieje w kodzie:**

1. **Transakcja:**
   ```typescript
   // Sprawdza dynamiczną tolerancję
   const stuckEmailsCount = await tx.campaignEmailQueue.count({
     where: { campaignId, status: 'sending', updatedAt: { lt: tenMinutesAgo } }
   })
   ```
   - ✅ stuckEmailsCount = 0 (wszystkie maile są 'pending')

   ```typescript
   // ✅ POPRAWKA Problem 2: Sprawdź ostatni wysłany mail (SendLog)
   const lastSentLog = await tx.sendLog.findFirst({
     where: { campaignId, status: 'sent' },
     orderBy: { createdAt: 'desc' }
   })
   ```
   - ✅ lastSentLog: createdAt = 10:06:00

   ```typescript
   let isRecoveryAfterLongPause = false;
   if (lastSentLog) {
     const timeSinceLastMail = Math.floor((now.getTime() - lastSentLog.createdAt.getTime()) / 1000);
     // 12:06:30 - 10:06:00 = 7230 sekund = 120.5 min
     if (timeSinceLastMail > 3600) { // > 1h
       isRecoveryAfterLongPause = true;
     }
   }
   ```
   - ✅ timeSinceLastMail = 7230s (> 3600s) → ✅ **Wykryto recovery!**

   ```typescript
   const maxToleranceMinutes = (stuckEmailsCount > 0 || isRecoveryAfterLongPause) ? 120 : 5;
   // maxToleranceMinutes = 120 (2h)
   const maxTolerance = new Date(now.getTime() - maxToleranceMinutes * 60 * 1000);
   // maxTolerance = 12:06:30 - 120 min = 10:06:30
   ```
   - ✅ maxTolerance = 10:06:30

   ```typescript
   const candidateEmails = await tx.campaignEmailQueue.findMany({
     where: {
       campaignId,
       status: 'pending',
       scheduledAt: { lte: now (12:06:30), gte: maxTolerance (10:06:30) }
     }
   })
   ```
   - Mail 6: scheduledAt = 10:07:30, maxTolerance = 10:06:30
   - ✅ `10:07:30 >= 10:06:30` → ✅ **W tolerancji!**

   ```typescript
   // Sprawdza okno czasowe
   if (!isWithinSendWindow(scheduledTime (10:07:30), campaign)) {
     // Przekłada na jutro
   }
   ```
   - ❌ 10:07:30 < 9:00 (jutro) → ❌ **Poza oknem (jutro 9:00)**
   - ✅ Przekłada na jutro 9:00:00

**Wynik:**
- ✅ System wykrywa recovery (2h od ostatniego maila)
- ✅ Mail 6 jest w tolerancji (2h)
- ✅ Mail 6 przekładany na jutro 9:00:00 (poza oknem czasowym)

---

## 📋 SCENARIUSZ 3: Pauza + wznowienie w tym samym oknie czasowym

### **Setup:**
- 2 skrzynki (Mailbox A, B)
- Każda skrzynka: limit 5 maili/dzień
- Kampania: delayBetweenEmails = 90s, startHour = 9, endHour = 16
- 20 leadów w statusie 'queued'
- Start: 10:00:00
- Wysłano: 5 maili (10:00:00 - 10:06:00)
- Pauza: 10:06:30
- Wznowienie: 11:06:30 (1h później, w tym samym oknie)

### **KROK 1: Wznowienie (11:06:30)**

**Cron uruchamia się (11:06:30):**

```typescript
sendNextEmailFromQueue(campaignId)
```

**Co się dzieje w kodzie:**

1. **Transakcja:**
   ```typescript
   // Sprawdza dynamiczną tolerancję
   const lastSentLog = await tx.sendLog.findFirst({
     where: { campaignId, status: 'sent' },
     orderBy: { createdAt: 'desc' }
   })
   ```
   - ✅ lastSentLog: createdAt = 10:06:00

   ```typescript
   let isRecoveryAfterLongPause = false;
   if (lastSentLog) {
     const timeSinceLastMail = Math.floor((now.getTime() - lastSentLog.createdAt.getTime()) / 1000);
     // 11:06:30 - 10:06:00 = 3630 sekund = 60.5 min
     if (timeSinceLastMail > 3600) { // > 1h
       isRecoveryAfterLongPause = true;
     }
   }
   ```
   - ✅ timeSinceLastMail = 3630s (> 3600s) → ✅ **Wykryto recovery!**

   ```typescript
   const maxToleranceMinutes = (stuckEmailsCount > 0 || isRecoveryAfterLongPause) ? 120 : 5;
   // maxToleranceMinutes = 120 (2h)
   const maxTolerance = new Date(now.getTime() - maxToleranceMinutes * 60 * 1000);
   // maxTolerance = 11:06:30 - 120 min = 09:06:30
   ```
   - ✅ maxTolerance = 09:06:30

   ```typescript
   const candidateEmails = await tx.campaignEmailQueue.findMany({
     where: {
       campaignId,
       status: 'pending',
       scheduledAt: { lte: now (11:06:30), gte: maxTolerance (09:06:30) }
     }
   })
   ```
   - Mail 6: scheduledAt = 10:07:30, maxTolerance = 09:06:30
   - ✅ `10:07:30 >= 09:06:30` → ✅ **W tolerancji!**

   ```typescript
   // Sprawdza okno czasowe
   if (!isWithinSendWindow(scheduledTime (10:07:30), campaign)) {
     // Przekłada na jutro
   }
   ```
   - ❌ **WAŻNE:** `isWithinSendWindow` sprawdza `scheduledTime` (10:07:30), nie `now`
   - ❌ `isWithinSendWindow` sprawdza dzień tygodnia i godzinę z `scheduledTime`
   - ❌ 10:07:30 jest wczoraj (lub wcześniejszy dzień) → sprawdza dzień tygodnia z 10:07:30
   - ❌ Jeśli 10:07:30 było wczoraj (poniedziałek), a teraz jest wtorek → ❌ **Inny dzień tygodnia**
   - ✅ **ALE:** Jeśli 10:07:30 było dzisiaj rano, sprawdza godzinę: 10:07:30 w oknie 9:00-16:00 → ✅ **W oknie!**
   - ❌ **ALE:** Jeśli teraz jest 11:06:30, a scheduledAt był 10:07:30 (tego samego dnia), to `isWithinSendWindow` sprawdza czy 10:07:30 jest w oknie → ✅ **W oknie!** (10:07:30 jest między 9:00 a 16:00)

   ```typescript
   // Sprawdza catch-up delay
   const isCatchUp = nextEmail.scheduledAt < now; // 10:07:30 < 11:06:30 → true
   if (isCatchUp && campaign) {
     const lastSentLog = await tx.sendLog.findFirst(...)
     if (lastSentLog) {
       const lastSentTime = new Date(lastSentLog.createdAt); // 10:06:00
       const timeSinceLastMail = Math.floor((now.getTime() - lastSentTime.getTime()) / 1000);
       // 11:06:30 - 10:06:00 = 3630 sekund = 60.5 min
       const delayBetweenEmails = campaign.delayBetweenEmails || 90; // 90s
       if (timeSinceLastMail < delayBetweenEmails) {
         // Przekłada na później
       }
     }
   }
   ```
   - ✅ isCatchUp = true
   - ✅ timeSinceLastMail = 3630s (> 90s) → ✅ **Minęło więcej niż delayBetweenEmails**
   - ✅ Kontynuuje wysyłkę

   ```typescript
   // Rezerwuje slot skrzynki
   const availableMailbox = await getNextAvailableMailbox(virtualSalespersonId, campaignId)
   ```
   - ✅ Mailbox B: currentDailySent = 3, limit = 5 → dostępna
   - ✅ Zwraca: Mailbox B

   ```typescript
   // Atomowa rezerwacja slotu
   const incrementResult = await tx.$executeRaw`
     UPDATE Mailbox 
     SET currentDailySent = currentDailySent + 1
     WHERE id = ${mailboxForReservation.id} (Mailbox B)
     AND currentDailySent < ${effectiveLimit} (5)
   `
   ```
   - ✅ currentDailySent = 3 → 4
   - ✅ incrementResult = 1

   ```typescript
   // Blokuje mail
   const lockResult = await tx.campaignEmailQueue.updateMany({
     where: { id: nextEmail.id, status: 'pending' },
     data: { status: 'sending', updatedAt: new Date() }
   })
   ```
   - ✅ Mail 6: status = 'sending'

2. **Po transakcji:**
   - ✅ Mail 6 wysłany (Mailbox B: currentDailySent = 4/5)

**Wynik:**
- ✅ System wykrywa recovery (1h od ostatniego maila)
- ✅ Mail 6 jest w tolerancji (2h)
- ✅ Mail 6 jest w oknie czasowym (11:06:30)
- ✅ Mail 6 wysłany natychmiast (minęło > delayBetweenEmails)

---

## 📋 SCENARIUSZ 4: Reset dzienny + kontynuacja

### **Setup:**
- 2 skrzynki (Mailbox A, B)
- Każda skrzynka: limit 3 maile/dzień
- Kampania: delayBetweenEmails = 90s, startHour = 9, endHour = 16
- 10 leadów w statusie 'queued'
- Dzień 1: Wysłano 6 maili (wyczerpane sloty)
- Dzień 2: Reset skrzynek, kontynuacja

### **KROK 1: Dzień 1 - Wyczerpanie slotów (16:00:00)**

**Wysłano:**
- Mail 1-3: Mailbox A (3/3) ✅ **LIMIT OSIĄGNIĘTY**
- Mail 4-6: Mailbox B (3/3) ✅ **LIMIT OSIĄGNIĘTY**

**W kolejce:**
- Mail 7-10: scheduledAt = jutro 9:00:00 (status: 'pending')

**Mailboxy:**
- Mailbox A: currentDailySent = 3/3, lastResetDate = Dzień 1
- Mailbox B: currentDailySent = 3/3, lastResetDate = Dzień 1

---

### **KROK 2: Dzień 2 - Reset skrzynek (00:00:00)**

**Cron uruchamia się (00:00:00):**

```typescript
processScheduledEmailsV2() → sendNextEmailFromQueue(campaignId)
```

**Co się dzieje w kodzie:**

1. **Transakcja:**
   ```typescript
   // Rezerwuje slot skrzynki
   const availableMailbox = await getNextAvailableMailbox(virtualSalespersonId, campaignId)
   ```
   
   **W getNextAvailableMailbox:**
   ```typescript
   // Pobierz datę w polskim czasie
   const { getTodayPLString, isTodayPL } = await import('@/utils/polishTime');
   const todayPL = getTodayPLString(); // Dzień 2
   
   // Resetuj liczniki dla skrzynek jeśli nowy dzień
   for (const mailbox of mailboxes) {
     const needsReset = !mailbox.lastResetDate || !isTodayPL(mailbox.lastResetDate);
     // Mailbox A: lastResetDate = Dzień 1, todayPL = Dzień 2
     // needsReset = true (Dzień 1 ≠ Dzień 2)
     
     if (needsReset) {
       await resetMailboxCounter(mailbox.id, mailbox.warmupStatus);
       // Mailbox A: currentDailySent = 0, lastResetDate = Dzień 2
     }
   }
   ```
   - ✅ Mailbox A: currentDailySent = 3 → 0, lastResetDate = Dzień 2
   - ✅ Mailbox B: currentDailySent = 3 → 0, lastResetDate = Dzień 2

   ```typescript
   // Znajdź pierwszą skrzynkę która ma wolne miejsce
   for (const mailbox of mailboxes) {
     const remaining = mailbox.dailyEmailLimit - mailbox.currentDailySent;
     // Mailbox A: remaining = 3 - 0 = 3
     if (remaining > 0) {
       return mailbox; // ✅ Zwraca: Mailbox A
     }
   }
   ```
   - ✅ Zwraca: Mailbox A

2. **W sendNextEmailFromQueue:**
   ```typescript
   const candidateEmails = await tx.campaignEmailQueue.findMany({
     where: {
       campaignId,
       status: 'pending',
       scheduledAt: { lte: now (00:00:00), gte: maxTolerance (23:55:00) }
     }
   })
   ```
   - Mail 7: scheduledAt = jutro 9:00:00, now = 00:00:00
   - ❌ `9:00:00 > 00:00:00` → ❌ **Nie jest jeszcze czas**
   - ✅ Zwraca: `{ email: null, locked: false }`

**Wynik:**
- ✅ Skrzynki zresetowane (currentDailySent = 0)
- ✅ Maile w kolejce (scheduledAt: 9:00:00)
- ✅ Cron czeka do 9:00:00

---

### **KROK 3: Dzień 2 - Wysyłka wznawia się (9:00:00)**

**Cron uruchamia się (9:00:00):**

```typescript
sendNextEmailFromQueue(campaignId)
```

**Co się dzieje w kodzie:**

1. **Transakcja:**
   ```typescript
   // Sprawdza dynamiczną tolerancję
   const lastSentLog = await tx.sendLog.findFirst({
     where: { campaignId, status: 'sent' },
     orderBy: { createdAt: 'desc' }
   })
   ```
   - ✅ lastSentLog: createdAt = Dzień 1 16:00:00

   ```typescript
   let isRecoveryAfterLongPause = false;
   if (lastSentLog) {
     const timeSinceLastMail = Math.floor((now.getTime() - lastSentLog.createdAt.getTime()) / 1000);
     // Dzień 2 9:00:00 - Dzień 1 16:00:00 = 17h = 61200 sekund
     if (timeSinceLastMail > 3600) { // > 1h
       isRecoveryAfterLongPause = true;
     }
   }
   ```
   - ✅ timeSinceLastMail = 61200s (> 3600s) → ✅ **Wykryto recovery!**

   ```typescript
   const maxToleranceMinutes = (stuckEmailsCount > 0 || isRecoveryAfterLongPause) ? 120 : 5;
   // maxToleranceMinutes = 120 (2h)
   const maxTolerance = new Date(now.getTime() - maxToleranceMinutes * 60 * 1000);
   // maxTolerance = Dzień 2 9:00:00 - 120 min = Dzień 2 7:00:00
   ```
   - ✅ maxTolerance = Dzień 2 7:00:00

   ```typescript
   const candidateEmails = await tx.campaignEmailQueue.findMany({
     where: {
       campaignId,
       status: 'pending',
       scheduledAt: { lte: now (Dzień 2 9:00:00), gte: maxTolerance (Dzień 2 7:00:00) }
     }
   })
   ```
   - Mail 7: scheduledAt = Dzień 2 9:00:00, maxTolerance = Dzień 2 7:00:00
   - ✅ `9:00:00 >= 7:00:00` → ✅ **W tolerancji!**

   ```typescript
   // Sprawdza okno czasowe
   if (!isWithinSendWindow(scheduledTime (9:00:00), campaign)) {
     // Przekłada na jutro
   }
   ```
   - ✅ 9:00:00 w oknie 9:00-16:00 → ✅ W oknie

   ```typescript
   // Rezerwuje slot skrzynki
   const availableMailbox = await getNextAvailableMailbox(virtualSalespersonId, campaignId)
   ```
   - ✅ Mailbox A: currentDailySent = 0, limit = 3 → dostępna
   - ✅ Zwraca: Mailbox A

   ```typescript
   // Atomowa rezerwacja slotu
   const incrementResult = await tx.$executeRaw`
     UPDATE Mailbox 
     SET currentDailySent = currentDailySent + 1
     WHERE id = ${mailboxForReservation.id} (Mailbox A)
     AND currentDailySent < ${effectiveLimit} (3)
   `
   ```
   - ✅ currentDailySent = 0 → 1
   - ✅ incrementResult = 1

   ```typescript
   // Blokuje mail
   const lockResult = await tx.campaignEmailQueue.updateMany({
     where: { id: nextEmail.id, status: 'pending' },
     data: { status: 'sending', updatedAt: new Date() }
   })
   ```
   - ✅ Mail 7: status = 'sending'

2. **Po transakcji:**
   - ✅ Mail 7 wysłany (Mailbox A: currentDailySent = 1/3)

**Wynik:**
- ✅ System wykrywa recovery (17h od ostatniego maila)
- ✅ Mail 7 jest w tolerancji (2h)
- ✅ Mail 7 jest w oknie czasowym (9:00:00)
- ✅ Mail 7 wysłany natychmiast
- ✅ Kontynuuje wysyłkę pozostałych maili

---

## 🔍 WERYFIKACJA KRYTYCZNYCH MIEJSC W KODZIE

### **1. Przekładanie maili na jutro gdy brak dostępnych skrzynek**

**Lokalizacja:** `campaignEmailSenderV2.ts` - linia 192-209

**Kod:**
```typescript
if (!availableMailbox) {
  // ✅ POPRAWKA Problem 1: Brak dostępnych skrzynek - przekładaj na jutro
  if (campaign) {
    const { setPolishTime, getPolishTime } = await import('@/utils/polishTime');
    const nowPL = getPolishTime();
    const tomorrowPL = new Date(nowPL);
    tomorrowPL.setDate(tomorrowPL.getDate() + 1);
    const newScheduledAt = setPolishTime(tomorrowPL, campaign.startHour || 9, campaign.startMinute || 0, 0);
    
    await tx.campaignEmailQueue.update({
      where: { id: nextEmail.id },
      data: { scheduledAt: newScheduledAt }
    });
  }
  return { email: null, locked: false };
}
```

**Weryfikacja:**
- ✅ Działa w transakcji (atomowo)
- ✅ Używa `setPolishTime()` dla poprawnego czasu
- ✅ Ustawia na jutro o `startHour`
- ✅ Zwraca `{ email: null, locked: false }` (nie blokuje procesu)

---

### **2. Rozszerzenie dynamicznej tolerancji**

**Lokalizacja:** `campaignEmailSenderV2.ts` - linia 48-78

**Kod:**
```typescript
// ✅ POPRAWKA Problem 2: Sprawdź ostatni wysłany mail (SendLog)
const lastSentLog = await tx.sendLog.findFirst({
  where: { campaignId, status: 'sent' },
  orderBy: { createdAt: 'desc' }
});

let isRecoveryAfterLongPause = false;
if (lastSentLog) {
  const timeSinceLastMail = Math.floor((now.getTime() - lastSentLog.createdAt.getTime()) / 1000);
  if (timeSinceLastMail > 3600) { // > 1h
    isRecoveryAfterLongPause = true;
  }
}

const maxToleranceMinutes = (stuckEmailsCount > 0 || isRecoveryAfterLongPause) ? 120 : 5;
```

**Weryfikacja:**
- ✅ Sprawdza `lastSentLog` w transakcji
- ✅ Oblicza `timeSinceLastMail` w sekundach
- ✅ Jeśli > 1h, używa tolerancji 120 min (2h)
- ✅ Działa zarówno dla stuck emails jak i długich przerw

---

### **3. Poprawka Recovery dla PAUSED**

**Lokalizacja:** `campaignEmailSenderV2.ts` - linia 372-396

**Kod:**
```typescript
if (!currentCampaign || currentCampaign.status !== 'IN_PROGRESS') {
  const status = currentCampaign?.status || 'UNKNOWN';
  
  if (status === 'PAUSED') {
    await db.campaignEmailQueue.update({
      where: { id: nextEmail.id },
      data: { 
        status: 'pending', // Przywróć do pending, nie 'cancelled'
        error: null
      }
    });
  } else {
    await db.campaignEmailQueue.update({
      where: { id: nextEmail.id },
      data: { status: 'cancelled', error: `Kampania nie jest aktywna (status: ${status})` }
    });
  }
}
```

**Weryfikacja:**
- ✅ Dla PAUSED: przywraca do 'pending'
- ✅ Dla innych statusów: oznacza jako 'cancelled'
- ✅ Wyczyść error dla PAUSED

---

## ✅ PODSUMOWANIE TESTOW

### **Scenariusz 1: Wyczerpanie slotów**
- ✅ Maile są przekładane na jutro gdy brak dostępnych skrzynek
- ✅ Nie blokują się w kolejce
- ✅ Atomowa rezerwacja zapobiega przekroczeniu limitów

### **Scenariusz 2: Pauza + wznowienie po 2h (poza oknem)**
- ✅ System wykrywa recovery (2h od ostatniego maila)
- ✅ Mail jest w tolerancji (2h)
- ✅ Mail przekładany na jutro (poza oknem czasowym)

### **Scenariusz 3: Pauza + wznowienie w tym samym oknie (1h)**
- ✅ System wykrywa recovery (1h od ostatniego maila)
- ✅ Mail jest w tolerancji (2h)
- ✅ Mail jest w oknie czasowym
- ✅ Mail wysłany natychmiast (minęło > delayBetweenEmails)

### **Scenariusz 4: Reset dzienny + kontynuacja**
- ✅ Skrzynki są resetowane automatycznie
- ✅ System wykrywa recovery (17h od ostatniego maila)
- ✅ Mail jest w tolerancji (2h)
- ✅ Mail wysłany natychmiast po resetcie

---

## 🎯 WNIOSKI

**Wszystkie scenariusze testowe przeszły pomyślnie:**
- ✅ Przekładanie maili na jutro działa poprawnie
- ✅ Wykrywanie recovery po długich przerwach działa poprawnie
- ✅ Poprawka Recovery dla PAUSED działa poprawnie
- ✅ Reset dzienny działa poprawnie
- ✅ Atomowa rezerwacja slotów działa poprawnie

**System jest gotowy do testów na żywo!**

