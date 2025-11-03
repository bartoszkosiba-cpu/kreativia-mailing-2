# KOMPLEKSOWA STRATEGIA WYSYŁKI KAMPANII

## 📋 CELE STRATEGII

1. **Dokładne planowanie** - Każdy mail ma precyzyjny czas wysyłki
2. **Losowość ±20%** - Naturalna zmienność między mailami
3. **Obsługa przerw serwera** - Kontynuacja od kolejnego maila (nie pomijamy)
4. **Kontynuacja między dniami** - Automatyczne wznowienie
5. **Dynamiczny delay** - Dostosowanie do dostępności skrzynek i czasu
6. **Wyświetlanie w UI** - Pokazujemy zaplanowany czas następnego maila

---

## 🗄️ SCHEMAT BAZY DANYCH

### Nowa tabela: `CampaignEmailQueue`

```prisma
model CampaignEmailQueue {
  id            Int      @id @default(autoincrement())
  campaignId    Int
  campaign      Campaign @relation(fields: [campaignId], references: [id])
  leadId        Int
  lead          Lead     @relation(fields: [leadId], references: [id])
  
  scheduledAt   DateTime  // Dokładny czas planowanej wysyłki
  status        String    @default("pending") // pending, sent, skipped
  
  // Metadata
  createdAt     DateTime  @default(now())
  sentAt        DateTime?
  
  @@index([campaignId, status])
  @@index([scheduledAt, status])
  @@unique([campaignId, leadId]) // Jeden mail na lead w kampanii
}
```

---

## 🔄 FLOW OPERACJI

### 1. START KAMPANII

```
Uruchomienie kampanii (ręczne lub scheduledAt)
↓
Status: SCHEDULED → IN_PROGRESS
↓
Oblicz czas pierwszego maila:
  - Jeśli TERAZ jest w oknie czasowym → START = TERAZ
  - Jeśli TERAZ przed oknem → START = początek okna
  - Jeśli TERAZ po oknie → START = początek okna następnego dnia
↓
Zaplanuj pierwszy mail:
  scheduledAt = START
  status = pending
↓
Zapisz w CampaignEmailQueue
```

**Kod:**
```typescript
async function scheduleFirstEmail(campaign: Campaign): Promise<void> {
  const now = new Date();
  const startTime = calculateCampaignStartTime(campaign, now);
  
  const firstLead = await getNextUnsentLead(campaign.id);
  if (!firstLead) return;
  
  await db.campaignEmailQueue.create({
    data: {
      campaignId: campaign.id,
      leadId: firstLead.id,
      scheduledAt: startTime,
      status: 'pending'
    }
  });
}
```

---

### 2. WYSYŁKA MAILA

```
Cron uruchamia się co 1 minutę
↓
Znajdź maile gotowe do wysłania:
  WHERE status = 'pending'
  AND scheduledAt <= NOW
  (NIE MA ograniczenia wieku - kontynuujemy zawsze)
↓
Dla każdego gotowego maila:
  - Sprawdź okno czasowe (czy jeszcze jest w oknie?)
  - Sprawdź limit dzienny
  - Sprawdź dostępność skrzynek
  - WYŚLIJ mail
  - Status: pending → sent
  - Zapisz do SendLog
  - ZAPLANUJ NASTĘPNY MAIL (patrz sekcja 3)
```

**Kod:**
```typescript
async function processScheduledCampaign(): Promise<void> {
  const now = new Date();
  
  // Znajdź gotowe maile (scheduledAt <= NOW)
  // NIE ma ograniczenia wieku - kontynuujemy od kolejnego maila
  const readyEmails = await db.campaignEmailQueue.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now } // Czas minął (niezależnie od tego jak dawno)
    },
    include: { campaign: true, lead: true },
    orderBy: { scheduledAt: 'asc' },
    take: 10 // Max 10 maili na wywołanie cron
  });
  
  for (const queueItem of readyEmails) {
    // Sprawdź wszystkie warunki (okno czasowe, limity, skrzynki)
    if (await canSendEmail(queueItem)) {
      await sendEmailFromQueue(queueItem);
      await scheduleNextEmail(queueItem.campaignId); // Zaplanuj następny
    }
  }
}
```

