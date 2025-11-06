# 🚀 PLAN IMPLEMENTACJI - NOWY SYSTEM WYSYŁKI MAILI

## ✅ REKOMENDACJA: OPCJA A - Prosta kolejka z atomowym przetwarzaniem

### Dlaczego OPCJA A?

1. **Prostota** - łatwa do zrozumienia, debugowania i utrzymania
2. **Niezawodność** - atomic operations eliminują race conditions
3. **Brak dodatkowych zależności** - nie potrzebujemy Redis (jak w OPCJI B)
4. **Szybka implementacja** - możemy to zbudować na bazie istniejącego `CampaignEmailQueue`
5. **Sprawdzona koncepcja** - podobne systemy działają w produkcji

---

## 📋 PARAMETRY SYSTEMU

### Częstotliwość cron
- **Rekomendacja: 30 sekund**
- **Uzasadnienie**: 
  - Minimalne opóźnienie między mailami to 90s ± 20% = 72-108s
  - Cron co 30s daje dość precyzji bez przeciążania serwera
  - Alternatywa: 60s (jeśli 30s jest za często)

### Buffer size (ile maili planować z góry)
- **Rekomendacja: 20 maili**
- **Uzasadnienie**:
  - Wystarczająco dużo, aby system miał "co robić"
  - Nie za dużo, aby nie planować na zbyt daleko w przyszłość
  - Można zmienić w ustawieniach kampanii

### Retry logic
- **Liczba prób**: 3
- **Backoff**: Exponential (1 min, 5 min, 15 min)
- **Po 3 próbach**: Status `failed`, logowanie do admina

---

## 🏗️ ARCHITEKTURA SYSTEMU

### Komponenty

```
┌─────────────────────────────────────────────────────────────┐
│                    CRON JOB (co 30s)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  sendScheduledCampaignEmails()                      │   │
│  │  - Pobiera wszystkie aktywne kampanie              │   │
│  │  - Dla każdej: próbuje wysłać 1 mail               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              CampaignEmailQueue (Database)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  SELECT * WHERE status='pending'                     │   │
│  │    AND scheduledAt <= NOW()                          │   │
│  │    AND campaign.status='IN_PROGRESS'                 │   │
│  │  ORDER BY scheduledAt ASC                            │   │
│  │  LIMIT 1 PER CAMPAIGN                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Atomic Lock (per campaign)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  UPDATE CampaignEmailQueue                           │   │
│  │  SET status='sending'                                 │   │
│  │  WHERE id=? AND status='pending'                     │   │
│  │  RETURNING affected_rows                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Validate & Send                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. Sprawdź czy lead już otrzymał mail (SendLog)     │   │
│  │  2. Sprawdź dostępność skrzynki                       │   │
│  │  3. Sprawdź okno czasowe                             │   │
│  │  4. Wyślij mail                                      │   │
│  │  5. Zapisz do SendLog                                │   │
│  │  6. Update status: 'sending' → 'sent'/'failed'       │   │
│  │  7. Schedule next email for this campaign            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 IMPLEMENTACJA - FAZA PO FAZIE

### FAZA 1: Podstawowa struktura (2-3h)

#### 1.1 Nowy serwis: `campaignEmailQueueV2.ts`

```typescript
// src/services/campaignEmailQueueV2.ts

/**
 * FAZA 1: Podstawowe funkcje kolejki
 */

// 1. Inicjalizacja kolejki dla kampanii
export async function initializeQueueV2(
  campaignId: number,
  bufferSize: number = 20
): Promise<number> {
  // Pobierz kampanię
  // Pobierz leady w statusie 'queued'
  // Dla każdego leada:
  //   - Oblicz scheduledAt (baseTime + i * delay)
  //   - Dodaj do CampaignEmailQueue ze status='pending'
  // Zwróć liczbę dodanych maili
}

// 2. Pobierz następny mail do wysłania (per campaign)
export async function getNextEmailForCampaign(
  campaignId: number
): Promise<CampaignEmailQueue | null> {
  // SELECT * FROM CampaignEmailQueue
  // WHERE campaignId = ?
  //   AND status = 'pending'
  //   AND scheduledAt <= NOW()
  // ORDER BY scheduledAt ASC
  // LIMIT 1
}

