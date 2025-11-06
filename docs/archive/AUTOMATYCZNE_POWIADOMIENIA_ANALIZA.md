# ANALIZA AUTOMATYCZNYCH POWIADOMIEŃ - RYZYKO MASOWEJ WYSYŁKI

## ✅ WYŁĄCZONE

### 1. **Przypomnienia o zainteresowanych leadach** (`notificationReminderCron.ts`)
- **Status:** ❌ WYŁĄCZONE w `startCron.ts`
- **Problem:** Wysyłało po kilkadziesiąt maili do jednego leada
- **Rozwiązanie:** Wyłączone całkowicie

---

## 📧 AUTOMATYCZNE POWIADOMIENIA DO UŻYTKOWNIKA (ADMINISTRATORA)

### 2. **Powiadomienia o zainteresowanych leadach** (`interestedLeadNotifier.ts`)
- **Wywołanie:** Podczas przetwarzania odpowiedzi z klasyfikacją `INTERESTED`
- **Odbiorcy:** `salespersonEmail` + `forwardEmail` (administrator)
- **Zabezpieczenia:**
  - ✅ Sprawdza `existingNotification` przed utworzeniem (linia 61-68)
  - ✅ Wysyła pojedynczo (nie w pętli)
- **Ryzyko:** 🟢 NISKIE - wywoływane tylko raz na odpowiedź, ma zabezpieczenie przed duplikatami

### 3. **Powiadomienia o zablokowanych kontaktach** (`processor.ts` - `sendNotificationEmail`)
- **Wywołanie:** Podczas przetwarzania odpowiedzi z klasyfikacją `UNSUBSCRIBE` lub `NOT_INTERESTED`
- **Odbiorcy:** `forwardEmail` (administrator)
- **Zabezpieczenia:**
  - ❌ BRAK - wywoływane podczas przetwarzania pojedynczej odpowiedzi
- **Ryzyko:** 🟡 ŚREDNIE - jeśli przetworzy się wiele odpowiedzi jednocześnie, może wysłać wiele maili

### 4. **Powiadomienia o nowych kontaktach OOO** (`processor.ts`)
- **Wywołanie:** Podczas przetwarzania odpowiedzi z klasyfikacją `OOO` z kontaktami zastępczymi
- **Odbiorcy:** `forwardEmail` (administrator)
- **Zabezpieczenia:**
  - ❌ BRAK - wywoływane podczas przetwarzania pojedynczej odpowiedzi
- **Ryzyko:** 🟡 ŚREDNIE - jeśli przetworzy się wiele odpowiedzi OOO jednocześnie, może wysłać wiele maili

### 5. **Dzienny raport** (`dailyReportEmail.ts`)
- **Wywołanie:** Cron codziennie o 18:00
- **Odbiorcy:** `forwardEmail` (administrator)
- **Zabezpieczenia:**
  - ✅ Flaga `isDailyReportCronTaskRunning` (kolejkowanie)
  - ✅ Wysyła tylko 1 raport dziennie
- **Ryzyko:** 🟢 NISKIE - jeden mail dziennie, chroniony flagą

---

## 📧 AUTOMATYCZNE POWIADOMIENIA DO LEADÓW

### 6. **Automatyczne odpowiedzi z materiałami** (`materialResponseSender.ts`)
- **Wywołanie:** Cron co 2 minuty (`*/2 * * * *`)
- **Odbiorcy:** Leady (zainteresowani)
- **Zabezpieczenia:**
  - ✅ Limit `take: 50` na raz (linia 296)
  - ✅ Status `scheduled` → `sending` → `sent` (chroni przed duplikatami)
  - ✅ Wysyła w pętli `for` z `await` (jeden po drugim)
- **Ryzyko:** 🟡 ŚREDNIE - jeśli będzie 50+ gotowych odpowiedzi, wyśle 50 maili w ciągu 2 minut (może być problem z limitami skrzynek)

### 7. **Automatyczne follow-upy** (`autoFollowUpManager.ts`)
- **Wywołanie:** Cron w `emailCron.ts` (co 15 minut)
- **Odbiorcy:** Leady z statusem `CZEKAJ_REDIRECT_AWAITING_CONTACT`
- **Zabezpieczenia:**
  - ✅ Sprawdza `existingAutoFollowUp` w ostatnich 7 dniach (linia 142-155)
  - ✅ Wysyła w pętli `for` z `await` (jeden po drugim)
- **Ryzyko:** 🟡 ŚREDNIE - jeśli będzie wiele leadów spełniających warunki, wyśle wiele maili jednocześnie (brak limitu)

---

## 🚨 REKOMENDACJE

### WYSOKI PRIORYTET:

1. **Dodać delay między mailami w `materialResponseSender.ts`:**
   - Obecnie wysyła 50 maili jeden po drugim bez opóźnienia
   - Dodać `await new Promise(resolve => setTimeout(resolve, 2000))` między mailami

2. **Dodać delay między mailami w `autoFollowUpManager.ts`:**
   - Obecnie wysyła w pętli bez opóźnienia
   - Dodać `await new Promise(resolve => setTimeout(resolve, 2000))` między mailami

3. **Dodać limit w `autoFollowUpManager.ts`:**
   - Obecnie brak limitu na liczbę leadów do przetworzenia
   - Dodać `take: 20` w zapytaniu

### ŚREDNI PRIORYTET:

4. **Dodać zabezpieczenie w `processor.ts` (`sendNotificationEmail`):**
   - Dodać sprawdzenie czy w ostatnich 5 minutach nie było już powiadomienia o tym samym leadzie
   - Lub dodać kolejkowanie z flagą

5. **Zmniejszyć limit w `materialResponseSender.ts`:**
   - Zmienić `take: 50` na `take: 10` (mniej maili na raz)

---

## 📝 PODSUMOWANIE

| Powiadomienie | Odbiorca | Ryzyko | Zabezpieczenia | Status |
|--------------|----------|--------|----------------|--------|
| Przypomnienia o zainteresowanych | Użytkownik | ❌ | WYŁĄCZONE | ✅ |
| Powiadomienia o zainteresowanych | Użytkownik | 🟢 NISKIE | ✅ Duplikaty | ✅ |
| Powiadomienia o zablokowanych | Użytkownik | 🟡 ŚREDNIE | ❌ | ⚠️ |
| Powiadomienia OOO | Użytkownik | 🟡 ŚREDNIE | ❌ | ⚠️ |
| Dzienny raport | Użytkownik | 🟢 NISKIE | ✅ Flaga | ✅ |
| Odpowiedzi z materiałami | Leady | 🟡 ŚREDNIE | ✅ Limit 50 | ⚠️ |
| Auto follow-upy | Leady | 🟡 ŚREDNIE | ✅ Duplikaty | ⚠️ |

