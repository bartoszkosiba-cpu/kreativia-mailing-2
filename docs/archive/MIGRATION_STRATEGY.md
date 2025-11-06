# 🔄 STRATEGIA MIGRACJI - Kontynuacja istniejących kampanii

## ✅ ODPOWIEDŹ: TAK, możemy kontynuować już rozpoczęte kampanie!

---

## 📊 OBECNY STAN KAMPANII

### Jak obecny system śledzi postęp:

1. **SendLog** - pełna historia wysłanych maili
   - `campaignId`, `leadId`, `status: 'sent'/'error'`
   - `createdAt` - kiedy wysłano
   - `toEmail`, `subject`, `content`

2. **CampaignLead** - status leada w kampanii
   - `status: 'planned' | 'queued' | 'sending' | 'sent' | 'failed'`
   - Pokazuje które leady są w trakcie wysyłki

3. **CampaignEmailQueue** - obecna kolejka
   - `status: 'pending' | 'sending' | 'sent' | 'failed'`
   - `scheduledAt` - kiedy zaplanowano

---

## 🔍 ANALIZA: Co musimy wiedzieć o istniejącej kampanii?

### Pytania:
1. ✅ **Które leady już otrzymały maile?**
   - Odpowiedź: Sprawdzamy `SendLog` gdzie `campaignId=X AND status='sent'`
   
2. ✅ **Które leady są w kolejce?**
   - Odpowiedź: Sprawdzamy `CampaignLead` gdzie `campaignId=X AND status='queued'`
   
3. ✅ **Kiedy był ostatni wysłany mail?**
   - Odpowiedź: `MAX(SendLog.createdAt) WHERE campaignId=X AND status='sent'`

4. ✅ **Ile maili zostało do wysłania?**
   - Odpowiedź: Liczba leadów w `CampaignLead` ze statusem `'queued'` lub `'planned'`

---

## 🚀 PLAN MIGRACJI ISTNIEJĄCYCH KAMPANII

### OPCJA 1: Płynna migracja (RECOMMENDED)

**Zasada:**
1. Nowy system **odczytuje** stan obecnej kampanii
2. **Nie resetuje** niczego
3. **Kontynuuje** wysyłkę od miejsca, gdzie się zatrzymała

**Kroki:**

#### Krok 1: Analiza stanu kampanii
```typescript
async function analyzeCampaignState(campaignId: number) {
  // 1. Ostatni wysłany mail
  const lastSentLog = await db.sendLog.findFirst({
    where: { campaignId, status: 'sent' },
    orderBy: { createdAt: 'desc' }
  });
  
  // 2. Leady które już otrzymały mail
  const sentLeadIds = await db.sendLog.findMany({
    where: { campaignId, status: 'sent' },
    select: { leadId: true }
  }).then(logs => new Set(logs.map(l => l.leadId)));
  
  // 3. Leady które jeszcze nie otrzymały maila
  const pendingLeads = await db.campaignLead.findMany({
    where: {
      campaignId,
      leadId: { notIn: Array.from(sentLeadIds) },
      status: { in: ['queued', 'planned'] }
    },
    include: { lead: true }
  });
  
  return {
    lastSentAt: lastSentLog?.createdAt || null,
    sentCount: sentLeadIds.size,
    pendingCount: pendingLeads.length,
    pendingLeads
  };
}
```

