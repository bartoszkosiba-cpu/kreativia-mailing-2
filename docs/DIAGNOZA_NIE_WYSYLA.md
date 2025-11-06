# 🔍 DIAGNOZA: Dlaczego kampania nie wysyła?

**Data:** 2025-11-05 20:20

---

## ✅ STATUS KAMPANII

- **Status:** `IN_PROGRESS` ✅
- **Okno czasowe:** 19:00-23:55 ✅
- **Aktualny czas:** 20:20 ✅ (w oknie czasowym)

---

## 📊 STAN KOLEJKI

### **Maile w kolejce:**
- **Pending:** 19 maili ✅
- **Sending:** 1 mail ⚠️ **ZABLOKOWANY**
- **Sent:** 28 maili ✅
- **Cancelled:** 72 maile ❌

### **Gotowe do wysłania:**
- **3 maile READY** (scheduledAt <= now) ✅
- **Pierwszy gotowy:** 20:18:08 (2 minuty temu)
- **Ostatni gotowy:** 20:19:25 (1 minuta temu)

---

## 🚨 PROBLEM

### **1 mail zablokowany w statusie `sending`**

**Szczegóły:**
- **ID:** 546 (prawdopodobnie)
- **Status:** `sending`
- **Zablokowany od:** 20:17:29 (3 minuty temu)
- **Zaplanowany:** 20:17:29

**Dlaczego blokuje:**
```typescript
const sendingInProgress = await tx.campaignEmailQueue.count({
  where: {
    campaignId,
    status: 'sending'
  }
});

if (sendingInProgress > 0) {
  return null; // ❌ Blokuje wysyłkę
}
```

**System sprawdza:** Czy są maile w statusie `sending`?
- Jeśli TAK → nie wysyła nowych maili
- Jeśli NIE → wysyła

---

## ✅ CO DZIAŁA

- ✅ Kampania jest `IN_PROGRESS`
- ✅ Jest w oknie czasowym (20:20, okno 19:00-23:55)
- ✅ Są dostępne skrzynki (5 skrzynek, sloty dostępne)
- ✅ Są maile gotowe do wysłania (3 maile READY)
- ✅ Ostatni wysłany mail: 19:37:15 (43 minuty temu)

---

## 🔧 ROZWIĄZANIE

### **Problem: Zablokowany mail**

System powinien automatycznie odblokować maile starsze niż 10 minut przez funkcję `unlockStuckEmails()`.

**Sprawdź:**
- Czy mail jest starszy niż 10 minut? (3 minuty - jeszcze nie)
- Czy `unlockStuckEmails()` działa? (powinno działać w cron)

### **Możliwe przyczyny:**

1. **Mail jest zbyt młody** (3 minuty < 10 minut)
   - System odblokuje go automatycznie po 10 minutach

2. **Błąd w procesie wysyłki**
   - Mail został zablokowany, ale `sendEmailAfterTimeout()` nie został wykonany
   - Mail pozostaje w statusie `sending`

3. **Cron nie działa**
   - `unlockStuckEmails()` nie jest wywoływane

---

## ✅ CO NAPRAWIĆ

### **Opcja 1: Poczekać 7 minut**
- System automatycznie odblokuje mail po 10 minutach (20:27:29)
- Wtedy wysyłka powinna wznowić

### **Opcja 2: Ręczne odblokowanie**
```sql
UPDATE CampaignEmailQueue 
SET status = 'pending'
WHERE campaignId = 4 
  AND status = 'sending';
```

### **Opcja 3: Sprawdzić logi**
- Czy `unlockStuckEmails()` jest wywoływane?
- Czy są błędy w logach?

---

## 📊 PODSUMOWANIE

### **Co działa:**
- ✅ Kampania jest `IN_PROGRESS`
- ✅ Jest w oknie czasowym
- ✅ Są dostępne skrzynki
- ✅ Są maile gotowe do wysłania

### **Co nie działa:**
- ❌ **1 mail zablokowany w statusie `sending`** (blokuje całą kampanię)
- ❌ System nie wysyła nowych maili (zabezpieczenie przed duplikatami)

### **Co naprawić:**
1. Odblokować zablokowany mail (ręcznie lub poczekać 7 min)
2. Sprawdzić dlaczego mail został zablokowany i nie został wysłany

