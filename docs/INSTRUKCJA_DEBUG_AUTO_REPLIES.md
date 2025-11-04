# 🔍 INSTRUKCJA: Debugowanie brakujących MaterialResponse w UI

## ✅ CO ZOSTAŁO ZROBIONE

### **1. Utworzono MaterialResponse dla maili z 3.11:**
- ✅ MaterialResponse ID: 1 (piotr.lach@adrepublic.pl)
- ✅ MaterialResponse ID: 2 (marcin@artexpo.com.pl)
- ✅ Status: 'sent'
- ✅ sentAt: ustawione

### **2. Dodano logowanie:**
- ✅ W API endpoint (`/api/campaigns/[id]/auto-replies/route.ts`)
- ✅ W UI component (`CampaignMaterialDecisions.tsx`)

### **3. Poprawiono paginację:**
- ✅ Dodano paginację dla `type=material`

---

## 🔍 JAK SPRAWDZIĆ DLACZEGO NIE SĄ WIDOCZNE

### **Krok 1: Sprawdź logi serwera**

**Otwórz terminal gdzie działa serwer Next.js i zobacz logi:**
```
[AUTO-REPLIES API] Campaign 3: Found 2 MaterialResponse (total: 2), type=material, status=sent
[AUTO-REPLIES API] Po filtrowaniu: 2 unikalnych MaterialResponse
[AUTO-REPLIES API] type=material: 2 items, totalCount=2
[AUTO-REPLIES API] Returning: success=true, data.length=2, total=2
```

**Jeśli widzisz te logi:** ✅ API działa poprawnie, problem jest w UI lub cache

**Jeśli widzisz błąd:** ❌ Sprawdź szczegóły błędu

---

### **Krok 2: Sprawdź konsolę przeglądarki**

**Otwórz DevTools (F12) → Console:**

**Powinieneś zobaczyć:**
```
[CAMPAIGN MATERIAL DECISIONS] Załadowano 2 wysłanych odpowiedzi
```

**Jeśli widzisz błąd:**
```
[CAMPAIGN MATERIAL DECISIONS] API zwróciło błąd: ...
```

**LUB:**
```
Błąd pobierania danych: ...
```

---

### **Krok 3: Sprawdź Network tab**

**Otwórz DevTools (F12) → Network:**

1. **Odśwież stronę** (Ctrl+Shift+R)
2. **Znajdź request:** `/api/campaigns/3/auto-replies?type=material&status=sent&limit=50`
3. **Kliknij na request**
4. **Sprawdź Response:**

**Powinno być:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "material",
      "lead": { "email": "piotr.lach@adrepublic.pl", ... },
      "status": "sent",
      "subject": "Re: Podwieszenia targowe...",
      ...
    },
    {
      "id": 2,
      "type": "material",
      "lead": { "email": "marcin@artexpo.com.pl", ... },
      "status": "sent",
      ...
    }
  ],
  "total": 2
}
```

**Jeśli `success: false`:** ❌ Sprawdź `error` w response

**Jeśli `data: []`:** ❌ Problem z filtrowaniem lub zapytaniem

---

### **Krok 4: Sprawdź cache przeglądarki**

**Wyczyść cache:**
1. **Ctrl+Shift+R** (hard refresh)
2. **LUB** DevTools → Application → Clear Storage → Clear site data
3. **LUB** DevTools → Network → zaznacz "Disable cache"

---

### **Krok 5: Sprawdź czy serwer działa**

**Jeśli serwer nie działa, uruchom go:**
```bash
npm run dev
```

---

## 🚨 MOŻLIWE PROBLEMY I ROZWIĄZANIA

### **Problem 1: Cache przeglądarki**
**Objawy:** Stara wersja strony, brak nowych danych
**Rozwiązanie:** Ctrl+Shift+R (hard refresh)

### **Problem 2: Serwer nie zrestartowany**
**Objawy:** Zmiany w kodzie nie działają
**Rozwiązanie:** Zrestartuj serwer Next.js

### **Problem 3: Błąd w API**
**Objawy:** W Network tab widzisz `success: false`
**Rozwiązanie:** Sprawdź logi serwera, sprawdź szczegóły błędu

### **Problem 4: Błąd w filtrowaniu**
**Objawy:** API zwraca `data: []` mimo że rekordy są w bazie
**Rozwiązanie:** Sprawdź logi API - czy filtrowanie działa?

---

## 📋 CHECKLIST

Przed zgłoszeniem problemu sprawdź:

- [ ] Czy serwer Next.js działa?
- [ ] Czy odświeżyłeś stronę (Ctrl+Shift+R)?
- [ ] Czy sprawdziłeś logi serwera?
- [ ] Czy sprawdziłeś konsolę przeglądarki?
- [ ] Czy sprawdziłeś Network tab?
- [ ] Czy API zwraca `success: true`?
- [ ] Czy API zwraca `data` z 2 elementami?

---

## ✅ JEŚLI WSZYSTKO GRA

**Jeśli wszystkie powyższe punkty są OK, ale nadal nie widzisz danych:**

1. **Sprawdź czy nie ma błędów JavaScript w konsoli**
2. **Sprawdź czy component renderuje się poprawnie**
3. **Sprawdź czy `sentMaterialResponses.length` jest > 0**

---

**Po wykonaniu tych kroków będziemy wiedzieć gdzie dokładnie jest problem!**

