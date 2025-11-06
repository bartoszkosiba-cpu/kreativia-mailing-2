# STATUS ZATWIERDZONEJ WIADOMOŚCI

## 📊 ANALIZA

### Zatwierdzona wiadomość (MaterialResponse ID: 3)

**Dane:**
- **Lead:** Joanna Bereza (joanna@edelweiss.com.pl)
- **Kampania:** Podwieszenia targowe PL - 03.11.25
- **Status:** `scheduled` (czeka na wysyłkę)
- **Zaplanowana wysyłka:** 2025-11-05 16:55:23
- **Utworzona:** 2025-11-05 16:54:23
- **Temat:** "Re: Oferta podwieszeń targowych – konstrukcje, druk, ceny"

**Ustawienia kampanii:**
- `autoReplyEnabled`: ✅ Włączone (1)
- `autoReplyDelayMinutes`: 1 minuta

---

## ⏰ STATUS WYSYŁKI

**Aktualny czas:** 2025-11-05 16:55:44

**Zaplanowana wysyłka:** 2025-11-05 16:55:23

**Czy minął czas?** ✅ **TAK - GOTOWY DO WYSYŁKI**

**Cron job:** Działa co 2 minuty (`*/2 * * * *`)

---

## 🔄 CO SIĘ DZIEJE TERAZ?

1. ✅ MaterialResponse jest w statusie `scheduled`
2. ✅ `scheduledAt` już minął (16:55:23 < 16:55:44)
3. ✅ Mail jest **GOTOWY** do wysyłki
4. ⏳ **CZEKA** na najbliższe uruchomienie crona (co 2 minuty)

**Następne uruchomienie crona:**
- Cron działa co 2 minuty
- Ostatnie uruchomienie: 16:54:00 lub 16:56:00
- Następne uruchomienie: **16:56:00** (lub 16:58:00 jeśli minęło już)
- Mail zostanie wysłany w najbliższym uruchomieniu

---

## ✅ WERYFIKACJA

**Co się stanie:**
1. Cron uruchomi się w najbliższej minucie (16:56:00, 16:58:00, etc.)
2. Pobierze MaterialResponse z `status = 'scheduled'` i `scheduledAt <= now()`
3. Zmieni status na `'sending'` (atomowo)
4. Wyśle mail do leada
5. Zmieni status na `'sent'` i ustawi `sentAt`

**Oczekiwany czas wysyłki:** W ciągu najbliższych 2 minut (najbliższe uruchomienie crona)

---

## 📝 UWAGI

- Mail jest gotowy i czeka na cron
- Cron działa co 2 minuty, więc maksymalne opóźnienie to 2 minuty
- Jeśli cron nie uruchomi się w ciągu kilku minut, sprawdź logi serwera

