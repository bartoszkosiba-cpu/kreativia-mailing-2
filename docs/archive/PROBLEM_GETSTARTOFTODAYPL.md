# PROBLEM Z FUNKCJĄ getStartOfTodayPL()

## 🔍 OPIS PROBLEMU

Funkcja `getStartOfTodayPL()` zwraca **błędną datę** - zamiast początku dzisiaj (4.11.2025, 00:00:00) zwraca wczoraj wieczorem (3.11.2025, 22:00:00).

**Różnica:** ~25 godzin wstecz

## 📊 WPŁYW NA SYSTEM

### **1. Limity kampanii (maxEmailsPerDay)**

**Lokalizacja:** `src/services/campaignEmailSenderV2.ts:292-302`

**Problem:**
- System liczy maile od wczoraj wieczorem jako "dzisiaj"
- Jeśli wczoraj wieczorem wysłano 25 maili, system myśli że dzisiaj już wysłano 25 maili
- **Rezultat:** Kampania może zatrzymać się zbyt wcześnie lub nie wystartować

**Przykład:**
```
Limit dzienny: 500 maili
Wczoraj wieczorem wysłano: 25 maili
Dzisiaj wysłano: 2 maile testowe

System myśli:
  - Dzisiaj wysłano: 27 maili (25 z wczoraj + 2 dzisiaj)
  - Pozostało: 473 maile

Prawidłowo:
  - Dzisiaj wysłano: 2 maile
  - Pozostało: 498 maili
```

### **2. Limity skrzynek mailowych**

**Lokalizacja:** 
- `src/services/mailboxManager.ts:378-403` - synchronizacja currentDailySent
- `app/api/campaigns/[id]/mailboxes/route.ts:142-143` - wyświetlanie w UI

**Problem:**
- System liczy maile z wczoraj wieczorem jako "dzisiaj"
- Skrzynka może być oznaczona jako "pełna" zbyt wcześnie
- **Rezultat:** Skrzynka może być pomijana mimo że ma jeszcze miejsce

**Przykład:**
```
Limit dzienny skrzynki: 50 maili
Wczoraj wieczorem wysłano: 25 maili
Dzisiaj wysłano: 2 maile

System myśli:
  - Dzisiaj wysłano: 27 maili
  - Pozostało: 23 maile

Prawidłowo:
  - Dzisiaj wysłano: 2 maile
  - Pozostało: 48 maili
```

### **3. Wykluczanie skrzynek używanych przez inne kampanie**

**Lokalizacja:** `src/services/mailboxManager.ts:149-171`

**Problem:**
- System sprawdza czy skrzynka była używana "dzisiaj" przez inne kampanie
- Jeśli wczoraj wieczorem inna kampania używała skrzynki, system myśli że używa jej "dzisiaj"
- **Rezultat:** Skrzynka może być błędnie wykluczona z kampanii

### **4. Statystyki w UI**

**Lokalizacja:** 
- `app/api/campaigns/[id]/sending-info/route.ts:300-301`
- `app/api/campaigns/[id]/mailboxes/route.ts:142-143`

**Problem:**
- UI pokazuje błędną liczbę maili wysłanych "dzisiaj"
- Statystyki są nieprawidłowe dla użytkownika

## ✅ CZY NOWA KAMPANIA BĘDZIE PRAWDŁOWA?

**NIE** - nowa kampania będzie miała ten sam problem, bo używa tej samej funkcji.

## 🔧 ROZWIĄZANIE

**Muszę naprawić funkcję `getStartOfTodayPL()` w `src/utils/polishTime.ts`.**

Problem jest w funkcji `createPolishDate()` która nieprawidłowo konwertuje datę na UTC.

**Status:** ⚠️ **WYMAGA NAPRAWY**

---

**Data analizy:** 2025-11-04  
**Priorytet:** **WYSOKI** - wpływa na wszystkie kampanie i limity

