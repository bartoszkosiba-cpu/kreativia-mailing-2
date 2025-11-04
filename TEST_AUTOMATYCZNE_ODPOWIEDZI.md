# 🧪 Przewodnik testowy - Automatyczne odpowiedzi z materiałami

## Przygotowanie

### 1. Upewnij się że baza jest zsynchronizowana
```bash
cd "/Users/bartoszkosiba/Library/Mobile Documents/com~apple~CloudDocs/Katalogi/Cursor/Projekty/Kopie/Kreativia Mailing 2"
npx prisma db push
npx prisma generate
```

### 2. Uruchom serwer
```bash
npm run dev
```

Aplikacja będzie dostępna pod: `http://localhost:3000`

---

## 📋 Plan testów

### Test 1: Konfiguracja kampanii

**Cel:** Sprawdzić czy można włączyć automatyczne odpowiedzi i dodać materiały.

**Kroki:**
1. Wejdź na stronę kampanii: `http://localhost:3000/campaigns/[ID_KAMPANII]`
2. Przejdź do zakładki **"Automatyczne odpowiedzi"**
3. **Włącz** checkbox "Włącz automatyczne odpowiedzi z materiałami"
4. **Wypełnij kontekst:** 
   ```
   Oferujemy meble biurowe. W treści maila pytamy: "Czy mogę przesłać katalog i cennik?"
   ```
5. **Ustaw opóźnienie:** 15 minut (domyślnie)
6. Kliknij **"Zapisz ustawienia"**
7. ✅ **Oczekiwany rezultat:** Powinno pojawić się "✓ Zapisano"

**Test dodawania materiałów:**
8. W sekcji "Materiały do wysyłki" kliknij **"+ Dodaj materiał"**
9. Wypełnij:
   - **Nazwa:** "Katalog mebli biurowych 2025"
   - **Typ:** Wybierz "Link do pobrania"
   - **URL:** `https://example.com/katalog.pdf`
   - **Kolejność:** 0
10. Kliknij **"Dodaj"**
11. ✅ **Oczekiwany rezultat:** Materiał powinien pojawić się na liście

**Test dodawania załącznika:**
12. Kliknij **"+ Dodaj materiał"** ponownie
13. Wypełnij:
   - **Nazwa:** "Cennik mebli biurowych"
   - **Typ:** Wybierz "Załącznik (plik)"
   - **Ścieżka pliku:** `uploads/materials/cennik.pdf`
   - **Nazwa pliku:** `cennik.pdf`
   - **Kolejność:** 1
14. Kliknij **"Dodaj"**
15. ✅ **Oczekiwany rezultat:** Materiał powinien pojawić się na liście

**Weryfikacja w bazie:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM Campaign WHERE id = [ID_KAMPANII];"
# Powinno pokazać autoReplyEnabled = 1, autoReplyContext, autoReplyDelayMinutes

sqlite3 prisma/dev.db "SELECT * FROM CampaignMaterial WHERE campaignId = [ID_KAMPANII];"
# Powinno pokazać 2 materiały
```

---

### Test 2: Symulacja odpowiedzi INTERESTED z prośbą o materiały

**Cel:** Sprawdzić czy system rozpoznaje prośbę o materiały i planuje wysyłkę.

**Przygotowanie:**
1. Masz kampanię z włączonym `autoReplyEnabled = true`
2. Masz przynajmniej 1 materiał w kampanii
3. Masz leada który dostał maila z tej kampanii

**Kroki - opcja A (ręczna):**
1. W bazie znajdź `InboxReply` dla leada który otrzymał maila:
```bash
sqlite3 prisma/dev.db "SELECT id, leadId, campaignId, content, classification FROM InboxReply WHERE campaignId = [ID_KAMPANII] ORDER BY id DESC LIMIT 1;"
```

2. Utwórz nową odpowiedź z prośbą o materiały:
```sql
INSERT INTO InboxReply (
  leadId, 
  campaignId, 
  fromEmail, 
  subject, 
  content, 
  classification,
  createdAt
) VALUES (
  [LEAD_ID],
  [CAMPAIGN_ID],
  'lead@example.com',
  'Re: [Temat kampanii]',
  'Tak, proszę przesłać katalog i cennik. Jestem bardzo zainteresowany!',
  NULL,
  datetime('now')
);
```

3. Zapisz ID tej odpowiedzi, np. `REPLY_ID = [ID]`

**Kroki - opcja B (przez API):**
```bash
# Wywołaj AI Agent ręcznie dla odpowiedzi
curl -X POST http://localhost:3000/api/ai-agent/process \
  -H "Content-Type: application/json" \
  -d '{"replyId": [REPLY_ID]}'