// 3. Atomic lock
export async function lockEmail(
  queueId: number
): Promise<boolean> {
  // UPDATE CampaignEmailQueue
  // SET status = 'sending', updatedAt = NOW()
  // WHERE id = ? AND status = 'pending'
  // RETURN affected_rows
  // If affected_rows === 1 → locked successfully
}
```

#### 1.2 Nowy serwis: `campaignEmailSenderV2.ts`

```typescript
// src/services/campaignEmailSenderV2.ts

/**
 * FAZA 1: Podstawowa logika wysyłki
 */

// 1. Wysyłka jednego maila z kolejki
export async function sendEmailFromQueue(
  queueItem: CampaignEmailQueue
): Promise<{ success: boolean; error?: string }> {
  // 1. Pobierz campaign, lead, mailbox
  // 2. Sprawdź duplikat (SendLog)
  // 3. Sprawdź dostępność skrzynki
  // 4. Sprawdź okno czasowe
  // 5. Wyślij mail (sendSingleEmail)
  // 6. Zapisz do SendLog
  // 7. Update status: 'sending' → 'sent'
  // 8. Schedule next email
}

// 2. Główna funkcja dla cron
export async function processScheduledEmails(): Promise<void> {
  // 1. Pobierz wszystkie aktywne kampanie (IN_PROGRESS)
  // 2. Dla każdej kampanii:
  //    a. getNextEmailForCampaign()
  //    b. lockEmail()
  //    c. sendEmailFromQueue()
  // 3. Logowanie
}
```

#### 1.3 Aktualizacja cron

```typescript
// src/services/emailCron.ts

// Zmień na:
cron.schedule('*/30 * * * * *', async () => {
  // Co 30 sekund
  await processScheduledEmails();
}, { timezone: 'Europe/Warsaw' });
```

---

### FAZA 2: Odzyskiwanie i bezpieczeństwo (1-2h)

#### 2.1 Odblokowanie "zawieszonych" maili

```typescript
// W processScheduledEmails() na początku:
// Odblokuj maile w statusie 'sending' starsze niż 10 min
await db.campaignEmailQueue.updateMany({
  where: {
    status: 'sending',
    updatedAt: { lt: tenMinutesAgo }
  },
  data: { status: 'pending' }
});
```

#### 2.2 Sprawdzanie duplikatów

```typescript
// W sendEmailFromQueue():
// Sprawdź czy już wysłano (PRZED lockiem)
const existing = await db.sendLog.findFirst({
  where: {
    campaignId: queueItem.campaignId,
    leadId: queueItem.campaignLead.leadId,
    status: 'sent'
  }
});

