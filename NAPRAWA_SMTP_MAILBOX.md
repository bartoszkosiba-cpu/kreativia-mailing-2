# ✅ NAPRAWIONO: Błąd SMTP "Sender address rejected"

## 🐛 PROBLEM:

```
Błąd: 553 5.7.1 adam.martin@kreativia.eu: Sender addres rejected: 
not owned by user bartosz.kosiba@kreativia.eu
```

**Przyczyna:**
- System próbował wysłać jako `adam.martin@kreativia.eu` (FROM)
- Ale autoryzował się jako `bartosz.kosiba@kreativia.eu` (SMTP auth)
- Serwer SMTP odrzucił bo FROM ≠ SMTP user

---

## ✅ ROZWIĄZANIE:

### Zmieniono: `src/services/scheduledSender.ts`

**CO DODANO:**
1. Import `getNextAvailableMailbox` - wybiera skrzynkę (round-robin)
2. Import `incrementMailboxCounter` - zlicza użycia

**CO NAPRAWIONO w `sendSingleEmail()`:**

**PRZED:**
```typescript
// BRAK pobierania skrzynki!
const result = await sendCampaignEmail({
  subject: ...,
  content: ...,
  salesperson: campaign.virtualSalesperson,
  // ❌ BRAK parametru mailbox
});
```

**TERAZ:**
```typescript
// 1. Pobierz dostępną skrzynkę (round-robin)
let mailbox = null;
if (campaign.virtualSalespersonId) {
  mailbox = await getNextAvailableMailbox(campaign.virtualSalespersonId);
  
  if (!mailbox) {
    return { success: false, error: "Brak dostępnych skrzynek" };
  }
  
  console.log(`[SENDER] Używam skrzynki: ${mailbox.email}`);
}

// 2. Przekaż mailbox do sendCampaignEmail
const result = await sendCampaignEmail({
  subject: ...,
  content: ...,
  salesperson: campaign.virtualSalesperson,
  mailbox: mailbox,  // ✅ PRZEKAŻ MAILBOX!
});

// 3. Inkrementuj licznik skrzynki
if (mailbox) {
  await incrementMailboxCounter(mailbox.id);
}
```

---

## 🎯 JAK TO TERAZ DZIAŁA:

### PRZYKŁAD: Wysyłka kampanii

```
1. System wywołuje sendSingleEmail()
   ↓
2. getNextAvailableMailbox(salespersonId)
   → Pobierz wszystkie skrzynki
   → Wybierz pierwszą z wolnym miejscem (round-robin)
   → Zwróć mailbox (np. adam.martin@kreativia.eu)
   ↓
3. sendCampaignEmail({ mailbox: mailbox })
   → Użyj SMTP z mailbox.smtpUser/auth
   → FROM = mailbox.email (adam.martin@kreativia.eu)
   → SMTP auth = mailbox.smtpUser (adam.martin@kreativia.eu)
   → ✅ ZGODNOŚĆ!
   ↓
4. incrementMailboxCounter(mailbox.id)
   → Zwiększ licznik użycia
   → Aktualizuj lastUsedAt
   ↓
5. ✅ Email wysłany pomyślnie
```

---

## ✅ REZULTAT:

**PRZED:**
- System wysyłał jako adam.martin@kreativia.eu
- Ale autoryzował się jako bartosz.kosiba@kreativia.eu
- Serwer SMTP odrzucał: FROM ≠ auth user

**TERAZ:**
- System wybiera skrzynkę: adam.martin@kreativia.eu
- FROM = adam.martin@kreativia.eu
- SMTP auth = adam.martin@kreativia.eu
- ✅ **ZGODNOŚĆ!** Email wysłany pomyślnie

---

## 📊 DODATKOWE KORZYŚCI:

1. **Round-robin** - równe rozłożenie wysyłki na skrzynki
2. **Daily limits** - szanuje limity dzienne skrzynek
3. **Logging** - zapisuje mailboxId w SendLog
4. **Priority** - używa skrzynek według priorytetu (główna skrzynka pierwsza)

**Data naprawy:** 2025-10-26  
**Status:** ✅ Naprawione

