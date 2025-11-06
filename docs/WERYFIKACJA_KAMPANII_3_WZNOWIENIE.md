# ✅ WERYFIKACJA KAMPANII 3 - WZNOWIENIE

**Data:** 2025-11-05, 21:30  
**Cel:** Sprawdzenie kampanii 3 przed wznowieniem

---

## 📊 WERYFIKACJA DANYCH

### **1. Podstawowe informacje:**
- Status kampanii
- delayBetweenEmails
- maxEmailsPerDay
- Okno czasowe
- allowedDays

### **2. Wysłane maile:**
- Ile maili zostało wysłanych
- Kiedy był pierwszy i ostatni mail
- Status pauzy (czy następny mail powinien mieć pauzę)

### **3. Leady:**
- Ile leadów jest w kampanii
- Ile leadów jest queued (gotowe do wysłania)
- Ile leadów jest dostępnych (nie w kolejce, nie wysłanych)

### **4. Kolejka:**
- Ile maili jest w kolejce
- Statusy maili (pending, sending, sent)
- Czy są gotowe maile do wysłania

### **5. Skrzynki:**
- Ile skrzynek jest dostępnych
- Ile skrzynek jest wyczerpanych

### **6. V2:**
- Czy kampania używa V2
- Czy kolejka V2 jest zainicjalizowana

---

## 🔍 CO SPRAWDZIĆ

1. **Czy kampania może być wznowiona?**
   - Status (PAUSED, SCHEDULED, IN_PROGRESS?)
   - Czy ma leady do wysłania?
   - Czy ma dostępne skrzynki?

2. **Czy logika wznowienia działa?**
   - Czy `scheduleNextEmailV2()` będzie działać?
   - Czy pauza co 10 maili będzie działać?
   - Czy randomizacja będzie działać?

3. **Czy są problemy?**
   - Stuck emaile?
   - Brak dostępnych leadów?
   - Brak dostępnych skrzynek?