if (existing) {
  // Oznacz jako 'sent' (nie wysyłaj ponownie)
  await db.campaignEmailQueue.update({
    where: { id: queueItem.id },
    data: { status: 'sent', sentAt: existing.createdAt }
  });
  return { success: true, skipped: true };
}
```

#### 2.3 Automatyczne planowanie następnego maila

```typescript
// Po wysłaniu maila:
export async function scheduleNextEmail(
  campaignId: number,
  lastSentAt: Date,
  delayBetweenEmails: number
): Promise<void> {
  // 1. Pobierz następnego leada w statusie 'queued'
  // 2. Oblicz: scheduledAt = lastSentAt + delay ± 20%
  // 3. Sprawdź czy scheduledAt jest w oknie czasowym
  // 4. Jeśli tak → dodaj do kolejki
  // 5. Jeśli nie → zaplanuj na następny dzień
}
```

---

### FAZA 3: Integracja z istniejącym systemem (1-2h)

#### 3.1 Migracja kampanii

```typescript
// Przy starcie kampanii:
// 1. Wyczyść starą kolejkę (jeśli istnieje)
// 2. Wywołaj initializeQueueV2()
// 3. Ustaw status kampanii na IN_PROGRESS
```

#### 3.2 Wyłączenie starego systemu

```typescript
// src/services/scheduledSender.ts
// Zostaw jako fallback, ale oznacz jako DEPRECATED
// W przyszłości można usunąć
```

---

### FAZA 4: Testy i monitoring (1-2h)

#### 4.1 Logowanie

```typescript
// Dodaj szczegółowe logi:
console.log(`[EMAIL V2] Campaign ${campaignId}: Found ${count} emails to send`);
console.log(`[EMAIL V2] Campaign ${campaignId}: Locked email ${queueId}`);
console.log(`[EMAIL V2] Campaign ${campaignId}: Sent email to ${leadEmail}`);
```

#### 4.2 Metryki

```typescript
// Śledź:
// - Liczba maili wysłanych dziennie
// - Liczba błędów
// - Średni czas wysyłki
// - Liczba kampanii aktywnych
```

---

## 🔄 MIGRACJA Z OBECNEGO SYSTEMU

### Krok 1: Równoległe działanie (1 tydzień)
- Stary system działa normalnie
- Nowy system testowany na jednej kampanii testowej
- Porównywanie wyników

### Krok 2: Stopniowe przełączanie (1 tydzień)
- Przełączamy kampanie jedna po drugiej
- Monitorujemy każdą kampanię przez 24h
- W razie problemów → rollback do starego

### Krok 3: Pełne przełączenie
- Wszystkie kampanie używają nowego systemu
- Stary system wyłączony (ale nie usunięty)
- Po 1 miesiącu → usunięcie starego kodu

---

## ✅ KRYTERIA SUKCESU

### Funkcjonalne
- [ ] Zero duplikatów maili
- [ ] Maile wysyłane zgodnie z harmonogramem (±30s)
- [ ] Wszystkie kampanie działają równolegle
- [ ] Limity skrzynek są przestrzegane
- [ ] Po restarcie serwera system kontynuuje wysyłkę

### Wydajnościowe
- [ ] Cron job nie blokuje się na >5 sekund
- [ ] System obsługuje 10+ kampanii jednocześnie
- [ ] Baza danych nie jest przeciążona

### Jakościowe
- [ ] Kod jest czytelny i łatwy do debugowania
- [ ] Logi są wystarczająco szczegółowe
- [ ] UI pokazuje rzeczywisty stan wysyłki

---

## 🚨 ZAGROŻENIA I MITIGACJE

### Zagrożenie 1: Duplikaty przy równoległym dostępie
**Mitigacja**: Atomic locking + sprawdzanie SendLog przed wysyłką

### Zagrożenie 2: Kolejka się "zatyka"
**Mitigacja**: Automatyczne odblokowanie maili starszych niż 10 min

### Zagrożenie 3: Błąd podczas wysyłki
**Mitigacja**: Try-catch + retry logic + status 'failed'

### Zagrożenie 4: Brak maili w kolejce
**Mitigacja**: Automatyczne uzupełnianie kolejki po wysłaniu

---

## 📅 TIMELINE

### Tydzień 1: Faza 1-2 (podstawowa implementacja)
- Implementacja podstawowej struktury
- Odzyskiwanie i bezpieczeństwo
- Testy jednostkowe

### Tydzień 2: Faza 3-4 (integracja i testy)
- Integracja z istniejącym systemem
- Testy na kampanii testowej
- Monitoring i logowanie

### Tydzień 3: Migracja
- Stopniowe przełączanie kampanii
- Monitoring i optymalizacja

### Tydzień 4: Stabilizacja
- Pełne przełączenie
- Optymalizacja
- Dokumentacja

---

## 🎯 NASTĘPNE KROKI

1. **Przegląd planu** - czy wszystko jest OK?
2. **Zatwierdzenie parametrów** - cron 30s czy 60s? buffer 20 czy inny?
3. **Rozpoczęcie implementacji** - Faza 1
4. **Testy na kampanii testowej** - przed przełączeniem produkcyjnych

---

**Data utworzenia**: 2025-11-04
**Status**: Gotowy do implementacji
**Rekomendacja**: Rozpocząć od FAZY 1