```

**Lub bezpośrednio w kodzie:**
Utwórz plik testowy: `test-material-response.ts`
```typescript
import { EmailAgentAI } from '@/services/emailAgentAI';

// Przetwórz odpowiedź
const analysis = await EmailAgentAI.processEmailReply(REPLY_ID);
await EmailAgentAI.executeActions(analysis, REPLY_ID);

console.log('Actions:', analysis.actions);
console.log('Material Analysis:', analysis.materialAnalysis);
```

4. ✅ **Oczekiwany rezultat:**
   - W logach powinno być: `[EMAIL AGENT AI] Sprawdzam czy to prośba o materiały...`
   - Jeśli confidence >= 0.8: `[EMAIL AGENT AI] SEND_MATERIALS: Zaplanowano wysyłkę...`
   - Jeśli confidence 0.6-0.8: `[EMAIL AGENT AI] ASK_ADMIN_MATERIALS: Utworzono kolejkę...`

**Weryfikacja:**
```bash
# Sprawdź czy utworzono MaterialResponse
sqlite3 prisma/dev.db "SELECT * FROM MaterialResponse WHERE replyId = [REPLY_ID];"

# Sprawdź czy utworzono PendingMaterialDecision (jeśli confidence średnia)
sqlite3 prisma/dev.db "SELECT * FROM PendingMaterialDecision WHERE replyId = [REPLY_ID];"
```

---

### Test 3: Kolejka decyzji administratora

**Cel:** Sprawdzić czy administrator może podjąć decyzję o wysłaniu materiałów.

**Kroki:**
1. Upewnij się że istnieje `PendingMaterialDecision` w statusie `PENDING`:
```bash
sqlite3 prisma/dev.db "SELECT * FROM PendingMaterialDecision WHERE status = 'PENDING';"
```

2. Wejdź na stronę: `http://localhost:3000/material-decisions`
3. ✅ **Oczekiwany rezultat:** Powinny być widoczne karty z prośbami o decyzję

**Test zatwierdzenia:**
4. Kliknij **"✓ Zatwierdź - Wyślij materiały"** dla jednej z decyzji
5. ✅ **Oczekiwany rezultat:** 
   - Decyzja powinna zniknąć z listy
   - W bazie status powinien być `APPROVED`
   - Powinien zostać utworzony `MaterialResponse` ze statusem `scheduled`

**Weryfikacja:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM PendingMaterialDecision WHERE id = [DECISION_ID];"
# Status powinien być APPROVED

sqlite3 prisma/dev.db "SELECT * FROM MaterialResponse WHERE leadId = [LEAD_ID] AND campaignId = [CAMPAIGN_ID];"
# Powinien być scheduled ze scheduledAt ustawionym na ~15 min w przyszłość
```

---

### Test 4: Automatyczna wysyłka materiałów (cron job)

**Cel:** Sprawdzić czy cron job wysyła zaplanowane materiały.

**Przygotowanie:**
1. Utwórz `MaterialResponse` ze statusem `scheduled`:
```sql
-- Ustaw scheduledAt na 1 minutę w przyszłości dla szybkiego testu
UPDATE MaterialResponse 
SET status = 'scheduled', 
    scheduledAt = datetime('now', '+1 minute')