---

### 3. PLANOWANIE NASTĘPNEGO MAILA (po każdym wysłanym)

```
Po wysłaniu maila #N:
↓
Oblicz aktualny delay (dynamiczny):
  baseDelay = calculateDynamicDelay(campaign, now)
  ↓
  Z uwzględnieniem:
    - Pozostałe maile dzisiaj
    - Pozostały czas w oknie
    - Limity skrzynek
    - Max delay = delayBetweenEmails × 10 (zapobiega ekstremalnie długim delayom)
↓
Dodaj losowość ±20%:
  randomFactor = 0.8 + Math.random() * 0.4  // 0.8 - 1.2
  actualDelay = baseDelay × randomFactor
↓
Oblicz następny czas:
  nextScheduledAt = NOW + actualDelay
↓
Sprawdź czy jest w oknie czasowym:
  - Jeśli TAK → zapisz jako scheduledAt
  - Jeśli NIE → przesuń na początek następnego dnia w oknie
↓
Znajdź następnego leada (niewysłany):
  nextLead = getNextUnsentLead(campaignId)
↓
Zapisz w CampaignEmailQueue:
  scheduledAt = nextScheduledAt
  status = pending
```

**Kod:**
```typescript
async function scheduleNextEmail(campaignId: number): Promise<void> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: { virtualSalesperson: true }
  });
  
  // Znajdź następnego niewysłanego leada
  const nextLead = await getNextUnsentLead(campaignId);
  if (!nextLead) {
    // Kampania zakończona
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', sendingCompletedAt: new Date() }
    });
    return;
  }
  
  // Oblicz dynamiczny delay
  const now = new Date();
  const baseDelay = await calculateDynamicDelay(campaign, now);
  
  // Losowość ±20%
  const randomVariation = 0.2;
  const randomFactor = (1 - randomVariation) + Math.random() * (randomVariation * 2);
  const actualDelay = Math.floor(baseDelay * randomFactor);
  
  // Oblicz następny czas
  let nextScheduledAt = new Date(now.getTime() + actualDelay * 1000);
  
  // Sprawdź czy jest w oknie czasowym
  const isInWindow = await isValidSendTime(
    nextScheduledAt,
    campaign.allowedDays.split(','),
    campaign.startHour,
    campaign.startMinute ?? 0,
    campaign.endHour,
    campaign.endMinute ?? 0,
    campaign.respectHolidays,
    campaign.targetCountries?.split(',') || []
  );
  
  if (!isInWindow.isValid) {
    // Przesuń na początek następnego dnia w oknie
    nextScheduledAt = calculateNextWindowStart(campaign, nextScheduledAt);
  }
  
  // Zapisz w queue
  await db.campaignEmailQueue.create({
    data: {
      campaignId,
      leadId: nextLead.id,
      scheduledAt: nextScheduledAt,
      status: 'pending'
    }
  });
}
```

---

### 4. OBSŁUGA PRZERW SERWERA

#### Scenariusz A: Krótka przerwa (< 30 min)

```
Mail zaplanowany: 11:00:00
Serwer pada: 11:05:00
Serwer wraca: 11:20:00 (15 min przerwy)

Sprawdzenie:
  - scheduledAt (11:00) < NOW (11:20) ✅
  - Status = pending ✅
  - Czy w oknie czasowym? ✅

Akcja: WYŚLIJ NATYCHMIAST
```

#### Scenariusz B: Długa przerwa (jakakolwiek)

```
Mail zaplanowany: 11:00:00
Serwer pada: 11:05:00
Serwer wraca: 12:30:00 (85 min przerwy) lub 14:00:00 lub nawet następny dzień

Sprawdzenie:
  - scheduledAt < NOW ✅
  - Status = pending ✅
  - Czy w oknie czasowym? ✅

Akcja:
  1. WYŚLIJ TEN MAIL natychmiast (jeśli jeszcze w oknie)
  2. Oblicz ile czasu zostało w oknie
  3. Oblicz ile maili możemy jeszcze wysłać
  4. ZAPLANUJ NASTĘPNY MAIL normalnie (TERAZ + delay)
  5. KONTYNUUJ wysyłkę - nie nadrabiamy, nie pomijamy
```

