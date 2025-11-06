# 🔍 PEŁNE SPRAWDZENIE DUPLIKATÓW

**Data:** 2025-11-06, 09:00  
**Cel:** Sprawdzenie czy są inne przypadki duplikatów w systemie

---

## 📊 WYNIKI SPRAWDZENIA

### **1. Leady z wielokrotnymi mailami w krótkim czasie (ostatnie 7 dni):**
- Sprawdzenie: Czy są leady, które otrzymały więcej niż 1 mail w ciągu 5 minut?

### **2. MaterialResponse z różnymi statusami dla tego samego leada:**
- Sprawdzenie: Czy są MaterialResponse z różnymi statusami dla tego samego leada (możliwe duplikaty)?

### **3. MaterialResponse ze statusem 'sending' (stuck):**
- Sprawdzenie: Czy są MaterialResponse ze statusem 'sending' (mogą być problemy)?

### **4. MaterialResponse 'sent' bez SendLog:**
- Sprawdzenie: Czy są MaterialResponse 'sent' bez SendLog (możliwe że mail został wysłany ale SendLog nie został zapisany)?

### **5. SendLog z tym samym Message-ID (duplikaty w bazie):**
- Sprawdzenie: Czy są SendLog z tym samym Message-ID (duplikaty w bazie)?

### **6. Szczegółowo wszystkie maile dla leada bartosz@gmsynergy.com.pl:**
- Sprawdzenie: Wszystkie maile dla tego leada (ostatnie 7 dni)

### **7. Inne leady z automatycznymi odpowiedziami w tym samym czasie:**
- Sprawdzenie: Czy są inne leady, które otrzymały automatyczne odpowiedzi w tym samym czasie co bartosz (07:45-07:47)?

### **8. MaterialResponse utworzone w oknie czasowym 08:43-08:47:**
- Sprawdzenie: Wszystkie MaterialResponse utworzone w oknie czasowym kiedy były wysyłane

---

## 🎯 WNIOSEK

Wyniki sprawdzenia zostaną wyświetlone poniżej.

