# 🔍 DEBUG: Dlaczego MaterialResponse nie są widoczne w UI?

## ✅ CO SPRAWDZONO

### **1. Dane w bazie:**
- ✅ MaterialResponse istnieją w bazie (ID: 1, 2)
- ✅ Status: 'sent'
- ✅ sentAt: ustawione (2025-11-03 11:55:03, 2025-11-03 13:00:02)
- ✅ replyId: istnieje (197, 199)
- ✅ leadId: istnieje (261, 279)

### **2. Prisma query:**
- ✅ Prisma znajduje 2 rekordy
- ✅ Include działa poprawnie (lead, reply, material)
- ✅ Filtrowanie po status='sent' i sentAt IS NOT NULL działa

### **3. API endpoint:**
- ✅ Endpoint `/api/campaigns/3/auto-replies?type=material&status=sent&limit=50` powinien zwracać dane
- ✅ Dodano logowanie do debugowania

### **4. UI Component:**
- ✅ Component `CampaignMaterialDecisions.tsx` pobiera dane z API
- ✅ Dodano logowanie błędów

---

## 🔧 DODANE POPRAWKI

### **1. Logowanie w API:**
```typescript
console.log(`[AUTO-REPLIES API] Campaign ${campaignId}: Found ${materialResponses.length} MaterialResponse`);
console.log(`[AUTO-REPLIES API] Po filtrowaniu: ${uniqueMaterialResponses.length} unikalnych MaterialResponse`);
console.log(`[AUTO-REPLIES API] type=material: ${combinedData.length} items, totalCount=${totalCount}`);
console.log(`[AUTO-REPLIES API] Returning: success=true, data.length=${combinedData.length}, total=${totalCount}`);
```

### **2. Logowanie w UI:**
```typescript
console.log(`[CAMPAIGN MATERIAL DECISIONS] Załadowano ${materialResponses.length} wysłanych odpowiedzi`);
console.error("[CAMPAIGN MATERIAL DECISIONS] API zwróciło błąd:", historyData.error);
```

### **3. Zabezpieczenie przed null replyId:**
- Dodano sprawdzenie `if (mr.replyId)` przed filtrowaniem

---

## 🔍 JAK SPRAWDZIĆ

### **1. Sprawdź logi serwera:**
- Otwórz konsolę serwera (gdzie działa Next.js)
- Odśwież stronę `/campaigns/3#automatyczne`
- Zobacz logi:
  - `[AUTO-REPLIES API] Campaign 3: Found X MaterialResponse`
  - `[AUTO-REPLIES API] Returning: success=true, data.length=X`

### **2. Sprawdź konsolę przeglądarki:**
- Otwórz DevTools (F12)
- Sprawdź Console
- Zobacz logi:
  - `[CAMPAIGN MATERIAL DECISIONS] Załadowano X wysłanych odpowiedzi`
  - LUB `[CAMPAIGN MATERIAL DECISIONS] API zwróciło błąd: ...`

### **3. Sprawdź Network tab:**
- Otwórz DevTools → Network
- Odśwież stronę
- Znajdź request: `/api/campaigns/3/auto-replies?type=material&status=sent&limit=50`
- Sprawdź Response:
  - `success: true`
  - `data: [...]` (powinno być 2 elementy)
  - `total: 2`

---

## 🚨 MOŻLIWE PROBLEMY

### **Problem 1: Cache przeglądarki**
**Rozwiązanie:** 
- Odśwież stronę z Ctrl+Shift+R (hard refresh)
- LUB wyczyść cache przeglądarki

### **Problem 2: Serwer nie działa**
**Rozwiązanie:**
- Sprawdź czy serwer Next.js działa
- Sprawdź logi serwera

### **Problem 3: Błąd w API**
**Rozwiązanie:**
- Sprawdź logi serwera (błędy)
- Sprawdź konsolę przeglądarki (błędy)

### **Problem 4: Błąd w filtrowaniu**
**Rozwiązanie:**
- Sprawdź czy `replyId` nie jest null
- Sprawdź czy filtrowanie nie usuwa rekordów

---

## ✅ NASTĘPNE KROKI

1. **Odśwież stronę** (Ctrl+Shift+R)
2. **Sprawdź logi serwera** - czy API zwraca dane?
3. **Sprawdź konsolę przeglądarki** - czy są błędy?
4. **Sprawdź Network tab** - jaki jest response z API?

Po wykonaniu tych kroków będziemy wiedzieć gdzie jest problem!