**WAŻNE**: Po przerwie zawsze kontynuujemy od kolejnego maila w bazie. Nie pomijamy żadnych maili. Obliczamy ile czasu zostało i wysyłamy dalej normalnie.

#### Scenariusz C: Przerwa przez koniec okna + nowy dzień

```
Mail zaplanowany: 14:30:00 (dzień 1)
Serwer pada: 14:35:00
Koniec okna: 15:00:00
Serwer wraca: 09:00:00 (dzień 2)

Sprawdzenie:
  - scheduledAt z dnia 1, ale NOWY DZIEŃ
  - Status = pending
  - Czy w oknie czasowym? ✅ (nowy dzień)

Akcja:
  1. Jeśli mail z dnia 1 jest jeszcze w queue → WYŚLIJ go (to jest kolejny mail w bazie)
  2. Oblicz ile czasu zostało w oknie dnia 2
  3. Oblicz ile maili możemy wysłać dzisiaj
  4. ZAPLANUJ NASTĘPNY MAIL normalnie (TERAZ + delay)
  5. KONTYNUUJ wysyłkę - nie nadrabiamy, wysyłamy dalej od następnego maila
```

**WAŻNE**: Nawet jeśli przerwa była przez wiele dni, zawsze kontynuujemy od kolejnego niewysłanego maila w bazie.

**Kod:**
```typescript
async function handleServerRecovery(): Promise<void> {
  // Po powrocie serwera:
  // 1. Znajdź wszystkie pending maile (niezależnie od wieku)
  // 2. Wysyłaj je normalnie (jeśli w oknie czasowym)
  // 3. Kontynuuj planowanie następnych maili
  
  // NIE pomijamy żadnych maili - kontynuujemy od kolejnego w bazie
  // Nie nadrabiamy opóźnień - po prostu wysyłamy dalej
  
  // Logika jest taka sama jak w processScheduledCampaign()
  // Tylko że sprawdzamy również stare maile (scheduledAt < NOW)
}
```

---

### 5. OBLICZANIE DYNAMICZNEGO DELAY

```
Parametry:
  - campaign.delayBetweenEmails (bazowy, np. 90s)
  - Pozostałe maile dzisiaj
  - Pozostały czas w oknie
  - Dostępność skrzynek
  
Algorytm:
  1. Oblicz ile maili zostało dzisiaj:
     remainingEmails = emailsPerDay - sentToday
     
  2. Oblicz ile czasu zostało:
     secondsRemaining = (endWindow - NOW) - 1h margines
     
  3. Oblicz optymalny delay:
     optimalDelay = secondsRemaining / remainingEmails
     
  4. Ograniczenia:
     minDelay = delayBetweenEmails
     maxDelay = delayBetweenEmails × 10  // ← Maksymalny delay: jeśli zostało dużo maili a mało czasu, 
                                          // nie możemy zrobić delay = 1000s (za długo), 
                                          // więc max = 90s × 10 = 900s (15 min)
                                          // Zapobiega to ekstremalnie długim delayom
     
     finalDelay = clamp(optimalDelay, minDelay, maxDelay)
     
  5. Dodaj losowość ±20%:
     randomFactor = 0.8 + random(0.4)
     actualDelay = finalDelay × randomFactor
```

**Wyjaśnienie maxDelay × 10**: 
- Jeśli zostało 100 maili a tylko 30 min czasu, optimalDelay = 18s (za krótko)
- Jeśli zostało 2 maile a 5h czasu, optimalDelay = 9000s (za długo)
- MaxDelay × 10 zapobiega ekstremalnie długim delayom (np. > 15 min)

