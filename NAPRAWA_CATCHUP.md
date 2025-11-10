# ✅ NAPRAWA CATCH-UP - Opóźnione maile

## 🐛 PROBLEM:

1. **System wysyłał tylko 1 mail na wywołanie cron** (co 1 minutę)
2. **W kolejce jest 37 opóźnionych maili** (zaplanowane w przeszłości)
3. **To oznaczało 37 minut na nadrobienie zaległości!**

## ✅ NAPRAWY:

### 1. **Catch-up dla opóźnionych maili**
- System wykrywa ile maili jest w przeszłości
- Jeśli są opóźnione → wysyła **do 5 maili** jednocześnie (zamiast 1)
- Nadal przestrzega delay między mailami (72s)

### 2. **Pominięcie okna czasowego dla catch-up**
- Jeśli mail jest opóźniony i delay minął
- To wysyłaj **nawet poza oknem czasowym** (catch-up)

### 3. **Automatyczne uzupełnianie kolejki**
- Po wysłaniu maila, system automatycznie dodaje następny
- Dzięki temu kolejka się nie kończy

## 🎯 JAK TERAZ DZIAŁA:

### Normalny tryb (brak opóźnień):
- Wysyła **1 mail** na wywołanie cron
- Przestrzega okna czasowego
- Przestrzega delay (90s)

### Catch-up tryb (są opóźnione maile):
- Wysyła **do 5 maili** na wywołanie cron
- **Pomija** sprawdzanie okna czasowego (catch-up)
- Nadal przestrzega delay (72s między mailami)

## 📊 PRZYKŁAD:

**Przed naprawą:**
- 37 opóźnionych maili
- 1 mail/minutę
- **Czas nadrobienia: 37 minut**

**Po naprawie:**
- 37 opóźnionych maili
- 5 maili/minutę (z delay 72s)
- **Czas nadrobienia: ~8 minut**

## 🔍 CO SPRAWDZIĆ:

1. **Logi serwera:**
   ```
   [CAMPAIGN SENDER] 🔍 Opóźnione maile: 37, wysyłam max 5 maili
   [CAMPAIGN SENDER] ⚠️ Mail opóźniony... - wysyłam catch-up
   [CAMPAIGN SENDER] ✅ Mail wysłany!
   [CRON] ✅ Wysłano 5 mail(i) z kolejki
   ```

2. **Diagnostyka:**
   ```bash
   npx tsx scripts/diagnose-campaign.ts 4
   ```

3. **Postęp:**
   - Poczekaj 1-2 minuty
   - Sprawdź czy wysyła więcej niż 1 mail
   - Sprawdź czy opóźnione maile są wysyłane

## ⚠️ UWAGI:

- System nadal przestrzega delay (72s) między mailami
- Jeśli delay nie minął, przerwie wysyłkę i kontynuuje przy następnym cron
- Po nadrobieniu zaległości, wraca do normalnego trybu (1 mail/minutę)





