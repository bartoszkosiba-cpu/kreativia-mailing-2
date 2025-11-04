# 🔧 NAPRAWA KAMPANII 4

## 📊 DIAGNOZA:

**Status:** IN_PROGRESS ✅  
**Leady w kolejce:** 311 queued  
**Maile w CampaignEmailQueue:** 15 pending  
**Problem:** Maile są zaplanowane w przeszłości (18:54, teraz 21:19) i nie są wysyłane

## 🐛 PROBLEM:

1. **15 maili w kolejce** (status: pending) są zaplanowane w przeszłości
2. **Ostatni mail wysłany 59 minut temu** - powinno wysyłać dalej
3. **296 leadów bez wpisów w kolejce** - trzeba dodać więcej maili

## ✅ ROZWIĄZANIE:

### KROK 1: Reinicjalizuj kolejkę (dodaj więcej maili)

```bash
# Wywołaj endpoint:
POST /api/campaigns/4/reinit-queue
```

Lub w przeglądarce/Postman:
```
POST http://localhost:3000/api/campaigns/4/reinit-queue
```

### KROK 2: Naprawiono logikę wysyłki

Dodałem obsługę **catch-up** dla opóźnionych maili:
- Jeśli mail jest w przeszłości (opóźniony)
- I delay minął od ostatniego wysłanego
- To wysyłaj nawet jeśli jesteśmy poza oknem czasowym

### KROK 3: Sprawdź czy cron działa

W logach serwera powinno być:
```
[CRON] 📧 Sprawdzam kolejkę kampanii...
[CAMPAIGN SENDER] 📧 Znaleziono mail do wysłania...
```

Jeśli nie ma tych logów - **cron nie działa!**

## 🔍 DEBUGOWANIE:

### Sprawdź status kampanii:
```bash
npx tsx scripts/diagnose-campaign.ts 4
```

### Sprawdź logi serwera:
Szukaj:
- `[CRON] 📧 Sprawdzam kolejkę kampanii...`
- `[CAMPAIGN SENDER] 📧 Znaleziono mail do wysłania...`
- `[CAMPAIGN SENDER] ⚠️ Mail opóźniony...`

### Sprawdź bazę danych:
```sql
-- Sprawdź maile w kolejce
SELECT id, status, scheduledAt, 
       datetime(scheduledAt) as scheduled,
       datetime('now') as now,
       (julianday('now') - julianday(scheduledAt)) * 86400 as seconds_ago
FROM CampaignEmailQueue 
WHERE campaignId = 4 AND status = 'pending'
ORDER BY scheduledAt ASC
LIMIT 10;
```

## 🎯 CO DALEJ:

1. **Reinicjalizuj kolejkę** - `/api/campaigns/4/reinit-queue`
2. **Sprawdź logi** - czy cron wysyła maile
3. **Poczekaj 1-2 minuty** - cron działa co 1 minutę
4. **Sprawdź ponownie** - `diagnose-campaign.ts 4`