**Kod:**
```typescript
async function calculateDynamicDelay(
  campaign: Campaign,
  now: Date
): Promise<number> {
  const baseDelay = campaign.delayBetweenEmails || 90;
  
  // Oblicz pozostały czas w oknie
  const endWindow = new Date(now);
  endWindow.setHours(campaign.endHour, campaign.endMinute ?? 0, 0);
  endWindow.setMinutes(endWindow.getMinutes() - 60); // -1h margines
  
  const msRemaining = endWindow.getTime() - now.getTime();
  const secondsRemaining = Math.floor(msRemaining / 1000);
  
  // Jeśli brak czasu lub zbliżamy się do końca
  if (msRemaining <= 0 || secondsRemaining <= 300) {
    return baseDelay;
  }
  
  // Oblicz dostępność
  const { emailsPerDay } = await calculateTodayCapacity(
    campaign.virtualSalespersonId!,
    campaign.maxEmailsPerDay
  );
  
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  const sentToday = await db.sendLog.count({
    where: {
      campaignId: campaign.id,
      status: 'sent',
      createdAt: { gte: todayStart }
    }
  });
  
  const remainingEmails = Math.max(1, emailsPerDay - sentToday);
  
  // Oblicz optymalny delay
  const optimalDelay = Math.floor(secondsRemaining / remainingEmails);
  
  // Ograniczenia
  const minDelay = baseDelay;
  const maxDelay = baseDelay * 10;
  
  return Math.max(minDelay, Math.min(optimalDelay, maxDelay));
}
```

---

### 6. PRZEJŚCIE MIĘDZY DNIAMI

```
Dzień 1 - Koniec okna czasowego (15:00):
  - Ostatni mail wysłany: 14:55:00
  - Następny mail zaplanowany: 14:57:00 (już po oknie!)
  
Automatyczne przesunięcie:
  - Sprawdź czy scheduledAt jest poza oknem
  - Jeśli TAK → przesuń na początek następnego dnia:
    scheduledAt = następny_dzień 09:00:00 + delay
    status = pending
```

**Kod:**
```typescript
async function adjustScheduleForNextDay(campaignId: number): Promise<void> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId }
  });
  
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(campaign.endHour, campaign.endMinute ?? 0, 0);
  
  // Znajdź maile zaplanowane po końcu okna
  const futureEmails = await db.campaignEmailQueue.findMany({
    where: {
      campaignId,
      status: 'pending',
      scheduledAt: { gt: todayEnd }
    }
  });
  
  for (const email of futureEmails) {
    // Przesuń na początek następnego dnia
    const nextDay = calculateNextWindowStart(campaign, now);
    const delay = await calculateDynamicDelay(campaign, nextDay);
    
    await db.campaignEmailQueue.update({
      where: { id: email.id },
      data: {
        scheduledAt: new Date(nextDay.getTime() + delay * 1000)
      }
    });
  }
}
```

---

## ⚙️ KONFIGURACJA

### Parametry

```typescript
const CAMPAIGN_CONFIG = {
  // Cron frequency
  CRON_FREQUENCY: '1 minute', // Co 1 minutę (maksymalne opóźnienie: 1 min)
  // UWAGA: Nie ma limitu wieku maila - zawsze kontynuujemy od kolejnego maila
  
  // Losowość
  RANDOM_VARIATION: 0.2, // ±20%
  
  // Limity
  MAX_EMAILS_PER_CRON: 10, // Max maili wysyłanych na wywołanie cron
  
  // Max delay (zapobiega ekstremalnie długim delayom)
  MAX_DELAY_MULTIPLIER: 10 // Max delay = delayBetweenEmails × 10
};
```

---

## 📊 STATUSY W QUEUE

- **pending** - Zaplanowany, czeka na wysyłkę
- **sent** - Wysłany
- **skipped** - Pominięty (np. lead zablokowany)

**UWAGA**: Nie ma statusu "expired" - zawsze kontynuujemy od kolejnego maila w bazie

---

## 🔄 AUTOMATYCZNE CZYSZCZENIE

```typescript
// Codziennie o 02:00
async function cleanupOldQueueItems(): Promise<void> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  await db.campaignEmailQueue.deleteMany({
    where: {
      status: { in: ['sent', 'skipped'] },
      createdAt: { lt: weekAgo }
    }
  });
}
```

---

## ✅ ZALETY TEGO ROZWIĄZANIA

