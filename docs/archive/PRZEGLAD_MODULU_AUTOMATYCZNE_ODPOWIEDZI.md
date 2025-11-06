# 📋 PRZEGLĄD MODUŁU: Automatyczne odpowiedzi

## 🎯 CEL MODUŁU

Moduł automatycznych odpowiedzi z materiałami:
- Analizuje odpowiedzi INTERESTED od leadów
- Wykrywa prośby o materiały (katalog, cennik, etc.)
- Generuje i wysyła odpowiedzi z materiałami
- Wymaga akceptacji administratora (zawsze)

---

## 📁 STRUKTURA MODUŁU

### **1. KOMPONENTY UI:**

#### **`AutoReplySettings.tsx`**
- **Funkcja:** Ustawienia automatycznych odpowiedzi dla kampanii
- **Funkcjonalności:**
  - ✅ Włącz/Wyłącz automatyczne odpowiedzi (`autoReplyEnabled`)
  - ✅ Opóźnienie wysyłki (`autoReplyDelayMinutes`)
  - ✅ Kontekst kampanii (`autoReplyContext`)
  - ✅ Zasady odpowiedzi (`autoReplyRules`)
  - ✅ Statyczna treść odpowiedzi (`autoReplyContent`)
  - ✅ Włącz/Wyłącz opiekuna (Guardian)
  - ✅ Szablon opiekuna (`autoReplyGuardianTemplate`)
  - ✅ Tytuł opiekuna (`autoReplyGuardianTitle`)
  - ✅ Tekst wprowadzający opiekuna (`autoReplyGuardianIntroText`)
  - ✅ Podgląd odpowiedzi
  - ✅ Zarządzanie materiałami (MaterialsManager)

#### **`CampaignMaterialDecisions.tsx`**
- **Funkcja:** Oczekujące decyzje administratora + historia wysłanych
- **Funkcjonalności:**
  - ✅ Lista oczekujących decyzji (PendingMaterialDecision)
  - ✅ Historia wysłanych odpowiedzi (MaterialResponse)
  - ✅ Podgląd odpowiedzi przed wysłaniem
  - ✅ Zatwierdź/Odrzuć decyzje
  - ✅ Odświeżanie podglądu (z aktualnymi ustawieniami)
  - ✅ Wysyłka testowa

#### **`CampaignAutoRepliesHistory.tsx`**
- **Funkcja:** Pełna historia automatycznych odpowiedzi
- **Funkcjonalności:**
  - ✅ Filtrowanie po typie (material/decision)
  - ✅ Filtrowanie po statusie
  - ✅ Paginacja
  - ✅ Podgląd odpowiedzi
  - ✅ Zatwierdzenie/Odrzucenie decyzji

#### **`MaterialsManager.tsx`**
- **Funkcja:** Zarządzanie materiałami kampanii
- **Funkcjonalności:**
  - ✅ Dodawanie materiałów (LINK/ATTACHMENT)
  - ✅ Edycja materiałów
  - ✅ Usuwanie materiałów
  - ✅ Kolejność materiałów (order)

---

### **2. SERWISY:**

#### **`materialResponseAI.ts`**
- **Funkcja:** Analiza i generowanie odpowiedzi
- **Funkcjonalności:**
  - ✅ `analyzeMaterialRequest()` - analizuje czy lead prosi o materiały
  - ✅ `generateMaterialResponse()` - generuje treść odpowiedzi
  - ✅ Personalizacja statycznej treści (`autoReplyContent`)
  - ✅ Wykrywanie prośby o materiały (AI)
  - ✅ Confidence scoring (0.0-1.0)
  - ✅ Sugerowana akcja (SEND/DONT_SEND/ASK_ADMIN)

#### **`materialResponseSender.ts`**
- **Funkcja:** Wysyłka materiałów
- **Funkcjonalności:**
  - ✅ `scheduleMaterialResponse()` - planuje wysyłkę (z opóźnieniem)
  - ✅ `sendScheduledMaterialResponses()` - wysyła zaplanowane
  - ✅ `createPendingMaterialDecision()` - tworzy kolejkę decyzji
  - ✅ Zapobieganie duplikatom
  - ✅ Obsługa błędów (failed status)
  - ✅ Załączniki (ATTACHMENT)
  - ✅ Linki (LINK)
  - ✅ Stopka handlowca
  - ✅ Opiekun (Guardian)

#### **`emailAgentAI.ts`** (integracja)
- **Funkcja:** Klasyfikacja odpowiedzi
- **Integracja:**
  - ✅ Gdy `classification = 'INTERESTED'` i `autoReplyEnabled = true`
  - ✅ Sprawdza czy to prośba o materiały (`checkMaterialRequest`)
  - ✅ Jeśli `confidence >= 0.6` → `ASK_ADMIN_MATERIALS`
  - ✅ Jeśli `confidence < 0.6` → normalny flow (FORWARD)

---

### **3. API ENDPOINTS:**

#### **`/api/campaigns/[id]/auto-replies`**
- **GET:** Pobiera historię automatycznych odpowiedzi
- **Query params:**
  - `limit`, `offset` - paginacja
  - `type` - "material" | "decision"
  - `status` - filtrowanie po statusie
- **Zwraca:** MaterialResponse + PendingMaterialDecision

