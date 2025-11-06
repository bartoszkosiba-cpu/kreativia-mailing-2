# 🚀 URUCHOMIENIE KAMPANII 3 - KROK PO KROKU

## 📋 CO ZROBIĆ TERAZ

### **KROK 1: Przejdź do interfejsu kampanii**
1. Otwórz przeglądarkę: `http://127.0.0.1:3000/campaigns/3`
2. Sprawdź czy kampania jest w statusie `PAUSED`

### **KROK 2: Uruchom kampanię**
1. Kliknij przycisk **"Uruchom"** (lub podobny) w interfejsie
2. To wywoła API: `POST /api/campaigns/3/start`

---

## 🔄 CO SIĘ WYDARZY KROK PO KROKU

### **ETAP 1: API `/api/campaigns/[id]/start` (2-3 sekundy)**

#### **KROK 1.1: Walidacja**
- ✅ Sprawdza czy kampania istnieje
- ✅ Sprawdza czy ma treść (`text`)
- ✅ Sprawdza czy ma leady do wysłania
- ✅ Sprawdza czy jest w oknie czasowym (9:00-17:00, dozwolone dni)

#### **KROK 1.2: Zmiana statusu**
```typescript
status: "SCHEDULED" → ustawia scheduledAt = now()
```

#### **KROK 1.3: Aktualizacja leadów**
```typescript
CampaignLead.status: "planned" → "queued"
```

#### **KROK 1.4: Inicjalizacja kolejki V2** ⭐ **NOWE!**
```typescript
initializeQueueV2(campaignId: 3, bufferSize: 20)
```

**Co się dzieje:**
1. Pobiera kampanię z ustawieniami
2. Pobiera ostatni wysłany mail (jeśli istnieje)
3. Sprawdza które leady już otrzymały mail (SendLog)
4. Sprawdza które leady są już w kolejce (CampaignEmailQueue)
5. Pobiera 371 leadów w statusie 'queued' lub 'planned'
6. Filtruje w JavaScript:
   - ❌ Pomija leady które już otrzymały mail (286)
   - ❌ Pomija leady które są już w kolejce (0)
   - ❌ Pomija zablokowane leady
   - ✅ Zostaje ~85 leadów do dodania
7. **Dodaje pierwsze 20 maili do kolejki** (bufferSize = 20)
   - Każdy mail ma `scheduledAt` obliczony z `delayBetweenEmails` (90s ±20%)
   - Sprawdza dostępność skrzynek
   - Sprawdza okno czasowe (9:00-17:00)

**Rezultat:**
- ✅ Dodano 20 maili do `CampaignEmailQueue` (status: 'pending')
- ✅ Każdy mail ma `scheduledAt` (np. pierwszy: teraz, drugi: +72-108s, itd.)

#### **KROK 1.5: Zmiana statusu na IN_PROGRESS**
```typescript
status: "SCHEDULED" → "IN_PROGRESS"
sendingStartedAt: now()
```

**Rezultat API:**
```json
{
  "success": true,
  "message": "Kampania uruchomiona! Wysyłanie 371 maili...",
  "campaignId": 3,
  "leadsCount": 371,
  "estimatedDuration": 55 // minuty
}
```

---

### **ETAP 2: Cron V2 zaczyna przetwarzać (co 30 sekund)**

#### **KROK 2.1: `processScheduledEmailsV2()` (automatycznie)**
Wywoływane przez cron co 30 sekund (`*/30 * * * * *`)

#### **KROK 2.2: Odblokowanie zablokowanych maili**
```typescript
unlockStuckEmails()
```
- Sprawdza maile w statusie 'sending' starsze niż 10 min
- Zmienia status: 'sending' → 'pending'

#### **KROK 2.3: Automatyczna migracja (pominięta)**
```typescript
migrateCampaignsWithoutQueue()
```
- Sprawdza kampanie IN_PROGRESS bez kolejki
- Kampania 3 ma już kolejkę (20 maili) → **POMINIĘTA**

