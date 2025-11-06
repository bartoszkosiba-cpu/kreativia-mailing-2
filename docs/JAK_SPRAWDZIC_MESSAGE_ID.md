# 📧 JAK SPRAWDZIĆ MESSAGE-ID

**Cel:** Sprawdzenie czy lead otrzymał duplikaty (te same maile wielokrotnie)

---

## 🔍 METODA 1: W BAZIE DANYCH (SendLog)

### **Sprawdź Message-ID dla konkretnych leadów:**

```sql
SELECT 
  sl.id,
  l.email as lead_email,
  datetime(sl.createdAt/1000, 'unixepoch', 'localtime') as sent_time,
  sl.subject,
  sl.messageId,
  sl.status
FROM SendLog sl
JOIN Lead l ON l.id = sl.leadId
WHERE l.email IN ('jakub.drag@berrylife.pl', 'bartosz@gmsynergy.com.pl')
  AND sl.createdAt > (strftime('%s', 'now') * 1000 - 86400000) -- Ostatnie 24h
ORDER BY sl.createdAt DESC;
```

### **Sprawdź czy są duplikaty Message-ID:**

```sql
SELECT 
  messageId,
  COUNT(*) as count,
  GROUP_CONCAT(id, ', ') as sendlog_ids,
  GROUP_CONCAT(datetime(createdAt/1000, 'unixepoch', 'localtime'), ' | ') as sent_times
FROM SendLog
WHERE messageId IN (
  SELECT messageId 
  FROM SendLog 
  WHERE createdAt > (strftime('%s', 'now') * 1000 - 86400000)
  GROUP BY messageId 
  HAVING COUNT(*) > 1
)
GROUP BY messageId
ORDER BY count DESC;
```

**Interpretacja:**
- ✅ Jeśli `count = 1` → brak duplikatów w bazie
- ⚠️ Jeśli `count > 1` → są duplikaty w bazie (problem w systemie)

---

## 📧 METODA 2: W EMAILU (Klient Email)

### **A. Gmail (Web/Desktop):**

1. Otwórz email
2. Kliknij **"⋮"** (trzy kropki) → **"Pokaż oryginał"** (Show original)
3. W oryginalnym mailu znajdź linię:
   ```
   Message-ID: <2ba5bc88-6a0c-03d4-3b05-23ab1edfd275@kreativia.eu>
   ```

### **B. Apple Mail (macOS/iOS):**

1. Otwórz email
2. **View** → **Message** → **Raw Source** (lub **Cmd+Option+U**)
3. W oryginalnym mailu znajdź linię:
   ```
   Message-ID: <2ba5bc88-6a0c-03d4-3b05-23ab1edfd275@kreativia.eu>
   ```

### **C. Outlook (Web/Desktop):**

1. Otwórz email
2. Kliknij **"..."** → **"Wyświetl źródło wiadomości"** (View message source)
3. W oryginalnym mailu znajdź linię:
   ```
   Message-ID: <2ba5bc88-6a0c-03d4-3b05-23ab1edfd275@kreativia.eu>
   ```

### **D. Thunderbird:**

1. Otwórz email
2. **View** → **Message Source** (lub **Ctrl+U**)
3. W oryginalnym mailu znajdź linię:
   ```
   Message-ID: <2ba5bc88-6a0c-03d4-3b05-23ab1edfd275@kreativia.eu>
   ```

---

## 🔍 METODA 3: PORÓWNANIE MESSAGE-ID

### **Krok 1: Sprawdź Message-ID w bazie**

Uruchom zapytanie SQL (patrz METODA 1) i zapisz Message-ID dla każdego leada.

### **Krok 2: Sprawdź Message-ID w emailu**

Otwórz email w kliencie email (patrz METODA 2) i zapisz Message-ID.

### **Krok 3: Porównaj**

**Scenariusz A: Te same Message-ID**
- ✅ Email 1: `<2ba5bc88-6a0c-03d4-3b05-23ab1edfd275@kreativia.eu>`
- ✅ Email 2: `<2ba5bc88-6a0c-03d4-3b05-23ab1edfd275@kreativia.eu>`
- **Wniosek:** To są **duplikaty** (ten sam mail wysłany wielokrotnie)
- **Przyczyna:** Problem po stronie SMTP/klienta email (retry, cache, synchronizacja)

**Scenariusz B: Różne Message-ID**
- ✅ Email 1: `<2ba5bc88-6a0c-03d4-3b05-23ab1edfd275@kreativia.eu>`
- ✅ Email 2: `<e3e9f226-4c17-2518-be72-83995d8bf637@kreativia.eu>`
- **Wniosek:** To są **różne maile** (system wysłał 2 różne maile)
- **Przyczyna:** Problem w systemie (duplikaty w bazie, błąd w logice)

---

## 📊 PRZYKŁAD: Sprawdzenie dla konkretnych leadów

### **Lead 1: jakub.drag@berrylife.pl**

**W bazie:**
```
Message-ID: <2ba5bc88-6a0c-03d4-3b05-23ab1edfd275@kreativia.eu>
Sent: 2025-11-06 08:46:09
```

**W emailu:**
- Sprawdź Message-ID w emailu (patrz METODA 2)
- Porównaj z bazą

**Jeśli są identyczne:**
- ✅ System wysłał tylko 1 mail
- ⚠️ Jeśli lead otrzymał 2x, to problem po stronie SMTP/klienta

**Jeśli są różne:**
- ⚠️ System wysłał 2 różne maile (problem w systemie)

---

## 🎯 WNIOSEK

**Message-ID jest unikalnym identyfikatorem każdego maila.**

- ✅ **Te same Message-ID** = ten sam mail (duplikaty po stronie SMTP/klienta)
- ⚠️ **Różne Message-ID** = różne maile (problem w systemie)

**Sprawdź Message-ID w bazie i w emailu, aby ustalić przyczynę duplikatów.**

