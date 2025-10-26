# PLAN IMPLEMENTACJI: URUCHOMIENIE KAMPANII Z HARMONOGRAMEM 🚀

## 📋 OBECNA SYTUACJA

### Co już działa:
1. **Przycisk "Uruchom kampanię"** (dla testów)
   - Wysyła NATYCHMIASTOWO
   - Limit: **max 20 leadów** (zabezpieczenie)
   - **NIE stosuje harmonogramu** (wszystkie maile od razu)

2. **Harmonogram** (dla produkcji)
   - Planuje na przyszłość (`scheduledAt`)
   - Stosuje okno czasowe, opóźnienia
   - Wymaga cron aby uruchomić

### Co NIE działa:
- ❌ Nie można uruchomić kampanii OD RAZU z harmonogramem
- ❌ Musi być ustawiony `scheduledAt` w przyszłości
- ❌ Nie ma walidacji "czy teraz mogę?"

---

## 🎯 CO CHCEMY OSIĄGNĄĆ

### Nowy przycisk: "Uruchom kampanię według harmonogramu"

**Zachowanie:**
1. Użytkownik klika "Uruchom kampanię według harmonogramu"
2. System sprawdza: **czy TERAZ jest w oknie czasowym?**
   - Dzień tygodnia (np. SUN)
   - Godzina (np. 18:00 w oknie 9:00-23:00)
   - Święta (jeśli włączone)
3. Jeśli **TAK** → start kampanii OD RAZU z harmonogramem
4. Jeśli **NIE** → błąd "Teraz nie jest dobry moment: [powód]"

**Kampania uruchamia się:**
- ✅ Od razu (nie czekamy na cron)
- ✅ Z pełnym harmonogramem (opóźnienia, rotacja skrzynek)
- ✅ Status: `SCHEDULED` → `IN_PROGRESS`

---

## ⚠️ ZAGROŻENIA I ZAGADNIENIA

### 1️⃣ **Konflikt z istniejącym przyciskiem**

**Problem:** Istnieje już przycisk "Uruchom kampanię" (max 20 leadów)

**Opcje:**
- **A)** Zmienić istniejący przycisk aby sprawdzał harmonogram
- **B)** Dodać nowy przycisk obok istniejącego
- **C)** Jeden przycisk z dwoma trybami (test/produkcja)

**Rekomendacja:** **B)** Dodać nowy przycisk "Uruchom według harmonogramu"

---

### 2️⃣ **Co zrobić z `scheduledAt`?**

**Problem:** Kampania ma `scheduledAt = null` (nie planowana), ale chcemy uruchomić

**Opcje:**
- **A)** Ustawić `scheduledAt = now()` przed startem
- **B)** Zostawić `null` - uruchomienie ręczne
- **C)** Ustawić `scheduledAt = now()` i `status = SCHEDULED`, potem zmienić na `IN_PROGRESS`

**Rekomendacja:** **C)** Symuluj SCHEDULED → potem od razu IN_PROGRESS (spójność)

---

### 3️⃣ **Co jeśli kampania już w trakcie?**

**Problem:** Użytkownik klika "Uruchom" gdy kampania już `IN_PROGRESS`

**Rozwiązanie:**
```typescript
if (campaign.status === "IN_PROGRESS") {
  return { error: "Kampania już działa, sprawdź Outbox" };
}
```

---

### 4️⃣ **Co jeśli poza oknem czasowym?**

**Problem:** Godzina 20:00, okno 9:00-17:00

**Rozwiązanie:**
```typescript
const validation = await isValidSendTime(...);
if (!validation.isValid) {
  return { 
    error: "Teraz nie jest dobry moment",
    reason: "Wysyłka poza oknem czasowym. Dozwolone: 9:00-17:00"
  };
}
```

---

### 5️⃣ **Pauza w trakcie wysyłki**

**Problem:** Kampania startuje o 18:00, okno do 20:00. Gdy kończy okno → co dalej?

**Obecna logika:** ✅ Już działa - kampania pauzuje i wznowi następnego dnia

**W naszym przypadku:** Uruchomienie ręczne → kampania kontynuuje aż skończy (opóźnienia między mailami)

---

### 6️⃣ **Co z cron?**

**Problem:** Cron sprawdza co 5 min, ale my uruchamiamy ręcznie

