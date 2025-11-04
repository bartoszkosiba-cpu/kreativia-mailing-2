# 🔍 ANALIZA LOGIKI WYSYŁKI MAILI W KAMPANII

## 📊 OBECNA ARCHITEKTURA

### DWA SYSTEMY DZIAŁAJĄ RÓWNOLEGLE:

#### 1️⃣ **STARY SYSTEM** - `/app/api/campaigns/[id]/send/route.ts`
- **Przeznaczenie:** Ręczna wysyłka testowa (max 20 leadów) lub bezpośrednia wysyłka wszystkich
- **Jak działa:**
  - Pobiera wszystkie `CampaignLead` z statusem != BLOCKED
  - Iteruje przez leady i wysyła natychmiastowo (z opóźnieniem 1s między mailami)
  - **NIE UŻYWA** kolejki `CampaignEmailQueue`
  - **NIE STOSUJE** harmonogramu (wysyła wszystkie od razu)
- **Status kampanii:** Nie zmienia statusu kampanii
- **Problem:** Może wysyłać duplikaty jeśli kampania jest już IN_PROGRESS

#### 2️⃣ **NOWY SYSTEM** - `/app/api/campaigns/[id]/start/route.ts` + `campaignEmailSender.ts`
- **Przeznaczenie:** Produkcyjna wysyłka z harmonogramem
- **Jak działa:**
  1. Użytkownik klika "Uruchom kampanię" → `POST /api/campaigns/[id]/start`
  2. System inicjalizuje kolejkę `CampaignEmailQueue` (10 pierwszych maili)
  3. Cron job (`emailCron.ts`) co 1 minutę wywołuje `sendScheduledCampaignEmails()`
  4. `sendScheduledCampaignEmails()` wywołuje `sendNextScheduledCampaignEmail()`
  5. Wysyła JEDEN mail z kolejki i dodaje następny do kolejki
- **Status kampanii:** Zmienia na `IN_PROGRESS`
- **Harmonogram:** Używa `delayBetweenEmails`, okien czasowych, limitów

---

## 🐛 ZIDENTYFIKOWANE PROBLEMY

### PROBLEM 1: **STARY SYSTEM WCIĄŻ DZIAŁA I MOŻE POWODOWAĆ DUPLIKATY**

**Lokalizacja:** `app/api/campaigns/[id]/send/route.ts`

**Problem:**
- Endpoint `/send` nie sprawdza czy kampania jest już `IN_PROGRESS`
- Może wysyłać te same maile co system kolejki
- Nie używa `CampaignEmailQueue` więc nie ma synchronizacji

**Przykład konfliktu:**
```
1. Użytkownik uruchamia kampanię → status IN_PROGRESS, kolejka zainicjalizowana
2. Cron wysyła maile z kolejki (1 mail/minutę)
3. Użytkownik przypadkowo klika "Wyślij" w `/send` → wysyła wszystkie od razu
4. REZULTAT: Duplikaty maili!
```

**Rozwiązanie:**
- Dodać sprawdzenie statusu kampanii w `/send`
- Jeśli kampania jest `IN_PROGRESS` → odmów lub użyj kolejki
- Lub: całkowicie wyłączyć `/send` dla kampanii z kolejką

---

### PROBLEM 2: **KOLEJKA NIE JEST ZAWSZE INICJALIZOWANA**

**Lokalizacja:** `app/api/campaigns/[id]/start/route.ts` + `campaignEmailQueue.ts`

**Problem:**
- `initializeCampaignQueue()` może zwrócić 0 jeśli:
  - Wszystkie leady już mają wpisy w kolejce (ale są w statusie `sent`/`failed`)
  - Filtr w `initializeCampaignQueue` jest zbyt restrykcyjny
  - Leady są w statusie `planned` zamiast `queued`

**Kod problematyczny:**
```typescript
// campaignEmailQueue.ts linia 172-196
const allCandidateLeads = await db.campaignLead.findMany({
  where: {
    campaignId,
    status: { in: ["queued", "planned"] }, // ✅ OK
    lead: {
      status: { not: "BLOCKED" },
      isBlocked: false
    }
  },
  include: {
    lead: true,
    campaignEmailQueue: {
      where: {
        status: { in: ["pending", "sending"] }
      }
    }
  }
});

// Odfiltruj te które już mają wpisy w kolejce
const campaignLeads = allCandidateLeads.filter(cl => cl.campaignEmailQueue.length === 0);
```

**Możliwe przyczyny:**
1. Leady są w statusie `planned` → trzeba zmienić na `queued`
2. W kolejce są stare wpisy ze statusem `sent`/`failed` → nie są filtrowane
3. Relacja Prisma nie działa poprawnie

**Rozwiązanie:**
- Sprawdzić czy leady są w odpowiednim statusie (`queued` lub `planned`)
- Dodać automatyczną zmianę `planned` → `queued` przy inicjalizacji
- Upewnić się że filtr w `initializeCampaignQueue` działa poprawnie

---

### PROBLEM 3: **AUTOMATYCZNA NAPRAWA NIE ZAWSZE DZIAŁA**

**Lokalizacja:** `campaignEmailSender.ts` linia 289-341

**Problem:**
Automatyczna naprawa sprawdza czy są kampanie `IN_PROGRESS` z pustą kolejką, ale:
- Może nie znajdować leadów jeśli są w statusie `planned` zamiast `queued`
- Może mieć problem z relacjami Prisma
- Może nie działać jeśli cron nie jest uruchomiony

