# Moduł Wyboru Leadów - Plan Implementacji

## 🎯 Cel Modułu

Weryfikacja firm z listy (~600 firm) pod kątem przydatności do poszukiwania w nich leadów (pracowników). Moduł ma działać **niezależnie** od modułu CRM i Wysyłki maili.

## 📋 Funkcjonalność

### Główny Workflow:
1. **Import listy firm** (CSV) → Baza firm do weryfikacji
2. **Weryfikacja AI** → Każda firma jest analizowana przez AI
3. **Wyniki weryfikacji** → Lista firm zakwalifikowanych/odrzuconych
4. **Eksport** → Możliwość eksportu zakwalifikowanych firm (np. do Apollo)

## 🏗️ Architektura

### 1. Baza Danych (Prisma Schema)

```prisma
model Company {
  id              Int      @id @default(autoincrement())
  name            String   // Nazwa firmy
  website         String?  // URL strony www
  description     String?  // Opis firmy (z CSV lub ze strony)
  industry        String?  // Branża
  city            String?  // Miasto
  country         String?  // Kraj
  employeeCount   Int?     // Liczba pracowników (jeśli dostępne)
  
  // Status weryfikacji
  verificationStatus String @default("PENDING") // PENDING | VERIFYING | QUALIFIED | REJECTED | ERROR
  verificationResult String? // JSON z wynikiem weryfikacji AI
  verificationScore  Float?  // 0.0 - 1.0 (pewność AI)
  verificationReason String? // Uzasadnienie decyzji AI
  
  // Metadane weryfikacji
  verifiedAt      DateTime? // Kiedy zweryfikowano
  verifiedBy      String?   // "AI" | "MANUAL"
  verificationSource String? // "DESCRIPTION" | "WEBSITE" | "MANUAL"
  
  // Dodatkowe dane ze strony
  scrapedContent  String?   // Zawartość ze strony (cache)
  scrapedAt       DateTime? // Kiedy pobrano zawartość
  
  // Notatki użytkownika
  notes           String?
  tags            String?   // JSON array of tags
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([verificationStatus])
  @@index([verifiedAt])
}

model CompanyVerificationLog {
  id              Int      @id @default(autoincrement())
  companyId       Int
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  // Szczegóły weryfikacji
  status          String   // PENDING | VERIFYING | QUALIFIED | REJECTED | ERROR
  score           Float?   // 0.0 - 1.0
  reason          String?  // Uzasadnienie
  source          String?  // "DESCRIPTION" | "WEBSITE" | "MANUAL"
  content         String?  // Treść użyta do weryfikacji (opis lub zawartość strony)
  
  // AI Metadata
  aiModel         String?  // "gpt-4o" | "gpt-4o-mini"
  aiTokens        Int?     // Liczba tokenów użytych
  aiCost          Float?   // Szacowany koszt
  
  createdAt       DateTime  @default(now())
  
  @@index([companyId])
  @@index([status])
  @@index([createdAt])
}
```

### 2. Struktura Katalogów

```
app/
├── company-selection/          # Nowy moduł
│   ├── page.tsx               # Główna strona modułu
│   ├── import/page.tsx        # Import CSV firm
│   ├── verify/page.tsx        # Weryfikacja firm
│   └── results/page.tsx       # Wyniki weryfikacji
│
app/api/
├── company-selection/
│   ├── import/route.ts        # Import CSV firm
│   ├── verify/route.ts        # Weryfikacja pojedynczej firmy
│   ├── verify-batch/route.ts  # Weryfikacja wielu firm
│   ├── list/route.ts          # Lista firm z filtrami
│   ├── update/route.ts        # Aktualizacja firmy (notatki, status)
│   └── export/route.ts        # Eksport zakwalifikowanych firm

src/
├── services/
│   ├── companyVerificationAI.ts  # Główna logika weryfikacji AI
│   ├── companyScraper.ts         # Pobieranie zawartości ze stron
│   └── companySelectionService.ts # Logika biznesowa
│
└── integrations/
    └── apollo/                    # Integracja z Apollo API (przyszłość)
        └── client.ts
```

