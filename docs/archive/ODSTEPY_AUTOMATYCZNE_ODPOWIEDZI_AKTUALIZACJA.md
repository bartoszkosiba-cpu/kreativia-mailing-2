# ODSTĘPY MIĘDZY AUTOMATYCZNYMI ODPOWIEDZIAMI - AKTUALIZACJA

## ✅ ZMIANY

### 1. **Cofnięto logikę odstępów między zaplanowanymi mailami**
- Wróciło do: `scheduledAt = now() + delayMinutes` (wszystkie w tym samym czasie)
- Jeśli zatwierdzisz 9 decyzji jednocześnie, wszystkie będą miały ten sam `scheduledAt`

### 2. **Zwiększono odstęp między wysyłaniem maili w cron job**
- **Przed:** 2 sekundy między każdym mailem
- **Po:** 63 sekundy między każdym mailem

---

## 📋 JAK DZIAŁA TERAZ

### Scenariusz: Zatwierdzenie 9 decyzji jednocześnie

**Planowanie:**
```
Decyzja 1: scheduledAt = 14:15:00 (now() + 15 min)
Decyzja 2: scheduledAt = 14:15:00 (now() + 15 min) - TEN SAM CZAS
Decyzja 3: scheduledAt = 14:15:00 (now() + 15 min) - TEN SAM CZAS
...
Decyzja 9: scheduledAt = 14:15:00 (now() + 15 min) - TEN SAM CZAS
```

**Wysyłka (po 15 minutach):**
- Mail 1: wysłany o 14:15:00
- Mail 2: wysłany o 14:16:03 (63 sekundy później)
- Mail 3: wysłany o 14:17:06 (63 sekundy później)
- Mail 4: wysłany o 14:18:09 (63 sekundy później)
- ...
- Mail 9: wysłany o 14:23:24 (63 sekundy później)

**Wynik:** ✅ 9 maili wysłanych w ciągu ~8.5 minuty z odstępem 63 sekundy między każdym

---

## 📝 ZMIANY W KODZIE

**Plik:** `src/services/materialResponseSender.ts`

**1. Cofnięto logikę odstępów:**
```typescript
// PRZED (z odstępami):
const lastScheduled = await db.materialResponse.findFirst(...);
if (lastScheduled) {
  scheduledAt = new Date(lastScheduled.scheduledAt.getTime() + delayMinutes * 60 * 1000);
}

// PO (wszystkie w tym samym czasie):
const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
```

**2. Zwiększono odstęp między wysyłaniem:**
```typescript
// PRZED:
await new Promise(resolve => setTimeout(resolve, 2000)); // 2 sekundy

// PO:
await new Promise(resolve => setTimeout(resolve, 63000)); // 63 sekundy
```

---

## ✅ WERYFIKACJA

- ✅ Wszystkie zatwierdzone decyzje mają ten sam `scheduledAt`
- ✅ Wysyłka odbywa się z odstępem 63 sekundy między każdym mailem
- ✅ Kod bez błędów kompilacji

