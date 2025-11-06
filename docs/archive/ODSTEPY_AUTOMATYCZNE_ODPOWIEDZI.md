# ODSTĘPY MIĘDZY AUTOMATYCZNYMI ODPOWIEDZIAMI

## ❌ PROBLEM (PRZED NAPRAWĄ)

**Scenariusz:** Użytkownik zatwierdza 9 decyzji jednocześnie (klikając "Zatwierdź" jeden po drugim szybko)

**Co się działo:**
1. Wszystkie 9 MaterialResponse otrzymywało `scheduledAt = now() + 15 minut`
2. Wszystkie miały **ten sam** `scheduledAt` (np. 14:15:00)
3. Po 15 minutach cron pobierał wszystkie 9 maili jednocześnie
4. Wysyłał je z opóźnieniem **2 sekundy** między każdym (zabezpieczenie przed masową wysyłką)
5. **Wynik:** 9 maili wysłanych w ciągu ~18 sekund (zamiast z odstępem 15 minut!)

---

## ✅ ROZWIĄZANIE (PO NAPRAWIE)

**Nowa logika:**
1. Przy zatwierdzeniu decyzji, system sprawdza **ostatni zaplanowany MaterialResponse** dla tej kampanii
2. Jeśli istnieje → `scheduledAt = ostatni scheduledAt + delayMinutes`
3. Jeśli nie istnieje → `scheduledAt = now() + delayMinutes`

**Przykład:**
```
Decyzja 1: scheduledAt = 14:15:00 (now() + 15 min)
Decyzja 2: scheduledAt = 14:30:00 (14:15:00 + 15 min)
Decyzja 3: scheduledAt = 14:45:00 (14:30:00 + 15 min)
Decyzja 4: scheduledAt = 15:00:00 (14:45:00 + 15 min)
...
```

**Wynik:** ✅ Każdy kolejny mail ma odstęp `delayMinutes` (15 minut) od poprzedniego!

---

## 📋 ZMIANY W KODZIE

### Plik: `src/services/materialResponseSender.ts`

**Funkcja:** `scheduleMaterialResponse()`

**Przed:**
```typescript
const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
```

**Po:**
```typescript
// ✅ Znajdź ostatni zaplanowany MaterialResponse dla tej kampanii
const lastScheduled = await db.materialResponse.findFirst({
  where: {
    campaignId: reply.campaign.id,
    status: { in: ['scheduled', 'sending'] }
  },
  orderBy: {
    scheduledAt: 'desc'
  },
  select: {
    scheduledAt: true
  }
});

let scheduledAt: Date;

if (lastScheduled && lastScheduled.scheduledAt) {
  // Jeśli istnieje już zaplanowany mail, dodaj odstęp delayMinutes
  scheduledAt = new Date(lastScheduled.scheduledAt.getTime() + delayMinutes * 60 * 1000);
} else {
  // Jeśli nie ma żadnych zaplanowanych, użyj teraz + delayMinutes
  scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
}
```

---

## ✅ WERYFIKACJA

**Scenariusz testowy:**
1. Zatwierdź 9 decyzji jednocześnie (klikając szybko jeden po drugim)
2. Sprawdź `scheduledAt` dla każdego MaterialResponse w bazie

**Oczekiwany wynik:**
- Decyzja 1: `scheduledAt = now() + 15 min`
- Decyzja 2: `scheduledAt = (decyzja 1) + 15 min`
- Decyzja 3: `scheduledAt = (decyzja 2) + 15 min`
- ...
- Decyzja 9: `scheduledAt = (decyzja 8) + 15 min`

**Wysyłka:**
- Mail 1: wysłany po 15 minutach
- Mail 2: wysłany po 30 minutach (15 min od pierwszego)
- Mail 3: wysłany po 45 minutach (15 min od drugiego)
- ...
- Mail 9: wysłany po 135 minutach (15 min od ósmego)

✅ **Każdy mail ma odstęp 15 minut od poprzedniego!**

---

## 🎯 USTAWIENIA

- **`autoReplyDelayMinutes`** w ustawieniach kampanii (domyślnie 15 minut)
- Można zmienić w ustawieniach kampanii dla każdej kampanii osobno

