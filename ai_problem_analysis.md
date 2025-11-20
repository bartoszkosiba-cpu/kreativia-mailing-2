# ANALIZA PROBLEMU - DLACZEGO AI BŁĘDNIE KLASYFIKUJE PERSONY

## ZIDENTYFIKOWANE PROBLEMY

### 1. ❌ SPRZECZNOŚĆ W PROMPCIE

**Problem**:
```
Linia 66: "Traktuj zasady jako wskazówki, nie twarde reguły"
Linia 554: "Jeśli tytuł zawiera słowo 'sales', decyzja MUSI być 'positive'"
```

**Efekt**: AI jest zdezorientowane - ma traktować jako wskazówki czy jako MUSI?

---

### 2. ❌ BRAK KONTEKSTU BIZNESOWEGO

**Problem**:
- AI nie wie, że to **podwieszenia targowe** (trade show hanging systems)
- AI nie rozumie logiki biznesowej: kto decyduje o zakupie podwieszeń?
- AI nie wie, że "Project Manager" w firmie budującej stoiska targowe = **zawsze** ma wpływ na wybór podwieszeń

**Obecny prompt**:
```
"Twoim zadaniem jest ocenić, czy dana osoba może użyć produktu w swojej pracy lub ma wpływ na decyzję zakupową."
```

**Brakuje**:
- Co to za produkt? (podwieszenia targowe)
- W jakim kontekście? (firmy budujące stoiska targowe)
- Kto decyduje? (Project Manager, Designer, CEO, Sales)

---

### 3. ❌ BRAK KONKRETNYCH PRZYKŁADÓW

**Problem**:
- Prompt nie zawiera przykładów: "Project Manager" = zawsze positive
- AI musi zgadywać na podstawie ogólnych zasad
- Brak wzorców do naśladowania

**Obecny prompt**:
```
"Jeśli rola nie pasuje do żadnej definicji, oceń możliwość użycia produktu..."
```

**Brakuje**:
```
PRZYKŁADY:
- "Project Manager" → ZAWSZE positive (zarządza projektami stoisk, wybiera podwieszenia)
- "CEO" → ZAWSZE positive (decyduje o zakupach)
- "Designer" → ZAWSZE positive (projektuje stoiska, używa podwieszeń)
```

---

### 4. ❌ ZBYT OGÓLNE INSTRUKCJE

**Problem**:
- "Oceń możliwość użycia produktu" - zbyt ogólne
- AI może interpretować różnie w zależności od kontekstu
- Brak jasnych kryteriów decyzyjnych

**Obecny prompt**:
```
"Jeśli rola nie pasuje do żadnej definicji, oceń możliwość użycia produktu w pracy lub wpływ na decyzję zakupową: gdy może użyć produktu lub ma wpływ – 'positive'; gdy brak danych lub niepewność – 'negative'"
```

**Problem**: AI nie wie, co to znaczy "może użyć produktu" w kontekście podwieszeń targowych

---

### 5. ❌ MODEL GPT-4O-MINI MOŻE BYĆ ZA SŁABY

**Problem**:
- Używamy `gpt-4o-mini` (tańszy, mniej precyzyjny)
- Inne moduły używają `gpt-4o` (contentAI, metaAI)
- Mini może mieć problemy z precyzyjnym rozumieniem kontekstu biznesowego

**Porównanie**:
- `contentAI.ts`: `model: "gpt-4o"`, `temperature: 0.7`
- `metaAI.ts`: `model: "gpt-4o"`, `temperature: 0.7`
- `personaVerificationAI.ts`: `model: "gpt-4o-mini"`, `temperature: 0.2`

---

### 6. ❌ TEMPERATURA ZBYT NISKA

**Problem**:
- `temperature: 0.2` - bardzo niska (deterministyczna)
- Może powodować, że AI jest zbyt "sztywne" i nie rozumie kontekstu
- Dla zadań wymagających zrozumienia biznesowego, wyższa temperatura (0.3-0.5) może być lepsza

---

### 7. ❌ BRAK INFORMACJI O FIRMIE W KONTEKŚCIE

**Problem**:
- AI dostaje tylko dane pracownika (tytuł, działy)
- Nie wie, że to firma budująca stoiska targowe
- Nie wie, że kontekst biznesowy = zawsze te same role są pozytywne

**Obecne dane**:
```json
{
  "title": "Project Manager",
  "departments": [],
  "seniority": "manager"
}
```

**Brakuje**:
```json
{
  "companyContext": "Firma budująca stoiska targowe",
  "product": "Podwieszenia targowe",
  "businessLogic": "Project Manager zawsze ma wpływ na wybór podwieszeń"
}
```

---

## PROPOZOWANE ROZWIĄZANIA

### Rozwiązanie 1: POPRAWIĆ PROMPT - DODAĆ KONTEKST BIZNESOWY

**Zmiany**:
1. Dodać sekcję o produkcie i kontekście biznesowym
2. Wyjaśnić logikę: kto decyduje o zakupie podwieszeń targowych
3. Dodać konkretne przykłady

