# ARCHITEKTURA AI - SYSTEM STATUSÓW

## [→] PRZEGLĄD SYSTEMU

**Cel:** Inteligentna klasyfikacja emaili i zarządzanie statusami leadów
**Nazwa:** Email Agent AI + AI Rules Manager + AI Chat Interface

---

## [→] MODUŁY AI

### **1. Email Agent AI (Główny moduł)**
- **Plik:** `src/services/emailAgentAI.ts`
- **Zadanie:** Klasyfikuje emaile i określa akcje
- **Zasady:** Stałe + dynamiczne z bazy danych
- **Funkcje:**
  - `classifyEmail(content, language)` - klasyfikacja
  - `processEmailReply(replyId)` - przetwarzanie odpowiedzi
  - `executeActions(actions)` - wykonywanie akcji

### **2. AI Rules Manager (Zarządzanie zasadami)**
- **Plik:** `src/services/aiRulesManager.ts`
- **Zadanie:** Zarządza zasadami klasyfikacji
- **Funkcje:**
  - `addRule(rule)` - dodawanie zasady
  - `updateRule(id, rule)` - edycja zasady
  - `deleteRule(id)` - usuwanie zasady
  - `getActiveRules()` - pobieranie aktywnych zasad
  - `validateRule(rule)` - walidacja zasady

### **3. AI Chat Interface (Interfejs do dodawania zasad)**
- **Plik:** `src/services/aiChatInterface.ts`
- **Zadanie:** Chat do dodawania nowych zasad
- **Funkcje:**
  - `processChatMessage(message)` - przetwarzanie wiadomości
  - `createRuleFromChat(message)` - tworzenie zasady z chat
  - `getChatHistory()` - historia chatów

---

## [→] STRUKTURA BAZY DANYCH

### **Tabela AIRules:**
```sql
CREATE TABLE AIRules (
  id TEXT PRIMARY KEY,
  classification TEXT NOT NULL, -- INTERESTED, NOT_INTERESTED, etc.
  pattern TEXT, -- Regex pattern
  keywords TEXT, -- JSON array of keywords
  confidence REAL, -- 0.0 - 1.0
  priority INTEGER DEFAULT 0, -- Wyższy = ważniejszy
  createdBy TEXT, -- User ID
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  isActive BOOLEAN DEFAULT true,
  description TEXT -- Opis zasady
);
```

### **Tabela AIChatHistory:**
```sql
CREATE TABLE AIChatHistory (
  id TEXT PRIMARY KEY,
  userMessage TEXT NOT NULL,
  aiResponse TEXT NOT NULL,
  rulesCreated TEXT, -- JSON array of rule IDs
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  userId TEXT
);
```

---

## [→] ZASADY KLASYFIKACJI

### **A) Zasady na stałe (w kodzie):**
```typescript
const STATIC_RULES = {
  INTERESTED: {
    keywords: ["proszę o wycenę", "jestem zainteresowany", "chcę więcej informacji"],
    patterns: [/proszę o/i, /wycenę/i, /zainteresowany/i],
    confidence: 0.9,
    priority: 100
  },
  NOT_INTERESTED: {
    keywords: ["nie jestem zainteresowany", "nie potrzebuję", "nie dziękuję"],
    patterns: [/nie jestem zainteresowany/i, /nie potrzebuję/i],
    confidence: 0.95,
    priority: 100
  }
  // ... więcej zasad
};
```

### **B) Zasady dynamiczne (z bazy danych):**
```typescript
interface DynamicRule {
  id: string;
  classification: string;
  pattern?: string;
  keywords: string[];
  confidence: number;
  priority: number;
  isActive: boolean;
  description: string;
}
```

---

## [→] WORKFLOW KLASYFIKACJI

```
Email → Email Agent AI → Klasyfikacja (stałe + dynamiczne) → Akcje → Status Lead
                ↓
        AI Rules Manager ← AI Chat Interface (dodawanie zasad)
```

### **Kroki klasyfikacji:**
1. **Pobierz zasady** - stałe + dynamiczne z bazy
2. **Uruchom klasyfikację** - sprawdź wszystkie zasady
3. **Wybierz najlepszą** - najwyższy confidence * priority
4. **Określ akcje** - na podstawie klasyfikacji
5. **Wykonaj akcje** - zmień status leada

---

## [→] MIGRACJA Z ISTNIEJĄCEGO KODU

### **Faza 1: Przygotowanie**
- [x] Utworzenie nowych modułów
- [x] Migracja bazy danych
- [x] Testy jednostkowe

### **Faza 2: Implementacja**
- [ ] Email Agent AI
- [ ] AI Rules Manager
- [ ] AI Chat Interface
- [ ] Integracja z istniejącym kodem

### **Faza 3: Migracja**
- [ ] Przekierowanie wywołań
- [ ] Testy integracyjne
- [ ] Usunięcie starego kodu

### **Faza 4: Optymalizacja**
- [ ] Uczenie się z danych
- [ ] Optymalizacja zasad
- [ ] Monitoring wydajności

---

## [→] KONFLIKTY Z ISTNIEJĄCYM KODEM

### **Pliki do modyfikacji:**
- `src/services/emailCron.ts` - zmiana wywołania
- `src/integrations/inbox/processor.ts` - zmiana wywołania
- `src/integrations/ai/client.ts` - zachowanie jako fallback

### **Pliki do usunięcia (po migracji):**
- `src/services/aiAgent.ts` - zastąpiony przez `emailAgentAI.ts`

### **Nowe pliki:**
- `src/services/emailAgentAI.ts`
- `src/services/aiRulesManager.ts`
- `src/services/aiChatInterface.ts`

---

## [→] PRZYKŁADY UŻYCIA

### **Dodawanie zasady przez Chat:**
```
Użytkownik: "Dodaj zasadę: jeśli lead pisze 'nie teraz' to klasyfikuj jako MAYBE_LATER"
AI: "Utworzyłem zasadę: MAYBE_LATER dla 'nie teraz' z confidence 0.8"
```

### **Klasyfikacja emaila:**
```typescript
const result = await emailAgentAI.classifyEmail(
  "Proszę o wycenę na usługi IT",
  "pl"
);
// Result: { classification: "INTERESTED", confidence: 0.9, actions: [...] }
```

### **Zarządzanie zasadami:**
```typescript
await aiRulesManager.addRule({
  classification: "MAYBE_LATER",
  keywords: ["nie teraz", "może później"],
  confidence: 0.8,
  priority: 50
});
```

---

## [→] HISTORIA ZMIAN

- **2024-12-24** - Utworzenie dokumentacji architektury AI
- **2024-12-24** - Plan migracji z istniejącego kodu
- **2024-12-24** - Definicja modułów i interfejsów
