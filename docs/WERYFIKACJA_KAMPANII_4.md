# WERYFIKACJA KAMPANII 4

**Data:** 2025-11-05  
**Kampania:** Biura nieruchomości PL - ścianki 03.11.25

---

## 📋 PODSTAWOWE DANE

- **ID:** 4
- **Nazwa:** Biura nieruchomości PL - ścianki 03.11.25
- **Status:** `PAUSED` ⚠️
- **Jest follow-up:** Nie
- **Data utworzenia:** 2025-11-03
- **Data aktualizacji:** 2025-11-04

---

## 📦 V2 QUEUE

**Status:** ✅ **TAK - kampania używa V2**

- **Wierszy w kolejce:** 148
- **Statusy:**
  - `sent`: 65 (wysłane)
  - `cancelled`: 62 (anulowane - prawdopodobnie z powodu PAUSED)
  - `pending`: 20 (oczekujące)
  - `failed`: 1 (błąd)

**Wnioski:**
- ✅ Kampania ma wiersze w `CampaignEmailQueue` - **używa V2**
- ⚠️ 62 wiersze mają status `cancelled` - prawdopodobnie z powodu statusu `PAUSED`
- ⚠️ 20 wierszy `pending` - będą wysłane po wznowieniu kampanii

---

## 👤 HANDLOWIEC

- **ID:** 1
- **Nazwa:** Adam Martin
- **Email:** adam.martin@kreativia.eu
- **Język:** pl
- **Aktywne skrzynki:** 6

### 📧 SZczegóły skrzynek:

**Status:** ✅ **Wszystkie skrzynki mają poprawne limity**

| Skrzynka | Priority | Limit dzienny | Wysłano dziś | Dostępne | Last used |
|----------|----------|---------------|--------------|----------|-----------|
| adam.martin@kreativia.eu | 1 | 50 ✅ | 2 | 48 | 2025-11-03 21:16 |
| adam.martin@mail.kreativia.eu | 2 | 50 ✅ | 0 | 50 | 2025-11-03 21:17 |
| adam.martin@sales.kreativia.eu | 3 | 50 ✅ | 0 | 50 | 2025-11-03 20:34 |
| adam.martin@team.kreativia.eu | 4 | 50 ✅ | 0 | 50 | 2025-11-03 20:36 |
| adam.martin@work.kreativia.eu | 5 | 50 ✅ | 0 | 50 | 2025-11-03 20:38 |
| adam.martin@pro.kreativia.eu | 6 | 50 ✅ | 0 | 50 | 2025-11-03 20:51 |

**Analiza:**
- ✅ Wszystkie skrzynki mają `dailyEmailLimit: 50`
- ✅ Łączna dostępna pojemność: 298 maili/dzień (50*6 - 2)
- ✅ System V2 może używać wszystkich skrzynek
- ✅ Skrzynki są poprawnie skonfigurowane

---

## 👥 LEADY

- **Wszystkich:** 317
- **W kolejce (queued):** 258
- **Zaplanowanych (planned):** 0
- **Wysłanych (sent):** 59

**Wnioski:**
- ✅ Są leady do wysyłki (258 w kolejce)
- ✅ 59 leadów już otrzymało emaile

---

## 📅 HARMONOGRAM

- **Dozwolone dni:** MON,TUE,WED,THU,FRI
- **Godziny:** 16:00 - 23:55
- **Opóźnienie między emailami:** 90 sekund
- **Max emaili dziennie:** 500

**Wnioski:**
- ✅ Harmonogram jest poprawnie skonfigurowany
- ✅ Okno czasowe: 16:00-23:55 (7h 55min)
- ✅ Opóźnienie: 90s (z ±20% = 72-108s)

---

## 📝 TREŚĆ

- **Temat:** Modułowe ścianki tekstylne dla biur nieruchomości
- **Treść:** ✅ Istnieje

**Wnioski:**
- ✅ Temat i treść są wypełnione

---

## 🔒 BLOKADY SKRZYNEK

- ✅ Brak konfliktów - skrzynki dostępne

**Wnioski:**
- ✅ Żadna inna kampania nie używa tych samych skrzynek

---

## ✅ GOTOWOŚĆ DO WYSYŁKI

### ❌ **PROBLEMY:**

1. **Status nie jest IN_PROGRESS** (aktualny: `PAUSED`)
   - Kampania musi być wznowiona (`status = 'IN_PROGRESS'`) aby wysyłka działała
   - Po wznowieniu, 20 wierszy `pending` w kolejce będą wysłane

---

## 🔍 UŻYWA V2?

✅ **TAK** - kampania ma wiersze w `CampaignEmailQueue`

**Wnioski:**
- ✅ Kampania jest zgodna z V2
- ✅ Kolejka jest zainicjalizowana (148 wierszy)
- ⚠️ 20 wierszy `pending` czeka na wysyłkę
- ⚠️ 62 wiersze `cancelled` (prawdopodobnie z powodu `PAUSED`)

---

## 📊 REKOMENDACJE

### 1. **Wznowienie kampanii**

**Problem:** Status kampanii to `PAUSED`

**Rozwiązanie:**
- Zmień status na `IN_PROGRESS` aby wznowić wysyłkę
- 20 wierszy `pending` w kolejce będą wysłane po wznowieniu

### 2. **Oczyszczenie kolejki (opcjonalnie)**

**Problem:** 62 wiersze `cancelled` w kolejce

**Rozwiązanie:**
- Można usunąć wiersze `cancelled` (nie są już potrzebne)
- System automatycznie utworzy nowe wiersze dla `queued` leadów po wznowieniu

---

## ✅ PODSUMOWANIE

### **Co działa:**
- ✅ Kampania używa V2 (ma wiersze w `CampaignEmailQueue`)
- ✅ Harmonogram jest poprawnie skonfigurowany
- ✅ Treść i temat są wypełnione
- ✅ Są leady do wysyłki (258 w kolejce)
- ✅ Brak konfliktów skrzynek z innymi kampaniami

### **Co wymaga poprawy:**
- ❌ **Status:** `PAUSED` → zmień na `IN_PROGRESS`

### **Status gotowości:**
✅ **GOTOWA** - wymaga tylko:
1. Wznowienia kampanii (status → `IN_PROGRESS`)

---

**Data weryfikacji:** 2025-11-05  
**Weryfikował:** Auto (AI Assistant)

