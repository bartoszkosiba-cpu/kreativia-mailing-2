# 🔄 STRATEGIA IMPLEMENTACJI - Równoległe podejście

## ✅ REKOMENDACJA: Piszemy nowy kod równolegle, potem usuwamy stary

### Dlaczego równolegle?

1. **Bezpieczeństwo** - stary system działa dalej, nie ryzykujemy
2. **Testowanie** - możemy testować nowy system na jednej kampanii
3. **Rollback** - łatwo wrócić do starego jeśli coś pójdzie nie tak
4. **Stopniowe przełączanie** - kampanie jedna po drugiej
5. **Porównywanie** - możemy sprawdzić czy nowy system działa tak samo jak stary

---

## 📁 STRUKTURA PLIKÓW

### Nowe pliki (V2):
```
src/services/
  ├── campaignEmailQueueV2.ts      ← Nowa kolejka
  ├── campaignEmailSenderV2.ts     ← Nowy sender
  └── campaignMigration.ts          ← Migracja istniejących kampanii
```

### Stare pliki (do usunięcia później):
```
src/services/
  ├── campaignEmailQueue.ts        ← Stara kolejka (DEPRECATED)
  ├── campaignEmailSender.ts       ← Stary sender (DEPRECATED)
  └── scheduledSender.ts           ← Stary sender (DEPRECATED)
```

### Cron job (stopniowo przełączamy):
```
src/services/emailCron.ts
  ├── Stary kod: processScheduledCampaign()  ← DEPRECATED
  └── Nowy kod: processScheduledEmailsV2()   ← NOWY
```

---

## 🎯 PLAN IMPLEMENTACJI FAZA PO FAZIE

### FAZA 1: Nowe pliki (2-3h)

#### 1.1 Utworzenie nowych serwisów
```typescript
// src/services/campaignEmailQueueV2.ts
// - initializeQueueV2()
// - getNextEmailForCampaign()
// - lockEmail()
// - scheduleNextEmail()

// src/services/campaignEmailSenderV2.ts
// - sendEmailFromQueue()
// - processScheduledEmails()

// src/services/campaignMigration.ts
// - analyzeCampaignState()
// - fixCampaignStatuses()
// - migrateCampaignToV2()
```

#### 1.2 Cron job - równoległe działanie
```typescript
// src/services/emailCron.ts

// STARY SYSTEM (działa dalej)
cron.schedule('*/1 * * * *', async () => {
  // Stary kod - działa dla wszystkich kampanii
  await processScheduledCampaign();
}, { timezone: 'Europe/Warsaw' });

// NOWY SYSTEM (test na jednej kampanii)
cron.schedule('*/30 * * * *', async () => {
  // Nowy kod - tylko dla kampanii z flagą useV2=true
  await processScheduledEmailsV2();
}, { timezone: 'Europe/Warsaw' });
```

#### 1.3 Flaga w bazie (opcjonalnie)
```sql
-- Dodaj kolumnę do Campaign
ALTER TABLE Campaign ADD COLUMN useV2 BOOLEAN DEFAULT 0;
```

LUB w kodzie (bez migracji):
```typescript
// W processScheduledEmailsV2() - sprawdzamy flagę
const campaigns = await db.campaign.findMany({
  where: {
    status: 'IN_PROGRESS',
    // useV2: true  // Jeśli dodamy kolumnę
    // LUB: id: { in: [4] } // Test na kampanii 4
  }
});
```

---

### FAZA 2: Testowanie (1 tydzień)

#### 2.1 Test na jednej kampanii
- Wybierz kampanię testową (np. ID: 4)
- Włącz nowy system tylko dla niej
- Monitoruj przez 24-48h
- Porównaj wyniki ze starym systemem

#### 2.2 Weryfikacja
- ✅ Czy maile są wysyłane?
- ✅ Czy nie ma duplikatów?
- ✅ Czy harmonogram jest respektowany?
- ✅ Czy limity są przestrzegane?

#### 2.3 Debugowanie
- Napraw błędy w nowym systemie
- Dopracuj logikę
- Upewnij się że wszystko działa

---

### FAZA 3: Stopniowe przełączanie (1 tydzień)

#### 3.1 Przełączanie kampanii jedna po drugiej
```typescript
// Dla każdej kampanii:
1. Zmigruj kampanię do V2 (migrateCampaignToV2)
2. Włącz nowy system dla tej kampanii
3. Monitoruj przez 24h
4. Jeśli OK → następna kampania
5. Jeśli problemy → rollback do starego
```

#### 3.2 Przykład:
```
Dzień 1: Kampania 4 → V2 ✅
Dzień 2: Kampania 5 → V2 ✅
Dzień 3: Kampania 6 → V2 ✅
...
```

---

### FAZA 4: Pełne przełączenie (1 tydzień)

#### 4.1 Wszystkie kampanie na V2
- Przełącz wszystkie kampanie
- Wyłącz stary system w cron
- Monitoruj przez tydzień

#### 4.2 Cleanup (po 1 miesiącu)
- Usuń stare pliki
- Usuń stary kod z cron
- Usuń nieużywane funkcje

---

## 🔀 PRZYKŁADOWY KOD - Równoległe działanie

