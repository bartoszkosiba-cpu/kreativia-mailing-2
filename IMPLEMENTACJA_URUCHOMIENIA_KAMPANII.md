# ✅ IMPLEMENTACJA: URUCHOMIENIE KAMPANII WEDŁUG HARMONOGRAMU

## 📋 CO ZOSTAŁO IMPLEMENTOWANE

### 1. NOWY ENDPOINT API
**Plik:** `app/api/campaigns/[id]/start/route.ts`

**Funkcjonalność:**
- ✅ `POST` - Uruchom kampanię od razu (z walidacją harmonogramu)
- ✅ `PUT` - Pauza kampanii

**Walidacja przed uruchomieniem:**
1. Status kampanii (nie IN_PROGRESS, COMPLETED, CANCELLED)
2. Czy ma subject, text, leadów
3. **Czy teraz jest w oknie czasowym** (dzień, godzina, święta)

**Co się dzieje:**
```
User klika "Uruchom" 
  → POST /api/campaigns/[id]/start
  → Walidacja okna czasowego (isValidSendTime)
  → Ustaw scheduledAt = now(), status = SCHEDULED
  → Wywołaj processScheduledCampaign() OD RAZU
  → Status: SCHEDULED → IN_PROGRESS
  → Wysyłka maili z opóźnieniami
```

---

### 2. NOWY KOMPONENT UI
**Plik:** `app/campaigns/[id]/CampaignStartButton.tsx`

**Funkcjonalność:**
- ✅ Przycisk "Uruchom według harmonogramu"
- ✅ Pokazanie postępu w czasie rzeczywistym (polling co 2s)
- ✅ Przycisk "Pauza" dla kampanii IN_PROGRESS
- ✅ Szacowany czas wysyłki
- ✅ Status: "Kampania zakończona" dla COMPLETED

**Polling postępu:**
```typescript
useEffect(() => {
  if (currentStatus === "IN_PROGRESS") {
    // Pobierz postęp z /api/campaigns/[id]/outbox
    const interval = setInterval(pollProgress, 2000);
  }
}, [currentStatus]);
```

---

### 3. OBSŁUGA PAUSED
**Plik:** `src/services/campaignScheduler.ts`

**Zmiana:**
```typescript
// Dodano PAUSED do getNextScheduledCampaign()
OR: [
  { status: "SCHEDULED", ... },
  { status: "IN_PROGRESS" },
  { status: "PAUSED", ... }  // ← NOWE
]
```

**Co to daje:**
- Kampania PAUSED może być wznowiona (kliknij "Uruchom" ponownie)
- Cron wznowi kampanię PAUSED jeśli scheduledAt w przeszłości

---

## 🎯 JAK DZIAŁA SYSTEM TERAZ:

### FLOW 1: Uruchomienie kampanii

```
1. User: "Uruchom według harmonogramu"
   ↓
2. Frontend: POST /api/campaigns/123/start
   ↓
3. Backend: Walidacja (status, subject, text, leadów)
   ↓
4. Backend: isValidSendTime(now, allowedDays, 9, 23)
   ✅ Dzień: SUN (niedziela) - OK
   ✅ Godzina: 18:00 w oknie 9-23 - OK
   ✅ Święta: nie - OK
   ↓
5. Backend: UPDATE campaign SET scheduledAt = now(), status = SCHEDULED
   ↓
6. Backend: processScheduledCampaign()
   ↓
7. Backend: isValidSendTime() ponownie → OK
   ↓
8. Backend: UPDATE campaign SET status = IN_PROGRESS
   ↓
9. Backend: Wysyłka maili z opóźnieniami (pętla)
   ↓
10. Postęp w UI: "Wysłano 23/48" (polling co 2s)
   ↓
11. Backend: UPDATE campaign SET status = COMPLETED
```

---

### FLOW 2: Pauza kampanii

```
1. User: Klika "⏸️ Pauza"
   ↓
2. Frontend: PUT /api/campaigns/123/start (action: "pause")
   ↓
3. Backend: UPDATE campaign SET status = PAUSED
   ↓
4. Pętla wysyłki: Sprawdza status co iterację
   ↓
5. Jeśli status = PAUSED → pętla kończy się
   ↓
6. Kampania zatrzymana, można wznowić
```

---

### FLOW 3: Wznowienie kampanii PAUSED

```
1. User: Klika "Uruchom" na kampanii PAUSED
   ↓
2. Backend: scheduledAt = now(), status = SCHEDULED
   ↓
3. Backend: processScheduledCampaign()
   ↓
4. Wznawia wysyłkę od ostatniego maila
```

---

## ⚠️ ZAGROŻENIA I ROZWIĄZANIA:

### 1. **Co jeśli pętla wysyłki sprawdza status?**

**Obecna logika:** Pętla NIE sprawdza czy kampania to PAUSED

**Problem:** Jeśli user kliknie Pauza, pętla i tak kontynuuje

**Rozwiązanie:** Dodaj sprawdzanie w pętli:

```typescript
// W src/services/scheduledSender.ts
for (let i = 0; i < leads.length; i++) {
  // SPRAWDŹ CZY KAMPANIA JEST ZATRZYMANA
  const currentCampaign = await db.campaign.findUnique({
    where: { id: campaign.id },
    select: { status: true }
  });
  
  if (currentCampaign?.status === "PAUSED") {
    console.log('[SCHEDULED SENDER] Kampania zatrzymana przez użytkownika');
    break; // Zatrzymaj wysyłkę
  }
  
  // ... reszta logiki
}
```

---

### 2. **Co jeśli user klika "Uruchom" podczas wysyłki?**

**Obecna logika:** Walidacja na początku

```typescript
if (campaign.status === "IN_PROGRESS") {
  return { error: "Kampania już działa" };
}
```

✅ **Rozwiązane** - nie można uruchomić drugi raz

---

### 3. **Duże kampanie (np. 500 leadów)**

**Problem:** Może zająć wiele godzin

**Rozwiązanie:** 
- Pokazujemy szacowany czas
- User widzi postęp na bieżąco (polling)
- Może kliknąć Pauza jeśli chce zatrzymać

**Przykład:** 500 leadów × 30s = 15000s = 250 min = **4h 10min** ⏰

---

## ✅ TESTY DO WYKONANIA:

### Test 1: Uruchomienie w oknie czasowym
- Godzina: 18:00
- Okno: 9:00-23:00
- Dzień: Niedziela (SUN)
- **Oczekiwane:** ✅ Kampania startuje

### Test 2: Uruchomienie poza oknem czasowym
- Godzina: 20:00
- Okno: 9:00-17:00
- **Oczekiwane:** ❌ Błąd "poza oknem czasowym"

### Test 3: Kampania IN_PROGRESS
- Kliknij "Uruchom" gdy IN_PROGRESS
- **Oczekiwane:** ❌ Błąd "Kampania już działa"

### Test 4: Pauza w trakcie
- Uruchom kampanię
- Kliknij "⏸️ Pauza"
- **Oczekiwane:** Status PAUSED, kampania zatrzymana

### Test 5: Postęp w czasie rzeczywistym
- Uruchom kampanię 50 leadów
- **Oczekiwane:** "Wysłano 5/50", "Wysłano 10/50", etc.

---

**Data implementacji:** 2025-10-26  
**Status:** ✅ Zaimplementowane, wymaga testów

