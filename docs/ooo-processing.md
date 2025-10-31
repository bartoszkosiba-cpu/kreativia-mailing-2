# System przetwarzania odpowiedzi OOO (Out of Office)

## 📋 Przegląd

System automatycznie wykrywa odpowiedzi OOO (out of office/urlop), wyciąga kontakty zastępcze i tworzy dla nich nowe leady z wysokim priorytetem.

---

## 🔍 Jak działa wykrywanie OOO

### 1. Klasyfikacja AI

System używa **GPT-4o-mini** do klasyfikacji odpowiedzi:

**Zasady w prompcie AI (linia 223-228):**
```
2. W "extractedEmails" i "contacts" WYCIĄGAJ TYLKO kontakty osób zastępczych/przekierowanych
3. NIE WYCIĄGAJ adresów nadawców wiadomości (np. z pola "From:" lub podpisu nadawcy)
4. NIE WYCIĄGAJ adresów z cytowanej wiadomości oryginalnej (po znaku ">")
5. Wyciągaj TYLKO adresy osób trzecich, do których odbiorca przekierowuje kontakt
```

**Kluczowe słowa wykrywania OOO:**
- "urlop"
- "out of office"
- "vacation"
- "urlaub"
- "congé"

### 2. Fallback Regex (Zabezpieczenie)

Jeśli AI nie działa, system używa regex do wyciągnięcia emaili:

```typescript
const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
let foundEmails = replyContent.match(emailRegex) || [];

// ✅ FILTRUJ: Usuń emaile z cytowanej wiadomości (po ">")
foundEmails = foundEmails.filter(email => {
  const emailIndex = replyContent.indexOf(email);
  const textBefore = replyContent.substring(Math.max(0, emailIndex - 500), emailIndex);
  const lastQuoteIndex = textBefore.lastIndexOf('>');
  
  // Jeśli ostatni ">" jest dalej niż 100 znaków - to prawdopodobnie w cytacie
  return lastQuoteIndex === -1 || (emailIndex - lastQuoteIndex) > 100;
});

// Usuń duplikaty
foundEmails = [...new Set(foundEmails)];
```

**Co jest wyciągane:**
- ✅ Kontakt zastępczy z nowej treści odpowiedzi
- ✅ Kontakt do osoby trzeciej

**Co NIE jest wyciągane:**
- ❌ Adresy z cytatu oryginalnego maila (po znaku ">")
- ❌ Adres nadawcy (z From:)
- ❌ Adresy z podpisu nadawcy

---

## 🎯 Przykłady

### Przykład 1: OOO z kontaktem zastępczym

**Otrzymana odpowiedź:**
```
Dziękuję za wiadomość. W dniu dzisiejszym jestem na urlopie. 
Proszę kontaktować się z Kuba Mruk hello@mint2print.pl
```

**Rezultat:**
- **Klasyfikacja:** OOO
- **Wykryte emaile:** ["hello@mint2print.pl"]
- **Dane kontaktowe:**
  ```json
  {
    "contacts": [
      {
        "email": "hello@mint2print.pl",
        "firstName": "Kuba",
        "lastName": "Mruk"
      }
    ]
  }
  ```

**Co się dzieje automatycznie:**
1. System tworzy nowego leada: hello@mint2print.pl
2. Dodaje imię: Kuba, nazwisko: Mruk
3. Skopiuje dane firmy z oryginalnego leada
4. Doda tag "OOO Zastępca"
5. Skopiuje wszystkie tagi z oryginalnego leada
6. Doda nowego leada do kampanii z **priorytetem 1** (najwyższy)
7. Wyśle mail natychmiast (jeśli kampania bez harmonogramu)

---

### Przykład 2: OOO z cytowanym mailem

**Otrzymana odpowiedź:**
```
> Wiadomość napisana przez Adam Martin <adam.martin@kreativia.eu>:
> Dzień dobry, oferta...
>
Dziękuję za wiadomość. Jestem na urlopie.
Proszę kontaktować się z anna.kowalska@firma.pl
```

**Rezultat:**
- **Wykryte emaile:** ["anna.kowalska@firma.pl"]
- ❌ adam.martin@kreativia.eu - **ODFILTROWANE** (w cytacie po ">")

**System:**
- ✅ Stworzy leada: anna.kowalska@firma.pl
- ❌ Nie stworzy leada: adam.martin@kreativia.eu

---

### Przykład 3: OOO bez kontaktu zastępczego

**Otrzymana odpowiedź:**
```
Dziękuję za wiadomość. Jestem na urlopie do 30.10.2025.
Wrócę wkrótce.
```

**Rezultat:**
- **Klasyfikacja:** OOO
- **Wykryte emaile:** [] (brak)
- **Dane:**
  ```json
  {
    "oooReturnDate": "2025-10-30",
    "contacts": []
  }
  ```

