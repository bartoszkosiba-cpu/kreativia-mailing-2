# ✅ NAPRAWA DELAY - Odstępy między mailami

## 🐛 PROBLEM:

**Maile wysyłały się bez odstępów** - system wysyłał do 5 maili jednocześnie w catch-up, co ignorowało delay (90s).

## ✅ NAPRAWA:

### 1. **Zawsze sprawdzaj delay PRZED wysłaniem**
- Delay jest sprawdzany **dla wszystkich maili** (nie tylko opóźnionych)
- Jeśli delay nie minął (72s minimum) → odkłada mail
- Delay jest sprawdzany od ostatniego wysłanego maila z kampanii

### 2. **Usunięto pętlę wysyłającą wiele maili**
- **Przed:** Wysyłał do 5 maili jednocześnie w catch-up
- **Teraz:** Wysyła tylko **1 mail na wywołanie cron**
- Delay jest przestrzegany przez:
  1. Sprawdzanie delay w `sendNextScheduledCampaignEmail` (przed wysłaniem)
  2. Cron działa co 1 minutę (dodatkowy odstęp)
  3. Delay sprawdzany od ostatniego wysłanego (72s minimum)

### 3. **Logika delay:**

```typescript
// Sprawdź delay od ostatniego wysłanego maila
const lastSentLog = await db.sendLog.findFirst({
  where: {
    campaignId: nextEmail.campaignId,
    status: 'sent'
  },
  orderBy: {
    createdAt: 'desc'
  }
});

if (lastSentLog) {
  const timeSinceLastMail = Math.floor((now.getTime() - lastSentTime.getTime()) / 1000);
  const minRequiredDelay = Math.floor(baseDelay * 0.8); // 72s (80% z 90s)
  
  if (timeSinceLastMail < minRequiredDelay) {
    // Delay jeszcze nie minął - odkładam
    return { success: true, mailSent: false };
  }
}
```

## 🎯 JAK TERAZ DZIAŁA:

### Normalny tryb:
- Cron działa co 1 minutę
- Sprawdza delay (72s minimum)
- Jeśli delay minął → wysyła 1 mail
- Jeśli delay nie minął → odkłada (następny cron spróbuje)

### Catch-up (opóźnione maile):
- Cron działa co 1 minutę
- Sprawdza delay (72s minimum) - **TAK SAMO jak normalny tryb**
- Jeśli delay minął → wysyła catch-up (pomija okno czasowe)
- Jeśli delay nie minął → odkłada

## 📊 REZULTAT:

**Przed naprawą:**
- Wysyłał 5 maili jednocześnie
- Delay był ignorowany
- Maile szły bez odstępów

**Po naprawie:**
- Wysyła 1 mail na wywołanie cron
- Delay jest zawsze sprawdzany (72s minimum)
- Maile są wysyłane z odstępami

## ⏰ ODSTĘPY:

- **Bazowy delay:** 90s (z kampanii)
- **Minimum wymagane:** 72s (80% z 90s)
- **Cron:** Co 1 minutę (60s)
- **Rzeczywisty odstęp:** Minimum 72s między mailami (sprawdzane przed każdym wysłaniem)

## 🔍 CO SPRAWDZIĆ:

**Logi powinny pokazywać:**
```
[CAMPAIGN SENDER] ⏰ Delay jeszcze nie minął (minęło: 45s, wymagane minimum: 72s, pozostało: 27s) - odkładam
[CAMPAIGN SENDER] ⚠️ Mail opóźniony... delay minął - wysyłam catch-up
[CAMPAIGN SENDER] ✅ Mail wysłany!
```

**Lub jeśli delay minął:**
```
[CAMPAIGN SENDER] ⚠️ Mail opóźniony... delay minął - wysyłam catch-up
[CAMPAIGN SENDER] ✅ Mail wysłany!
[CRON] ✅ Wysłano 1 mail(i) z kolejki
```


