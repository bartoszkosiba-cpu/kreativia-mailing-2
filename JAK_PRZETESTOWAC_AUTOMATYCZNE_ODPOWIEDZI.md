# 🧪 Jak przetestować automatyczne odpowiedzi z materiałami

## ✅ Warunki wymagane do testowania:

1. **Kampania z włączonym modułem:**
   - Checkbox "Włącz automatyczne odpowiedzi" ✅ ZAZNACZONY
   - Kontekst kampanii wypełniony
   - Przynajmniej 1 materiał dodany

2. **Lead w kampanii:**
   - Lead musi być przypisany do kampanii (przez `CampaignLead`)
   - Lead otrzymał maila z tej kampanii (ma `SendLog`)

3. **Email przychodzący:**
   - Email od leada który jest w kampanii
   - Klasyfikacja: `INTERESTED`
   - Treść zawiera prośbę o materiały

---

## 🎯 **Sposób 1: Rzeczywisty email (najłatwiejszy)**

### Krok 1: Przygotowanie
1. Wejdź na: `http://localhost:3000/campaigns/2`
2. Włącz checkbox "Włącz automatyczne odpowiedzi"
3. Wypełnij kontekst (np. "Oferujemy podwieszenia targowe. W treści maila pytamy: 'Czy mogę przesłać katalog?'")
4. Dodaj materiał (link lub załącznik)
5. Kliknij "Zapisz ustawienia"

### Krok 2: Sprawdź czy lead jest w kampanii
```bash
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"
sqlite3 prisma/dev.db "SELECT l.id, l.email, l.firstName, cl.campaignId FROM Lead l JOIN CampaignLead cl ON l.id = cl.leadId WHERE l.email = 'adam.majewski@kreativia.pl' AND cl.campaignId = 2;"
```

Jeśli nie ma → dodaj leada do kampanii przez interfejs.

### Krok 3: Wyślij email testowy
Wyślij email z adresu `adam.majewski@kreativia.pl` do skrzynki kampanii (email handlowca), np.:

**Temat:** `Re: [Temat kampanii]`

**Treść:**
```
Dzień dobry,

Tak, proszę przesłać katalog i cennik. Jestem bardzo zainteresowany!

Pozdrawiam
Adam Majewski
```

### Krok 4: Pobierz emaile (IMAP)
Wejdź na: `http://localhost:3000/inbox` → kliknij "Pobierz maile"

Lub przez API:
```bash
curl -X POST http://localhost:3000/api/inbox/fetch
```

### Krok 5: Sprawdź wynik
System automatycznie:
1. Pobierze email przez IMAP
2. Przetworzy przez `processReply`
3. Wywoła `EmailAgentAI.processEmailReply`
4. AI rozpozna prośbę o materiały
5. Utworzy `PendingMaterialDecision` (wymaga akceptacji)

**Sprawdź w bazie:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM PendingMaterialDecision WHERE campaignId = 2 ORDER BY id DESC LIMIT 1;"
```

**Sprawdź w UI:**
- Wejdź na: `http://localhost:3000/material-decisions`
- Powinna być karta z prośbą o decyzję

### Krok 6: Zatwierdź przez administratora
1. Wejdź na: `http://localhost:3000/material-decisions`
2. Kliknij "✓ Zatwierdź - Wyślij materiały"
3. System utworzy `MaterialResponse` ze statusem `scheduled`
4. Po 15 minutach (lub zmień `scheduledAt` na przeszłość) cron wyśle materiały

---

## 🎯 **Sposób 2: Ręczne testowanie (bez emaila)**

### Utwórz odpowiedź ręcznie w bazie:

```bash
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"

# 1. Znajdź ID leada
LEAD_ID=$(sqlite3 prisma/dev.db "SELECT id FROM Lead WHERE email = 'adam.majewski@kreativia.pl' LIMIT 1;")
echo "Lead ID: $LEAD_ID"

# 2. Utwórz odpowiedź ręcznie
sqlite3 prisma/dev.db <<EOF
INSERT INTO InboxReply (
  leadId,
  campaignId,
  fromEmail,
  subject,
  content,
  receivedAt,
  messageId,
  classification
) VALUES (
  $LEAD_ID,
  2,
  'adam.majewski@kreativia.pl',
  'Re: Test - prośba o materiały',
  'Tak, proszę przesłać katalog i cennik. Jestem bardzo zainteresowany!',
  datetime('now'),
  'test-message-' || random(),
  NULL
);
SELECT last_insert_rowid() as reply_id;
EOF
```

### Wywołaj AI Agent ręcznie:

Sprawdź czy istnieje endpoint do ręcznego przetwarzania, lub utwórz skrypt testowy.

---

## 🔍 **Sprawdzenie co się dzieje:**

### 1. Sprawdź logi serwera
W terminalu gdzie działa `npm run dev` szukaj:
```
[EMAIL AGENT AI] Sprawdzam czy to prośba o materiały dla kampanii 2
[MATERIAL AI] Analiza: isMaterialRequest=true, confidence=0.85
[EMAIL AGENT AI] ASK_ADMIN_MATERIALS: Utworzono kolejkę decyzji
```

### 2. Sprawdź w bazie

**Czy utworzono PendingMaterialDecision:**
```bash
sqlite3 prisma/dev.db "SELECT id, leadId, campaignId, aiConfidence, suggestedAction, status FROM PendingMaterialDecision WHERE campaignId = 2 ORDER BY id DESC LIMIT 1;"
```

**Czy utworzono MaterialResponse (po zatwierdzeniu):**
```bash
sqlite3 prisma/dev.db "SELECT id, leadId, campaignId, status, scheduledAt, sentAt FROM MaterialResponse WHERE campaignId = 2 ORDER BY id DESC LIMIT 1;"
```

---

## 💡 **Najprostszy test:**

1. ✅ Kampania 2 ma włączony auto-reply + materiały
2. ✅ Lead `adam.majewski@kreativia.pl` jest w kampanii 2
3. 📧 Wyślij email z `adam.majewski@kreativia.pl` do skrzynki handlowca z treścią: **"Tak, proszę przesłać katalog"**
4. 🔄 Pobierz maile: `http://localhost:3000/inbox` → "Pobierz maile"
5. ✅ Sprawdź: `http://localhost:3000/material-decisions` → powinna być karta z prośbą
6. ✅ Zatwierdź → system zaplanuje wysyłkę na za 15 min
7. ⏰ Poczekaj 15 min lub zmień `scheduledAt` w bazie na przeszłość
8. 📬 Cron wyśle materiały automatycznie

---

## 🐛 Jeśli coś nie działa:

1. **Sprawdź logi serwera** - szukaj błędów
2. **Sprawdź czy lead jest w kampanii:**
   ```bash
   sqlite3 prisma/dev.db "SELECT * FROM CampaignLead WHERE leadId = [LEAD_ID] AND campaignId = 2;"
   ```
3. **Sprawdź czy kampania ma materiały:**
   ```bash
   sqlite3 prisma/dev.db "SELECT * FROM CampaignMaterial WHERE campaignId = 2 AND isActive = 1;"
   ```
4. **Sprawdź klasyfikację emaila:**
   ```bash
   sqlite3 prisma/dev.db "SELECT id, classification, aiSummary FROM InboxReply WHERE fromEmail = 'adam.majewski@kreativia.pl' ORDER BY id DESC LIMIT 1;"
   ```
   Powinno być: `classification = 'INTERESTED'`

---

**Najłatwiej będzie wysłać rzeczywisty email i sprawdzić czy system go przetworzy!** 🚀


