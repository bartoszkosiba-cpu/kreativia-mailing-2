# 📧 JAK DZIAŁA SYSTEM WYSYŁKI V2 - PRZEWODNIK

## 🎯 PRZEGLĄD SYSTEMU

System V2 wysyła maile kampanii w następujący sposób:

### **Główny mechanizm:**
1. **Cron job** uruchamia się co **30 sekund**
2. Sprawdza wszystkie kampanie ze statusem `IN_PROGRESS`
3. Dla każdej kampanii próbuje wysłać **jeden mail** (jeśli jest dostępny)
4. Używa **atomic operations** aby uniknąć duplikatów

---

## ⏰ KROK 1: CRON JOB (co 30 sekund)

**Plik:** `src/services/emailCron.ts`

```typescript
campaignCronJobV2 = cron.schedule('*/30 * * * * *', async () => {
  // Sprawdza co 30 sekund
  const result = await processScheduledEmailsV2();
});
```

**Co robi:**
- Uruchamia się co 30 sekund
- Wywołuje `processScheduledEmailsV2()`
- Przetwarza **wszystkie** kampanie `IN_PROGRESS` równolegle

---

## 🔄 KROK 2: `processScheduledEmailsV2()`

**Plik:** `src/services/campaignEmailSenderV2.ts`

**Co robi:**
1. Pobiera wszystkie kampanie ze statusem `IN_PROGRESS`
2. Dla każdej kampanii:
   - Sprawdza czy jest w oknie czasowym (harmonogram)
   - Sprawdza czy są dostępne skrzynki
   - Próbuje wysłać **jeden mail** (jeśli jest dostępny)
3. Zwraca statystyki: ile wysłano, ile błędów

**Ważne:**
- Dla każdej kampanii wysyła **maksymalnie 1 mail** na cykl cron
- Jeśli kampania ma wiele maili w kolejce, będą wysyłane stopniowo (co 30s)

---

## 📬 KROK 3: `sendNextEmailFromQueue(campaignId)`

**Plik:** `src/services/campaignEmailSenderV2.ts`

**To jest główna funkcja wysyłki - działa w 3 krokach:**

### **KROK 3.1: Atomowa rezerwacja maila i skrzynki**

```typescript
const result = await db.$transaction(async (tx) => {
  // 1. Znajdź następny mail (scheduledAt <= now, status = 'pending')
  // 2. Sprawdź dostępne skrzynki (limit dzienny nie osiągnięty)
  // 3. Atomowo zarezerwuj slot skrzynki (UPDATE mailbox SET currentDailySent = currentDailySent + 1 WHERE ...)
  // 4. Atomowo zablokuj mail (UPDATE queue SET status = 'sending' WHERE ...)
});
```

**Bezpieczeństwo:**
- Wszystko w **jednej transakcji** - zapobiega race condition
- Jeśli limit skrzynki osiągnięty → mail pozostaje w `pending`
- Jeśli mail już zablokowany → rollback transakcji

### **KROK 3.2: Weryfikacja i wysyłka**

```typescript
// Sprawdź czy kampania jest nadal IN_PROGRESS
// Sprawdź czy lead nie otrzymał już maila (duplikat)
// Wyślij mail przez sendSingleEmail()
```

### **KROK 3.3: Aktualizacja i planowanie następnego**

```typescript
// Oznacz mail jako 'sent' w kolejce
// Zaktualizuj CampaignLead.status = 'sent'
// Zaplanuj następny mail (scheduleNextEmailV2)
```

---

## 📊 KOLEJKA EMAILI (`CampaignEmailQueueV2`)

### **Statusy:**
- `pending` - czeka na wysyłkę
- `sending` - trwa wysyłka (zablokowany)
- `sent` - wysłany
- `failed` - błąd wysyłki
- `cancelled` - anulowany (kampania zatrzymana)

### **Kolejność:**
- Maile są sortowane po `scheduledAt` (ascending)
- System wysyła najstarsze maile pierwsze

### **ScheduledAt:**
- Określa **kiedy** mail powinien być wysłany
- Jeśli `scheduledAt <= now` → mail jest "gotowy"
- System wysyła tylko maile "gotowe"

---

## ⏱️ HARMONOGRAM I OKNA CZASOWE

### **Kampania ma ustawienia:**
```typescript
startHour: 9        // Start okna (9:00)
startMinute: 0
endHour: 17         // Koniec okna (17:00)
endMinute: 0
allowedDays: "MON,TUE,WED,THU,FRI"  // Dni tygodnia
delayBetweenEmails: 90  // Opóźnienie w sekundach (90s = 1.5 min)
maxEmailsPerDay: 500   // Limit dzienny kampanii
```

