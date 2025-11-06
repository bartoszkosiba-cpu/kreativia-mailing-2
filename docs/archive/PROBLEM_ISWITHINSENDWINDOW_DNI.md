# PROBLEM Z FUNKCJĄ isWithinSendWindow - BŁĘDNE SPRAWDZANIE DNI

## 🔍 PROBLEM

Funkcja `isWithinSendWindow()` w `campaignEmailQueueV2.ts` błędnie sprawdzała dozwolone dni tygodnia.

**Błąd:**
```typescript
const dayNames = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const currentDayName = dayNames[currentDay];

if (!allowedDaysArray.includes(currentDayName)) {
  return false;
}
```

**Problem:**
- `allowedDays` w bazie używa formatu: `"MON,TUE,WED,THU,FRI"`
- Funkcja porównywała: `"poniedziałek"` (z polskiej tablicy) z `"MON"` (z bazy)
- **To się NIGDY nie dopasowało!**
- System myślał że jest poza dozwolonymi dniami i **NIE WYSYŁAŁ MAILI**

## 📊 WPŁYW

**Krytyczny błąd:**
- System NIE WYSYŁAŁ maili mimo że wszystko było OK
- Kampanie były IN_PROGRESS, maile w kolejce, skrzynki dostępne
- Ale system myślał że jest poza dozwolonymi dniami

## ✅ NAPRAWIONE

**Nowa implementacja:**
```typescript
const allowedDaysArray = campaign.allowedDays.split(',').map(d => d.trim().toUpperCase());
const dayMapping: { [key: number]: string } = {
  0: 'SUN', // niedziela
  1: 'MON', // poniedziałek
  2: 'TUE', // wtorek
  3: 'WED', // środa
  4: 'THU', // czwartek
  5: 'FRI', // piątek
  6: 'SAT'  // sobota
};

const currentDayCode = dayMapping[currentDay];

if (!currentDayCode || !allowedDaysArray.includes(currentDayCode)) {
  return false;
}
```

**Teraz:**
- Mapuje `getDay()` (0-6) na kody dni (MON, TUE, WED, etc.)
- Porównuje z `allowedDays` z bazy (MON, TUE, WED, etc.)
- ✅ Działa poprawnie!

---

**Data naprawy:** 2025-11-05  
**Status:** ✅ NAPRAWIONE

