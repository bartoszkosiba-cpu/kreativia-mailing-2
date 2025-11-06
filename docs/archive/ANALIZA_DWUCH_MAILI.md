# ANALIZA: DLACZEGO DOSTAŁEŚ 2 MAILE?

## 📊 WERYFIKACJA Z BAZY DANYCH

**Do leada (joanna@edelweiss.com.pl) z kampanii 3:**
- ✅ **1 mail** w SendLog dzisiaj
- ✅ **1 MaterialResponse** w statusie 'sent'
- ✅ **1 messageId:** `<e36a5741-4b14-619e-33a8-1186844806eb@kreativia.eu>`

**Wniosek:** System wysłał **TYLKO 1 mail do leada**.

---

## 🤔 DLACZEGO DOSTAŁEŚ 2 MAILE?

### Możliwe przyczyny:

1. **BCC do administratora** ✅ (POTWIERDZONE)
   - Mail został wysłany do leada (joanna@edelweiss.com.pl) w `TO`
   - **Ty jesteś w BCC** (bartosz.kosiba@kreativia.pl) - to jest ukryta kopia
   - **Wynik:** Otrzymujesz 1 mail jako BCC

2. **Możliwe duplikaty** ❓ (DO WERYFIKACJI)
   - Może mail został wysłany dwukrotnie przez system?
   - Może serwer SMTP wysłał duplikat?
   - Może klient pocztowy pokazuje duplikat?

---

## 📋 CO SPRAWDZIĆ

### 1. Sprawdź w skrzynce pocztowej
- Czy oba maile mają **ten sam Message-ID**?
  - Jeśli TAK → to duplikat (problem z klientem pocztowym lub serwerem SMTP)
  - Jeśli NIE → to dwa różne maile

### 2. Sprawdź nagłówki maili
- `Message-ID:` powinien być identyczny
- `To:` powinien być joanna@edelweiss.com.pl
- `BCC:` powinien zawierać bartosz.kosiba@kreativia.pl (ale nie będzie widoczny w nagłówkach)

### 3. Sprawdź czy nie było dwóch zatwierdzeń
- Czy nie zatwierdziłeś decyzji dwukrotnie?
- Czy nie było dwóch MaterialResponse dla tego samego leada?

---

## ✅ CO ZROBIĆ

### Jeśli to duplikat (ten sam Message-ID):
- Problem może być z serwerem SMTP lub klientem pocztowym
- Sprawdź logi serwera SMTP

### Jeśli to dwa różne maile (różne Message-ID):
- Problem może być w systemie - mail został wysłany dwukrotnie
- Sprawdź logi aplikacji czy nie było dwóch wywołań `sendScheduledMaterialResponses`

---

## 📝 KOD - JAK WYSYŁANY JEST MAIL

```typescript
// MaterialResponseSender.ts - linia 691-711
const mailOptions: any = {
  from: `${fromName} <${fromEmail}>`,
  to: response.lead.email, // ✅ Lead w TO
  subject: finalSubject,
  text: textContent,
  html: htmlContent,
  attachments: nodemailerAttachments.length > 0 ? nodemailerAttachments : undefined,
  replyTo: mailbox.email
};

// ✅ Dodaj administratora do BCC
if (companySettings?.forwardEmail) {
  mailOptions.bcc = companySettings.forwardEmail; // ✅ Ty jesteś tutaj
}
```

**Wynik:**
- `TO`: joanna@edelweiss.com.pl (lead)
- `BCC`: bartosz.kosiba@kreativia.pl (ty - administrator)

**To jest POPRAWNE działanie** - otrzymujesz ukrytą kopię każdego wysłanego maila.

---

## 🎯 PODSUMOWANIE

**Do leada:** 1 mail (TO) ✅
**Do administratora:** 1 mail (BCC) ✅

**Jeśli otrzymałeś 2 maile, możliwe że:**
1. Jeden jako BCC (to jest normalne) ✅
2. Jeden jako... duplikat? (to trzeba sprawdzić) ❓

**Sprawdź nagłówki maili - czy mają ten sam Message-ID?**

