# DODANIE BCC DLA ADMINISTRATORA W AUTOMATYCZNYCH ODPOWIEDZIACH

## ✅ ZMIANY

### 1. **Opiekun w CC (już było)**
- **Warunek:** `autoReplyIncludeGuardian === true` (zaznaczone w ustawieniach kampanii)
- **Logika:** 
  ```typescript
  if (response.campaign.autoReplyIncludeGuardian && response.campaign.virtualSalesperson) {
    // Dodaj dane handlowca do treści maila
    guardianEmailForCc = realEmail; // realSalespersonEmail
  }
  
  // Później w mailOptions:
  if (guardianEmailForCc) {
    mailOptions.cc = guardianEmailForCc;
  }
  ```
- **Wynik:** Opiekun jest dodawany do CC **TYLKO** jeśli checkbox jest zaznaczony ✅

### 2. **Administrator w BCC (NOWE)**
- **Warunek:** Zawsze (jeśli `forwardEmail` istnieje w ustawieniach)
- **Logika:**
  ```typescript
  // ✅ Dodaj administratora do BCC (zawsze - ukryta kopia)
  if (companySettings?.forwardEmail) {
    mailOptions.bcc = companySettings.forwardEmail;
    console.log(`[MATERIAL SENDER] Dodano administratora ${companySettings.forwardEmail} do BCC`);
  }
  ```
- **Wynik:** Administrator (z `forwardEmail` w ustawieniach firmy) jest **ZAWSZE** dodawany do BCC ✅

---

## 📋 JAK DZIAŁA TERAZ

### Scenariusz 1: Opiekun włączony (`autoReplyIncludeGuardian = true`)
```
To: lead@example.com
CC: realSalespersonEmail@example.com (opiekun)
BCC: bartosz.kosiba@kreativia.pl (administrator)
```

### Scenariusz 2: Opiekun wyłączony (`autoReplyIncludeGuardian = false`)
```
To: lead@example.com
BCC: bartosz.kosiba@kreativia.pl (administrator)
```

---

## ✅ WERYFIKACJA

- ✅ Opiekun w CC tylko jeśli zaznaczony (`autoReplyIncludeGuardian`)
- ✅ Administrator w BCC zawsze (jeśli `forwardEmail` istnieje)
- ✅ BCC jest ukryte (lead nie widzi administratora)
- ✅ Kod bez błędów kompilacji

---

## 📝 PLIKI ZMODYFIKOWANE

- `src/services/materialResponseSender.ts` (linia 707-711)