#### **KROK 2.4: Pobranie kampanii do przetworzenia**
```typescript
db.campaign.findMany({
  where: {
    status: 'IN_PROGRESS',
    id: { notIn: [1, 2] }
  }
})
```
- ✅ Znaleziono kampanię 3 (status: IN_PROGRESS)

#### **KROK 2.5: Wysłanie następnego maila**
```typescript
sendNextEmailFromQueue(campaignId: 3)
```

**Co się dzieje:**

1. **Pobierz następny mail z kolejki**
   ```typescript
   getNextEmailForCampaign(3)
   ```
   - Znajduje mail z `status: 'pending'` i `scheduledAt <= now`
   - Sortuje po `scheduledAt` i `priority`
   - Zwraca pierwszy mail (np. ID: 1001)

2. **Atomowe blokowanie w transakcji**
   ```typescript
   db.$transaction(async (tx) => {
     // Atomowo zablokuj mail
     await tx.campaignEmailQueue.updateMany({
       where: { id: 1001, status: 'pending' },
       data: { status: 'sending' }
     });
   })
   ```
   - ✅ Tylko jeden proces może zablokować ten mail

3. **Sprawdzenie okna czasowego**
   ```typescript
   isWithinSendWindow(now, campaign)
   ```
   - Sprawdza czy teraz jest 9:00-17:00 i dozwolony dzień
   - ✅ Jeśli TAK → kontynuuj
   - ❌ Jeśli NIE → przekładaj na jutro

4. **Sprawdzenie duplikatu**
   ```typescript
   db.sendLog.findFirst({
     where: { campaignId: 3, leadId: X, status: 'sent' }
   })
   ```
   - Sprawdza czy lead już otrzymał mail
   - ✅ Jeśli NIE → kontynuuj

5. **Sprawdzenie limitu kampanii**
   ```typescript
   db.sendLog.count({
     where: { campaignId: 3, status: 'sent', createdAt: { gte: todayStart } }
   })
   ```
   - Sprawdza ile maili już wysłano dzisiaj
   - Jeśli < `maxEmailsPerDay` → kontynuuj

6. **Atomowa rezerwacja slotu skrzynki**
   ```typescript
   getNextAvailableMailbox(virtualSalespersonId, campaignId: 3)
   ```
   - Znajduje dostępną skrzynkę (round-robin, sprawdza limity)
   - Atomowo rezerwuje slot: `UPDATE Mailbox SET currentDailySent = currentDailySent + 1 WHERE ...`
   - Aktualizuje `lastUsedAt` (dla round-robin)

7. **Wysłanie maila**
   ```typescript
   sendSingleEmail(campaign, lead, settings, 0, preReservedMailbox)
   ```
   - Personalizacja treści (powitanie + tekst kampanii)
   - Wysłanie przez SMTP
   - Zapis do `SendLog` (status: 'sent')

8. **Aktualizacja statusu**
   ```typescript
   db.campaignEmailQueue.update({
     where: { id: 1001 },
     data: { status: 'sent', sentAt: now }
   })
   
   db.campaignLead.updateMany({
     where: { campaignId: 3, leadId: X },
     data: { status: 'sent', sentAt: now }
   })
   ```

9. **Planowanie następnego maila**
   ```typescript
   scheduleNextEmailV2(campaignId: 3, lastSentTime: now, delayBetweenEmails: 90)
   ```
   - Sprawdza czy są leady do wysłania (371 - 286 = 85)
   - Sprawdza czy lead już jest w kolejce lub już otrzymał mail
   - Jeśli TAK → dodaje następny mail do kolejki
   - `scheduledAt = lastSentTime + delayBetweenEmails ±20%` (72-108s)

**Rezultat:**
- ✅ Mail wysłany do leada
- ✅ Mail oznaczony jako 'sent' w kolejce
- ✅ Następny mail zaplanowany (jeśli są dostępne leady)

---

### **ETAP 3: Cykl się powtarza (co 30 sekund)**

