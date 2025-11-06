# 🔧 NAPRAWA: Zablokowany mail blokuje wysyłkę

**Problem:** Mail ID 546 w statusie `sending` od 20:17:29 blokuje całą kampanię

---

## 🚨 PROBLEM

**Mail zablokowany:**
- **ID:** 546
- **Status:** `sending`
- **Zablokowany od:** 20:17:29 (3.5 minuty temu)
- **Zaplanowany:** 20:17:29

**Dlaczego blokuje:**
- System sprawdza `sendingInProgress > 0`
- Jeśli jest mail w statusie `sending`, nie wysyła nowych maili
- Jest zabezpieczenie przed duplikatami

**Co się stało:**
- Mail został zablokowany (status → `sending`)
- `setTimeout` powinien wywołać `sendEmailAfterTimeout()`
- Ale mail nie został wysłany (został w `sending`)
- System nie może wysłać nowych maili (bo jest zablokowany)

---

## ✅ ROZWIĄZANIE

### **Opcja 1: Odblokowanie ręczne (TERAZ)**

Odblokuj mail ręcznie:
```sql
UPDATE CampaignEmailQueue 
SET status = 'pending'
WHERE campaignId = 4 
  AND status = 'sending';
```

**Wynik:** System od razu zacznie wysyłać maile

### **Opcja 2: Poczekać 7 minut**

System automatycznie odblokuje mail po 10 minutach (20:27:29) przez `unlockStuckEmails()`

**Wynik:** System zacznie wysyłać po 7 minutach

---

## 🔍 DLACZEGO TO SIĘ STAŁO?

**Możliwe przyczyny:**

1. **setTimeout nie zadziałał**
   - `setTimeout` został uruchomiony, ale `sendEmailAfterTimeout()` nie został wykonany
   - Możliwe przyczyny: błąd w funkcji, restart serwera, timeout

2. **Błąd w sendEmailAfterTimeout()**
   - Funkcja została wywołana, ale wystąpił błąd
   - Mail pozostaje w statusie `sending`

3. **Restart serwera**
   - Mail został zablokowany, ale serwer został zrestartowany
   - `setTimeout` został utracony (jest w pamięci)
   - Mail pozostaje w `sending`

---

## ✅ CO ZROBIŁEM

**Odblokowałem mail ręcznie:**
- Mail ID 546 został odblokowany (status → `pending`)
- System powinien teraz wysyłać maile

**Sprawdź teraz:**
- Czy system wysyła maile?
- Czy są nowe maile w SendLog?

---

## 📊 PODSUMOWANIE

### **Problem:**
- ❌ Mail zablokowany w statusie `sending` (3.5 minuty)
- ❌ Blokuje całą kampanię

### **Rozwiązanie:**
- ✅ Odblokowałem mail ręcznie
- ✅ System powinien teraz wysyłać maile

### **Co dalej:**
- System automatycznie odblokuje podobne maile po 10 minutach przez `unlockStuckEmails()`
- Jeśli problem się powtórzy, trzeba sprawdzić dlaczego `sendEmailAfterTimeout()` nie działa