**Kod:**
```typescript
// Sprawdź czy ma leadów w kolejce
const queuedLeadsCount = await db.campaignLead.count({
  where: {
    campaignId: campaign.id,
    status: { in: ["queued", "planned"] },
    lead: {
      status: { not: "BLOCKED" },
      isBlocked: false
    }
  }
});

// Sprawdź czy ma maili w kolejce
const queueCount = await db.campaignEmailQueue.count({
  where: {
    campaignId: campaign.id,
    status: { in: ["pending", "sending"] }
  }
});

// Jeśli ma leadów ale brak maili w kolejce - reinicjalizuj
if (queuedLeadsCount > 0 && queueCount === 0) {
  // Reinicjalizuj...
}
```

**Rozwiązanie:**
- Dodać więcej logowania dla debugowania
- Upewnić się że statusy leadów są poprawne
- Dodać fallback na ręczną reinicjalizację

---

### PROBLEM 4: **STARY SYSTEM `processScheduledCampaign` NIE JEST UŻYWANY**

**Lokalizacja:** `scheduledSender.ts` + `emailCron.ts`

**Problem:**
- `processScheduledCampaign()` jest zdefiniowany ale **NIE JEST WYWOŁYWANY** przez cron
- Cron używa tylko `sendScheduledCampaignEmails()` (nowy system)
- Stary kod może być martwy lub powodować konfuzję

**Rozwiązanie:**
- Usunąć `processScheduledCampaign()` jeśli nie jest używany
- Lub: zintegrować go z nowym systemem jako fallback

---

### PROBLEM 5: **DELAY MOŻE NIE BYĆ PRZESTRZEGANY**

**Lokalizacja:** `campaignEmailSender.ts` + `scheduledSender.ts`

**Problem:**
- `sendNextScheduledCampaignEmail()` sprawdza `scheduledAt` ale może wysyłać maile z przeszłości
- Delay jest obliczany w `calculateNextEmailTime()` ale może być niepoprawny
- Cron działa co 1 minutę, więc maile mogą być wysyłane z opóźnieniem

**Rozwiązanie:**
- Upewnić się że delay jest przestrzegany
- Sprawdzić czy `scheduledAt` jest obliczany poprawnie
- Dodać więcej logowania dla debugowania

---

### PROBLEM 6: **STATUSY CAMPAIGNLEAD MOŻĄ BYĆ NIESPÓJNE**

**Możliwe statusy `CampaignLead`:**
- `planned` - zaplanowany (początkowy)
- `queued` - w kolejce do wysłania
- `sending` - wysyłany (stary system)
- `sent` - wysłany
- `failed` - błąd

**Problem:**
- Stary system zmienia status na `sending` → `sent`
- Nowy system używa `CampaignEmailQueue` i może nie zmieniać statusu `CampaignLead`
- Może być niespójność między `CampaignLead.status` a `CampaignEmailQueue.status`

**Rozwiązanie:**
- Upewnić się że statusy są synchronizowane
- Dodać migrację dla starych danych

---

## ✅ PLAN NAPRAWY

### KROK 1: **Naprawić konflikt między starym a nowym systemem**

**Zmiany w `/app/api/campaigns/[id]/send/route.ts`:**
- Dodać sprawdzenie: jeśli kampania jest `IN_PROGRESS` → odmów lub użyj kolejki
- Lub: całkowicie wyłączyć `/send` dla kampanii z kolejką

### KROK 2: **Naprawić inicjalizację kolejki**

**Zmiany w `campaignEmailQueue.ts`:**
- Dodać automatyczną zmianę `planned` → `queued`
- Poprawić filtr w `initializeCampaignQueue`
- Dodać więcej logowania

### KROK 3: **Upewnić się że automatyczna naprawa działa**

**Zmiany w `campaignEmailSender.ts`:**
- Dodać więcej logowania
- Poprawić logikę sprawdzania statusów
- Dodać fallback

### KROK 4: **Usunąć martwy kod**

**Zmiany:**
- Usunąć `processScheduledCampaign()` jeśli nie jest używany
- Lub: zintegrować z nowym systemem

### KROK 5: **Synchronizacja statusów**

**Zmiany:**
- Upewnić się że `CampaignLead.status` jest synchronizowany z `CampaignEmailQueue.status`
- Dodać migrację dla starych danych

---

## 🎯 PRIORYTET NAPRAW

1. **WYSOKI:** Konflikt między starym a nowym systemem (duplikaty)
2. **WYSOKI:** Inicjalizacja kolejki (nie działa)
3. **ŚREDNI:** Automatyczna naprawa (może nie działać)
4. **NISKI:** Martwy kod (nie wpływa na działanie)
5. **ŚREDNI:** Synchronizacja statusów (może powodować konfuzję)

---

## 🔍 DEBUGOWANIE

**Jak sprawdzić czy system działa:**
1. Sprawdź logi: `[CAMPAIGN SENDER]`, `[CAMPAIGN QUEUE]`, `[CRON]`
2. Sprawdź bazę danych: `CampaignEmailQueue`, `CampaignLead.status`
3. Sprawdź czy cron działa: `[CRON] 📧 Sprawdzam kolejkę kampanii...`

**Kluczowe logi:**
- `[CAMPAIGN QUEUE] 🚀 Inicjalizacja kolejki...` - inicjalizacja
- `[CAMPAIGN QUEUE] ✅ Dodano X maili...` - sukces inicjalizacji
- `[CAMPAIGN SENDER] 📧 Znaleziono mail do wysłania...` - wysyłka
- `[CAMPAIGN SENDER] ✅ Mail wysłany!` - sukces wysyłki


