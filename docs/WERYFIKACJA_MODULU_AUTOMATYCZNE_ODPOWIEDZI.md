# WERYFIKACJA MODUŁU "AUTOMATYCZNE ODPOWIEDZI"

**Data:** 2025-11-05  
**Weryfikacja:** Kompleksowa analiza wszystkich plików i scenariuszy

---

## 📋 SPIS TREŚCI

1. [Przegląd architektury](#przegląd-architektury)
2. [Weryfikacja plików UI](#weryfikacja-plików-ui)
3. [Weryfikacja logiki biznesowej](#weryfikacja-logiki-biznesowej)
4. [Weryfikacja integracji](#weryfikacja-integracji)
5. [Scenariusze testowe](#scenariusze-testowe)
6. [Znalezione problemy](#znalezione-problemy)
7. [Rekomendacje](#rekomendacje)

---

## 1. PRZEGLĄD ARCHITEKTURY

### **Kluczowe komponenty:**

#### **UI (Frontend):**
- `AutoReplySettings.tsx` - Ustawienia automatycznych odpowiedzi
- `CampaignAutoRepliesTabs.tsx` - Zarządzanie podkartami (Ustawienia, Oczekujące, Odrzucone, Wysłane)
- `CampaignMaterialDecisions.tsx` - Lista decyzji i wysłanych odpowiedzi
- `MaterialsManager.tsx` - Zarządzanie materiałami (linki i załączniki)

#### **Backend Services:**
- `emailAgentAI.ts` - Klasyfikacja odpowiedzi i tworzenie PendingMaterialDecision
- `materialResponseAI.ts` - Generowanie treści odpowiedzi z materiałami
- `materialResponseSender.ts` - Wysyłka zaplanowanych odpowiedzi
- `emailCron.ts` - Cron job wywołujący `sendScheduledMaterialResponses()`

#### **API Endpoints:**
- `/api/campaigns/[id]/auto-replies` - GET: Pobiera historię i decyzje
- `/api/material-decisions/[id]` - POST: Zatwierdza/Odrzuca decyzję
- `/api/material-decisions/[id]/preview` - GET: Podgląd odpowiedzi
- `/api/material-decisions/[id]/send-test` - POST: Testowa wysyłka
- `/api/campaigns/[id]/materials` - GET/POST: Zarządzanie materiałami

---

## 2. WERYFIKACJA PLIKÓW UI

### ✅ **AutoReplySettings.tsx**
**Status:** ✅ POPRAWNY

**Znalezione:**
- Checkbox `autoReplyEnabled` jest ukryty (zgodnie z wymaganiami)
- Funkcjonalność zawsze włączona (`enabled = true`)
- `useEffect` ustawia `autoReplyEnabled = true` w bazie przy załadowaniu
- Podgląd odpowiedzi działa poprawnie
- Obsługa Guardian (opiekun) działa poprawnie

**Potencjalne problemy:**
- ❌ **BRAK** - wszystko działa poprawnie

---

### ✅ **CampaignAutoRepliesTabs.tsx**
**Status:** ✅ POPRAWNY

**Znalezione:**
- 4 podkarty: Ustawienia, Oczekujące, Odrzucone, Wysłane
- Synchronizacja hash URL działa poprawnie
- Przekazywanie props do `CampaignMaterialDecisions` jest poprawne

**Potencjalne problemy:**
- ❌ **BRAK** - wszystko działa poprawnie

---

### ✅ **CampaignMaterialDecisions.tsx**
**Status:** ✅ POPRAWNY

**Znalezione:**
- Wyświetlanie daty i godziny otrzymania odpowiedzi ✅
- Obsługa trzech trybów: `showOnlyPending`, `showOnlyRejected`, `showOnlyHistory`
- Funkcja "Powrót" (restore) dla odrzuconych decyzji
- Podgląd odpowiedzi z pełną treścią
- Testowa wysyłka z załącznikami

**Potencjalne problemy:**
- ❌ **BRAK** - wszystko działa poprawnie

---

## 3. WERYFIKACJA LOGIKI BIZNESOWEJ

### ✅ **emailAgentAI.ts - Tworzenie PendingMaterialDecision**
**Status:** ✅ POPRAWNY

**Logika:**
```typescript
case 'INTERESTED':
  // ✅ Zawsze sprawdzaj czy to prośba o materiały (niezależnie od autoReplyEnabled)
  const materialAnalysis = await this.checkMaterialRequest(reply, campaign);
  
  // Jeśli to prośba o materiały - zawsze dodaj do kolejki administratora
  if (materialAnalysis.isMaterialRequest && materialAnalysis.confidence >= 0.6) {
    return {
      actions: [{ type: 'ASK_ADMIN_MATERIALS', ... }],
      materialAnalysis
    };
  }
```

**Wykonanie akcji:**
```typescript
case 'ASK_ADMIN_MATERIALS':
  const { createPendingMaterialDecision } = await import('./materialResponseSender');
  await createPendingMaterialDecision(replyId, analysis.materialAnalysis);
```

**Weryfikacja:**
- ✅ `PendingMaterialDecision` jest tworzony **zawsze** gdy `INTERESTED` i `confidence >= 0.6`
- ✅ **NIE** zależy od `autoReplyEnabled` (to jest kolejka decyzji, nie automatyczna wysyłka)
- ✅ Zapobieganie duplikatom działa (sprawdza `replyId` i `status = 'PENDING'`)

---

### ✅ **materialResponseSender.ts - scheduleMaterialResponse**
**Status:** ✅ POPRAWNY

**Logika:**
- ✅ Generuje treść odpowiedzi przez `generateMaterialResponse()`
- ✅ Oblicza `scheduledAt = now + autoReplyDelayMinutes`
- ✅ **Zapobieganie duplikatom:** Sprawdza istniejące `MaterialResponse` dla `replyId`
- ✅ Jeśli istniejący jest `failed`, aktualizuje na `scheduled` (zamiast tworzyć nowy)
- ✅ Aktualizuje status leada na `ZAINTERESOWANY`
- ✅ Dodaje kampanię do `blockedCampaigns` leada

**Potencjalne problemy:**
- ❌ **BRAK** - wszystko działa poprawnie

---

### ✅ **materialResponseSender.ts - sendScheduledMaterialResponses**
**Status:** ✅ POPRAWNY

**Logika:**
```typescript
const scheduledResponses = await db.materialResponse.findMany({
  where: {
    status: 'scheduled',
    scheduledAt: { lte: now },
    campaign: {
      autoReplyEnabled: true // ✅ TYLKO jeśli autoReplyEnabled = true
    }
  }
});
```

**Weryfikacja:**
- ✅ **Sprawdza `autoReplyEnabled`** - tylko kampanie z włączonymi automatycznymi odpowiedziami
- ✅ Regeneruje treść jeśli potrzebna (na wypadek zmian w szablonie)
- ✅ Obsługa załączników (ATTACHMENT) i linków (LINK)
- ✅ Formatowanie cytatu z odpowiedzi leada
- ✅ Zapisywanie do `SendLog`
- ✅ Aktualizacja `currentDailySent` i `lastUsedAt` skrzynki

**Potencjalne problemy:**
- ❌ **BRAK** - wszystko działa poprawnie

---

### ✅ **materialResponseSender.ts - createPendingMaterialDecision**
**Status:** ✅ POPRAWNY

**Logika:**
- ✅ Sprawdza czy już istnieje decyzja dla `replyId` (status `PENDING`)
- ✅ Tworzy `PendingMaterialDecision` z danymi z analizy
- ✅ Zapobieganie duplikatom działa poprawnie

**Potencjalne problemy:**
- ❌ **BRAK** - wszystko działa poprawnie

---

## 4. WERYFIKACJA INTEGRACJI

### ✅ **emailCron.ts - Cron job**
**Status:** ✅ POPRAWNY

**Kod:**
```typescript
// Wyślij zaplanowane odpowiedzi z materiałami
try {
  const { sendScheduledMaterialResponses } = await import('./materialResponseSender');
  const sentCount = await sendScheduledMaterialResponses();
  if (sentCount > 0) {
    console.log(`[CRON] ✓ Wysłano ${sentCount} odpowiedzi z materiałami`);
  }
} catch (error: any) {
  console.error('[CRON] ✗ Błąd wysyłki materiałów:', error.message);
}
```

**Weryfikacja:**
- ✅ Wywoływany w cron job co 1 minutę
- ✅ Obsługa błędów działa poprawnie
- ✅ Logowanie działa poprawnie

---

### ✅ **API Endpoints**

#### **GET /api/campaigns/[id]/auto-replies**
**Status:** ✅ POPRAWNY

**Zwraca:**
- `MaterialResponse` (historia wysłanych)
- `PendingMaterialDecision` (oczekujące decyzje)

**Filtrowanie:**
- ✅ `type` - "material" | "decision"
- ✅ `status` - filtrowanie po statusie
- ✅ Paginacja (`limit`, `offset`)

**Weryfikacja:**
- ✅ Filtruje zatwierdzone decyzje które już mają `MaterialResponse` (zapobiega duplikatom w UI)

---

#### **POST /api/material-decisions/[id]**
**Status:** ✅ POPRAWNY

**Logika:**
- ✅ `APPROVED` → wywołuje `scheduleMaterialResponse()`
- ✅ `REJECTED` → aktualizuje status na `REJECTED`, **NIE** tworzy `MaterialResponse`
- ✅ `PENDING` (restore) → przywraca decyzję, czyści `decidedAt`, `decidedBy`, `decisionNote`

**Weryfikacja:**
- ✅ Wszystkie scenariusze obsłużone poprawnie

---

## 5. SCENARIUSZE TESTOWE

### **Scenariusz 1: Lead INTERESTED z prośbą o materiały (confidence >= 0.6)**

**Kroki:**
1. Lead otrzymuje email z kampanii
2. Lead odpowiada: "Proszę o katalog i wycenę"
3. `emailAgentAI.processEmailReply()` klasyfikuje jako `INTERESTED`
4. `checkMaterialRequest()` wykrywa prośbę o materiały (confidence: 0.8)
5. `determineActions()` zwraca `ASK_ADMIN_MATERIALS`
6. `executeActions()` wywołuje `createPendingMaterialDecision()`
7. `PendingMaterialDecision` jest tworzony (status: `PENDING`)

**Oczekiwany rezultat:**
- ✅ `PendingMaterialDecision` utworzony
- ✅ Lead status: `ZAINTERESOWANY`
- ✅ Decyzja widoczna w UI: "Oczekujące na decyzje"
- ✅ Admin może zatwierdzić/odrzucić

**Weryfikacja:** ✅ **POPRAWNY**

---

### **Scenariusz 2: Admin zatwierdza decyzję**

**Kroki:**
1. Admin klika "Zatwierdź" w UI
2. `POST /api/material-decisions/[id]` z `status: 'APPROVED'`
3. `scheduleMaterialResponse()` jest wywoływane
4. `MaterialResponse` jest tworzony (status: `scheduled`, `scheduledAt = now + delay`)
5. Cron job (`sendScheduledMaterialResponses()`) wywołuje się co 1 minutę
6. Gdy `scheduledAt <= now` i `autoReplyEnabled = true`, email jest wysyłany
7. `MaterialResponse` status: `sent`, `SendLog` utworzony

**Oczekiwany rezultat:**
- ✅ `MaterialResponse` utworzony i zaplanowany
- ✅ Email wysłany po opóźnieniu
- ✅ Status: `sent`
- ✅ Widoczny w "Wysłane"

**Weryfikacja:** ✅ **POPRAWNY**

---

### **Scenariusz 3: Admin odrzuca decyzję**

**Kroki:**
1. Admin klika "Odrzuć" w UI
2. `POST /api/material-decisions/[id]` z `status: 'REJECTED'`
3. `PendingMaterialDecision` status: `REJECTED`
4. **NIE** tworzy się `MaterialResponse`

**Oczekiwany rezultat:**
- ✅ `PendingMaterialDecision` status: `REJECTED`
- ✅ **NIE** ma `MaterialResponse`
- ✅ Widoczny w "Odrzucone"
- ✅ Możliwość przywrócenia (restore)

**Weryfikacja:** ✅ **POPRAWNY**

---

### **Scenariusz 4: autoReplyEnabled = false (checkbox ukryty, ale może być w bazie)**

**Kroki:**
1. Kampania ma `autoReplyEnabled = false` w bazie
2. Lead INTERESTED z prośbą o materiały
3. `emailAgentAI` tworzy `PendingMaterialDecision` (niezależnie od `autoReplyEnabled`)
4. Admin zatwierdza decyzję
5. `scheduleMaterialResponse()` tworzy `MaterialResponse` (status: `scheduled`)
6. Cron job (`sendScheduledMaterialResponses()`) sprawdza `autoReplyEnabled = true`
7. **NIE** wysyła emaila (bo `autoReplyEnabled = false`)

**Oczekiwany rezultat:**
- ✅ `PendingMaterialDecision` utworzony (niezależnie od `autoReplyEnabled`)
- ✅ `MaterialResponse` utworzony (po zatwierdzeniu)
- ✅ **NIE** wysyła emaila (bo `autoReplyEnabled = false`)
- ✅ `MaterialResponse` pozostaje w statusie `scheduled`

**Weryfikacja:** ✅ **POPRAWNY**

**UWAGA:** Jeśli `autoReplyEnabled = false`, `MaterialResponse` pozostanie w statusie `scheduled` i nie zostanie wysłany. To może być problem, jeśli admin zatwierdzi decyzję, ale zapomni włączyć `autoReplyEnabled`.

**Rekomendacja:** Rozważyć zmianę logiki - jeśli admin zatwierdza decyzję, automatycznie włącz `autoReplyEnabled` lub wyślij email natychmiast (bez opóźnienia).

---

### **Scenariusz 5: Duplikaty - Lead odpowiada dwukrotnie**

**Kroki:**
1. Lead odpowiada: "Proszę o katalog"
2. `createPendingMaterialDecision()` tworzy `PendingMaterialDecision` (ID: 1)
3. Lead odpowiada ponownie: "Aktualizacja: proszę też o wycenę"
4. `createPendingMaterialDecision()` sprawdza istniejące decyzje
5. Znajduje `PendingMaterialDecision` (ID: 1, status: `PENDING`)
6. **NIE** tworzy duplikatu

**Oczekiwany rezultat:**
- ✅ **NIE** tworzy duplikatu
- ✅ Zwraca istniejący `PendingMaterialDecision` ID

**Weryfikacja:** ✅ **POPRAWNY**

---

### **Scenariusz 6: Załączniki - Testowa wysyłka**

**Kroki:**
1. Admin dodaje załącznik (katalog.pdf) do materiałów
2. Admin klika "Test" w decyzji
3. `POST /api/material-decisions/[id]/send-test`
4. System szuka pliku w `uploads/materials/`
5. Plik jest dołączany do emaila testowego

**Oczekiwany rezultat:**
- ✅ Plik znajduje się (sprawdza różne ścieżki)
- ✅ Email testowy zawiera załącznik
- ✅ Nazwa pliku jest poprawna

**Weryfikacja:** ✅ **POPRAWNY** (po ostatnich poprawkach)

---

### **Scenariusz 7: Formatowanie emaila - Cytat z odpowiedzi leada**

**Kroki:**
1. Lead odpowiada: "Dzień dobry, proszę o katalog"
2. Admin zatwierdza decyzję
3. Email jest wysyłany z odpowiedzią
4. Na końcu emaila jest cytat z odpowiedzi leada

**Oczekiwany rezultat:**
- ✅ Cytat ma wizualne oznaczenie (`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
- ✅ Każda linia ma prefix `> `
- ✅ W HTML: szary kolor, wcięcie, border
- ✅ Odstępy przed cytatem (`\n\n\n`)

**Weryfikacja:** ✅ **POPRAWNY** (po ostatnich poprawkach)

---

## 6. ZNALEZIONE PROBLEMY

### ❌ **Problem 1: MaterialResponse może zostać w statusie `scheduled` jeśli `autoReplyEnabled = false`**

**Opis:**
- Jeśli admin zatwierdza decyzję, ale kampania ma `autoReplyEnabled = false`, `MaterialResponse` pozostanie w statusie `scheduled` i nie zostanie wysłany.

**Rozwiązanie:**
1. **Opcja A:** Automatycznie włącz `autoReplyEnabled = true` gdy admin zatwierdza decyzję
2. **Opcja B:** Wyślij email natychmiast (bez opóźnienia) gdy admin zatwierdza, niezależnie od `autoReplyEnabled`
3. **Opcja C:** Sprawdź `autoReplyEnabled` w `scheduleMaterialResponse()` i ostrzeż admina jeśli jest wyłączone

**Rekomendacja:** Opcja B (wyślij natychmiast po zatwierdzeniu)

---

### ⚠️ **Problem 2: Brak walidacji - czy kampania ma materiały?**

**Opis:**
- `createPendingMaterialDecision()` nie sprawdza czy kampania ma materiały przed utworzeniem decyzji.

**Rozwiązanie:**
- Dodać walidację: jeśli kampania nie ma materiałów, nie tworzyć `PendingMaterialDecision` (lub pokazać ostrzeżenie).

**Rekomendacja:** Dodać walidację w `createPendingMaterialDecision()`

---

## 7. REKOMENDACJE

### ✅ **Rekomendacja 1: Zmiana logiki wysyłki po zatwierdzeniu**

**Proponowana zmiana:**
- Gdy admin zatwierdza decyzję (`APPROVED`), wyślij email natychmiast (bez opóźnienia), niezależnie od `autoReplyEnabled`.
- `autoReplyEnabled` powinno kontrolować tylko automatyczną wysyłkę (bez akceptacji admina), nie ręczną akceptację.

**Kod:**
```typescript
// W POST /api/material-decisions/[id]
if (decision === 'APPROVED') {
  // Wyślij natychmiast (bez opóźnienia)
  await scheduleMaterialResponse(decision.replyId, {
    isMaterialRequest: true,
    confidence: decision.aiConfidence,
    reasoning: decision.aiReasoning
  });
  
  // Opcjonalnie: wyślij natychmiast (pomiń scheduledAt)
  // Można dodać flagę `sendImmediately: true` do scheduleMaterialResponse
}
```

---

### ✅ **Rekomendacja 2: Walidacja materiałów**

**Proponowana zmiana:**
- W `createPendingMaterialDecision()`, sprawdź czy kampania ma materiały przed utworzeniem decyzji.

**Kod:**
```typescript
// W createPendingMaterialDecision()
const campaign = reply.campaign;
const materials = await db.material.findMany({
  where: {
    campaignId: campaign.id,
    isActive: true
  }
});

if (materials.length === 0) {
  console.warn(`[MATERIAL SENDER] ⚠️ Kampania ${campaign.id} nie ma materiałów - nie tworzę decyzji`);
  throw new Error('Kampania nie ma materiałów do wysłania');
}
```

---

### ✅ **Rekomendacja 3: Monitoring**

**Proponowane:**
- Dodać monitoring dla `MaterialResponse` w statusie `scheduled` dłużej niż X godzin (może wskazywać na problem z `autoReplyEnabled`).

---

## 8. NIEPOTRZEBNE PLIKI I DUPLIKATY

### ⚠️ **CampaignAutoRepliesHistory.tsx**
**Status:** ❌ **NIEUŻYWANY** (stary komponent)

**Znalezione:**
- Komponent `CampaignAutoRepliesHistory.tsx` istnieje w `app/campaigns/[id]/`
- Został zastąpiony przez `CampaignMaterialDecisions.tsx` w podkartach `CampaignAutoRepliesTabs`
- **NIE** jest importowany w `CampaignTabs.tsx` (sprawdzono)

**Rekomendacja:**
- ❌ **USUNĄĆ** `CampaignAutoRepliesHistory.tsx` (stary, nieużywany kod)

---

### ✅ **material-decisions/page.tsx i MaterialDecisionsClient.tsx**
**Status:** ✅ **UŻYWANY** (globalny widok decyzji)

**Znalezione:**
- `/material-decisions` to globalny widok wszystkich decyzji ze wszystkich kampanii
- Używany w `Navbar.tsx` (link do decyzji)
- **NIE** jest duplikatem - to oddzielny widok (globalny vs per-kampania)

**Weryfikacja:**
- ✅ **POPRAWNY** - nie usuwać, to jest globalny widok

---

## 9. PODSUMOWANIE

### ✅ **Co działa poprawnie:**
1. ✅ Tworzenie `PendingMaterialDecision` dla `INTERESTED` z prośbą o materiały
2. ✅ Zatwierdzanie/Odrzucanie decyzji przez admina
3. ✅ Wysyłka zaplanowanych odpowiedzi (z `autoReplyEnabled = true`)
4. ✅ Zapobieganie duplikatom
5. ✅ Formatowanie emaila (cytaty, załączniki, linki)
6. ✅ UI (podkarty, daty, godziny, przyciski)
7. ✅ Integracja z cron (emailCron.ts)
8. ✅ API endpoints (auto-replies, material-decisions)

### ⚠️ **Co wymaga poprawy:**
1. ⚠️ MaterialResponse może zostać w statusie `scheduled` jeśli `autoReplyEnabled = false` (po zatwierdzeniu przez admina)
2. ⚠️ Brak walidacji - czy kampania ma materiały przed utworzeniem decyzji
3. ⚠️ **NIEUŻYWANY PLIK:** `CampaignAutoRepliesHistory.tsx` (stary komponent do usunięcia)

### 📊 **Statystyki:**
- **Pliki sprawdzone:** 20+
- **Problemy znalezione:** 3 (2 niekrytyczne, 1 nieużywany plik)
- **Status ogólny:** ✅ **POPRAWNY** (z drobnymi rekomendacjami)

---

**Data weryfikacji:** 2025-11-05  
**Weryfikował:** Auto (AI Assistant)