#### Krok 2: Inicjalizacja kolejki dla istniejącej kampanii
```typescript
async function initializeQueueForExistingCampaign(
  campaignId: number,
  bufferSize: number = 20
) {
  const state = await analyzeCampaignState(campaignId);
  
  // Jeśli nie ma żadnych maili do wysłania - koniec
  if (state.pendingCount === 0) {
    console.log(`[MIGRATION] Campaign ${campaignId}: No pending leads`);
    return 0;
  }
  
  // Pobierz ustawienia kampanii
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { delayBetweenEmails: true }
  });
  
  // Oblicz bazowy czas dla pierwszego maila
  let baseTime: Date;
  if (state.lastSentAt) {
    // Jeśli był już wysłany mail, planuj następny po delay
    baseTime = calculateNextEmailTime(
      state.lastSentAt,
      campaign.delayBetweenEmails || 90
    );
  } else {
    // Jeśli to pierwszy mail, planuj od teraz
    baseTime = new Date();
  }
  
  // Dodaj leady do kolejki
  let added = 0;
  let currentTime = baseTime;
  
  for (const campaignLead of state.pendingLeads.slice(0, bufferSize)) {
    await db.campaignEmailQueue.create({
      data: {
        campaignId,
        campaignLeadId: campaignLead.id,
        scheduledAt: currentTime,
        status: 'pending'
      }
    });
    
    // Oblicz czas następnego maila
    currentTime = calculateNextEmailTime(
      currentTime,
      campaign.delayBetweenEmails || 90
    );
    added++;
  }
  
  console.log(`[MIGRATION] Campaign ${campaignId}: Added ${added} emails to queue`);
  return added;
}
```

#### Krok 3: Automatyczna detekcja i migracja
```typescript
// W processScheduledEmails() - na początku
async function migrateExistingCampaigns() {
  // Znajdź kampanie IN_PROGRESS które nie mają maili w kolejce
  const campaignsWithoutQueue = await db.campaign.findMany({
    where: {
      status: 'IN_PROGRESS',
      campaignEmailQueue: {
        none: {
          status: { in: ['pending', 'sending'] }
        }
      }
    }
  });
  
  for (const campaign of campaignsWithoutQueue) {
    console.log(`[MIGRATION] Detected campaign ${campaign.id} without queue - migrating...`);
    await initializeQueueForExistingCampaign(campaign.id);
  }
}
```

---

## ⚠️ POTENCJALNE PROBLEMY I ROZWIĄZANIA

### Problem 1: Duplikaty w kolejce
**Sytuacja**: Stary system ma maila w `CampaignEmailQueue` ze statusem `'sending'`, nowy system próbuje dodać ponownie.

**Rozwiązanie:**
```typescript
// Przed dodaniem do kolejki, sprawdź czy już istnieje
const existing = await db.campaignEmailQueue.findFirst({
  where: {
    campaignId,
    campaignLeadId,
    status: { in: ['pending', 'sending'] }
  }
});

if (existing) {
  // Pomiń - już jest w kolejce
  return;
}
```

### Problem 2: Niespójność statusów
**Sytuacja**: `CampaignLead` ma status `'sending'`, ale `SendLog` pokazuje że mail już został wysłany.

**Rozwiązanie:**
```typescript
// Przed migracją, napraw statusy
async function fixCampaignLeadStatuses(campaignId: number) {
  // Leady które mają mail w SendLog, ale CampaignLead.status != 'sent'
  const sentLeads = await db.sendLog.findMany({
    where: { campaignId, status: 'sent' },
    select: { leadId: true }
  }).then(logs => new Set(logs.map(l => l.leadId)));
  
  // Zaktualizuj statusy
  await db.campaignLead.updateMany({
    where: {
      campaignId,
      leadId: { in: Array.from(sentLeads) },
      status: { not: 'sent' }
    },
    data: { status: 'sent' }
  });
  
  // Leady które są 'sending' ale nie ma maila w SendLog - resetuj do 'queued'
  await db.campaignLead.updateMany({
    where: {
      campaignId,
      status: 'sending',
      lead: {
        id: { notIn: Array.from(sentLeads) }
      }
    },
    data: { status: 'queued' }
  });
}
```

### Problem 3: Stara kolejka jeszcze działa
**Sytuacja**: Stary system (`campaignEmailSender.ts`) może jeszcze próbować wysyłać maile.

