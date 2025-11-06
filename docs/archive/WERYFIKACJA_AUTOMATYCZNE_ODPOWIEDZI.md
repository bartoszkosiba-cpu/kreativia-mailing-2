# WERYFIKACJA BEZPIECZEŃSTWA - AUTOMATYCZNE ODPOWIEDZI Z MATERIAŁAMI

## 📋 JAK DZIAŁA SYSTEM

### 1. **Zatwierdzanie decyzji przez administratora**
- **Endpoint:** `POST /api/material-decisions/[id]` z `status: "APPROVED"`
- **Co się dzieje:**
  1. Sprawdza czy decyzja istnieje
  2. Wywołuje `scheduleMaterialResponse()` - NIE wysyła od razu!
  3. Tworzy `MaterialResponse` ze statusem `'scheduled'`
  4. Ustawia `scheduledAt = now() + delayMinutes` (domyślnie 15 minut)
  5. Aktualizuje `PendingMaterialDecision.status = 'APPROVED'`

### 2. **Wysyłka przez cron job**
- **Cron:** Co 2 minuty (`*/2 * * * *`)
- **Funkcja:** `sendScheduledMaterialResponses()`
- **Co się dzieje:**
  1. Pobiera max 10 maili ze statusem `'scheduled'` i `scheduledAt <= now()`
  2. Dla każdego maila:
     - Sprawdza czy status nadal `'scheduled'` (zapobiega duplikatom)
     - Atomowo zmienia status na `'sending'` (zapobiega równoległemu wysłaniu)
     - Wysyła mail
     - Opóźnienie 2 sekundy przed następnym mailem
     - Zmienia status na `'sent'` lub `'failed'`

---

## ✅ ZABEZPIECZENIA

### 1. **Limit liczby maili na raz**
- ✅ `take: 10` (było 50, zmniejszyliśmy)
- **Efekt:** Max 10 maili przetwarzanych w jednym cyklu cron

### 2. **Opóźnienie między mailami**
- ✅ `await new Promise(resolve => setTimeout(resolve, 2000))` - 2 sekundy
- **Efekt:** Max 10 maili w ciągu ~20 sekund (zamiast natychmiast)

### 3. **Atomowe blokowanie**
- ✅ Status `'scheduled'` → `'sending'` w atomowej transakcji
- ✅ Sprawdzenie statusu przed wysłaniem
- **Efekt:** Zapobiega równoległemu wysłaniu tego samego maila

### 4. **Sprawdzenie przed utworzeniem MaterialResponse**
- ✅ Sprawdza czy już istnieje MaterialResponse dla tego `replyId`
- **Efekt:** Zapobiega duplikatom

### 5. **Opóźnienie przed wysyłką**
- ✅ `scheduledAt = now() + delayMinutes` (domyślnie 15 minut)
- **Efekt:** Mail nie wysyła się od razu, tylko po 15 minutach (można zmienić w ustawieniach kampanii)

---

## 📊 OBECNY STAN KAMPANII 3

- **Oczekujące decyzje:** 8 (PENDING)
- **Zatwierdzone:** 0 (APPROVED)
- **Odrzucone:** 1 (REJECTED)
- **Zaplanowane do wysyłki:** 0 (scheduled)

---

## ✅ WERYFIKACJA BEZPIECZEŃSTWA

### Czy można bezpiecznie wysyłać?

**TAK ✅ - System jest bezpieczny:**

1. ✅ **Nie wysyła natychmiast** - maile są planowane z opóźnieniem (15 minut)
2. ✅ **Limit 10 maili na raz** - max 10 maili w jednym cyklu cron
3. ✅ **Opóźnienie 2 sekundy** - między każdym mailem
4. ✅ **Atomowe blokowanie** - zapobiega duplikatom
5. ✅ **Sprawdzenie duplikatów** - przed utworzeniem MaterialResponse

### Scenariusz: Zatwierdzenie 8 decyzji jednocześnie

```
1. Admin zatwierdza 8 decyzji (kliknięcie "Zatwierdź" dla każdej)
   → 8 MaterialResponse utworzonych ze statusem 'scheduled'
   → scheduledAt = now() + 15 minut

2. Po 15 minutach:
   → Cron job (co 2 minuty) pobiera max 10 maili gotowych
   → Znajdzie 8 maili ze statusem 'scheduled' i scheduledAt <= now()
   → Wysyła je jeden po drugim z opóźnieniem 2 sekundy
   → Czas wysyłki: ~16 sekund (8 maili × 2 sekundy)

3. Wysyłka:
   - Mail 1: wysłany natychmiast (po 15 minutach)
   - Mail 2: wysłany po 2 sekundach
   - Mail 3: wysłany po 4 sekundach
   - ...
   - Mail 8: wysłany po 14 sekundach
```

**Wynik:** ✅ Bezpieczne - 8 maili w ciągu ~16 sekund (z opóźnieniem 2s między każdym)

---

## 🎯 REKOMENDACJA

**System jest bezpieczny do użycia!**

Możesz zatwierdzić wszystkie oczekujące decyzje - system:
- Zaplanuje je z opóźnieniem 15 minut
- Wyśle max 10 na raz (masz 8, więc wszystko w jednym cyklu)
- Z opóźnieniem 2 sekundy między każdym mailem
- Z atomowym blokowaniem (zapobiega duplikatom)

**Czy chcesz żebym coś jeszcze sprawdził lub zmienił?**