### 3. Proces Weryfikacji AI

#### Krok 1: Pobranie danych o firmie
- Jeśli jest `description` w CSV → użyj go
- Jeśli jest `website` → pobierz zawartość strony (scraping)
- Jeśli brak obu → status ERROR

#### Krok 2: Weryfikacja przez AI
- Prompt AI z kryteriami kwalifikacji
- Przykład: "Czy firma wykonuje zabudowy i stoiska targowe?"
- AI zwraca: `QUALIFIED` / `REJECTED` + score + reason

#### Krok 3: Zapis wyniku
- Status weryfikacji
- Wynik AI (JSON)
- Log weryfikacji

## 🤖 AI Verification Prompt

### Przykładowy prompt:

```
Jesteś ekspertem od weryfikacji firm pod kątem przydatności do prospectingu.

KRYTERIA KWALIFIKACJI:
✅ TAK (QUALIFIED):
- Firmy wykonujące zabudowy targowe, stoiska targowe
- Firmy produkujące elementy wystawiennicze
- Firmy montujące konstrukcje targowe
- Firmy oferujące kompleksowe usługi targowe (projektowanie + wykonanie)

❌ NIE (REJECTED):
- Agencje reklamowe (tylko projektowanie, bez produkcji)
- Drukarnie (tylko druk, bez konstrukcji)
- Organizatorzy targów (MTP, Targi Kielce, etc.)
- Firmy zajmujące się tylko marketingiem/eventami
- Firmy nie związane z branżą targową

DANE FIRMY:
Nazwa: {companyName}
Opis: {description}
Strona: {website}
Branża: {industry}

Odpowiedz w formacie JSON:
{
  "status": "QUALIFIED" | "REJECTED",
  "score": 0.0-1.0,
  "reason": "Uzasadnienie decyzji (max 200 znaków)",
  "keywords": ["słowo1", "słowo2"], // Kluczowe słowa które zadecydowały
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}
```

## 📊 UI/UX

### Strona główna (`/company-selection`)
- Statystyki: Pending, Qualified, Rejected
- Lista firm z filtrami (status, branża, data weryfikacji)
- Akcje: Import CSV, Weryfikacja batch, Eksport

### Import (`/company-selection/import`)
- Upload CSV
- Podgląd danych
- Mapowanie kolumn (name, website, description, industry, etc.)
- Import do bazy

### Weryfikacja (`/company-selection/verify`)
- Lista firm do weryfikacji
- Progress bar (dla batch)
- Możliwość ręcznej weryfikacji (override AI)
- Szczegóły weryfikacji (reason, score, content)

### Wyniki (`/company-selection/results`)
- Filtrowanie: Qualified / Rejected
- Sortowanie: score, data, nazwa
- Eksport do CSV/JSON
- Integracja z Apollo (przyszłość)

## 🔧 Technologie

- **Scraping**: `cheerio` lub `puppeteer` (dla JS)
- **AI**: OpenAI GPT-4o-mini (jak w reszcie aplikacji)
- **CSV**: `papaparse` (już używane w projekcie)
- **Rate Limiting**: Dla scrapingu (max X requestów/minutę)

## ⚠️ Zagrożenia i Wyzwania

### 1. **Scraping stron**
- ❌ **Problem**: Niektóre strony mogą blokować boty
- ✅ **Rozwiązanie**: User-Agent, delays, fallback do opisu z CSV

### 2. **Koszty AI**
- ❌ **Problem**: 600 firm × AI call = koszt
- ✅ **Rozwiązanie**: 
  - Batch processing z limitami
  - Cache wyników
  - Możliwość ręcznej weryfikacji

### 3. **Jakość danych**
- ❌ **Problem**: Brak opisu lub nieaktualna strona
- ✅ **Rozwiązanie**: 
  - Status ERROR dla braku danych
  - Możliwość ręcznej weryfikacji
  - Notatki użytkownika