**Rozwiązanie:** Nie koliduje! 
- Cron będzie chciał pobrać tę samą kampanię
- Ale `getNextScheduledCampaign` zwraca tylko kampanie `SCHEDULED` lub `IN_PROGRESS`
- Nasza kampania będzie `IN_PROGRESS` → cron ją pominie (już działa)

---

## 🔧 PLAN IMPLEMENTACJI

### KROK 1: Nowy endpoint API

**Plik:** `app/api/campaigns/[id]/start/route.ts`

**Funkcjonalność:**
```typescript
export async function POST({ params }: { params: { id: string } }) {
  // 1. Pobierz kampanię
  const campaign = await db.campaign.findUnique({ where: { id } });
  
  // 2. Walidacja
  if (campaign.status === "IN_PROGRESS") {
    return NextResponse.json({ error: "Kampania już działa" }, { status: 400 });
  }
  
  if (campaign.status === "COMPLETED") {
    return NextResponse.json({ error: "Kampania już zakończona" }, { status: 400 });
  }
  
  // 3. Sprawdź czy teraz jest dobry moment
  const now = new Date();
  const validation = await isValidSendTime(
    now,
    campaign.allowedDays.split(','),
    campaign.startHour,
    campaign.endHour,
    campaign.respectHolidays,
    campaign.targetCountries?.split(',') || []
  );
  
  if (!validation.isValid) {
    return NextResponse.json({ 
      error: "Teraz nie jest dobry moment",
      reason: validation.reason 
    }, { status: 400 });
  }
  
  // 4. Ustaw scheduledAt = now() i status = SCHEDULED
  await db.campaign.update({
    where: { id },
    data: {
      scheduledAt: now,
      status: "SCHEDULED"
    }
  });
  
  // 5. NATYCHMIASTOWO uruchom kampanię (wywołaj processScheduledCampaign)
  await processScheduledCampaign();
  
  return NextResponse.json({ success: true, message: "Kampania uruchomiona" });
}
```

---

### KROK 2: Nowy przycisk w UI

**Plik:** `app/campaigns/[id]/CampaignScheduler.tsx`

**Dodaj przycisk:**
```typescript
<button
  onClick={handleStartCampaign}
  disabled={isStarting}
  style={{
    padding: "12px 24px",
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: isStarting ? "not-allowed" : "pointer"
  }}
>
  {isStarting ? "Uruchamianie..." : "🚀 Uruchom według harmonogramu"}
</button>
```

**Funkcja:**
```typescript
const handleStartCampaign = async () => {
  setIsStarting(true);
  try {
    const response = await fetch(`/api/campaigns/${campaignId}/start`, {
      method: "POST"
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert("Kampania uruchomiona!");
      window.location.reload();
    } else {
      alert(`Błąd: ${data.reason || data.error}`);
    }
  } finally {
    setIsStarting(false);
  }
};
```

---

### KROK 3: Walidacja przed uruchomieniem

**Scenariusze błędów:**

| Scenariusz | Błąd |
|------------|------|
| Kampania `IN_PROGRESS` | "Kampania już działa" |
| Kampania `COMPLETED` | "Kampania już zakończona" |
| Poza oknem czasowym | "Teraz nie jest dobry moment: Wysyłka poza oknem czasowym" |
| W weekend (jeśli nie dozwolony) | "Wysyłka niedozwolona w SUN" |
| W święto | "Ta data jest świętem" |

---

### KROK 4: Testowanie

**Test Case 1:** Uruchom o 18:00, okno 9-23
- ✅ Powinno działać

**Test Case 2:** Uruchom o 8:00, okno 9-23
- ❌ Błąd: "poza oknem czasowym"

**Test Case 3:** Uruchom w niedzielę, allowedDays = "MON,TUE"
- ❌ Błąd: "niedozwolony dzień"

**Test Case 4:** Kampania już IN_PROGRESS
- ❌ Błąd: "już działa"

---

## ✅ ZALETY I WADY

### ✅ Zalety:
1. **Natychmiastowa wysyłka** z pełnym harmonogramem
2. **Bezpieczeństwo** - walidacja czasu
3. **Spójność** - używa tej samej logiki co cron
4. **Elastyczność** - start w dowolnym momencie (jeśli w oknie)

### ⚠️ Zagrożenia:
1. **Duże kampanie** - może zająć wiele godzin (48 leadów × 30s = 24 min)
2. **Brak preview** - użytkownik nie wie ile potrwa
3. **Brak undo** - po starcie trudno zatrzymać (można tylko PAUSED ręcznie)

---

## 🎯 DO USTALENIA:

1. **Gdzie dodać przycisk?**
   - W `CampaignScheduler` obok "Edytuj harmonogram"?
   - W osobnym bloku "Uruchomienie"? ✅ (rekomendacja)

2. **Jaki label przycisku?**
   - "🚀 Uruchom według harmonogramu" ✅
   - "Start kampanii"
   - "Rozpocznij wysyłkę"

3. **Co gdy duża kampania (np. 500 leadów)?**
   - Podpowiedź: "Potrwa ~4h, potwierdź"?
   - Limit bezpieczeństwa? (np. max 100 leadów?)

4. **Status po uruchomieniu:**
   - `SCHEDULED` → `IN_PROGRESS` ✅
   - Czy zmienić `scheduledAt = now()`? ✅ (TAK)

---

## 📝 SZCZEGÓŁOWY FLOW:

```
1. Użytkownik klika "Uruchom według harmonogramu"
   ↓
2. Frontend: POST /api/campaigns/[id]/start
   ↓
3. API: Walidacja (status, czas, dzień)
   ↓
4. API: UPDATE campaign SET scheduledAt = now(), status = SCHEDULED
   ↓
5. API: processScheduledCampaign() - OD RAZU, nie czekam na cron
   ↓
6. Backend: isValidSendTime() → OK
   ↓
7. Backend: UPDATE campaign SET status = IN_PROGRESS
   ↓
8. Backend: Pętla wysyłki (z opóźnieniami)
   ↓
9. Backend: UPDATE campaign SET status = COMPLETED
```

---

## ❓ ODPOWIEDZI UŻYTKOWNIKA:

1. **Limit liczby leadów?** 
   - ❌ **NIE MA limitu** (poza istniejącym "Uruchom kampanię" który ma 20 leadów i jest BEZ harmonogramu)
   - Nowy przycisk = bez limitu

2. **Gdzie pokazać postęp?**
   - ✅ **TAK** - pokazuj postęp w czasie rzeczywistym
   - Pokazać w UI: "Wysłano 23/48" z update co jakiś czas

3. **Czy możliwa pauza?**
   - ✅ **TAK** - dodać przycisk "Pauza" w trakcie

4. **Czy potwierdzenie?**
   - ❌ **NIE** - duża liczba leadów jest rozłożona w czasie, więc nie ma problemu
   - Nie potrzebne alerty "czy jesteś pewien"

---

**Data:** 2025-10-26  
**Status:** ✅ Zaimplementowany

## ✅ CO ZOSTAŁO IMPLEMENTOWANE:

1. **NOWY ENDPOINT:** `/app/api/campaigns/[id]/start/route.ts`
   - `POST` - uruchomienie kampanii
   - `PUT` - pauza kampanii

2. **NOWY KOMPONENT:** `/app/campaigns/[id]/CampaignStartButton.tsx`
   - Przycisk "Uruchom według harmonogramu"
   - Pokazywanie postępu w czasie rzeczywistym (polling co 2s)
   - Przycisk "Pauza" w trakcie wysyłki
   - Szacowany czas wysyłki

3. **OBSŁUGA PAUSED:**
   - Kampania PAUSED może być wznowiona
   - Dodano PAUSED do getNextScheduledCampaign()

---

## 🎯 PRZYKŁAD UŻYCIA:

### Scenariusz 1: Uruchomienie kampanii

1. Otwórz kampanię: `http://localhost:3000/campaigns/123`
2. Zobacz blok "🚀 Uruchomienie według harmonogramu"
3. Kliknij "🚀 Uruchom według harmonogramu"
4. System sprawdza:
   - ✅ Czy teraz jest dobry moment? (dzień, godzina, święta)
   - ✅ Czy kampania ma subject, text, leadów?
5. Jeśli TAK → kampania uruchamia się OD RAZU
6. Widzisz postęp: "23/48 maili wysłanych (polling co 2s)"

### Scenariusz 2: Pauza w trakcie

1. Kampania działa (IN_PROGRESS)
2. Widzisz przycisk "⏸️ Pauza"
3. Kliknij Pauza → status zmieni się na PAUSED
4. Kampania zatrzymana, może być wznowiona

### Scenariusz 3: Błąd walidacji

1. Godzina 20:00, okno 9:00-17:00
2. Kliknij "Uruchom"
3. Błąd: "Teraz nie jest dobry moment: Wysyłka poza oknem czasowym. Dozwolone: 9:00-17:00"