WHERE id = [MATERIAL_RESPONSE_ID];
```

2. Sprawdź czy cron jest aktywny:
```bash
curl http://localhost:3000/api/cron/status
```

**Kroki:**
1. Poczekaj aż minie czas z `scheduledAt` (lub ręcznie zmień na przeszłość)
2. Cron job powinien uruchomić się automatycznie co 5 minut
3. **Lub wywołaj ręcznie:**
```bash
# Utwórz endpoint testowy lub wywołaj bezpośrednio w kodzie:
```

Utwórz plik: `test-send-materials.ts`
```typescript
import { sendScheduledMaterialResponses } from '@/services/materialResponseSender';

const sentCount = await sendScheduledMaterialResponses();
console.log(`Wysłano ${sentCount} odpowiedzi z materiałami`);
```

4. ✅ **Oczekiwany rezultat:**
   - W logach: `[MATERIAL SENDER] Znaleziono X zaplanowanych wysyłek`
   - Email powinien być wysłany do leada z załącznikami/linkami
   - Status `MaterialResponse` powinien zmienić się na `sent`
   - `sentAt` powinien być ustawiony

**Weryfikacja:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM MaterialResponse WHERE id = [ID];"
# Status: sent, sentAt: [data], mailboxId: [ID]
```

---

### Test 5: Test AI - Analiza prośby o materiały

**Cel:** Sprawdzić czy AI poprawnie rozpoznaje prośby o materiały.

**Utwórz plik testowy:** `test-ai-analysis.ts`
```typescript
import { analyzeMaterialRequest } from '@/services/materialResponseAI';

const testCases = [
  {
    reply: "Tak, proszę przesłać katalog i cennik. Jestem bardzo zainteresowany!",
    expected: true
  },
  {
    reply: "Moglibyście przesłać więcej informacji o waszych produktach?",
    expected: true
  },
  {
    reply: "Dziękuję za ofertę, ale nie jestem zainteresowany.",
    expected: false
  },
  {
    reply: "Czy mogę otrzymać materiały do pobrania?",
    expected: true
  }
];

for (const testCase of testCases) {
  const result = await analyzeMaterialRequest(
    testCase.reply,
    "Oferujemy meble biurowe. W treści maila pytamy: 'Czy mogę przesłać katalog i cennik?'",
    'pl'
  );
  
  console.log(`\nReply: "${testCase.reply}"`);
  console.log(`Expected: ${testCase.expected}, Got: ${result.isMaterialRequest}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`Reasoning: ${result.reasoning}`);
  console.log(`Suggested Action: ${result.suggestedAction}`);
}
```

**Wykonaj:**
```bash
# W konsoli Node.js lub przez ts-node
npx ts-node test-ai-analysis.ts
```

✅ **Oczekiwany rezultat:**
- Prośby o materiały powinny mieć `isMaterialRequest = true` i confidence >= 0.6
- Odmowy powinny mieć `isMaterialRequest = false`

---

### Test 6: Test generowania odpowiedzi AI

**Cel:** Sprawdzić czy AI generuje poprawną odpowiedź z materiałami.

**Utwórz plik:** `test-generate-response.ts`
```typescript
import { generateMaterialResponse } from '@/services/materialResponseAI';

const response = await generateMaterialResponse(
  {
    firstName: "Jan",
    lastName: "Kowalski",
    greetingForm: "Dzień dobry Panie Janie",
    language: "pl"
  },
  {
    id: 1,
    name: "Kampania mebli biurowych",
    autoReplyContext: "Oferujemy meble biurowe. W treści maila pytamy: 'Czy mogę przesłać katalog i cennik?'",
    autoReplyRules: null,
    virtualSalespersonLanguage: "pl"
  },
  [
    {
      name: "Katalog mebli biurowych 2025",
      type: "LINK",
      url: "https://example.com/katalog.pdf",
      fileName: null
    },
    {
      name: "Cennik mebli biurowych",
      type: "ATTACHMENT",
      url: null,
      fileName: "cennik.pdf"
    }
  ],
  "Tak, proszę przesłać katalog i cennik!"
);