### Cron job z równoległym działaniem:
```typescript
// src/services/emailCron.ts

import { processScheduledCampaign } from './scheduledSender'; // STARY
import { processScheduledEmailsV2 } from './campaignEmailSenderV2'; // NOWY

// STARY SYSTEM - działa dla wszystkich kampanii
cron.schedule('*/1 * * * *', async () => {
  console.log('[CRON OLD] Sprawdzanie kampanii (stary system)...');
  await processScheduledCampaign();
}, { timezone: 'Europe/Warsaw' });

// NOWY SYSTEM - tylko dla kampanii testowych
cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON V2] Sprawdzanie kampanii (nowy system)...');
  await processScheduledEmailsV2();
}, { timezone: 'Europe/Warsaw' });
```

### Nowy sender - sprawdza czy kampania używa V2:
```typescript
// src/services/campaignEmailSenderV2.ts

export async function processScheduledEmailsV2() {
  // TYLKO kampanie testowe (np. ID: 4)
  const testCampaignIds = [4]; // TODO: później wszystkie
  
  const campaigns = await db.campaign.findMany({
    where: {
      id: { in: testCampaignIds },
      status: 'IN_PROGRESS'
    }
  });
  
  for (const campaign of campaigns) {
    // Sprawdź czy trzeba zrobić migrację
    const queueCount = await db.campaignEmailQueue.count({
      where: {
        campaignId: campaign.id,
        status: { in: ['pending', 'sending'] }
      }
    });
    
    if (queueCount === 0) {
      // Automatyczna migracja
      await migrateCampaignToV2(campaign.id);
    }
    
    // Przetwórz maile z kolejki
    await sendNextEmailFromQueue(campaign.id);
  }
}
```

---

## 🚨 ZAPOBIEGANIE KONFLIKTOM

### Problem: Dwa systemy próbują wysłać ten sam mail

**Rozwiązanie 1: Flaga w bazie**
```sql
-- Campaign.useV2 = true → tylko V2
-- Campaign.useV2 = false → tylko stary
```

**Rozwiązanie 2: Sprawdzanie SendLog**
```typescript
// W obu systemach - PRZED wysyłką sprawdź SendLog
const existing = await db.sendLog.findFirst({
  where: {
    campaignId,
    leadId,
    status: 'sent'
  }
});

if (existing) {
  // Już wysłano - pomiń
  return;
}
```

**Rozwiązanie 3: Atomic locking**
```typescript
// Tylko V2 używa CampaignEmailQueue z atomic locking
// Stary system używa CampaignLead.status
// Nie ma konfliktu bo różne tabele
```

---

## 📋 CHECKLIST IMPLEMENTACJI

### FAZA 1: Nowe pliki
- [ ] Utworzyć `campaignEmailQueueV2.ts`
- [ ] Utworzyć `campaignEmailSenderV2.ts`
- [ ] Utworzyć `campaignMigration.ts`
- [ ] Dodać nowy cron job (równolegle)
- [ ] Test na kampanii ID: 4

### FAZA 2: Testowanie
- [ ] Monitorować kampanię testową przez 24h
- [ ] Weryfikować brak duplikatów
- [ ] Weryfikować harmonogram
- [ ] Naprawić błędy
- [ ] Zatwierdzić że działa

### FAZA 3: Przełączanie
- [ ] Migrować kampanię 5
- [ ] Migrować kampanię 6
- [ ] Migrować wszystkie kampanie
- [ ] Monitorować każdą przez 24h

### FAZA 4: Cleanup
- [ ] Wyłączyć stary cron
- [ ] Usunąć stare pliki
- [ ] Usunąć nieużywany kod
- [ ] Zaktualizować dokumentację

---

## ⚠️ WAŻNE ZASADY

1. **Nie dotykaj starego kodu** - działa dalej, nie zmieniaj go
2. **Nowy kod obok starego** - osobne pliki, osobne funkcje
3. **Testuj na jednej kampanii** - zanim przełączysz wszystkie
4. **Monitoruj wszystko** - logi, metryki, błędy
5. **Rollback ready** - możesz wrócić do starego w każdej chwili

---

## 🎯 KONKRETNY PLAN AKCJI

### KROK 1: Utworzyć nowe pliki (dzisiaj)
```
1. Stwórz campaignEmailQueueV2.ts
2. Stwórz campaignEmailSenderV2.ts  
3. Stwórz campaignMigration.ts
4. Dodaj nowy cron (równolegle ze starym)
```

### KROK 2: Test na kampanii 4 (jutro)
```
1. Włącz V2 dla kampanii 4
2. Monitoruj przez 24h
3. Porównaj z innymi kampaniami
```

### KROK 3: Jeśli OK → więcej kampanii (za tydzień)
```
1. Migruj kampanię 5
2. Migruj kampanię 6
3. ...
```

### KROK 4: Pełne przełączenie (za 2 tygodnie)
```
1. Wszystkie kampanie na V2
2. Wyłącz stary system
```

### KROK 5: Cleanup (za miesiąc)
```
1. Usuń stare pliki
2. Usuń stary kod
```

---

**Data utworzenia**: 2025-11-04
**Status**: Gotowy do implementacji
**Strategia**: Równoległe podejście ✅