1. ✅ **Dokładność** - Każdy mail ma precyzyjny czas
2. ✅ **Losowość** - Naturalna zmienność ±20%
3. ✅ **Odporne na awarie** - Kontynuacja od kolejnego maila (nie pomijamy)
4. ✅ **Automatyczne** - Kontynuacja między dniami
5. ✅ **Dynamiczne** - Dostosowanie do sytuacji
6. ✅ **Skalowalne** - Działa dla dużych kampanii
7. ✅ **Przewidywalne** - Można zobaczyć zaplanowany czas następnego maila w UI

---

## 🖥️ WYŚWIETLANIE W UI

### Zakładka "Wysyłka" (`/campaigns/[id]`)

**Obecnie wyświetlane:**
- Ostatni mail wysłany: `3.11.2025, 11:47:37`

**DODAĆ:**
- **Następny mail zaplanowany:** `3.11.2025, 11:49:12`

**Jak to zaimplementować:**

```typescript
// app/api/campaigns/[id]/next-email-time/route.ts
const nextEmail = await db.campaignEmailQueue.findFirst({
  where: {
    campaignId: campaign.id,
    status: 'pending'
  },
  orderBy: { scheduledAt: 'asc' }
});

return NextResponse.json({
  lastSentAt: lastSentLog?.createdAt,
  nextScheduledAt: nextEmail?.scheduledAt, // ← Nowe pole!
  // ... reszta
});
```

**UI:**
```
Ostatni mail wysłany: 3.11.2025, 11:47:37
Następny mail zaplanowany: 3.11.2025, 11:49:12  ← NOWE!
```

---

## ⏰ JAK DZIAŁA CRON Z DOKŁADNYM CZASEM

**Pytanie**: Jeśli mail ma dokładny czas (11:02:35), to czy cron musi się uruchomić wcześniej?

**Odpowiedź**: NIE - cron sprawdza czy `scheduledAt <= NOW`. 

```
Mail zaplanowany: scheduledAt = 11:02:35
Cron uruchamia się: 11:02:00, 11:03:00, 11:04:00...

11:02:00 - Cron sprawdza: scheduledAt (11:02:35) > NOW (11:02:00) → nie wysyła
11:03:00 - Cron sprawdza: scheduledAt (11:02:35) <= NOW (11:03:00) → WYŚLIJ
```

**Maksymalne opóźnienie = częstotliwość cron**
- Cron co 1 min → max opóźnienie: 1 min (mail zaplanowany na 11:02:35 wyjdzie między 11:02:35-11:03:35)
- Cron co 5 min → max opóźnienie: 5 min (mail zaplanowany na 11:02:35 wyjdzie między 11:02:35-11:07:35)

**Rekomendacja**: Cron co 1 minutę dla precyzji

---

## 🚀 PLAN IMPLEMENTACJI

1. **Krok 1**: Dodaj tabelę `CampaignEmailQueue` do schema
2. **Krok 2**: Implementuj `scheduleFirstEmail()`
3. **Krok 3**: Implementuj `processScheduledCampaign()` z obsługą queue
4. **Krok 4**: Implementuj `scheduleNextEmail()` z losowością
5. **Krok 5**: Zmień cron na co 1 minutę
6. **Krok 6**: Dodaj wyświetlanie `nextScheduledAt` w UI
7. **Krok 7**: Testuj wszystkie scenariusze

---

## 📝 UWAGI

- Queue przechowuje **tylko kolejne maile**, nie wszystkie na raz (oszczędność miejsca)
- Po każdym wysłanym mailu planowany jest następny (na bieżąco)
- Harmonogram jest **dynamiczny** - dostosowuje się do sytuacji
- **Po przerwie serwera**: Zawsze kontynuujemy od kolejnego niewysłanego maila w bazie. Nie pomijamy żadnych maili. Obliczamy ile czasu zostało i wysyłamy dalej normalnie.
- **UI**: W zakładce "Wysyłka" wyświetlamy zaplanowany czas następnego maila (scheduledAt z queue)
- **MaxDelay × 10**: Zapobiega ekstremalnie długim delayom (> 15 min) gdy zostało mało maili a dużo czasu