#### **KROK 3.1: Następny mail w kolejce**
- Cron V2 działa co 30 sekund
- Znajduje następny mail z `scheduledAt <= now`
- Wysyła go (zgodnie z `delayBetweenEmails`)

#### **KROK 3.2: Automatyczne planowanie**
- Po każdym wysłanym mailu, system automatycznie planuje następny
- Kolejka jest stale uzupełniana (20 maili w buforze)

#### **KROK 3.3: Koniec kampanii**
- Gdy wszystkie leady otrzymają mail (371 maili)
- Kolejka jest pusta
- Kampania może być oznaczona jako `COMPLETED`

---

## 📊 PRZYKŁADOWY TIMELINE

```
12:00:00 - Uruchomienie kampanii (KROK 1)
12:00:02 - Kolejka V2 zainicjalizowana (20 maili)
12:00:02 - Status: IN_PROGRESS

12:00:30 - Cron V2 (KROK 2.5)
12:00:30 - Mail #1 wysłany (scheduledAt: 12:00:00)
12:00:30 - Mail #21 zaplanowany (scheduledAt: 12:01:42)

12:01:00 - Cron V2
12:01:00 - Mail #2 wysłany (scheduledAt: 12:01:30)
12:01:00 - Mail #22 zaplanowany (scheduledAt: 12:02:54)

12:01:30 - Cron V2
12:01:30 - Mail #3 wysłany (scheduledAt: 12:02:00)
12:01:30 - Mail #23 zaplanowany (scheduledAt: 12:03:48)

...i tak dalej...

17:00:00 - Koniec okna czasowego
17:00:00 - Maile przekładane na jutro 9:00

Następny dzień 9:00:00 - Wznowienie wysyłki
```

---

## ⚠️ WAŻNE INFORMACJE

### **1. Opóźnienia między mailami**
- **Bazowy:** 90 sekund (z kampanii)
- **Rzeczywisty:** 72-108 sekund (losowo ±20%)
- **Przykład:** Mail #1 o 12:00:00, Mail #2 o 12:01:42 (102s)

### **2. Okno czasowe**
- **Start:** 9:00 (startHour)
- **Koniec:** 17:00 (endHour)
- **Dni:** Zgodnie z `allowedDays`
- Maile poza oknem są przekładane na następny dzień

### **3. Limit dzienny**
- System sprawdza `maxEmailsPerDay` przed każdym mailem
- Jeśli osiągnięto limit → maile przekładane na jutro

### **4. Skrzynki**
- System używa round-robin (kolejność: priority, lastUsedAt)
- Sprawdza dostępność przed każdym mailem
- Jeśli brak skrzynek → maile przekładane na jutro

### **5. Automatyczne planowanie**
- Po każdym wysłanym mailu, system automatycznie planuje następny
- Kolejka jest stale uzupełniana (20 maili w buforze)

---

## ✅ SPRAWDZENIE POSTĘPU

### **W interfejsie:**
- Przejdź do: `http://127.0.0.1:3000/campaigns/3#wysylka-informacje`
- Zobaczysz:
  - Status kampanii
  - Następny mail (kiedy)
  - Ostatni wysłany mail
  - Postęp (wysłane / całkowite)

### **W logach serwera:**
```
[SENDER V2] ✅ Kampania 3: Mail wysłany do lead@example.com
[SENDER V2] ✅ Zmigrowano kampanię 3 (dodano 20 maili do kolejki)
[QUEUE V2] ✅ Zaplanowano mail dla lead@example.com na 2025-11-04T12:01:42.000Z
```

---

## 🎯 PODSUMOWANIE

1. **Kliknij "Uruchom"** w interfejsie kampanii 3
2. **System automatycznie:**
   - Zainicjalizuje kolejkę V2 (20 maili)
   - Zmieni status na IN_PROGRESS
   - Cron V2 zacznie wysyłać maile co 30 sekund
   - Planować kolejne maile automatycznie
3. **Kampania będzie działać** aż wszystkie leady otrzymają maili lub osiągnięty zostanie limit dzienny

**Wszystko działa automatycznie - nie musisz nic więcej robić!** 🚀

