# ZASADY AI DLA EKSTRAKCJI ADRESÓW E-MAIL

## 📋 ZASADY W AI (OpenAI GPT-4o-mini):

**Prompt dla AI (linia 223-228):**
```
WAŻNE ZASADY:
1. Zwróć szczególną uwagę na negacje! "Nie jestem zainteresowany" to NOT_INTERESTED, NIE INTERESTED!
2. W "extractedEmails" i "contacts" WYCIĄGAJ TYLKO kontakty osób zastępczych lub przekierowanych
3. NIE WYCIĄGAJ adresów nadawców wiadomości (np. z pola "From:" lub podpisu nadawcy)
4. NIE WYCIĄGAJ adresów z cytowanej wiadomości oryginalnej (po znaku ">")
5. Wyciągaj TYLKO adresy osób trzecich, do których odbiorca przekierowuje kontakt
```

---

## 🔍 PROBLEM Z FALLBACK REGEX:

### Przed naprawą:
```typescript
// Linia 346-347 (stary kod)
const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
const foundEmails = replyContent.match(emailRegex) || [];
// ❌ Pobiera ALL emaile bez filtrowania!
```

**Przykład błędu:**
```
Treść maila OOO:
> Wiadomość napisana przez Adam Martin <adam.martin@kreativia.eu>:
> ...
Dziękuję za wiadomość. Jestem na urlopie. Proszę kontaktować się z Kuba Mruk hello@mint2print.pl

Regex wyciągał:
- adam.martin@kreativia.eu (z cytatu ❌)
- hello@mint2print.pl (z nowej treści ✅)
```

**Rezultat:** Błędny lead adam.martin@kreativia.eu!

---

### Po naprawie:
```typescript
// Linia 346-364 (nowy kod)
const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
let foundEmails = replyContent.match(emailRegex) || [];

// ✅ FILTRUJ: Usuń emaile z cytowanej wiadomości (po ">")
foundEmails = foundEmails.filter(email => {
  const emailIndex = replyContent.indexOf(email);
  if (emailIndex === -1) return false;
  
  // Znajdź ostatni znak ">" przed tym emailem (max 500 znaków wstecz)
  const textBefore = replyContent.substring(Math.max(0, emailIndex - 500), emailIndex);
  const lastQuoteIndex = textBefore.lastIndexOf('>');
  
  // Jeśli ostatni ">" jest dalej niż 100 znaków - to prawdopodobnie w cytacie
  return lastQuoteIndex === -1 || (emailIndex - lastQuoteIndex) > 100;
});

// Usuń duplikaty
foundEmails = [...new Set(foundEmails)];
```

**Rezultat:** Tylko hello@mint2print.pl ✅

---

## ✅ JAK TO DZIAŁA:

### Przykład 1: OOO z kontaktem zastępczym
```
Treść: "Dziękuję za wiadomość. Jestem na urlopie. Proszę kontaktować się z Kuba hello@mint2print.pl"

AI otrzymuje: WYCIĄGNIJ TYLKO adresy osób trzecich
Regex: Wszystkie emaile
Filter: Usuń z cytatów (>)
Rezultat: ["hello@mint2print.pl"] ✅
```

### Przykład 2: OOO z cytowanym mailem
```
Treść:
> Od: adam.martin@kreativia.eu
> ...
Dziękuję za wiadomość. Jestem na urlopie. Proszę kontaktować się z anna.kowalska@firma.pl

AI: WYCIĄGNIJ TYLKO adresy osób trzecich
Regex: adam.martin@kreativia.eu, anna.kowalska@firma.pl
Filter: Usuń adam.martin@kreativia.eu (w cytacie po ">")
Rezultat: ["anna.kowalska@firma.pl"] ✅
```

---

## 🎯 CO JEST WYCIĄGANE:
- ✅ hello@mint2print.pl - kontakt zastępczy z nowej treści
- ✅ anna.kowalska@firma.pl - kontakt przekierowania
- ✅ zamiennik@przedsiebiorstwo.pl - nowy kontakt

## ❌ CO NIE JEST WYCIĄGANE:
- ❌ adam.martin@kreativia.eu - z cytatu oryginalnego maila
- ❌ sales@kreativia.eu - z podpisu nadawcy
- ❌ nasz@email.pl - adres wychodzący

---

**Data naprawy:** 2025-10-26  
**Status:** ✅ Naprawione - regex teraz filtruje cytaty