**Co się dzieje:**
- Lead zostaje oznaczony jako `CZEKAJ_OOO`
- Kampania jest wstrzymana dla tego leada
- User otrzyma powiadomienie (bez forward emaila)
- Gdy lead wróci z urlopu, user może go reaktywować

---

## 🔄 Co się dzieje automatycznie

### 1. Tworzenie nowych leadów

Gdy AI wykryje kontakty zastępcze:

```typescript
// Dla każdego znalezionego kontaktu
await db.lead.create({
  data: {
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    greetingForm: "Dzień dobry Panie/Pani [imię]", // Generowane przez GPT
    company: currentLead.company,      // Skopiowane
    websiteUrl: currentLead.websiteUrl, // Skopiowane
    industry: currentLead.industry,     // Skopiowane
    companyCity: currentLead.companyCity, // Skopiowane
    companyCountry: currentLead.companyCountry, // Skopiowane
    language: currentLead.language,     // Skopiowane
  }
});
```

### 2. Oznaczanie tagami

- ✅ Tag "OOO Zastępca" dodawany automatycznie
- ✅ Wszystkie tagi oryginalnego leada są kopiowane

### 3. Dodanie do kampanii

Nowy lead zostaje dodany do:
- ✅ Głównej kampanii z **priorytetem 1**
- ✅ Wszystkich follow-up kampanii

### 4. Natychmiastowa wysyłka

Jeśli kampania **nie ma harmonogramu** (`scheduledAt = NULL`):
- ✅ Mail wysyłany **od razu**
- ✅ Używa skrzynki (round-robin)
- ✅ Zapisywany do SendLog z mailboxId

---

## ⚠️ Zabezpieczenia

### Filtrowanie wirtualnych handlowców

System **NIE** tworzy leadów dla emaili wirtualnych handlowców:

```typescript
// Pobierz wszystkich wirtualnych handlowców
const virtualSalespeople = await db.virtualSalesperson.findMany({
  select: { email: true }
});
const virtualEmails = virtualSalespeople.map(vs => vs.email.toLowerCase());

// Filtruj
if (virtualEmails.includes(newEmail.toLowerCase())) {
  console.log(`Pomijam ${newEmail} - to wirtualny handlowiec`);
  continue;
}
```

### Filtrowanie cytatów

System filtruje emaile z cytowanej wiadomości (po znaku ">"):

```typescript
foundEmails = foundEmails.filter(email => {
  const emailIndex = replyContent.indexOf(email);
  const textBefore = replyContent.substring(Math.max(0, emailIndex - 500), emailIndex);
  const lastQuoteIndex = textBefore.lastIndexOf('>');
  
  // Jeśli ostatni ">" jest dalej niż 100 znaków - to prawdopodobnie w cytacie
  return lastQuoteIndex === -1 || (emailIndex - lastQuoteIndex) > 100;
});
```

---

## 📊 Statusy leada

Po przetworzeniu odpowiedzi OOO, oryginalny lead jest oznaczony jako:

- **Status:** `CZEKAJ`
- **SubStatus:** `CZEKAJ_OOO_WITH_CONTACTS` (jeśli jest kontakt zastępczy)
- **SubStatus:** `CZEKAJ_OOO` (jeśli brak kontaktów)

Kampania jest **wstrzymana** dla oryginalnego leada.

---

## 🧪 Testy

### Test 1: OOO z kontaktem zastępczym
```
Input: "Dziękuję za wiadomość. Jestem na urlopie. Proszę kontaktować się z Kuba hello@mint2print.pl"
Expected: 
  - Nowy lead: hello@mint2print.pl
  - Imię: Kuba
  - Priorytet: 1
  - Tag: OOO Zastępca
```

### Test 2: OOO z cytowanym mailem
```
Input: "> adam.martin@kreativia.eu\n Jestem na urlopie. Proszę kontaktować się z anna@firma.pl"
Expected:
  - Wykryty email: anna@firma.pl
  - Odfiltrowany: adam.martin@kreativia.eu
```

### Test 3: OOO bez kontaktu
```
Input: "Jestem na urlopie do 30.10"
Expected:
  - Brak nowych leadów
  - Lead: CZEKAJ_OOO
  - Kampania wstrzymana
```

---

## 📝 Logi

Wszystkie akcje są logowane:
```
[PROCESSOR] ✅ OOO lead wysłany natychmiast do hello@mint2print.pl
[PROCESSOR] 🏷️  Kopiuję 3 tagów z leada adam.majewski@kreativia.pl do hello@mint2print.pl
[PROCESSOR] ✅ Dodano OOO leada do kampanii (CampaignLead ID: 123, priority: 1)
[PROCESSOR] 🎯 Dodano leada hello@mint2print.pl (ID: 4860) do kampanii 5
```

---

**Data ostatniej aktualizacji:** 2025-10-26  
**Status:** ✅ Działa, filtrowanie cytatów naprawione