### **System sprawdza:**
1. Czy **aktualny dzień** jest w `allowedDays`
2. Czy **aktualna godzina** jest w oknie `startHour:startMinute` - `endHour:endMinute`
3. Jeśli TAK → wysyła maile
4. Jeśli NIE → pomija (maile pozostają w kolejce)

---

## 📈 OPCJA 4: RANDOMIZACJA ODSTĘPÓW

### **Jak działa:**
1. Cron uruchamia się co **30 sekund**
2. Dla każdego maila "gotowego" (`scheduledAt <= now`):
   - Oblicza `correctedTime = (delayBetweenEmails - 30s) ± 20%`
   - Używa `setTimeout()` z `correctedTime`
   - Mail wysyła się **po zakończeniu setTimeout**

**Przykład:**
- `delayBetweenEmails = 90s`
- `correctedTime = (90 - 30) ± 20% = 48-72s`
- Mail zostanie wysłany za **48-72 sekundy** (losowo)

**Efekt:**
- Rzeczywiste odstępy między mailami: **48-72s** (losowo)
- Nie są to wielokrotności 30s (jak wcześniej)

---

## 🎯 LIMITY I KONTROLE

### **Limity dzienne skrzynek:**
- Każda skrzynka ma `dailyEmailLimit` (np. 50 maili/dzień)
- System sprawdza `currentDailySent < dailyEmailLimit`
- Jeśli limit osiągnięty → skrzynka jest pomijana

### **Limity dzienne kampanii:**
- Kampania ma `maxEmailsPerDay` (np. 500 maili/dzień)
- System sprawdza ile maili **już wysłano** (z SendLog)
- Jeśli limit osiągnięty → kampania pomija wysyłkę

### **Rotacja skrzynek:**
- System używa **round-robin** (kolejność rotacji)
- Jeśli wszystkie skrzynki są na limicie → kampania czeka

---

## 🔍 MONITOROWANIE

### **1. Sprawdź status kampanii:**
```sql
SELECT id, name, status FROM Campaign WHERE id = 3;
```

### **2. Sprawdź kolejkę:**
```sql
SELECT 
  status, 
  COUNT(*) as count,
  MIN(scheduledAt) as next_scheduled
FROM CampaignEmailQueueV2 
WHERE campaignId = 3 
GROUP BY status;
```

### **3. Sprawdź ostatnie wysłane maile:**
```sql
SELECT 
  createdAt, 
  toEmail, 
  subject 
FROM SendLog 
WHERE campaignId = 3 
ORDER BY createdAt DESC 
LIMIT 10;
```

### **4. Sprawdź logi serwera:**
Szukaj w logach:
- `[CRON V2]` - logi cron job
- `[SENDER V2]` - logi wysyłki
- `✅ Wysłano` - sukces
- `❌ Błąd` - błędy

---

## ⚠️ CZĘSTE PROBLEMY

### **Problem: Kampania nie wysyła maili**

**Sprawdź:**
1. Status kampanii = `IN_PROGRESS`?
2. Są maile w kolejce (`pending`)?
3. Są dostępne skrzynki (limit nie osiągnięty)?
4. Czy jest w oknie czasowym (harmonogram)?

### **Problem: Maile wysyłają się zbyt szybko**

**Sprawdź:**
- `delayBetweenEmails` w kampanii
- Czy Option 4 działa poprawnie (randomizacja)

### **Problem: Maile nie wysyłają się w ogóle**

**Sprawdź:**
- Logi serwera (`[CRON V2]`, `[SENDER V2]`)
- Czy cron jest uruchomiony?
- Czy są błędy w bazie danych?

---

## 🚀 URUCHOMIENIE KAMPANII

### **Przez UI:**
1. Przejdź do kampanii
2. Kliknij "Uruchom kampanię"
3. Kampania zmieni status na `IN_PROGRESS`
4. System automatycznie zacznie wysyłać maile

### **Przez API:**
```bash
POST /api/campaigns/3/start
```

---

## 📝 NOTATKI

- System V2 działa **równolegle** dla wielu kampanii
- Każda kampania wysyła **maksymalnie 1 mail** na cykl cron (30s)
- System używa **atomic operations** - nie ma duplikatów
- **Option 4** zapewnia losowe odstępy (nie wielokrotności 30s)

