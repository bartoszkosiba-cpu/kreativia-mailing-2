# 📊 ANALIZA TIMELINE DUPLIKATÓW

## ✅ KAMPANIA ZATRZYMANA:
Status: **PAUSED** ✅

## 📈 STATYSTYKI:

### DO 11:40 (9:19 - 11:39):
- **20 maili wysłanych**
- **20 unikalnych leadów**
- **0 duplikatów** ✅

### OD 11:40 (11:40 - 12:50):
- **32 maile wysłane**
- **16 unikalnych leadów**
- **16 duplikatów** ❌

## 🔍 WZÓR DUPLIKATÓW:

Wszystkie duplikaty są wysłane **dokładnie o sekundzie :01** w pełnej minucie:
- 11:40:01 - lead 270 (2x)
- 11:45:01 - lead 271 (2x)
- 11:50:01 - lead 272 (2x)
- 11:55:01 - lead 275 (2x)
- 12:00:01 - lead 276 (2x)
- 12:05:01 - lead 277 (2x)
- 12:10:01 - lead 280 (2x)
- 12:15:01 - lead 281 (2x)
- 12:20:01 - lead 283 (2x)
- 12:25:01 - lead 287 (2x)
- 12:30:04 - lead 288 (2x) - **wyjątek, 04 sekundy**
- 12:35:01 - lead 289 (2x)
- 12:40:01 - lead 292 (2x)
- 12:45:01 - lead 293 (2x)
- 12:50:01 - lead 295 (2x)

## 🎯 PRZYCZYNA:

### DO 11:40 - BRAK DUPLIKATÓW:
- Wysyłki były **nierównomiernie rozłożone** (9:19:09, 9:20:01, 9:35:18, 9:36:59, 10:05:37, itd.)
- Prawdopodobnie były **ręczne** lub przez przycisk "Wyślij kampanię"
- **Brak concurrent cronów** = brak duplikatów ✅

### OD 11:40 - DUPLIKATY:
- Wysyłki stały się **automatyczne** przez cron (co 1 minutę)
- Wszystkie o sekundzie **:01** = cron uruchamia się o **:00**, proces trwa ~1 sekundę
- **Dwa crony jednocześnie** pobierają tę samą kampanię → duplikaty ❌

## 🐛 ROOT CAUSE:

1. **Cron działa co 1 minutę** (`* * * * *`)
2. **Flaga `isCampaignCronTaskRunning`** nie jest wystarczająca - jeśli dwa procesy Next.js (hot reload?) uruchomią się jednocześnie, oba mają `false`
3. **Oba procesy** pobierają tę samą kampanię → oba widzą tych samych leadów z `campaign.CampaignLead`
4. **Oba próbują atomic lock** na tym samym leadzie → oba mogą przejść (race condition)
5. **Oba wysyłają mail** → duplikat

## ✅ ROZWIĄZANIE:

1. **Atomowe pobieranie leada** z bazy (zamiast relacji `campaign.CampaignLead`)
2. **Unique constraint** na `SendLog(campaignId, leadId, variantLetter)` jako dodatkowe zabezpieczenie
3. **Lepsze zarządzanie flagą** `isCampaignCronTaskRunning` (shared lock w bazie?)