**Rozwiązanie:**
```typescript
// W starym systemie - dodaj flagę "migrated"
// Albo po prostu wyłącz go przed migracją

// W emailCron.ts:
// if (campaign.migratedToV2) {
//   // Pomiń stary system
//   continue;
// }
```

---

## 📋 CHECKLIST PRZED MIGRACJĄ

### Dla każdej kampanii IN_PROGRESS:

- [ ] Sprawdź stan w `SendLog` - ile maili wysłano?
- [ ] Sprawdź stan w `CampaignLead` - ile leadów w kolejce?
- [ ] Sprawdź czy `CampaignEmailQueue` ma jakieś wpisy
- [ ] Napraw niespójności statusów (fixCampaignLeadStatuses)
- [ ] Wyczyść starą kolejkę (jeśli istnieje)
- [ ] Zainicjalizuj nową kolejkę (initializeQueueForExistingCampaign)
- [ ] Zweryfikuj że kolejka jest poprawna (test wysyłki)

---

## 🎯 PLAN IMPLEMENTACJI MIGRACJI

### FAZA 1: Narzędzia analityczne (30 min)
```typescript
// src/services/campaignMigration.ts

// 1. Analiza stanu kampanii
export async function analyzeCampaignState(campaignId: number)

// 2. Naprawa statusów
export async function fixCampaignStatuses(campaignId: number)

// 3. Inicjalizacja kolejki dla istniejącej kampanii
export async function migrateCampaignToV2(campaignId: number)
```

### FAZA 2: Automatyczna detekcja (30 min)
```typescript
// W processScheduledEmails() - na początku
// Automatycznie wykryj kampanie które potrzebują migracji
// I zrób to automatycznie
```

### FAZA 3: Testy manualne (1h)
- Wybierz jedną kampanię testową
- Przeanalizuj jej stan
- Wykonaj migrację
- Zweryfikuj że wszystko działa

### FAZA 4: Produkcyjna migracja (1h)
- Migracja wszystkich kampanii IN_PROGRESS
- Monitoring każdej kampanii przez 24h
- Rollback w razie problemów

---

## ✅ GŁÓWNE ZAŁOŻENIA

1. **Nie resetujemy kampanii** - kontynuujemy od miejsca gdzie się zatrzymała
2. **Nie tracimy danych** - wszystko oparte na `SendLog` i `CampaignLead`
3. **Automation first** - system automatycznie wykrywa i migruje
4. **Safety first** - przed migracją naprawiamy niespójności
5. **Rollback ready** - możemy wrócić do starego systemu jeśli potrzeba

---

## 🔄 PRZYKŁAD MIGRACJI

### Kampania ID: 4
- Status: `IN_PROGRESS`
- Ostatni wysłany mail: `2025-11-04 14:30:00`
- Wysłanych maili: 150 (z `SendLog`)
- Leadów w kolejce: 50 (z `CampaignLead` status='queued')
- Opóźnienie: 90s

### Co się dzieje przy migracji:

1. **Analiza**:
   ```
   [MIGRATION] Campaign 4:
   - Last sent: 2025-11-04 14:30:00
   - Sent: 150
   - Pending: 50
   ```

2. **Naprawa statusów**:
   ```
   [MIGRATION] Fixing statuses...
   - Updated 3 leads from 'sending' to 'sent' (already sent)
   - Updated 2 leads from 'sending' to 'queued' (not sent yet)
   ```

3. **Inicjalizacja kolejki**:
   ```
   [MIGRATION] Initializing queue...
   - First email scheduled: 2025-11-04 14:31:30 (90s after last sent)
   - Added 20 emails to queue
   - Next batch will be added after first email is sent
   ```

4. **Kontynuacja**:
   - System wysyła maile zgodnie z nową kolejką
   - Po każdym wysłanym mailu, automatycznie dodaje następny
   - Wszystko działa płynnie

---

**Data utworzenia**: 2025-11-04
**Status**: Gotowy do implementacji
**Odpowiedź**: TAK, możemy kontynuować istniejące kampanie! ✅