### 4. **Rate Limiting**
- ❌ **Problem**: Zbyt wiele requestów do AI/stron
- ✅ **Rozwiązanie**: 
  - Queue system (jak w kampaniach)
  - Throttling (max X/minutę)
  - Progress tracking

## 🚀 Plan Implementacji (Krok po kroku)

### Faza 1: Podstawowa struktura
1. ✅ Schema Prisma (Company, CompanyVerificationLog)
2. ✅ Migracja bazy danych
3. ✅ Podstawowe API endpoints (import, list)
4. ✅ UI: Strona główna + Import CSV

### Faza 2: Weryfikacja AI
1. ✅ Service: `companyVerificationAI.ts`
2. ✅ Prompt AI z kryteriami
3. ✅ API: `/api/company-selection/verify`
4. ✅ UI: Strona weryfikacji

### Faza 3: Scraping stron
1. ✅ Service: `companyScraper.ts`
2. ✅ Integracja z weryfikacją AI
3. ✅ Cache scraped content
4. ✅ Error handling

### Faza 4: Batch Processing
1. ✅ Queue system dla batch verification
2. ✅ Progress tracking
3. ✅ UI: Progress bar, status updates

### Faza 5: Eksport i Integracje
1. ✅ Eksport do CSV/JSON
2. ✅ Integracja z Apollo API (przyszłość)
3. ✅ Filtry i sortowanie

## 📊 Struktura CSV (na podstawie próbki)

### Kolumny w CSV:
1. **Unikalny identyfikator** - ID
2. **Nazwa** - Nazwa firmy
3. **Branża** - Branża (np. "Targi")
4. **Kraj** - Kraj (np. "Polska")
5. **Miasto** - Miasto
6. **Kod pocztowy** - Kod pocztowy
7. **Ulica** - Ulica
8. **Numer budynku** - Numer budynku
9. **Strona www** - URL strony
10. **Opis** - Opis firmy (długi tekst)
11. **NIP, REGON, KRS** - Dane prawne
12. **Data założenia** - Data założenia
13. **Forma prawna** - Forma prawna
14. **Wielkość firmy** - Wielkość (Duża, Średnia, Mała)
15. **Liczba pracowników** - Zakres pracowników
16. **Przychody, Zysk netto** - Dane finansowe
17. **Liczba lokalizacji** - Liczba lokalizacji
18. **Punkty oceny** - Ocena firmy
19. **Kod SIC, NACE** - Kody branżowe
20. **Opis działalności** - Krótki opis działalności
21. **Data weryfikacji** - Data weryfikacji (jeśli była)
22. **Status weryfikacji** - Status (np. "Zweryfikowany")
23. **Komentarz weryfikacji** - Komentarz (np. "Firma targowa, nie wykonuje zabudów")
24. **Data ostatniej modyfikacji** - Data modyfikacji
25. **Użytkownik modyfikujący** - Kto modyfikował

### Kluczowe kolumny do weryfikacji AI:
- **Nazwa** - Nazwa firmy
- **Branża** - Branża
- **Strona www** - URL (do scrapingu)
- **Opis** - Długi opis (główny materiał do analizy)
- **Opis działalności** - Krótki opis (dodatkowy materiał)
- **Komentarz weryfikacji** - Jeśli istnieje, może być użyty jako training data

## 📝 Uwagi z analizy próbki

1. **Przykładowe firmy**: MTP, EXPO XXI, PTAK WARSAW EXPO - to organizatorzy targów
2. **Komentarz weryfikacji**: "Firma targowa, nie wykonuje zabudów" - potwierdza, że te firmy NIE pasują
3. **Dane do analizy**: Mamy zarówno "Opis" (długi) jak i "Opis działalności" (krótki) - oba mogą być użyte
4. **Strona www**: Wszystkie firmy mają URL - możemy scrapować