console.log("Subject:", response.subject);
console.log("\nContent:", response.content);
```

✅ **Oczekiwany rezultat:**
- Temat powinien być profesjonalny
- Treść powinna zawierać:
  - Powitanie (używając greetingForm)
  - Podziękowanie za zainteresowanie
  - Informację o załączonych materiałach
  - Linki do materiałów (jeśli LINK)
- Język powinien być zgodny z `virtualSalespersonLanguage`

---

## 🐛 Debugging

### Jeśli nie działa automatyczne rozpoznawanie:

1. **Sprawdź logi:**
```bash
# W terminalu gdzie działa npm run dev
# Szukaj:
[EMAIL AGENT AI] Sprawdzam czy to prośba o materiały...
[MATERIAL AI] Błąd analizy AI: ...
```

2. **Sprawdź czy kampania ma włączony auto-reply:**
```bash
sqlite3 prisma/dev.db "SELECT id, name, autoReplyEnabled, autoReplyContext FROM Campaign WHERE id = [ID];"
```

3. **Sprawdź czy kampania ma materiały:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM CampaignMaterial WHERE campaignId = [ID] AND isActive = 1;"
```

4. **Sprawdź czy lead już otrzymał materiały (nie powinien dostać ponownie):**
```bash
sqlite3 prisma/dev.db "SELECT * FROM MaterialResponse WHERE leadId = [LEAD_ID] AND campaignId = [CAMPAIGN_ID];"
```

### Jeśli nie działa wysyłka:

1. **Sprawdź czy cron działa:**
```bash
curl http://localhost:3000/api/cron/status
```

2. **Sprawdź zaplanowane wysyłki:**
```bash
sqlite3 prisma/dev.db "SELECT * FROM MaterialResponse WHERE status = 'scheduled' AND scheduledAt <= datetime('now');"
```

3. **Sprawdź logi cron:**
```bash
# W terminalu powinno być:
[CRON] 📧 Sprawdzam zaplanowane kampanie...
[MATERIAL SENDER] Znaleziono X zaplanowanych wysyłek...
```

4. **Sprawdź czy skrzynka ma SMTP skonfigurowane:**
```bash
sqlite3 prisma/dev.db "SELECT id, email, smtpHost, smtpUser FROM Mailbox WHERE id = [MAILBOX_ID];"
```

---

## ✅ Checklist testów

- [ ] Konfiguracja kampanii - włączanie auto-reply
- [ ] Dodawanie materiałów (LINK)
- [ ] Dodawanie materiałów (ATTACHMENT)
- [ ] Edycja materiałów
- [ ] Usuwanie materiałów
- [ ] Rozpoznawanie prośby o materiały przez AI
- [ ] Planowanie wysyłki (confidence >= 0.8)
- [ ] Kolejka administratora (confidence 0.6-0.8)
- [ ] Zatwierdzenie przez administratora
- [ ] Odrzucenie przez administratora
- [ ] Automatyczna wysyłka (cron)
- [ ] Wysyłka z załącznikami
- [ ] Wysyłka z linkami
- [ ] Generowanie odpowiedzi AI
- [ ] Opóźnienie 15 minut działa
- [ ] Nie wysyła ponownie do tego samego leada z tej kampanii
- [ ] Język odpowiedzi zgodny z językiem kampanii

---

## 📝 Notatki testowe

Data testu: _______________
Tester: _______________

| Test | Status | Uwagi |
|------|--------|-------|
| Test 1: Konfiguracja | ✅/❌ | |
| Test 2: Rozpoznawanie | ✅/❌ | |
| Test 3: Kolejka | ✅/❌ | |
| Test 4: Wysyłka | ✅/❌ | |
| Test 5: AI Analysis | ✅/❌ | |
| Test 6: AI Generation | ✅/❌ | |

**Znalezione błędy:**
1. 
2. 
3. 

---

## 🚀 Szybki test end-to-end

```bash
# 1. Utwórz kampanię z auto-reply
# 2. Dodaj materiał (link)
# 3. Wyślij testową odpowiedź INTERESTED
# 4. Sprawdź czy została zaplanowana wysyłka
# 5. Poczekaj 15 min lub zmień scheduledAt na przeszłość
# 6. Sprawdź czy email został wysłany
```

Good luck! 🎯


