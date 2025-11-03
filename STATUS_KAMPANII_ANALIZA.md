# 📊 ANALIZA STATUSU KAMPANII - Podwieszenia targowe PL - 03.11.25

**Data sprawdzenia:** 2025-11-03, ~10:35  
**Status:** ✅ KAMPANIA DZIAŁA, ale wymaga uwagi

---

## ✅ CO DZIAŁA PRAWIDŁOWO

1. **Status kampanii:** `IN_PROGRESS` ✅
2. **Leady w kolejce:** 630 leadów gotowych do wysłania (`status=queued`) ✅
3. **Harmonogram:** 
   - Godziny: 9:00-15:00 ✅
   - Delay: 90 sekund między mailami ✅
   - Max dziennie: 500 ✅
4. **Wysłano:** 2-4 maile (zależnie od źródła danych) ✅

---

## ⚠️ OBSERWACJE WYMAGAJĄCE UWAGI

### 1. **OPÓŹNIENIE W WYSYŁCE**
- **Ostatnie 2 maile:** wysłane 15-16 minut temu (10:19-10:20)
- **Delay między mailami:** 90 sekund (1.5 minuty)
- **Oczekiwanie:** Powinno być wysłane już ~10-12 maili
- **Rzeczywistość:** Tylko 2-4 maile wysłane

**Możliwe przyczyny:**
- Cron job może nie działać poprawnie
- Harmonogram może blokować wysyłkę (sprawdź czy jest teraz 9:00-15:00)
- Limity dzienne handlowca mogą być osiągnięte (obecnie 3/150)

### 2. **ROZBIEŻNOŚĆ W STATYSTYKACH**
- **CampaignLead status=sent:** 2 leady
- **SendLog status=sent:** 4 maile
- **Różnica:** 2 maile w SendLog bez odpowiadającego CampaignLead

**Możliwe przyczyny:**
- Warmup maile (bez leadId)
- Testowe wysyłki
- Synchronizacja statusów może być opóźniona

### 3. **LIMITY HANDLOWCA**
- **Wysłano dzisiaj:** 3/150
- **Limit dzienny:** 150
- **Dostępne:** 147 maili dzisiaj ✅

---

## 📋 REKOMENDACJE (TYLKO SPRAWDZENIE, BEZ ZMIAN)

### NATYCHMIASTOWE SPRAWDZENIA:

1. **Czy cron działa?**
   ```bash
   # Sprawdź logi serwera - czy cron uruchamia się co minutę
   # Szukaj: "[CRON] 🔄 Rozpoczynam procesowanie kampanii..."
   ```

2. **Czy obecna godzina mieści się w harmonogramie?**
   - Harmonogram: 9:00-15:00
   - Jeśli jest przed 9:00 lub po 15:00 → system czeka na okno czasowe

3. **Czy są błędy w logach?**
   - Szukaj błędów SMTP
   - Szukaj błędów mailbox
   - Szukaj błędów w `scheduledSender.ts`

4. **Czy delay jest respektowany?**
   - Ostatnie maile: 10:19-10:20
   - Następny powinien być: ~10:21:30 (90 sekund później)
   - Jeśli jest już po 10:21:30 → sprawdź dlaczego nie wysyła

---

## 🔍 CO SPRAWDZIĆ W LOGACH SERWERA

Szukaj w logach następujących wpisów:

1. **Cron działa:**
   ```
   [CRON] 🔄 Rozpoczynam procesowanie kampanii...
   ```

2. **Harmonogram blokuje:**
   ```
   [SCHEDULER] Nie można wysłać - poza oknem czasowym
   ```

3. **Wysyłka maili:**
   ```
   [SENDER] Wysyłam email do...
   [SENDER] ✅ Email wysłany
   ```

4. **Błędy:**
   ```
   [SENDER] ❌ Błąd wysyłki...
   ```

---

## ✅ WSZYSTKO W PORZĄDKU ZE STRUKTURĄ

- ✅ Kampania ma status IN_PROGRESS
- ✅ 630 leadów w kolejce (gotowi do wysłania)
- ✅ Harmonogram jest poprawnie skonfigurowany
- ✅ Limity nie są przekroczone
- ✅ Handlowiec ma wystarczający limit dzienny (3/150)

---

## 🎯 PYTANIA DO SPRAWDZENIA

1. **Jaka jest obecna godzina?** (czy mieści się w 9:00-15:00?)
2. **Czy widzisz w logach serwera uruchomienia cron job?**
3. **Czy są jakieś błędy w konsoli/logach?**
4. **Czy następny mail został już wysłany** (sprawdź za chwilę)?

---

**Status:** ⚠️ **WYMAGA SPRAWDZENIA CRON I LOGÓW**  
**Nie wprowadzano zmian** - tylko odczyt i analiza ✅