#### **`/api/material-decisions/[id]`**
- **GET:** Pobiera szczegóły decyzji
- **POST:** Zatwierdza/Odrzuca decyzję
- **Body:** `{ status: "APPROVED" | "REJECTED", decisionNote, decidedBy }`

#### **`/api/material-decisions/[id]/preview`**
- **GET:** Podgląd odpowiedzi przed wysłaniem

#### **`/api/material-decisions/[id]/refresh`**
- **POST:** Odświeża podgląd z aktualnymi ustawieniami

#### **`/api/campaigns/[id]/auto-reply-preview`**
- **GET:** Podgląd ustawień automatycznych odpowiedzi

#### **`/api/campaigns/[id]/materials`**
- **GET:** Lista materiałów kampanii
- **POST:** Dodaj materiał
- **PATCH:** Edytuj materiał
- **DELETE:** Usuń materiał

---

## 🔄 FLOW AUTOMATYCZNYCH ODPOWIEDZI

### **1. Lead odpowiada INTERESTED:**

```
Lead → Odpowiedź: "Proszę o katalog i cennik"
     ↓
InboxReply (classification: INTERESTED)
     ↓
EmailAgentAI.processEmailReply()
     ↓
checkMaterialRequest() [jeśli autoReplyEnabled = true]
     ↓
analyzeMaterialRequest() → confidence: 0.85
     ↓
suggestedAction: "ASK_ADMIN"
     ↓
createPendingMaterialDecision() → PendingMaterialDecision (status: PENDING)
     ↓
UI: CampaignMaterialDecisions pokazuje oczekującą decyzję
```

### **2. Administrator zatwierdza:**

```
Admin → Zatwierdź decyzję
     ↓
POST /api/material-decisions/[id] (status: APPROVED)
     ↓
scheduleMaterialResponse() → MaterialResponse (status: scheduled)
     ↓
scheduledAt = now + autoReplyDelayMinutes
     ↓
Cron: sendScheduledMaterialResponses() (co 1 minutę)
     ↓
sendScheduledMaterialResponses() → MaterialResponse (status: sending)
     ↓
generateMaterialResponse() → treść odpowiedzi
     ↓
sendEmail() → wysyłka maila
     ↓
MaterialResponse (status: sent, sentAt: now)
     ↓
SendLog (status: sent)
```

---

## 📊 TABELE W BAZIE DANYCH

### **`MaterialResponse`**
- **Przeznaczenie:** Wysłane odpowiedzi z materiałami
- **Statusy:** `pending`, `scheduled`, `sending`, `sent`, `failed`
- **Pola:**
  - `replyId` - powiązanie z InboxReply
  - `leadId`, `campaignId`
  - `subject`, `responseText` - treść odpowiedzi
  - `scheduledAt`, `sentAt`
  - `error` - błąd wysyłki

### **`PendingMaterialDecision`**
- **Przeznaczenie:** Oczekujące decyzje administratora
- **Statusy:** `PENDING`, `APPROVED`, `REJECTED`
- **Pola:**
  - `replyId` - powiązanie z InboxReply
  - `leadId`, `campaignId`
  - `aiConfidence`, `aiReasoning`
  - `suggestedAction`
  - `decidedAt`, `decidedBy`, `decisionNote`

### **`Material`**
- **Przeznaczenie:** Materiały kampanii
- **Typy:** `LINK`, `ATTACHMENT`
- **Pola:**
  - `campaignId`
  - `name`, `type`
  - `url` (dla LINK)
  - `fileName` (dla ATTACHMENT)
  - `order` - kolejność wyświetlania
  - `isActive`

---

## ✅ CO ZOSTAŁO NAPRAWIONE

1. ✅ **Funkcja `updateLeadStatus`** - aktualizuje `CampaignLead.status` → `INTERESTED`
2. ✅ **Istniejące 9 leadów** - zaktualizowane ręcznie

---

## 🔍 CO SPRAWDZIĆ W MODULE

### **Potencjalne problemy:**

1. **Czy cron wysyła zaplanowane odpowiedzi?**
   - `sendScheduledMaterialResponses()` w `emailCron.ts`
   - Sprawdź czy działa co 1 minutę

2. **Czy zapobieganie duplikatom działa?**
   - `scheduleMaterialResponse()` sprawdza istniejące MaterialResponse
   - Może być problem z race condition

3. **Czy Guardian jest poprawnie dodawany?**
   - Sprawdź logikę w `materialResponseSender.ts`
   - `autoReplyGuardianTemplate`, `autoReplyGuardianIntroText`

4. **Czy załączniki są poprawnie wysyłane?**
   - Sprawdź logikę w `sendScheduledMaterialResponses()`
   - ATTACHMENT wymaga `fileName` i ścieżki do pliku

5. **Czy statyczna treść jest personalizowana?**
   - `personalizeStaticContent()` w `materialResponseAI.ts`
   - Sprawdź czy podstawia `{firstName}`, `{materials}`, etc.

---

## 📝 NASTĘPNE KROKI

1. Sprawdzić czy cron działa poprawnie
2. Przetestować wysyłkę testową
3. Sprawdzić logikę zapobiegania duplikatom
4. Sprawdzić obsługę załączników
5. Sprawdzić personalizację statycznej treści