**Nowy prompt**:
```
KONTEKST BIZNESOWY:
- Produkt: Podwieszenia targowe (trade show hanging systems)
- Odbiorcy: Firmy budujące stoiska targowe (exhibition stand builders)
- Cel: Znaleźć osoby, które mają wpływ na wybór podwieszeń targowych

LOGIKA BIZNESOWA:
W firmach budujących stoiska targowe, następujące role ZAWSZE mają wpływ na wybór podwieszeń:
- Project Manager - zarządza projektami stoisk, wybiera komponenty (w tym podwieszenia)
- Designer/Grafik - projektuje stoiska, używa podwieszeń w projektach
- CEO/Właściciel - decyduje o zakupach strategicznych
- Sales Manager - ma wpływ na decyzje zakupowe klientów
- Key Account Manager - zarządza kluczowymi klientami, wpływa na wybory

PRZYKŁADY (ZAWSZE POZYTYWNE):
- "Project Manager" → positive (100%) - zarządza projektami, wybiera podwieszenia
- "Senior Project Manager" → positive (100%) - wyższy poziom, większy wpływ
- "CEO" → positive (100%) - decyduje o zakupach
- "Designer" → positive (100%) - projektuje stoiska, używa podwieszeń
- "Key Account Manager" → positive (100%) - wpływa na decyzje klientów
```

---

### Rozwiązanie 2: USUNĄĆ SPRZECZNOŚCI W PROMPCIE

**Zmiany**:
1. Usunąć "Traktuj zasady jako wskazówki"
2. Zastąpić jasnymi regułami: "ZAWSZE" vs "Oceń"

**Nowy prompt**:
```
ZASADY KLASYFIKACJI (w kolejności priorytetu):

1. STANOWISKA ZAWSZE POZYTYWNE (nie wymagają analizy):
   - Project Manager (wszystkie wersje: Senior, Junior, International, Chief)
   - CEO, Chief Executive Officer, Managing Director
   - Designer, Grafik, Projektant (wszystkie wersje)
   - Sales Manager, Account Manager, Key Account Manager
   - Wszystkie stanowiska zawierające "sales" lub "sprzedaż"
   
2. STANOWISKA ZAWSZE NEGATYWNE:
   - Logistyka, Produkcja, Finanse, HR, IT (bez wpływu na projektowanie/sprzedaż)
   - Marketing (czysty, bez sprzedaży)
   
3. POZOSTAŁE STANOWISKA:
   - Oceń możliwość użycia podwieszeń w pracy lub wpływ na decyzję zakupową
   - Jeśli nie jesteś pewien → negative (lepiej nie dodawać niż dodać błędnie)
```

---

### Rozwiązanie 3: DODAĆ KONTEKST FIRMY DO DANYCH

**Zmiany**:
1. Dodać informację o kontekście firmy (exhibition stand builder)
2. Dodać informację o produkcie (podwieszenia targowe)

**Nowe dane**:
```json
{
  "companyContext": "Exhibition stand builder",
  "product": "Trade show hanging systems",
  "employees": [...]
}
```

---

### Rozwiązanie 4: ZMIENIĆ MODEL NA GPT-4O

**Zmiany**:
1. Zmienić `model: "gpt-4o-mini"` → `model: "gpt-4o"`
2. Zwiększyć `temperature: 0.2` → `temperature: 0.3-0.4`

**Uzasadnienie**:
- GPT-4o lepiej rozumie kontekst biznesowy
- Wyższa temperatura pozwala na lepsze zrozumienie, nie tylko deterministyczne odpowiedzi
- Inne moduły używają GPT-4o i działają dobrze

---

### Rozwiązanie 5: DODAĆ PRZYKŁADY W PROMPCIE

**Zmiany**:
1. Dodać sekcję z konkretnymi przykładami
2. Pokazać AI, jak ma klasyfikować

**Nowy prompt**:
```
PRZYKŁADY KLASYFIKACJI:

✅ POZYTYWNE:
- "Project Manager" → positive (100%) - zarządza projektami stoisk, wybiera podwieszenia
- "Senior Project Manager" → positive (100%) - wyższy poziom, większy wpływ
- "CEO" → positive (100%) - decyduje o zakupach strategicznych
- "Designer" → positive (100%) - projektuje stoiska, używa podwieszeń
- "Key Account Manager" → positive (100%) - wpływa na decyzje klientów

❌ NEGATYWNE:
- "Logistics Manager" → negative (0%) - nie ma wpływu na projektowanie/sprzedaż
- "Financial Director" → negative (0%) - nie ma wpływu na wybór podwieszeń
- "Marketing Manager" (czysty) → negative (0%) - nie projektuje stoisk
```

---

## REKOMENDOWANE DZIAŁANIA (PRIORYTET)

### 🚨 NATYCHMIAST (krytyczne):
1. **Poprawić prompt - dodać kontekst biznesowy i przykłady**
   - Wyjaśnić, co to podwieszenia targowe
   - Wyjaśnić logikę biznesową: kto decyduje
   - Dodać konkretne przykłady

2. **Usunąć sprzeczności w prompcie**
   - Usunąć "Traktuj jako wskazówki"
   - Zastąpić jasnymi regułami: "ZAWSZE" vs "Oceń"

### ⚠️ KRÓTKOTERMINOWO:
3. **Zmień model na GPT-4o**
   - Lepsze zrozumienie kontekstu biznesowego
   - Zwiększ temperature do 0.3-0.4

4. **Dodać kontekst firmy do danych**
   - Informacja, że to firma budująca stoiska targowe
   - Informacja o produkcie

### 📋 DŁUGOTERMINOWO (opcjonalnie):
5. Dodać few-shot learning (więcej przykładów)
6. Dodać walidację wyników AI
7. Dodać możliwość feedbacku i uczenia

---

## PODSUMOWANIE

**Główny problem**: AI nie rozumie kontekstu biznesowego i logiki decyzyjnej

**Główne rozwiązanie**: 
1. Poprawić prompt - dodać kontekst biznesowy, przykłady, usunąć sprzeczności
2. Zmienić model na GPT-4o (lepsze zrozumienie)
3. Dodać kontekst firmy do danych

**Efekt**: AI będzie rozumiało, że "Project Manager" w firmie budującej stoiska targowe = zawsze pozytywne, bo ma wpływ na wybór podwieszeń

